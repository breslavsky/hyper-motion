// kinetic-spin-words: a line whose letters stand on a ring that turns. Its
// recipe is refused in words when the line cannot turn that way, and it
// stands on a beat.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const scene = require('../source/lib/components/metadata.cjs')['kinetic-spin-words'];
const swap = require('../source/lib/components/metadata.cjs')['kinetic-swap-words'];
const catalog = require('../source/lib/components/catalog.json');
const film = require('../source/lib/film.cjs');
const problems = extra => film.problems({aspect: '16:9', style: 'noir', brand: {name: 'Nook'}, scenes: [{...scene.sample, ...extra}]});

test('the sample is a film of the Kinetic Text family, on its ground and in the font of the film', () => {
  assert.deepEqual(problems({}), []);
  assert.equal(scene.section, 'Kinetic Text');
  assert.equal(catalog['kinetic-spin-words'].ground, 'kinetic');
  // The sign of tubes and its font belong to the line that is edited, not to this one.
  assert.equal(scene.font, undefined);
  assert.equal(scene.fonts, undefined);
  assert.equal(swap.font, 'Comfortaa');
});

test('a line of one to four words turns one to four whole times, with a beat to stand in', () => {
  assert.match(problems({text: 'One two three four five'}).join(), /5 words; the line has 1 to 4/);
  assert.match(problems({turns: 5}).join(), /turns/);
  assert.match(problems({turns: 1.5}).join(), /turns: a whole number/);
  assert.match(problems({turns: 4, beats: 4}).join(), /4 turns need at least 5 beats/);
  assert.deepEqual(problems({turns: 4, beats: 5}), []);
});

test('what turns as one is a letter, a space, or a whole word of a joined script', () => {
  assert.deepEqual(scene.units('Loop it.'), ['L', 'o', 'o', 'p', ' ', 'i', 't', '.']);
  assert.deepEqual(scene.units('  a   b '), ['a', ' ', 'b']);
  assert.deepEqual(scene.units('مرحبا بكم'), ['مرحبا', ' ', 'بكم']);
  assert.equal(scene.units('👍🏽 ok').length, 4);
});

test('the line starts to turn at once and stands on a beat, with time left to be read', () => {
  for (const [beats, bpm, turns] of [[3, 120, 1], [4, 120, 2], [5, 96, 3], [6, 140, 4], [4, 72, 2]]) {
    const beat = 60 / bpm, len = beats * beat, s = {...scene.sample, beats, turns}, t = scene.times(s, len, beat);
    assert.ok(t.start >= 0 && t.start < beat * .2 && t.land > t.start && t.land <= len * .72 + 1e-9, JSON.stringify(t));
    assert.ok(Math.abs(t.land / beat - Math.round(t.land / beat)) < 1e-6 || Math.abs(t.land - len * .72) < 1e-6, `it stands off the beat: ${t.land}`);
    const cues = [];
    scene.sounds(s, len, (at, kind) => cues.push([at, kind]), beat);
    assert.deepEqual(cues.map(cue => cue[1]), [...Array(turns).fill('whoosh'), 'pop']);
    assert.ok(cues.every(([at], i) => at >= t.start - 1e-9 && at <= t.land + 1e-9 && (!i || at >= cues[i - 1][0])) && cues.at(-1)[0] === t.land);
  }
});
