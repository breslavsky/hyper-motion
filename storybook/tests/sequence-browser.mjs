// Focused acceptance of the four production scenes composed by the native player.
// Run against a built/running Storybook: npm run test:sequences
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {readSequenceExample} from '../scripts/sequences.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';
const OUT = path.resolve(process.env.STORYBOOK_TEST_RESULTS ?? path.join(HERE, 'test-results'), 'sequence');
const ID = 'pure-kinetic-sequences-idea-to-action--sequence';
const TYPES = ['title', 'typewriter', 'modal-morph', 'endcard'];
const DIMENSIONS = {'16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080]};
const ASPECT_KEYS = {'16:9': 'landscape', '9:16': 'portrait', '1:1': 'square'};
const CONTROLS_TAB = '[role="tab"][id$="-tab-addon-controls"]';
const url = relative => new URL(relative, BASE.endsWith('/') ? BASE : `${BASE}/`);
const hash = value => createHash('sha256').update(value).digest('hex');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const executablePath = process.env.CHROME_BIN ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(file => fs.existsSync(file));
assert.ok(executablePath, 'Chrome not found: set CHROME_BIN to its executable');
fs.mkdirSync(OUT, {recursive: true});
const report = {url: BASE, story: ID, startedAt: new Date().toISOString(), cases: [], checks: [], passed: false};
const writeReport = () => fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2)+'\n');

