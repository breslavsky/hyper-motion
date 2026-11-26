// The finish layer: grain, fringe, vignette, flash, shake and leak, every frame a pure function of time.
import test from 'node:test';
import assert from 'node:assert/strict';
import {burst, frameOf, hash, grainAt, shakeAt, flashAt, fringeAt, leakAt, createFinish, mountFinish} from '../../components/finish/finish.mjs';
import {finishEvents} from '../../components/finish/events.mjs';

const film = {
  duration: 6, fps: 30, seed: 7,
  flashes: [{t: 1, frames: 2, kind: 'white'}, {t: 4, frames: 1, kind: 'black'}],
  shakes: [{t: 2, d: 0.4, amp: 0.012}, {t: 4.5, d: 0.25, amp: 0.02}],
  hits: [2, 3, 4.5],
  leak: {amount: 0.3},
};

test('the same moment gives the same finish, whatever was asked before', () => {
  const one = createFinish(film), two = createFinish(film);
  for (const l of [5, 0.2, 2.1, 0.2, 4.6]) two.at(l);
  for (const l of [0, 1, 1.05, 2.1, 2.13, 3.02, 4, 4.6, 6]) assert.deepEqual(one.at(l), two.at(l), String(l));
  assert.deepEqual(one.at(2.1), one.at(2.1));
  assert.notDeepEqual(createFinish({...film, seed: 8}).at(2.1).shake, one.at(2.1).shake, 'another seed, another shake');
  assert.deepEqual(one.at(-3), one.at(0));
  assert.deepEqual(one.at(99), one.at(6), 'never past its end');
});

test('the grain of a frame follows from its number and the seed, and stands around the middle grey', () => {
  const grain = grainAt(12, 3, 20000);
  assert.deepEqual(grain, grainAt(12, 3, 20000));
  assert.deepEqual(grainAt(12, 3, 500), grain.slice(0, 500), 'a smaller canvas is the start of a larger one');
  assert.notDeepEqual(grain, grainAt(13, 3, 20000));
  assert.notDeepEqual(grain, grainAt(12, 4, 20000));
  const mean = grain.reduce((sum, value) => sum + value, 0) / grain.length;
  assert.ok(Math.abs(mean - 127) < 2, `${mean}`);
  assert.ok(Math.min(...grain) < 30 && Math.max(...grain) > 225, 'it uses the whole range');
  const near = grain.filter(value => Math.abs(value - 127) < 32).length / grain.length;
  assert.ok(near > 0.4, `most grains are near the grey: ${near}`);
  // A grain held for two frames is the same on both.
  const held = createFinish({duration: 2, grain: {hold: 2}});
  assert.equal(held.at(4 / 30).grain.frame, held.at(5 / 30).grain.frame);
  assert.notEqual(held.at(5 / 30).grain.frame, held.at(6 / 30).grain.frame);
  assert.ok(hash(1, 2, 3) >= 0 && hash(1, 2, 3) < 1 && hash(1, 2, 3) === hash(1, 2, 3) && hash(1, 2, 3) !== hash(1, 2, 4));
});

test('a moment is in the frame it falls on, however the division left it', () => {
  for (let frame = 0; frame < 600; frame++) for (const fps of [24, 25, 30, 60]) assert.equal(frameOf(frame / fps, fps), frame, `${frame} at ${fps}`);
  assert.equal(frameOf(0.999 / 30, 30), 0);
});

test('a flash covers exactly its frames', () => {
  const lit = [];
  for (let frame = 0; frame < 180; frame++) { const flash = flashAt(frame / 30, film.flashes, 30); if (flash.amount) lit.push(`${frame}:${flash.kind}:${flash.amount}`); }
  assert.deepEqual(lit, ['30:white:1', '31:white:1', '120:black:1']);
  assert.deepEqual(flashAt(0.5, film.flashes, 30), {kind: null, amount: 0});
  // Anywhere inside a frame is that frame; a flash is on or off, never half-way.
  assert.equal(flashAt(30.9 / 30, film.flashes, 30).amount, 1);
  assert.equal(flashAt(32 / 30, film.flashes, 30).amount, 0);
  assert.deepEqual(flashAt(1, [{t: 1}], 30), {kind: 'white', amount: 1}, 'one white frame unless told');
  // A time between two frames falls on the nearer one.
  assert.equal(flashAt(15 / 30, [{t: 0.51, frames: 1}], 30).amount, 1);
});

