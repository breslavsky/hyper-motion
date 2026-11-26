// The part a scene plays in a film. The kit holds a film to it (a weak opener,
// too many signature moments) and its guide lists scenes by it, the strongest
// first. A scene of ours says its part in its metadata; one nobody decided
// about was simply left out of both lists, and the kit's newest scenes stood
// a hundred and fifty lines down a guide whose writer took what came first.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = require('../source/lib/film.cjs'), own = require('../source/lib/components/metadata.cjs');
const guide = fs.readFileSync(path.join(HERE, '../AGENTS.md'), 'utf8');

// Scenes of ours that are neither a beginning nor a moment to remember, on purpose: they carry a film on.
const PLAIN = ['glass-widgets', 'glass-controls', 'stack', 'underline', 'rundown', 'dial', 'accordion', 'explode',
  'before-after-wipe', 'screen-flow-carousel', 'chart-story', 'testimonial-proof-card', 'modal-morph'];

test('every scene of ours has had its part decided', () => {
  const undecided = Object.keys(own).filter(type => !own[type].opener && !own[type].signature && !PLAIN.includes(type));
  assert.deepEqual(undecided, [], 'say "signature" or "opener" in the scene\'s metadata, or name it in PLAIN here');
  for (const type of PLAIN) assert.ok(own[type] && !own[type].opener && !own[type].signature, `${type} is no longer plain`);
});

test('the kit\'s strongest scenes are signature moments, and the ones that hook open a film', () => {
  for (const type of ['kinetic-swap-words', 'kinetic-spin-words', 'kinetic-burst-words', 'comic', 'lens-wall', 'laptop3d', 'synth3d', 'ride', 'glass-ride', 'impact', 'gather']) {
    assert.ok(F.SIGNATURE.has(type), `${type} is a signature moment`);
  }
  for (const type of ['kinetic-swap-words', 'kinetic-spin-words', 'lens-wall', 'laptop3d', 'impact', 'letterflip', 'beatwords']) assert.ok(F.OPENERS.has(type), `${type} opens a film`);
  // A line that bursts into black ends something: it never begins a film.
  assert.ok(!F.OPENERS.has('kinetic-burst-words'));
  // A film that opens on one of them is not told its opening is weak.
  const film = JSON.parse(fs.readFileSync(path.join(HERE, '../source/film.json'), 'utf8'));
  const opened = {...film, scenes: [{type: 'kinetic-spin-words', beats: 4, text: 'Loop it.'}, ...film.scenes.slice(1)]};
  delete opened.seconds;
  assert.deepEqual(F.problems(opened), []);
  assert.ok(!F.notes(opened).some(note => /weak opener/.test(note)));
});

test('the guide lists scenes by their part, signature moments first and ours before the rest', () => {
  const library = guide.split('\n### Scene library\n')[1].split('\n### ')[0];
  const [, signature, openers, rest] = library.split(/\n\*\*(?:Signature moments|Openers|Every other scene)\*\*/);
  const names = text => [...text.matchAll(/^- ([\w-]+) \{/gm)].map(match => match[1]);
  const listed = {signature: names(signature), openers: names(openers), rest: names(rest.split('\n**Glass scenes.**')[0])};
  // Each scene once, under the part it has.
  const all = [...listed.signature, ...listed.openers, ...listed.rest];
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(listed.signature.filter(type => !F.SIGNATURE.has(type)), []);
  assert.deepEqual(listed.openers.filter(type => !F.OPENERS.has(type) || F.SIGNATURE.has(type)), []);
  assert.deepEqual(listed.rest.filter(type => F.OPENERS.has(type) || F.SIGNATURE.has(type)), []);
  // The newest of ours stand at the very top.
  assert.deepEqual(listed.signature.slice(0, 3), ['kinetic-burst-words', 'kinetic-spin-words', 'kinetic-swap-words']);
  assert.ok(listed.signature.indexOf('lens-wall') < listed.signature.indexOf('pullback'));
  // A signature moment that opens a film says so on its line.
  assert.match(library, /^- kinetic-spin-words .* Opens a film too\.$/m);
  assert.doesNotMatch(library, /^- kinetic-burst-words .* Opens a film too\.$/m);
  // The rule names no list of its own that could fall behind.
  assert.doesNotMatch(guide, /pullback, dot, knockout, hive, orb, between, drag, field, flip, assemble, scatter, arc/);
});
