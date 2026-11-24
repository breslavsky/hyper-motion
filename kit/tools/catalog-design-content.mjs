// Native proof that measured pages/windows expose every supplied entry.
// This is a test adapter: it never replaces the HyperFrames clock or renderer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser, sourceHashes, SOURCE} from './migration-browser.mjs';
import {maximumScene} from './quality-layout.mjs';
import metadata from '../source/lib/components/metadata.mjs';

export const TYPES = ['web', 'callouts', 'chat', 'notify', 'scan', 'agent', 'slam'];
export const ASPECTS = ['9:16', '1:1', '16:9'];
const plain = value => String(value ?? '').replaceAll('*', '').replace(/\s+/g, ' ').trim();

export function targetsFor(scene) {
  const targets = [];
  const add = (id, selector, index, expected, leafRole = false) => {
    if (expected) targets.push({id, selector, index, expected: plain(expected), leafRole});
  };
  const list = (field, selector, values, leafRole = false) => values.forEach((value, index) => add(`${field}.${index}`, selector, index, value, leafRole));
  switch (scene.type) {
    case 'web': list('words', '[data-design-role="caption"]', scene.words); break;
    case 'callouts':
      add('title', '[data-design-role="sceneTitle"]', 0, scene.title);
      list('notes', '[data-design-role="caption"]', scene.notes);
      break;
    case 'chat': list('messages', '[data-design-role="body"]', scene.messages.map(message => message.text)); break;
    case 'notify':
      list('app', '[data-design-role="meta"]', scene.items.map(item => item.app.toUpperCase()));
      list('title', '[data-design-role="cardTitle"]', scene.items.map(item => item.title));
      list('body', '[data-design-role="body"]', scene.items.map(item => item.body));
      break;
    case 'scan':
      add('title', '[data-scan-root] > [data-design-role="sceneTitle"]', 0, scene.title);
      scene.categories.forEach((copy, index) => add(`categories.${index}`, `[data-scan-category="${index}"] [data-design-role="controlLabel"]`, 0, copy));
      scene.items.forEach((item, index) => add(`items.${index}`, `[data-scan-tag="${index}"] [data-design-role="label"]`, 0, item.label));
      add('scanning', '[data-scan-status] [data-design-role="label"]', 0, scene.scanning);
      add('complete', '[data-scan-status] [data-design-role="label"]', scene.scanning ? 1 : 0, scene.complete);
      break;
    case 'agent':
      list('steps', '[data-design-role="body"]', scene.steps, true);
      add('done', '[data-design-role="caption"]', 0, scene.done);
      add('result', '[data-design-role="cardTitle"]', 1, scene.result);
      break;
    case 'slam':
      list('lines', '[data-design-role="hero"]', scene.lines);
      list('crumbs', '[data-design-role="label"]', scene.crumbs ?? []);
      break;
    default: throw new Error(`No content contract for ${scene.type}`);
  }
  return targets;
}

// Duplicate maximum strings are deliberately preserved. Each target is bound
// by its own DOM identity and field index, so one copy cannot stand in for six.
function bindTargets(specs, hideTarget) {
  const root = window.__pkScenes.s1.sceneRoot;
  window.__catalogContentTargets = specs.map(spec => {
    let candidates = [...root.querySelectorAll(spec.selector)];
    if (spec.leafRole) candidates = candidates.filter(node => !node.querySelector('[data-design-role]'));
    const node = candidates[spec.index];
    if (!node) throw new Error(`Missing content node ${spec.id}: ${spec.selector}[${spec.index}]`);
    return {spec, node};
  });
  if (hideTarget !== undefined) window.__catalogContentTargets[hideTarget].node.style.setProperty('visibility', 'hidden', 'important');
}

