// Native Document Flow acceptance: persistent objects, readable text and seeking.
// node tools/sequence-probe.mjs --out /tmp/pk-document-flow-qa
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {loadNativeHyperframes,NATIVE_HYPERFRAMES_VERSION} from './native-hyperframes-adapter.mjs';
import {measureRenderedText, layoutFindings} from './quality-layout.mjs';
import {DEFAULT_RECIPE, compile, stateAt} from '../source/lib/sequences/document-flow/model.mjs';
import {buildProject} from '../source/lib/sequences/document-flow/build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.resolve(HERE, '..');
const SOURCE = path.join(TEMPLATE, 'source/lib/sequences/document-flow');
const PACKAGE = path.join(TEMPLATE, 'node_modules/hyperframes');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const ASPECTS = ['9:16', '1:1', '16:9'];
// The layout norms the kit is held to: safe areas by aspect and the scale of
// type (norms.json beside this file; the compiler holds the same numbers).
const NORMS = JSON.parse(fs.readFileSync(new URL('./norms.json', import.meta.url), 'utf8'));

/** These fixtures vary only accepted content/brand slots, never choreography. */
export function cases(base = DEFAULT_RECIPE) {
  const brands = {
    folio: clone(base.brand),
    juniper: {name: 'Juniper', font: 'Geist', background: '#f1f5e9', foreground: '#19382a', accent: '#257649', accent2: '#c9d99a'},
    atlas: {name: 'Atlas', font: 'Archivo', background: '#101e38', foreground: '#f1f5fa', accent: '#f0bf53', accent2: '#9cc4e7'},
  };
  const longer = clone(base.content);
  longer.opening = 'Bring scattered creative work into organized collections';
  longer.documents = longer.documents.map((document, i) => ({...document, label: [
    'Independent research', 'Production planning', 'Exploratory sketches',
    'Reference collections', 'Creative possibilities', 'Unfinished explorations',
  ][i]}));
  longer.categories = longer.categories.map((category, i) => ({...category, label: ['Creative ideas', 'Project tasks', 'Source files'][i]}));
  longer.steps = ['Collect material', 'Arrange projects', 'Create concepts'];
  longer.closing = 'Find your next idea among collected work';
  longer.cta = 'Start creating today';
  return Object.entries(brands).flatMap(([brand, value]) => ['normal', 'long'].flatMap(copy => ASPECTS.map(aspect => ({
    id: `${brand}-${copy}-${aspect.replace(':', 'x')}`, brand, copy, aspect,
    spec: {...clone(base), aspect, brand: value, content: clone(copy === 'long' ? longer : base.content)},
  }))));
}

function sourceReceipt() {
  // Saved example recipes are inputs, not loaded render code. The tested input
  // is retained in each case; new examples must not invalidate a code snapshot.
  const files = Object.fromEntries(fs.readdirSync(SOURCE, {recursive: true}).filter(file => !file.startsWith('examples/') && /\.(?:mjs|json|css)$/.test(file))
    .sort().map(file => [file, hash(fs.readFileSync(path.join(SOURCE, file)))]));
  return {algorithm: 'sha256', aggregate: hash(JSON.stringify(files)), files};
}

