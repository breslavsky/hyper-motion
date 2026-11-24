import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {samplePolarShape, polarPose, letterFlipPose} from '../source/lib/components/scenes/community-shapes.mjs';

const require = createRequire(import.meta.url);
const definitions = require(process.env.PK_SHAPES_METADATA ?? '../source/lib/components/metadata.cjs');

test('polar outlines are closed positive shapes with distinct geometry', () => {
  const circle = samplePolarShape('circle'), square = samplePolarShape('square');
  const triangle = samplePolarShape('triangle'), star = samplePolarShape('star');
  for (const radii of [circle, square, triangle, star]) {
    assert.equal(radii.length, 240);
    assert.ok(radii.every(r => Number.isFinite(r) && r > 0 && r <= 1.28));
  }
  assert.ok(circle.every(r => r === 1));
  assert.ok(Math.abs(square[0] - square[60]) < 1e-10);
  assert.ok(Math.abs(triangle[0] - triangle[80]) < 1e-10);
  assert.ok(Math.max(...star) - Math.min(...star) > 0.7);
});

test('polar morph lands on each requested outline and arbitrary seeks restore the pose', () => {
  const def = definitions.polar;
  const scene = {shapes: ['square', 'star', 'circle', 'triangle', 'square']};
  const outlines = scene.shapes.map(shape => samplePolarShape(shape));
  const times = def.times(scene, 3, 0.6);
  assert.deepEqual(polarPose(0, times, outlines).radii, outlines[0]);
  times.changes.forEach((change, i) => {
    const pose = polarPose(change.at + change.duration + 1e-7, times, outlines);
    for (let k = 0; k < pose.radii.length; k++) assert.ok(Math.abs(pose.radii[k] - outlines[i + 1][k]) < 1e-10);
  });
  const forward = [0, 0.7, 1.2, 2.8, 0.2].map(t => polarPose(t, times, outlines));
  for (let i = forward.length - 1; i >= 0; i--) assert.deepEqual(polarPose([0, 0.7, 1.2, 2.8, 0.2][i], times, outlines), forward[i]);
  for (let t = 0; t < 3; t += 0.013) assert.ok(polarPose(t, times, outlines).radii.every(r => r > 0 && r < 1.6));
});

test('letter flip makes the full 450 degree turn and keeps its back colour time-derived', () => {
  assert.deepEqual(letterFlipPose(0, 0.1, 0.3), {angle: -450, back: false, visible: false});
  assert.equal(letterFlipPose(0.1, 0.1, 0.3).visible, true);
  assert.equal(letterFlipPose(0.5, 0.1, 0.3).angle, 0);
  const states = Array.from({length: 31}, (_, i) => letterFlipPose(0.1 + i / 100, 0.1, 0.3));
  assert.ok(states.some(pose => pose.back));
  assert.ok(states.some(pose => !pose.back));
  assert.ok(states.every((pose, i) => !i || pose.angle >= states[i - 1].angle));
  assert.deepEqual(letterFlipPose(0, 0.1, 0.3), {angle: -450, back: false, visible: false});
});

test('the flip schedule preserves graphemes and joined-script words', () => {
  const schedule = definitions.letterflip.times({text: 'Go 👩‍💻 café'}, 2, 0.5);
  assert.deepEqual(schedule.groups, [['G', 'o'], ['👩‍💻'], ['c', 'a', 'f', 'é']]);
  assert.equal(schedule.letters.length, 7);
  assert.deepEqual(definitions.letterflip.times({text: 'مرحبا بالعالم'}, 2, 0.5).groups, [['مرحبا'], ['بالعالم']]);
});

test('visual actions and sound cues share musical timing at all supported tempos and paces', () => {
  for (const name of ['polar', 'letterflip']) for (const bpm of [72, 120, 180]) for (const speed of [1, 1.25, 1.6]) for (const beats of [3, 4, 5]) {
    const def = definitions[name], beat = 60 / bpm * speed, len = beats * beat;
    const schedule = def.times(def.sample, len, beat), cues = [];
    def.sounds(def.sample, len, (...cue) => cues.push(cue), beat);
    assert.ok(cues.length > 1);
    assert.ok(cues.every(([at, , strength]) => at >= 0 && at < len && strength > 0 && strength <= 1), `${name}/${bpm}/${speed}/${beats}`);
    if (name === 'polar') {
      for (const move of schedule.changes) {
        assert.ok(cues.some(([at, kind]) => at === move.at && kind === 'whoosh'));
        assert.ok(cues.some(([at, kind]) => at === move.at + move.duration && kind === 'tick'));
      }
    } else {
      for (const move of schedule.letters) assert.ok(cues.some(([at, kind]) => at === move.at + move.duration && kind === 'tick'));
      assert.deepEqual(cues.at(-1), [schedule.end, 'chime', 0.7]);
    }
  }
});
