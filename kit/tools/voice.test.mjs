// A voice-over: a scene names its take ("voice"), the scenes after it with none carry the line on, and
// the takes lead the timing. The kit makes every run of scenes as long as its line and a breath after
// it, the soundtrack script lays each take where its scene begins, and a film whose lines would be heard
// over one another is refused with what to do. Nobody cuts or mixes a voice by hand: a real project's
// agent once placed 121 s of lines on a 72 s film by hand, and half of them were heard two at a time.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, {after, before} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(HERE, '../source');
const F = require('../source/lib/film.cjs');
const film = JSON.parse(fs.readFileSync(path.join(SOURCE, 'film.json'), 'utf8'));
delete film.seconds;

// Silent WAV takes of a given length, where a project keeps its recordings (read from the header: no ffprobe).
const DIR = 'media/voice-test';
const wav = seconds => {
  const rate = 8000, data = Math.round(seconds * rate) * 2, head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(data, 40);
  return Buffer.concat([head, Buffer.alloc(data)]);
};
const take = seconds => `${DIR}/take-${seconds}.wav`;
before(() => {
  fs.mkdirSync(path.join(SOURCE, DIR), {recursive: true});
  for (const seconds of [1, 2, 3, 4.5, 6]) fs.writeFileSync(path.join(SOURCE, take(seconds)), wav(seconds));
  fs.writeFileSync(path.join(SOURCE, DIR, 'empty.wav'), 'not a sound');
});
after(() => fs.rmSync(path.join(SOURCE, DIR), {recursive: true, force: true}));

/** The kit's film with takes on some scenes: {scene index: seconds}. */
const voiced = (lines, more = {}) => ({...film, ...more, scenes: film.scenes.map((scene, i) => (lines[i] === undefined ? scene : {...scene, voice: take(lines[i])}))});
/** Every line's span on the film's clock, and the moment the next line (or the end) comes. */
const heard = made => {
  const plan = F.planOf(made), lines = F.summary(made, plan).voice;
  return lines.map((line, k) => ({...line, end: line.at + line.seconds, next: k + 1 < lines.length ? lines[k + 1].at : plan.duration}));
};

test('the scenes a line runs over are made as long as the line and a breath after it', () => {
  // The kit's film: slam 4, fullbleed 2, scatter 6, agent 7, marquee 4, slam 4, endcard 5 at 128 bpm.
  const lines = {0: 2, 2: 2, 3: 4.5, 5: 3};
  const made = voiced(lines);
  assert.deepEqual(F.problems(made), []);
  for (const line of heard(made)) assert.ok(line.end + 0.45 <= line.next, `a line runs ${line.at}-${line.end} s into ${line.next} s`);
  // Only what the lines need moves: the scene after the first line grows to give it its breath.
  const lay = F.layOf(made);
  assert.equal(lay.voiced, true);
  assert.ok(lay.changed.length >= 1 && lay.changed.every(change => change.to > change.from));
  // Every take is said where its scene begins, once.
  const plan = F.planOf(made);
  assert.deepEqual(F.summary(made, plan).voice.map(line => line.scene), [0, 2, 3, 5]);
  for (const line of F.summary(made, plan).voice) assert.equal(line.at, Number((plan.scenes[line.scene].start + 0.3).toFixed(3)));
  // The film is the same every time it is asked for.
  assert.deepEqual(F.planOf(structuredClone(made)).scenes.map(s => s.dur), plan.scenes.map(s => s.dur));
});

test('a film with no voice is laid and marked as it was', () => {
  assert.equal(F.layOf(film), null);
  assert.equal(F.summary(film, F.planOf(film)).voice.length, 0);
  const plain = F.soundMark(film, F.planOf(film));
  const made = voiced({0: 1});
  assert.notEqual(F.soundMark(made, F.planOf(made)), plain);
  // Another take on the same scene is another soundtrack.
  const other = voiced({0: 2});
  assert.notEqual(F.soundMark(other, F.planOf(other)), F.soundMark(made, F.planOf(made)));
});

