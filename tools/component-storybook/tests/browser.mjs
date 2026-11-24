// End-to-end acceptance of the real Storybook shell and pinned HyperFrames Player.
// npm run test:browser -- --all checks every canonical component in all formats.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {readCatalog, readThemePreviews} from '../src/catalog-data.mjs';
import {BRANDBOOKS, DEFAULT_BRANDBOOK, FORMATS, MATERIALS} from '../src/model.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';
const ALL = process.argv.includes('--all');
const METAL = process.argv.includes('--metal');
const GLASS = process.argv.includes('--glass');
assert.ok(!(GLASS && METAL), 'Choose either --glass or --metal');
// --only=type,type keeps a run to those components (with --all: their formats and named variants).
const ONLY = process.argv.find(arg => arg.startsWith('--only='))?.slice('--only='.length).split(',');
const METAL_CASE = process.argv.find(arg => arg.startsWith('--metal-case='))?.slice('--metal-case='.length);
const OUT = path.resolve(process.env.STORYBOOK_TEST_RESULTS ?? path.join(HERE, 'test-results', METAL_CASE ? 'metal-case' : METAL ? 'metal' : GLASS ? 'glass' : ALL ? 'all' : 'quick'));
const DIMENSIONS = {'16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080]};
const ASPECT_KEYS = {'16:9': 'landscape', '9:16': 'portrait', '1:1': 'square'};
const catalogue = readCatalog();
const themes = readThemePreviews(catalogue);
const defaultBook = Object.keys(BRANDBOOKS)[0];
const selectedBrand = BRANDBOOKS[defaultBook].brand;
const selectedFont = typeof selectedBrand.font === 'object' ? selectedBrand.font.family : selectedBrand.font;
const glassTypes = themes.map(theme => theme.type);
const glassFamily = catalogue.filter(entry => entry.family === 'glass').map(entry => entry.type);
if (GLASS) assert.ok(glassTypes.length, 'Selected template does not contain 3D glass components');
if (METAL) assert.ok(themes.length, 'Selected template does not contain the material comparisons');
if (METAL_CASE) {
  assert.ok(METAL, '--metal-case requires --metal');
  assert.ok(themes.some(theme => theme.variants.some(variant => FORMATS.some(aspect => `${theme.type}/${aspect}/${variant.globals.material}` === METAL_CASE))), 'Unknown material case; use component/aspect/material');
}
const QUICK = ['drag', 'scan', 'typewriter', 'modal-morph', 'testimonial-proof-card', 'particles', 'phone3d', 'thinking-orb']
  .filter(type => catalogue.some(entry => entry.type === type));
const executablePath = process.env.CHROME_BIN ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(file => fs.existsSync(file));
assert.ok(executablePath, 'Chrome not found: set CHROME_BIN to its executable');
fs.mkdirSync(OUT, {recursive: true});
async function fetchIndex() {
  const url = new URL('index.json', BASE.endsWith('/') ? BASE : `${BASE}/`);
  const deadline = performance.now() + 10000;
  for (;;) {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(2000)});
      if (response.status !== 503 || performance.now() >= deadline) return response;
    } catch (error) {
      const transport = error instanceof TypeError || ['TimeoutError', 'AbortError'].includes(error.name);
      if (!transport || performance.now() >= deadline) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
const response = await fetchIndex();
assert.ok(response.ok, `Storybook index returned HTTP ${response.status}`);
const index = await response.json();
const storyEntries = Object.values(index.entries).filter(entry => entry.type === 'story' && /^(Glass|3D|Pure Kinetic)\//.test(entry.title));
const stories = new Map(Object.values(index.entries).filter(entry => entry.type === 'story'
  && /^(Glass|3D|Pure Kinetic)\//.test(entry.title) && entry.exportName === 'Preview')
  .map(entry => [entry.title.split('/').at(-1), entry]));
assert.deepEqual([...stories.keys()].sort(), catalogue.map(entry => entry.type).sort(), 'Storybook index must cover the canonical catalogue exactly');
const componentTitles = new Set([...stories.values()].map(entry => entry.title));
const variants = new Map(storyEntries.filter(entry => componentTitles.has(entry.title) && entry.exportName !== 'Preview')
  .map(entry => [`${entry.title.split('/').at(-1)}:${entry.exportName}`, entry]));
assert.deepEqual([...variants.keys()].sort(), catalogue.flatMap(entry => [...entry.variants, ...entry.examples].map(variant => `${entry.type}:${variant.exportName}`)).sort(), 'Named stories must match the catalogue variants and examples');
for (const entry of catalogue) for (const variant of [...entry.variants, ...entry.examples]) {
  assert.equal(variants.get(`${entry.type}:${variant.exportName}`).name, variant.name, 'CSF index must preserve the named variant label');
}
const themeStories = new Map(Object.values(index.entries).filter(entry => entry.type === 'story' && (entry.title === 'Glass/References' || themes.some(theme => theme.title === entry.title && theme.variants.some(variant => variant.exportName === entry.exportName))))
  .map(entry => [`${entry.title}:${entry.exportName}`, entry]));
const darkSpecimen = 'Glass/References:DarkButtonGlass';
const materialKeys = themes.flatMap(theme => theme.variants.map(variant => `${theme.title}:${variant.exportName}`));
if (MATERIALS.includes('dark-glass')) materialKeys.push(darkSpecimen);
assert.deepEqual([...themeStories.keys()].sort(), materialKeys.sort(), 'Material index must cover the native examples and reference specimens');
const buildResponse = await fetch(new URL('pk/catalog-build.json', BASE.endsWith('/') ? BASE : `${BASE}/`));
assert.ok(buildResponse.ok, `Storybook build manifest returned HTTP ${buildResponse.status}`);
const buildManifest = await buildResponse.json();
assert.equal(buildManifest.schema, 'pure-kinetic.storybook.v1');
assert.equal(buildManifest.runtime, '0.9.19');
assert.equal(buildManifest.components, catalogue.length);
assert.equal(createHash('sha256').update(JSON.stringify(buildManifest.evidence)).digest('hex'), buildManifest.digest, 'Build manifest digest is invalid');
const browser = await puppeteer.launch({executablePath, headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage']});
const report = {url: BASE, all: ALL, metalOnly: METAL, glassOnly: GLASS, metalCase: METAL_CASE, catalogCount: catalogue.length, build: buildManifest, startedAt: new Date().toISOString(), cases: [], checks: [], passed: false};
const failures = [];
let diagnosticSequence = 0;
const hash = value => createHash('sha256').update(value).digest('hex');

function storyURL(type, globals = {}, args = {}, variant) {
  const url = new URL('iframe.html', BASE.endsWith('/') ? BASE : `${BASE}/`);
  url.searchParams.set('id', variant?.id ?? (variant ? variants.get(`${type}:${variant.exportName}`) : stories.get(type)).id);
  url.searchParams.set('viewMode', 'story');
  const values = {aspect: '16:9', brandbook: defaultBook, material: 'glass', ...globals};
  values.aspect = ASPECT_KEYS[values.aspect] ?? values.aspect;
  url.searchParams.set('globals', Object.entries(values).map(([key, value]) => `${key}:${value}`).join(';'));
  if (Object.keys(args).length) url.searchParams.set('args', Object.entries(args).map(([key, value]) => `${key}:${value}`).join(';'));
  return url.href;
}

async function openPage(type, globals, args, variant) {
  const page = await browser.newPage(), errors = [], requests = [];
  const pending = new Map();
  let closing = false;
  page.setDefaultTimeout(40000);
  await page.setViewport({width: 1440, height: 1100, deviceScaleFactor: 1});
  await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', value => pending.set(value, {url: value.url(), resourceType: value.resourceType(), startedAt: performance.now()}));
  page.on('response', value => {
    const item = pending.get(value.request()); if (item) item.status = value.status();
    if (value.status() >= 400) requests.push({url: value.url(), status: value.status()});
  });
  page.on('requestfinished', value => pending.delete(value));
  page.on('requestfailed', value => {
    pending.delete(value);
    if (!closing && value.failure()?.errorText !== 'net::ERR_ABORTED') requests.push({url: value.url(), error: value.failure()?.errorText});
  });
  const diagnostics = async error => {
    const name = `failure-${++diagnosticSequence}-${type}`;
    const details = {url: page.url(), error: String(error.stack ?? error), errors, requests,
      pendingRequests: [...pending.values()].map(({startedAt, ...item}) => ({...item, elapsedMs: Math.round(performance.now() - startedAt)}))};
    try {
      details.page = await page.evaluate(() => {
        const host = document.querySelector('pk-component-story'), player = host?.querySelector('hyperframes-player');
        const win = player?.iframeElement?.contentWindow, doc = win?.document;
        return {hostState: host?.dataset.state, alert: host?.querySelector('[role=alert]')?.textContent,
          player: player ? {ready: player.ready, assetsReady: player.assetsReady, painted: player.painted,
            duration: player.duration, currentTime: player.currentTime, paused: player.paused, connected: player.isConnected} : null,
          frame: doc ? {path: win.location.pathname, readyState: doc.readyState, fonts: doc.fonts.status,
            root: {...doc.querySelector('#root')?.dataset}, gsap: Boolean(win.gsap), runtime: Boolean(win.__player),
            timeline: Boolean(win.__timelines?.main), component: Boolean(win.__storybookComponent), renderReady: win.__renderReady,
            buildReady: Object.keys(win.__hf?.buildReady ?? {}), errors: [...(win.__hfPreviewErrors ?? []), ...(win.__pkErrors ?? [])],
            scripts: [...doc.scripts].map(script => ({src: script.src, type: script.type}))} : null};
      });
    } catch (captureError) { details.captureError = String(captureError); }
    try { await page.screenshot({path: path.join(OUT, `${name}.png`), fullPage: true}); details.screenshot = `${name}.png`; }
    catch (captureError) { details.screenshotError = String(captureError); }
    const filename = `${name}.json`;
    fs.writeFileSync(path.join(OUT, filename), JSON.stringify(details, null, 2)+'\n');
    return filename;
  };
  try {
    await page.goto(storyURL(type, globals, args, variant), {waitUntil: 'domcontentloaded'});
    const initial = await ready(page);
    const chrome = await page.$$eval('.pk-heading, .pk-story details summary', nodes => nodes.map(node => node.innerText).join('\n'));
    assert.doesNotMatch(chrome, /\p{Script=Cyrillic}/u, 'Built-in preview controls must stay in English');
    const expected = {aspect: '16:9', brandbook: defaultBook, material: 'glass', ...globals};
    assert.equal(initial.aspect, expected.aspect, 'Reloadable Storybook URL did not preserve the selected format');
    if (expected.brandbook === DEFAULT_BRANDBOOK) {
      assert.equal(initial.brand.tokens, undefined);
      assert.equal(initial.brand.colors, undefined);
    } else {
      assert.deepEqual(initial.brand, BRANDBOOKS[expected.brandbook].brand, 'Reloadable Storybook URL did not preserve the complete brandbook');
    }
    assert.equal(initial.materialName, glassTypes.includes(type)?expected.material:undefined, '3D material must stay scoped to Liquid Glass components');
  } catch (error) {
    // Capture the still-live iframe before closing it; a host load timeout
    // alone cannot distinguish pending imports from a native runtime failure.
    try { error.diagnostics = await diagnostics(error); }
    finally { closing = true; await page.close(); }
    throw error;
  }
  return {page, errors, requests, diagnostics, close: async () => { closing = true; await page.close(); }};
}

async function ready(page) {
  await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('pk-component-story')?.dataset.state));
  const state = await page.$eval('pk-component-story', host => ({state: host.dataset.state, message: host.querySelector('[role=alert]')?.textContent}));
  assert.equal(state.state, 'ready', state.message ?? 'Story did not become ready');
  await page.waitForFunction(() => {
    const player = document.querySelector('hyperframes-player'), win = player?.iframeElement?.contentWindow;
    return player?.ready && player.assetsReady && player.painted && win?.__storybookComponent?.instance && win.__timelines?.main && win.__renderReady === true;
  });
  return page.evaluate(() => {
    const player = document.querySelector('hyperframes-player'), win = player.iframeElement.contentWindow;
    player.pause();
    const {instance, film, plan} = win.__storybookComponent;
    const {material, ...motion} = plan.look;
    return {duration: player.duration, dimensions: [player.compositionWidth, player.compositionHeight],
      planDimensions: [plan.width, plan.height], aspect: film.aspect, font: plan.brand.font,
      look: film.style, brand: film.brand, materialName: film.material, material, motion, plannedScene: plan.scenes[0],
      tokens: plan.brand.tokens, type: instance.ps.scene.type, scene: instance.ps.scene, nativeRuntime: Boolean(win.__player),
      errors: [...(win.__pkErrors ?? []), ...(win.__hfPreviewErrors ?? [])]};
  });
}

// How far apart two pictures of the player are: the largest difference of a
// channel and how many pixels differ at all. Under load Chromium rounds an
// antialiased edge one step differently, which is no difference to see.
async function pictureDistance(page, one, other) {
  return page.evaluate(async (one, other) => {
    const read = async data => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(data), char => char.charCodeAt(0))], {type: 'image/png'}));
      const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
      context.drawImage(bitmap, 0, 0);
      return context.getImageData(0, 0, bitmap.width, bitmap.height);
    };
    const [a, b] = await Promise.all([read(one), read(other)]);
    if (a.width !== b.width || a.height !== b.height) return {max: 255, pixels: a.width * a.height};
    let max = 0, pixels = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]), Math.abs(a.data[i + 3] - b.data[i + 3]));
      if (d) pixels++;
      if (d > max) max = d;
    }
    return {max, pixels};
  }, Buffer.from(one).toString('base64'), Buffer.from(other).toString('base64'));
}

