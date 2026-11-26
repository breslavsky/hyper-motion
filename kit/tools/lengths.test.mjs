// The kit settles every scene's length itself. A writer asked for a film of
// 35 seconds used to be told "remove about 9 beats" and left to find which
// scenes give them up: one wrote scripts that tried counts until the film
// fitted, 68 steps of 165.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = require('../source/lib/film.cjs');
const base = JSON.parse(fs.readFileSync(path.join(HERE, '../source/film.json'), 'utf8'));
delete base.seconds;
const usual = JSON.parse(fs.readFileSync(path.join(HERE, '../source/lib/beats.json'), 'utf8'));

// Fifteen scenes, as a recipe names them, every one written five beats long.
const TYPES = [['typewriter', {text: 'It starts with a line.'}], ['wall', {words: ['One', 'Two', 'Three', 'Four']}], ['typewriter', {text: 'Then another.'}],
  ['dock', {apps: ['📊', '🎬', '✏️', '🔊']}], ['gather', {word: 'IDEAS'}], ['typewriter', {text: 'And a third.'}], ['impact', {text: 'SHIPPED'}],
  ['roll', {lead: 'Scenes for', words: ['launches', 'reels', 'demos']}], ['typewriter', {text: 'Almost there.'}], ['gather', {word: 'Nook'}],
  ['typewriter', {text: 'One more.'}], ['wall', {words: ['Five', 'Six', 'Seven', 'Eight']}], ['typewriter', {text: 'The last line.'}],
  ['roll', {lead: 'Made for', words: ['teams', 'studios']}], ['endcard', {cta: 'nook.app'}]];
const film = (seconds, beats = 5, extra = {}) => ({...base, ...(seconds ? {seconds} : {}), ...extra,
  scenes: TYPES.map(([type, fields]) => ({type, beats, ...fields}))});

test('a film is made as long as asked, its beats shared out by the kit', () => {
  const asked = film(35);
  assert.deepEqual(F.problems(asked), []);
  const plan = F.planOf(asked);
  assert.ok(Math.abs(plan.duration - 35) <= plan.beat / 2 + 0.001, `${plan.duration} s`);
  // The same scenes written the same way run longer when nothing is asked: the kit took beats out.
  assert.ok(F.planOf(film(null)).duration > plan.duration);
  const lay = F.layOf(asked);
  assert.equal(lay.asked, 35);
  assert.equal(lay.from, null);
  assert.ok(lay.changed.length > 0);
  // Every scene stays inside its usual length.
  plan.scenes.forEach(scene => {
    const [low, high] = usual[scene.scene.type] ?? [1, 99];
    assert.ok(scene.scene.beats >= Math.min(5, low) && scene.scene.beats <= Math.max(5, high), `${scene.scene.type} ${scene.scene.beats}`);
  });
  // Another length asked for, another sharing out, with no word changed.
  const longer = F.planOf(film(38));
  assert.ok(Math.abs(longer.duration - 38) <= longer.beat / 2 + 0.001);
  // The same film is the same every time.
  assert.deepEqual(F.planOf(film(35)).scenes.map(scene => scene.scene.beats), plan.scenes.map(scene => scene.scene.beats));
});

test('what was written stands wherever it can', () => {
  // A film that is already as long as asked is not touched.
  const plain = F.planOf(film(null));
  const exact = film(Number(plain.duration.toFixed(2)));
  assert.deepEqual(F.layOf(exact).changed, []);
  // With "lay": false the lengths are the writer's, and a length that does not fit is theirs to mend.
  const kept = film(35, 5, {music: {...base.music, lay: false}});
  assert.match(F.problems(kept)[0], /the film runs .* s and "seconds" asks for 35/);
});

test('scenes that cannot be that long are said so, in scenes and not in beats', () => {
  const few = {...film(60), scenes: film(60).scenes.slice(0, 4)};
  assert.match(F.problems(few)[0], /"seconds" asks for 60 and these 4 scenes run [\d.]+ to [\d.]+ s at their usual lengths: add about \d+ scenes?\. Leave the beats as they are/);
  const many = film(12);
  assert.match(F.problems(many)[0], /"seconds" asks for 12 and these 15 scenes run .* take out about \d+ scenes?\./);
});
