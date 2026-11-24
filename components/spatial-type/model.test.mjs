import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {normalize, cameraAt, wordAt, makeField, shardAt, sample, transitionAt} from './lib/model.mjs';
import {buildWord, updateClipping} from './lib/geometry.mjs';
import {createSpatialType} from './lib/world.mjs';
import {mergeConfig} from './native.mjs';
import {Font} from './vendor/three/examples/jsm/loaders/FontLoader.js';
import wide from './assets/type/anybody-w150-800.mjs';
import compact from './assets/type/anybody-w130-800.mjs';
import recipe from './recipe.mjs';
import {buildProject} from './build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const config = () => normalize(recipe);
function release(word) {
  const materials = new Set([word.face, word.side]);
  for (const p of word.pieces) {materials.add(p.face); materials.add(p.side);}
  for (const l of word.letters) l.geometry.dispose();
  for (const m of materials) m.dispose();
}

test('camera and word states are equal after arbitrary forward/reverse orders', () => {
  const c = config(), samples = [0, 1.6, 2.25, 2.6, 3.9, 4.6, 5.8];
  const reference = new Map(samples.map(t => [t, {camera: cameraAt(c, t), word: wordAt(c.words[1], t)}]));
  for (const t of [5.8, 0, 3.9, 2.25, 4.6, 1.6, 2.6, 0, 5.8]) {
    assert.deepEqual({camera: cameraAt(c, t), word: wordAt(c.words[1], t)}, reference.get(t));
  }
  assert.deepEqual(c.words[1].position, [0, 0, -19]);
});

test('lens, target, roll and explicit easing are part of the camera route', () => {
  const c = config();
  c.camera.keys = [{time: 0, position: [0, 0, 8], target: [0, 0, 0], fov: 25, roll: 0},
    {time: 2, position: [4, 2, 4], target: [1, 0, -5], fov: 45, roll: 0.6, ease: 'linear'}];
  assert.deepEqual(cameraAt(c, 1), {position: [2, 1, 6], target: [0.5, 0, -2.5], fov: 35, roll: 0.3});
  assert.equal(sample([{time: 0, value: 0}, {time: 2, value: 1, ease: 'hold'}], 1.99), 0);
});

test('seeded fields reproduce poses and changed seeds change actual geometry layout', () => {
  const f = config().fields[0], first = makeField(f), again = makeField(f);
  assert.deepEqual(first, again);
  assert.notDeepEqual(first, makeField({...f, seed: f.seed + 1}));
  const before = structuredClone(first);
  const states = first.slice(0, 4).map(d => shardAt(d, f, 2.8));
  for (const time of [5.7, 0, 4.2, 0.5]) first.forEach(d => shardAt(d, f, time));
  assert.deepEqual(first.slice(0, 4).map(d => shardAt(d, f, 2.8)), states);
  assert.deepEqual(first, before);
  assert.equal(shardAt(first[0], f, -1).gain, 0);
  assert.equal(shardAt(first[0], f, f.end).gain, 0);
});

test('assembly and fracture independently expose useful phase endpoints', () => {
  const w = config().words[1];
  assert.ok(wordAt(w, 2).assembly.every(x => x === 1));
  assert.ok(wordAt(w, 4).assembly.every(x => x === 0));
  assert.equal(wordAt(w, 4).fracture, 0);
  assert.equal(wordAt(w, 5).fracture, 1);
  assert.ok(wordAt(w, 4.5).fracture > 0 && wordAt(w, 4.5).fracture < 1);
});

test('transition phases are configurable and do not depend on previous frames', () => {
  const s = {start: 2, durations: {bloom: 1, hold: 1, collapse: 1, line: 1, reveal: 1}};
  assert.equal(transitionAt(s, 1).opacity, 0);
  assert.equal(transitionAt(s, 3.5).opacity, 1);
  assert.ok(transitionAt(s, 4.5).height < 1);
  assert.equal(transitionAt(s, 5.5).line, 1);
  assert.equal(transitionAt(s, 6.5).reveal, 0.5);
  assert.deepEqual(transitionAt(s, 3.5), {opacity: 1, height: 1, line: 0, reveal: 0});
  assert.equal(transitionAt(s, 7).line, 0);
});

test('invalid dimensions, paths, geometry and unbounded field sizes fail before rendering', () => {
  for (const mutate of [c => c.duration = 0, c => c.width = NaN,
    c => c.camera.keys[1].time = c.camera.keys[0].time,
    c => c.camera.keys[0].target = c.camera.keys[0].position,
    c => c.words[1].id = c.words[0].id,
    c => c.words[0].geometry = {curveSegments: 0},
    c => c.fields[0].count = 50000, c => c.fields[0].alphabet = ' ',
    c => c.fields[0].scale = [-1, 1], c => c.motionBlur.samples = 100,
    c => c.environment = {width: 17}]) {
    const c = structuredClone(recipe); mutate(c); assert.throws(() => normalize(c));
  }
});