async function seekSnapshot(page, fraction) {
  const requested = await page.evaluate(fraction => {
    const player = document.querySelector('hyperframes-player');
    const at = Math.floor(player.duration * fraction * 30) / 30;
    player.pause(); player.seek(at); return at;
  }, fraction);
  await page.waitForFunction(at => {
    const player = document.querySelector('hyperframes-player');
    return Math.abs(player?.iframeElement?.contentWindow.__storybookComponent?.instance.localTime - at) < 0.00002;
  }, {}, requested);
  const state = await page.evaluate(async () => {
    const player = document.querySelector('hyperframes-player'), win = player.iframeElement.contentWindow;
    const {instance, plan} = win.__storybookComponent;
    // A video in a scene decodes its frame after the seek; the picture of
    // this moment is there only when that is done.
    await instance.frameReady();
    await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
    const root = instance.root;
    const encode = node => {
      if (node.nodeType === Node.TEXT_NODE) return ['text', node.textContent];
      if (node.nodeType !== Node.ELEMENT_NODE) return null;
      // Inactive selection/ghost layers may retain the geometry of the last
      // time they were shown. `display:none` removes that subtree entirely
      // from rendering; its historical geometry is not a pixel difference.
      // Preserve visibility:hidden nodes because they can reserve layout.
      if (win.getComputedStyle(node).display === 'none') return null;
      // Browser/runtime updates may reinsert an unchanged attribute. Attribute
      // order is not a visual state; retain every value in canonical order.
      const attrs = [...node.attributes].map(attr => [attr.name, attr.name === 'style'
        ? [...node.style].sort().map(key => [key, node.style.getPropertyValue(key), node.style.getPropertyPriority(key)])
        : attr.value]).sort(([a], [b]) => a.localeCompare(b));
      return [node.tagName, attrs, [...node.childNodes].map(encode).filter(Boolean)];
    };
    return {time: instance.localTime, paused: player.paused, html: JSON.stringify(encode(root)),
      canvases: [...root.querySelectorAll('canvas')].map(canvas => ({width: canvas.width, height: canvas.height, pixels: canvas.toDataURL(), metal: canvas.dataset.metal, kind: canvas.dataset.metalKind})),
      text: root.textContent, planFont: plan.brand.font, textCount: instance.textBoxes().length,
      errors: [...(win.__pkErrors ?? []), ...(win.__hfPreviewErrors ?? [])]};
  });
  assert.ok(state.paused, 'Native player must remain paused while seeking');
  assert.deepEqual(state.errors, [], 'Native component reported an error');
  const player = await page.$('hyperframes-player');
  const picture = await player.screenshot(), pixelHash = hash(picture);
  return {time: state.time, domHash: hash(state.html), pixelHash, picture, canvasHashes: state.canvases.map(canvas => ({width: canvas.width, height: canvas.height, sha256: hash(canvas.pixels), ...(canvas.metal ? {metal: canvas.metal, kind: canvas.kind} : {})})), text: state.text, textCount: state.textCount};
}

async function capture(page, filename) {
  const player = await page.$('hyperframes-player');
  assert.ok(player, 'Native player element is absent');
  await player.screenshot({path: path.join(OUT, filename)});
}

function checkRequests(session) {
  assert.deepEqual(session.requests, [], 'A story asset failed to load');
  assert.deepEqual(session.errors, [], 'A browser error occurred');
}

