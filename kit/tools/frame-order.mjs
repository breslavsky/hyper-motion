// Whether a scene draws a moment the same whatever was drawn before it.
//
//   node kit/tools/frame-order.mjs [--scenes dot,drag] [--look noir] [--aspect 16:9] [--write] [--keep <folder>]
//        [--source <a copy of kit/source>]
//
// A render's workers take frames in no order, so a scene must be a function of its moment alone.
// `dot` once kept the plate of its last phase over its word when an early frame was drawn after a
// late one: a white rectangle in a finished film, which nobody saw while frames were drawn in order.
// The audit's --twice draws one moment twice; this draws them all, in the three orders a render
// meets: forward, backward, and each after the scene's last frame. Every scene alone, from its
// sample, at its usual length and at the longest its rules allow (lib/beats.json), each at the
// kit's tempo and at a fast one: `dot`'s fault showed only in a scene short in seconds, where it
// leaves a phase out. A length the film's own check refuses for the scene is not tried.
//
// A moment that differs by more than Chrome's own noise (see audit.mjs, `unstable`) is a fault.
// frame-order.json is the record of the scenes known to have it; --write writes it from the run
// (with --scenes: those scenes' rows only). The run needs Chrome, so no test of the kit makes it:
// run it over a scene that was changed, and over every scene before a release of the kit.
// Exit: 0 no fault outside the record, 1 faults, 2 could not run.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser, sharp} from './native-browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const RECORD = path.join(HERE, 'frame-order.json');
const MOMENTS = [0.04, 0.16, 0.3, 0.45, 0.6, 0.74, 0.88, 0.97];
// Seen at a quarter of the size: a pixel differs when a channel is off by more than this, a picture
// when more than this share of its pixels do.
const CHANNEL = 96, SHARE = 0.0002;
// The kit's own tempo (none named) and a fast track's.
const TEMPOS = [null, 160];

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);

async function differs(first, again, width, height) {
  if (again.equals(first)) return 0;
  const [w, h] = [Math.round(width / 4), Math.round(height / 4)];
  const [a, b] = await Promise.all([first, again].map(png => sharp(png).removeAlpha().resize(w, h, {fit: 'fill', kernel: 'cubic'}).raw().toBuffer()));
  let differ = 0;
  for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) > CHANNEL || Math.abs(a[i + 1] - b[i + 1]) > CHANNEL || Math.abs(a[i + 2] - b[i + 2]) > CHANNEL) differ++;
  return differ / (a.length / 3);
}

async function main() {
  const {samples} = require('./scene-clocks.cjs');
  const beats = JSON.parse(fs.readFileSync(path.join(HERE, '../source/lib/beats.json'), 'utf8'));
  const {problems} = require('../source/lib/film.cjs');
  const all = samples();
  const wanted = option('--scenes', '') ? option('--scenes').split(',') : Object.keys(all).filter(type => all[type]);
  const look = option('--look', 'noir'), aspect = option('--aspect', '16:9'), keep = option('--keep', null);
  const known = fs.existsSync(RECORD) ? JSON.parse(fs.readFileSync(RECORD, 'utf8')).scenes : {};
  const browser = await createNativeBrowser(option('--source', null) ? {source: path.resolve(option('--source'))} : {});
  const found = {};
  try {
    for (const type of wanted) {
      if (!all[type]) { console.log(`${type}: no sample`); continue; }
      const lengths = [...new Set([all[type].beats, beats[type]?.[1]].filter(Boolean))];
      const tab = await browser.newPage();
      try {
        for (const length of lengths) for (const bpm of TEMPOS) {
          const film = {aspect, style: look, brand: {name: 'Nook', url: 'nook.app'}, ...(bpm ? {music: {bpm}} : {}), scenes: [{...all[type], beats: length}]};
          if (length !== all[type].beats && problems(film).length) continue;
          const frame = await tab.play(film);
          const shot = async at => { await tab.shoot(frame.duration * at); return Buffer.from(await tab.screenshot({type: 'png'})); };
          const forward = [];
          for (const at of MOMENTS) forward.push(await shot(at));
          let worst = {share: 0};
          const hold = async (order, n, png) => {
            const share = await differs(forward[n], png, frame.width, frame.height);
            if (share > worst.share) worst = {share, order, at: MOMENTS[n]};
            if (keep && share > SHARE) { fs.mkdirSync(keep, {recursive: true}); fs.writeFileSync(path.join(keep, `${type}-${length}-${bpm ?? 'kit'}-${order}-${MOMENTS[n]}-a.png`), forward[n]); fs.writeFileSync(path.join(keep, `${type}-${length}-${bpm ?? 'kit'}-${order}-${MOMENTS[n]}-b.png`), png); }
          };
          for (let n = MOMENTS.length - 1; n >= 0; n--) await hold('backward', n, await shot(MOMENTS[n]));
          for (let n = 0; n < MOMENTS.length; n++) { await shot(0.995); await hold('after the end', n, await shot(MOMENTS[n])); }
          if (worst.share > SHARE) {
            const row = found[type] ??= {share: 0};
            if (worst.share > row.share) found[type] = {share: Number(worst.share.toFixed(4)), beats: length, ...(bpm ? {bpm} : {}), order: worst.order, at: worst.at};
          }
        }
      } catch (error) {
        found[type] = {error: String(error.message).split('\n')[0].slice(0, 160)};
      } finally {
        await tab.close();
      }
      const row = found[type];
      console.log(`${type}: ${row ? (row.error ? `could not be drawn: ${row.error}` : `${(row.share * 100).toFixed(2)}% of the picture differs at ${row.at} of ${row.beats} beats${row.bpm ? ` at ${row.bpm} BPM` : ''}, drawn ${row.order}`) : 'the same in every order'}`);
    }
  } finally {
    await browser.close();
  }
  if (args.includes('--write')) {
    // A run over some scenes rewrites their rows and leaves the others.
    const scenes = option('--scenes', '') ? Object.fromEntries(Object.entries({...known, ...Object.fromEntries(wanted.map(type => [type, found[type]]))}).filter(([, row]) => row)) : found;
    fs.writeFileSync(RECORD, `${JSON.stringify({_: 'Scenes known to draw a moment differently after other moments (tools/frame-order.mjs). A scene leaves this list when it is fixed; none is added.', look, aspect, scenes}, null, 1)}\n`);
  }
  const fresh = Object.keys(found).filter(type => !known[type]);
  console.log(`${wanted.length} scenes, ${Object.keys(found).length} differ${fresh.length ? `, not in the record: ${fresh.join(', ')}` : ''}`);
  process.exit(fresh.length && !args.includes('--write') ? 1 : 0);
}

main().catch(error => { console.error(error); process.exit(2); });
