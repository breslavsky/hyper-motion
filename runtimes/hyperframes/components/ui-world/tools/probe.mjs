// Exercise the actual pinned HyperFrames bundler, timeline seeker and CLI.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {buildProject} from '../build.mjs';
import {stateAt, projectPoint} from '../model.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(HERE, '..');
const REPO = path.resolve(SOURCE, '../../../..');
const packageRoot = path.join(REPO, 'templates/pure-kinetic/node_modules/hyperframes');
const version = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'))).version;
if (version !== '0.9.19') throw new Error(`Expected HyperFrames 0.9.19, found ${version}`);
const dist = path.join(packageRoot, 'dist');
const load = prefix => import(path.join(dist, fs.readdirSync(dist).find(file => file.startsWith(`${prefix}-`) && file.endsWith('.js'))));
const {bundleWithLocalizedFonts} = await load('bundleWithLocalizedFonts');
const {serveStaticProjectHtml} = await load('staticProjectServer');
const {openSettledCompositionPage, seekCompositionTimeline} = await load('captureCompositionFrame');
const sharp = createRequire(path.join(fs.realpathSync(packageRoot), 'package.json'))('sharp');
const output = path.resolve(process.argv[2] ?? '/tmp/pk-ui-world-prototype/qa');
const selected = new RegExp(process.argv[3] ?? '.');
const runCli = !process.argv.includes('--no-cli');
fs.mkdirSync(output, {recursive: true});
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const sourceHashes = Object.fromEntries(['model.mjs', 'view.mjs', 'runtime.mjs', 'build.mjs', 'audio.mjs']
  .map(file => [file, hash(fs.readFileSync(path.join(SOURCE, file)))]));