async function checkSwitchMotion(page) {
  const result = await page.evaluate(() => {
    const {instance} = document.querySelector('hyperframes-player').iframeElement.contentWindow.__storybookComponent;
    const world = instance.context.K.glass, {scene, camera, render} = world.inspect();
    const finish = world.audit().cards[0].finish.kind;
    const metal = finish === 'metal', smoked = finish === 'dark-glass';
    const accent = instance.plan.brand.tokens?.accent ?? '#08cd08';
    const slots = [...instance.sceneRoot.querySelectorAll('[role="switch"]')];
    const groups = scene.getObjectsByProperty('name', 'liquid-switch');
    if (groups.length !== slots.length || slots.length !== instance.ps.scene.toggles.length) {
      throw new Error('Each labelled switch needs its own mesh and projected slot');
    }
    const backings = groups.map(group => group.getObjectByName('switch-thumb-backing'));
    if (backings.some(mesh => !mesh?.isMesh || mesh.material.color.getHex() !== 0xffffff))
      throw new Error('Every switch needs a white OFF disc');
    const saved = instance.localTime, canvas = world.canvas;
    const draw = t => instance.drawAt(instance.ps.start - instance.clipStart + t / instance.ps.speed);
    const screenPoint = (mesh, xFraction = .5, yFraction = .5) => {
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox, point = box.getCenter(mesh.position.clone());
      point.x = box.min.x + xFraction * (box.max.x - box.min.x);
      point.y = box.min.y + yFraction * (box.max.y - box.min.y);
      mesh.localToWorld(point).project(camera);
      return {x: (1 + point.x) / 2, y: (1 - point.y) / 2};
    };
    const canvasColor = ({x,y}) => [...canvas.getContext('2d').getImageData(
      Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1).data].slice(0,3);
    const cap = mesh => Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const frame = logicalTime => {
      draw(logicalTime);
      const canvasRect = canvas.getBoundingClientRect();
      return slots.map((slot, i) => {
        const rect = slot.getBoundingClientRect();
        const slotPosition = name => {
          const {x, y} = screenPoint(groups[i].getObjectByName(name));
          return {x: (canvasRect.left + x * canvasRect.width - rect.left) / rect.width,
            y: (canvasRect.top + y * canvasRect.height - rect.top) / rect.height};
        };
        // Read the exposed end of the rail, away from the knob and rim.
        const checked = slot.getAttribute('aria-checked');
        const railColor = canvasColor(screenPoint(groups[i].getObjectByName('switch-rail'), checked === 'true' ? .27 : .73));
        const optics = name => {
          const part = groups[i].getObjectByName(name), material = cap(part);
          // A glass part is a traced slab on polygons that are never drawn.
          if (!metal) return {traced: Boolean(part.getObjectByName(name + '-slab')) && material.visible === false};
          return {transmission: material.transmission, metalness: material.metalness, roughness: material.roughness, ior: material.ior,
            colour: material.color.getHex(), emission: material.emissive.clone().multiplyScalar(material.emissiveIntensity).toArray()};
        };
        const housing = groups[i].getObjectByName('switch-housing');
        const thumb = groups[i].getObjectByName('switch-thumb'), backing = backings[i];
        // Compare centres in the switch's own coordinates before camera projection.
        const centre = mesh => groups[i].worldToLocal(mesh.getWorldPosition(mesh.position.clone()));
        const offset = centre(backing).sub(centre(thumb)).toArray();
        housing.geometry.computeBoundingBox();
        // Measure on the card itself, independent of the camera's orbit.
        const size = housing.geometry.boundingBox.getSize(housing.position.clone())
          .multiply(housing.scale).multiply(groups[i].scale).toArray();
        return {checked, name: slot.getAttribute('aria-label'), railColor, offset, backingScale: backing.scale.x,
          thumbColor: canvasColor(screenPoint(thumb)),
          size, housingOptics: optics('switch-housing'), thumbOptics: optics('switch-thumb'),
          track: slotPosition('switch-housing'), thumb: slotPosition('switch-thumb')};
      });
    };
    const readSlider = () => {
      const slot = instance.sceneRoot.querySelector('[role="progressbar"]');
      const sliders = scene.getObjectsByProperty('name', 'liquid-slider');
      if (sliders.length !== Number(Boolean(instance.ps.scene.slider)) || Boolean(slot) !== Boolean(sliders.length))
        throw new Error('An optional slider needs exactly one mesh group and labelled slot when configured');
      if (!slot) return null;
      if (sliders[0].getObjectByName('switch-thumb-backing'))
        throw new Error('The white OFF backing belongs only to the switch');
      if (slot.getAttribute('aria-label') !== instance.ps.scene.slider ||
          slot.getAttribute('aria-valuemin') !== '0' || slot.getAttribute('aria-valuemax') !== '100')
        throw new Error('The slider must expose its authored label and full value range');
      const rail = sliders[0].getObjectByName('slider-rail'), thumb = sliders[0].getObjectByName('slider-thumb');
      const disc = sliders[0].getObjectByName('slider-thumb-backing');
      if (!disc?.isMesh || !disc.material.color.equals(rail.material.color.clone().set(accent)))
        throw new Error('The slider needs a circular insert in the active rail colour');
      disc.geometry.computeBoundingBox();
      thumb.geometry.computeBoundingBox();
      const size = thumb.geometry.boundingBox.getSize(thumb.position.clone());
      const start = Math.max(.7, instance.ps.ldur * .66);
      const sample = t => {
        draw(t);
        const rect = slot.getBoundingClientRect(), view = canvas.getBoundingClientRect();
        const p = screenPoint(thumb);
        const offset = thumb.worldToLocal(disc.getWorldPosition(disc.position.clone()));
        const thumbSize = size.clone().multiply(thumb.getWorldScale(thumb.scale.clone()));
        const discSize = disc.geometry.boundingBox.getSize(disc.position.clone()).multiply(disc.getWorldScale(disc.scale.clone()));
        if (!disc.visible || Math.hypot(offset.x, offset.y) > .001 || (metal ? offset.z <= 0 : offset.z >= 0) ||
            Math.abs(discSize.x / thumbSize.x - .6) > .01 || Math.abs(discSize.y / thumbSize.y - .6) > .01)
          throw new Error('The 60% slider disc must stay centred under Glass or on the Metal face');
        if (metal) {
          // Probe the metal between the central insert and the outer rim.
          const flank = screenPoint(thumb, .14), colour = canvasColor(flank);
          if (withoutMeshes([rail], () => canvasColor(flank)).some((v, c) => v !== colour[c]))
            throw new Error('The slider rail must be occluded by its opaque Metal thumb');
        }
        const discPixel = canvasColor(screenPoint(disc));
        const original = disc.material.color.clone();
        try {
          // Change only the insert to prove its pixels reach the final frame.
          disc.material.color.setRGB(original.r < .5 ? 1 : 0, original.g < .5 ? 1 : 0, original.b < .5 ? 1 : 0);
          render();
          if (canvasColor(screenPoint(disc)).every((v, c) => Math.abs(v - discPixel[c]) < 35))
            throw new Error('The slider disc has no visible contribution at value ' + slot.getAttribute('aria-valuenow'));
        } finally { disc.material.color.copy(original); render(); }
        return {value: Number(slot.getAttribute('aria-valuenow')),
          x: (view.x + view.width * p.x - rect.x) / rect.width, y: (view.y + view.height * p.y - rect.y) / rect.height,
          thumbAspect: (size.x * thumb.scale.x) / (size.y * thumb.scale.y),
          colour: canvasColor(screenPoint(rail)), discPixel, transmission: cap(thumb).transmission,
          traced: Boolean(thumb.getObjectByName('slider-thumb-slab'))};
      };
      const initial = sample(start), moving = sample(start + .35), pixels = canvas.toDataURL();
      const end = sample(start + .7), reverse = sample(start + .35);
      return {initial, moving, end, reverse, exact: pixels === canvas.toDataURL()};
    };
    const withoutMeshes = (meshes, read) => {
      const visibility = meshes.map(mesh => mesh.visible);
      try {
        for (const mesh of meshes) mesh.visible = false;
        render();
        return read();
      } finally {
        meshes.forEach((mesh, i) => { mesh.visible = visibility[i]; });
        render();
      }
    };
    const withoutSwitchRails = read => withoutMeshes(groups.map(group => group.getObjectByName('switch-rail')), read);
    const checkFinishes = () => {
      const shaderUniforms = material => {
        const shader = {uniforms: {}, vertexShader: '', fragmentShader: ''};
        material.onBeforeCompile(shader);
        return shader.uniforms;
      };
      const panel = cap(groups[0].parent.children.find(node => node.isMesh));
      const worldSheet = metal && shaderUniforms(panel).uMetalSheet?.value;
      if (metal && !worldSheet?.isCanvasTexture) throw new Error('The Metal control panel needs a native shader sheet');
      const measurements = {};
      for (const group of [...groups, ...scene.getObjectsByProperty('name', 'liquid-slider')]) {
        const type = group.name.slice('liquid-'.length);
        for (const part of ['housing', 'thumb']) {
          const mesh = group.getObjectByName(type + '-' + part), face = cap(mesh);
          if (!metal) {
            if (!(mesh.getObjectByName(mesh.name + '-slab') && face.visible === false)) throw new Error(mesh.name + ' must be traced glass on undrawn polygons');
            if (Array.isArray(mesh.material) && mesh.material[1]?.metalness) throw new Error(mesh.name + ' has a metal rim under Glass');
            continue;
          }
          mesh.geometry.computeBoundingBox();
          const size = mesh.geometry.boundingBox.getSize(mesh.position.clone());
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const sheetFlags = new Set();
          for (const material of materials) {
            const uniforms = shaderUniforms(material), dims = uniforms.uMetalDimensions?.value;
            if (material.metalness !== 1 || material.transmission !== 0 || material.opacity !== 1 || material.transparent ||
                uniforms.uMetalSheet?.value !== worldSheet || material.customProgramCacheKey() !== panel.customProgramCacheKey())
              throw new Error(mesh.name + ' face and bevel must be opaque metal sampling the panel’s own shader sheet');
            if (!dims || Math.max(Math.abs(dims.x - size.x), Math.abs(dims.y - size.y), Math.abs(dims.w - size.z)) > .0001)
              throw new Error(mesh.name + ' metal shader dimensions must match its local geometry');
            sheetFlags.add(uniforms.uMetalHasSheet);
          }
          if (mesh.name in measurements) continue;
          // Suppress the sampled finish only on this control at a fixed pose.
          // Other parts and the panel retain their original metal appearance.
          const a = screenPoint(mesh, 0, 0), b = screenPoint(mesh, 1, 1);
          const x = Math.floor(Math.min(a.x,b.x) * canvas.width), y = Math.floor(Math.min(a.y,b.y) * canvas.height);
          const w = Math.ceil(Math.max(a.x,b.x) * canvas.width) - x, h = Math.ceil(Math.max(a.y,b.y) * canvas.height) - y;
          const capture = () => canvas.getContext('2d').getImageData(x,y,w,h).data;
          const before = capture();
          try {
            for (const flag of sheetFlags) flag.value = 0;
            render();
            const flat = capture();
            let changed = 0;
            for (let i = 0; i < before.length; i += 4) {
              if ([0,1,2].some(c => Math.abs(before[i+c] - flat[i+c]) > 8)) changed++;
            }
            measurements[mesh.name] = changed;
            if (changed < 3) throw new Error(mesh.name + ' metal sheet is invisible in the rendered control');
          } finally {
            for (const flag of sheetFlags) flag.value = 1;
            render();
          }
        }
      }
      return measurements;
    };
    try {
      const off = frame(.48), offPixels = canvas.toDataURL();
      const offHasNoFill = withoutSwitchRails(() => canvas.toDataURL() === offPixels);
      let emptyHousing, silverReflection;
      if (smoked && !instance.plan.brand.tokens?.background) {
        // Compare the empty OFF end with the actual underlying smoky card at
        // those pixels. Uncomposited scene colour creates a bright hole here.
        const points = groups.flatMap(group => [.60,.70,.80].map(x => screenPoint(group.getObjectByName('switch-housing'), x)));
        const casing = points.map(canvasColor);
        const underlying = withoutMeshes(groups, () => points.map(canvasColor));
        const delta = Math.max(...casing.flatMap((rgb,i) => rgb.map((v,c) => Math.abs(v - underlying[i][c]))));
        emptyHousing = {casing, underlying, delta};
        if (delta > 45) throw new Error('The empty OFF housing must transmit the smoky card underneath: ' + JSON.stringify(emptyHousing));

        // Sample the actual projected bevel. The weakest RGB channel picks up
        // silver without mistaking saturated blue behind the mesh for a glint.
        // The pane is traced on a quad: its outline is the slab's half size
        // around the quad's middle.
        const slab = groups[0].parent.children.find(node => node.name === 'liquid-slab');
        const half = slab.material.uniforms.uHalf.value;
        const panePoint = (xFraction, yFraction) => {
          const point = slab.localToWorld(slab.position.clone().set(
            (2 * xFraction - 1) * half.x, (2 * yFraction - 1) * half.y, 0)).project(camera);
          return {x: (1 + point.x) / 2, y: (1 - point.y) / 2};
        };
        const rim = x => {
          const top = panePoint(x, 1);
          const band = canvas.getContext('2d').getImageData(Math.floor(top.x * canvas.width),
            Math.floor(top.y * canvas.height) - 8, 1, 17).data;
          let peak = 0;
          for (let i = 0; i < band.length; i += 4) peak = Math.max(peak, Math.min(band[i], band[i + 1], band[i + 2]));
          return peak;
        };
        const median = values => values.sort((a,b) => a - b)[Math.floor(values.length / 2)];
        silverReflection = {
          corner: median([.025,.04,.055].map(rim)),
          left: median([.12,.15,.18,.21,.24].map(rim)), right: median([.76,.79,.82,.85,.88].map(rim)),
          shoulder: Math.min(...canvasColor(panePoint(.15, .94))),
          body: Math.min(...canvasColor(panePoint(.62, .88))),
        };
      }
      // A light panel or a metal highlight can already give a white centre.
      // Recolour only the OFF disc to prove that this layer is visible.
      const offWithDarkBacking = (() => {
        const colours = backings.map(mesh => mesh.material.color.clone());
        try {
          for (const mesh of backings) mesh.material.color.set(0);
          render();
          return groups.map(group => canvasColor(screenPoint(group.getObjectByName('switch-thumb'))));
        } finally {
          backings.forEach((mesh, i) => mesh.material.color.copy(colours[i]));
          render();
        }
      })();
      for (const [i, backing] of backings.entries()) {
        const size = mesh => {
          mesh.geometry.computeBoundingBox();
          return mesh.geometry.boundingBox.getSize(mesh.position.clone()).multiply(mesh.getWorldScale(mesh.scale.clone()));
        };
        const disc = size(backing), lens = size(groups[i].getObjectByName('switch-thumb'));
        if (Math.abs(disc.x / disc.y - 1) > .01 || Math.abs(disc.x / lens.x - .6) > .015)
          throw new Error('The round white OFF disc must cover 60% of the thumb diameter');
      }
      const moving = frame(.62), forward = canvas.toDataURL();
      const unfilledEnd = screenPoint(groups[0].getObjectByName('switch-rail'), .88);
      const movingUnfilledColor = canvasColor(unfilledEnd);
      const exposedGlassColor = withoutSwitchRails(() => canvasColor(unfilledEnd));
      const on = frame(instance.ps.ldur * .9);
      if (metal) {
        const centres = withoutSwitchRails(() => groups.map(group => canvasColor(screenPoint(group.getObjectByName('switch-thumb')))));
        if (centres.some((rgb, i) => rgb.some((v, c) => v !== on[i].thumbColor[c])))
          throw new Error('The enabled rail must be occluded by its opaque Metal thumb');
      }
      const onPixels = canvas.toDataURL();
      const onHasNoBacking = withoutMeshes(backings, () => canvas.toDataURL() === onPixels);
      const finishPixels = checkFinishes();
      // Probe the two long edges left of the lens while keeping the ON pose fixed.
      const housing = groups[0].getObjectByName('switch-housing');
      const rimBands = () => [[.04,.08,.12],[.88,.92,.96]].map(ys =>
        ys.flatMap(y => [.30,.35,.40,.45,.50].flatMap(x => canvasColor(screenPoint(housing,x,y)))));
      const filledBands = rimBands(), emptyBands = withoutSwitchRails(rimBands);
      const rimDelta = filledBands.map((band, edge) => Math.max(...band.map((v, i) => Math.abs(v - emptyBands[edge][i]))));
      const context = canvas.getContext('2d'), bounds = canvas.getBoundingClientRect();
      const slot = slots[0].getBoundingClientRect();
      const scaleX = canvas.width / bounds.width, scaleY = canvas.height / bounds.height;
      const x = Math.floor((slot.left - bounds.left) * scaleX), y = Math.floor((slot.top - bounds.top) * scaleY);
      const width = Math.ceil(slot.width * scaleX), height = Math.ceil(slot.height * scaleY);
      // Include the neighbouring panel on the right: its transmission buffer
      // must not re-project foreground switches outside their slots.
      const crop = () => context.getImageData(x, y, width * 2, height).data;
      const withSwitch = crop(), visible = groups[0].visible;
      groups[0].visible = false;
      try { render(); } finally { groups[0].visible = visible; }
      const withoutSwitch = crop();
      render();
      let painted = 0, spill = 0;
      for (let i = 0; i < withSwitch.length; i += 4) {
        const changed = [0, 1, 2].some(c => Math.abs(withSwitch[i + c] - withoutSwitch[i + c]) > 16);
        if (!changed) continue;
        const col = (i / 4) % (width * 2);
        if (col < width) painted++;
        if (col > width + 3) spill++;
      }
      const reverse = frame(.62);
      return {labels: instance.ps.scene.toggles, metal, smoked, accent, emptyHousing, silverReflection,
        off, offHasNoFill, offWithDarkBacking, moving, movingUnfilledColor, exposedGlassColor,
        on, onHasNoBacking, reverse, painted, spill, rimDelta, finishPixels,
        exact: forward === canvas.toDataURL(), slider: readSlider()};
    } finally { instance.drawAt(saved); }
  });
  assert.deepEqual(result.off.map(slot => slot.name), result.labels);
  assert.ok(result.off.every(slot => slot.checked === 'false'));
  assert.ok(result.offHasNoFill, 'An inactive switch must render identically with its fill removed');
  if (result.silverReflection) {
    const {corner, left, right, shoulder, body} = result.silverReflection;
    assert.ok(corner > left * .5, `The reflection must follow the upper-left curve of the glass: ${corner} vs ${left}`);
    assert.ok(left > 155 && right < left * .35, `The Dark Glass silver highlight should fade along its upper rim: ${left} → ${right}`);
    assert.ok(shoulder > body + 10, `The Dark Glass upper-left shoulder should softly light the pane: ${shoulder} vs ${body}`);
  }
  assert.ok(result.onHasNoBacking, 'An enabled switch must render identically with its white backing removed');
  assert.deepEqual(result.movingUnfilledColor, result.exposedGlassColor, 'Ahead of the moving thumb the glass must remain unfilled');
  assert.ok(result.on.every(slot => slot.checked === 'true'));
  assert.deepEqual(result.rimDelta, [0,0], 'The active rail must not project colour onto either outer rim');
  for (const state of [result.off, result.moving, result.on]) {
    for (const {track, thumb} of state) {
      assert.ok(Math.abs(track.x - .5) < .12 && Math.abs(track.y - .5) < .12, '3D switch housing slipped out of its labelled slot');
      assert.ok(Math.abs(thumb.y - .5) < .15, '3D thumb slipped vertically on its track');
    }
  }
  const rgbOf = value => {
    const hex = value.slice(1);
    return (hex.length === 3 ? [...hex].map(c => c + c).join('') : hex).match(/../g).map(c => parseInt(c, 16));
  };
  const active = rgbOf(result.accent);
  for (let i = 0; i < result.off.length; i++) {
    assert.ok(result.off[i].thumb.x < .38 && result.on[i].thumb.x > .62, 'Off and On must occupy opposite ends');
    const off = result.off[i];
    if (!result.smoked) assert.ok(Math.max(...off.thumbColor) - Math.min(...off.thumbColor) < 25 && Math.min(...off.thumbColor) > 185,
      `The OFF disc must read as white: ${off.thumbColor}`);
    assert.ok(off.thumbColor.every((channel, c) => channel - result.offWithDarkBacking[i][c] > 35),
      `The OFF disc must be visible in the centre of the thumb: ${off.thumbColor} vs dark probe ${result.offWithDarkBacking[i]}`);
    for (const state of [off, result.moving[i]]) {
      const [x,y,z] = state.offset;
      assert.ok(Math.hypot(x,y) < .001, 'The white disc must follow the thumb');
      assert.ok(result.metal ? z > 0 : z < 0, 'The white disc must lie below glass and on the surface of metal');
    }
    if (result.metal) {
      for (const finish of [off.housingOptics, off.thumbOptics]) {
        assert.equal(finish.transmission, 0, 'The Metal switch must be opaque even when OFF');
        assert.equal(finish.metalness, 1);
      }
    } else {
      assert.ok(off.housingOptics.traced && off.thumbOptics.traced, 'Both the frame and thumb must be traced glass');
    }
    for (const state of [result.moving[i], result.on[i]]) {
      assert.deepEqual(state.size, off.size, 'Switch housing dimensions must stay fixed while switching');
      assert.deepEqual(state.housingOptics, off.housingOptics, 'Switch housing material must stay fixed while switching');
      assert.deepEqual(state.thumbOptics, off.thumbOptics, 'The thumb must keep its material throughout the move');
    }
    assert.ok(active.every((channel, c) => Math.abs(channel - result.on[i].railColor[c]) < 42),
      `The exposed On rail must match its active tint: ${result.on[i].railColor} vs ${result.accent}`);
  }
  assert.ok(result.off[0].thumb.x + .02 < result.moving[0].thumb.x && result.moving[0].thumb.x < result.on[0].thumb.x - .02,
    'The first thumb must pass through an intermediate position on its cue');
  assert.ok(result.moving[0].backingScale > 0 && result.moving[0].backingScale < result.off[0].backingScale,
    'The white disc must contract as its switch moves to ON');
  assert.equal(result.moving[1].backingScale, result.off[1].backingScale, 'The second backing waits for its own switch');
  assert.equal(result.moving[1].checked, 'false', 'The second switch waits for its own cue');
  assert.ok(result.painted > 5, 'Removing the 3D switch must change the pixels in its projected slot');
  assert.ok(result.spill <= 2, `The glass panel is displaying a duplicate of the foreground switch outside its slot (${result.spill} pixels)`);
  assert.deepEqual(result.reverse, result.moving);
  assert.ok(result.exact, 'Reverse seek must reproduce the in-flight WebGL frame');
  if (result.slider) {
    const {initial, moving, end, reverse, exact} = result.slider;
    assert.deepEqual([initial.value, end.value], [12, 82]);
    assert.ok(moving.value > initial.value && moving.value < end.value, 'The slider must move through its fill range');
    for (const sample of [initial, moving, end]) {
      assert.ok(Math.abs(1 - sample.thumbAspect) < .001, 'The slider thumb must stay circular throughout the move');
      if (result.metal) assert.deepEqual(sample.discPixel, active, 'The visible metal inlay must match the active rail');
      assert.ok(Math.abs(sample.x - sample.value / 100) < .08 && Math.abs(sample.y - .5) < .2,
        `Slider thumb must follow its value inside the projected slot: ${JSON.stringify(sample)}`);
    }
    if (result.metal) assert.ok([initial,moving,end].every(sample => sample.transmission === 0), 'The Metal slider must stay opaque');
    else assert.ok(moving.traced, 'The moving glass thumb must be a traced lens over its rail');
    assert.ok(initial.colour.every(c => Math.abs(152 - c) < 12), 'The unfilled slider rail must be neutral grey');
    assert.deepEqual(end.colour, result.on[0].railColor, 'The slider must use the same rail colour as the enabled switch');
    assert.deepEqual(reverse, moving);
    assert.ok(exact, 'Reverse seek must restore the moving glass slider pixels');
  }
  return {switches: result.labels.length, travel: [result.off[0].thumb.x, result.moving[0].thumb.x, result.on[0].thumb.x],
    onColor: result.on[0].railColor, offColor: result.off[0].railColor, spill: result.spill, slider: result.slider,
    offThumbColor: result.off[0].thumbColor, offWithDarkBacking: result.offWithDarkBacking[0],
    finishPixels: result.finishPixels, emptyHousing: result.emptyHousing, silverReflection: result.silverReflection};
}