// Serialized into the native browser. DOM identity is kept outside the source.
function inspect(measureSource) {
  const instance = document.querySelector('[data-sequence-root="document-flow"]')?.documentFlow;
  if (!instance) throw new Error('Native sequence did not expose its root-owned documentFlow instance');
  const root = instance.root;
  const nodes = [...root.querySelectorAll('[data-document-id]')];
  const identities = root.__sequenceProbeDocuments ??= new Map(nodes.map(node => [node.dataset.documentId, node]));
  const encode = node => node.nodeType !== Node.ELEMENT_NODE ? [node.nodeType, node.nodeValue] : [
    node.tagName,
    [...node.attributes].map(attribute => [attribute.name, attribute.name === 'style'
      ? [...node.style].sort().map(key => [key, node.style.getPropertyValue(key), node.style.getPropertyPriority(key)])
      : attribute.value]).sort((a, b) => a[0].localeCompare(b[0])),
    [...node.childNodes].map(encode),
  ];
  const geometry = [...root.querySelectorAll('*')].map(node => {
    const r = node.getBoundingClientRect(), style = getComputedStyle(node);
    return [node.tagName, ...[r.x, r.y, r.width, r.height].map(value => Number(value.toFixed(6))),
      style.fontFamily, style.fontSize, style.fontWeight, style.display, style.visibility, style.opacity];
  });
  const texts = (0, eval)(`(${measureSource})`)(root);
  const owners = new Map(), categories = new Map(), roles = new Map(), paints = new Map(), walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, id = root.__qualityTextIdentities?.nodes.get(node);
    const documentId = node.parentElement?.closest('[data-document-id]')?.dataset.documentId;
    const categoryId = node.parentElement?.closest('[data-category-id]')?.dataset.categoryId;
    if (id !== undefined && documentId) owners.set(id, documentId);
    if (id !== undefined && categoryId && !documentId) categories.set(id, categoryId);
    if (id !== undefined) roles.set(id, documentId ? 'document' : categoryId ? 'category'
      : node.parentElement?.closest('.df-intro') ? 'opening'
      : node.parentElement?.closest('.df-action') ? 'action'
      : node.parentElement?.closest('.df-cta') ? 'cta'
      : node.parentElement?.closest('.df-end') ? 'ending' : 'other');
    if (id !== undefined) paints.set(id, getComputedStyle(node.parentElement).color.match(/[\d.]+/g)?.map(Number));
  }
  for (const text of texts) {
    text.documentId = owners.get(text.id) ?? null;
    text.categoryId = categories.get(text.id) ?? null;
    text.role = roles.get(text.id) ?? null;
    text.moving = !!instance.state.documents.find(document => document.id === text.documentId)?.moving;
    text.foreground = paints.get(text.id) ?? null;
  }
  return {
    state: instance.state, audit: instance.audit(), texts,
    cameraCount: root.querySelectorAll('[data-world-camera]').length,
    documentIds: nodes.map(node => node.dataset.documentId),
    identity: nodes.every(node => identities.get(node.dataset.documentId) === node),
    underCamera: nodes.every(node => !!node.closest('[data-world-camera]')),
    documentAttributes: nodes.map(node => ({...node.dataset})),
    documentArt: nodes.map(node => {
      const label = node.querySelector('.df-card-label'), art = node.querySelector('.df-glyph');
      const paint = art && getComputedStyle(art);
      return {id: node.dataset.documentId, visible: paint?.visibility === 'visible' && Number(paint.opacity) > 0,
        labelBottom: label ? label.offsetTop + label.offsetHeight : null,
        artTop: paint ? Number.parseFloat(paint.top) : null};
    }),
    documentCenters: nodes.map(node => {
      const box = node.getBoundingClientRect();
      return {id: node.dataset.documentId, x: box.left + box.width / 2, y: box.top + box.height / 2};
    }),
    dom: JSON.stringify(encode(root)), geometry: JSON.stringify(geometry),
    audio: [...document.querySelectorAll('audio')].map(node => ({
      id: node.id, src: node.getAttribute('src'), eventId: node.getAttribute('data-sequence-event'),
      start: Number(node.getAttribute('data-start')), duration: Number(node.getAttribute('data-duration')),
      gain: Number(node.getAttribute('data-volume')), music: node.hasAttribute('data-sequence-music'),
    })),
    browserAudioCalls: window.__sequenceProbeAudioCalls ?? [],
    audioCurrent: instance.audioCurrent ?? null,
    contentEdited: instance.contentEdited ?? false,
  };
}

function boundsOf(plan) {
  const norm = NORMS.aspects[plan.recipe?.aspect ?? plan.aspect];
  assert.ok(norm, 'The compiled plan must retain its aspect');
  const safe = norm.safe;
  return {width: plan.width, height: plan.height,
    floor: NORMS.type.label * Math.min(plan.width, plan.height) / NORMS.base * (plan.height / plan.width > NORMS.tall.over ? NORMS.tall.scale : 1),
    safe: {left: plan.width * safe.left, right: plan.width * (1 - safe.right), top: plan.height * safe.top, bottom: plan.height * (1 - safe.bottom)}};
}

export function acceptanceFindings(texts, bounds, occlusion = []) {
  // A moving document has the same readable-text contract as a settled one.
  // Neither native allowance attributes nor a broad data-over marker suppress it.
  return [...layoutFindings(texts.map(text => ({...text, over: false})), bounds),
    ...occlusion.filter(text => text.blockedGlyphs > 0).map(text => ({
      kind: 'opaque-surface-occlusion', id: text.id, text: text.text,
      blockedGlyphs: text.blockedGlyphs, glyphs: text.glyphs, blockers: text.blockers,
    }))];
}

