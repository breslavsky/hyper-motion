// Exercise the actual Storybook manager, toolbar and nested native Folio player.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';
import {BRANDBOOKS} from '../src/model.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';
const OUT = path.resolve(process.env.STORYBOOK_TEST_RESULTS ?? path.join(HERE, 'test-results'), 'folio-manager');
const STORY = 'pure-kinetic-sequences-folio--continuous';
const FORMATS = {landscape: [1920, 1080], portrait: [1080, 1920], square: [1080, 1080]};
const TOOLBARS = {aspect: 'Composition aspect ratio', brandbook: 'Brand colors and font', material: 'Surface material for 3D Liquid Glass components'};
const selector = key => `[role="toolbar"] button[aria-label^="${TOOLBARS[key]}"]`;
const url = relative => new URL(relative, BASE.endsWith('/') ? BASE : `${BASE}/`);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const executablePath = process.env.CHROME_BIN ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(file => fs.existsSync(file));
assert.ok(executablePath, 'Chrome not found: set CHROME_BIN');
fs.mkdirSync(OUT, {recursive: true});
const report = {url: BASE, story: STORY, startedAt: new Date().toISOString(), cases: [], checks: [], passed: false};
const writeReport = () => fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2)+'\n');

function managerURL(format, story = STORY) {
  const target = url(''); target.searchParams.set('path', `/story/${story}`);
  // Folio overrides these globals for itself; ordinary components must retain
  // the user's original selections after leaving the authored production.
  target.searchParams.set('globals', `aspect:${format};brandbook:poster;material:metal`);
  return target.href;
}

async function fetchIndex() {
  const deadline = performance.now()+10000;
  for (;;) {
    try {
      const response = await fetch(url('index.json'), {signal: AbortSignal.timeout(2000)});
      if (response.status === 503 && performance.now() < deadline) { await wait(200); continue; }
      assert.ok(response.ok, `Storybook index returned HTTP ${response.status}`); return await response.json();
    } catch (error) {
      const transport = error instanceof TypeError || ['TimeoutError', 'AbortError'].includes(error.name);
      if (!transport || performance.now() >= deadline) throw error;
      await wait(200);
    }
  }
}

async function previewFrame(page) {
  const iframe = await page.waitForSelector('#storybook-preview-iframe');
  const frame = await iframe.contentFrame(); assert.ok(frame, 'Storybook preview frame is absent');
  await frame.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('pk-component-story')?.dataset.state));
  const host = await frame.$eval('pk-component-story', node => ({state: node.dataset.state, error: node.querySelector('[role=alert]')?.textContent}));
  assert.equal(host.state, 'ready', host.error ?? 'Story did not become ready');
  await frame.waitForFunction(() => {
    const player = document.querySelector('hyperframes-player');
    return player?.ready && player.assetsReady && player.painted && player.iframeElement?.contentWindow.__renderReady === true;
  });
  return {iframe, frame};
}

async function folioState(frame) {
  return frame.evaluate(() => {
    const player = document.querySelector('hyperframes-player'), win = player.iframeElement.contentWindow;
    const instance = win.document.querySelector('[data-sequence-root="document-flow"]')?.documentFlow;
    if (!instance) throw new Error('The native Folio world is absent');
    return {dimensions: [player.compositionWidth, player.compositionHeight], paused: player.paused, muted: player.muted,
      aspect: instance.plan.aspect, font: instance.plan.brand.font, phase: instance.state.phase, time: instance.state.time,
      colors: instance.plan.brand, nativeErrors: win.__hfStartupError ? [win.__hfStartupError] : []};
  });
}

async function toolbarState(page, key) {
  return page.$eval(selector(key), node => ({text: node.textContent, ariaDisabled: node.getAttribute('aria-disabled'),
    disabled: node.disabled, expanded: node.getAttribute('aria-expanded')}));
}

async function lockedToolbar(page, frame) {
  const expected = {brandbook: 'Brandbook', material: '3D material'}, result = {};
  await frame.evaluate(() => { window.__lockedFolioPlayer = document.querySelector('hyperframes-player'); });
  for (const [key, label] of Object.entries(expected)) {
    const before = await toolbarState(page, key); assert.equal(before.text, label);
    assert.equal(before.ariaDisabled, 'true', `Folio ${key} must be explicitly locked`);
    await page.click(selector(key));
    const after = await toolbarState(page, key);
    assert.equal(after.text, label); assert.equal(after.expanded, 'false', `Clicking locked ${key} must not open a preset menu`);
    assert.equal(await page.$('[role="listbox"]'), null);
    result[key] = after;
  }
  assert.ok(await frame.evaluate(() => document.querySelector('hyperframes-player') === window.__lockedFolioPlayer), 'A locked toolbar click rebuilt Folio');
  assert.equal((await folioState(frame)).font, 'Geist Mono');
  return result;
}

