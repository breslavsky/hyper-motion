import assert from 'node:assert/strict';
import test from 'node:test';
import definitions from '../source/lib/components/metadata.cjs';
import film from '../source/lib/film.cjs';
import compiler from '../source/lib/compiler/plan.cjs';

const cues = (scene, len, beat) => {
  const result = [];
  definitions[scene.type].sounds(scene, len, (time, kind) => result.push([time, kind]), beat);
  return result;
};
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('Glass choreography preserves its original frames and score when unset', () => {
  for (const type of ['island', 'controls', 'ask', 'search', 'sheet', 'widgets', 'lens', 'glass-flow', 'send-prompt']) {
    const def = definitions[type];
    const scene = def.sample;
    assert.equal(def.retime(scene, 4, .5), null);
    assert.equal(def.retime({...scene, speed: 1, timing: {}}, 4, .5), null);
    assert.deepEqual(cues({...scene, speed: 1, timing: {}}, 4, .5), cues(scene, 4, .5));
    assert.ok(def.guide.includes(Object.keys(def.fields.timing.fields)[0]));
  }
  assert.deepEqual(cues(definitions.lens.sample, 4, .5), [[.88, 'whoosh'], [3.2, 'sparkle']]);
});

test('explicit action beats control the graphic and matching SFX in every Glass scene', () => {
  const cases = [
    ['island', {open: 1.25}, [[1.25, 'pop']]],
    ['controls', {toggles: [.25, 2, 3], slider: 4.75, sliderEnd: 7}, [[.25, 'click'], [2, 'click'], [3, 'click'], [4.75, 'sparkle']]],
    ['ask', {open: .25, type: 1, typed: 3, send: 3.5, reply: 5}, [[.25, 'pop'], [1, 'type'], [3.5, 'click'], [5, 'chime']]],
    ['search', {focus: .5, type: 1, typed: 3, search: 4, collapse: 5.5, collapsed: 7, checked: 7.5}, [[.5, 'click'], [1, 'type'], [4, 'click']]],
    ['sheet', {open: 0, rows: [.5, 2, 3.75], press: 6}, [[0, 'whoosh'], [.5, 'tick'], [2, 'tick'], [3.75, 'tick'], [6, 'click']]],
    ['widgets', {items: [0, 1.5, 3], settled: 6}, [[0, 'pop'], [1.5, 'pop'], [3, 'pop'], [6, 'ping']]],
    ['lens', {sweep: 2.25, sweepEnd: 6.5}, [[2.25, 'whoosh'], [6.5, 'sparkle']]],
    ['glass-flow', {flight: 3, cross: 4.5, nextTitle: 6}, [[3, 'whoosh'], [4.5, 'sparkle'], [6, 'chime']]],
    ['send-prompt', {type: .5, typed: 2.5, pull: 3, chips: [4, 5], landed: 6, send: 7},
      [[.5, 'type'], [2.5, 'type'], [3, 'whoosh'], [4, 'pop'], [5, 'pop'], [7, 'click']]],
  ];
  const beat = .5, len = 8 * beat;
  for (const [type, timing, sounds] of cases) {
    const def = definitions[type];
    const scene = {...def.sample, timing};
    const clock = def.retime(scene, len, beat);
    const marks = def.anchors(scene, len);
    for (const [key, positions] of Object.entries(timing)) {
      for (const [i, position] of [positions].flat().entries()) {
        const original = Array.isArray(marks[key]) ? marks[key][i] : marks[key];
        near(clock.motionTime(position * beat), original);
        near(clock.cueTime(original), position * beat);
      }
    }
    const events = cues(scene, len, beat);
    for (const [position, kind] of sounds) {
      assert.ok(events.some(([time, sound]) => sound === kind && Math.abs(time - position * beat) < 1e-8),
        `${type} should play ${kind} on beat ${position}`);
    }
  }
});

test('pullback camera and typing share complete grapheme boundaries before a mention', () => {
  const def = definitions['send-prompt'];
  const scene = {...def.sample, text: '👩‍💻 e\u0301 @Ника'};
  const marks = def.anchors(scene, 5);
  const keys = def.keys(scene, marks);
  assert.deepEqual(keys.slice(0, 3).map(key => key.count), [3, 4, 6]);
  assert.deepEqual(def.mention(scene), {text: '@Ника', start: 7, end: 12});
  near(keys[0].at, marks.type);
  near(keys.at(-1).at, marks.typed);
  assert.deepEqual(cues(scene, 5, .5).filter(([, kind]) => kind === 'type').map(([at]) => at), keys.map(key => key.at));
  assert.equal(def.mention({...scene, text: 'hello@example.com'}), null);
});

test('scene speed runs the unpinned tail, holds at completion and clips late sounds', () => {
  const def = definitions.lens, len = 4, beat = .5;
  const fast = {...def.sample, speed: 2};
  const clock = def.retime(fast, len, beat);
  near(clock.motionTime(.44), .88);
  near(clock.motionTime(3), len);
  assert.deepEqual(cues(fast, len, beat), [[.44, 'whoosh'], [1.6, 'sparkle']]);
  assert.deepEqual(cues({...fast, speed: .5}, len, beat), [[1.76, 'whoosh']]);
  const pinned = {...fast, timing: {sweep: 2}};
  const afterPin = def.retime(pinned, len, beat);
  near(afterPin.motionTime(1), .8);
  near(afterPin.motionTime(1.5), 1.8);
  near(afterPin.cueTime(1.8), 1.5);
});

