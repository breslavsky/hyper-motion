// A film on a track of its own (`music.file`): a file the user uploaded or a
// tool made. The film takes the track's tempo and its first beat from the
// track's map; the writer names the file and works nothing out by hand.
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

// A track and its map where a project has them: the file under the source, its map under derived/track.
const TRACK = 'media/own-track-test.wav', UPLOAD = 'inputs/owntracktest/original.mp3';
const made = [];
const put = (rel, text) => {
  const file = path.join(SOURCE, rel);
  for (let dir = path.dirname(file); !fs.existsSync(dir); dir = path.dirname(dir)) made.unshift(dir);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, text);
  made.push(file);
};
const map = (of, grid, seconds = 60) => JSON.stringify({sound: true, seconds, grid, of});
before(() => {
  put(TRACK, 'sound');
  put(UPLOAD, 'sound');
  put('derived/track/own-track-test.json', map(TRACK, {bpm: 119.9, beat: 0.5004, firstBeat: 0.31, fit: 0.9}));
  // An upload's map is named by its asset, not by "original".
  put('derived/track/owntracktest.json', map(UPLOAD, {bpm: 87.5, beat: 0.6857, firstBeat: 1.2, fit: 0.8}, 12));
});
after(() => { for (const file of made.reverse()) fs.rmSync(file, {recursive: true, force: true}); });

const own = music => ({...film, music});

test('a film on its own track takes the track\'s tempo and starts on its first beat', () => {
  assert.deepEqual(F.problems(own({file: TRACK})), []);
  const plan = F.planOf(own({file: TRACK})), said = F.summary(own({file: TRACK}), plan);
  assert.equal(plan.bpm, 119.9);
  assert.equal(said.track, 'file');
  assert.equal(said.from, 0.31);
  assert.equal(said.file, path.join(SOURCE, TRACK));
  // The same scenes at the kit's tempo are another length: the tempo is the track's, not the look's.
  assert.notEqual(F.planOf(own({track: 'drive', bpm: 128})).duration, plan.duration);
  // An upload is found by its asset's map; the writer may start anywhere and give a tempo of their own.
  assert.equal(F.planOf(own({file: UPLOAD})).bpm, 87.5);
  assert.equal(F.summary(own({file: UPLOAD, from: 4}), F.planOf(own({file: UPLOAD, from: 4}))).from, 4);
  assert.equal(F.planOf(own({file: UPLOAD, bpm: 100})).bpm, 100);
});

test('a soundtrack made for another track, or another start, is not this film\'s', () => {
  const mark = music => F.soundMark(own(music), F.planOf(own(music)));
  assert.notEqual(mark({file: TRACK}), mark({file: TRACK, from: 2}));
  assert.notEqual(mark({file: TRACK}), mark({track: 'none', bpm: 119.9}));
  assert.equal(mark({file: TRACK}), mark({file: TRACK}));
});

test('what is wrong with a track is said in words the writer can act on', () => {
  const first = music => F.problems(own(music))[0];
  assert.match(first({file: 'media/missing.mp3'}), /there is no media\/missing\.mp3 in the project/);
  assert.match(first({file: '../secret.mp3'}), /must be a sound or a video of the project/);
  assert.match(first({file: 'media/notes.txt'}), /must be a sound or a video of the project/);
  put('media/unmapped-test.wav', 'sound');
  assert.match(first({file: 'media/unmapped-test.wav'}), /is not mapped yet\. Run: harness track-map media\/unmapped-test\.wav/);
  put('media/free-test.wav', 'sound');
  put('derived/track/free-test.json', map('media/free-test.wav', null));
  assert.match(first({file: 'media/free-test.wav'}), /no steady tempo.*give "music\.bpm"/);
  assert.deepEqual(F.problems(own({file: 'media/free-test.wav', bpm: 96})), []);
  // A map of another file is not this file's.
  put('media/other-test.wav', 'sound');
  put('derived/track/other-test.json', map('media/someone-else.wav', {bpm: 120, beat: 0.5, firstBeat: 0}));
  assert.match(first({file: 'media/other-test.wav'}), /is not mapped yet/);
  assert.match(first({file: TRACK, track: 'pulse'}), /names a file and a track/);
  assert.match(first({from: 2}), /needs "music\.file"/);
  assert.match(first({file: TRACK, from: -1}), /"music\.from" must be seconds/);
  // A field the kit never had is refused; the one old films carry and nothing reads is not.
  assert.match(first({swing: 0.2}), /"music" has no field "swing": it takes track, bpm, kit, volume, file, from/);
  assert.deepEqual(F.problems(own({track: 'drive', bpm: 128, offset: 0, volume: 0.9})), []);
});

