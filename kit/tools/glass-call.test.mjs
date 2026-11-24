// The glass-call scene: a call rings and is taken, or only rings, and a scene
// too short for that to be seen is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const scene = require('../source/lib/components/metadata.cjs')['glass-call'];
const film = require('../source/lib/film.cjs');
const problems = extra => film.problems({aspect: '9:16', style: 'glass', brand: {name: 'Nook'}, scenes: [{...scene.sample, ...extra}]});

test('the sample is a film; a name and a status have their limits', () => {
  assert.deepEqual(problems({}), []);
  assert.deepEqual(problems({status: 'Video call', answer: false}), []);
  // Measured in the native browser: at these limits the name takes two lines
  // at most and the status one, beside the two buttons, in every frame shape.
  assert.match(problems({name: 'x'.repeat(17)}).join(), /at most 16/);
  assert.match(problems({status: 'x'.repeat(15)}).join(), /at most 14/);
  assert.ok(problems({name: undefined}).length && problems({answer: 'yes'}).length);
});

test('the icons of the call are in the vendored set', async () => {
  const {islandIcons} = await import('../source/lib/components/upstream/lucide-static/icons.mjs');
  for (const name of ['phone', 'phone-off', 'user']) assert.ok(islandIcons[name], name);
});

test('the call rings before the pointer comes, is taken, and a folding panel leaves after it has run', () => {
  for (const len of [3, 4, 6]) {
    const marks = scene.anchors(scene.sample, len);
    assert.ok(marks.open < marks.name && marks.name < marks.reach && marks.reach + .4 < marks.answer);
    assert.ok(marks.answer + 1.2 <= marks.collapse + 1e-9 && marks.collapse < len);
  }
});

test('a scene has the beats the call needs: fewer when it only rings', () => {
  const taken = scene.needs(scene.sample), rings = scene.needs({...scene.sample, answer: false});
  assert.ok(rings < taken && taken <= 8, `${rings} < ${taken} <= 8`);
  assert.match(problems({beats: taken - 1}).join(), new RegExp(`needs at least ${taken} beats to ring and be taken`));
  assert.deepEqual(problems({beats: taken}), []);
  assert.match(problems({beats: rings - 1, answer: false}).join(), new RegExp(`needs at least ${rings} beats to ring$`));
});

test('a pop for the panel, two rings and a click when it is taken; it goes on ringing when it is not', () => {
  const cues = extra => { const out = []; scene.sounds({...scene.sample, ...extra}, 5, (at, kind) => out.push(kind)); return out; };
  assert.deepEqual(cues({}), ['pop', 'chime', 'chime', 'click']);
  assert.deepEqual(cues({answer: false}), ['pop', 'chime', 'chime']);
  assert.deepEqual(cues({exit: 'collapse'}), ['pop', 'chime', 'chime', 'click', 'whoosh']);
});

test('it is placed over footage like the other panels, at both sizes', () => {
  assert.deepEqual(problems({size: 'small', place: 'top'}), []);
  assert.match(problems({place: 'centre'}).join(), /place must be one of/);
});
