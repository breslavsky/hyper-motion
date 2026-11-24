// Native HyperFrames acceptance for the Thinking Orbs port. No browser-test
// dependency is installed: use the same pinned capture path as video export.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../../..');
const PACKAGE = path.join(REPO, 'templates/pure-kinetic/node_modules/hyperframes');
const VERSION = JSON.parse(fs.readFileSync(path.join(PACKAGE, 'package.json'), 'utf8')).version;
if (VERSION !== '0.9.19') throw new Error(`Expected HyperFrames 0.9.19, found ${VERSION}`);
const sharp = createRequire(path.join(fs.realpathSync(PACKAGE), 'package.json'))('sharp');
const dist = path.join(PACKAGE, 'dist');
const load = prefix => {
  const filename = fs.readdirSync(dist).find(name => name.startsWith(`${prefix}-`) && name.endsWith('.js'));
  if (!filename) throw new Error(`Pinned HyperFrames chunk not found: ${prefix}`);
  return import(path.join(dist, filename));
};
const { bundleWithLocalizedFonts } = await load('bundleWithLocalizedFonts');
const { serveStaticProjectHtml } = await load('staticProjectServer');
const { openSettledCompositionPage, seekCompositionTimeline } = await load('captureCompositionFrame');
const STATES = ['working', 'searching', 'solving', 'listening', 'connecting', 'weaving', 'composing', 'breathing', 'shaping'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const decode = dataURL => sharp(Buffer.from(dataURL.split(',')[1], 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

function pixelDifference(a, b) {
  if (a.info.width !== b.info.width || a.info.height !== b.info.height || a.data.length !== b.data.length) {
    return { equal: false, dimensionMismatch: true };
  }
  let changedPixels = 0;
  let maxChannelDelta = 0;
  let nonemptyPixels = 0;
  for (let index = 0; index < a.data.length; index += 4) {
    let changed = false;
    if (a.data[index + 3] > 0) nonemptyPixels++;
    for (let channel = 0; channel < 4; channel++) {
      const delta = Math.abs(a.data[index + channel] - b.data[index + channel]);
      if (delta) changed = true;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
    }
    if (changed) changedPixels++;
  }
  return { equal: changedPixels === 0, changedPixels, maxChannelDelta, nonemptyPixels };
}

// This comparison bypasses our adapter. It uses the untouched upstream engine
// and its original state presets, paints a fresh Canvas, then reads both PNGs.
// PNG extraction avoids getImageData's repeated-read acceleration changes.
async function inspectAt(globalTime) {
  const mounts = Array.from(document.querySelectorAll('[data-orb-mount]'));
  return Promise.all(mounts.map(async (mount, index) => {
    const { MODE_FRAMES, resolvePreset, paintFrame } = await import(mount.dataset.orbEngine || new URL('./assets/orbs/vendor/engine.es.js', location.href).href);
    const instance = mount.orbInstance;
    if (!instance) throw new Error(`Orb mount ${index} has no orbInstance`);
    const { canvas, api } = instance;
    const options = api.options;
    const host = mount.closest('[data-composition-src], [data-composition-file]');
    let start = 0;
    for (let node = host; node; node = node.parentElement?.closest('[data-composition-src], [data-composition-file]')) {
      start += Number(node.dataset.start ?? 0);
    }
    const duration = Number(host?.dataset.duration ?? instance.config.duration);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Orb mount ${index} has no finite duration`);
    const expectedTime = Math.max(0, Math.min(duration, globalTime - start));
    const active = globalTime >= start && globalTime < start + duration;
    const hiddenAncestors = [];
    for (let node = canvas; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0) {
        hiddenAncestors.push({id: node.id, tag: node.tagName, display: style.display, visibility: style.visibility, opacity: style.opacity});
      }
    }
    const referenceTime = active ? expectedTime : instance.time;
    const preset = resolvePreset(options.state, options.presetSize);
    const geometry = MODE_FRAMES[preset.mode](options.presetSize, referenceTime * preset.speed * options.speed, preset.opts);
    const reference = document.createElement('canvas');
    reference.width = canvas.width;
    reference.height = canvas.height;
    const ctx = reference.getContext('2d');
    ctx.setTransform(canvas.width / options.presetSize, 0, 0, canvas.height / options.presetSize, 0, 0);
    let tint;
    if (options.color !== undefined) {
      const hex = options.color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (hex) {
        const digits = hex[1].length === 3 ? hex[1].replace(/./g, digit => digit + digit) : hex[1];
        const value = Number.parseInt(digits, 16);
        tint = { r: value >> 16 & 255, g: value >> 8 & 255, b: value & 255 };
      } else {
        const channels = options.color.match(/[\d.]+/g).map(Number);
        tint = { r: channels[0], g: channels[1], b: channels[2] };
      }
    }
    paintFrame(ctx, geometry, options.dark, tint);
    return {
      id: host?.dataset.compositionId ?? host?.id ?? mount.id ?? `orb-${index}`,
      index, state: options.state, options, time: instance.time, expectedTime, active, start, duration, hiddenAncestors,
      width: canvas.width, height: canvas.height,
      dotCount: geometry.dots.length, lineCount: geometry.lines.length,
      png: canvas.toDataURL('image/png'), referencePng: reference.toDataURL('image/png'),
    };
  }));
}

export async function verifyProject(projectDirectory, outputDirectory) {
  const project = path.resolve(projectDirectory);
  const output = path.resolve(outputDirectory);
  if (!fs.existsSync(path.join(project, 'index.html'))) throw new Error(`Missing index.html: ${project}`);
  const receiptPath = path.join(project, 'orbs-project.json');
  const receipt = fs.existsSync(receiptPath) ? JSON.parse(fs.readFileSync(receiptPath, 'utf8')) : null;
  fs.mkdirSync(output, { recursive: true });
  const result = {
    project, output, layout: receipt?.layout, hyperframes: VERSION, errors: [], consoleErrors: [], externalRequests: [],
    failedRequests: [], samples: [], screenshots: [], faults: [],
  };
  let browser, page, server;
  try {
    const html = await bundleWithLocalizedFonts(project);
    server = await serveStaticProjectHtml(project, html);
    const opened = await openSettledCompositionPage(html, server.url, {
      renderReadyTimeoutMs: 15000,
      browserGpuMode: 'hardware',
      beforeNavigate: async nextPage => {
        nextPage.on('pageerror', error => result.errors.push(error.message));
        nextPage.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
        nextPage.on('requestfailed', request => result.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
        await nextPage.setRequestInterception(true);
        nextPage.on('request', request => {
          const url = new URL(request.url());
          if (['http:', 'https:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
            result.externalRequests.push(request.url());
            void request.abort();
          } else void request.continue();
        });
      },
    });
    ({ browser, page } = opened);
    result.renderReady = !opened.renderReadyTimedOut;
    await page.waitForFunction(() => {
      const mounts = Array.from(document.querySelectorAll('[data-orb-mount]'));
      return mounts.length > 0 && mounts.every(mount => mount.orbInstance);
    }, { timeout: 15000 });
    result.duration = await page.evaluate(() => Number(
      document.querySelector('[data-composition-id="main"][data-duration]')?.dataset.duration
      ?? document.querySelector('[data-duration][data-width][data-height]')?.dataset.duration
    ));
    if (!Number.isFinite(result.duration) || result.duration <= 0) throw new Error('Composition duration is invalid');
    const times = [.2, .5, .8].map(fraction => result.duration * fraction);
    const samples = [];
    for (const [index, time] of times.entries()) {
      await seekCompositionTimeline(page, time, { exactTime: true });
      const sample = await page.evaluate(inspectAt, time);
      samples.push(sample);
      const records = [];
      for (const item of sample) {
        const { png, referencePng, ...record } = item;
        const actual = await decode(png);
        const reference = await decode(referencePng);
        record.pixelHash = hash(actual.data);
        record.reference = pixelDifference(actual, reference);
        records.push(record);
        if (!record.reference.equal) result.faults.push({ time, id: item.id, reason: 'upstream pixel parity', ...record.reference });
        if (!record.reference.nonemptyPixels) result.faults.push({ time, id: item.id, reason: 'empty canvas' });
        if (item.active && Math.abs(item.time - item.expectedTime) > .0001) result.faults.push({ time, id: item.id, reason: 'local timeline clock', actual: item.time, expected: item.expectedTime });
        if (item.active && item.hiddenAncestors.length) result.faults.push({ time, id: item.id, reason: 'active canvas hidden by scene timing', hiddenAncestors: item.hiddenAncestors });
      }
      result.samples.push({ time, instances: records });
      const screenshot = path.join(output, `frame-${index + 1}-${time.toFixed(3)}.png`);
      await page.screenshot({ path: screenshot });
      result.screenshots.push(screenshot);
    }
    const first = samples[1];
    await seekCompositionTimeline(page, result.duration - 1 / 30, { exactTime: true });
    await seekCompositionTimeline(page, .01, { exactTime: true });
    await seekCompositionTimeline(page, times[1], { exactTime: true });
    const repeated = await page.evaluate(inspectAt, times[1]);
    result.repeat = [];
    if (first.length !== repeated.length) result.faults.push({ reason: 'instance count changed after seeking' });
    for (const [index, before] of first.entries()) {
      const after = repeated[index];
      if (!after) continue;
      const a = await decode(before.png);
      const b = await decode(after.png);
      const difference = pixelDifference(a, b);
      const sameTime = Math.abs(before.time - after.time) <= .0001;
      const sameOptions = JSON.stringify(before.options) === JSON.stringify(after.options);
      result.repeat.push({ id: before.id, sameTime, sameOptions, ...difference });
      if (!difference.equal || !sameTime || !sameOptions) result.faults.push({ id: before.id, reason: 'backward seek changed canvas or instance', ...difference });
    }
    result.states = [...new Set(first.map(instance => instance.state))];
    result.instanceCount = first.length;
    if (receipt?.scenes) {
      if (first.length !== receipt.scenes.length) result.faults.push({ reason: 'expected mount count', actual: first.length, expected: receipt.scenes.length });
      for (const scene of receipt.scenes) {
        const instance = first.find(item => item.id === scene.id);
        if (!instance) {
          result.faults.push({ reason: 'expected mount missing', id: scene.id });
          continue;
        }
        for (const key of ['state', 'size', 'presetSize', 'pixelRatio', 'speed', 'dark']) {
          if (scene[key] !== undefined && instance.options[key] !== scene[key]) {
            result.faults.push({ reason: 'mount option isolation', id: scene.id, key, actual: instance.options[key], expected: scene[key] });
          }
        }
        if ((instance.options.color ?? '') !== (scene.color ?? '')) result.faults.push({ reason: 'mount color isolation', id: scene.id });
      }
    }
    // The showcase has one mount per state. Single-effect projects are also
    // accepted without pretending that they exercise the entire library.
    if (receipt?.layout === 'gallery' || first.length >= STATES.length) {
      for (const state of STATES) if (!result.states.includes(state)) result.faults.push({ reason: 'gallery state missing', state });
    }
    for (const instance of first) {
      const activeSamples = result.samples.flatMap(sample => sample.instances.filter(item => item.index === instance.index && item.active));
      if (instance.options.speed > 0 && activeSamples.length >= 2 && new Set(activeSamples.map(sample => sample.pixelHash)).size < 2) {
        result.faults.push({ id: instance.id, reason: 'canvas did not animate at different times' });
      }
    }
  } catch (error) {
    result.error = error.stack ?? String(error);
  } finally {
    await page?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await server?.close();
  }
  result.passed = !!result.renderReady && !result.error && !result.errors.length && !result.consoleErrors.length
    && !result.externalRequests.length && !result.failedRequests.length && !result.faults.length;
  fs.writeFileSync(path.join(output, 'verification.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [project, output] = process.argv.slice(2);
  if (!project || !output) throw new Error('Usage: node tools/verify.mjs <project-directory> <output-directory>');
  const result = await verifyProject(project, output);
  console.log(JSON.stringify({ passed: result.passed, instances: result.instanceCount, states: result.states,
    faults: result.faults, errors: result.errors, error: result.error, report: path.join(result.output, 'verification.json') }, null, 2));
  if (!result.passed) process.exitCode = 1;
}
