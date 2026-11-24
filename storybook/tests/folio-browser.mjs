// Real Folio integration: persistent world, native clocks and measured audio output.
// No test-generated audio source, mixer or timeline drives this acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {TEMPLATE} from '../src/catalog-data.mjs';

const {audioContract} = await import(pathToFileURL(path.join(TEMPLATE, 'source/lib/sequences/document-flow/audio-contract.mjs')).href);

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';
const OUT = path.resolve(process.env.STORYBOOK_TEST_RESULTS ?? path.join(HERE, 'test-results'), 'folio');
const STORY = 'pure-kinetic-sequences-folio--continuous';
const FORMATS = {landscape: [1920, 1080], portrait: [1080, 1920], square: [1080, 1080]};
const PHASES = ['intro', 'collect', 'arrange', 'create', 'end'];
const hash = value => createHash('sha256').update(value).digest('hex');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const url = relative => new URL(relative, BASE.endsWith('/') ? BASE : BASE + '/');
const executablePath = process.env.CHROME_BIN ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(file => fs.existsSync(file));
assert.ok(executablePath, 'Chrome not found: set CHROME_BIN');
fs.mkdirSync(OUT, {recursive: true});
const report = {url: BASE, story: STORY, startedAt: new Date().toISOString(), cases: [], checks: [], passed: false};
const writeReport = () => fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');

async function fetchJSON(relative) {
  const deadline = performance.now() + 10000;
  for (;;) {
    try {
      const response = await fetch(url(relative), {signal: AbortSignal.timeout(2000)});
      if (response.status === 503 && performance.now() < deadline) { await wait(200); continue; }
      assert.ok(response.ok, relative + ' returned HTTP ' + response.status);
      return await response.json();
    } catch (error) {
      const transport = error instanceof TypeError || ['TimeoutError', 'AbortError'].includes(error.name);
      if (!transport || performance.now() >= deadline) throw error;
      await wait(200);
    }
  }
}

// Installed before native runtime initialization in each iframe. The original
// output connection is untouched; an unconnected analyser observes a side branch
// after the native monitor gain. Only the shipped runtime creates audio sources.
function observeNativeAudio() {
  if (!globalThis.AudioNode || globalThis.__folioAudioProbe) return;
  const taps = [], observed = new WeakSet(), original = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function(destination, ...args) {
    const result = Reflect.apply(original, this, [destination, ...args]);
    if (destination === this.context.destination && !observed.has(this)) {
      observed.add(this);
      const analyser = this.context.createAnalyser(); analyser.fftSize = 2048;
      Reflect.apply(original, this, [analyser]);
      taps.push({context: this.context, analyser, samples: new Float32Array(2048)});
    }
    return result;
  };
  globalThis.__folioAudioProbe = {
    contexts: () => taps.map(tap => tap.context),
    read() {
      return taps.map(({context, analyser, samples}) => {
        analyser.getFloatTimeDomainData(samples);
        let peak = 0, sum = 0, finite = true;
        for (const value of samples) { finite &&= Number.isFinite(value); peak = Math.max(peak, Math.abs(value)); sum += value * value; }
        // Suspended contexts can retain their last analyser buffer. Record the
        // raw data and context state separately: suspended output cannot play.
        return {contextState: context.state, contextTime: context.currentTime, peak, rms: Math.sqrt(sum / samples.length), finite};
      });
    },
  };
}

function storyURL(format, id = STORY) {
  const target = url('iframe.html');
  target.searchParams.set('id', id); target.searchParams.set('viewMode', 'story');
  target.searchParams.set('globals', 'aspect:' + format);
  return target.href;
}

async function openPage(browser, format) {
  const page = await browser.newPage(), errors = [], requests = [], pending = new Map();
  let closing = false;
  page.setDefaultTimeout(40000);
  await page.setViewport({width: 1440, height: 1100, deviceScaleFactor: 1});
  // Audio must be opt-in even when ordinary animation autoplay is permitted.
  await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'no-preference'}]);
  await page.evaluateOnNewDocument(observeNativeAudio);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => pending.set(request, {url: request.url(), type: request.resourceType(), startedAt: performance.now()}));
  page.on('requestfinished', request => pending.delete(request));
  page.on('response', response => { if (response.status() >= 400) requests.push({url: response.url(), status: response.status()}); });
  page.on('requestfailed', request => {
    pending.delete(request);
    if (!closing && request.failure()?.errorText !== 'net::ERR_ABORTED') requests.push({url: request.url(), error: request.failure()?.errorText});
  });
  const session = {page, errors, requests, pending, close: async () => { closing = true; await page.close(); }};
  try { await page.goto(storyURL(format), {waitUntil: 'domcontentloaded'}); return session; }
  catch (error) { error.diagnostics = await diagnostics(session, 'open-' + format, error); await session.close(); throw error; }
}