async function fetchJSON(relative) {
  const deadline = performance.now()+10000;
  for (;;) {
    try {
      const response = await fetch(url(relative), {signal: AbortSignal.timeout(2000)});
      if (response.status === 503 && performance.now() < deadline) { await wait(200); continue; }
      assert.ok(response.ok, `${relative} returned HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      const transport = error instanceof TypeError || ['TimeoutError', 'AbortError'].includes(error.name);
      if (!transport || performance.now() >= deadline) throw error;
      await wait(200);
    }
  }
}

function storyURL(aspect) {
  const target = url('iframe.html');
  target.searchParams.set('id', ID); target.searchParams.set('viewMode', 'story');
  target.searchParams.set('globals', `aspect:${ASPECT_KEYS[aspect]}`);
  return target.href;
}

function managerURL(aspect, id = ID) {
  const target = url(''); target.searchParams.set('path', `/story/${id}`);
  target.searchParams.set('globals', `aspect:${ASPECT_KEYS[aspect]}`); return target.href;
}

async function ready(page) {
  await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('pk-component-story')?.dataset.state));
  const host = await page.$eval('pk-component-story', node => ({state: node.dataset.state, error: node.querySelector('[role=alert]')?.textContent}));
  assert.equal(host.state, 'ready', host.error ?? 'Sequence host did not become ready');
  await page.waitForFunction(() => {
    const player = document.querySelector('hyperframes-player'), win = player?.iframeElement?.contentWindow;
    return player?.ready && player.assetsReady && player.painted && win?.__pkFilm?.scenes?.length === 4
      && win.__timelines?.main && win.__renderReady === true;
  });
  return page.evaluate(async () => {
    const player = document.querySelector('hyperframes-player'), win = player.iframeElement.contentWindow;
    const film = win.__pkFilm; await film.ready;
    return {paused: player.paused, time: film.time, duration: player.duration,
      dimensions: [player.compositionWidth, player.compositionHeight],
      planDimensions: [film.plan.width, film.plan.height], font: film.plan.brand.font,
      look: film.plan.look.id, tokens: film.plan.brand.tokens,
      nativeRuntime: Boolean(win.__player), audit: typeof film.audit === 'function', dispose: typeof film.dispose === 'function',
      timelineIds: Object.keys(win.__timelines), sceneIds: film.sceneIds,
      scenes: film.scenes.map(scene => {
        const host = scene.sceneRoot.closest('[data-composition-src],[data-composition-file]');
        return {id: scene.id, type: scene.ps.scene.type, start: scene.ps.start, duration: scene.ps.dur,
          transition: scene.ps.transition, transitionDuration: scene.ps.trDur, nativeHost: host?.dataset.compositionId,
          dimensions: [Number(host?.dataset.width), Number(host?.dataset.height)]};
      }), errors: [...(win.__pkErrors ?? []), ...(win.__hfPreviewErrors ?? []), ...film.errors]};
  });
}

async function openPage(browser, aspect, manager = false) {
  const page = await browser.newPage(), errors = [], requests = [];
  let closing = false;
  page.setDefaultTimeout(40000);
  await page.setViewport({width: 1440, height: manager ? 900 : 1100, deviceScaleFactor: 1});
  await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) requests.push({url: response.url(), status: response.status()}); });
  page.on('requestfailed', request => {
    if (!closing && request.failure()?.errorText !== 'net::ERR_ABORTED') requests.push({url: request.url(), error: request.failure()?.errorText});
  });
  const session = {page, errors, requests, close: async () => { closing = true; await page.close(); }};
  await page.goto(manager ? managerURL(aspect) : storyURL(aspect), {waitUntil: 'domcontentloaded'});
  return session;
}

async function seek(page, time) {
  const at = Math.floor(time*30+1e-7)/30;
  await page.evaluate(at => { const player = document.querySelector('hyperframes-player'); player.pause(); player.seek(at); }, at);
  await page.waitForFunction(at => Math.abs((document.querySelector('hyperframes-player')?.iframeElement?.contentWindow.__pkFilm?.time ?? -1)-at) < .00002, {}, at);
  await page.evaluate(async () => {
    const win = document.querySelector('hyperframes-player').iframeElement.contentWindow;
    await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
  });
  return at;
}

async function snapshot(page, time) {
  const at = await seek(page, time);
  const state = await page.evaluate(() => {
    const player = document.querySelector('hyperframes-player'), win = player.iframeElement.contentWindow;
    const film = win.__pkFilm, root = win.document.getElementById('root');
    const displayed = node => {
      for (let parent = node; parent; parent = parent.parentElement) if (win.getComputedStyle(parent).display === 'none') return false;
      return true;
    };
    const encode = node => {
      if (node.nodeType === Node.TEXT_NODE) return ['text', node.textContent];
      if (node.nodeType !== Node.ELEMENT_NODE || win.getComputedStyle(node).display === 'none') return null;
      // Only display:none removes its subtree from the painted state. Keep
      // visibility:hidden geometry, every style value and every other attribute.
      // Native visibility toggles may remove/reinsert a class. Class order,
      // like attribute/style order, does not change the rendered picture.
      const attrs = [...node.attributes].map(attr => [attr.name, attr.name === 'style'
        ? [...node.style].sort().map(key => [key, node.style.getPropertyValue(key), node.style.getPropertyPriority(key)])
        : attr.name === 'class' ? [...node.classList].sort() : attr.value]).sort(([a], [b]) => a.localeCompare(b));
      return [node.tagName, attrs, [...node.childNodes].map(encode).filter(Boolean)];
    };
    const visible = film.scenes.filter(scene => {
      const node = scene.sceneRoot, rect = node.getBoundingClientRect();
      let opacity = 1;
      for (let parent = node; parent; parent = parent.parentElement) {
        const style = win.getComputedStyle(parent); opacity *= Number(style.opacity);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
      }
      return opacity > .01 && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0
        && rect.left < film.plan.width && rect.top < film.plan.height;
    }).map(scene => scene.id);
    return {time: film.time, paused: player.paused, html: JSON.stringify(encode(root)), visible,
      canvases: [...root.querySelectorAll('canvas')].filter(displayed).map(canvas => ({width: canvas.width, height: canvas.height, pixels: canvas.toDataURL()})),
      errors: [...(win.__pkErrors ?? []), ...(win.__hfPreviewErrors ?? []), ...film.audit().errors]};
  });
  assert.ok(state.paused, 'Native player must stay paused while seeking');
  assert.deepEqual(state.errors, [], 'Sequence runtime reported an error');
  const player = await page.$('hyperframes-player');
  return {time: at, dom: state.html, domHash: hash(state.html), pixelHash: hash(await player.screenshot()), visible: state.visible,
    canvases: state.canvases.map(({pixels, ...rest}) => ({...rest, sha256: hash(pixels)}))};
}

async function capture(page, name) {
  const player = await page.$('hyperframes-player'); assert.ok(player);
  await player.screenshot({path: path.join(OUT, name)}); return name;
}

function checkSession(session) {
  assert.deepEqual(session.requests, [], 'A sequence asset failed to load');
  assert.deepEqual(session.errors, [], 'A browser error occurred');
}

async function diagnostics(session, name, error) {
  const detail = {error: String(error.stack ?? error), errors: session?.errors, requests: session?.requests};
  if (session) {
    try { detail.state = await session.page.evaluate(() => {
      const host = document.querySelector('pk-component-story'), player = host?.querySelector('hyperframes-player');
      const win = player?.iframeElement?.contentWindow;
      return {host: host?.dataset.state, alert: host?.querySelector('[role=alert]')?.textContent,
        player: player && {ready: player.ready, assetsReady: player.assetsReady, painted: player.painted, paused: player.paused, time: player.currentTime},
        film: win?.__pkFilm?.audit?.(), timelines: Object.keys(win?.__timelines ?? {}), errors: [...(win?.__pkErrors ?? []), ...(win?.__hfPreviewErrors ?? [])]};
    }); } catch (failure) { detail.captureError = String(failure); }
    try { await session.page.screenshot({path: path.join(OUT, `${name}.png`), fullPage: true}); }
    catch (failure) { detail.screenshotError = String(failure); }
  }
  const filename = `${name}.json`; fs.writeFileSync(path.join(OUT, filename), JSON.stringify(detail, null, 2)+'\n'); return filename;
}

async function runAspect(browser, aspect) {
  const row = {aspect, passed: false}, suffix = aspect.replace(':', '-'); let session;
  try {
    session = await openPage(browser, aspect); const {page} = session;
    row.runtime = await ready(page);
    assert.ok(row.runtime.paused, 'Reduced-motion startup must not autoplay');
    assert.ok(row.runtime.nativeRuntime && row.runtime.audit && row.runtime.dispose);
    assert.deepEqual(row.runtime.dimensions, DIMENSIONS[aspect]);
    assert.deepEqual(row.runtime.planDimensions, DIMENSIONS[aspect]);
    assert.deepEqual(row.runtime.scenes.map(scene => scene.type), TYPES);
    assert.equal(row.runtime.font, 'Geist'); assert.equal(row.runtime.look, 'editorial');
    assert.deepEqual(row.runtime.tokens, readSequenceExample().film.brand.tokens);
    assert.equal(new Set(row.runtime.scenes.map(scene => scene.nativeHost)).size, 4, 'Each scene requires its own native host');
    for (const scene of row.runtime.scenes) {
      assert.equal(scene.nativeHost, scene.id); assert.deepEqual(scene.dimensions, DIMENSIONS[aspect]);
      assert.ok(row.runtime.timelineIds.includes(scene.id), `Missing native child timeline ${scene.id}`);
    }
    assert.ok(row.runtime.timelineIds.includes('main')); assert.deepEqual(row.runtime.errors, []);
    await page.$eval('hyperframes-player', player => player.removeAttribute('controls'));
    const forward = [], transitions = row.runtime.scenes.slice(1);
    assert.ok(transitions.every(scene => scene.transitionDuration > 0), 'All three authored handoffs must have a transition');
    for (const [index, scene] of transitions.entries()) {
      const states = [];
      for (const offset of [-.3, 0, .3]) states.push(await snapshot(page, scene.start+offset*scene.transitionDuration));
      const midpoint = states[1];
      assert.deepEqual(midpoint.visible, row.runtime.sceneIds.slice(index, index+2), 'Both adjacent native scenes must be visible at the transition midpoint');
      assert.equal(new Set(states.map(state => state.domHash)).size, 3, 'Seeking across the transition must change its rendered DOM');
      await seek(page, midpoint.time);
      row.screenshots ??= []; row.screenshots.push(await capture(page, `transition-${index+1}-${suffix}.png`));
      forward.push(...states);
    }
    await seek(page, row.runtime.duration-.1);
    row.reverse = [];
    for (const before of [...forward].reverse()) {
      const after = await snapshot(page, before.time);
      if (after.domHash !== before.domHash) {
        row.domDifference = `dom-difference-${suffix}.json`;
        fs.writeFileSync(path.join(OUT, row.domDifference), JSON.stringify({time: before.time,
          before: {...before, dom: JSON.parse(before.dom)}, after: {...after, dom: JSON.parse(after.dom)}}, null, 2)+'\n');
      }
      assert.equal(after.domHash, before.domHash, `Reverse seek changed visible DOM at ${before.time}s`);
      assert.deepEqual(after.canvases, before.canvases, `Reverse seek changed canvas pixels at ${before.time}s`);
      // Record exact screenshots, as in the component matrix. Chromium may
      // vary antialiasing by 1/255; canonical DOM and canvas pixels are the gate.
      row.reverse.push({time: before.time, domHash: after.domHash, firstPixelHash: before.pixelHash, pixelHash: after.pixelHash, pixelIdentical: before.pixelHash === after.pixelHash});
    }
    const buttons = await page.$$eval('.pk-sequence-nav button[data-scene-index]', nodes => nodes.map(node => Number(node.dataset.sceneIndex)));
    assert.deepEqual(buttons, [0, 1, 2, 3]); row.jumps = [];
    for (const [index, scene] of row.runtime.scenes.entries()) {
      await page.click(`.pk-sequence-nav button[data-scene-index="${index}"]`);
      const expected = scene.start+Math.min(.6*scene.duration, scene.duration-.05);
      await page.waitForFunction(at => Math.abs((document.querySelector('hyperframes-player')?.iframeElement?.contentWindow.__pkFilm?.time ?? -1)-at) <= 1/30+.00002, {}, expected);
      const actual = await page.evaluate(() => {const player = document.querySelector('hyperframes-player'); return {time: player.iframeElement.contentWindow.__pkFilm.time, paused: player.paused};});
      assert.ok(actual.paused, 'Scene jump must pause native playback'); row.jumps.push({index, expected, ...actual});
    }
    row.screenshots.push(await capture(page, `sequence-${suffix}.png`));
    checkSession(session); row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); row.diagnostics = await diagnostics(session, `failure-${suffix}`, error); }
  finally { await session?.close(); report.cases.push(row); writeReport(); }
  console.log(`sequence ${aspect}: ${row.passed ? 'pass' : row.error}`);
}

async function integration(browser) {
  const row = {name: 'toolbar-playback-cleanup', passed: false}; let session;
  try {
    session = await openPage(browser, '16:9'); const {page} = session;
    await ready(page); row.switches = [];
    for (const aspect of ['9:16', '1:1', '16:9']) {
      await page.evaluate(key => {
        const player = document.querySelector('hyperframes-player'), win = player.iframeElement.contentWindow;
        window.__sequenceOld = {player, film: win.__pkFilm, scenes: [...win.__pkFilm.scenes], win};
        window.__STORYBOOK_ADDONS_CHANNEL__.emit(window.__STORYBOOK_MODULE_CORE_EVENTS__.UPDATE_GLOBALS, {globals: {aspect: key}});
      }, ASPECT_KEYS[aspect]);
      await page.waitForFunction(() => document.querySelector('hyperframes-player') !== window.__sequenceOld.player);
      const current = await ready(page); assert.deepEqual(current.dimensions, DIMENSIONS[aspect]);
      assert.ok(current.paused, 'Reduced-motion toolbar rebuild must stay paused');
      const old = await page.evaluate(() => {
        const {player, film, scenes, win} = window.__sequenceOld;
        return {connected: player.isConnected, paused: player.paused, disposed: film.disposed,
          stages: scenes.filter(scene => scene.root.parentNode).length, timelines: Object.keys(win.__timelines ?? {})};
      });
      assert.equal(old.connected, false); assert.equal(old.paused, true); assert.equal(old.disposed, true);
      assert.equal(old.stages, 0); assert.deepEqual(old.timelines, []);
      row.switches.push({aspect, dimensions: current.dimensions, cleanup: old});
    }
    const start = await seek(page, .5);
    await page.$eval('hyperframes-player', player => player.play());
    await page.waitForFunction(at => document.querySelector('hyperframes-player')?.iframeElement?.contentWindow.__pkFilm?.time > at+.15, {timeout: 5000}, start);
    row.playback = await page.evaluate(async () => {
      const player = document.querySelector('hyperframes-player'), win = player.iframeElement.contentWindow;
      const playing = !player.paused, advanced = win.__pkFilm.time, childTime = win.__pkFilm.scenes[0].time;
      player.pause(); await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
      return {playing, advanced, childTime, paused: player.paused, stoppedAt: win.__pkFilm.time};
    });
    assert.ok(row.playback.playing && row.playback.paused); assert.ok(row.playback.childTime > start+.1);
    await wait(300);
    const stopped = await page.evaluate(() => document.querySelector('hyperframes-player').iframeElement.contentWindow.__pkFilm.time);
    assert.ok(Math.abs(stopped-row.playback.stoppedAt) < .00002, 'Public pause did not stop the film clock');
    checkSession(session); row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); row.diagnostics = await diagnostics(session, 'failure-integration', error); }
  finally { await session?.close(); report.checks.push(row); writeReport(); }
  console.log(`sequence toolbar/playback/cleanup: ${row.passed ? 'pass' : row.error}`);
}

async function managerNavigation(browser, regularStoryId) {
  const row = {name: 'manager-navigation-layout', formats: [], passed: false}; let session;
  try {
    session = await openPage(browser, '16:9', true); const {page} = session;
    for (const [index, aspect] of Object.keys(DIMENSIONS).entries()) {
      // Portrait also exercises the narrower two-column navigation layout.
      await page.setViewport({width: aspect === '9:16' ? 1100 : 1440, height: 900, deviceScaleFactor: 1});
      if (index) await page.goto(managerURL(aspect), {waitUntil: 'domcontentloaded'});
      const iframe = await page.waitForSelector('#storybook-preview-iframe');
      const frame = await iframe.contentFrame(); assert.ok(frame, 'Manager preview iframe is absent');
      const runtime = await ready(frame); assert.deepEqual(runtime.dimensions, DIMENSIONS[aspect]);
      const iframeBox = await iframe.boundingBox(); assert.ok(iframeBox);
      const navigation = await frame.$eval('.pk-sequence-nav', nav => {
        const box = nav.getBoundingClientRect();
        return {left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height,
          buttons: nav.querySelectorAll('button[data-scene-index]').length, scrollY: window.scrollY,
          viewport: {width: window.innerWidth, height: window.innerHeight}};
      });
      assert.equal(navigation.buttons, 4); assert.equal(navigation.scrollY, 0);
      assert.ok(navigation.width > 0 && navigation.height > 0, 'Scene navigation must be visible');
      assert.ok(navigation.top >= 0 && navigation.bottom <= iframeBox.height+1,
        `Scene navigation is below the visible manager iframe: ${JSON.stringify({iframeBox, navigation})}`);
      assert.ok(navigation.left >= 0 && navigation.right <= iframeBox.width+1, 'Scene navigation overflows the manager iframe horizontally');
      const visiblePanels = await page.evaluate(() => [...document.querySelectorAll('[id^="tabbutton-"], [role="tab"], #storybook-panel-root, [role="tabpanel"]')]
        .filter(node => {
          const box = node.getBoundingClientRect();
          if (!box.width || !box.height) return false;
          for (let parent = node; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
          }
          return true;
        }).map(node => ({id: node.id, role: node.getAttribute('role'), text: node.textContent.slice(0,100)})));
      assert.deepEqual(visiblePanels, [], 'Sequence manager must not reserve space for an empty addon panel');
      row.formats.push({aspect, iframeBox, navigation, visiblePanels});
      if (aspect === '16:9') {
        row.screenshot = 'manager-wide.png'; await page.screenshot({path: path.join(OUT, row.screenshot)});
      }
    }
    await page.goto(managerURL('16:9', regularStoryId), {waitUntil: 'domcontentloaded'});
    await page.waitForSelector(CONTROLS_TAB, {visible: true});
    row.regularControls = await page.$eval(CONTROLS_TAB, node => {
      const box = node.getBoundingClientRect(); return {id: node.id, width: box.width, height: box.height, label: node.textContent};
    });
    assert.ok(row.regularControls.width > 0 && row.regularControls.height > 0, 'Regular component controls must remain available');
    checkSession(session); row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); row.diagnostics = await diagnostics(session, 'failure-manager', error); }
  finally { await session?.close(); report.checks.push(row); writeReport(); }
  console.log(`sequence manager navigation: ${row.passed ? 'pass' : row.error}`);
}

let browser;
try {
  const index = await fetchJSON('index.json'), story = index.entries[ID];
  assert.equal(story?.title, 'Pure Kinetic/Sequences/idea-to-action'); assert.equal(story.exportName, 'Sequence');
  report.build = await fetchJSON('pk/catalog-build.json');
  assert.equal(report.build.schema, 'pure-kinetic.storybook.v1'); assert.equal(report.build.runtime, '0.9.19');
  assert.ok(report.build.sequences.includes('idea-to-action'));
  assert.equal(hash(JSON.stringify(report.build.evidence)), report.build.digest, 'Build manifest digest is invalid');
  browser = await puppeteer.launch({executablePath, headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage']});
  for (const aspect of Object.keys(DIMENSIONS)) await runAspect(browser, aspect);
  await integration(browser);
  const regularStory = Object.values(index.entries).find(entry => entry.title.endsWith('/typewriter') && entry.exportName === 'Preview');
  assert.ok(regularStory, 'Regular typewriter story is absent');
  await managerNavigation(browser, regularStory.id);
  report.passed = report.cases.length === 3 && report.cases.every(row => row.passed) && report.checks.length === 2 && report.checks.every(row => row.passed);
} catch (error) { report.error = String(error.stack ?? error); console.error(report.error); }
finally { await browser?.close(); report.completedAt = new Date().toISOString(); writeReport(); }
console.log(`${report.cases.filter(row => row.passed).length}/3 formats; ${report.checks.filter(row => row.passed).length}/2 integration checks passed. ${path.join(OUT, 'report.json')}`);
process.exitCode = report.passed ? 0 : 1;
