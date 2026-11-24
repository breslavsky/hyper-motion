import test from 'node:test';
import assert from 'node:assert/strict';
import {plan, stateAt, tilesAt, lensAt, mediaAt, cellCentre, openRect, erf, PATHS, pathAt} from './wall.mjs';

const media = n => Array.from({length: n}, (_, i) => `assets/p${i + 1}.jpg`);
const recipe = (extra = {}) => ({id: 'trip', width: 1080, height: 1920, duration: 12, media: media(9),
  stops: [{media: 5, at: 2.2, open: 2.2, caption: 'Lisbon, May'}, {media: 3, at: 6.2, open: 0, hold: .6},
    {media: 9, at: 8.4, open: 3.25}], ...extra});
const spec = extra => { const {spec, errors} = plan(recipe(extra)); assert.equal(errors, undefined, String(errors)); return spec; };

test('erf is close to the true function and odd', () => {
  for (const [x, y] of [[0, 0], [.5, .5204998778], [1, .8427007929], [2, .9953222650]]) {
    assert.ok(Math.abs(erf(x) - y) < 2e-7);
    assert.equal(erf(-x) + erf(x), 0);
  }
});

test('the lens magnifies its centre, leaves the far wall its own size and never folds', () => {
  const s = spec();
  assert.equal(lensAt(s, 0).along, 3);
  assert.equal(lensAt(s, 0).across, 3);
  assert.ok(Math.abs(lensAt(s, 5000).along - 1) < 1e-9);
  let last = -1;
  for (let u = 0; u < 3000; u += 7) {
    const {reach, along, across} = lensAt(s, u);
    assert.ok(reach > last && along >= 1 && across >= along - 1e-9);
    last = reach;
  }
});

test('neighbouring cells show different files once there are files enough', () => {
  for (const count of [2, 4, 5, 6, 9, 13, 60]) {
    for (let row = -6; row < 6; row++) for (let col = -6; col < 6; col++) {
      const here = mediaAt(col, row, count);
      assert.notEqual(here, mediaAt(col + 1, row, count));
      assert.notEqual(here, mediaAt(col, row + 1, count));
      if (count > 4) {
        assert.notEqual(here, mediaAt(col + 1, row + 1, count));
        assert.notEqual(here, mediaAt(col - 1, row + 1, count));
      }
    }
  }
  assert.equal(mediaAt(3, -2, 1), 0);
});

test('the camera arrives on the named picture, rests there and moves without jumps', () => {
  const s = spec();
  for (const [index, stop] of s.stops.entries()) {
    const state = stateAt(s, stop.at + .01);
    const centre = tilesAt(s, state).at(-1);
    assert.equal(centre.media, stop.media, `stop ${index + 1}`);
    assert.ok(centre.u < 1e-6 && Math.abs(centre.x - s.lens.x) < 1e-6 && Math.abs(centre.y - s.lens.y) < 1e-6);
    assert.deepEqual([centre.a, centre.b, centre.d], [3, 0, 3]);
  }
  let before = stateAt(s, 0);
  for (let t = 1 / 120; t <= s.duration; t += 1 / 120) {
    const now = stateAt(s, t);
    assert.ok(Math.hypot(now.x - before.x, now.y - before.y) < 12, `a jump at ${t.toFixed(3)} s`);
    before = now;
  }
});

test('a time gives one frame, whatever was asked before', () => {
  const s = spec();
  const first = JSON.stringify(tilesAt(s, stateAt(s, 5.4321)));
  for (const t of [11, 0, 7.5, 2.9]) tilesAt(s, stateAt(s, t));
  assert.equal(JSON.stringify(tilesAt(s, stateAt(s, 5.4321))), first);
  assert.equal(JSON.stringify(plan(recipe()).spec), JSON.stringify(s));
});

test('tiles fill the frame and none is drawn twice', () => {
  for (const extra of [{}, {stagger: true}, {width: 1920, height: 1080}, {lens: {radius: .4, magnify: 2}}]) {
    const s = spec(extra);
    for (const t of [0, 1.3, 2.2, 5, 9]) {
      const tiles = tilesAt(s, stateAt(s, t));
      assert.equal(new Set(tiles.map(tile => `${tile.col},${tile.row}`)).size, tiles.length);
      // Every corner of the frame has a tile near it: the wall has no edge.
      for (const [x, y] of [[0, 0], [s.width, 0], [0, s.height], [s.width, s.height]]) {
        assert.ok(tiles.some(tile => Math.hypot(tile.x - x, tile.y - y) < s.tile.pitchY * tile.scale * 1.2));
      }
      assert.ok(tiles.length < 900);
    }
  }
});

