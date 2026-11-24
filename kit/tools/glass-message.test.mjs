// The glass-message scene: who writes, when and what, and a scene too short
// for the message to be read is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const scene = require('../source/lib/components/metadata.cjs')['glass-message'];
const film = require('../source/lib/film.cjs');
const problems = extra => film.problems({aspect: '9:16', style: 'glass', brand: {name: 'Nook'}, scenes: [{...scene.sample, ...extra}]});

test('the sample is a film; a name, a message and a time have their limits', () => {
  assert.deepEqual(problems({}), []);
  assert.deepEqual(problems({time: undefined}), []);
  // Measured in the native browser: at these limits the message stays in the
  // first step of its role, three lines at most, in every frame shape.
  assert.match(problems({name: 'x'.repeat(19)}).join(), /at most 18/);
  assert.match(problems({text: 'x'.repeat(61)}).join(), /at most 60/);
  assert.match(problems({time: 'x'.repeat(9)}).join(), /at most 8/);
  assert.ok(problems({name: undefined}).length && problems({text: undefined}).length);
});

test('the name comes after the panel opens, the message after the name, a folding panel after it is read', () => {
  for (const len of [2.5, 4, 6]) {
    const marks = scene.anchors(scene.sample, len);
    assert.ok(marks.open < marks.name && marks.name < marks.text && marks.text + 1 <= marks.collapse + 1e-9 && marks.collapse < len);
  }
});

test('a scene has the beats its message needs to be read, more for a longer one and for a panel that folds', () => {
  const long = 'I watched the whole film twice and the ending is perfect.';
  const short = scene.needs({text: 'On my way.'}), full = scene.needs({text: long});
  assert.ok(long.length <= 60 && short < full && full <= 12, `${short} < ${full} <= 12`);
  assert.ok(scene.needs({text: long, exit: 'collapse'}) >= full);
  assert.match(problems({beats: full - 1, text: long}).join(), new RegExp(`needs at least ${full} beats`));
  assert.deepEqual(problems({beats: full, text: long}), []);
});

test('a pop for the panel and a chime for the message; a whoosh for a folding panel', () => {
  const cues = extra => { const out = []; scene.sounds({...scene.sample, ...extra}, 4, (at, kind) => out.push(kind)); return out; };
  assert.deepEqual(cues({}), ['pop', 'chime']);
  assert.deepEqual(cues({exit: 'collapse'}), ['pop', 'chime', 'whoosh']);
});

test('it is placed over footage like the other panels, at both sizes', () => {
  assert.deepEqual(problems({size: 'small', place: 'top'}), []);
  assert.match(problems({place: 'centre'}).join(), /place must be one of/);
});