test('a film longer than what is left of its track is told so', () => {
  const late = own({file: UPLOAD, from: 10});
  assert.deepEqual(F.problems(late), []);
  assert.ok(F.notes(late).some(note => /The track is 12\.0 s long and the film starts 10\.0 s into it/.test(note)));
  assert.ok(!F.notes(own({file: TRACK})).some(note => /The track is/.test(note)));
});

// A track with things in it: the music comes in at 2.0 s, stops from 6.0 to 6.5 s, and has key hits
// at 4.0 and 9.0 s. At 120 bpm from 0 a beat is half a second, so those are beats 4, 13, 8 and 18.
const LAID = 'media/laid-test.wav';
const eventful = of => JSON.stringify({sound: true, seconds: 60, of, grid: {bpm: 120, beat: 0.5, firstBeat: 0, fit: 0.9},
  accents: [{t: 4.0, strength: 0.8, key: true}, {t: 9.0, strength: 0.9, key: true}, {t: 3.0, strength: 0.2, key: false}],
  parts: [{from: 0, to: 2, level: 'quiet'}, {from: 2, to: 60, level: 'loud'}], entries: [{t: 2.0, hit: null}], gaps: [{from: 6.0, to: 6.5}]});
// Typed lines, whose usual length is four to six beats: room to move a beat either way.
const scenes = beats => beats.map((count, i) => ({type: i === beats.length - 1 ? 'endcard' : 'typewriter', beats: count,
  ...(i === beats.length - 1 ? {cta: 'nook.app'} : {text: 'A film laid on its own track.'})}));
const starts = made => { const plan = F.planOf(made); return plan.scenes.map(scene => Number((scene.start / plan.beat).toFixed(2))); };

test('scenes begin where the track does something, each moved two beats at most', () => {
  put(LAID, 'sound');
  put('derived/track/laid-test.json', eventful(LAID));
  const base = {...film, music: {file: LAID, from: 0}, scenes: scenes([5, 5, 5, 5, 5])};
  // As written the scenes begin on beats 5, 10, 15 and 20: none where the music comes in, hits or comes back.
  assert.deepEqual(starts({...base, music: {...base.music, lay: false}}), [0, 5, 10, 15, 20]);
  // Laid: on the entry (4), the key hit (8), the return after the stop (13), the key hit (18).
  assert.deepEqual(starts(base), [0, 4, 8, 13, 18]);
  const lay = F.layOf(base);
  assert.deepEqual(lay.on.map(place => [place.scene, place.why]), [[2, 'the music comes in'], [3, 'a key hit'], [4, 'the music is back after a stop'], [5, 'a key hit']]);
  assert.deepEqual(lay.changed.map(change => [change.scene, change.from, change.to]), [[1, 5, 4], [2, 5, 4]]);
  // A scene is never laid outside its usual length: a sentence of four beats, at the top of its three to four, cannot grow.
  const tight = {...film, music: {file: LAID, from: 0}, scenes: [{type: 'sentence', beats: 4, text: 'A film laid on its own track.'}, {type: 'sentence', beats: 4, text: 'It cannot grow.'}, ...scenes([5])]};
  assert.ok(F.layOf(tight).changed.every(change => change.to <= 4 || change.type !== 'sentence'));
  assert.equal(F.layOf({...base, music: {...base.music, lay: false}}), null);
  // The same film is the same every time it is asked for.
  assert.deepEqual(starts(base), starts(structuredClone(base)));
});

test('a laid film keeps the length it was asked for, and a scene its own timing', () => {
  const asked = {...film, music: {file: LAID, from: 0}, scenes: scenes([5, 5, 5, 5, 5])};
  const plain = F.planOf({...asked, music: {...asked.music, lay: false}});
  asked.seconds = Number(plain.duration.toFixed(2));
  assert.deepEqual(F.problems(asked), []);
  assert.equal(F.planOf(asked).duration, plain.duration);
  // Twenty-five beats in all still, with the beginnings moved onto the track.
  assert.equal(starts(asked).length, 5);
  assert.notDeepEqual(starts(asked), [0, 5, 10, 15, 20]);
  // Never past a scene's usual length unless it was written so, and never more than two beats from what was written.
  const lay = F.layOf(asked);
  for (const change of lay.changed) assert.ok(Math.abs(change.to - change.from) <= 2, JSON.stringify(change));
  // A slower pace stretches beats: such a film is not laid, its tempo is no longer the track's grid.
  assert.equal(F.layOf({...asked, pace: 'chill'}), null);
  assert.match(F.problems({...asked, music: {...asked.music, lay: 'yes'}})[0], /"music\.lay" is true or false/);
});

test('with no start given a film begins on the beat the music comes in on', () => {
  const made = {...film, music: {file: LAID}, scenes: scenes([4, 4, 5])};
  assert.equal(F.summary(made, F.planOf(made)).from, 2);
  // A track whose music is there from the start begins on its first beat.
  assert.equal(F.summary(own({file: TRACK}), F.planOf(own({file: TRACK}))).from, 0.31);
});
