// The glass-checklist scene: its limits keep every item readable and inside
// its panel, and a scene too short for its list to be ticked off is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const scene = require('../source/lib/components/metadata.cjs')['glass-checklist'];
const film = require('../source/lib/film.cjs');
const problems = extra => film.problems({aspect: '9:16', style: 'glass', brand: {name: 'Nook'}, scenes: [{...scene.sample, ...extra}]});

test('the sample is a film and its limits are the measured ones', () => {
  assert.deepEqual(problems({}), []);
  assert.deepEqual([scene.fields.items.min, scene.fields.items.max, scene.fields.items.of.max, scene.fields.title.max], [2, 5, 40, 32]);
  assert.match(problems({items: ['Brief', 'x'.repeat(41)]}).join(), /at most 40/);
  assert.match(problems({title: 'x'.repeat(33)}).join(), /at most 32/);
  assert.match(problems({items: ['one two three four five six seven eight', 'Done']}).join(), /8 words; an item is a phrase of 7 words at most/);
  assert.ok(problems({items: ['Only one']}).length && problems({items: ['a', 'b', 'c', 'd', 'e', 'f']}).length);
});

test('done says how many items are ticked, from the top, and is no more than the list', () => {
  assert.deepEqual(problems({done: 2}), []);
  assert.deepEqual(problems({done: 0}), []);
  assert.match(problems({done: 5}).join(), /done: 5; it is how many of the 4 items are ticked/);
  assert.match(problems({done: 1.5}).join(), /done: 1.5/);
});

test('a scene has the beats its list needs, more for a longer list and for a panel that folds', () => {
  const long = ['Brief approved by the whole team', 'Footage uploaded from every camera', 'Captions checked in both languages', 'Music licensed for all the feeds', 'Export sent to the client today'];
  const short = scene.needs({items: ['Brief', 'Footage']}), full = scene.needs({items: long});
  assert.ok(short < full && full <= 12, `${short} < ${full} <= 12: the longest allowed list fits the scene's usual length`);
  assert.ok(scene.needs({items: long, exit: 'collapse'}) > full);
  assert.match(problems({beats: full - 1, items: long}).join(), new RegExp(`needs at least ${full} beats`));
  assert.deepEqual(problems({beats: full, items: long}), []);
});

test('items come in one after another, each ticked after it is read, and a folding panel leaves after the last tick', () => {
  for (const len of [3, 4.5, 6]) {
    const marks = scene.anchors({items: ['a b', 'c d e', 'f', 'g h i j']}, len);
    assert.ok(marks.open < marks.title && marks.title < marks.items[0]);
    marks.items.slice(1).forEach((at, i) => assert.ok(at > marks.items[i]));
    marks.ticks.forEach((at, i) => assert.ok(at > marks.items[i], 'a tick follows its item'));
    assert.ok(marks.ticks.at(-1) < marks.leave && marks.leave < marks.collapse && marks.collapse < len);
  }
});

test('a sound for the panel, a tick for every ticked item and a chime only when the list is done', () => {
  const cues = extra => { const out = []; scene.sounds({...scene.sample, ...extra}, 4, (at, kind) => out.push(kind)); return out; };
  assert.deepEqual(cues({}), ['pop', 'tick', 'tick', 'tick', 'tick', 'chime']);
  assert.deepEqual(cues({done: 2}), ['pop', 'tick', 'tick']);
  assert.deepEqual(cues({exit: 'collapse'}), ['pop', 'tick', 'tick', 'tick', 'tick', 'whoosh']);
});

test('a small panel takes four items of 28 characters and a title of 24', () => {
  assert.deepEqual(problems({size: 'small', place: 'bottom-left'}), []);
  assert.match(problems({size: 'small', items: ['a', 'b', 'c', 'd', 'e']}).join(), /5 of them; a small panel takes 4 at most/);
  assert.match(problems({size: 'small', items: ['Brief', 'x'.repeat(29)]}).join(), /items\[1\]: 29 characters; a small panel takes 28 at most/);
  assert.match(problems({size: 'small', title: 'x'.repeat(25)}).join(), /title: 25 characters; a small panel takes 24 at most/);
});
