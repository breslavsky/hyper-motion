// The shared camera: one transform of one world, a pure function of time.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {lookAt, travel, cameraPath, kick, drift, createCamera, smooth} from '../source/lib/components/camera/camera.mjs';

const require = createRequire(import.meta.url);
const {canonical, destination, files} = require('./sync-camera.cjs');
const view = {w: 1920, h: 1080};

test('the kit carries the component byte for byte', () => {
  for (const file of files) assert.ok(fs.readFileSync(path.join(destination, file)).equals(fs.readFileSync(path.join(canonical, file))), `${file}: run kit/tools/sync-camera.cjs`);
});

test('looking at a thing puts it in the middle, whole, at the share of the view asked for', () => {
  const wide = lookAt({x: 100, y: 200, w: 400, h: 100}, view, {fill: 0.5});
  assert.deepEqual([wide.x, wide.y], [300, 250]);
  assert.ok(Math.abs(wide.zoom - 1920 * 0.5 / 400) < 1e-9);
  const tall = lookAt({x: 0, y: 0, w: 100, h: 900}, view, {fill: 0.5});
  assert.ok(Math.abs(tall.zoom - 1080 * 0.5 / 900) < 1e-9);
  assert.equal(lookAt({x: 0, y: 0, w: 2, h: 2}, view, {most: 6}).zoom, 6);
  assert.throws(() => lookAt({x: 0, y: 0, w: 0, h: 10}, view), /no size/);
});

test('a way starts and ends on its poses and stands back in the middle', () => {
  const a = {x: 0, y: 0, zoom: 2}, b = {x: 100, y: 50, zoom: 2};
  assert.deepEqual(travel(a, b, 0), a);
  assert.deepEqual(travel(a, b, 1, 0.1).x, 100);
  assert.ok(Math.abs(travel(a, b, 0.5, 0.1).zoom - 1.8) < 1e-9);
  assert.equal('roll' in travel(a, b, 0.5), false, 'a pose without a roll gets none');
  assert.equal(travel({...a, roll: 0}, {...b, roll: 10}, 0.5).roll, 5);
});

test('a path holds on a stop, leaves in time to arrive at the next, and never moves at a constant rate', () => {
  const at = cameraPath([{at: 0, pose: {x: 0, y: 0, zoom: 1}}, {at: 2, pose: {x: 1000, y: 0, zoom: 1}, move: 1}, {at: 4, pose: {x: 1000, y: 500, zoom: 2}}]);
  assert.equal(at(-1).x, 0);
  assert.equal(at(0.99).x, 0, 'it holds until the move begins');
  assert.equal(at(2).x, 1000);
  assert.deepEqual([at(9).x, at(9).y, at(9).zoom], [1000, 500, 2]);
  const early = at(1.1).x - at(1).x, middle = at(1.55).x - at(1.45).x, late = at(2).x - at(1.9).x;
  assert.ok(middle > early * 3 && middle > late * 3, 'it speeds up and slows down');
  for (let l = 0; l <= 4; l += 0.01) assert.ok(Math.abs(at(l + 0.01).x - at(l).x) < 20, 'no jump');
  assert.throws(() => cameraPath([]), /at least one stop/);
  assert.throws(() => cameraPath([{at: 1, pose: {}}, {at: 1, pose: {}}]), /not after/);
});

test('a hit lifts the zoom at once, lets it down slowly, and is smooth at both ends', () => {
  assert.equal(kick(0.99, [1]), 0);
  assert.equal(kick(1.31, [1]), 0);
  const peak = Array.from({length: 300}, (_, i) => 1 + i / 1000).reduce((best, l) => (kick(l, [1]) > kick(best, [1]) ? l : best), 1);
  assert.ok(peak - 1 < 0.08, `the top comes early: ${peak}`);
  assert.ok(kick(1.001, [1]) < 0.2 && kick(1.299, [1]) < 0.05);
  assert.ok(Math.abs(kick(peak, [1]) - 1) < 1e-3);
});

test('the same moment gives the same camera, whatever was asked before', () => {
  const make = () => createCamera({view, stops: [{at: 0, pose: {x: 960, y: 540, zoom: 1}}, {at: 2, pose: {x: 400, y: 300, zoom: 3, roll: -4}}], hits: [0.5, 1.5], life: {amount: 6, seed: 3}});
  const one = make(), two = make();
  for (const l of [3, 0.2, 1.7, 0.2, 2.9]) two.at(l);
  for (const l of [0, 0.5, 0.52, 1.3, 2, 5]) assert.deepEqual(one.at(l), two.at(l), String(l));
  assert.deepEqual(drift(1.3, {amount: 6, seed: 3}), drift(1.3, {amount: 6, seed: 3}));
  assert.notDeepEqual(drift(1.3, {amount: 6, seed: 3}), drift(1.3, {amount: 6, seed: 4}));
  assert.deepEqual(drift(1.3, {}), {x: 0, y: 0, roll: 0});
});

test('what it looks at stands on the eye, it shows its speed, and it is still on a stop', () => {
  const camera = createCamera({view, stops: [{at: 0, pose: {x: 200, y: 100, zoom: 2}}, {at: 2, pose: {x: 1500, y: 800, zoom: 2}, move: 1}]});
  const rest = camera.at(0.5), moving = camera.at(1.5);
  assert.deepEqual(camera.seen(rest, 200, 100).map(Math.round), [960, 540]);
  assert.ok(rest.speed < 1e-6 && rest.blur === 0);
  assert.ok(moving.speed > 2000 && moving.blur > 5, `${moving.speed}`);
  assert.match(camera.css(rest), /^translate\(960\.000px,540\.000px\) rotate\(0\.000000rad\) scale\(2\.00000\) translate\(-200\.000px,-100\.000px\)$/);
  // A point of the world goes where the transform puts it.
  const state = camera.at(1.5), [sx, sy] = camera.seen(state, 300, 400);
  assert.ok(Math.abs(sx - (960 + (300 - state.x) * state.zoom)) < 1e-6 && Math.abs(sy - (540 + (400 - state.y) * state.zoom)) < 1e-6);
  assert.equal(smooth(0.5), 0.5);
});
