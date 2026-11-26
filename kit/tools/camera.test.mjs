// The shared camera: one transform of one world, a pure function of time.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {lookAt, travel, cameraPath, kick, drift, createCamera, mountCamera, smooth} from '../source/lib/components/camera/camera.mjs';
import {cameraHits} from '../../components/camera/hits.mjs';

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

test('the hits of a camera are the key hits of its track, from its start, never two too close', () => {
  const map = {accents: [{t: 0.5, strength: 0.9, key: true}, {t: 0.62, strength: 1.2, key: true}, {t: 1, strength: 0.3, key: false}, {t: 2.5, strength: 0.8, key: true}, {t: 9, strength: 1, key: true}]};
  assert.deepEqual(cameraHits(map), [0.62, 2.5, 9]);
  assert.deepEqual(cameraHits(map, {start: 0.5, duration: 6}), [0.12, 2]);
  assert.deepEqual(cameraHits(map, {apart: 0.05}), [0.5, 0.62, 2.5, 9]);
  assert.throws(() => cameraHits({bpm: 120}), /not a track map/);
});

test('on a timeline the camera is drawn by every seek, with or without callbacks', () => {
  // A page's world and GSAP's timeline, as much of them as the camera touches.
  const world = {style: {}, offsetWidth: 3000, offsetHeight: 2000, querySelectorAll: () => []};
  const timeline = {to(target, vars, start) { Object.assign(this, {target, vars, start}); return this; }};
  const camera = mountCamera(world, {width: 1920, height: 1080, duration: 4, stops: [{at: 0, x: 500, y: 500, zoom: 1}, {at: 2, x: 2000, y: 1200, zoom: 2}]});
  camera.attach(timeline, 1.5);
  assert.equal(timeline.start, 1.5);
  assert.deepEqual([timeline.vars.time, timeline.vars.duration, timeline.vars.ease], [4, 4, 'none']);
  assert.equal(timeline.vars.onUpdate, undefined, 'a seek that suppresses callbacks must still draw');
  // GSAP calls a function it finds on the target with the value, and with nothing to read it.
  const rest = world.style.transform;
  timeline.target.time(3);
  assert.equal(timeline.target.time(), 3);
  assert.notEqual(world.style.transform, rest);
  assert.match(world.style.transform, /scale\(2\.00000\)/);
  timeline.target.time(0);
  assert.equal(world.style.transform, rest, 'back to where it was');
  timeline.target.time(99);
  assert.equal(timeline.target.time(), 4, 'never past its end');
  assert.throws(() => mountCamera(world, {width: 1920, height: 1080, duration: 4, stops: [{at: 0, look: 'nothing'}]}), /nothing on the page has data-cam="nothing"/);
});

test('a rewind runs the whole way backwards at the end and lands where the camera began', () => {
  const stops = [{at: 0, pose: {x: 0, y: 0, zoom: 1}}, {at: 2, pose: {x: 1000, y: 0, zoom: 2}, move: 1}, {at: 4, pose: {x: 1000, y: 600, zoom: 1}, move: 1}];
  const plain = createCamera({view, stops}), camera = createCamera({view, stops, duration: 6, rewind: 1});
  for (const l of [0, 1.5, 3.6, 4.9]) assert.deepEqual(camera.at(l), plain.at(l), `before the rewind nothing changes: ${l}`);
  const end = camera.at(6), start = camera.at(0);
  assert.deepEqual([end.x, end.y, end.zoom], [start.x, start.y, start.zoom]);
  // It goes back through the stops in order and holds on none: half-way it is on the middle stop, at speed.
  const half = camera.at(5.5);
  assert.ok(Math.abs(half.x - 1000) < 1e-6 && Math.abs(half.y) < 1e-6 && Math.abs(half.zoom - 2) < 1e-6, JSON.stringify(half));
  assert.ok(half.speed > 1500, `${half.speed}`);
  assert.ok(camera.at(5.01).speed < half.speed / 3 && camera.at(5.99).speed < half.speed / 3, 'it gathers speed and brakes');
  for (let l = 5.02; l < 5.97; l += 0.02) assert.ok(camera.at(l).speed > 0, `it never stands during the rewind: ${l}`);
  assert.throws(() => createCamera({view, stops, rewind: 1}), /needs the camera's duration/);
  assert.throws(() => createCamera({view, stops, duration: 4.5, rewind: 1}), /after the rewind begins/);
});