test('an interior action at either slot boundary omits the clipped part of the score', () => {
  const def = definitions.ask;
  const atStart = {...def.sample, timing: {send: 0}};
  const startCues = cues(atStart, 4, .5);
  assert.equal(startCues.filter(([time]) => time === 0).length, 1);
  assert.deepEqual(startCues[0], [0, 'click']);
  assert.ok(startCues.every(([time, kind]) => time >= 0 && kind !== 'type'));
  const atEnd = {...def.sample, timing: {send: 8}};
  const endCues = cues(atEnd, 4, .5);
  assert.deepEqual(endCues.at(-1), [4, 'click']);
  assert.ok(!endCues.some(([,kind]) => kind === 'chime'));
});

test('a slider can finish on a beat inside a shorter slot than its natural movement', () => {
  const def = definitions.controls;
  const scene = {...def.sample, timing: {slider: 1.5, sliderEnd: 2}};
  const source = def.anchors(scene, 1);
  assert.ok(source.sliderEnd > 1);
  near(def.retime(scene, 1, .5).motionTime(1), source.sliderEnd);
});

test('all enabled actions remain ordered and reachable inside a single musical beat', () => {
  const pins = {
    island: {open: .05, opened: .35, collapse: .65, exit: .8},
    controls: {open: 0, toggles: [.15, .25, .4], slider: .6, sliderEnd: 1},
    ask: {open: 0, type: .1, typed: .4, send: .6, reply: .8},
    search: {focus: 0, type: .2, typed: .5, search: .7, collapse: .8, collapsed: .9, checked: .95},
    sheet: {open: 0, rows: [.1, .2, .3], press: .7},
    widgets: {items: [.05, .1, .3], settled: .9},
    lens: {sweep: .1, sweepEnd: .9},
    'glass-flow': {open: 0, title: .1, opened: .2, titleShown: .3, flight: .4,
      cross: .5, nextTitle: .6, land: .7, nextTitleShown: .9},
    'send-prompt': {type: 0, typed: .3, pull: .4, chips: [.5, .6], landed: .7, send: .8, sent: 1},
  };
  for (const [type, timing] of Object.entries(pins)) {
    const def = definitions[type];
    const scene = {...def.sample, beats: 1, timing};
    if (type === 'island') scene.exit = 'collapse';
    for (const bpm of [120, 150, 180]) for (const pace of Object.values(compiler.paces)) {
      const beat = 60 / bpm * pace.speed;
      const clock = def.retime(scene, beat, beat);
      const marks = def.anchors(scene, beat);
      for (const [key, positions] of Object.entries(timing)) {
        const origins = [marks[key]].flat();
        [positions].flat().forEach((position, i) => near(clock.motionTime(position * beat), origins[i]));
      }
      if (type === 'ask') {
        assert.ok(marks.typed > marks.type);
        assert.ok(clock.motionTime(beat) > marks.reply, 'reply expansion continues after its onset');
      }
      assert.ok(cues(scene, beat, beat).every(([time]) => time >= 0 && time <= beat));
    }
  }
  const example = definitions.ask.sample;
  const legacy = definitions.ask.times(example, .5);
  assert.deepEqual(definitions.ask.times({...example, speed: 1, timing: {}}, .5), legacy);
  const fast = definitions.ask.times({...example, speed: 2}, .5);
  assert.ok(fast.typed > fast.type);
});

test('invalid pins fail with an action name, including the film validation entry point', () => {
  const bad = [
    ['controls', {timing: {toggles: [1, 2]}}, /toggles.*3 actions/],
    ['controls', {timing: {toggles: [0, 2, 1]}}, /choreography order/],
    ['ask', {timing: {send: 2, reply: 2}}, /choreography order/],
    ['ask', {timing: {send: '2'}}, /timing.send/],
    ['ask', {timing: {reply: 1}, reply: undefined}, /requires its action/],
    ['search', {timing: {typed: 4, search: 3}}, /choreography order/],
    ['search', {timing: {search: 4, collapse: 3}}, /choreography order/],
    ['search', {timing: {collapse: 4, collapsed: 4}}, /choreography order/],
    ['search', {timing: {collapsed: 4, checked: 3}}, /choreography order/],
    ['island', {timing: {collapse: 2}}, /requires its action/],
    ['lens', {timing: {sweep: NaN}}, /timing.sweep/],
    ['lens', {timing: {sweep: -.5}}, /timing.sweep/],
    ['lens', {timing: {swipe: 1}}, /timing.swipe/],
    ['lens', {timing: null}, /timing/],
    ['lens', {speed: null}, /speed/],
    ['lens', {speed: 4.1}, /speed/],
  ];
  for (const [type, overrides, message] of bad) {
    const def = definitions[type], scene = {...def.sample, ...overrides};
    assert.throws(() => def.retime(scene, 4, .5), message);
    assert.ok(film.problems({aspect: '16:9', style: 'glass', scenes: [scene]}).some(issue => /speed|timing/.test(issue)));
  }
  const scene = {...definitions.lens.sample, beats: 4, timing: {sweepEnd: 3.5}};
  const recipe = {aspect: '16:9', style: 'glass', brand: {name: 'Test'}, scenes: [scene]};
  assert.deepEqual(film.problems({...recipe, pace: 'normal'}), []);
  assert.ok(film.problems({...recipe, pace: 'hyper'}).some(issue => /sweepEnd.*0 to 3/.test(issue)));
});
