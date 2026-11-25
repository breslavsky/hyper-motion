// kinetic-burst-words: a line built of solids that breaks at the camera.
// Its recipe, its times, and the geometry that needs no renderer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import font from '../source/lib/fonts/geometry/onest-600.mjs';
import {loops, half, solids, shatter, lay, seeded, area2} from '../source/lib/components/kinetic-burst.mjs';

const require = createRequire(import.meta.url);
const scene = require('../source/lib/components/metadata.cjs')['kinetic-burst-words'];
const catalog = require('../source/lib/components/catalog.json');
const film = require('../source/lib/film.cjs');
const problems = extra => film.problems({aspect: '16:9', style: 'noir', brand: {name: 'Nook'}, scenes: [{...scene.sample, ...extra}]});
const filled = shape => Math.abs(shape.reduce((sum, loop) => sum + area2(loop), 0)) / 2;

test('the sample is a film of the Kinetic Text section, in a family of its own', () => {
  assert.deepEqual(problems({}), []);
  assert.equal(scene.section, 'Kinetic Text');
  assert.deepEqual(catalog['kinetic-burst-words'], {family: 'kinetic3d', renderMode: 'webgl', owned: true, ground: 'kinetic'});
});

test('the line is short and of letters the font has', () => {
  assert.deepEqual(problems({text: 'Поделись.'}), []);
  assert.match(problems({text: 'one two three four five'}).join(), /5 words|at most 18/);
  assert.match(problems({text: '分享 it'}).join(), /cannot be built/);
  assert.match(problems({beats: 5}).join(), /beats: 2 to 4/);
  assert.equal(scene.font.file, 'fonts/geometry/onest-600.mjs');
  assert.equal(font.family, scene.font.family);
  assert.equal(font.weight, scene.font.weight);
  for (const ch of 'AZazАЯая09.,!?') assert.ok(font.glyphs[ch], ch);
  assert.throws(() => lay(font, '分'), /has no "分"/);
});

test('it bursts on a beat, soon after it stands, and is gone before the scene ends', () => {
  for (const [beats, bpm] of [[2, 120], [3, 120], [4, 96], [4, 140], [3, 72]]) {
    const beat = 60 / bpm, len = beats * beat, t = scene.times(scene.sample, len, beat);
    assert.ok(0 <= t.start && t.start < t.grown && t.grown < t.apart && t.apart < t.settle && t.settle < t.burst && t.burst < t.gone && t.gone < len, JSON.stringify(t));
    assert.ok(Math.abs(t.burst / beat - Math.round(t.burst / beat)) < 1e-9, `burst off the beat: ${t.burst}`);
    assert.ok(Math.abs(t.burst - t.settle - beat * .25) < 1e-9, 'it bursts a quarter of a beat after it stands');
    const cues = [];
    scene.sounds(scene.sample, len, (at, kind) => cues.push([at, kind]), beat);
    assert.deepEqual(cues.map(cue => cue[1]), ['pop', 'click', 'whoosh']);
    assert.equal(cues[2][0], t.burst);
  }
});

test('a shape cut by a line comes out as whole pieces that add up to it', () => {
  // A square with a square hole, cut through the hole: two solid brackets and no hole left.
  const ring = [[[0, 0], [0, 10], [10, 10], [10, 0]], [[3, 3], [7, 3], [7, 7], [3, 7]]];
  const left = half(ring, [5, 5], [-1, 0]), right = half(ring, [5, 5], [1, 0]);
  assert.equal(left.length, 1);
  assert.equal(right.length, 1);
  assert.ok(Math.abs(filled(left) - 42) < 1e-6 && Math.abs(filled(right) - 42) < 1e-6);
  assert.deepEqual(solids(left).map(solid => solid.holes.length), [0]);
  // A cut that misses the hole leaves it a hole.
  assert.deepEqual(solids(half(ring, [1, 5], [1, 0])).map(solid => solid.holes.length), [1]);
  assert.equal(half(ring, [20, 5], [1, 0]).length, 0);
});

test('every glyph of the font breaks into pieces that add up to the glyph', () => {
  const random = seeded(7);
  let cut = 0, glyphs = 0;
  for (const [ch, [, path]] of Object.entries(font.glyphs)) {
    if (!path) continue;
    const shape = loops(path), pieces = shatter(shape, random, font.unitsPerEm);
    assert.ok(pieces.length >= 1, ch);
    const whole = solids(shape, font.unitsPerEm ** 2 * 2e-5);
    const sum = list => list.reduce((s, solid) => s + (Math.abs(area2(solid.outer)) - solid.holes.reduce((h, hole) => h + Math.abs(area2(hole)), 0)) / 2, 0);
    assert.ok(Math.abs(sum(pieces) - sum(whole)) <= sum(whole) * 0.03 + 1, `${ch}: ${sum(pieces)} of ${sum(whole)}`);
    for (const piece of pieces) assert.ok(piece.outer.length >= 3 && Number.isFinite(piece.middle[0]) && piece.size > 0, ch);
    glyphs++; if (pieces.length > whole.length) cut++;
  }
  assert.ok(glyphs > 600 && cut > glyphs * 0.8, `${cut} of ${glyphs} glyphs break`);
});

test('the same line breaks the same way every time', () => {
  const once = () => { const random = seeded(42); return lay(font, 'Share it.').units.map(unit => shatter(loops(unit.path), random, font.unitsPerEm).map(piece => piece.middle)); };
  assert.deepEqual(once(), once());
  const line = lay(font, '  Share   it. ');
  assert.equal(line.words, 2);
  assert.deepEqual(line.units.map(unit => unit.ch).join(''), 'Shareit.');
  assert.deepEqual(line.units.map(unit => unit.word), [0, 0, 0, 0, 0, 1, 1, 1]);
});
