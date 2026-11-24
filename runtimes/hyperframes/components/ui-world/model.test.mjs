import test from 'node:test';
import assert from 'node:assert/strict';
import {compile, stateAt, resolveAnchor, projectPoint, FORMATS} from './model.mjs';

const near = (actual, expected, label, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${label}: expected ${expected}, received ${actual}`);
const pointNear = (actual, expected, label) => {
  near(actual.x, expected.x, `${label}.x`);
  near(actual.y, expected.y, `${label}.y`);
};

for (const aspect of Object.keys(FORMATS)) {
  test(`${aspect}: one actor transfers between named anchors without a position jump`, () => {
    const plan = compile({aspect});
    assert.equal(plan.duration, 6);
    pointNear(stateAt(plan, 0).actor, resolveAnchor(plan, 'switch.off'), 'initial knob');
    pointNear(stateAt(plan, .78).actor, resolveAnchor(plan, 'switch.on'), 'enabled knob');
    pointNear(stateAt(plan, 1).actor, resolveAnchor(plan, 'switch.on'), 'detach');
    pointNear(stateAt(plan, 1.5).actor, resolveAnchor(plan, 'slider.start'), 'landing');
    pointNear(stateAt(plan, 4.5).actor, resolveAnchor(plan, 'slider.end'), 'completion');
    pointNear(stateAt(plan, 6).actor, resolveAnchor(plan, 'slider.end'), 'held ending');
    for (const [time, owner] of [[0, 'switch'], [.999, 'switch'], [1, 'world'], [1.499, 'world'], [1.5, 'slider'], [6, 'slider']]) {
      assert.equal(stateAt(plan, time).actor.owner, owner, `${time}s owner`);
    }
    for (const time of [1, 1.5, 4.5]) {
      const before = stateAt(plan, time - 1e-6).actor;
      const after = stateAt(plan, time + 1e-6).actor;
      assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < .01, `${time}s position continuity`);
    }
  });

  test(`${aspect}: semantic sounds coincide with actual value crossings`, () => {
    const plan = compile({aspect});
    assert.equal(plan.events.length, 13);
    assert.equal(new Set(plan.events.map(event => event.id)).size, 13);
    assert.deepEqual(plan.events.filter(event => event.kind === 'slider.tick').map(event => event.value), [10, 20, 30, 40, 50, 60, 70, 80, 90]);
    let previous = -Infinity;
    for (const event of plan.events) {
      assert.ok(Number.isFinite(event.time) && event.time >= previous && event.time < plan.duration);
      previous = event.time;
      if (event.kind === 'slider.tick') {
        near(stateAt(plan, event.time).sliderValue, event.value, event.id);
        assert.ok(stateAt(plan, event.time - 1e-5).sliderValue < event.value);
        assert.ok(stateAt(plan, event.time + 1e-5).sliderValue > event.value);
      }
    }
    assert.equal(plan.events.find(event => event.kind === 'actor.land').time, 1.5);
    assert.equal(plan.events.find(event => event.kind === 'slider.complete').time, 4.5);
  });

  test(`${aspect}: seeking is stateless and the actor stays within the safe frame at 60 fps`, () => {
    const plan = compile({aspect}), original = structuredClone(plan);
    const safe = {left: plan.width * plan.safe.left, right: plan.width * (1 - plan.safe.right),
      top: plan.height * plan.safe.top, bottom: plan.height * (1 - plan.safe.bottom)};
    for (let frame = 0; frame <= 360; frame++) {
      const time = frame / 60, state = stateAt(plan, time);
      const p = projectPoint(plan, state.camera, state.actor);
      const rx = state.actor.r * state.actor.scaleX * state.camera.zoom;
      const ry = state.actor.r * state.actor.scaleY * state.camera.zoom;
      assert.ok(p.x - rx >= safe.left && p.x + rx <= safe.right && p.y - ry >= safe.top && p.y + ry <= safe.bottom,
        `actor leaves safe frame at ${time}s`);
      if (state.actor.owner === 'slider') pointNear(state.actor, resolveAnchor(plan, 'slider.handle', state), 'slider attachment');
      stateAt(plan, 6 - time);
      assert.deepEqual(stateAt(plan, time), state);
    }
    assert.deepEqual(plan, original);
    assert.deepEqual(stateAt(plan, -10), stateAt(plan, 0));
    assert.deepEqual(stateAt(plan, 20), stateAt(plan, 6));
  });
}

test('layout and style changes preserve the event recipe and move the target anchor', () => {
  const baseline = compile({aspect: '16:9'});
  const changed = compile({aspect: '16:9', sliderLength: 340,
    labels: {switch: 'START MOTION', slider: 'BALANCED MOMENTUM'},
    style: {accent: '#FF8C42', control: '#273950', font: 'Archivo'}});
  assert.notDeepEqual(resolveAnchor(changed, 'slider.end'), resolveAnchor(baseline, 'slider.end'));
  pointNear(stateAt(changed, 4.5).actor, resolveAnchor(changed, 'slider.end'), 'changed target');
  assert.equal(changed.style.font, 'Archivo');
  assert.equal(changed.labels.slider, 'BALANCED MOMENTUM');
  assert.deepEqual(changed.events, baseline.events);
  for (const aspect of Object.keys(FORMATS)) assert.deepEqual(compile({aspect}).events, baseline.events);
});

test('invalid geometry, content and time fail explicitly', () => {
  for (const input of [{aspect: '4:3'}, {duration: 5}, {sliderLength: 0}, {style: {font: 'Missing'}}, {labels: {switch: ''}}]) {
    assert.throws(() => compile(input));
  }
  const plan = compile();
  assert.throws(() => stateAt(plan, NaN));
  assert.throws(() => resolveAnchor(plan, 'missing.anchor'));
  const returned = resolveAnchor(plan, 'slider.end');
  returned.x += 100;
  assert.notDeepEqual(resolveAnchor(plan, 'slider.end'), returned);
});

test('a musical slide span retimes the actor, camera and sound crossings together', () => {
  for(const aspect of Object.keys(FORMATS))for(const bpm of [60,90,120,180]){
    const plan=compile({aspect,music:{bpm,offset:.125},timing:{slide:{startBeat:5,endBeat:17}}});
    const start=.125+5*60/bpm,finish=.125+17*60/bpm;
    near(plan.actions.slide.at,start,'musical start');
    near(plan.duration,finish+1.5,'ending hold');
    near(stateAt(plan,start).sliderValue,0,'start value');
    near(stateAt(plan,finish).sliderValue,100,'finish value');
    for(const key of ['x','y','zoom'])near(stateAt(plan,finish).camera[key],plan.camera.finish[key],`camera.${key}`);
    for(const event of plan.events.filter(event=>event.kind.startsWith('slider.'))){
      near(stateAt(plan,event.time).sliderValue,event.value,event.id);
      const state=stateAt(plan,event.time);stateAt(plan,plan.duration);stateAt(plan,0);
      assert.deepEqual(stateAt(plan,event.time),state);
    }
    near(plan.events.at(-1).time,finish,'completion sound');
  }
  for(const slide of [{startBeat:0,endBeat:2},{startBeat:4,endBeat:4},{startBeat:4,endBeat:Infinity}])assert.throws(()=>compile({timing:{slide}}));
});