async function portraitGlassGutters(page, type) {
  return page.evaluate(type => {
    const win = document.querySelector('hyperframes-player').iframeElement.contentWindow;
    const {instance} = win.__storybookComponent, frame = instance.root.getBoundingClientRect();
    const saved = instance.localTime;
    const draw = time => instance.drawAt(instance.ps.start - instance.clipStart + time / instance.ps.speed);
    try {
      // Also check the last readable hold after the camera has pushed in.
      // For glass-flow the two samples belong to different cards.
      const firstHold = type === 'send-prompt' ? .84 : type === 'glass-flow' ? .32 : .45;
      // Search finishes as a single button. Measure its full-width field
      // while the query is visible, before the capsule folds into the button.
      return [firstHold, type === 'search' ? .78 : .94].map(fraction => {
        draw(instance.ps.ldur * fraction);
        const selector = type === 'lens' ? '.pk-glass-lens-layout'
          : type === 'search' ? '.pk-glass-search-field'
          : type === 'send-prompt' ? '[data-glass-surface]' : '[data-design-surface="card"]';
        const surfaces = [...instance.root.querySelectorAll(selector)]
          .filter(node => type === 'lens' || Number(win.getComputedStyle(node).opacity) > .75);
        if (!surfaces.length) throw new Error(type + ': missing readable body at ' + fraction);
        const layout = type === 'widgets' ? surfaces[0].parentElement : surfaces[0];
        const boxes = surfaces.map(node => node.getBoundingClientRect());
        return {fraction, layout: layout.offsetWidth / instance.context.K.W,
          left: (Math.min(...boxes.map(r => r.left)) - frame.left) / frame.width,
          right: (frame.right - Math.max(...boxes.map(r => r.right))) / frame.width};
      });
    } finally {
      instance.drawAt(saved);
    }
  }, type);
}

async function checkSearchCollapse(page) {
  const states = await page.$eval('hyperframes-player', player => {
    const win = player.iframeElement.contentWindow, {instance, plan} = win.__storybookComponent;
    const {ps, root} = instance, saved = instance.localTime;
    const field = root.querySelector('.pk-glass-search-field'), input = field.querySelector('[role="searchbox"]');
    const magnifier = field.querySelector('.pk-glass-search-icon'), slot = field.querySelector('[role="button"]');
    const world = instance.context.K.glass, {camera, scene} = world.inspect();
    const face = scene.getObjectByName('search-face'), button = face.parent;
    const disc = scene.getObjectByName('search-backing');
    const paneMeshes = button.parent.children.filter(node => node.isMesh);
    const visibleInk = node => node.checkVisibility({opacityProperty: true, visibilityProperty: true});
    const mark = (name, fraction) => ps.scene.timing?.[name] === undefined ? ps.dur * fraction : ps.scene.timing[name] * plan.beat;
    const pressed = mark('search', .68), collapse = mark('collapse', .80), collapsed = mark('collapsed', .90), checked = mark('checked', .96);
    function at(time) {
      instance.drawAt(time);
      const center = face.getWorldPosition(face.position.clone()).project(camera);
      return {width: world.audit().cards[0].width, paneVisible: paneMeshes.some(node => node.visible),
        queryVisible: visibleInk(input) && input.innerText.trim() === ps.scene.query.trim(),
        inputVisible: visibleInk(input), iconVisible: visibleInk(magnifier),
        buttonVisible: button.visible && face.visible, busy: slot.getAttribute('aria-busy'), label: slot.getAttribute('aria-label'),
        discVisible: disc.visible && disc.material.opacity > 0, lensVisible: Boolean(button.getObjectByName('search-lens')?.visible),
        glyph: face.material.map.uuid, angle: face.material.map.rotation,
        x: center.x, y: center.y};
    }
    try {
      return {before: at(0), hold: at((pressed + collapse) / 2), folding: at((collapse + collapsed) / 2),
        done: at(collapsed + (checked - collapsed) * .25), spinning: at(collapsed + (checked - collapsed) * .75),
        checked: at(checked + (ps.dur - checked) / 2), end: at(ps.dur), reverse: at((pressed + collapse) / 2)};
    } finally { instance.drawAt(saved); }
  });
  const {before, hold, folding, done, spinning, checked, end} = states;
  assert.ok(!before.discVisible && !before.lensVisible && !hold.lensVisible,
    'Expanded Search must present Enter and the spinner as inline glyphs');
  assert.ok(hold.discVisible, 'A soft disc lies under the pointer once it is over the button');
  assert.equal(hold.busy, 'true', 'Submitting starts the spinner before the field folds');
  assert.ok(hold.queryVisible && hold.iconVisible && hold.paneVisible && hold.width === before.width,
    'The full field and query must hold on screen after submission');
  assert.ok(hold.width > folding.width && folding.width > done.width, 'The physical field must shrink between the two collapse beats');
  assert.ok(done.paneVisible && !done.inputVisible && !done.iconVisible,
    'The folded pane stays as the body of the round button, without the query or the magnifier');
  assert.ok(done.buttonVisible && end.buttonVisible && hold.x > 0 && Math.abs(done.x) < .002 && Math.abs(end.x) < .002,
    'The action button must travel from the right end to the middle');
  assert.ok(!done.discVisible && !end.discVisible && !done.lensVisible && !end.lensVisible,
    'The hover disc must give way to the folded pane, the one circle of the final button');
  assert.ok(done.busy === 'true' && spinning.glyph === hold.glyph && spinning.angle !== done.angle,
    'The spinner must keep rotating on the button until the checked beat');
  assert.ok(checked.busy === 'false' && checked.label === 'Search complete' && checked.glyph !== spinning.glyph
    && checked.glyph !== before.glyph, 'A completed search must show the checkmark instead of the spinner or Enter');
  assert.deepEqual(end, checked, 'The completed button must hold steady through the end');
  assert.ok(Math.abs(done.y - hold.y) < .002, 'Collapsing the field must keep the action button at its height');
  assert.deepEqual(states.reverse, hold, 'Seeking back must restore the full field and the spinner');
  return states;
}

