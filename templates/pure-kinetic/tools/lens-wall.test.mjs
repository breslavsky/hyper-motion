// The lens-wall scene: what it takes and refuses, the camera's paths, and the
// shared component it carries as a byte copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {plan, stateAt, PATHS, EXAMPLES, PLACES, PUBLIC} from '../source/lib/components/lens-wall/wall.mjs';

const require = createRequire(import.meta.url);
const definitions = require('../source/lib/components/metadata.cjs');
const film = require('../source/lib/film.cjs');
const {canonical, destination, files} = require('./sync-lens-wall.cjs');
const scene = definitions['lens-wall'];
const made = extra => ({aspect: '9:16', style: 'liquid', brand: {name: 'Nook'}, scenes: [{...scene.sample, ...extra}]});
const problems = extra => film.problems(made(extra));

test('the copy of the shared component is the component', () => {
  for (const file of files) assert.ok(fs.readFileSync(path.join(destination, file)).equals(fs.readFileSync(path.join(canonical, file))), `${file}: run tools/sync-lens-wall.cjs`);
});

test('the sample is a film, and what cannot be built is refused in words', () => {
  assert.deepEqual(problems({}), []);
  assert.deepEqual(problems({images: ['assets/a.jpg', 'assets/b.png'], videos: ['assets/c.mp4'], tiles: 'square', path: 'eight'}), []);
  assert.match(problems({images: ['a.jpg', '../c.jpg']}).join(), /project-relative/);
  assert.match(problems({videos: ['/tmp/c.mp4']}).join(), /project-relative/);
  assert.match(problems({images: ['clip.mp4']}).join(), /images\[0\] must be a picture/);
  assert.match(problems({videos: ['photo.jpg']}).join(), /videos\[0\] must be a video/);
  assert.ok(problems({path: 'spiral'}).length);
  assert.ok(problems({videos: Array.from({length: 8}, (_, i) => `v${i}.mp4`)}).length);
});

test('the scene lists the paths the component has, and its files are the film\'s pictures and videos', () => {
  assert.deepEqual(scene.fields.path.values, PATHS);
  assert.deepEqual(film.pictures(made({images: ['assets/a.jpg']})).map(row => row[1]), ['assets/a.jpg']);
  assert.deepEqual(film.videos(made({videos: ['assets/c.mp4']})), [['scenes[0].videos[0]', 'assets/c.mp4']]);
  // A file's path and the names of a path or a tile shape are not the film's words.
  const worded = made({images: ['assets/a.jpg'], videos: ['assets/c.mp4'], tiles: 'square'});
  assert.deepEqual(film.review(worded, film.planOf(worded)).scenes[0].words, []);
});

test('every path moves the camera all the time, without a jump, and each its own way', () => {
  const ways = PATHS.map(name => {
    const {spec, errors} = plan({id: 'scene', width: 1080, height: 1920, duration: 6, path: name, drift: [.5, -.1],
      media: Array.from({length: 9}, (_, i) => `picture-${i + 1}.png`)});
    assert.equal(errors, undefined, String(errors));
    assert.deepEqual([stateAt(spec, 0).x, stateAt(spec, 0).y], [0, 0]);
    const points = [];
    for (let t = 0; t <= 6; t += 1 / 60) points.push(stateAt(spec, t));
    points.slice(1).forEach((point, i) => {
      const step = Math.hypot(point.x - points[i].x, point.y - points[i].y);
      assert.ok(step > .05 && step < 12, `${name}: a step of ${step.toFixed(2)} px at ${(i / 60).toFixed(2)} s`);
    });
    assert.deepEqual(stateAt(spec, 3.21), stateAt(spec, 3.21));
    return points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  });
  assert.equal(new Set(ways).size, PATHS.length);
});

test('the film\'s files take the examples\' places one by one, and seven leave none', () => {
  assert.deepEqual([scene.examples, scene.places, scene.public], [EXAMPLES, PLACES, PUBLIC]);
  const at = file => `${PUBLIC}/${file}`;
  const videos = extra => scene.filled({type: 'lens-wall', ...extra}).videos ?? [];
  assert.deepEqual(videos({}), EXAMPLES.map(at));
  assert.deepEqual(videos({images: ['a.jpg', 'b.jpg'], videos: ['c.mp4']}), ['c.mp4', ...EXAMPLES.slice(0, 4).map(at)]);
  assert.deepEqual(videos({images: Array.from({length: 7}, (_, i) => `p${i}.jpg`)}), []);
  assert.deepEqual(videos({videos: Array.from({length: 7}, (_, i) => `v${i}.mp4`)}).length, 7);
  const full = {type: 'lens-wall', images: Array.from({length: 9}, (_, i) => `p${i}.jpg`)};
  assert.equal(scene.filled(full), full);
  // What is played is a scene the runtime accepts: the wall's own addresses, and no other.
  assert.deepEqual(scene.validate(scene.filled({type: 'lens-wall', videos: ['c.mp4']})), []);
  assert.match(scene.validate({type: 'lens-wall', videos: ['https://example.com/clip.mp4']}).join(), /project-relative/);
  assert.match(scene.validate({type: 'lens-wall', videos: [`${PUBLIC}/../other.mp4`]}).join(), /project-relative/);
  assert.match(problems({videos: ['https://example.com/clip.mp4']}).join(), /project-relative/);
});