async function ready(page) {
  await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('pk-component-story')?.dataset.state));
  const host = await page.$eval('pk-component-story', node => ({state: node.dataset.state, error: node.querySelector('[role=alert]')?.textContent}));
  assert.equal(host.state, 'ready', host.error ?? 'Folio host is not ready');
  await page.waitForFunction(() => {
    const player = document.querySelector('hyperframes-player'), win = player?.iframeElement?.contentWindow;
    const root = win?.document.querySelector('[data-sequence-root="document-flow"]');
    return Boolean(player?.ready && player.assetsReady && player.painted && win.__renderReady === true
      && root?.documentFlow && win.__timelines?.main);
  });
  return page.evaluate(() => {
    const player = document.querySelector('hyperframes-player'), win = player.iframeElement.contentWindow;
    const root = win.document.querySelector('[data-sequence-root="document-flow"]'), instance = root.documentFlow;
    const docs = [...root.querySelectorAll('[data-document-id]')], world = root.querySelector('[data-world-camera]');
    win.__folioIdentity = {root, instance, world, documents: new Map(docs.map(node => [node.dataset.documentId, node]))};
    return {paused: player.paused, muted: player.muted, volume: player.volume, duration: player.duration,
      dimensions: [player.compositionWidth, player.compositionHeight], plan: instance.plan,
      audioCurrent: instance.audioCurrent, nativeRuntime: Boolean(win.__player), timelineIds: Object.keys(win.__timelines),
      documentIds: docs.map(node => node.dataset.documentId), errors: win.__hfStartupError ? [win.__hfStartupError] : [],
      audio: [...win.document.querySelectorAll('audio')].map(node => ({
        id: node.id, src: node.getAttribute('src'), resolvedSrc: node.src, instance: node.dataset.sequenceInstance,
        event: node.dataset.sequenceEvent ?? null, kind: node.dataset.sequenceKind ?? null, target: node.dataset.sequenceTarget ?? null,
        start: Number(node.dataset.start), duration: Number(node.dataset.duration), gain: Number(node.dataset.volume),
        rate: Number(node.dataset.playbackRate), music: node.hasAttribute('data-sequence-music'),
      }))};
  });
}

async function seek(page, time) {
  const at = Math.floor(time * 30) / 30;
  await page.$eval('hyperframes-player', (player, value) => { player.pause(); player.seek(value); }, at);
  await page.waitForFunction(value => {
    const player = document.querySelector('hyperframes-player');
    const instance = player?.iframeElement?.contentWindow.document.querySelector('[data-sequence-root="document-flow"]')?.documentFlow;
    return instance && Math.abs(instance.state.time - value) < .00002;
  }, {}, at);
  await page.evaluate(async () => {
    const win = document.querySelector('hyperframes-player').iframeElement.contentWindow;
    await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
  });
  return at;
}