async function runCase(type, aspect, variant) {
  const row = {type, aspect, ...(variant ? {variant: variant.name, variantArgs: variant.args, ...(variant.globals ? {globals: variant.globals} : {})} : {}), passed: false}, started = performance.now();
  let session;
  try {
    const brandbook = type === 'controls' && !variant ? DEFAULT_BRANDBOOK : defaultBook;
    session = await openPage(type, {brandbook, ...variant?.globals, aspect}, undefined, variant);
    row.runtime = await ready(session.page);
    assert.deepEqual(row.runtime.dimensions, DIMENSIONS[aspect]);
    assert.deepEqual(row.runtime.planDimensions, DIMENSIONS[aspect]);
    assert.equal(row.runtime.aspect, aspect);
    assert.equal(row.runtime.type, type);
    for (const [name, value] of Object.entries(variant?.args ?? {})) assert.deepEqual(row.runtime.scene[name], value, 'Named story did not reach the native recipe');
    assert.ok(row.runtime.nativeRuntime, 'Pinned HyperFrames runtime is not active');
    assert.deepEqual(row.runtime.errors, []);
    // The player's auto-hiding controls are wall-clock UI, not composition
    // pixels. Hide only this overlay while comparing the real iframe image.
    await session.page.$eval('hyperframes-player', player => player.removeAttribute('controls'));
    const first = await seekSnapshot(session.page, .65);
    const middle = await seekSnapshot(session.page, .2);
    const again = await seekSnapshot(session.page, .65);
    assert.equal(again.domHash, first.domHash, 'Seeking backwards changed the settled component DOM');
    // Chromium can change a few antialiased channel values by 1/255 despite
    // identical geometry/canvas state. Record exact pixel identity for every
    // story; require it for retype, the canary proving that pruning its hidden
    // selection layers does not hide a visible forward/reverse difference.
    if (type === 'retype') {
      row.seekDistance = await pictureDistance(session.page, first.picture, again.picture);
      assert.ok(row.seekDistance.max <= 1, `Retype hidden-layer history changed rendered pixels: ${JSON.stringify(row.seekDistance)}`);
      assert.notEqual(middle.pixelHash, first.pixelHash, 'Retype seek did not visibly change the frame');
    }
    assert.deepEqual(again.canvasHashes, first.canvasHashes, 'Seeking backwards changed canvas pixels');
    if (type === 'search') {
      const insets = await session.page.$eval('hyperframes-player', player => {
        const field = player.iframeElement.contentWindow.__storybookComponent.instance.root.querySelector('.pk-glass-search-field');
        const box = field.getBoundingClientRect();
        const button = field.querySelector('.pk-glass-search-button').getBoundingClientRect();
        const magnifier = field.querySelector('.pk-glass-search-icon svg').getBoundingClientRect();
        const input = field.querySelector('[role="searchbox"]').getBoundingClientRect();
        return {rightInset: box.right - button.right, topInset: button.top - box.top, bottomInset: box.bottom - button.bottom,
          textGap: button.left - input.right, diameter: button.width, leadingCentre: magnifier.left + magnifier.width / 2 - box.left,
          trailingCentre: box.right - button.left - button.width / 2,
          verticalOffset: (button.top + button.height / 2) - (magnifier.top + magnifier.height / 2)};
      });
      const {rightInset, topInset, bottomInset, textGap, diameter, leadingCentre, trailingCentre, verticalOffset} = insets;
      assert.ok(diameter > 0 && rightInset > 0 && rightInset < diameter && topInset > 0 && bottomInset > 0,
        'The Search action must be inset inside the right end of the field');
      assert.ok(Math.abs(leadingCentre - trailingCentre) < 1 && Math.abs(verticalOffset) < 1,
        'The Enter and search icons share a baseline and matching edge insets: ' + JSON.stringify(insets));
      assert.ok(textGap > 0, 'The query must have its own space before the action button');
      row.collapse = await checkSearchCollapse(session.page);
    }
    if (!variant && aspect === '9:16' && glassFamily.includes(type)) {
      row.gutters = await portraitGlassGutters(session.page, type);
      for (const {fraction, layout, left, right} of row.gutters) {
        // The DOM grid, both sheets of the transition and the lens text column
        // all use the same portrait width before the camera projects them.
        assert.ok(Math.abs(layout - .86) < .003, `${type}: portrait layout spans ${layout} of the frame`);
        // Perspective and the outer scene motion change the authored seven-percent gutter.
        assert.ok(Math.min(left, right) >= 0 && Math.max(left, right) <= .09,
          `${type} portrait hold ${fraction}: broad or cropped gutters (${left.toFixed(3)}, ${right.toFixed(3)})`);
      }
    }
    if (type === 'controls') row.switchMotion = await checkSwitchMotion(session.page);
    if (variant?.globals?.material === 'dark-glass') {
      assert.equal(row.runtime.materialName, 'dark-glass');
      assert.equal(row.runtime.material.type, 'dark-glass');
      const native = await glassState(session.page);
      assert.equal(native.finish.kind, 'dark-glass');
      assert.ok(native.audit?.cards.length);
      for (const {finish} of native.audit.cards) {
        assert.equal(finish.kind, 'dark-glass');
        assert.equal(finish.traced, true, 'Dark Glass must be traced glass that shows the scene');
        assert.ok(finish.tint, 'Dark Glass carries its tint');
      }
      if (type === 'lens') assert.equal(native.textTexture.mechanism, 'traced-slab');
      row.nativeMaterial = native;
    }
    if (type === 'thinking-orb') assert.notDeepEqual(middle.canvasHashes, first.canvasHashes, 'Orb variant did not animate under the native clock');
    if (variant?.globals?.material === 'metal') {
      assert.equal(row.runtime.look, 'glass');
      assert.equal(row.runtime.materialName, 'metal');
      assert.equal(row.runtime.material.type, 'metal');
      assert.notDeepEqual(middle.canvasHashes, first.canvasHashes, 'Metal material did not animate under the native clock');
      const applied = await session.page.evaluate(() => {
        const root = document.querySelector('hyperframes-player').iframeElement.contentWindow.__storybookComponent.instance.root;
        return {text: root.querySelectorAll('.pk-metal-fill').length, surfaces: root.querySelectorAll('.pk-metal-surface').length,
          overlays: root.querySelectorAll('canvas[data-metal]').length};
      });
      assert.ok(glassTypes.includes(type), 'Metal comparison stories must be limited to Liquid Glass 3D');
      {
        const native = await glassState(session.page);
        assert.equal(native.mode, type, 'Metal must use the shared native component');
        assert.equal(native.finish.kind, 'metal');
        assert.equal(native.finish.branded, true);
        assert.equal(native.finish.shaderPreset, 'chromatic');
        assert.ok(native.audit?.cards.length, 'Metal did not create a shared 3D surface');
        for (const card of native.audit.cards) {
          assert.equal(card.finish.kind, 'metal');
          assert.equal(card.finish.metalness, 1, 'Every Metal face, including the lens, must be metallic');
          assert.equal(card.finish.transmission, 0, 'Metal surfaces must never refract the scene');
          assert.equal(card.finish.shaderPreset, 'chromatic', 'The shared surface must use the original MetalFx sheet');
        }
        if (type === 'lens') {
          assert.equal(native.textTexture.mechanism, 'opaque-metal');
          const coversText = await session.page.evaluate(() => {
            const {instance} = document.querySelector('hyperframes-player').iframeElement.contentWindow.__storybookComponent;
            const world = instance.context.K.glass, {lens, textPlane, camera, render} = world.inspect();
            const centre = lens.getWorldPosition(lens.position.clone()).project(camera);
            const canvas = world.canvas, ctx = canvas.getContext('2d');
            const x = Math.floor((1 + centre.x) * canvas.width / 2), y = Math.floor((1 - centre.y) * canvas.height / 2);
            const snapshot = () => [ctx.getImageData(x,y,1,1).data.join(','), ctx.getImageData(1,1,1,1).data.join(',')];
            const original = textPlane.material, probe = new original.constructor({toneMapped: false});
            try {
              textPlane.material = probe;
              probe.color.set(0xff00ff); render();
              const magenta = snapshot();
              probe.color.set(0x00ff00); render();
              const green = snapshot();
              return magenta[0] === green[0] && magenta[1] !== green[1];
            } finally {
              textPlane.material = original; probe.dispose(); render();
            }
          });
          assert.ok(coversText, 'The Metal lens must occlude the plane behind it even under high contrast');
        }
        assert.deepEqual(applied, {text: 0, surfaces: 0, overlays: 0}, 'Shared native components must not retain the legacy DOM Metal renderer');
        row.nativeMaterial = native;
      }
      row.materialTargets = applied;
    }
    if (['canvas', 'webgl'].includes(catalogue.find(entry => entry.type === type).renderMode)) {
      assert.ok(first.canvasHashes.length, 'Canvas/WebGL story did not create a canvas');
      assert.ok(first.canvasHashes.every(canvas => canvas.width > 0 && canvas.height > 0));
    }
    row.seek = {time: again.time, domHash: again.domHash, firstPixelHash: first.pixelHash, pixelHash: again.pixelHash,
      pixelIdentical: first.pixelHash === again.pixelHash, pixelCanary: type === 'retype',
      canvasHashes: again.canvasHashes, textCount: again.textCount};
    if (QUICK.includes(type) || glassTypes.includes(type) || variant?.globals?.material) {
      await session.page.$eval('hyperframes-player', player => player.setAttribute('controls', ''));
      row.screenshot = `${type}${variant ? '-'+variant.exportName : ''}-${aspect.replace(':', '-')}.png`; await capture(session.page, row.screenshot);
    }
    checkRequests(session); row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); row.diagnostics = error.diagnostics ?? (session && await session.diagnostics(error)); failures.push(row); console.error(`FAIL ${type} ${aspect} ${variant?.name ?? ''}: ${error.message}`); }
  finally { if (session) await session.close(); row.elapsedMs = Math.round(performance.now() - started); report.cases.push(row); }
}

async function controlsAndCleanup() {
  const row = {name: 'brand-controls-copy-validation-cleanup', passed: false};
  let session;
  try {
    session = await openPage('typewriter', {aspect: '1:1', brandbook: defaultBook});
    const initial = await ready(session.page);
    assert.deepEqual(initial.font, selectedBrand.font); assert.deepEqual(initial.brand, selectedBrand);
    for (const aspect of ['9:16', '1:1']) {
      await session.page.evaluate(aspect => window.__STORYBOOK_ADDONS_CHANNEL__.emit(
        window.__STORYBOOK_MODULE_CORE_EVENTS__.UPDATE_GLOBALS, {globals: {aspect}}), ASPECT_KEYS[aspect]);
      await session.page.waitForFunction(aspect => document.querySelector('hyperframes-player')?.iframeElement?.contentWindow.__storybookComponent?.film.aspect === aspect, {}, aspect);
      const afterToolbar = await ready(session.page);
      assert.deepEqual(afterToolbar.dimensions, DIMENSIONS[aspect], 'Toolbar format switch did not rebuild the native composition');
    }
    const id = stories.get('typewriter').id, copy = 'Exact copied text';
    // This is the same Storybook event emitted by the Controls addon.
    await session.page.evaluate(({id, copy}) => {
      window.__previousStoryPlayer = document.querySelector('hyperframes-player');
      window.__STORYBOOK_ADDONS_CHANNEL__.emit(window.__STORYBOOK_MODULE_CORE_EVENTS__.UPDATE_STORY_ARGS,
        {storyId: id, updatedArgs: {text: copy}});
    }, {id, copy});
    await session.page.waitForFunction(() => document.querySelector('hyperframes-player') !== window.__previousStoryPlayer);
    await ready(session.page);
    const changed = await session.page.evaluate(() => {
      const player = document.querySelector('hyperframes-player'), {film, plan, instance} = player.iframeElement.contentWindow.__storybookComponent;
      return {copy: film.scenes[0].text, sceneCopy: instance.ps.scene.text, accent: plan.brand.tokens.accent,
        families: [...instance.root.querySelectorAll('*')].filter(node => [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim())).map(node => getComputedStyle(node).fontFamily),
        oldConnected: window.__previousStoryPlayer.isConnected, oldPaused: window.__previousStoryPlayer.paused};
    });
    assert.equal(changed.copy, copy); assert.equal(changed.sceneCopy, copy); assert.equal(changed.accent, selectedBrand.tokens.accent);
    assert.ok(changed.families.some(family => family.includes(selectedFont)), 'The brandbook font did not reach rendered text');
    assert.equal(changed.oldConnected, false); assert.equal(changed.oldPaused, true);
    const typed = await seekSnapshot(session.page, .85);
    assert.ok(typed.text.includes(copy), 'Controlled copy did not appear in the component');
    await capture(session.page, 'brand-controls-square.png');
    await session.page.evaluate(id => window.__STORYBOOK_ADDONS_CHANNEL__.emit(window.__STORYBOOK_MODULE_CORE_EVENTS__.UPDATE_STORY_ARGS,
      {storyId: id, updatedArgs: {text: 'x'.repeat(200)}}), id);
    await session.page.waitForFunction(() => document.querySelector('pk-component-story')?.dataset.state === 'error');
    row.invalidMessage = await session.page.$eval('[role=alert]', node => node.textContent);
    assert.match(row.invalidMessage, /text.*at most/i);
    assert.equal(await session.page.$('hyperframes-player'), null, 'Invalid args must not start a native scene');
    await session.page.evaluate(id => window.__STORYBOOK_ADDONS_CHANNEL__.emit(window.__STORYBOOK_MODULE_CORE_EVENTS__.UPDATE_STORY_ARGS,
      {storyId: id, updatedArgs: {text: 'Recovered copy'}}), id);
    await ready(session.page);
    checkRequests(session); row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); row.diagnostics = error.diagnostics ?? (session && await session.diagnostics(error)); failures.push(row); console.error(`FAIL controls/cleanup: ${error.message}`); }
  finally { if (session) await session.close(); report.checks.push(row); }
}

