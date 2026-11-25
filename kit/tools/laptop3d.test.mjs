// The laptop3d scene: what it takes and refuses, and that its times keep
// their order at every length a film may give it.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const definitions = require('../source/lib/components/metadata.cjs');
const beats = require('../source/lib/beats.json');
const catalog = require('../source/lib/components/catalog.json');
const scene = definitions.laptop3d;

test('laptop3d is a scene of the three family with a model at our public address', () => {
  assert.deepEqual(catalog.laptop3d, {family: 'three', renderMode: 'webgl'});
  assert.deepEqual(beats.laptop3d, [6, 12]);
  assert.match(scene.public, /^https:\/\/motion-fab-share\.b-cdn\.net\/components\/laptop3d$/);
  assert.equal(scene.model, 'macbook.glb');
});

test('the screen takes one picture or one video of the project', () => {
  assert.deepEqual(scene.validate({type: 'laptop3d'}), []);
  assert.deepEqual(scene.validate({type: 'laptop3d', image: 'assets/site.png'}), []);
  assert.deepEqual(scene.validate({type: 'laptop3d', video: 'assets/demo.mp4'}), []);
  assert.match(scene.validate({type: 'laptop3d', image: 'a.png', video: 'b.mp4'}).join(), /not both/);
  assert.match(scene.validate({type: 'laptop3d', image: 'assets/demo.mp4'}).join(), /image must be a picture/);
  assert.match(scene.validate({type: 'laptop3d', video: 'assets/site.png'}).join(), /video must be a video/);
  assert.match(scene.validate({type: 'laptop3d', image: 'https://example.com/a.png'}).join(), /project-relative/);
  assert.match(scene.validate({type: 'laptop3d', video: '../a.mp4'}).join(), /project-relative/);
});

test('the hand lifts the lid, the screen wakes, the hand leaves, then the camera goes', () => {
  for (const [len, speed] of [[3.25, 1], [4.25, 1], [5, 1.25], [9, 1.5]]) {
    const t = scene.times({}, len, speed);
    assert.ok(t.open > 0 && t.open < t.wake, `the screen wakes after the lid starts at ${len}`);
    assert.ok(t.wake < t.release && t.release < t.finish, `the lid goes on by itself once the hand lets go at ${len}`);
    assert.ok(t.leave < t.clip && t.leave >= t.release, `the camera rests until the hand lets go at ${len}`);
    assert.ok(t.settle <= len, `the camera settles inside ${len}`);
    assert.equal(t.clip, scene.lift.angles.length / scene.lift.fps * speed, 'the clip plays by the film\'s clock');
  }
});

test('the lid only rises along the clip, from closed to where the hand lets go', () => {
  const {angles, held} = scene.lift;
  assert.equal(angles[0], 0);
  assert.equal(angles.at(-1), held);
  angles.forEach((angle, i) => assert.ok(i === 0 || angle >= angles[i - 1], `the lid falls at frame ${i}`));
});

test('the hand is a clip of ours, in the formats that have one, and can be left out', () => {
  const clip = `${scene.public}/${scene.hands['16:9'].file}`;
  assert.deepEqual(scene.filled({type: 'laptop3d'}, '16:9').videos, [clip]);
  assert.deepEqual(scene.filled({type: 'laptop3d', video: 'assets/demo.mp4'}, '16:9').videos, ['assets/demo.mp4', clip]);
  assert.equal(scene.filled({type: 'laptop3d'}, '9:16').videos, undefined);
  assert.equal(scene.filled({type: 'laptop3d', hand: false}, '16:9').videos, undefined);
  assert.deepEqual(scene.validate(scene.filled({type: 'laptop3d', video: 'assets/demo.mp4'}, '16:9')), []);
  assert.match(scene.validate({type: 'laptop3d', videos: ['assets/other.mp4']}).join(), /one video, in video/);
  for (const hand of Object.values(scene.hands)) {
    const [x, y, w, h] = hand.crop;
    assert.ok(x >= 0 && y >= 0 && x + w <= hand.frame[0] && y + h <= hand.frame[1], 'the clip lies inside its frame');
    assert.equal(hand.frames, scene.lift.angles.length, 'an angle for every frame of the clip');
  }
});

test('its sounds stand on its own times, carried into the scene\'s clock', () => {
  for (const speed of [1, 1.25]) {
    const cues = [];
    scene.sounds({}, 5, (at, name) => cues.push([at, name]), .5, speed);
    const t = scene.times({}, 5, speed);
    assert.deepEqual(cues, [[t.open, 'whoosh'], [t.wake, 'chime']]);
  }
});