// Serialized into Chromium. Measure character centers in the actual transformed
// DOM, then inspect paint-order hits for unrelated opaque surfaces. Enabling hit
// testing changes no paint and prevents pointer-events:none from hiding an
// occluding card or overlay. Glyph/font metrics and contrast are checked separately.
export function measureTextOcclusion(root, texts) {
  const document = root.ownerDocument, window = document.defaultView;
  const nodes = new Map(), walker = document.createTreeWalker(root, window.NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, id = root.__qualityTextIdentities?.nodes.get(node);
    if (id !== undefined) nodes.set(id, node);
  }
  const style = document.createElement('style');
  style.textContent = 'body,body *{pointer-events:auto!important}';document.head.append(style);
  const opacity = node => {
    let value = 1;
    for (let p = node; p; p = p.parentElement) value *= Number(window.getComputedStyle(p).opacity);
    return value;
  };
  const painted = new Map();
  function surface(node) {
    if (painted.has(node)) return painted.get(node);
    const computed = window.getComputedStyle(node), rgba = computed.backgroundColor.match(/[\d.]+/g)?.map(Number);
    const value = !!rgba && (rgba[3] ?? 1) * opacity(node) >= .75;
    painted.set(node, value);return value;
  }
  try {
    return texts.map(text => {
      const node = nodes.get(text.id), parent = node?.parentElement, blockers = new Map();
      if (!parent) throw new Error(`Missing measured text node: ${text.text}`);
      let glyphs = 0, blockedGlyphs = 0;
      for (let start = 0; start < node.length;) {
        const character = String.fromCodePoint(node.textContent.codePointAt(start)), end = start + character.length;
        if (!/\s/u.test(character)) {
          const range = document.createRange();range.setStart(node, start);range.setEnd(node, end);
          const box = range.getBoundingClientRect();
          if (box.width > .5 && box.height > .5) {
            glyphs++;let blocked = false;
            for (const fy of [.45, .6, .75]) {
              const x = box.left + box.width / 2, y = box.top + box.height * fy;
              const stack = document.elementsFromPoint(x, y), own = stack.indexOf(parent);
              // Clipping/out-of-frame points are handled by strict glyph geometry.
              if (own < 0) continue;
              const cover = stack.slice(0, own).find(candidate =>
                !candidate.contains(parent) && !parent.contains(candidate) && surface(candidate));
              if (cover) {
                blocked = true;
                const label = cover.getAttribute('data-document-id') ?? cover.getAttribute('data-category-id') ?? cover.id ?? cover.tagName;
                blockers.set(label, (blockers.get(label) ?? 0) + 1);
              }
            }
            if (blocked) blockedGlyphs++;
          }
        }
        start = end;
      }
      return {id: text.id, text: text.text, glyphs, blockedGlyphs,
        blockers: [...blockers].map(([id, points]) => ({id, points}))};
    });
  } finally {style.remove();}
}

function examine(plan, time, snapshot) {
  const errors = [], expected = stateAt(plan, snapshot.state.time), {state} = snapshot;
  const equal = (a, b, label, tolerance = 1e-5) => {
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > tolerance) errors.push(`${label}: ${a} differs from ${b}`);
  };
  equal(state.time, time, 'native clock');
  if (state.phase !== expected.phase) errors.push('Native phase differs from the compiled schedule');
  const actionIndex = ['collect', 'arrange', 'create'].indexOf(state.phase);
  const expectedAction = actionIndex < 0 ? '' : plan.content.steps[actionIndex];
  if (state.actionLabel !== expectedAction) errors.push('The action heading does not match the action currently taking place');
  const actionTexts = snapshot.texts.filter(text => text.role === 'action');
  if (actionIndex >= 0 && (state.actionOpacity ?? 1) >= .75 && !actionTexts.some(text => text.text === expectedAction)) {
    errors.push('The painted action heading does not describe the action currently taking place');
  }
  if (actionTexts.some(text => text.text !== expectedAction)) errors.push('A stale action heading remains readable');
  for (const key of ['x', 'y', 'zoom']) equal(state.camera[key], expected.camera[key], `camera.${key}`);
  for (const text of snapshot.texts) if (!text.font.includes(plan.brand.font)) errors.push(`${text.text}: requested font did not reach the rendered label`);
  if (snapshot.cameraCount !== 1 || snapshot.documentIds.length !== 6 || new Set(snapshot.documentIds).size !== 6 || !snapshot.identity || !snapshot.underCamera) {
    errors.push('Six document identities and one common camera must persist throughout the film');
  }
  const supplied = plan.recipe.content.documents;
  if (JSON.stringify([...snapshot.documentIds].sort()) !== JSON.stringify(supplied.map(document => document.id).sort())) errors.push('Rendered document identities differ from the supplied content');
  for (const document of state.documents) {
    const wanted = expected.documents.find(item => item.id === document.id);
    if (!wanted) {errors.push(`Unexpected document ${document.id}`);continue;}
    for (const key of ['x', 'y', 'rotation', 'scale', 'opacity']) equal(document[key], wanted[key], `${document.id}.${key}`);
    for (const key of ['category', 'scanned', 'sorted', 'active', 'face']) if (document[key] !== wanted[key]) errors.push(`${document.id}.${key} differs from its semantic state`);
    if (document.category !== supplied.find(item => item.id === document.id)?.category) errors.push(`${document.id}: changed category`);
    const attributes = snapshot.documentAttributes.find(item => item.documentId === document.id);
    for (const key of ['category', 'scanned', 'sorted', 'active']) if (attributes?.[key] !== String(document[key])) errors.push(`${document.id}: painted ${key} state differs from its schedule`);
    if (document.active && document.opacity >= .75) {
      const label = supplied.find(item => item.id === document.id).label;
      if (!snapshot.texts.some(text => text.documentId === document.id && text.text === label)) errors.push(`${document.id}: active document label disappeared`);
      const art = snapshot.documentArt.find(item => item.id === document.id);
      if (art?.visible && (!Number.isFinite(art.artTop) || !Number.isFinite(art.labelBottom) || art.labelBottom > art.artTop + .5)) {
        errors.push(`${document.id}: decorative art enters its readable label region`);
      }
    }
    if (!document.active && snapshot.texts.some(text => text.documentId === document.id)) {
      errors.push(`${document.id}: an inactive or back-facing document still paints readable front text`);
    }
    const rendered = snapshot.documentCenters.find(item => item.id === document.id);
    equal(rendered?.x, plan.width / 2 + (document.x - state.camera.x) * state.camera.zoom, `${document.id}.projectedX`, .1);
    equal(rendered?.y, plan.height / 2 + (document.y - state.camera.y) * state.camera.zoom, `${document.id}.projectedY`, .1);
    const landing = plan.events.find(event => event.kind === 'document.sorted' && event.target === `document:${document.id}`);
    // Native exact seeking may round the requested decimal a fraction before
    // the event. Check a landed state, including the post-event sample, rather
    // than treating that pre-event position as the completed destination.
    if (landing && state.time >= landing.time && state.time <= landing.time + .120001) {
      const target = plan.layout.documents.find(item => item.id === document.id).destination;
      equal(document.x, target.x, `${document.id}.categoryDestinationX`);
      equal(document.y, target.y, `${document.id}.categoryDestinationY`);
    }
  }
  if (state.documents.length !== 6) errors.push('A document was dropped or duplicated in native state');
  for (const category of state.categories) {
    if (category.active && category.opacity >= .75 && !snapshot.texts.some(text => text.categoryId === category.id && text.text === category.label)) {
      errors.push(`${category.id}: active category label disappeared`);
    }
  }
  if (state.heroId !== plan.layout.heroId || state.documents.filter(document => document.hero).length !== 1
    || !state.documents.find(document => document.id === plan.layout.heroId)?.hero) errors.push('The authored hero identity changed');
  if (snapshot.audioCurrent !== true) errors.push('Native instance did not prove that its audio matches its semantic events');
  const arrangement = plan.phases.find(phase => phase.id === 'arrange');
  if (!arrangement) errors.push('The directed recipe must declare its arrange phase');
  else if (time >= arrangement.end && state.documents.some(document => !document.scanned || !document.sorted)) errors.push('The sorting payoff did not preserve all six scanned documents');
  if (snapshot.browserAudioCalls.some(call => call.kind === 'media.play' || call.stack?.includes('/assets/document-flow/'))) errors.push('Component JavaScript started browser audio');
  return errors;
}