async function orbIsolation() {
  const entry = catalogue.find(item => item.type === 'thinking-orb');
  if (!entry) return;
  const row = {name: 'orb-instance-clocks-and-disposal', passed: false};
  let session;
  try {
    session = await openPage(entry.type, {aspect: '1:1'}, undefined, entry.variants[0]);
    await session.page.evaluate(state => {
      const first = document.querySelector('pk-component-story'), second = document.createElement('pk-component-story');
      second.id = 'orb-independent-story';
      // Both stories must be visible: hidden previews intentionally stay unmounted.
      second.style.cssText = 'position:fixed;right:0;top:0;width:42vw;z-index:10';
      second.input = {...first.input, args: {...first.input.args, state}};
      first.after(second);
    }, entry.fields.state.values[1]);
    await session.page.waitForFunction(() => {
      const host = document.getElementById('orb-independent-story'), player = host?.querySelector('hyperframes-player');
      return host?.dataset.state === 'ready' && player?.painted && player.iframeElement?.contentWindow.__storybookComponent?.instance;
    });
    const seek = async (which, fraction) => {
      const target = await session.page.evaluate(({which, fraction}) => {
        const player = document.querySelectorAll('pk-component-story')[which].querySelector('hyperframes-player');
        player.pause(); const time = Math.floor(player.duration * fraction * 30) / 30; player.seek(time); return time;
      }, {which, fraction});
      await session.page.waitForFunction(({which, target}) => {
        const player = document.querySelectorAll('pk-component-story')[which].querySelector('hyperframes-player');
        return Math.abs(player.iframeElement.contentWindow.__storybookComponent.instance.localTime - target) < .00002;
      }, {}, {which, target});
    };
    const read = which => session.page.evaluate(which => {
      const player = document.querySelectorAll('pk-component-story')[which].querySelector('hyperframes-player');
      const {instance} = player.iframeElement.contentWindow.__storybookComponent;
      return {time: instance.localTime, state: instance.ps.scene.state, pixels: instance.root.querySelector('canvas').toDataURL()};
    }, which);
    await seek(0, .35); await seek(1, .65);
    const first = await read(0), second = await read(1);
    assert.notEqual(first.state, second.state);
    await seek(1, .9); assert.deepEqual(await read(0), first, 'Second instance changed first clock/pixels');
    await seek(1, .65); assert.deepEqual(await read(1), second, 'Second instance reverse seek differs');
    await seek(0, .8); assert.deepEqual(await read(1), second, 'First instance changed second clock/pixels');
    await seek(0, .35); assert.deepEqual(await read(0), first, 'First instance reverse seek differs');
    await session.page.evaluate(() => document.getElementById('orb-independent-story').remove());
    assert.deepEqual(await read(0), first, 'Disposing second player changed first clock/pixels');
    row.states = [first.state, second.state]; checkRequests(session); row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); failures.push(row); console.error(`FAIL orb isolation: ${error.message}`); }
  finally { if (session) await session.close(); report.checks.push(row); }
}

async function orbShell() {
  const entry = catalogue.find(item => item.type === 'thinking-orb');
  if (!entry) return;
  const row = {name: 'orb-sidebar-variants-and-live-preview', passed: false};
  const page = await browser.newPage();
  try {
    await page.setViewport({width: 1600, height: 1100, deviceScaleFactor: 1});
    await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
    const url = new URL(BASE.endsWith('/') ? BASE : `${BASE}/`);
    url.searchParams.set('path', '/story/'+variants.get(`${entry.type}:${entry.variants[0].exportName}`).id);
    await page.goto(url.href, {waitUntil: 'domcontentloaded'});
    await page.waitForSelector('#storybook-preview-iframe');
    const preview = await (await page.$('#storybook-preview-iframe')).contentFrame();
    const runtime = await ready(preview);
    assert.equal(runtime.scene.state, entry.fields.state.values[0]);
    await page.waitForFunction(names => names.every(name => document.body.innerText.includes(name)), {}, entry.variants.map(variant => variant.name));
    row.screenshot = 'thinking-orb-storybook-shell.png';
    await page.screenshot({path: path.join(OUT, row.screenshot), fullPage: true});
    row.variants = entry.variants.map(variant => variant.name); row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); failures.push(row); console.error(`FAIL orb shell: ${error.message}`); }
  finally { await page.close(); report.checks.push(row); }
}

async function metalToolbar() {
  if (!themes.length) return;
  const row = {name: 'material-toolbar-preserves-brandbook-motion-and-cleanup', passed: false};
  let session;
  try {
    session = await openPage('island', {material: 'glass', brandbook: defaultBook});
    const initial = await ready(session.page), frames = new Map(), states = new Map();
    for (const [index, material] of [...MATERIALS, 'glass'].entries()) {
      if (index > 0) {
        await session.page.evaluate(material => {
          window.__previousStoryPlayer = document.querySelector('hyperframes-player');
          window.__STORYBOOK_ADDONS_CHANNEL__.emit(window.__STORYBOOK_MODULE_CORE_EVENTS__.UPDATE_GLOBALS,
            {globals: {material}});
        }, material);
        await session.page.waitForFunction(material => document.querySelector('hyperframes-player')?.iframeElement?.contentWindow.__storybookComponent?.film.material === material, {}, material);
        const old = await session.page.evaluate(() => ({connected: window.__previousStoryPlayer.isConnected, paused: window.__previousStoryPlayer.paused}));
        assert.deepEqual(old, {connected: false, paused: true}, 'Changing material must release the old player');
      }
      const runtime = await ready(session.page);
      assert.equal(runtime.material.type, material); assert.equal(runtime.look, 'glass');
      assert.deepEqual(runtime.brand, initial.brand, 'Material selection must preserve the full brandbook');
      assert.deepEqual(runtime.motion, initial.motion, 'Material selection must preserve the motion style');
      assert.deepEqual(runtime.plannedScene, initial.plannedScene, 'Material selection must preserve scene timing, colours and camera controls');
      await session.page.$eval('hyperframes-player', player => player.removeAttribute('controls'));
      const frame = await seekSnapshot(session.page, .65), native = await glassState(session.page);
      assert.equal(native.finish.kind, material);
      const samples = await session.page.evaluate(() => {
        const {instance} = document.querySelector('hyperframes-player').iframeElement.contentWindow.__storybookComponent;
        const {K} = instance.context;
        const canvas = K.glass.canvas, ctx = canvas.getContext('2d');
        const {corners} = K.glass.audit().surfaces[0];
        const x = corners.reduce((sum,c) => sum + c.x, 0) / corners.length;
        const y = corners.reduce((sum,c) => sum + c.y, 0) / corners.length;
        const centre = ctx.getImageData(Math.floor(x * canvas.width / K.W) - 3, Math.floor(y * canvas.height / K.H) - 3, 7, 7).data;
        let light = 0;
        for (let i = 0; i < centre.length; i += 4) light += .2126*centre[i] + .7152*centre[i+1] + .0722*centre[i+2];
        const heading = instance.root.querySelector('.pk-glass-heading');
        const style = heading.ownerDocument.defaultView.getComputedStyle(heading);
        const ink = style.color, font = style.fontFamily;
        const titleRect = heading.getBoundingClientRect(), canvasRect = canvas.getBoundingClientRect();
        const px = Math.floor((titleRect.x + titleRect.width / 2 - canvasRect.x) * canvas.width / canvasRect.width);
        const py = Math.floor((titleRect.y + titleRect.height / 2 - canvasRect.y) * canvas.height / canvasRect.height);
        const luma = rgb => {
          const [r,g,b] = [...rgb].map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
          return .2126*r + .7152*g + .0722*b;
        };
        const foreground = luma(ink.match(/[\d.]+/g).map(Number)), ground = luma(ctx.getImageData(px,py,1,1).data);
        const contrast = (Math.max(foreground,ground) + .05) / (Math.min(foreground,ground) + .05);
        return {light:light / (centre.length / 4), outside:[...ctx.getImageData(1,1,1,1).data], ink, font, contrast};
      });
      if (frames.has(material)) assert.deepEqual(frame.canvasHashes, frames.get(material), 'Returning to Glass must restore the original pixels');
      frames.set(material, frame.canvasHashes);
      const state = {camera: native.audit.camera, cards: native.audit.cards.map(({finish, ...geometry}) => geometry), surfaces: native.audit.surfaces};
      if (states.size) assert.deepEqual(state, states.get('glass').state, 'Material selection must preserve camera, geometry and projected copy');
      states.set(material, {state, ...samples});
    }
    assert.equal(new Set([...frames.values()].map(value => JSON.stringify(value))).size, MATERIALS.length, 'Every material must render distinct pixels');
    const clear = states.get('glass'), dark = states.get('dark-glass');
    if (dark) {
      assert.ok(dark.light < clear.light - 5, `Dark Glass must darken the panel centre at the same pose: ${dark.light} vs ${clear.light}`);
      assert.deepEqual(dark.outside, clear.outside, 'Dark Glass must leave the backdrop outside the surface intact');
      assert.equal(dark.ink, clear.ink, 'Switching to Dark Glass must retain the rendered brand ink');
      assert.equal(dark.font, clear.font, 'Switching to Dark Glass must retain the rendered brand font');
      assert.ok(dark.contrast >= 3, `The large heading must remain readable on the shaded panel: ${dark.contrast}:1`);
      row.darkGlassHeading = {ink:dark.ink, font:dark.font, contrast:dark.contrast};
      row.panelLuma = {glass:clear.light, darkGlass:dark.light};
    }
    assert.equal(await session.page.evaluate(() => document.querySelector('hyperframes-player').iframeElement.contentWindow.__storybookComponent.instance.root.querySelectorAll('canvas[data-metal]').length), 0, 'Shared Glass preview retained a legacy Metal overlay');
    row.materials = MATERIALS; row.brandbook = defaultBook; checkRequests(session); row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); failures.push(row); console.error(`FAIL material toolbar: ${error.message}`); }
  finally { if (session) await session.close(); report.checks.push(row); }
}

// Read the phase of the moving stripe at each sample. Its phase gives a lateral
// displacement even when smoke and highlights also change the pixel brightness.
async function measureDarkRefraction() {
  const {world} = await import('./dark-button-glass.mjs');
  const {canvas,scene} = world, ctx = canvas.getContext('2d'), canvasRect = canvas.getBoundingClientRect();
  const scale = canvas.width / canvasRect.width, period = canvas.width / 10;
  const phase = document.querySelector('#stripe-phase'), savedPhase = phase.value;
  const savedChoice = document.querySelector('input[name="backdrop"]:checked');
  const before = canvas.toDataURL(), steps = 20;
  const plates = ['sample-panel','sample-selection'].map((name,i) => {
    const group = scene.getObjectByName(name);
    const rect = document.querySelector('[data-glass-surface="'+i+'"]').getBoundingClientRect();
    // The rear scanline is below the inset, so each scan crosses just the edge being tested.
    return {name,group,visible:group.visible,clear:[],glass:[],
      y:Math.round((rect.y - canvasRect.y + rect.height*(i ? .50 : .70)) * scale),
      left:(rect.x-canvasRect.x)*scale,width:rect.width*scale,short:Math.min(rect.width,rect.height)*scale};
  });
  function read(plate, key) {
    const row = ctx.getImageData(0,plate.y,canvas.width,1).data;
    plate[key].push(Uint8Array.from({length:canvas.width},(_,x)=>row[4*x+1]));
  }
  try {
    document.querySelector('input[value="stripes"]').click();
    for (let step = 0; step < steps; step++) {
      phase.value = String(100 * step / steps);
      phase.dispatchEvent(new Event('input', {bubbles:true}));
      for (const plate of plates) read(plate,'glass');
      // Traced glass has no flat twin to compare with: the stripes it shows
      // are measured against the same stripes with no glass over them.
      for (const plate of plates) plate.group.visible=false;
      world.render(0);
      for (const plate of plates) {
        read(plate,'clear');
        plate.group.visible = true;
      }
    }
  } finally {
    for (const plate of plates) {
      plate.group.visible = plate.visible;
    }
    phase.value = savedPhase;
    phase.dispatchEvent(new Event('input', {bubbles:true}));
    savedChoice.click();
    world.render(0);
  }
  function signal(frames, x) {
    let cosine = 0, sine = 0;
    for (let i = 0; i < steps; i++) {
      const angle = 2 * Math.PI * i / steps, level = frames[i][x];
      cosine += level * Math.cos(angle);
      sine += level * Math.sin(angle);
    }
    return {angle:Math.atan2(sine,cosine), strength:Math.hypot(cosine,sine)*2/steps};
  }
  const median = a => a.sort((p,q)=>p-q)[Math.floor(a.length/2)];
  const layers = plates.map(plate => {
    const shifts = [], centreShifts = [], transmitted = [], outside = [];
    for (let x = 0; x < canvas.width; x++) {
      const normal = signal(plate.glass,x), clear = signal(plate.clear,x);
      const angle = normal.angle - clear.angle;
      const pixels = Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle))) * period / (2*Math.PI);
      const inset = x - plate.left;
      if (inset > .025 * plate.short && inset < .095 * plate.short) shifts.push(pixels);
      if (inset > .48 * plate.width && inset < .52 * plate.width) {
        centreShifts.push(pixels);
        transmitted.push(normal.strength / clear.strength);
      }
      if (x > .02 * canvas.width && x < .05 * canvas.width) outside.push(pixels);
    }
    return {name:plate.name, rimShift:median(shifts), centreShift:median(centreShifts),
      centreSignal:median(transmitted), outsideShift:Math.max(...outside)};
  });
  return {layers, restored:before===canvas.toDataURL()};
}

