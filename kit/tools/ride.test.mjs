// The ride scene's schedule and state: pure functions of the list of stops and a moment.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {rideGrid, rideState} from '../source/lib/components/scenes/ride.mjs';

const require = createRequire(import.meta.url);
const ride = require('../source/lib/components/metadata.cjs').ride;
const STOPS = [
  {kind: 'switch', label: 'Focus mode'},
  {kind: 'slider', label: 'Brightness', value: 70},
  {kind: 'check', label: 'Mute alerts'},
  {kind: 'stepper', label: 'Cups', value: 3},
  {kind: 'button', label: 'Start'},
];
const scene = (beats, stops = STOPS) => ({type: 'ride', beats, stops});

test('beats needed are the stops, the units of their actions and three', () => {
  assert.equal(ride.needs(scene(0)), 5 + (1 + 2 + 1 + 2 + 1) + 3);
  assert.deepEqual(ride.validate(scene(15)), []);
  assert.equal(ride.note(scene(15)), null);
  // Too few beats is no error: the ride plays squeezed, and fit is given the number.
  assert.deepEqual(ride.validate(scene(14)), []);
  assert.match(ride.note(scene(14)), /need 15 beats.*with 14/);
  assert.equal(ride.needs(ride.sample), 10);
  assert.deepEqual(ride.validate(ride.sample), []);
  assert.match(ride.validate(scene(20, [{kind: 'stepper', label: 'A', value: 10}, {kind: 'button', label: 'B'}]))[0], /counts to 9/);
  assert.match(ride.validate(scene(20, [{kind: 'button', label: 'A', value: 2}, {kind: 'check', label: 'B'}]))[0], /not a button/);
});

test('with enough beats every landing and every count of a stepper is on a beat', () => {
  const beat = 60 / 120, t = ride.times(scene(16), 16 * beat, beat);
  assert.equal(t.onBeat, true);
  const onGrid = at => Math.abs(at / beat - Math.round(at / beat)) < 1e-9;
  for (const stop of t.stops) assert.ok(onGrid(stop.land), `${stop.kind} lands at ${stop.land}`);
  // A stepper of three takes two beats: its counts are equal steps from the landing.
  const stepper = t.stops[3];
  assert.equal(stepper.steps.length, 3);
  assert.equal(stepper.steps[0], stepper.land);
  // Nothing begins before the ball has left the control before it.
  for (let i = 1; i < t.stops.length; i++) assert.ok(t.stops[i].leave >= t.stops[i - 1].act.to - 1e-9);
  assert.ok(t.settle <= 16 * beat && t.overview > t.stops.at(-1).act.to);
});

test('without the beats the ride still fits its scene', () => {
  const t = ride.times(scene(15), 6, 0.5);  // 12 beats of 15 needed
  assert.equal(t.onBeat, false);
  assert.ok(t.stops.at(-1).end < 6 && t.settle <= 6);
});

test('every landing, action and the closing view has a sound', () => {
  const cues = [];
  ride.sounds(scene(16), 8, (at, kind, gain) => cues.push({at, kind, gain}), 0.5);
  assert.ok(cues.every(c => Number.isFinite(c.at) && c.at >= 0 && c.at <= 8 && c.gain > 0));
  const kinds = cues.map(c => c.kind);
  assert.equal(kinds.filter(k => k === 'whoosh').length, 4 + 1);  // four hops and the pull-back
  assert.equal(kinds.at(-1), 'chime');
  assert.ok(kinds.includes('click') && kinds.includes('tick') && kinds.includes('ping'));
});

test('rows hold what the frame has room for', () => {
  assert.deepEqual(rideGrid(3, 1920, 1080), {cols: 3, rows: 1});
  assert.deepEqual(rideGrid(5, 1920, 1080), {cols: 3, rows: 2});
  assert.deepEqual(rideGrid(3, 1080, 1920), {cols: 1, rows: 3});
  assert.deepEqual(rideGrid(5, 1080, 1920), {cols: 2, rows: 3});
  assert.deepEqual(rideGrid(4, 1080, 1080), {cols: 2, rows: 2});
});

// The state without a page: controls at made-up places, as the view hands them over.
function model(beats = 16, beat = 0.5) {
  const t = ride.times(scene(beats), beats * beat, beat);
  const stops = STOPS.map((stop, i) => {
    const cx = 300 + i * 400, cy = 500, span = stop.kind === 'slider' ? 300 : stop.kind === 'switch' ? 60 : 0;
    const rest = v => ({x: cx + (stop.kind === 'slider' ? span * v / 100 : span * Math.min(1, v)), y: cy});
    return {kind: stop.kind, value: t.stops[i].value, entry: {x: cx, y: cy}, rest, pose: {x: cx, y: cy, zoom: 2}};
  });
  return {stops, times: t, overview: {x: 960, y: 540, zoom: 1}, drop: 500, lift: 80};
}

test('a moment is the same whatever was asked before it', () => {
  const m = model(), moments = [0, 0.3, 0.5, 1.2, 2.49, 2.5, 3.7, 5.1, 6.4, 7.99, 8];
  const forward = moments.map(at => JSON.stringify(rideState(m, at)));
  const backward = [...moments].reverse().map(at => JSON.stringify(rideState(m, at))).reverse();
  assert.deepEqual(forward, backward);
});

test('the ball lands where each control takes it and the controls keep their state', () => {
  const m = model(), t = m.times;
  t.stops.forEach((stop, i) => {
    const at = rideState(m, stop.land);
    assert.equal(at.current, i);
    assert.ok(Math.abs(at.ball.x - m.stops[i].entry.x) < 1e-6, `${stop.kind} entry`);
  });
  const end = rideState(m, 8);
  assert.equal(end.values[0], 1);                     // the switch is on
  assert.equal(Math.round(end.values[1]), 70);        // the slider at its value
  assert.equal(end.values[2], 1);                     // the box ticked
  assert.equal(end.values[3], 3);                     // the stepper counted
  assert.equal(end.values[4], 1);                     // the button pressed
  assert.deepEqual(end.camera, {x: 960, y: 540, zoom: 1});
  assert.equal(end.closing, 1);
  // In the air between two controls the ball rests on neither.
  const flying = rideState(m, (t.stops[1].leave + t.stops[1].land) / 2);
  assert.equal(flying.resting, -1);
  assert.ok(flying.ball.y < 500);
  // The camera never shows the world smaller than it is laid out.
  for (let at = 0; at <= 8; at += 0.05) assert.ok(rideState(m, at).camera.zoom >= 1 - 1e-9);
});