function measureContent({minimumOpacity}) {
  const root = window.__pkScenes.s1.sceneRoot, frame = root.getBoundingClientRect();
  const round = value => Math.round(value * 1e6) / 1e6;
  const canvas = document.createElement('canvas'), paint = canvas.getContext('2d'), metrics = new Map();
  const calibration = document.createElement('span');
  calibration.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;white-space:pre;transform:none';
  document.body.appendChild(calibration);
  const opacityOf = node => {
    let opacity = 1;
    for (let parent = node; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden') return 0;
      opacity *= Number(style.opacity);
    }
    return opacity;
  };
  const measure = ({spec, node}) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), parts = [], ink = [];
    const ellipsisLeaves=new Set(),invalidEllipsis=[];
    let minimum = 1, area = 0, visibleArea = 0;
    while (walker.nextNode()) {
      const text = walker.currentNode, parent = text.parentElement;
      if (parent.closest('[data-deco],.deco,.ghost,svg')) continue;
      parts.push(text.textContent);
      if (!text.textContent.trim()) continue;
      minimum = Math.min(minimum, opacityOf(parent));
      const style = getComputedStyle(parent);
      const key = [style.fontFamily, style.fontSize, style.fontWeight, style.fontStyle, style.fontStretch].join('|');
      if (!metrics.has(key)) {
        for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontVariationSettings']) calibration.style[property] = style[property];
        calibration.textContent = 'Hg';
        const marker = document.createElement('span');
        marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
        calibration.append(marker);
        const probe = document.createRange(); probe.selectNodeContents(calibration.firstChild);
        const bounds = probe.getBoundingClientRect();
        metrics.set(key, {height: bounds.height, baseline: marker.getBoundingClientRect().y - bounds.y});
      }
      const metric = metrics.get(key);
      paint.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      paint.fontStretch = style.fontStretch;
      const glyph = paint.measureText(text.textContent);
      const label=parent.closest('[data-design-overflow]');
      let ellipsis=null;
      if(label&&(label===node||node.contains(label))){
        const s=getComputedStyle(label),lineHeight=parseFloat(s.lineHeight);
        const paddingY=parseFloat(s.paddingTop)+parseFloat(s.paddingBottom);
        const valid=label.dataset.designOverflow==='ellipsis'&&s.whiteSpace==='nowrap'&&s.textOverflow==='ellipsis'
          &&['hidden','clip'].includes(s.overflowX)&&['hidden','clip'].includes(s.overflowY)
          &&!['inline','flex','inline-flex','grid','inline-grid'].includes(s.display)
          &&label.children.length===0&&!label.closest('.glyph,[data-typing-host],[data-typing-id]')
          &&s.clipPath==='none'&&s.maskImage==='none'&&Number.isFinite(lineHeight)&&lineHeight>0
          &&label.clientWidth>0&&Math.abs(label.clientHeight-paddingY-lineHeight)<=1&&label.scrollHeight<=label.clientHeight+1;
        if(valid)ellipsis=label;else invalidEllipsis.push(spec.id);
      }
      let clip = {left: frame.left, top: frame.top, right: frame.right, bottom: frame.bottom};
      for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) {
        const current = getComputedStyle(ancestor);
        if (current.overflowX !== 'visible' || current.overflowY !== 'visible') {
          const bounds = ancestor.getBoundingClientRect();
          clip = {left: Math.max(clip.left, bounds.left), top: Math.max(clip.top, bounds.top), right: Math.min(clip.right, bounds.right), bottom: Math.min(clip.bottom, bounds.bottom)};
        }
      }
      if(ellipsis){
        if(ellipsisLeaves.has(ellipsis))continue;
        ellipsisLeaves.add(ellipsis);
        // CSS paints the suffix ellipsis inside this viewport. DOM completeness
        // is still checked against the original field; ancestors/frame must
        // expose the whole viewport, not merely a surviving piece of its text.
        const bounds=ellipsis.getBoundingClientRect(),box={x:bounds.x,y:bounds.y,w:bounds.width,h:bounds.height};
        ink.push(Object.fromEntries(Object.entries(box).map(([name,value])=>[name,round(value)])));
        area+=box.w*box.h;
        visibleArea+=Math.max(0,Math.min(box.x+box.w,clip.right)-Math.max(box.x,clip.left))
          *Math.max(0,Math.min(box.y+box.h,clip.bottom)-Math.max(box.y,clip.top));
        continue;
      }
      const range = document.createRange(); range.selectNodeContents(text);
      for (const bounds of range.getClientRects()) {
        if (bounds.width < .1 || bounds.height < .1) continue;
        const scale = bounds.height / metric.height;
        const box = {x: bounds.x, y: bounds.y + (metric.baseline - glyph.actualBoundingBoxAscent) * scale,
          w: bounds.width, h: (glyph.actualBoundingBoxAscent + glyph.actualBoundingBoxDescent) * scale};
        ink.push(Object.fromEntries(Object.entries(box).map(([name, value]) => [name, round(value)])));
        area += box.w * box.h;
        visibleArea += Math.max(0, Math.min(box.x + box.w, clip.right) - Math.max(box.x, clip.left)) * Math.max(0, Math.min(box.y + box.h, clip.bottom) - Math.max(box.y, clip.top));
      }
    }
    const text = parts.join('').replace(/\s+/g, ' ').trim();
    const seen = area ? visibleArea / area : 0;
    return {id: spec.id, text, opacity: round(minimum), seen: round(seen), ink,
      ellipsisLeaves:ellipsisLeaves.size,invalidEllipsis:[...new Set(invalidEllipsis)],
      complete: text === spec.expected, visible: text === spec.expected && !invalidEllipsis.length && area > 0 && minimum >= minimumOpacity && seen >= .98};
  };
  const snapshot = window.__catalogContentTargets.map(measure);
  calibration.remove();
  // Distinct entries must have an interval without painted text collisions.
  for (let i = 0; i < snapshot.length; i++) for (let j = i + 1; j < snapshot.length; j++) {
    const a = snapshot[i], b = snapshot[j];
    if (a.opacity < minimumOpacity || b.opacity < minimumOpacity) continue;
    if (a.ink.some(x => b.ink.some(y => Math.min(x.x + x.w, y.x + y.w) - Math.max(x.x, y.x) > 2 && Math.min(x.y + x.h, y.y + y.h) - Math.max(x.y, y.y) > 2))) {
      a.visible = false; b.visible = false;
    }
  }
  return snapshot;
}

