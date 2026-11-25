// The synth3d scene: its place in the catalogue, the three hits its picture,
// hands, words and sounds share, and the hands' take they are cut to.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const definitions = require('../source/lib/components/metadata.cjs');
const beats = require('../source/lib/beats.json');
const catalog = require('../source/lib/components/catalog.json');
const scene = definitions.synth3d;

test('synth3d is a scene of the three family with its hands at our public address', () => {
  assert.deepEqual(catalog.synth3d, {family: 'three', renderMode: 'webgl'});
  assert.deepEqual(beats.synth3d, [3, 8]);
  assert.match(scene.public, /^https:\/\/motion-fab-share\.b-cdn\.net\/components\/synth3d$/);
  assert.deepEqual(scene.validate(scene.sample), []);
});

test('the take holds three touches inside its frames, in order, on three pads', () => {
  const {times, hits, pads, cols, rows} = scene.play;
  assert.ok(times.length <= cols * rows);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1]);
  assert.equal(hits.length, 3); assert.equal(pads.length, 3);
  for (const [i, at] of hits.entries()) {
    assert.ok(at > times[0] && at < times.at(-1));
    assert.ok(times.includes(at), 'a touch is a frame of the take');
    if (i) assert.ok(at > hits[i - 1]);
  }
  for (const pad of pads) assert.ok(Number.isInteger(pad) && pad >= 0 && pad < 8);
});

test('without hits the three fall inside any length the scene may have', () => {
  for (let count = beats.synth3d[0]; count <= beats.synth3d[1]; count++) {
    assert.deepEqual(scene.validate({type: 'synth3d', beats: count}), [], `${count} beats`);
    const hits = scene.hits({beats: count}, count * .5, .5);
    assert.deepEqual(hits.map(hit => hit.pad), scene.play.pads);
    assert.ok(hits.at(-1).at <= (count - 1) * .5 + 1e-9);
  }
});

test('the film names the three beats; they rise, half a beat apart, on quarters, before the end', () => {
  assert.deepEqual(scene.validate({hits: [1, 2.5, 4], beats: 6}), []);
  assert.deepEqual(scene.hits({hits: [1, 2.5, 4]}, 3, .5).map(hit => hit.at), [.5, 1.25, 2]);
  assert.match(scene.validate({hits: [1, 1.25, 2]}).join(), /half a beat apart/);
  assert.match(scene.validate({hits: [2, 1, 3]}).join(), /rising order/);
  assert.match(scene.validate({hits: [1, 2, 2.3]}).join(), /quarter of a beat/);
  assert.match(scene.validate({hits: [2, 3, 6], beats: 6}).join(), /before the scene's end/);
});

test('every hit has a sound and nothing else sounds', () => {
  const cues = [];
  scene.sounds({}, 3, (at, kind, strength) => cues.push({at, kind, strength}), .5);
  assert.deepEqual(cues.map(cue => cue.at), scene.hits({}, 3, .5).map(hit => hit.at));
  for (const cue of cues) assert.ok(['pop', 'tick', 'ping'].includes(cue.kind));
});