test('a picture opens from its tile to the frame and back, and stays open at the end', () => {
  const s = spec();
  const [first, , last] = s.stops;
  assert.equal(stateAt(s, first.at + .1).open, null);
  const open = stateAt(s, first.at + first.hold + 1).open;
  assert.equal(open.stop, 0);
  assert.equal(open.amount, 1);
  assert.ok(stateAt(s, first.end - .01).open.amount < .01);
  assert.equal(last.close, false);
  assert.equal(stateAt(s, s.duration).open.amount, 1);
  const tile = openRect(s, first, 0, [1000, 1500]);
  assert.deepEqual([tile.w, tile.h], [s.tile.width * 3, s.tile.height * 3]);
  assert.ok(Math.abs(tile.x + tile.w / 2 - s.lens.x) < 1e-9);
  const full = openRect(s, first, 1, [1000, 1500]);
  assert.deepEqual([full.x, full.y, full.w, full.h, full.r, full.contain], [0, 0, 1080, 1920, 0, false]);
  // A landscape picture would lose most of itself to a tall frame: it is shown whole.
  const whole = openRect(s, first, 1, [1600, 1000]);
  assert.deepEqual([whole.contain, whole.w, whole.h], [true, 1080, 675]);
  assert.equal(openRect(s, {...first, fit: 'cover'}, 1, [1600, 1000]).contain, false);
});

test('a staggered wall shifts every other column by half a tile', () => {
  const s = spec({stagger: true});
  assert.equal(cellCentre(s, 1, 0)[1], s.tile.pitchY / 2);
  assert.equal(cellCentre(s, 2, 0)[1], 0);
});

test('a recipe that cannot be built says what to change', () => {
  const refused = extra => plan(recipe(extra)).errors.join('\n');
  assert.match(refused({id: 'Trip'}), /"id"/);
  assert.match(refused({media: []}), /at least one/);
  assert.match(refused({media: ['notes.txt']}), /neither a picture/);
  assert.match(refused({media: [{src: 'a.jpg', from: 2}]}), /"from"/);
  assert.match(refused({stops: [{media: 12, at: 2}]}), /1 to 9/);
  assert.match(refused({stops: [{media: 1, at: .5}]}), /busy until 0 s: move "at" to 1.2/);
  assert.match(refused({stops: [{media: 1, at: 2, open: 2}, {media: 2, at: 4.5}]}), /busy until 4.35 s/);
  assert.match(refused({stops: [{media: 1, at: 10, open: 4}]}), /after the scene's 12 s/);
  assert.match(refused({stops: [{media: 1, at: 2, caption: 'A caption far too long to fit in one line'}]}), /28 characters/);
  assert.match(refused({stops: [{media: 1, at: 2, sound: true}]}), /"sound"/);
  assert.match(refused({stops: [{media: 1, at: 2, open: 0, caption: 'Hi'}]}), /a stop that opens/);
  assert.match(refused({tile: {aspect: 'wide'}}), /tile.aspect/);
  assert.match(refused({lens: {zoom: 2}}), /"lens" has no field "zoom"/);
  assert.match(refused({speed: 2}), /the recipe has no field "speed"/);
});

test('every path starts where the camera is, leaves along the drift and is its own', () => {
  const seen = new Set();
  for (const path of PATHS) {
    const s = spec({path, stops: [], drift: [.6, 0]});
    assert.deepEqual(pathAt(s, 0), [0, 0]);
    const [x, y] = pathAt(s, 4);
    assert.ok(x > 3.5 && Math.abs(y) < 5, `${path} leaves along the drift`);
    let before = stateAt(s, 0);
    for (let t = 1 / 60; t <= s.duration; t += 1 / 60) {
      const now = stateAt(s, t), step = Math.hypot(now.x - before.x, now.y - before.y);
      assert.ok(step > .05 && step < 12, `${path}: a step of ${step.toFixed(2)} px at ${t.toFixed(2)} s`);
      before = now;
    }
    seen.add(JSON.stringify([stateAt(s, 3), stateAt(s, 7)]));
  }
  assert.equal(seen.size, PATHS.length);
  assert.match(plan(recipe({path: 'spiral'})).errors.join(), /"path" is one of drift, orbit, wave, eight, zigzag/);
  // A camera with stops still arrives on them from any path.
  const s = spec({path: 'eight'});
  for (const stop of s.stops) assert.equal(tilesAt(s, stateAt(s, stop.at + .01)).at(-1).media, stop.media);
});