test('a scene that carries a line is held as long as the line needs, past its usual length', () => {
  // A scatter is usually four to six beats (some 2.8 s here): a line of 4.5 s holds it longer, and no line is refused.
  const made = voiced({0: 2, 2: 4.5, 3: 1, 5: 2});
  assert.deepEqual(F.problems(made), []);
  for (const line of heard(made)) assert.ok(line.end + 0.45 <= line.next, `a line runs ${line.at}-${line.end} s into ${line.next} s`);
  const plan = F.planOf(made);
  assert.ok(plan.scenes[2].dur >= 0.3 + 4.5 + 0.5 - 0.01);
  // Written that long by hand, a scene with a line is no slow film; the same scene with no line still is.
  const long = {...film, scenes: film.scenes.map((scene, i) => (i === 2 ? {...scene, beats: 14} : scene))};
  assert.match(F.problems(long).join('\n'), /scenes\[2\] \(scatter\): 14 beats is too long for it/);
  assert.deepEqual(F.problems({...long, scenes: long.scenes.map((scene, i) => (i === 2 ? {...scene, voice: take(4.5)} : i === 3 ? {...scene, voice: take(1)} : scene))}), []);
});

test('a line on a scene whose length is its own is refused in numbers, and only that line is named', () => {
  // A scene with a speed of its own keeps the beats written: the kit cannot hold it for the line.
  const own = {...film, scenes: film.scenes.map((scene, i) => (i === 2 ? {type: 'glass-call', beats: 6, name: 'Maya Chen', speed: 1, voice: take(6)}
    : i === 3 ? {...scene, voice: take(1)} : i === 0 ? {...scene, voice: take(2)} : scene))};
  const found = F.problems(own);
  assert.equal(found.length, 1);
  assert.match(found[0], /^scenes\[2\]\.voice is 6\.0 s and would be heard over the line of scene 4: with the pause after it the line needs 6\.8 s, and scene 3 holds at most [\d.]+ s however its beats are written/);
  assert.match(found[0], /Add about \d+ beats? of scenes with no voice of their own right after scene 3: they carry the line on\. Or record the paragraph again shorter/);
});

test('lengths kept as written are told how many beats a line still needs', () => {
  const found = F.problems(voiced({0: 2, 2: 2, 3: 4.5, 5: 3}, {music: {...film.music, lay: false}}));
  assert.ok(found.length >= 1);
  assert.match(found.join('\n'), /Give scenes? [\d-]+ about \d+ more beats? \(the kit keeps the lengths written with "music\.lay": false\)/);
});

test('a length asked for under what the lines need is refused as the narration being too long', () => {
  const lines = {0: 2, 2: 2, 3: 4.5, 5: 3};
  const [found] = F.problems(voiced(lines, {seconds: 10}));
  assert.match(found, /^the voice-over needs about [\d.]+ s and "seconds" asks for 10: the lines lead the timing, so shorten the narration \(about \d+ words fewer/);
  // A length the lines leave room for is met, every line still heard alone.
  const roomy = voiced(lines, {seconds: 22});
  assert.deepEqual(F.problems(roomy), []);
  assert.ok(Math.abs(F.planOf(roomy).duration - 22) < 1);
  for (const line of heard(roomy)) assert.ok(line.end + 0.45 <= line.next);
});

test('what is wrong with a take is said in words the writer can act on', () => {
  const first = voice => F.problems({...film, scenes: film.scenes.map((scene, i) => (i ? scene : {...scene, voice}))})[0];
  assert.match(first(`${DIR}/missing.wav`), /^scenes\[0\]\.voice: there is no media\/voice-test\/missing\.wav in the project/);
  assert.match(first('../secret.wav'), /^scenes\[0\]\.voice must be a recording of the project by its path/);
  assert.match(first('media/notes.txt'), /must be a recording of the project/);
  assert.match(first(7), /must be a recording of the project/);
  assert.match(first(`${DIR}/empty.wav`), /holds no sound that can be read/);
});

test('a take is the soundtrack\'s: it is no word of the picture and no part of a scene', () => {
  const made = voiced({2: 2});
  const plan = F.planOf(made);
  assert.ok(plan.scenes.every(scene => scene.scene.voice === undefined));
  const shots = F.book(made, plan).episodes[0].shots;
  assert.ok(!JSON.stringify(shots).includes('voice-test'));
  const review = F.review(made, plan);
  assert.equal(review.scenes[2].voice, take(2));
  assert.equal(review.scenes[2].voiceSeconds, 2);
  assert.ok(!review.scenes[2].words.some(word => word.includes('voice-test')));
});
