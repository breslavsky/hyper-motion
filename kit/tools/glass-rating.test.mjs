// The glass-rating scene: a rating is whole or half stars, and a scene too
// short for it to be given and seen is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const scene = require('../source/lib/components/metadata.cjs')['glass-rating'];
const film = require('../source/lib/film.cjs');
const problems = extra => film.problems({aspect: '9:16', style: 'glass', brand: {name: 'Nook'}, scenes: [{...scene.sample, ...extra}]});

test('the sample is a film; a rating is 0 to 5 in whole or half stars', () => {
  assert.deepEqual(problems({}), []);
  for (const stars of [0, .5, 3, 5]) assert.deepEqual(problems({stars}), [], String(stars));
  assert.deepEqual(problems({stars: undefined, title: undefined, caption: undefined}), []);
  assert.match(problems({stars: 4.3}).join(), /stars: 4.3; a rating is whole or half stars/);
  assert.ok(problems({stars: 6}).length && problems({stars: -1}).length);
  assert.match(problems({title: 'x'.repeat(41)}).join(), /at most 40/);
  assert.match(problems({caption: 'x'.repeat(37)}).join(), /at most 36/);
});

test('the stars fill one after another, after the question and before the caption and a folding panel', () => {
  for (const len of [2, 3, 4]) {
    const marks = scene.anchors(scene.sample, len);
    assert.ok(marks.open < marks.title && marks.title < marks.stars[0]);
    marks.stars.slice(1).forEach((at, i) => assert.ok(at > marks.stars[i]));
    assert.ok(marks.stars.at(-1) < marks.caption && marks.caption < marks.collapse && marks.collapse < len);
  }
});

test('a scene has the beats the rating needs to be given and seen, more with a caption', () => {
  const bare = scene.needs({stars: 5}), said = scene.needs(scene.sample);
  assert.ok(bare >= 3 && bare <= said && said <= 6, `${bare} <= ${said} <= 6`);
  assert.match(problems({beats: said - 1}).join(), new RegExp(`needs at least ${said} beats`));
  assert.deepEqual(problems({beats: said}), []);
});

test('a tick for every star the rating reaches and a chime when it is given', () => {
  const cues = extra => { const out = []; scene.sounds({...scene.sample, ...extra}, 3, (at, kind) => out.push(kind)); return out; };
  assert.deepEqual(cues({stars: 5}), ['pop', 'tick', 'tick', 'tick', 'tick', 'tick', 'chime']);
  assert.deepEqual(cues({stars: 2.5}), ['pop', 'tick', 'tick', 'tick', 'chime']);
  assert.deepEqual(cues({stars: 0}), ['pop']);
  assert.deepEqual(cues({stars: 3, exit: 'collapse'}), ['pop', 'tick', 'tick', 'tick', 'whoosh']);
});

test('a small panel takes the same texts, at any of the nine places', () => {
  assert.deepEqual(problems({size: 'small', place: 'top-right'}), []);
  assert.deepEqual(problems({size: 'small', title: 'x'.repeat(40), caption: 'y'.repeat(36)}), []);
  assert.match(problems({place: 'centre'}).join(), /place must be one of/);
});