test('a shake is still before and after its burst, never beyond its amplitude, and rises and dies away smoothly', () => {
  const shakes = [{t: 2, d: 0.4, amp: 0.012}];
  assert.deepEqual(shakeAt(1.99, shakes, 30, 7), {x: 0, y: 0, reach: 0});
  assert.deepEqual(shakeAt(2, shakes, 30, 7), {x: 0, y: 0, reach: 0});
  assert.deepEqual(shakeAt(2.4, shakes, 30, 7), {x: 0, y: 0, reach: 0});
  let most = 0, moved = 0;
  for (let l = 2; l <= 2.4; l += 1 / 240) {
    const {x, y, reach} = shakeAt(l, shakes, 30, 7);
    assert.ok(Math.hypot(x, y) <= reach + 1e-12 && reach <= 0.012 + 1e-12, `${l}`);
    most = Math.max(most, reach);
    moved += Math.hypot(x, y) > 0.002 ? 1 : 0;
  }
  assert.ok(most > 0.0119, `it gets to its amplitude: ${most}`);
  assert.ok(moved > 30, 'it throws the frame for real');
  // The envelope: nothing at the ends, no corner at either, the top early.
  assert.equal(burst(0), 0);
  assert.equal(burst(1), 0);
  assert.ok(burst(0.001) < 1e-4 && burst(0.999) < 1e-4);
  const steepest = Math.max(...Array.from({length: 1000}, (_, i) => Math.abs(burst((i + 1) / 1000) - burst(i / 1000)) * 1000));
  assert.ok(burst(0.01) / 0.01 < steepest / 5 && burst(0.99) / 0.01 < steepest / 100, 'it leaves rest and comes back to it slowly');
  const top = Array.from({length: 1000}, (_, i) => i / 1000).reduce((best, u) => (burst(u) > burst(best) ? u : best), 0);
  assert.ok(top > 0.15 && top < 0.35 && Math.abs(burst(top) - 1) < 1e-4, `${top}`);
  for (let u = 0; u < 1; u += 0.001) assert.ok(Math.abs(burst(u + 0.001) - burst(u)) < 0.01, `no jump at ${u}`);
  // The throw changes with the frame and holds inside it; on twos it holds for two.
  const a = shakeAt(2.1, shakes, 30, 7), b = shakeAt(2.1 + 1 / 30, shakes, 30, 7);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 1e-4);
  const turn = l => { const {x, y} = shakeAt(l, shakes, 30, 7, 2); return Math.atan2(y, x); };
  assert.ok(Math.abs(turn(64 / 30) - turn(65 / 30)) < 1e-9 && Math.abs(turn(65 / 30) - turn(66 / 30)) > 1e-6);
  // Two shakes at once add up, and the reach says how far.
  const both = shakeAt(2.1, [...shakes, {t: 2, d: 0.4, amp: 0.02}], 30, 7);
  assert.ok(both.reach > a.reach && Math.hypot(both.x, both.y) <= both.reach);
});

test('the fringe rests at its rest and swells on a hit, smooth at both ends', () => {
  assert.equal(fringeAt(0.5, [1]), 0.001);
  assert.equal(fringeAt(1, [1]), 0.001);
  assert.equal(fringeAt(1.3, [1]), 0.001);
  assert.equal(fringeAt(1.31, [1]), 0.001);
  const peak = Array.from({length: 300}, (_, i) => 1 + i / 1000).reduce((best, l) => (fringeAt(l, [1]) > fringeAt(best, [1]) ? l : best), 1);
  assert.ok(peak - 1 < 0.1, `the top comes early: ${peak}`);
  assert.ok(Math.abs(fringeAt(peak, [1]) - 0.004) < 1e-6);
  assert.ok(fringeAt(1.001, [1]) - 0.001 < 0.003 * 0.01 && fringeAt(1.299, [1]) - 0.001 < 0.003 * 0.001, 'no corner at either end');
  for (let l = 0.9; l < 1.4; l += 0.001) assert.ok(Math.abs(fringeAt(l + 0.001, [1]) - fringeAt(l, [1])) < 0.003 * 0.03, `no jump at ${l}`);
  assert.ok(Math.abs(fringeAt(1.07, [1], {rest: 0, hit: 0.01, decay: 0.3}) - 0.01) < 5e-4);
  assert.equal(fringeAt(1.1, [], {rest: 0.002}), 0.002);
});

