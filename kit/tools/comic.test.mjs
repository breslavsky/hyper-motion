// The comic scene (Comic Glitch Text, ported from Pixel UI): its frames come
// from the scene's time and the word alone, the upstream sequences are kept,
// and a paragraph it cannot print is refused in words.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {comicEnter, comicFx, comicIdle} from '../source/lib/components/scenes/sentences/comic.mjs';

const require = createRequire(import.meta.url);
const scene = require('../source/lib/components/metadata.cjs').comic;
const film = require('../source/lib/film.cjs');
const problems = extra => film.problems({aspect: '9:16', style: 'liquid', brand: {name: 'Nook'}, scenes: [{...scene.sample, ...extra}]});
const text = words => Array.from({length: words}, (_, i) => `word${i}`).join(' ');

test('the sample is a film, and a paragraph too short, too long or too fast is refused', () => {
  assert.deepEqual(problems({}), []);
  assert.match(problems({text: 'Too short here'}).join(), /3 words; the scene reads 4 to 28/);
  assert.match(problems({text: Array.from({length: 29}, (_, i) => `w${i}`).join(' ')}).join(), /29 words/);
  assert.match(problems({beats: 4, text: text(20)}).join(), /20 words need at least 7 beats/);
});

test('words enter on whole frames, evenly, and the last has settled before the scene ends', () => {
  for (const [words, beats, bpm] of [[14, 8, 120], [4, 4, 96], [28, 10, 140], [9, 6, 72]]) {
    const beat = 60 / bpm, len = beats * beat, t = scene.times({text: text(words)}, len, beat);
    assert.equal(t.tick, 1 / 24);
    assert.equal(t.enter.length, words);
    assert.ok(Number.isInteger(t.stagger) && t.stagger >= 1 && t.stagger <= Math.round(beat / 2 * 24));
    t.enter.slice(1).forEach((frame, i) => assert.equal(frame - t.enter[i], t.stagger));
    assert.ok((t.enter.at(-1) + 17) * t.tick <= len + 1e-9, `${words} words in ${beats} beats: the last word is still glitching at the end`);
    const cues = [];
    scene.sounds({text: text(words)}, len, (at, kind) => cues.push([at, kind]), beat);
    assert.equal(cues.filter(cue => cue[1] === 'tick').length, words);
    assert.ok(cues.every(([at]) => at >= 0 && at <= len));
  }
});

test('a word goes through the original sequence, and a frame is the same whenever it is asked for', () => {
  const t = scene.times({text: text(12)}, 6, .5);
  for (let word = 0; word < 12; word++) {
    const life = comicEnter(word);
    assert.equal(life.length, 17);
    assert.ok([0, 1, 3].every(k => ['panel', 'slice'].includes(life[k])));
    assert.deepEqual([life[2], life[4], life[5]], ['chroma', 'chroma', 'chroma']);
    assert.ok(life.slice(6, 16).every(fx => fx === 'bold') && life[16] === 'rest');
    assert.equal(comicFx(word, t.enter[word] - 1, t), 'hide');
    life.forEach((fx, age) => assert.equal(comicFx(word, t.enter[word] + age, t), fx));
  }
  const frames = Array.from({length: 144}, (_, frame) => Array.from({length: 12}, (_, word) => comicFx(word, frame, t)).join());
  assert.deepEqual(Array.from({length: 144}, (_, frame) => Array.from({length: 12}, (_, word) => comicFx(word, 143 - frame, t)).join()).reverse(), frames);
  // Not every word glitches alike.
  assert.ok(new Set(Array.from({length: 12}, (_, word) => comicEnter(word).join())).size > 1);
});

test('after the paragraph is in, a settled word glitches again now and then, never two at once', () => {
  const t = scene.times({text: text(8)}, 20, .5);
  let again = 0;
  for (let frame = t.entered + 1; frame < 480; frame++) {
    const busy = Array.from({length: 8}, (_, word) => comicFx(word, frame, t)).filter(fx => fx !== 'rest');
    assert.ok(busy.length <= 1);
    again += busy.length;
  }
  assert.ok(again > 10);
  assert.ok([19, 38, 57, 76, 95, 114].some(at => comicIdle(at, 8) === -1) || [19, 38, 57, 76, 95, 114].every(at => comicIdle(at, 8) >= 0));
  for (const at of [19, 38, 57]) assert.ok(comicIdle(at, 8) < 8);
});