async function rasterDifference(sharp, first, second) {
  const raw = async buffer => sharp(buffer).resize({width: 480, height: 480, fit: 'inside'}).removeAlpha().raw().toBuffer();
  const [a, b] = await Promise.all([raw(first), raw(second)]);
  assert.equal(a.length, b.length);
  let total = 0, strong = 0;
  for (let i = 0; i < a.length; i += 3) {
    const delta = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    total += delta;if (delta / 3 > 12) strong++;
  }
  return {mean: total / a.length, strongPixelShare: strong / (a.length / 3)};
}

const luminance = rgb => rgb.map(value => {
  value /= 255;return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
}).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + .05) / (lo + .05);
};

async function measureContrast(page, sharp, texts) {
  await page.evaluate(() => {
    const hide = document.createElement('style');hide.id = 'sequence-probe-hide-text';
    hide.textContent = '[data-df-instance] .df-text,[data-df-instance] .df-text *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}';
    document.head.append(hide);
  });
  let pixels;
  try {pixels = await sharp(Buffer.from(await page.screenshot({type: 'png'}))).removeAlpha().raw().toBuffer({resolveWithObject: true});}
  finally {await page.evaluate(() => document.getElementById('sequence-probe-hide-text')?.remove());}
  const {data, info} = pixels;
  return texts.map(text => {
    assert.ok(text.foreground?.length >= 3, `${text.text}: cannot measure the painted foreground`);
    const samples = [];
    for (const box of text.inkLines) for (const fx of [.15, .5, .85]) for (const fy of [.25, .5, .75]) {
      const x = Math.max(0, Math.min(info.width - 1, Math.round(box.x + box.w * fx)));
      const y = Math.max(0, Math.min(info.height - 1, Math.round(box.y + box.h * fy)));
      const offset = (y * info.width + x) * info.channels;
      const background = [...data.subarray(offset, offset + 3)], opacity = text.opacity * (text.foreground[3] ?? 1);
      const foreground = background.map((value, i) => value + (text.foreground[i] - value) * opacity);
      samples.push({ratio: contrast(foreground, background), foreground, background, x, y});
    }
    assert.ok(samples.length, `${text.text}: missing actual ink geometry`);
    const minimum = samples.reduce((low, sample) => sample.ratio < low.ratio ? sample : low, samples[0]);
    return {text: text.text, documentId: text.documentId, authoredPaint: text.foreground, opacity: text.opacity, minimum, points: samples.length};
  });
}