function sampleTimes(scene, planScene, interval) {
  const duration = planScene.dur, speed = planScene.speed ?? 1, localDuration = planScene.ldur ?? duration * speed;
  const samples = new Set([0, Math.max(0, duration - .02)]);
  for (let time = 0; time < duration; time += interval) samples.add(Number(time.toFixed(6)));
  const events = [...(planScene.marks ?? [])];
  if (scene.type === 'scan') {
    const timing = metadata.scan.times(scene, localDuration, planScene.beatLen);
    events.push(...timing.items.map(item => item.scan + localDuration * .032));
  }
  for (const event of events) for (const offset of [0, .06, .12, .2, .3, .4]) {
    const time = (event + offset) / speed;
    if (time >= 0 && time < duration) samples.add(Number(time.toFixed(6)));
  }
  return [...samples].sort((a, b) => a - b);
}

export async function run({out, source = SOURCE, types = TYPES, aspects = ASPECTS, font = 'Geist', interval = .05, minimumOpacity = .4, minimumSpan = .08, hideTarget} = {}) {
  assert.ok(interval > 0 && interval <= .1, 'Dense sample interval must be at most 100ms');
  if (fs.existsSync(out)) throw new Error(`Use a fresh output directory: ${out}`);
  fs.mkdirSync(out, {recursive: true});
  const receipt = sourceHashes(source), browser = await createNativeBrowser({source}), page = await browser.newPage();
  const report = {schema: 'pure-kinetic.catalog-design-content.v1', sourceReceipt: receipt, font, interval, minimumOpacity, minimumSpan,
    scope: 'Every unique field/DOM identity must retain complete source text and expose >=98% of its painted bounds, at >=40% opacity without target collisions, for a continuous sampled interval. Explicit valid single-line CSS ellipsis uses its complete clipping viewport; plain clipping, fake policies, glyph masks and missing copy are not exempt. Reverse seeks must reproduce those states.',
    total: types.length * aspects.length, results: []};
  const write = () => {
    report.completed = report.results.length; report.failed = report.results.filter(row => !row.passed).length;
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  };
  try {
    for (const aspect of aspects) for (const type of types) {
      const scene = maximumScene(type), row = {id: `${type}-${aspect.replace(':', 'x')}`, type, aspect, scene, targets: [], errors: []};
      try {
        const {plan} = await page.play({aspect, style: 'noir', grain: false, sparks: false,
          brand: {name: 'Nook', url: 'nook.app', font, tokens: {background: '#101820', foreground: '#f6f6ef', accent: '#b9f24a', accent2: '#8ec7ff'}}, scenes: [scene]});
        const planned = plan.scenes[0], targets = targetsFor(scene);
        await page.evaluate(bindTargets, targets, hideTarget);
        const times = sampleTimes(scene, planned, interval), witnesses = new Map();
        const progress = new Map(targets.map(target => [target.id, {...target, visibleSamples: 0, firstVisible: null, lastVisible: null, longestSpan: 0, runStart: null, previous: null}]));
        for (const time of times) {
          await page.shoot(planned.start + time);
          const snapshot = await page.evaluate(measureContent, {minimumOpacity});
          for (const target of snapshot) {
            const state = progress.get(target.id);
            if (target.visible) {
              state.visibleSamples++; state.firstVisible ??= time; state.lastVisible = time;
              if (state.previous === null || time - state.previous > interval * 1.5) state.runStart = time;
              state.previous = time; state.longestSpan = Math.max(state.longestSpan, time - state.runStart);
              if (!witnesses.has(target.id)) witnesses.set(target.id, {time, snapshot});
            } else { state.previous = null; state.runStart = null; }
          }
        }
        row.sampleCount = times.length;
        row.targets = [...progress.values()].map(({runStart, previous, ...target}) => ({...target, longestSpan: Number(target.longestSpan.toFixed(6))}));
        row.missing = row.targets.filter(target => target.longestSpan + 1e-6 < minimumSpan).map(target => target.id);
        const reverseTimes = [...new Set([...witnesses.values()].map(witness => witness.time))].sort((a, b) => b - a);
        for (const time of reverseTimes) {
          await page.shoot(planned.start + planned.dur * .99);
          await page.shoot(planned.start + time);
          const actual = await page.evaluate(measureContent, {minimumOpacity});
          const expected = [...witnesses.values()].find(witness => witness.time === time).snapshot;
          assert.deepEqual(actual, expected, `Reverse seek changed visible-copy state at ${time}`);
        }
        row.reverseWitnesses = reverseTimes.length; row.reverseExact = true;
        assert.deepEqual(page.errors, [], 'Native runtime errors');
        assert.deepEqual(page.externalRequests, [], 'External runtime requests');
        assert.deepEqual(row.missing, [], 'Supplied copy never had a complete visible interval');
        row.passed = true;
      } catch (error) { row.passed = false; row.errors.push(String(error.stack ?? error)); }
      report.results.push(row); write();
      console.log(row.id, row.passed ? 'pass' : `${row.missing?.join(', ') ?? ''} ${row.errors[0].split('\n')[0]}`);
    }
  } finally { await browser.close(); }
  report.sourceAfter = sourceHashes(source); report.sourceStable = report.sourceAfter.aggregate === receipt.aggregate;
  report.passed = report.sourceStable && report.completed === report.total && report.failed === 0; write();
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), option = (name, fallback) => args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback;
  const out = path.resolve(option('out', '/tmp/pk-catalog-design-content'));
  const options = {out, source: path.resolve(option('source', SOURCE)), font: option('font', 'Geist'),
    ...(option('types') ? {types: option('types').split(',')} : {}), ...(option('aspects') ? {aspects: option('aspects').split(',')} : {})};
  if (args.includes('--self-test')) {
    const report = await run({...options, types: ['web'], aspects: ['1:1'], hideTarget: 0});
    assert.equal(report.failed, 1); assert.ok(report.results[0].missing.includes('words.0'), 'Hidden-copy canary must fail');
    console.log('Hidden-copy canary correctly rejected');
  } else if (!(await run(options)).passed) process.exitCode = 1;
}