test('the leak wanders slowly inside the frame and is off unless asked for', () => {
  assert.deepEqual(leakAt(3, {}), {x: 0, y: 0, amount: 0});
  assert.equal(createFinish({duration: 2}).at(1).leak, null);
  for (let l = 0; l < 60; l += 0.25) {
    const a = leakAt(l, {amount: 0.3, seed: 2}), b = leakAt(l + 1 / 30, {amount: 0.3, seed: 2});
    assert.ok(Math.abs(a.x) <= 0.45 && Math.abs(a.y) <= 0.3 && a.amount > 0 && a.amount <= 0.3);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.01, 'slow');
  }
});

test('every part is optional, and what is left out is not there', () => {
  const bare = createFinish({duration: 2, grain: false, fringe: 0, vignette: false}).at(1);
  assert.deepEqual(bare, {frame: 30, grain: null, fringe: 0, shake: {x: 0, y: 0, reach: 0}, flash: {kind: null, amount: 0}, vignette: 0, leak: null});
  const plain = createFinish({duration: 2}).at(1);
  assert.deepEqual([plain.grain.amount, plain.fringe, plain.vignette], [0.1, 0.001, 0.3]);
  assert.equal(createFinish({duration: 2, grain: {amount: 0.3}}).at(1).grain.amount, 0.3);
  assert.equal(createFinish({duration: 2, fringe: {rest: 0}, hits: [1]}).at(1).fringe, 0);
});

test('it refuses, in words, what it cannot use', () => {
  assert.throws(() => createFinish({}), /needs a duration/);
  assert.throws(() => createFinish({duration: 2, flashes: [{frames: 2, kind: 'white'}]}), /flash 1 has no time/);
  assert.throws(() => createFinish({duration: 2, flashes: [{t: 1}, {t: 1.5, kind: 'red'}]}), /flash 2 is white or black, not red/);
  assert.throws(() => createFinish({duration: 2, flashes: [{t: 1, frames: 0}]}), /whole number of frames/);
  assert.throws(() => createFinish({duration: 2, shakes: [{t: 1, d: 0.25, amp: 0.2}]}), /a tenth is the most/);
  assert.throws(() => createFinish({duration: 2, shakes: [{d: 0.25, amp: 0.01}]}), /shake 1 has no time/);
  assert.throws(() => createFinish({duration: 2, shakes: [{t: 1, amp: 0.01}]}), /shake 1 has no length/);
  assert.throws(() => createFinish({duration: 2, shakes: [{t: 1, d: 0.25}]}), /shake 1 has no amplitude/);
  assert.throws(() => createFinish({duration: 2, hits: [0.5, 'two']}), /hit 2 is not a time/);
  assert.throws(() => createFinish({duration: 2, hits: 0.5}), /hits is a list/);
  assert.throws(() => createFinish({duration: 2, grain: 3}), /grain is a strength/);
  assert.throws(() => createFinish({duration: 2, fringe: 0.2}), /fringe is a share of the width/);
  assert.throws(() => createFinish({duration: 2, step: 9}), /1 to 4 frames/);
});

// A page's root and GSAP's timeline, as much of them as the finish touches.
function page() {
  const node = name => ({
    name, style: {}, attributes: {}, children: [],
    setAttribute(key, value) { this.attributes[key] = value; },
    appendChild(child) { this.children.push(child); return child; },
    getContext() {
      const canvas = this;
      return {createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4)}), putImageData(image) { canvas.painted = Array.from(image.data.slice(0, 16)); canvas.paints = (canvas.paints ?? 0) + 1; }};
    },
  });
  const doc = {createElement: node, createElementNS: (_, name) => node(name)};
  const stage = node('div'), root = node('div');
  Object.assign(root, {ownerDocument: doc, firstElementChild: stage, querySelector: () => null});
  root.children.push(stage);
  const timeline = {to(target, vars, start) { Object.assign(this, {target, vars, start}); return this; }};
  return {root, stage, timeline};
}