async function occlusionSelfTest(page, measureSource, occlusionSource) {
  return page.evaluate(({measureSource, occlusionSource}) => {
    const root = document.querySelector('[data-sequence-root="document-flow"]');
    const measure = (0, eval)(`(${measureSource})`), occlusion = (0, eval)(`(${occlusionSource})`);
    const texts = measure(root), target = texts.find(text => text.lines.some(line => line.w > 30 && line.h > 10));
    if (!target) throw new Error('Occlusion regression needs a real visible label');
    const before = occlusion(root, [target])[0], box = target.lines[0];
    const cover = document.createElement('div');cover.id = 'sequence-probe-opaque-cover';
    cover.style.cssText = `position:fixed;left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;background:#163b55;z-index:2147483647;pointer-events:none`;
    document.body.append(cover);
    let blocked;
    try {blocked = occlusion(root, [target])[0];}
    finally {cover.remove();}
    const after = occlusion(root, [target])[0];
    return {before, blocked, after,
      passed: before.blockedGlyphs === 0 && blocked.blockedGlyphs > 0 && after.blockedGlyphs === 0};
  }, {measureSource, occlusionSource});
}

async function createPayoff(page, sharp, seek, plan, out, id) {
  const hero = plan.content.documents.find(document => document.id === plan.layout.heroId);
  if (hero?.kind !== 'draft') return {applicable: false, reason: 'The hero is not a draft', passed: true};
  const samples = [], frames = [];
  for (const beat of [23.6, 24.8, 25.5]) {
    await seek(page, beat * plan.beat, {exactTime: true});
    const sample = await page.evaluate(() => {
      const instance = document.querySelector('[data-sequence-root="document-flow"]').documentFlow;
      const node = [...instance.root.querySelectorAll('[data-document-id]')].find(node => node.dataset.documentId === instance.plan.layout.heroId);
      const label = node.querySelector('.df-card-label'), art = node.querySelector('.df-glyph');
      const labelStyle = getComputedStyle(label), paint = getComputedStyle(art), box = art.getBoundingClientRect();
      let opacity = 1;
      for (let parent = art; parent; parent = parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
      const photo = art.querySelector('[fill-opacity]'), panel = art.querySelector('rect[stroke="none"]');
      return {heroId: node.dataset.documentId, label: label.textContent,
        singleLine: label.offsetHeight <= Number.parseFloat(labelStyle.lineHeight) * 1.15,
        labelScrollHeight: label.scrollHeight, labelHeight: label.offsetHeight,
        artTop: Number.parseFloat(paint.top), artHeight: Number.parseFloat(paint.height),
        visible: paint.visibility === 'visible' && opacity >= .75 && box.width > 1 && box.height > 1,
        photoFill: photo ? Number(photo.getAttribute('fill-opacity')) : null,
        panelWidth: panel ? Number(panel.getAttribute('width')) : null,
        bounds: {x: box.x, y: box.y, width: box.width, height: box.height}};
    });
    samples.push({beat, ...sample});
    if (!sample.singleLine) return {applicable: false, reason: 'The draft label needs multiple lines', samples, passed: true};
    const frame = Buffer.from(await page.screenshot({type: 'png', clip: samples[0].bounds}));frames.push(frame);
    const file = `${id}-create-${beat}.png`;await fs.promises.writeFile(path.join(out, file), frame);
    samples.at(-1).file = file;
  }
  const first = samples[0], last = samples.at(-1), visualChange = await rasterDifference(sharp, frames[0], frames.at(-1));
  const passed = samples.every(sample => sample.visible && Number.isFinite(sample.photoFill) && Number.isFinite(sample.panelWidth))
    && last.photoFill >= .99 && last.photoFill - first.photoFill > .8 && last.panelWidth > first.panelWidth + 20
    && samples[1].photoFill > first.photoFill && visualChange.mean > .1 && visualChange.strongPixelShare > .001;
  return {applicable: true, samples, visualChange, passed};
}

async function main() {
  const args = process.argv.slice(2), option = (name, fallback) => args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback;
  const selected = new RegExp(option('cases', '.'));
  const input = option('recipe', null), supplied = input ? JSON.parse(fs.readFileSync(path.resolve(input), 'utf8')) : null;
  const custom = supplied ? option('aspects', supplied.aspect).split(',').map(aspect => ({
    id: `authored-${aspect.replace(':', 'x')}`, brand: supplied.brand.name, copy: 'authored', aspect,
    spec: {...clone(supplied), aspect}, input: path.resolve(input), inputHash: hash(fs.readFileSync(path.resolve(input))),
  })) : null;
  const jobs = (custom ?? cases()).filter(job => selected.test(job.id));
  for (const job of jobs) compile(job.spec);
  if (args.includes('--list')) {console.log(JSON.stringify(jobs, null, 2));return;}
  assert.ok(jobs.length, 'Case filter selected no cases');
  const out = path.resolve(option('out', '/tmp/pk-document-flow-qa'));
  fs.mkdirSync(out, {recursive: true});
  const {bundleWithLocalizedFonts,serveStaticProjectHtml,openSettledCompositionPage,seekCompositionTimeline}=await loadNativeHyperframes(PACKAGE);
  const version=NATIVE_HYPERFRAMES_VERSION;
  const sharp = createRequire(path.join(fs.realpathSync(PACKAGE), 'package.json'))('sharp');
  const receipt = sourceReceipt(), results = [];
  let sourceStable = null, interrupted = false;
  const reversePolicy = {dom: 'exact', geometry: 'exact', clockTolerance: 1e-5,
    downsampleWidth: 480, maximumMeanChannelDelta: .06, maximumStrongPixelShare: .0001,
    note: 'The existing additional Chromium reverse-raster bound is used; semantic state, DOM and measured geometry must remain exact.'};
  const report = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({
    schema: 'pure-kinetic.document-flow.native.v2', hyperframes: version, sourceReceipt: receipt, reversePolicy,
    total: jobs.length, completed: results.length, failedCases: results.filter(row => !row.passed).length, sourceStable, interrupted,
    scope: 'Sampled glyph geometry and opaque-surface occlusion at held frames, action events and carrying intervals; identity, semantic destinations, native clocks/audio, reverse raster and composited text contrast at five phase frames. Moving and settled label collisions both fail, and no layout allowance suppresses a finding. Occlusion checks actual transformed glyph-center paint-order hits against unrelated opaque surfaces, including pointer-events:none covers; its negative fixture must fail. Contrast hides text paint only and samples the real surface under its ink, with a 3:1 floor. A draft hero with a single-line label must show a visibly changing illustration through Create, proven by native visibility, SVG fill progression and changed raster crops. This does not certify subjective motion direction, every frame or sound balance.', results,
  }, null, 2) + '\n');
  let browser;
  try {
    for (const job of jobs) {
      if (fs.existsSync(path.join(out, 'stop'))) {interrupted = true;break;}
      const row = {...job, errors: [], externalRequests: [], samples: [], reverse: [], frames: [], contrast: []};
      let page, server;
      try {
        const project = path.join(out, 'projects', job.id);
        if (fs.existsSync(path.join(project, '.sequence-probe-owned'))) fs.rmSync(project, {recursive: true});
        const built = await buildProject(project, job.spec), {plan} = built;
        fs.writeFileSync(path.join(project, '.sequence-probe-owned'), 'Generated by sequence-probe.mjs\n');
        row.project = project;row.duration = plan.duration;row.events = plan.events;
        row.nativeBuildReceipt = JSON.parse(fs.readFileSync(path.join(project, 'source-receipt.json'), 'utf8'));
        const html = await bundleWithLocalizedFonts(project);
        server = await serveStaticProjectHtml(project, html);
        const opened = await openSettledCompositionPage(html, server.url, {
          renderReadyTimeoutMs: 30000, browserGpuMode: 'hardware',
          prelaunched: browser ? {take: async () => ({browser, softwareWebGpu: false})} : undefined,
          beforeNavigate: async tab => {
            tab.on('pageerror', error => row.errors.push(error.message));
            tab.on('console', message => {if (message.type() === 'error') row.errors.push(message.text());});
            await tab.setRequestInterception(true);
            tab.on('request', request => {
              const url = new URL(request.url());
              if (['http:', 'https:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
                row.externalRequests.push(request.url());request.abort();
              } else request.continue();
            });
            await tab.evaluateOnNewDocument(() => {
              window.__sequenceProbeAudioCalls = [];
              const play = HTMLMediaElement.prototype.play;
              HTMLMediaElement.prototype.play = function(...params) {
                window.__sequenceProbeAudioCalls.push({kind: 'media.play', stack: new Error().stack});return play.apply(this, params);
              };
              for (const key of ['AudioContext', 'webkitAudioContext']) {
                const Original = window[key];
                if (Original) window[key] = new Proxy(Original, {construct(Target, params) {
                  window.__sequenceProbeAudioCalls.push({kind: key, stack: new Error().stack});return Reflect.construct(Target, params);
                }});
              }
            });
          },
        });
        page = opened.page;browser = opened.browser;
        assert.ok(!opened.renderReadyTimedOut, 'Native render readiness timed out');
        await page.waitForFunction(() => !!document.querySelector('[data-sequence-root="document-flow"]')?.documentFlow || !!window.__hfStartupError, {timeout: 30000});
        const startupError = await page.evaluate(() => window.__hfStartupError ?? null);
        assert.equal(startupError, null, `Native sequence failed during construction: ${JSON.stringify(startupError)}`);
        row.fontProof = await page.evaluate(async family => {
          const file = {'Geist': 'Geist-Variable.woff2', 'Geist Mono': 'GeistMono-Variable.woff2', 'Archivo': 'Archivo-Variable.woff2'}[family];
          const proofs = [];
          for (const weight of [400, 700]) {
            const alias = `SequenceDirect${weight}`;
            const face = new FontFace(alias, `url(assets/fonts/${file})`, {weight: String(weight), ...(family === 'Archivo' ? {stretch: '62% 125%'} : {})});
            await face.load();document.fonts.add(face);
            const text = 'WW ii Research 2048';
            await document.fonts.load(`${weight} 64px "${family}"`, text);
            const measure = name => {
              const context = document.createElement('canvas').getContext('2d');context.font = `${weight} 64px "${name}"`;
              const value = context.measureText(text);
              return {width: value.width, ascent: value.actualBoundingBoxAscent, descent: value.actualBoundingBoxDescent};
            };
            proofs.push({family, weight, file, native: measure(family), direct: measure(alias)});
          }
          return proofs;
        }, plan.brand.font);
        for (const proof of row.fontProof) for (const key of ['width', 'ascent', 'descent']) {
          assert.ok(Math.abs(proof.native[key] - proof.direct[key]) < .01, `${proof.family} ${proof.weight}: actual ${key} uses a fallback font`);
        }
        const read = () => page.evaluate(inspect, measureRenderedText.toString());
        const occlusion = texts => page.evaluate(({source, texts}) => (0, eval)(`(${source})`)(
          document.querySelector('[data-sequence-root="document-flow"]'), texts), {source: measureTextOcclusion.toString(), texts});
        await seekCompositionTimeline(page, 2 * plan.beat, {exactTime: true});
        row.occlusionSelfTest = await occlusionSelfTest(page, measureRenderedText.toString(), measureTextOcclusion.toString());
        assert.ok(row.occlusionSelfTest.passed, `Opaque pointer-events:none cover was not detected or removed: ${JSON.stringify(row.occlusionSelfTest)}`);
        const holds = [0, ...plan.phases.flatMap(phase => [phase.start + .15 * plan.beat,
          (phase.start + phase.end) / 2, phase.end - .1 * plan.beat]), plan.duration - .01];
        const events = plan.events.flatMap(event => [event.time, Math.min(plan.duration - .01, event.time + .12)]);
        const carrying = plan.layout.documents.flatMap(document => [.05, .2, .35, .5, .65, .8, .95].map(fraction =>
          (document.sortBeat + (document.sortEndBeat - document.sortBeat) * fraction) * plan.beat));
        const times = [...new Set([...holds, ...events, ...carrying].map(time => Number(time.toFixed(6))))].sort((a, b) => a - b);
        const holdTimes = new Set(holds.map(time => Number(time.toFixed(6))));
        const carryTimes = new Set(carrying.map(time => Number(time.toFixed(6))));
        let textCount = 0;
        for (const time of times) {
          await seekCompositionTimeline(page, time, {exactTime: true});
          const snapshot = await read(), paintOcclusion = await occlusion(snapshot.texts);
          const findings = acceptanceFindings(snapshot.texts, boundsOf(plan), paintOcclusion);
          const errors = examine(plan, time, snapshot);
          row.errors.push(...errors.map(error => `t=${time}: ${error}`));
          row.errors.push(...findings.map(finding => `t=${time}: ${JSON.stringify(finding)}`));
          textCount += snapshot.texts.length;
          row.samples.push({time, heldGeometry: holdTimes.has(time), carryingGeometry: carryTimes.has(time), state: snapshot.state, texts: snapshot.texts, findings, paintOcclusion,
            cameraCount: snapshot.cameraCount, documentIds: snapshot.documentIds, identity: snapshot.identity, audit: snapshot.audit});
        }
        assert.ok(textCount > 0, 'No readable native text was measured');
        const requiredCopy = [{text: plan.brand.name, role: 'ending'}, {text: plan.content.opening, role: 'opening'},
          ...plan.content.documents.map(document => ({text: document.label, role: 'document', documentId: document.id})),
          ...plan.content.categories.map(category => ({text: category.label, role: 'category', categoryId: category.id})),
          ...plan.content.steps.map(text => ({text, role: 'action'})),
          {text: plan.content.closing, role: 'ending'}, {text: plan.content.cta, role: 'cta'}];
        const visibleCopy = row.samples.flatMap(sample => sample.texts);
        row.missingCopy = requiredCopy.filter(required => !visibleCopy.some(text =>
          Object.entries(required).every(([key, value]) => text[key] === value)));
        for (const text of row.missingCopy) row.errors.push(`Supplied copy was never readable in its own role: ${JSON.stringify(text)}`);
        row.minimumRendered = Math.min(...row.samples.flatMap(sample => sample.texts.map(text => text.renderedSize)));
        for (const phase of plan.phases) {
          const time = (phase.start + phase.end) / 2, beat = time / plan.beat;
          await seekCompositionTimeline(page, time, {exactTime: true});
          const firstState = await read(), first = Buffer.from(await page.screenshot({type: 'png'}));
          await seekCompositionTimeline(page, plan.duration - .001, {exactTime: true});
          await seekCompositionTimeline(page, 0, {exactTime: true});
          await seekCompositionTimeline(page, time, {exactTime: true});
          const secondState = await read(), second = Buffer.from(await page.screenshot({type: 'png'}));
          const visual = await rasterDifference(sharp, first, second);
          const domExact = firstState.dom === secondState.dom, geometryExact = firstState.geometry === secondState.geometry,
            stateExact = JSON.stringify(firstState.state) === JSON.stringify(secondState.state);
          const result = {time, phase: phase.id, domExact, geometryExact, stateExact, pixelExact: hash(first) === hash(second), ...visual};
          result.passed = domExact && geometryExact && stateExact && visual.mean <= reversePolicy.maximumMeanChannelDelta && visual.strongPixelShare <= reversePolicy.maximumStrongPixelShare;
          row.reverse.push(result);
          if (!result.passed) row.errors.push(`Reverse seek failed at ${time}: ${JSON.stringify(result)}`);
          const filename = `${job.id}-beat-${beat}.jpg`;
          await sharp(first).resize({width: 960, height: 960, fit: 'inside'}).jpeg({quality: 92}).toFile(path.join(out, filename));
          row.frames.push({time, beat, phase: phase.id, file: filename});
          const measurements = await measureContrast(page, sharp, secondState.texts);
          row.contrast.push({time, beat, phase: phase.id, measurements});
          for (const measurement of measurements) if (measurement.minimum.ratio < 3) {
            row.errors.push(`t=${time}: ${measurement.text} contrast ${measurement.minimum.ratio.toFixed(3)}:1 is below 3:1`);
          }
        }
        row.minimumContrast = Math.min(...row.contrast.flatMap(sample => sample.measurements.map(measurement => measurement.minimum.ratio)));
        row.createPayoff = await createPayoff(page, sharp, seekCompositionTimeline, plan, out, job.id);
        if (!row.createPayoff.passed) row.errors.push(`The Create payoff did not visibly complete the existing draft: ${JSON.stringify(row.createPayoff)}`);
        const snapshot = await read(), clips = snapshot.audio.filter(clip => clip.eventId);
        assert.equal(new Set(snapshot.audio.map(clip => clip.id)).size, snapshot.audio.length, 'Native audio IDs must be unique');
        const muted = new Set(built.audio.mutedEvents ?? []), audible = plan.events.filter(event => !muted.has(event.id));
        assert.deepEqual(clips.map(clip => clip.eventId).sort(), audible.map(event => event.id).sort(), 'Each unmuted semantic event must own one native sound clip');
        for (const event of audible) {
          const clip = clips.find(item => item.eventId === event.id);
          assert.ok(Math.abs(clip.start - event.time) < 1e-6, `${event.id}: native sound must land on its visual event`);
          assert.ok(clip.duration > 0 && clip.start + clip.duration <= plan.duration + 1e-6, `${event.id}: sound tail out of bounds`);
          assert.ok(clip.gain > 0 && clip.gain <= 1, `${event.id}: invalid sound gain`);
          assert.ok(fs.existsSync(path.join(project, clip.src)), `${event.id}: missing local sound asset`);
        }
        row.audio = snapshot.audio;row.nativeAudioSynchronized = true;
        if (job.brand === 'folio' && job.copy === 'normal') {
          row.reviewFrames = [];
          for (const time of [4, 7, 10, 13, 16]) {
            await seekCompositionTimeline(page, time, {exactTime: true});
            const file = `${job.id}-t${time}.jpg`;
            await sharp(Buffer.from(await page.screenshot({type: 'png'}))).resize({width: 1440, height: 1440, fit: 'inside'}).jpeg({quality: 94}).toFile(path.join(out, file));
            row.reviewFrames.push({time, file});
          }
        }
        const thumbs = await Promise.all(row.frames.map(frame => sharp(path.join(out, frame.file)).resize(320, 320, {fit: 'contain', background: '#161820'}).png().toBuffer()));
        await sharp({create: {width: thumbs.length * 320, height: 320, channels: 3, background: '#161820'}})
          .composite(thumbs.map((input, i) => ({input, left: i * 320, top: 0}))).jpeg({quality: 92}).toFile(path.join(out, `${job.id}-contact.jpg`));
      } catch (error) {row.errors.push(String(error?.stack ?? error));}
      finally {await page?.close().catch(() => {});await server?.close();}
      row.passed = row.errors.length === 0 && row.externalRequests.length === 0;
      results.push(row);report();
      console.log(`${results.length}/${jobs.length} ${job.id}: ${row.passed ? 'pass' : 'FAIL'}${row.errors[0] ? ` ${row.errors[0].slice(0, 260)}` : ''}`);
    }
  } finally {await browser?.close();}
  sourceStable = JSON.stringify(sourceReceipt()) === JSON.stringify(receipt);report();
  assert.ok(sourceStable, 'Production source changed during native acceptance; rerun against a frozen source');
  if (interrupted || results.some(row => !row.passed)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