test('override changes content, style, duration and path without mutating the source recipe', () => {
  const original = JSON.stringify(recipe);
  const changed = mergeConfig(recipe, {duration: 4, materials: {face: {color: '#b97842'}},
    words: [{id: 'custom', text: 'Depth 42!', font: 'compact'}], camera: {keys: [
      {time: 0, position: [2, 1, 10], target: [0, 0, 0]}, {time: 4, position: [-2, 0, 8], target: [0, 0, 0]}]}});
  const c = normalize(changed);
  assert.equal(c.words[0].text, 'Depth 42!'); assert.equal(c.duration, 4);
  assert.equal(c.materials.face.color, '#b97842'); assert.equal(c.materials.face.roughness, 0.12);
  assert.equal(JSON.stringify(recipe), original);
});

test('full bundled geometry supports lowercase, digits, accents and correct multi-hole glyphs', () => {
  for (const data of [wide, compact]) {
    assert.equal(Object.keys(data.glyphs).length, 528);
    const font = new Font(structuredClone(data));
    assert.equal(font.generateShapes('O', 1)[0].holes.length, 1);
    assert.equal(font.generateShapes('B', 1)[0].holes.length, 2);
    for (const ch of 'Depth 42! éÅ') assert.ok(data.glyphs[ch], ch);
    const spec = normalize({...recipe, words: [{text: 'Depth 42! éÅ'}]}).words[0];
    const word = buildWord(font, spec);
    assert.ok(word.width > 5); assert.equal(word.letters.length, 10);
    assert.ok(word.letters.every(l => l.geometry.attributes.position.count > 0)); release(word);
  }
});

test('clipped slabs have independent planes/materials and follow transformed geometry', () => {
  const c = config(), font = new Font(structuredClone(wide));
  const a = buildWord(font, c.words[1]), b = buildWord(font, c.words[1]);
  assert.equal(a.pieces.length, a.letters.length * 2);
  assert.notEqual(a.pieces[0].face, b.pieces[0].face);
  const before = a.pieces[0].local[0].constant;
  a.group.position.set(2, 3, -10); a.group.rotation.z = 0.2; a.group.updateMatrixWorld(true); updateClipping(a);
  assert.equal(a.pieces[0].local[0].constant, before);
  assert.notEqual(a.pieces[0].face.clippingPlanes[0].constant, before);
  assert.equal(b.pieces[0].face.clippingPlanes[0].constant, before);
  assert.ok(Math.abs(a.pieces[0].face.clippingPlanes[0].normal.length() - 1) < 1e-9);
  release(a); release(b);
});

test('unsupported font/glyph is rejected before requesting a WebGL context', async () => {
  let requests = 0;
  const canvas = {getContext() {requests++; throw new Error('context requested');}};
  const unknown = structuredClone(recipe); unknown.words[0].font = 'missing';
  await assert.rejects(createSpatialType(canvas, unknown), /cap-height H/);
  const unsupported = structuredClone(recipe); unsupported.words[0].text = '字';
  await assert.rejects(createSpatialType(canvas, unsupported), /lacks/);
  assert.equal(requests, 0);
});

test('font derivations retain exact input/output hashes and pinned library notice', () => {
  const dir = path.join(HERE, 'assets/type'), provenance = JSON.parse(fs.readFileSync(path.join(dir, 'provenance.json')));
  for (const entry of [...provenance.inputs, ...provenance.outputs]) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, entry.file))).digest('hex'), entry.sha256);
  assert.equal(JSON.parse(fs.readFileSync(path.join(HERE, 'vendor/three/package.json'))).version, '0.170.0');
  assert.match(fs.readFileSync(path.join(dir, 'OFL.txt'), 'utf8'), /SIL OPEN FONT LICENSE/);
});

test('builder emits portable local recipe/assets and refuses to overwrite an edited project', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'spatial-type-test-'));
  try {
    const c = {...recipe, duration: 7, width: 1080, height: 1080};
    const result = buildProject(dest, c), html = fs.readFileSync(path.join(dest, 'index.html'), 'utf8');
    assert.equal(result.duration, 7); assert.match(html, /data-duration="7"/); assert.match(html, /data-width="1080"/);
    assert.ok(fs.existsSync(path.join(dest, 'compositions/components/spatial-type/vendor/three/LICENSE')));
    assert.ok(fs.existsSync(path.join(dest, 'compositions/components/spatial-type/assets/type/anybody-w150-800.mjs')));
    assert.equal(fs.existsSync(path.join(dest, 'compositions/components/spatial-type/model.test.mjs')), false);
    fs.writeFileSync(result.recipe, '// authored change\n');
    assert.throws(() => buildProject(dest, recipe), /must be empty/);
    assert.equal(fs.readFileSync(result.recipe, 'utf8'), '// authored change\n');
  } finally {fs.rmSync(dest, {recursive: true, force: true});}
});
