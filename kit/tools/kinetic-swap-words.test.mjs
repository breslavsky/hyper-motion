// kinetic-swap-words: a line whose words change places, then takes a clip
// between them. Its recipe is refused in words when the line cannot be
// edited that way, and its times follow the beat.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const scene = require('../source/lib/components/metadata.cjs')['kinetic-swap-words'];
const film = require('../source/lib/film.cjs');
const problems = extra => film.problems({aspect: '16:9', style: 'noir', brand: {name: 'Nook'}, scenes: [{...scene.sample, ...extra}]});

test('the sample is a film, and it has a section of its own', () => {
  assert.deepEqual(problems({}), []);
  assert.equal(scene.section, 'Kinetic Text');
});

test('the words that move stand at one end of the line, as written, and are never all of it', () => {
  assert.deepEqual(scene.parts({text: 'Edit a video.', move: 'Edit a'}), {moved: 'Edit a', rest: 'video.', first: true, ok: true});
  assert.deepEqual(scene.parts({text: 'Edit a video.', move: 'video.'}), {moved: 'video.', rest: 'Edit a', first: false, ok: true});
  for (const move of ['a', 'Edit a video.', 'edit a', 'Cut']) assert.match(problems({move}).join(), /move: the words that start out of place/, move);
  assert.match(problems({move: undefined}).join(), /move/);
  assert.match(problems({move: ''}).join(), /move must not be empty/);
  assert.match(problems({text: 'Editing', move: 'Editing'}).join(), /1 words; the line has 2 to 6/);
  assert.match(problems({text: 'One two three four five six seven', move: 'One'}).join(), /7 words/);
});

test('a clip is one picture or one video, and takes longer', () => {
  assert.match(problems({image: 'a.png', video: 'b.mp4'}).join(), /image, video: one of them/);
  assert.match(problems({beats: 3}).join(), /at least 4 beats/);
  assert.match(problems({beats: 5, video: 'b.mp4'}).join(), /at least 6 beats with a clip/);
});

test('the words drop on a beat, in order, and with a clip the line opens after it', () => {
  for (const [beats, bpm, clip] of [[4, 120, false], [6, 120, false], [6, 96, true], [8, 140, true], [8, 72, true]]) {
    const beat = 60 / bpm, len = beats * beat, s = {...scene.sample, beats, ...(clip ? {video: 'b.mp4'} : {})};
    const t = scene.times(s, len, beat);
    assert.ok(0 < t.select && t.select < t.carry && t.carry < t.drop && t.drop < len, JSON.stringify(t));
    assert.ok(Math.abs(t.drop / beat - Math.round(t.drop / beat)) < 1e-6 || t.drop >= len * (clip ? .5 : .7) - 1e-6, `drop off the beat: ${t.drop}`);
    if (clip) assert.ok(t.drop < t.open && t.open < t.placed && t.placed < t.leave && t.leave <= len - .3 + 1e-9, JSON.stringify(t));
    const cues = [];
    scene.sounds(s, len, (at, kind) => cues.push([at, kind]), beat);
    assert.deepEqual(cues.map(cue => cue[1]), clip ? ['click', 'whoosh', 'pop', 'whoosh', 'chime', 'whoosh'] : ['click', 'whoosh', 'pop']);
    assert.ok(cues.every(([at]) => at >= 0 && at <= len) && cues.find(cue => cue[1] === 'pop')[0] === t.drop);
  }
});

test('a Kinetic Text scene stands on its own black ground unless its colours were chosen', async () => {
  const {KINETIC_GROUND, kineticGround} = await import('../source/lib/components/kinetic-ground.mjs');
  const catalog = require('../source/lib/components/catalog.json');
  assert.equal(catalog['kinetic-swap-words'].ground, 'kinetic');
  assert.equal(KINETIC_GROUND.bg, '#000000');
  assert.ok(Object.isFrozen(KINETIC_GROUND) && Object.isFrozen(KINETIC_GROUND.palette));
  assert.equal(kineticGround({scene: scene.sample}), KINETIC_GROUND);
  assert.equal(kineticGround({scene: scene.sample, tokens: {font: 'Inter'}}), KINETIC_GROUND, 'a brand font is not a colour');
  assert.equal(kineticGround({scene: {...scene.sample, bg: '#ffffff'}}), null);
  for (const key of ['background', 'foreground', 'accent']) assert.equal(kineticGround({scene: scene.sample, tokens: {[key]: '#123456'}}), null, key);
});

test('the sign has one look and two lights', async () => {
  // There is no ink and no wall to choose.
  assert.match(problems({ink: 'neon'}).join(), /ink/);
  assert.match(problems({wall: 'brick'}).join(), /wall/);
  assert.deepEqual(Object.keys(scene.fields).sort(), ['image', 'move', 'text', 'video']);
  const {KINETIC_GROUND} = await import('../source/lib/components/kinetic-ground.mjs');
  assert.match(KINETIC_GROUND.palette.signTaken, /^#[0-9a-f]{6}$/);
  assert.match(KINETIC_GROUND.palette.signStanding, /^#[0-9a-f]{6}$/);
  assert.notEqual(KINETIC_GROUND.palette.signTaken, KINETIC_GROUND.palette.signStanding);
});

test('the sign has a font of its own, a bundled one, and the scene asks for it', () => {
  const library = require('../source/lib/fonts/library.json');
  assert.ok(library.families.some(family => family.family === scene.font), `${scene.font} is not a family of the kit`);
  assert.deepEqual(scene.fonts(scene.sample), [`700 100px "${scene.font}"`]);
});
