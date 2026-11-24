// The glass-like scene: a button's words are short, its icon one of the set,
// and a scene too short for the press to be seen is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const scene = require('../source/lib/components/metadata.cjs')['glass-like'];
const film = require('../source/lib/film.cjs');
const problems = extra => film.problems({aspect: '9:16', style: 'glass', brand: {name: 'Nook'}, scenes: [{...scene.sample, ...extra}]});

test('the sample is a film; a word is twelve characters at most and the icon one of the set', () => {
  assert.deepEqual(problems({}), []);
  assert.deepEqual(problems({text: 'Subscribe', icon: 'bell'}), []);
  assert.match(problems({text: 'x'.repeat(13)}).join(), /at most 12/);
  // The word stays as it is when the button is pressed: there is no second word.
  assert.ok(problems({after: 'Liked'}).length);
  assert.match(problems({icon: 'rocket'}).join(), /icon/);
  assert.deepEqual(scene.fields.icon.values, ['like', 'heart', 'star', 'bell', 'save', 'plus', 'check']);
});

test('every icon of the button is in the vendored set', async () => {
  const {islandIcons} = await import('../source/lib/components/upstream/lucide-static/icons.mjs');
  for (const name of scene.fields.icon.values) assert.ok(islandIcons[name], name);
});

test('the pointer comes, then clicks, and a folding pill leaves after the press has been seen', () => {
  for (const len of [2, 3, 4]) {
    const marks = scene.anchors(scene.sample, len);
    assert.ok(marks.open < marks.reach && marks.reach + .4 < marks.click, 'the pointer has time to come up');
    assert.ok(marks.click + .8 <= marks.collapse + 1e-9 && marks.collapse < len);
  }
});

test('a scene has the beats the press needs to be seen', () => {
  const needs = scene.needs(scene.sample);
  assert.ok(needs >= 3 && needs <= 6);
  assert.match(problems({beats: needs - 1}).join(), new RegExp(`needs at least ${needs} beats`));
  assert.deepEqual(problems({beats: needs}), []);
  assert.ok(scene.needs({...scene.sample, exit: 'collapse'}) >= needs);
});

test('a pop for the pill, a click and a chime for the press, a whoosh for a folding pill', () => {
  const cues = extra => { const out = []; scene.sounds({...scene.sample, ...extra}, 3, (at, kind) => out.push(kind)); return out; };
  assert.deepEqual(cues({}), ['pop', 'click', 'chime']);
  assert.deepEqual(cues({exit: 'collapse'}), ['pop', 'click', 'chime', 'whoosh']);
});

test('it is placed over footage like the other panels', () => {
  assert.deepEqual(problems({size: 'small', place: 'bottom-right'}), []);
  assert.match(problems({place: 'centre'}).join(), /place must be one of/);
});
