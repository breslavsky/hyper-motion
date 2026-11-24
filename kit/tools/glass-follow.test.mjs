// The glass-follow scene: one network of the vendored set, a handle, a button
// that is pressed, and a scene too short for the press to be seen is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const scene = require('../source/lib/components/metadata.cjs')['glass-follow'];
const film = require('../source/lib/film.cjs');
const {syncSocialIcons} = require('./sync-social-icons.cjs');
const problems = extra => film.problems({aspect: '9:16', style: 'glass', brand: {name: 'Nook'}, scenes: [{...scene.sample, ...extra}]});

test('the sample is a film; a network is one of the set, a handle twenty characters at most', () => {
  assert.deepEqual(problems({}), []);
  for (const network of scene.fields.network.values) assert.deepEqual(problems({network}), [], network);
  assert.match(problems({network: 'linkedin'}).join(), /network/);
  assert.match(problems({handle: 'x'.repeat(21)}).join(), /at most 20/);
  assert.match(problems({text: 'x'.repeat(13)}).join(), /at most 12/);
  assert.ok(problems({network: undefined}).length && problems({handle: undefined}).length);
});

test('every network of the scene is a vendored mark with its colour, and the map is what its receipt writes', async () => {
  const {socialIcons} = await import('../source/lib/components/upstream/simple-icons/icons.mjs');
  assert.deepEqual(Object.keys(socialIcons).sort(), [...scene.fields.network.values].sort());
  for (const [name, mark] of Object.entries(socialIcons)) {
    assert.match(mark.hex, /^#[0-9A-F]{6}$/i, name);
    assert.ok(mark.svg.includes('<path') && mark.title, name);
  }
  // The generator checks every file against the receipt and rewrites the map only if it differs.
  const target = syncSocialIcons(), before = fs.readFileSync(target, 'utf8');
  assert.equal(fs.readFileSync(syncSocialIcons(), 'utf8'), before);
});

test('the pointer comes after the handle, then presses, and a folding panel leaves after the press has been seen', () => {
  for (const len of [2.5, 3.5, 4]) {
    const marks = scene.anchors(scene.sample, len);
    assert.ok(marks.open < marks.handle && marks.handle < marks.reach && marks.reach + .4 < marks.click);
    assert.ok(marks.click + .8 <= marks.collapse + 1e-9 && marks.collapse < len);
  }
});

test('a scene has the beats the press needs to be seen', () => {
  const needs = scene.needs(scene.sample);
  assert.ok(needs >= 3 && needs <= 7);
  assert.match(problems({beats: needs - 1}).join(), new RegExp(`needs at least ${needs} beats`));
  assert.deepEqual(problems({beats: needs}), []);
});

test('a pop for the panel, a click and a chime for the press', () => {
  const cues = extra => { const out = []; scene.sounds({...scene.sample, ...extra}, 3.5, (at, kind) => out.push(kind)); return out; };
  assert.deepEqual(cues({}), ['pop', 'click', 'chime']);
  assert.deepEqual(cues({exit: 'collapse'}), ['pop', 'click', 'chime', 'whoosh']);
});

test('it is placed over footage like the other panels, at both sizes', () => {
  assert.deepEqual(problems({size: 'small', place: 'bottom-right'}), []);
  assert.match(problems({place: 'centre'}).join(), /place must be one of/);
});