async function metalShell() {
  if (!themes.length) return;
  const row = {name: 'material-sidebar-variants-and-live-preview', passed: false};
  const page = await browser.newPage();
  try {
    await page.setViewport({width: 1600, height: 1100, deviceScaleFactor: 1});
    await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
    const theme = themes.find(theme => theme.type === 'island');
    const variant = theme.variants.find(variant => variant.globals.material === 'dark-glass') ?? theme.variants.at(-1);
    const url = new URL(BASE.endsWith('/') ? BASE : `${BASE}/`);
    url.searchParams.set('path', '/story/'+themeStories.get(`${theme.title}:${variant.exportName}`).id);
    await page.goto(url.href, {waitUntil: 'domcontentloaded'});
    await page.waitForSelector('#storybook-preview-iframe');
    const preview = await (await page.$('#storybook-preview-iframe')).contentFrame();
    const runtime = await ready(preview);
    assert.equal(runtime.look, 'glass');
    assert.equal(runtime.materialName, variant.globals.material);
    await page.waitForFunction(names => names.every(name => document.body.innerText.includes(name)), {}, theme.variants.map(variant => variant.name));
    row.screenshot = variant.globals.material+'-storybook-shell.png';
    await page.screenshot({path: path.join(OUT, row.screenshot), fullPage: true});
    if (themeStories.has(darkSpecimen)) {
      await page.goto(storyURL(undefined, {}, {}, themeStories.get(darkSpecimen)), {waitUntil: 'domcontentloaded'});
      const specimen = await (await page.waitForSelector('iframe[title="Dark Button Glass"]')).contentFrame();
      await specimen.waitForSelector('canvas[data-glass-time]');
      await specimen.click('input[name="backdrop"][value="black"]');
      row.darkButton = await specimen.evaluate(() => {
        const canvas = document.querySelector('canvas[data-glass-time]'), ctx = canvas.getContext('2d');
        // The reference is a fixed square. Scan across the outer crest and
        // the underside of the inset button on the actual rendered canvas.
        const crest = (x, y) => {
          const n = canvas.width, half = Math.ceil(n * .012);
          const pixels = ctx.getImageData(Math.round(n*x), Math.round(n*y)-half, 1, 2*half+1).data;
          let value = 0;
          for (let i=0;i<pixels.length;i+=4) value = Math.max(value, Math.min(pixels[i],pixels[i+1],pixels[i+2]));
          return value;
        };
        return {kind:JSON.parse(canvas.dataset.surfaceFinish).kind, layers:document.querySelectorAll('[data-glass-surface]').length,
          outer:crest(.28,.175), button:crest(.32,.40), field:crest(.05,.80)};
      });
      row.darkRefraction = await specimen.evaluate(measureDarkRefraction);
      assert.ok(row.darkRefraction.restored, 'Switching back from stripes must restore the black specimen');
      for (const layer of row.darkRefraction.layers) {
        assert.ok(layer.centreSignal > .25, `${layer.name} must visibly transmit the moving stripes: ${layer.centreSignal}`);
        assert.ok(layer.rimShift > 3 && layer.rimShift > 1.5 * layer.centreShift,
          `${layer.name} must bend the stripes more at its curved edge: ${JSON.stringify(layer)}`);
        assert.equal(layer.outsideShift, 0, 'Refraction must stay within the glass silhouette');
      }
      assert.equal(row.darkButton.kind, 'dark-glass');
      assert.equal(row.darkButton.layers, 2);
      assert.ok(row.darkButton.outer > 160 && row.darkButton.button > 160 && row.darkButton.field < 15,
        'The reference must show two distinct illuminated glass contours over black: ' + JSON.stringify(row.darkButton));
    }
    row.variants = theme.variants.map(variant => variant.name); row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); failures.push(row); console.error(`FAIL Metal shell: ${error.message}`); }
  finally { await page.close(); report.checks.push(row); }
}

async function brandbookInvariance() {
  const row = {name: 'brandbooks-and-stale-toolbar-globals', passed: false, books: []};
  let session;
  try {
    for (const [brandbook, book] of Object.entries(BRANDBOOKS)) {
      session = await openPage('island', {brandbook, material: 'metal',
        font: 'Missing Font', look: 'editorial', metalVariant: 'gold', brand: 'missing'},
        {brandName: 'Ignored name', brandBackground: '#999999', brandAccent: '#ff0000'});
      const runtime = await ready(session.page);
      assert.deepEqual(runtime.brand, book.brand, 'Stale globals and removed controls must not override a complete brandbook');
      assert.equal(runtime.materialName, 'metal'); assert.equal(runtime.look, 'glass');
      await seekSnapshot(session.page, .65);
      const native = await glassState(session.page);
      assert.equal(native.finish.kind, 'metal');
      assert.ok(native.surfaces.some(surface => surface.transform.startsWith('matrix3d(')), 'Brandbook text must remain attached to the shared panel');
      for (const copy of [runtime.scene.title, runtime.scene.body].filter(Boolean)) assert.ok(native.surfaces.some(surface => surface.text.includes(copy)));
      row.books.push({brandbook, brand: runtime.brand, finish: native.finish});
      checkRequests(session); await session.close(); session = null;
    }
    session = await openPage('controls', {brandbook: DEFAULT_BRANDBOOK, material: 'metal'});
    row.unbrandedControls = await checkSwitchMotion(session.page);
    checkRequests(session);
    if (MATERIALS.includes('dark-glass')) {
      await session.close();
      session = await openPage('controls', {brandbook: DEFAULT_BRANDBOOK, material: 'dark-glass'});
      row.unbrandedDarkControls = await checkSwitchMotion(session.page);
      assert.ok(row.unbrandedDarkControls.emptyHousing);
      checkRequests(session);
    }
    row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); failures.push(row); console.error(`FAIL brandbooks: ${error.message}`); }
  finally { if (session) await session.close(); report.checks.push(row); }
}

async function glassState(page) {
  return page.evaluate(() => {
    const player = document.querySelector('hyperframes-player');
    const {instance} = player.iframeElement.contentWindow.__storybookComponent;
    const canvas = instance.root.querySelector('canvas[data-glass]');
    return {
      mode: canvas?.dataset.glass,
      finish: canvas?.dataset.surfaceFinish ? JSON.parse(canvas.dataset.surfaceFinish) : null,
      textTexture: canvas?.dataset.glassTextTexture ? JSON.parse(canvas.dataset.glassTextTexture) : null,
      surfaces: [...instance.root.querySelectorAll('[data-glass-surface]')].map(node => ({
        transform: node.style.transform, text: node.textContent,
      })),
      audit: instance.context.K.glass?.audit?.() ?? null,
    };
  });
}

async function glassMotion(type, aspect) {
  const row = {name: 'glass-camera-projection-and-reverse-seek', type, aspect, passed: false};
  let session;
  try {
    session = await openPage(type, {aspect, material: 'glass'});
    await session.page.$eval('hyperframes-player', player => player.removeAttribute('controls'));
    const start = await seekSnapshot(session.page, .25), startState = await glassState(session.page);
    const hold = await seekSnapshot(session.page, .45), holdState = await glassState(session.page);
    const next = await seekSnapshot(session.page, .85), nextState = await glassState(session.page);
    assert.equal(holdState.mode, type, 'The native factory did not mount its Liquid Glass renderer');
    assert.ok(holdState.audit, 'The glass instance must expose its own auditable camera state');
    assert.notDeepEqual(next.canvasHashes, start.canvasHashes, 'The native clock did not change the glass pixels');
    if (type !== 'lens') {
      assert.ok(holdState.surfaces.some(surface => surface.transform.startsWith('matrix3d(')), 'Editable text is not projected onto glass');
      if (type === 'search') {
        assert.deepEqual(nextState.audit.camera, startState.audit.camera, 'Search keeps the field stationary while typing and loading');
      } else {
        assert.notDeepEqual(holdState.surfaces.map(surface => surface.transform), startState.surfaces.map(surface => surface.transform), 'The camera did not update the projected text');
      }
    } else {
      assert.ok(holdState.textTexture, 'Lens text must participate in the refracted render, not just sit above the canvas');
      assert.ok(JSON.stringify(holdState.textTexture).includes(catalogue.find(entry => entry.type === type).sample.text));
      // Glass, clear or smoked, traces its lens; metal covers the lettering.
      assert.equal(holdState.textTexture.mechanism, holdState.audit.cards[0].finish.kind === 'metal' ? 'opaque-metal' : 'traced-slab');
      assert.equal(holdState.textTexture.textureReady, true);
      assert.ok(holdState.textTexture.textureInkPixels > 0, 'The refraction texture contains no text ink');
    }
    const reverse = await seekSnapshot(session.page, .45), reverseState = await glassState(session.page);
    assert.equal(reverse.domHash, hold.domHash, 'Reverse seek changed the attached text or camera DOM');
    assert.deepEqual(reverse.canvasHashes, hold.canvasHashes, 'Reverse seek changed the glass render');
    assert.deepEqual(reverseState, holdState, 'Reverse seek changed the private camera/projection state');
    row.states = {start: startState, hold: holdState, next: nextState};
    if (type === 'send-prompt') {
      const macro = startState.audit.camera.position;
      const wide = nextState.audit.camera.position;
      assert.ok(wide[2] > 1.8 * macro[2], 'The camera must physically pull away from the composer');
      const width = state => state.audit.surfaces[0].corners[1].x - state.audit.surfaces[0].corners[0].x;
      assert.ok(width(startState) > 1.8 * width(nextState), 'The same panel must travel from close-up to a wide shot');
      assert.equal(startState.surfaces[0].text, nextState.surfaces[0].text);
    }
    if (type === 'glass-flow') {
      assert.ok(startState.audit.camera.position[2] > 0 && nextState.audit.camera.position[2] < 0,
        'The camera did not physically cross the first glass surface');
      assert.equal(nextState.audit.surfaces[0].opacity, 0, 'The first title must clear before the near-plane crossing');
      assert.ok(nextState.audit.surfaces[1].opacity > .99, 'The second title did not reach its readable hold');
      const frames = [];
      // Inspect both sides of the dive, plus the second title's readable hold.
      for (const fraction of [.45, .62, .66, .85]) {
        const frame = await seekSnapshot(session.page, fraction);
        const filename = `glass-flow-${aspect.replace(':', '-')}-${Math.round(fraction * 100)}.png`;
        await capture(session.page, filename);
        frames.push({time: frame.time, screenshot: filename, state: await glassState(session.page)});
      }
      row.frames = frames;
    }
    checkRequests(session); row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); row.diagnostics = error.diagnostics ?? (session && await session.diagnostics(error)); failures.push(row); console.error(`FAIL glass motion ${type}/${aspect}: ${error.message}`); }
  finally { if (session) await session.close(); report.checks.push(row); }
}

