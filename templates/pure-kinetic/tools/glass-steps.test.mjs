// The glass-steps scene: its limits keep every step readable and inside its
// panel, and a scene too short for its steps to be read is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const scene = require('../source/lib/components/metadata.cjs')['glass-steps'];
const film = require('../source/lib/film.cjs');
const problems = extra => film.problems({aspect: '9:16', style: 'glass', brand: {name: 'Nook'}, scenes: [{...scene.sample, ...extra}]});

test('the sample is a film and its limits are the measured ones', () => {
  assert.deepEqual(problems({}), []);
  assert.deepEqual([scene.fields.items.min, scene.fields.items.max, scene.fields.items.of.max, scene.fields.title.max], [2, 4, 48, 32]);
  assert.match(problems({items: ['Upload', 'x'.repeat(49)]}).join(), /at most 48/);
  assert.match(problems({title: 'x'.repeat(33)}).join(), /at most 32/);
  assert.match(problems({items: ['one two three four five six seven eight nine', 'Export']}).join(), /9 words; a step is a phrase of 8 words at most/);
  assert.ok(problems({items: ['Only one']}).length && problems({items: ['a', 'b', 'c', 'd', 'e']}).length);
});

test('a scene has the beats its steps need to be read, more for longer steps and for a panel that folds', () => {
  const long = ['Upload recorded footage from any device you own', 'Pick a style that fits the brand', 'Review the cut with your team', 'Export in 4K for every feed'];
  const short = scene.needs({items: ['Upload', 'Pick', 'Export']}), full = scene.needs({items: long});
  assert.ok(short < full && full <= 12, `${short} < ${full} <= 12: the longest allowed list fits the scene's usual length`);
  assert.ok(scene.needs({items: long, exit: 'collapse'}) > full);
  assert.match(problems({beats: 6, items: long}).join(), new RegExp(`need at least ${full} beats`));
  assert.deepEqual(problems({beats: full, items: long}), []);
});

test('steps come in one after another and a folding panel hops, then folds, after the last of them', () => {
  for (const len of [3, 4.5, 6]) {
    const marks = scene.anchors({items: ['a', 'b', 'c', 'd']}, len);
    assert.ok(marks.open < marks.title && marks.title < marks.items[0]);
    marks.items.slice(1).forEach((at, i) => assert.ok(at > marks.items[i]));
    assert.ok(marks.items.at(-1) < marks.wave && marks.wave < marks.collapse && marks.collapse < len);
  }
});

test('a small panel takes three steps of 32 characters and a title of 24', () => {
  assert.deepEqual(problems({size: 'small', place: 'bottom-left'}), []);
  assert.match(problems({size: 'small', items: ['a', 'b', 'c', 'd']}).join(), /4 of them; a small panel takes 3 at most/);
  assert.match(problems({size: 'small', items: ['Upload', 'x'.repeat(33)]}).join(), /items\[1\]: 33 characters; a small panel takes 32 at most/);
  assert.match(problems({size: 'small', title: 'x'.repeat(25)}).join(), /title: 25 characters; a small panel takes 24 at most/);
  assert.match(problems({place: 'centre'}).join(), /place must be one of/);
});