async function snapshot(page, time) {
  const at = await seek(page, time);
  const data = await page.evaluate(() => {
    const player = document.querySelector('hyperframes-player'), win = player.iframeElement.contentWindow;
    const proof = win.__folioIdentity, root = proof.root, instance = root.documentFlow;
    const documents = [...root.querySelectorAll('[data-document-id]')], worlds = [...root.querySelectorAll('[data-world-camera]')];
    const encode = node => node.nodeType !== Node.ELEMENT_NODE ? [node.nodeType, node.nodeValue] : [
      node.tagName,
      [...node.attributes].map(attribute => [attribute.name, attribute.name === 'style'
        ? [...node.style].sort().map(key => [key, node.style.getPropertyValue(key), node.style.getPropertyPriority(key)])
        : attribute.name === 'class' ? [...node.classList].sort() : attribute.value]).sort(([a], [b]) => a.localeCompare(b)),
      [...node.childNodes].map(encode),
    ];
    return {time: instance.state.time, phase: instance.state.phase, state: instance.state, audit: instance.audit(),
      identity: root === proof.root && instance === proof.instance && worlds[0] === proof.world
        && documents.length === proof.documents.size && documents.every(node => proof.documents.get(node.dataset.documentId) === node),
      underWorld: documents.every(node => node.closest('[data-world-camera]') === proof.world),
      documentIds: documents.map(node => node.dataset.documentId), worldCount: worlds.length,
      worldTransform: proof.world.style.transform, dom: JSON.stringify(encode(root)),
      camera: instance.state.camera, paused: player.paused, errors: win.__hfStartupError ? [win.__hfStartupError] : []};
  });
  assert.ok(data.identity && data.underWorld, 'Folio replaced a persistent document, world or instance');
  assert.equal(data.worldCount, 1); assert.equal(data.documentIds.length, 6);
  assert.equal(data.audit.cameraCount, 1); assert.equal(data.audit.documentCount, 6);
  assert.ok(data.paused); assert.deepEqual(data.errors, []);
  return {time: at, phase: data.phase, state: data.state, camera: data.camera,
    domHash: hash(data.dom), geometryHash: hash(JSON.stringify(data.audit)), worldTransform: data.worldTransform, identity: data.identity};
}

function validateAudio(runtime, project) {
  assert.equal(project.schema, 'document-flow-project.v1');
  assert.equal(runtime.plan.schema, 'document-flow.v1');
  assert.equal(audioContract(runtime.plan), audioContract(project.plan), 'Native picture and emitted audio contract differ');
  assert.ok(runtime.audioCurrent);
  const fx = runtime.audio.filter(clip => !clip.music), music = runtime.audio.filter(clip => clip.music);
  assert.equal(runtime.audio.length, project.audio.clips.length + Number(Boolean(project.audio.music)));
  assert.equal(new Set(runtime.audio.map(clip => clip.id)).size, runtime.audio.length);
  assert.equal(fx.length, project.plan.events.length);
  assert.equal(new Set(fx.map(clip => clip.event)).size, fx.length);
  for (const emitted of project.audio.clips) {
    const actual = fx.find(clip => clip.event === emitted.eventId), event = project.plan.events.find(item => item.id === emitted.eventId);
    assert.ok(actual && event, emitted.eventId);
    for (const key of ['src', 'start', 'duration', 'gain', 'kind', 'target']) assert.equal(actual[key], emitted[key], emitted.eventId + '.' + key);
    assert.equal(actual.rate, emitted.playbackRate); assert.equal(actual.start, event.time);
    assert.equal(actual.kind, event.kind); assert.equal(actual.target, event.target);
  }
  assert.equal(music.length, 1);
  for (const key of ['src', 'start', 'duration', 'gain']) assert.equal(music[0][key], project.audio.music[key]);
  assert.equal(music[0].rate, project.audio.music.playbackRate);
  assert.ok(runtime.audio.every(clip => clip.gain > 0 && clip.duration > 0 && clip.start + clip.duration <= project.plan.duration + 1e-7));
}

async function decodeAssets(page, project, format) {
  const assets = project.audio.assets.map(asset => ({...asset, url: new URL(asset.src, url('pk/folio/' + format + '.html')).href}));
  const decoded = await page.evaluate(async assets => {
    const Offline = globalThis.OfflineAudioContext;
    if (!Offline) throw new Error('OfflineAudioContext unavailable for decode-only inspection');
    const context = new Offline(2, 1, 48000), results = [];
    for (const asset of assets) {
      const response = await fetch(asset.url);
      if (!response.ok) throw new Error('Audio HTTP ' + response.status + ': ' + asset.url);
      const bytes = await response.arrayBuffer(), buffer = await context.decodeAudioData(bytes.slice(0));
      let peak = 0, sum = 0, count = 0, finite = true;
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) for (const sample of buffer.getChannelData(channel)) {
        finite &&= Number.isFinite(sample); peak = Math.max(peak, Math.abs(sample)); sum += sample * sample; count++;
      }
      results.push({id: asset.id, bytes: bytes.byteLength,
        sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join(''),
        channels: buffer.numberOfChannels, sampleRate: buffer.sampleRate, frames: buffer.length, duration: buffer.duration,
        peak, rms: Math.sqrt(sum / count), finite});
    }
    return results;
  }, assets);
  assert.equal(new Set(decoded.map(asset => asset.sha256)).size, assets.length);
  for (const result of decoded) {
    const expected = assets.find(asset => asset.id === result.id);
    assert.equal(result.sha256, expected.sha256); assert.equal(result.bytes, expected.bytes);
    assert.ok(result.frames > 0 && result.duration > 0 && result.finite && result.peak > 1e-5 && result.rms > 1e-6, 'Silent or invalid WAV: ' + result.id);
  }
  return decoded;
}