async function visibleControls(page, iframe, frame) {
  const frameBox = await iframe.boundingBox(); assert.ok(frameBox);
  const boxes = await frame.evaluate(() => {
    const box = node => { const rect = node.getBoundingClientRect(); return {text: node.textContent, x: rect.x, y: rect.y,
      width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom, disabled: node.disabled}; };
    return {width: innerWidth, height: innerHeight, scrollY, horizontal: document.documentElement.scrollWidth > innerWidth,
      sound: [...document.querySelectorAll('[data-action="play-with-sound"]')].map(box),
      phases: [...document.querySelectorAll('.pk-sequence-nav button[data-scene-index]')].map(node => ({...box(node), index: Number(node.dataset.sceneIndex)}))};
  });
  assert.equal(boxes.sound.length, 1); assert.deepEqual(boxes.phases.map(button => button.index), [0,1,2,3,4]);
  assert.equal(boxes.scrollY, 0); assert.equal(boxes.horizontal, false);
  for (const button of [...boxes.sound, ...boxes.phases]) {
    assert.ok(!button.disabled && button.width > 0 && button.height > 0, `Control is unavailable: ${button.text}`);
    assert.ok(button.x >= 0 && button.y >= 0 && button.right <= frameBox.width+1 && button.bottom <= frameBox.height+1,
      `Control needs scrolling in the manager: ${JSON.stringify({frameBox, button})}`);
  }
  const panels = await page.$$eval('[role="tabpanel"], [role="tab"]', nodes => nodes.filter(node => {
    const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }).map(node => node.id));
  assert.deepEqual(panels, [], 'Folio must not show an empty addon panel');
  return {frameBox, ...boxes, panels};
}