test('on a timeline the finish is drawn by every seek, with or without callbacks', () => {
  const {root, stage, timeline} = page();
  const finish = mountFinish(root, {width: 1920, height: 1080, ...film});
  finish.attach(timeline, 1.5);
  assert.equal(timeline.start, 1.5);
  assert.deepEqual([timeline.vars.time, timeline.vars.duration, timeline.vars.ease], [6, 6, 'none']);
  assert.equal(timeline.vars.onUpdate, undefined, 'a seek that suppresses callbacks must still draw');
  // What it adds comes after the page's own content and takes no clicks.
  assert.equal(root.children[0], stage);
  const layers = root.children.slice(1), canvas = layers.find(layer => layer.name === 'canvas'), flash = layers.at(-1);
  assert.deepEqual(layers.map(layer => layer.name), ['svg', 'div', 'canvas', 'div', 'div']);
  for (const layer of layers) assert.equal(layer.style.pointerEvents, 'none');
  assert.deepEqual([canvas.width, canvas.height, canvas.style.mixBlendMode, canvas.style.opacity], [960, 540, 'soft-light', '0.1']);
  // At rest: no shake, no flash, the fringe of rest.
  const [red, , blue] = layers[0].children[0].children;
  assert.deepEqual([stage.style.translate, stage.style.scale, flash.style.display], ['none', 'none', 'none']);
  assert.deepEqual([red.attributes.dx, blue.attributes.dx, stage.style.filter], ['-1.920', '1.920', `url(#${layers[0].children[0].attributes.id})`]);
  // GSAP calls a function it finds on the target with the value, and with nothing to read it.
  const rest = canvas.painted;
  timeline.target.time(2.1);
  assert.equal(timeline.target.time(), 2.1);
  assert.match(stage.style.translate, /^-?\d+\.\d{3}px -?\d+\.\d{3}px$/);
  assert.ok(Number(stage.style.scale) > 1 && Number(stage.style.scale) < 1.05, stage.style.scale);
  assert.ok(Number(blue.attributes.dx) > 5, blue.attributes.dx);
  assert.notDeepEqual(canvas.painted, rest, 'another frame, another grain');
  const shaken = stage.style.translate, paints = canvas.paints;
  timeline.target.time(1);
  assert.deepEqual([flash.style.display, flash.style.background, flash.style.opacity], ['block', '#fff', '1']);
  timeline.target.time(4);
  assert.deepEqual([flash.style.display, flash.style.background], ['block', '#000']);
  timeline.target.time(2.1);
  assert.equal(stage.style.translate, shaken, 'back to where it was');
  timeline.target.time(2.1);
  assert.equal(canvas.paints, paints + 3, 'the same frame is not painted twice');
  timeline.target.time(0);
  assert.deepEqual([stage.style.translate, flash.style.display, canvas.painted], ['none', 'none', rest]);
  timeline.target.time(99);
  assert.equal(timeline.target.time(), 6, 'never past its end');
  assert.deepEqual(finish.at(2.1), createFinish(film).at(2.1));
});

test('a page gets only the parts it asked for, and is told what is missing', () => {
  const {root, stage} = page();
  const finish = mountFinish(root, {width: 1080, height: 1920, duration: 3, grain: false, fringe: false, vignette: 0.4});
  assert.deepEqual(root.children.slice(1).map(layer => layer.name), ['div']);
  assert.match(root.children[1].style.background, /^radial-gradient\(/);
  finish.draw(1);
  assert.deepEqual(stage.style, {}, 'a finish with no shake and no fringe leaves the page alone');
  const tall = page();
  mountFinish(tall.root, {width: 1080, height: 1920, duration: 3});
  assert.equal(tall.root.children.find(layer => layer.name === 'canvas').width, 540);
  assert.throws(() => mountFinish(null, {width: 1920, height: 1080, duration: 3}), /no root/);
  assert.throws(() => mountFinish(root, {duration: 3}), /width and height/);
  assert.throws(() => mountFinish(root, {width: 1920, height: 1080}), /needs a duration/);
  const empty = page();
  empty.root.firstElementChild = null;
  assert.throws(() => mountFinish(empty.root, {width: 1920, height: 1080, duration: 3}), /nothing to shake/);
});

test('the events of a finish are the flashes, shakes and hits of its reference, from its start', () => {
  const map = {events: {cuts: [1], flashes: [{t: 0.5, frames: 2, kind: 'white'}, {t: 9, frames: 1, kind: 'black'}], shakes: [{t: 1, d: 0.25, amp: 0.02}, {t: 3, d: 0.4, amp: 0.5}], pans: [], hits: [0.2, 2.5, 12]}};
  assert.deepEqual(finishEvents(map), {flashes: [{t: 0.5, frames: 2, kind: 'white'}, {t: 9, frames: 1, kind: 'black'}], shakes: [{t: 1, d: 0.25, amp: 0.02}, {t: 3, d: 0.4, amp: 0.1}], hits: [0.2, 2.5, 12]});
  assert.deepEqual(finishEvents(map, {start: 0.5, duration: 3}), {flashes: [{t: 0, frames: 2, kind: 'white'}], shakes: [{t: 0.5, d: 0.25, amp: 0.02}, {t: 2.5, d: 0.4, amp: 0.1}], hits: [2]});
  assert.throws(() => finishEvents({accents: []}), /not a reference map/);
});