async function output(page) {
  return page.evaluate(() => {
    const player = document.querySelector('hyperframes-player'), win = player.iframeElement.contentWindow;
    const instance = win.document.querySelector('[data-sequence-root="document-flow"]')?.documentFlow;
    return {at: performance.now(), time: instance?.state.time, paused: player.paused, muted: player.muted,
      volume: player.volume, playbackRate: player.playbackRate, taps: win.__folioAudioProbe?.read() ?? []};
  });
}
const audible = sample => sample.taps.some(tap => tap.contextState === 'running' && tap.finite && tap.peak > 1e-5);
const silent = sample => sample.taps.every(tap => tap.contextState !== 'running' || tap.peak < 1e-6);

async function expectAudio(page, expected, label) {
  const deadline = performance.now() + 5000;
  let sample;
  do {
    sample = await output(page);
    assert.ok(sample.taps.every(tap => tap.finite), 'Non-finite native audio output');
    if (sample.taps.length && (expected ? audible(sample) : silent(sample))) return {...sample, label};
    await wait(50);
  } while (performance.now() < deadline);
  assert.fail(label + ': actual native output did not become ' + (expected ? 'nonzero' : 'silent') + ': ' + JSON.stringify(sample));
}

async function audioPlayback(page) {
  const result = {scope: 'Measured PCM at the native AudioContext destination; not human listening', samples: []};
  const initial = await output(page); assert.ok(initial.paused && initial.muted);
  await page.waitForFunction(() => !document.querySelector('[data-action="play-with-sound"]')?.disabled);
  await page.click('[data-action="play-with-sound"]');
  const playing = await expectAudio(page, true, 'user-click playback');
  assert.ok(!playing.paused && !playing.muted && playing.volume > 0); result.samples.push(playing);
  await page.$eval('hyperframes-player', player => { player.muted = true; });
  result.samples.push(await expectAudio(page, false, 'muted'));
  await page.$eval('hyperframes-player', player => { player.muted = false; });
  result.samples.push(await expectAudio(page, true, 'unmuted'));
  await page.$eval('hyperframes-player', player => player.pause());
  await wait(250);
  const paused = await expectAudio(page, false, 'paused'); assert.ok(paused.paused); result.samples.push(paused);
  await wait(200); const still = await output(page);
  assert.ok(Math.abs(still.time - paused.time) < .00002, 'Pause did not stop the native timeline');

  await seek(page, 6);
  await wait(250); result.samples.push(await expectAudio(page, false, 'paused seek'));
  const sought = await output(page); assert.ok(Math.abs(sought.time - 6) < .00002);
  await page.$eval('hyperframes-player', player => player.play());
  result.samples.push(await expectAudio(page, true, 'resume after seek'));
  result.rates = [];
  for (const rate of [.5, 1.5]) {
    await seek(page, 7);
    await page.$eval('hyperframes-player', (player, value) => { player.playbackRate = value; player.play(); }, rate);
    await expectAudio(page, true, 'playback rate ' + rate);
    const before = await output(page); await wait(650); const after = await output(page);
    const measuredRate = (after.time - before.time) / ((after.at - before.at) / 1000);
    assert.ok(Math.abs(measuredRate - rate) < .18, 'Native audio/visual transport rate differs: ' + measuredRate + ' vs ' + rate);
    assert.equal(after.playbackRate, rate); assert.ok(audible(after));
    result.rates.push({requested: rate, measured: measuredRate, before, after});
  }
  await page.$eval('hyperframes-player', player => { player.pause(); player.playbackRate = 1; });
  await wait(250); result.samples.push(await expectAudio(page, false, 'final pause'));
  return result;
}