let browser, page, closing = false;
const errors = [], requests = [];
try {
  const index = await fetchIndex(); assert.ok(index.entries[STORY]);
  const ordinary = Object.values(index.entries).find(entry => entry.exportName === 'Preview' && entry.title.endsWith('/title'));
  assert.ok(ordinary, 'Ordinary title component is absent');
  browser = await puppeteer.launch({executablePath, headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage']});
  page = await browser.newPage(); page.setDefaultTimeout(40000);
  await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) requests.push({url: response.url(), status: response.status()}); });
  page.on('requestfailed', request => {
    if (!closing && request.failure()?.errorText !== 'net::ERR_ABORTED') requests.push({url: request.url(), error: request.failure()?.errorText});
  });
  await page.setViewport({width: 1440, height: 900, deviceScaleFactor: 1});
  await page.goto(managerURL('landscape'), {waitUntil: 'domcontentloaded'});
  for (const [index, format] of Object.keys(FORMATS).entries()) {
    await page.setViewport({width: format === 'portrait' ? 1100 : 1440, height: 900, deviceScaleFactor: 1});
    if (index) {
      const {frame} = await previewFrame(page);
      await frame.evaluate(() => { window.__previousFolioPlayer = document.querySelector('hyperframes-player'); });
      assert.notEqual((await toolbarState(page, 'aspect')).ariaDisabled, 'true');
      await page.click(selector('aspect'));
      const option = await page.waitForSelector(`[role="option"][id$="-opt-${format}"]`); await option.click();
      await frame.waitForFunction(() => document.querySelector('hyperframes-player') !== window.__previousFolioPlayer);
      await page.waitForSelector('[role="listbox"]', {hidden: true});
    }
    const {iframe, frame} = await previewFrame(page), state = await folioState(frame);
    assert.deepEqual(state.dimensions, FORMATS[format]); assert.ok(state.paused && state.muted);
    assert.deepEqual(state.nativeErrors, []);
    const row = {format, state, controls: await visibleControls(page, iframe, frame), toolbar: await lockedToolbar(page, frame)};
    await frame.click('.pk-sequence-nav button[data-scene-index="3"]');
    await frame.waitForFunction(() => document.querySelector('hyperframes-player').iframeElement.contentWindow.document
      .querySelector('[data-sequence-root="document-flow"]').documentFlow.state.phase === 'create');
    row.screenshot = `manager-${format}.png`; await page.screenshot({path: path.join(OUT, row.screenshot)});
    row.passed = true; report.cases.push(row); writeReport(); console.log(`Folio manager ${format}: pass`);
  }

  // Navigate inside the live manager/preview documents. A page reload with
  // explicit globals could hide a leaked story override or addon-panel state.
  const previous = await previewFrame(page);
  await page.evaluate(() => { window.__folioManagerDocument = document; });
  await previous.frame.evaluate(() => {
    window.__folioPreviewDocument = document;
    window.__leavingFolioPlayer = document.querySelector('hyperframes-player');
  });
  const componentId = ordinary.id.split('--')[0], familyId = componentId.slice(0, componentId.lastIndexOf('-'));
  for (const id of [familyId, componentId]) {
    const group = await page.waitForSelector(`button[id="${id}"]`);
    if (await group.evaluate(node => node.getAttribute('aria-expanded') !== 'true')) await group.click();
  }
  const storyLink = await page.waitForSelector(`a[id="${ordinary.id}"]`); await storyLink.click();
  await page.waitForFunction(id => new URL(location.href).searchParams.get('path') === `/story/${id}`, {}, ordinary.id);
  await previous.frame.waitForFunction(() => {
    const player = document.querySelector('hyperframes-player');
    return player !== window.__leavingFolioPlayer && player?.ready && player.assetsReady && player.painted
      && Boolean(player.iframeElement?.contentWindow.__storybookComponent);
  });
  const {frame} = await previewFrame(page);
  assert.ok(await page.evaluate(() => document === window.__folioManagerDocument), 'Story navigation reloaded the manager document');
  assert.ok(await frame.evaluate(() => document === window.__folioPreviewDocument), 'Story navigation reloaded the preview document');
  assert.ok(await frame.evaluate(() => !window.__leavingFolioPlayer.isConnected && window.__leavingFolioPlayer.paused), 'Leaving Folio did not detach and pause its player');
  await page.waitForSelector('[role="tab"][id$="-tab-addon-controls"]', {visible: true});
  const restored = await frame.evaluate(() => {
    const component = document.querySelector('hyperframes-player').iframeElement.contentWindow.__storybookComponent;
    return {font: component.plan.brand.font, tokens: component.plan.brand.tokens, type: component.instance.ps.scene.type};
  });
  assert.equal(restored.type, 'title'); assert.equal(restored.font, BRANDBOOKS.poster.brand.font);
  assert.deepEqual(restored.tokens, BRANDBOOKS.poster.brand.tokens);
  const toolbar = {};
  // A flat component such as the title pins its own material, so only the
  // brandbook is open to choose there.
  const expectedToolbar = {brandbook: BRANDBOOKS.poster.label};
  for (const [key, text] of Object.entries(expectedToolbar)) {
    toolbar[key] = await toolbarState(page, key);
    assert.equal(toolbar[key].text, text);
    assert.notEqual(toolbar[key].ariaDisabled, 'true'); assert.equal(toolbar[key].disabled, false);
    await page.click(selector(key)); await page.waitForSelector('[role="option"]', {visible: true});
    assert.ok((await page.$$('[role="option"]')).length > 1, `Ordinary ${key} choices are unavailable`);
    await page.keyboard.press('Escape'); await page.waitForSelector('[role="listbox"]', {hidden: true});
  }
  report.checks.push({name: 'ordinary-title-restores-globals-and-controls', restored, toolbar, passed: true});
  assert.deepEqual(errors, [], 'A browser error occurred'); assert.deepEqual(requests, [], 'A manager or native asset failed to load');
  report.passed = report.cases.length === 3 && report.checks.length === 1;
} catch (error) {
  report.error = String(error.stack ?? error); console.error(report.error);
  if (page) {
    try { report.failureURL = page.url(); await page.screenshot({path: path.join(OUT, 'failure.png'), fullPage: true}); }
    catch (captureError) { report.captureError = String(captureError); }
    try { report.failureToolbar = await page.$$eval('[role="toolbar"] button', nodes => nodes.map(node => ({text: node.textContent,
      label: node.getAttribute('aria-label'), disabled: node.disabled, ariaDisabled: node.getAttribute('aria-disabled')}))); }
    catch (captureError) { report.toolbarError = String(captureError); }
  }
} finally {
  closing = true; await browser?.close(); report.errors = errors; report.requests = requests;
  report.completedAt = new Date().toISOString(); writeReport();
}
console.log(`${report.cases.length}/3 Folio manager formats; ${report.checks.length}/1 restore checks. ${path.join(OUT, 'report.json')}`);
process.exitCode = report.passed ? 0 : 1;
