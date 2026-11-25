// glass-stepper: a long process walked step by step. Its timing, what it
// refuses and its sounds.
import test from 'node:test';
import assert from 'node:assert/strict';
import definitions from '../source/lib/components/metadata.cjs';
import film from '../source/lib/film.cjs';

const stepper = definitions['glass-stepper'], sample = stepper.sample;
const recipe = scene => ({aspect: '16:9', style: 'glass', brand: {name: 'Nook'}, scenes: [scene]});
const ten = Array.from({length: 10}, (_, i) => `Step ${i + 1}`);

test('every step is taken in order, and the last is ticked unless the walk stops on one', () => {
  assert.deepEqual(film.problems(recipe(sample)), []);
  const len = 7, all = stepper.anchors(sample, len);
  assert.equal(all.items.length, sample.items.length);
  for (let i = 1; i < all.items.length; i++) assert.ok(all.items[i] > all.items[i - 1]);
  assert.ok(all.finish > all.items.at(-1) && all.finish < len);
  const stopped = stepper.anchors({...sample, current: 3}, len);
  assert.equal(stopped.items.length, 3);
  assert.equal(stopped.finish, undefined);
});

test('it takes up to ten steps, a scene long enough for them, and a step to stop on that exists', () => {
  assert.deepEqual(film.problems(recipe({...sample, items: ten, beats: stepper.needs({items: ten})})), []);
  assert.match(film.problems(recipe({...sample, items: ten, beats: 6})).join('\n'), /need at least \d+ beats/);
  assert.ok(film.problems(recipe({...sample, items: [...ten, 'One more'], beats: 30})).length);
  assert.match(film.problems(recipe({...sample, current: 9})).join('\n'), /current: 9/);
  assert.equal(definitions['glass-stepper'].fields.place, undefined, 'the camera travels: the line takes no place');
});

test('a tick sounds as each step is reached, and a chime when the last is done', () => {
  const cues = [];
  stepper.sounds(sample, 7, (at, kind) => cues.push(kind));
  assert.deepEqual(cues, ['pop', ...sample.items.map(() => 'tick'), 'chime']);
  const stopped = [];
  stepper.sounds({...sample, current: 2}, 7, (at, kind) => stopped.push(kind));
  assert.deepEqual(stopped, ['pop', 'tick', 'tick']);
});