function checkSession(session) {
  assert.deepEqual(session.requests, [], 'A Folio asset failed to load');
  assert.deepEqual(session.errors, [], 'Browser error while playing Folio');
}

async function diagnostics(session, name, error) {
  const detail = {error: String(error.stack ?? error), errors: session?.errors, requests: session?.requests,
    pending: session ? [...session.pending.values()].map(({startedAt, ...rest}) => ({...rest, elapsedMs: Math.round(performance.now() - startedAt)})) : []};
  if (session) {
    try { detail.state = await session.page.evaluate(() => {
      const host = document.querySelector('pk-component-story'), player = host?.querySelector('hyperframes-player');
      const win = player?.iframeElement?.contentWindow, root = win?.document.querySelector('[data-sequence-root="document-flow"]');
      return {host: host?.dataset.state, error: host?.querySelector('[role=alert]')?.textContent,
        player: player && {ready: player.ready, assetsReady: player.assetsReady, painted: player.painted, muted: player.muted, paused: player.paused},
        sequence: root?.documentFlow?.audit(), sequenceError: root?.dataset.sequenceError, startupError: win?.__hfStartupError,
        timelines: Object.keys(win?.__timelines ?? {}), audio: win?.__folioAudioProbe?.read()};
    }); } catch (failure) { detail.captureError = String(failure); }
    try { await session.page.screenshot({path: path.join(OUT, name + '.png'), fullPage: true}); }
    catch (failure) { detail.screenshotError = String(failure); }
  }
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(detail, null, 2) + '\n');
  return name + '.json';
}

async function runFormat(browser, format) {
  const row = {format, passed: false}; let session;
  try {
    const project = await fetchJSON('pk/folio/' + format + '.project.json');
    session = await openPage(browser, format); const {page} = session;
    const runtime = await ready(page);
    row.runtime = {duration: runtime.duration, dimensions: runtime.dimensions, audioHosts: runtime.audio.length,
      audioCurrent: runtime.audioCurrent, nativeRuntime: runtime.nativeRuntime, documentIds: runtime.documentIds, timelineIds: runtime.timelineIds};
    assert.deepEqual(runtime.dimensions, FORMATS[format]); assert.ok(runtime.nativeRuntime);
    assert.ok(runtime.paused && runtime.muted, 'Audio example must initially stay paused and muted');
    assert.deepEqual(runtime.plan.phases.map(phase => phase.id), PHASES);
    assert.deepEqual(runtime.documentIds, project.plan.content.documents.map(document => document.id));
    assert.equal(runtime.documentIds.length, 6); assert.equal(new Set(runtime.documentIds).size, 6);
    assert.deepEqual(runtime.errors, []); validateAudio(runtime, project);
    row.decodedAssets = await decodeAssets(page, project, format);
    row.forward = []; row.screenshots = [];
    for (const phase of runtime.plan.phases) {
      const sample = await snapshot(page, phase.start + (phase.end - phase.start) * .6);
      assert.equal(sample.phase, phase.id); row.forward.push(sample);
      const name = format + '-' + phase.id + '.png';
      await (await page.$('hyperframes-player')).screenshot({path: path.join(OUT, name)}); row.screenshots.push(name);
    }
    assert.ok(new Set(row.forward.map(sample => sample.worldTransform)).size >= 3, 'Continuous camera did not move');
    row.reverse = [];
    for (const before of [...row.forward].reverse()) {
      const after = await snapshot(page, before.time);
      assert.equal(after.domHash, before.domHash, 'Reverse DOM differs in ' + before.phase);
      assert.equal(after.geometryHash, before.geometryHash, 'Reverse geometry differs in ' + before.phase);
      assert.deepEqual(after.state, before.state); row.reverse.push(after);
    }
    row.audioPlayback = await audioPlayback(page);
    checkSession(session); row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); row.diagnostics = error.diagnostics ?? await diagnostics(session, 'failure-' + format, error); }
  finally { await session?.close(); report.cases.push(row); writeReport(); }
  console.log('Folio ' + format + ': ' + (row.passed ? 'pass' : row.error));
}

