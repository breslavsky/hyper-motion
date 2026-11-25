// glass-ride: glass scenes one after another on one drop. Its plan, what it
// refuses, its sounds and the leap of the drop between two steps.
import test from 'node:test';
import assert from 'node:assert/strict';
import definitions from '../source/lib/components/metadata.cjs';
import film from '../source/lib/film.cjs';

const ride = definitions['glass-ride'], sample = ride.sample;
const recipe = scene => ({aspect: '16:9', style: 'glass', brand: {name: 'Nook'}, scenes: [scene]});

test('a ride is as long as its steps and the travel between them', () => {
  assert.equal(sample.beats, sample.steps.reduce((sum, step) => sum + step.beats, 0) + ride.travel * (sample.steps.length - 1));
  assert.deepEqual(film.problems(recipe(sample)), []);
  const beat = .5, parts = ride.plan(sample, sample.beats * beat);
  assert.deepEqual(parts.map(part => [part.start, part.dur, part.scene.type]), [[0, 3, 'glass-search'], [4, 4, 'glass-ask'], [9, 5, 'glass-send-prompt']]);
  assert.deepEqual(ride.anchors(sample, sample.beats * beat), {steps: [0, 4, 9]});
  assert.match(film.problems(recipe({...sample, beats: 12})).join('\n'), /28 beats here/);
});

test('every step that is not the last folds into the drop, and a step keeps to its own fields', () => {
  const [search, held, prompt] = sample.steps, {exit: _, ...ask} = held, two = {...sample, beats: 16, steps: [search, ask]}, turned = {...two, steps: [ask, search]};
  assert.equal(ride.plan(turned, 8)[0].scene.exit, 'drop');
  assert.equal(ride.plan(two, 8)[1].scene.exit, undefined);
  // The camera travels on from the question: it folds unless it is told to hold.
  assert.equal(ride.plan(sample, 14)[1].scene.exit, 'hold');
  assert.equal(ride.plan({...sample, steps: [search, {...ask, exit: undefined}, prompt]}, 14)[1].scene.exit, undefined);
  assert.deepEqual(ride.plan(sample, 14).map(part => [part.drop, part.move]), [[true, 'right'], [true, 'right'], [false, 'down']]);
  assert.deepEqual(film.problems(recipe(two)), []);
  assert.match(film.problems(recipe({...sample, steps: [search, prompt, ask]})).join('\n'), /can only be the last step/);
  assert.match(film.problems(recipe({...two, beats: 18, steps: [prompt, ask]})).join('\n'), /a ride begins with a scene that ends on the drop/);
  assert.match(film.problems(recipe({...turned, steps: [{...ask, exit: 'hold'}, search]})).join('\n'), /the next step grows out of the drop/);
  assert.match(film.problems(recipe({...two, steps: [{type: 'glass-search', beats: 6}, ask]})).join('\n'), /steps\[0\]\.query/);
  assert.match(film.problems(recipe({...two, steps: [{...search, text: 'Why?'}, ask]})).join('\n'), /not a field of glass-search/);
  assert.match(film.problems(recipe({...two, steps: [{...search, move: 'left'}, ask]})).join('\n'), /first step is where the ride begins/);
  assert.deepEqual(film.problems(recipe({...two, steps: [search, {...ask, move: 'down', place: 'top'}]})), []);
  for (const type of ride.drops) assert.ok(definitions[type].fields.place, type);
});

test('a ride plays the sounds of its steps where they stand, and one as the drop sets off', () => {
  const beat = .5, len = sample.beats * beat, cues = [], own = [];
  ride.sounds(sample, len, (at, kind) => cues.push([Number(at.toFixed(4)), kind]), beat);
  const parts = ride.plan(sample, len);
  parts.forEach(part => definitions[part.scene.type].sounds(part.scene, part.dur, (at, kind) => own.push([Number((part.start + at).toFixed(4)), kind]), beat));
  assert.ok(cues.some(([at, kind]) => kind === 'whoosh' && at === parts[0].start + parts[0].dur));
  for (const cue of own) assert.ok(cues.some(other => other[0] === cue[0] && other[1] === cue[1]), cue.join(' '));
});