async function glassControlsAndCleanup() {
  const row = {name: 'glass-native-copy-camera-controls-and-cleanup', passed: false, cases: []};
  let session;
  try {
    for (const type of glassTypes) {
      session = await openPage(type, {aspect: '1:1', material: 'glass', brandbook: defaultBook});
      const copy = type === 'lens' ? {text: 'Light through glass', camera: 'orbit'}
        : type === 'island' ? {title: 'Glass in motion', body: 'Attached to the surface', camera: 'static', exit: 'collapse'}
          : type === 'controls' ? {title: 'Controls in motion', slider: '', camera: 'static'}
          : type === 'ask' ? {text: 'Which day?', reply: 'Tuesday', camera: 'static'}
          : type === 'search' ? {query: 'Thursday workshops', timing: {search: 2.5, collapse: 4, collapsed: 5, checked: 5.65}}
          : type === 'send-prompt' ? {text: 'Check with @Mira', chips: ['Inbox', 'Notes'], timing: {pull: 3, landed: 6}}
          : type === 'glass-steps' ? {title: 'Three steps', items: ['Shoot it', 'Cut it', 'Share it'], camera: 'static'}
          : {title: 'First surface', nextTitle: 'Next surface', nextBody: 'One continuous camera'};
      await session.page.evaluate(({id, copy}) => {
        window.__previousStoryPlayer = document.querySelector('hyperframes-player');
        window.__STORYBOOK_ADDONS_CHANNEL__.emit(window.__STORYBOOK_MODULE_CORE_EVENTS__.UPDATE_STORY_ARGS,
          {storyId: id, updatedArgs: copy});
      }, {id: stories.get(type).id, copy});
      await session.page.waitForFunction(() => document.querySelector('hyperframes-player') !== window.__previousStoryPlayer);
      const current = await ready(session.page);
      for (const [name, value] of Object.entries(copy)) assert.deepEqual(current.scene[name], value === '' ? undefined : value, 'Controls did not update the production recipe');
      assert.deepEqual(current.brand, selectedBrand); assert.deepEqual(current.font, selectedBrand.font);
      const cleanup = await session.page.evaluate(() => ({connected: window.__previousStoryPlayer.isConnected, paused: window.__previousStoryPlayer.paused}));
      assert.deepEqual(cleanup, {connected: false, paused: true});
      const frame = await seekSnapshot(session.page, ['glass-flow', 'ask'].includes(type) ? .85 : .45);
      for (const name of ['title', 'body', 'nextTitle', 'nextBody', 'query']) if (copy[name]) assert.ok(frame.text.includes(copy[name]), `Edited ${name} disappeared`);
      const state = await glassState(session.page);
      if (type === 'search') row.editedSearchCollapse = await checkSearchCollapse(session.page);
      if (type === 'controls') {
        const slider = await session.page.evaluate(() => {
          const {instance} = document.querySelector('hyperframes-player').iframeElement.contentWindow.__storybookComponent;
          return {slots: instance.root.querySelectorAll('[role="progressbar"]').length,
            meshes: instance.context.K.glass.inspect().scene.getObjectsByProperty('name', 'liquid-slider').length};
        });
        assert.deepEqual(slider, {slots: 0, meshes: 0}, 'Removing the optional slider must remove its visual and semantic controls');
      }
      if (type === 'ask' || type === 'send-prompt') {
        for (const text of [copy.text, copy.reply, ...(copy.chips ?? [])].filter(Boolean)) {
          assert.ok(state.surfaces.some(surface => surface.text.includes(text) && surface.transform.startsWith('matrix3d(')),
            `Edited ask copy must be projected onto the glass: ${text}`);
        }
      }
      if (type === 'lens') {
        assert.equal(state.textTexture.text, copy.text, 'Edited text did not rebuild the refracted texture');
        assert.ok(state.textTexture.sourceFont.includes(selectedFont), 'The brandbook font did not reach the refracted texture');
      }
      if (type === 'island') {
        await seekSnapshot(session.page, .96);
        const collapsed = await glassState(session.page);
        assert.ok(collapsed.audit.cards[0].width < state.audit.cards[0].width
          && collapsed.audit.cards[0].height < state.audit.cards[0].height, 'Collapse control did not shrink the glass into a capsule');
      }
      row.cases.push({type, copy, cleanup, state});
      checkRequests(session); await session.close(); session = null;
    }
    row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); row.diagnostics = error.diagnostics ?? (session && await session.diagnostics(error)); failures.push(row); console.error(`FAIL glass controls: ${error.message}`); }
  finally { if (session) await session.close(); report.checks.push(row); }
}

async function glassIsolation() {
  const row = {name: 'glass-player-clocks-and-disposal', passed: false};
  let session;
  try {
    session = await openPage('glass-flow', {aspect: '1:1', material: 'glass'});
    await session.page.evaluate(() => {
      const first = document.querySelector('pk-component-story'), second = document.createElement('pk-component-story');
      second.id = 'glass-independent-story';
      // Both stories must be visible: hidden previews intentionally stay unmounted.
      second.style.cssText = 'position:fixed;right:0;top:0;width:42vw;z-index:10';
      second.input = {...first.input, args: {...first.input.args, title: 'Independent glass', nextTitle: 'Separate camera'}};
      first.after(second);
    });
    await session.page.waitForFunction(() => {
      const host = document.getElementById('glass-independent-story'), player = host?.querySelector('hyperframes-player');
      return host?.dataset.state === 'ready' && player?.painted && player.iframeElement?.contentWindow.__storybookComponent?.instance;
    });
    const seek = async (which, fraction) => {
      const time = await session.page.evaluate(({which, fraction}) => {
        const player = document.querySelectorAll('pk-component-story')[which].querySelector('hyperframes-player');
        player.pause(); const time = Math.floor(player.duration * fraction * 30) / 30; player.seek(time); return time;
      }, {which, fraction});
      await session.page.waitForFunction(({which, time}) => {
        const player = document.querySelectorAll('pk-component-story')[which].querySelector('hyperframes-player');
        return Math.abs(player.iframeElement.contentWindow.__storybookComponent.instance.localTime - time) < .00002;
      }, {}, {which, time});
    };
    const read = which => session.page.evaluate(which => {
      const player = document.querySelectorAll('pk-component-story')[which].querySelector('hyperframes-player');
      const {instance} = player.iframeElement.contentWindow.__storybookComponent;
      return {time: instance.localTime, title: instance.ps.scene.title,
        audit: instance.context.K.glass.audit(), pixels: instance.root.querySelector('canvas[data-glass]').toDataURL()};
    }, which);
    await seek(0, .35); await seek(1, .85);
    const first = await read(0), second = await read(1);
    assert.notEqual(first.title, second.title);
    await seek(1, .15); assert.deepEqual(await read(0), first, 'Second glass player changed the first');
    await seek(1, .85); assert.deepEqual(await read(1), second, 'Second glass reverse seek differs');
    await session.page.evaluate(() => document.getElementById('glass-independent-story').remove());
    await seek(0, .75); await seek(0, .35);
    assert.deepEqual(await read(0), first, 'Removing one player broke the remaining glass world');
    row.titles = [first.title, second.title]; checkRequests(session); row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); failures.push(row); console.error(`FAIL glass isolation: ${error.message}`); }
  finally { if (session) await session.close(); report.checks.push(row); }
}

async function glassShell() {
  const row = {name: 'glass-sidebar-and-continuous-camera-preview', passed: false};
  const page = await browser.newPage();
  try {
    await page.setViewport({width: 1600, height: 1100, deviceScaleFactor: 1});
    await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
    const url = new URL(BASE.endsWith('/') ? BASE : `${BASE}/`);
    url.searchParams.set('path', '/story/'+stories.get('glass-flow').id);
    url.searchParams.set('globals', 'material:glass');
    await page.goto(url.href, {waitUntil: 'domcontentloaded'});
    await page.waitForSelector('#storybook-preview-iframe');
    const preview = await (await page.$('#storybook-preview-iframe')).contentFrame();
    const runtime = await ready(preview);
    assert.equal(runtime.type, 'glass-flow');
    await seekSnapshot(preview, .85);
    await page.waitForFunction(names => names.every(name => document.body.innerText.includes(name)), {}, glassTypes);
    row.screenshot = 'glass-storybook-shell.png';
    await page.screenshot({path: path.join(OUT, row.screenshot), fullPage: true});
    row.components = glassTypes; row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); failures.push(row); console.error(`FAIL glass shell: ${error.message}`); }
  finally { await page.close(); report.checks.push(row); }
}

async function askOnTheBeat() {
  const row = {name: 'ask-action-and-sound-on-the-beat', passed: false};
  let session;
  try {
    session = await openPage('ask', {}, {}, variants.get('ask:OnTheBeat'));
    await ready(session.page);
    const sample = await session.page.evaluate(() => {
      const win = document.querySelector('hyperframes-player').iframeElement.contentWindow;
      const {instance, plan} = win.__storybookComponent;
      const prompt = win.document.querySelector('[data-typing-id="ask-prompt"]');
      const reply = win.document.querySelector('.pk-glass-ask-reply');
      const button = instance.context.K.glass.inspect().scene.getObjectByName('ask-send-button');
      function at(seconds) {
        instance.drawAt(seconds);
        return {letters: Number(prompt.dataset.typingCount), scale: button.scale.x, reply: Number(reply.style.opacity)};
      }
      return {
        start: at(.5), typing: at(.9), typed: at(1.25),
        send: at(1.5), pressed: at(1.65), beforeReply: at(1.99), reply: at(2.08), reverse: at(1.65),
        click: plan.audioEvents.find(event => event.kind === 'click' && event.strength === .9)?.t,
        length: [...instance.ps.scene.text].length,
      };
    });
    assert.equal(sample.start.letters, 0);
    assert.ok(sample.typing.letters > 0 && sample.typing.letters < sample.length);
    assert.equal(sample.typed.letters, sample.length);
    assert.equal(sample.click, 1.5);
    assert.ok(sample.pressed.scale < sample.send.scale);
    assert.equal(sample.beforeReply.reply, 0);
    assert.ok(sample.reply.reply > 0);
    assert.deepEqual(sample.reverse, sample.pressed);
    checkRequests(session); row.passed = true;
  } catch (error) { row.error = String(error.stack ?? error); failures.push(row); console.error(`FAIL beat timing: ${error.message}`); }
  finally { if (session) await session.close(); report.checks.push(row); }
}

try {
  const chosen = (METAL ? [] : GLASS ? glassFamily : ALL ? catalogue.map(entry => entry.type) : QUICK).filter(type => !ONLY || ONLY.includes(type));
  for (const type of chosen) {
    for (const aspect of FORMATS) await runCase(type, aspect);
    console.log(`${type}: ${report.cases.filter(row => row.type === type && row.passed).length}/3 formats passed`);
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2)+'\n');
  }
  for (const entry of catalogue.filter(entry => !METAL && (!GLASS || glassTypes.includes(entry.type)) && entry.variants.length && (!ONLY || ONLY.includes(entry.type)))) {
    for (const variant of entry.variants) for (const aspect of FORMATS) await runCase(entry.type, aspect, variant);
    console.log(`${entry.type}: ${entry.variants.length} named variants checked in all three formats`);
  }
  for (const theme of GLASS || ONLY ? [] : themes) {
    for (const variant of theme.variants) for (const aspect of FORMATS) {
      if (!METAL_CASE || `${theme.type}/${aspect}/${variant.globals.material}` === METAL_CASE) await runCase(theme.type, aspect, {...variant, id: themeStories.get(`${theme.title}:${variant.exportName}`).id});
    }
    if (!METAL_CASE) console.log(`${theme.title}: ${theme.variants.length} material variants checked in all three formats`);
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2)+'\n');
  }
  if (!METAL && !GLASS) {
    await controlsAndCleanup();
    await orbIsolation();
    await orbShell();
  }
  if (!METAL && glassTypes.includes('glass-flow')) {
    for (const type of glassTypes) for (const aspect of FORMATS) await glassMotion(type, aspect);
    await glassControlsAndCleanup();
    await glassIsolation();
    await glassShell();
    if (variants.has('ask:OnTheBeat')) await askOnTheBeat();
  }
  if (!METAL_CASE && !GLASS) {
    await metalToolbar();
    await brandbookInvariance();
    await metalShell();
  }
  report.passed = failures.length === 0;
} finally {
  await browser.close();
  report.completedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2)+'\n');
}
console.log(`${report.cases.filter(row => row.passed).length}/${report.cases.length} component cases; ${report.checks.filter(row => row.passed).length}/${report.checks.length} integration checks passed. ${path.join(OUT, 'report.json')}`);
process.exitCode = report.passed ? 0 : 1;
// Keep connected-scene coverage in the same required CI command as components.
if (report.passed) await import('./sequence-browser.mjs');
if (!process.exitCode) await import('./folio-browser.mjs');
if (!process.exitCode) await import('./folio-manager-browser.mjs');
