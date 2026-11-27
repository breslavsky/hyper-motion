#!/usr/bin/env node
// What clock the moments inside every scene keep: the film's beats, seconds, or a share of the scene.
//
//   node kit/tools/scene-clocks.cjs            print the count and the lists
//   node kit/tools/scene-clocks.cjs --write    write kit/tools/scene-clocks.json again
//
// A film on music has its beat from the track, so a scene whose moments stand on beats follows the
// music by itself, and one whose moments stand on seconds follows it only with its first frame. Each
// scene's sample (the Storybook's) is planned as a film of one scene at 120 and at 150 BPM, and the
// moments it sounds on (its own cues, the keystrokes of typing left out) are held against each other:
// on the film's beats at both tempos (the same beat, or an eighth of a beat at each: "the first half
// beat after the cards are in" is another beat at another tempo and on the beat all the same), the
// same second, or the same share of the scene's length. A scene is called by what seven in ten of its
// moments do, `mixed` when they do not agree, `none` when it sounds on nothing between its first
// frame and its last. A moment that is a move's own length before or after one on a beat (the dive
// that lands on it, the sparkle a quarter second after a hit) keeps the beat too: it is counted
// with the moment it belongs to (`led`).
//
// It reads sound cues, not pixels: a scene can move where it makes no sound. The record is kept in
// scene-clocks.json and held by scene-clocks.test.mjs, so a scene that changes its clock says so.
const fs = require('node:fs'), path = require('node:path');

const KIT = path.join(__dirname, '..');
const RECORD = path.join(__dirname, 'scene-clocks.json');
const TEMPOS = [120, 150];
const SAME_BEAT = 0.04, SAME_SECOND = 0.025, SAME_SHARE = 0.012, MOST = 0.7;
// A moment stands on the grid when it is this near an eighth of a beat, in beats.
const GRID = 8, ON_GRID = 0.012;

function samples() {
  const read = file => JSON.parse(fs.readFileSync(path.join(KIT, file), 'utf8'));
  const own = require(path.join(KIT, 'source/lib/components/metadata.cjs'));
  const fill = value => JSON.parse(JSON.stringify(value).replaceAll('{name}', 'Nook').replaceAll('{NAME}', 'NOOK')
    .replaceAll('{url}', 'nook.app').replaceAll('{tagline}', 'Ideas in motion'));
  const out = {};
  for (const film of read('tools/kinetic/templates.json')) for (const scene of film.scenes) if (!(scene.type in out)) {
    const {image, images, ...rest} = scene;
    out[scene.type] = fill(rest);
  }
  for (const scene of read('tools/kinetic/samples.json')) if (!(scene.type in out)) out[scene.type] = fill(scene);
  for (const [type, definition] of Object.entries(own)) if (definition.sample) out[type] = fill(definition.sample);
  return Object.fromEntries(Object.keys(read('source/lib/components/catalog.json')).map(type => [type, out[type] ?? null]));
}

function measure() {
  const home = process.cwd();
  process.chdir(path.join(KIT, 'source'));
  try {
    const F = require(path.join(KIT, 'source/lib/film.cjs'));
    const moments = (scene, bpm) => {
      const plan = F.planOf({aspect: '16:9', style: 'noir', brand: {name: 'Nook', url: 'nook.app'}, music: {track: 'none', bpm}, scenes: [scene]});
      const first = plan.scenes[0];
      return {beat: plan.beat, dur: first.dur, at: plan.audioEvents
        .filter(event => event.scene === 0 && event.kind !== 'type' && event.t > first.start + 0.02 && event.t < first.start + first.dur - 0.01)
        .map(event => event.t - first.start)};
    };
    const out = {};
    for (const [type, scene] of Object.entries(samples())) {
      if (!scene) { out[type] = {clock: 'unknown', moments: 0}; continue; }
      let a, b;
      try { [a, b] = TEMPOS.map(bpm => moments(scene, bpm)); } catch { out[type] = {clock: 'unknown', moments: 0}; continue; }
      if (!a.at.length) { out[type] = {clock: 'none', moments: 0}; continue; }
      if (a.at.length !== b.at.length) { out[type] = {clock: 'mixed', moments: a.at.length}; continue; }
      const kinds = a.at.map((t, i) => {
        const u = b.at[i];
        if (Math.abs(t / a.beat - u / b.beat) < SAME_BEAT) return 'beats';
        if ([t / a.beat, u / b.beat].every(at => Math.abs(at * GRID - Math.round(at * GRID)) < ON_GRID * GRID)) return 'beats';
        if (Math.abs(t - u) < SAME_SECOND) return 'seconds';
        if (Math.abs(t / a.dur - u / b.dur) < SAME_SHARE) return 'share';
        return 'other';
      });
      // The same seconds from a moment on a beat, at both tempos: a move's own length before or after it.
      const led = kinds.map((kind, i) => kind !== 'beats' && kinds.some((other, j) => other === 'beats' && Math.abs((a.at[i] - a.at[j]) - (b.at[i] - b.at[j])) < SAME_SECOND));
      const onBeats = kinds.filter(k => k === 'beats').length, withBeats = onBeats + led.filter(Boolean).length;
      // Half of a scene's moments on beats at the least: one that falls on the grid by chance leads nothing.
      const clock = onBeats >= kinds.length / 2 && withBeats >= kinds.length * MOST ? 'beats'
        : ['seconds', 'share'].find(kind => kinds.filter(k => k === kind).length >= kinds.length * MOST) ?? 'mixed';
      out[type] = {clock, moments: kinds.length, onBeats, ...(withBeats > onBeats ? {led: withBeats - onBeats} : {})};
    }
    return out;
  } finally { process.chdir(home); }
}

module.exports = {measure, samples, RECORD};

if (require.main === module) {
  const found = measure();
  if (process.argv.includes('--write')) fs.writeFileSync(RECORD, `${JSON.stringify(found, null, 1)}\n`);
  for (const clock of ['beats', 'seconds', 'share', 'mixed', 'none', 'unknown']) {
    const types = Object.keys(found).filter(type => found[type].clock === clock);
    if (types.length) console.log(`${clock} (${types.length}): ${types.join(' ')}`);
  }
}