async function integration(browser, componentId) {
  const row = {name: 'format-and-story-cleanup', passed: false}; let session;
  try {
    session = await openPage(browser, 'landscape'); const {page} = session;
    await ready(page); row.switches = [];
    async function preserve() {
      await page.evaluate(() => {
        const player = document.querySelector('hyperframes-player'), win = player.iframeElement.contentWindow;
        const root = win.document.querySelector('[data-sequence-root="document-flow"]');
        window.__oldFolio = {player, root, instance: root.documentFlow, contexts: win.__folioAudioProbe.contexts(), win};
      });
    }
    async function verifyCleanup() {
      const old = await page.evaluate(() => {
        const {player, root, contexts} = window.__oldFolio;
        return {connected: player.isConnected, paused: player.paused, instanceCleared: !root.documentFlow,
          remainingChildren: root.childElementCount, audioContextStates: contexts.map(context => context.state)};
      });
      assert.equal(old.connected, false); assert.equal(old.paused, true); assert.equal(old.instanceCleared, true);
      assert.equal(old.remainingChildren, 0); assert.ok(old.audioContextStates.every(state => state === 'closed'));
      return old;
    }
    for (const format of ['portrait', 'square']) {
      await page.click('[data-action="play-with-sound"]'); await expectAudio(page, true, 'before format change');
      await preserve();
      await page.evaluate(aspect => window.__STORYBOOK_ADDONS_CHANNEL__.emit(window.__STORYBOOK_MODULE_CORE_EVENTS__.UPDATE_GLOBALS, {globals: {aspect}}), format);
      await page.waitForFunction(() => document.querySelector('hyperframes-player') !== window.__oldFolio.player);
      const current = await ready(page); assert.deepEqual(current.dimensions, FORMATS[format]); assert.ok(current.paused && current.muted);
      row.switches.push({format, cleanup: await verifyCleanup()});
    }
    await page.click('[data-action="play-with-sound"]'); await expectAudio(page, true, 'before story change');
    await preserve();
    await page.evaluate(storyId => {
      const event = window.__STORYBOOK_MODULE_CORE_EVENTS__.SET_CURRENT_STORY;
      if (!event) throw new Error('Storybook SET_CURRENT_STORY is unavailable');
      window.__STORYBOOK_ADDONS_CHANNEL__.emit(event, {storyId, viewMode: 'story'});
    }, componentId);
    await page.waitForFunction(() => {
      const player = document.querySelector('hyperframes-player');
      return player !== window.__oldFolio.player && player?.ready && player.assetsReady && player.painted
        && Boolean(player.iframeElement?.contentWindow.__storybookComponent);
    });
    row.otherStory = {id: componentId, cleanup: await verifyCleanup()};
    checkSession(session); row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); row.diagnostics = error.diagnostics ?? await diagnostics(session, 'failure-integration', error); }
  finally { await session?.close(); report.checks.push(row); writeReport(); }
  console.log('Folio cleanup: ' + (row.passed ? 'pass' : row.error));
}

let browser;
try {
  const index = await fetchJSON('index.json');
  assert.equal(index.entries[STORY]?.exportName, 'Continuous', 'Folio story missing');
  const component = Object.values(index.entries).find(entry => entry.type === 'story' && entry.exportName === 'Preview' && entry.title.endsWith('/title'));
  assert.ok(component);
  report.build = await fetchJSON('pk/catalog-build.json');
  assert.equal(report.build.runtime, '0.9.19'); assert.equal(hash(JSON.stringify(report.build.evidence)), report.build.digest);
  browser = await puppeteer.launch({executablePath, headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage']});
  for (const format of Object.keys(FORMATS)) await runFormat(browser, format);
  await integration(browser, component.id);
  report.passed = report.cases.length === 3 && report.cases.every(row => row.passed) && report.checks.length === 1 && report.checks.every(row => row.passed);
} catch (error) { report.error = String(error.stack ?? error); console.error(report.error); }
finally { await browser?.close(); report.completedAt = new Date().toISOString(); writeReport(); }
console.log(report.cases.filter(row => row.passed).length + '/3 Folio formats; ' + report.checks.filter(row => row.passed).length + '/1 cleanup checks passed. ' + path.join(OUT, 'report.json'));
process.exitCode = report.passed ? 0 : 1;
