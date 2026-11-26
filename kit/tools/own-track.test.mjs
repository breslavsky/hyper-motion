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