const browserAudioCode = ['model.mjs', 'view.mjs', 'runtime.mjs'].filter(file =>
  /\bnew\s+(?:Audio|AudioContext|webkitAudioContext)\s*\(|\.\s*play\s*\(/.test(fs.readFileSync(path.join(SOURCE, file), 'utf8')));
const cases = ['9:16', '1:1', '16:9'].map(aspect => ({id: aspect.replace(':', 'x'), baseline: true, spec: {aspect}}));
cases.push({id: '16x9-alternate', baseline: false, spec: {aspect: '16:9', sliderLength: 340,
  labels: {switch: 'START MOTION', slider: 'MORE MOMENTUM'},
  style: {accent: '#FF8C42', control: '#273950', font: 'Archivo'}}});
for(const aspect of ['9:16','1:1','16:9'])cases.push({id:`${aspect.replace(':','x')}-timed`,baseline:false,timed:true,
  spec:{aspect,music:{bpm:120},timing:{slide:{startBeat:3,endBeat:15}}}});

function inspect() {
  const world = window.__uiWorld;
  if (!world) throw new Error('Missing window.__uiWorld audit hook');
  const camera = document.querySelector('[data-world-camera]');
  const actor = document.querySelector('[data-actor="ball"]');
  const sameActor = !window.__probeActor || actor === window.__probeActor;
  window.__probeActor = actor;
  return {state: world.state, audit: world.audit(), sameActor,
    cameraCount: document.querySelectorAll('[data-world-camera]').length,
    widgetTransforms: [...document.querySelectorAll('[data-widget]')].map(node => node.getAttribute('transform')),
    actorUnderCamera: actor?.parentElement === camera,
    valueText: document.querySelector('[data-label="value"]')?.textContent,
    ticks: [...document.querySelectorAll('[data-tick]')].map(node => ({index: Number(node.getAttribute('data-tick')), stroke: node.getAttribute('stroke')})),
    sliderFill: Object.fromEntries(['x2', 'y2'].map(key => [key, Number(document.querySelector('[data-slider-fill]')?.getAttribute(key))])),
    font: getComputedStyle(document.querySelector('[data-label="switch"]')).fontFamily,
    audio: [...document.querySelectorAll('audio')].map(node => ({id: node.id, eventId: node.getAttribute('data-ui-event'), src: node.getAttribute('src'), start: node.getAttribute('data-start'), duration: node.getAttribute('data-duration')})),
    browserAudioCalls: window.__probeAudioCalls ?? [],
    forbiddenGlobals: ['PurePlan', 'PureDom', 'PureScenes'].filter(key => window[key]),
    timelines: Object.fromEntries(Object.entries(window.__timelines ?? {}).map(([key, timeline]) => [key, {time: timeline.time(), duration: timeline.duration()}])),
  };
}

function examine(plan, time, snapshot) {
  const faults = [], expected = stateAt(plan, time), {audit, state} = snapshot;
  const close = (actual, target, label, tolerance = .01) => {
    if (!Number.isFinite(actual) || Math.abs(actual - target) > tolerance) faults.push(`${label}: expected ${target}, received ${actual}`);
  };
  close(state.time, time, 'local time', 1e-5);
  for (const key of ['x', 'y', 'zoom']) close(state.camera[key], expected.camera[key], `camera.${key}`);
  for (const key of ['x', 'y', 'scaleX', 'scaleY']) close(state.actor[key], expected.actor[key], `actor.${key}`);
  close(state.sliderValue, expected.sliderValue, 'slider value');
  if (state.actor.owner !== expected.actor.owner || audit.actor.owner !== expected.actor.owner) faults.push('actor ownership differs from the compiled recipe');
  if (!snapshot.sameActor || !snapshot.actorUnderCamera || snapshot.cameraCount !== 1 || audit.stats.ballCount !== 1 || audit.stats.svgCount !== 1) faults.push('world/camera/actor identity is not singular');
  if (snapshot.widgetTransforms.some(Boolean)) faults.push('a widget has an independent camera transform');
  if (audit.stats.tickCount !== plan.layout.slider.tickCount) faults.push('slider marks differ from the planned scale');
  for (const tick of snapshot.ticks) {
    // GSAP quantizes its assigned clock to six decimals. Compare the view to
    // that actual state; the independent model check above bounds time drift.
    const active = state.sliderValue > 0 && tick.index / (plan.layout.slider.tickCount - 1) <= state.sliderValue / 100 + 1e-8;
    if (tick.stroke !== (active ? plan.style.accent : plan.style.control)) faults.push(`tick ${tick.index}: fill differs from the current value`);
  }
  if (snapshot.forbiddenGlobals.length) faults.push('Pure Kinetic engine globals loaded');
  const center = projectPoint(plan, expected.camera, expected.actor);
  close(audit.actor.centerX, center.x, 'projected actor x');
  close(audit.actor.centerY, center.y, 'projected actor y');
  const safe = {left: plan.width * plan.safe.left, top: plan.height * plan.safe.top,
    right: plan.width * (1 - plan.safe.right), bottom: plan.height * (1 - plan.safe.bottom)};
  const contains = box => box.x >= safe.left - 1 && box.y >= safe.top - 1 && box.x + box.width <= safe.right + 1 && box.y + box.height <= safe.bottom + 1;
  if (!contains(audit.actor)) faults.push('actor outside safe area');
  const minFont = 36 * Math.min(plan.width, plan.height) / 1080 * (plan.height / plan.width > 1.2 ? 1.1 : 1);
  for (const text of audit.texts.filter(text => text.active && text.visible && text.opacity > .1)) {
    if (text.fontSize < minFont - .2) faults.push(`${text.field}: ${text.fontSize}px below ${minFont}px`);
    if (!contains(text)) faults.push(`${text.field}: active text outside safe area`);
  }
  if (snapshot.valueText !== String(Math.round(expected.sliderValue))) faults.push('displayed slider value differs from the model');
  if (expected.actor.owner === 'slider') {
    close(snapshot.sliderFill.x2, expected.actor.x, 'fill attached to actor x');
    close(snapshot.sliderFill.y2, expected.actor.y, 'fill attached to actor y');
  }
  for (const [key, field] of [['switch-label', 'switch'], ['slider-label', 'slider']]) {
    if (audit.texts.find(text => text.key === key)?.text !== plan.labels[field]) faults.push(`${field} label did not reach the view`);
  }
  if (!snapshot.font.includes(plan.style.font)) faults.push('style font did not reach the view');
  // HyperFrames initializes its own AudioContext. The component must emit
  // timed audio elements, and must never create/play browser audio itself.
  if (snapshot.browserAudioCalls.some(call => call.kind === 'media.play' || call.stack?.includes('/assets/ui-world/'))) faults.push('component JavaScript started audio playback');
  return faults;
}

let browser;
const results = [];
for (const job of cases.filter(job => selected.test(job.id))) {
  const receipt = {id: job.id, aspect: job.spec.aspect, baseline: job.baseline, timed:job.timed??false, hyperframes: version,
    sourceHashes, samples: [], repeat: [], errors: [], externalRequests: [], faults: []};
  let page, server;
  try {
    const project = path.join(output, 'projects', job.id);
    if (fs.existsSync(path.join(project, '.probe-owned'))) fs.rmSync(project, {recursive: true});
    const built = await buildProject(project, job.spec);
    fs.writeFileSync(path.join(project, '.probe-owned'), 'Generated by ui-world/tools/probe.mjs\n');
    Object.assign(receipt, {project, width: built.width, height: built.height, duration: built.duration, events: built.plan.events});
    const html = await bundleWithLocalizedFonts(project);
    server = await serveStaticProjectHtml(project, html);
    const opened = await openSettledCompositionPage(html, server.url, {renderReadyTimeoutMs: 15000, browserGpuMode: 'hardware',
      prelaunched: browser ? {take: async () => ({browser, softwareWebGpu: false})} : undefined,
      beforeNavigate: async tab => {
        tab.on('pageerror', error => receipt.errors.push(error.message));
        await tab.setRequestInterception(true);
        tab.on('request', request => {
          const url = new URL(request.url());
          if (['http:', 'https:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
            receipt.externalRequests.push(request.url()); request.abort();
          } else request.continue();
        });
        await tab.evaluateOnNewDocument(() => {
          window.__probeAudioCalls = [];
          const play = HTMLMediaElement.prototype.play;
          HTMLMediaElement.prototype.play = function (...args) {
            window.__probeAudioCalls.push({kind: 'media.play', stack: new Error().stack});
            return play.apply(this, args);
          };
          for (const key of ['AudioContext', 'webkitAudioContext']) {
            const Original = window[key];
            if (Original) window[key] = new Proxy(Original, {construct(Target, args) {
              window.__probeAudioCalls.push({kind: key, stack: new Error().stack});
              return Reflect.construct(Target, args);
            }});
          }
        });
      }});
    browser = opened.browser; page = opened.page;
    await page.waitForFunction(() => window.__uiWorld || window.__mfErrors?.length, {timeout: 15000});
    const startupErrors = await page.evaluate(() => window.__mfErrors ?? []);
    if (startupErrors.length) throw new Error(startupErrors.join('; '));
    receipt.renderReady = !opened.renderReadyTimedOut;
    const times = [...new Set([0, .5, .78, .999, 1, 1.2, 1.499, 1.5, 1.65, 2, 3, 4.5, 5, 5.9, built.duration-.1, ...built.plan.events.map(event => event.time)])].sort((a, b) => a - b);
    for (const time of times) {
      const start = performance.now();
      await seekCompositionTimeline(page, time, {exactTime: true});
      const snapshot = await page.evaluate(inspect);
      receipt.samples.push({time, seekMs: performance.now() - start, ...snapshot});
      receipt.faults.push(...examine(built.plan, time, snapshot).map(reason => ({time, reason})));
    }
    for (const time of [1.25, (built.plan.actions.slide.at+built.plan.events.at(-1).time)/2, built.duration-.1]) {
      await seekCompositionTimeline(page, time, {exactTime: true});
      const firstState = await page.evaluate(inspect), first = await page.screenshot();
      await seekCompositionTimeline(page, built.duration-.01, {exactTime: true});
      await seekCompositionTimeline(page, 0, {exactTime: true});
      await seekCompositionTimeline(page, time, {exactTime: true});
      const secondState = await page.evaluate(inspect), second = await page.screenshot();
      const a = await sharp(first).removeAlpha().raw().toBuffer(), b = await sharp(second).removeAlpha().raw().toBuffer();
      let maxChannelDelta = 0, changedPixels = 0;
      for (let i = 0; i < a.length; i += 3) {
        let changed = false;
        for (let channel = 0; channel < 3; channel++) {
          const delta = Math.abs(a[i + channel] - b[i + channel]);
          maxChannelDelta = Math.max(maxChannelDelta, delta); changed ||= delta > 0;
        }
        if (changed) changedPixels++;
      }
      const stateEqual = JSON.stringify(firstState) === JSON.stringify(secondState);
      // Permit only one 8-bit antialias quantization level with identical state.
      const repeat = {time, stateEqual, pixelExact: hash(first) === hash(second), maxChannelDelta, changedPixels, passed: stateEqual && maxChannelDelta <= 1};
      receipt.repeat.push(repeat);
      if (!repeat.passed) receipt.faults.push({time, reason: 'repeat seek differs'});
      fs.writeFileSync(path.join(output, `${job.id}-${time}.png`), first);
      if (!repeat.pixelExact) fs.writeFileSync(path.join(output, `${job.id}-${time}-repeat.png`), second);
    }
    for (const time of [.5, 1, 1.5, 4.5]) {
      await seekCompositionTimeline(page, time, {exactTime: true});
      await page.screenshot({path: path.join(output, `${job.id}-${time}.png`)});
    }
    const audio = receipt.samples.at(-1).audio;
    if (!audio.length || audio.some(clip => !clip.id || !clip.src || !Number.isFinite(Number(clip.start)) || !(Number(clip.duration) > 0))) receipt.faults.push({reason: 'missing native audio clips or timing'});
    if (new Set(audio.map(clip => clip.id)).size !== audio.length) receipt.faults.push({reason: 'duplicate audio ids'});
    if (JSON.stringify(audio.map(clip => clip.eventId)) !== JSON.stringify(built.plan.events.map(event => event.id))) receipt.faults.push({reason: 'semantic events do not map to native audio clips'});
  } catch (error) {
    receipt.error = error.stack ?? String(error);
  } finally {
    await page?.close().catch(() => {}); await server?.close();
  }
  receipt.passed = !receipt.error && receipt.renderReady && !receipt.errors.length && !receipt.externalRequests.length && !receipt.faults.length;
  results.push(receipt);
  fs.writeFileSync(path.join(output, `${job.id}.json`), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({id: job.id, passed: receipt.passed, error: receipt.error, faults: receipt.faults.slice(0, 6)}));
}
await browser?.close();
const baselineEvents = results.find(result => result.baseline)?.events;
const sameEvents = results.filter(result=>!result.timed).every(result => JSON.stringify(result.events) === JSON.stringify(baselineEvents));
const cliResults = [];
if (runCli) {
  const cli = path.join(REPO, 'templates/pure-kinetic/node_modules/.bin/hyperframes');
  async function run(args, project) {
    let stdout = '', stderr = '', timeout = false;
    const started = performance.now(), child = spawn(cli, args, {cwd: project, stdio: ['ignore', 'pipe', 'pipe']});
    child.stdout.on('data', data => stdout += data); child.stderr.on('data', data => stderr += data);
    let hardKill;
    const timer = setTimeout(() => {timeout = true; child.kill('SIGTERM'); hardKill = setTimeout(() => child.kill('SIGKILL'), 5000);}, 180000);
    let exitCode;
    try {exitCode = await new Promise((resolve, reject) => {child.on('error', reject); child.on('close', resolve);});}
    finally {clearTimeout(timer); clearTimeout(hardKill);}
    let json; try {json = JSON.parse(stdout);} catch {json = null;}
    return {args, exitCode, timeout, seconds: (performance.now() - started) / 1000, json, stdout, stderr};
  }
  for (const result of results.filter(result => result.baseline && result.project)) {
    const lint = await run(['lint', '--json', result.project], result.project);
    const check = await run(['check', '--json', '--samples', '13', '--budget', '90s', result.project], result.project);
    const item = {id: result.id, lint, check, passed: lint.exitCode === 0 && lint.json?.ok === true && check.exitCode === 0 && check.json?.ok === true};
    cliResults.push(item);
    fs.writeFileSync(path.join(output, 'cli-results.json'), JSON.stringify(cliResults, null, 2));
    console.log(JSON.stringify({cli: item.id, passed: item.passed, lint: lint.json?.ok, check: check.json?.ok}));
  }
}
const summary = {hyperframes: version, sourceHashes, browserAudioCode, sameEvents, native: results.map(({id, passed, faults, error}) => ({id, passed, faults, error})),
  cli: cliResults.map(({id, passed}) => ({id, passed})), passed: results.length > 0 && !browserAudioCode.length && sameEvents && results.every(result => result.passed) && cliResults.every(result => result.passed)};
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
if (!summary.passed) process.exitCode = 1;
