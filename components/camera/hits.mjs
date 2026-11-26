#!/usr/bin/env node
// The hits a camera takes, from the map of a track: its key hits inside the
// camera's time, counted from the camera's start, never two closer than a
// camera can show.
//
//   node hits.mjs <track map .json> [--start S] [--duration D] [--apart 0.3]
//
// The map is what `harness track-map --json` writes: `accents`, each with its
// time `t`, its `strength` and whether it is a `key` hit. Prints
// {"hits": [...]} for mountCamera's `hits`.
import fs from 'node:fs';

/** The key hits of a track map between `start` and `start + duration`, from `start`, at least `apart` seconds from one another; of two too close the stronger stays. */
export function cameraHits(map, {start = 0, duration = Infinity, apart = 0.3} = {}) {
  if (!Array.isArray(map?.accents)) throw new Error('hits: the file is not a track map (no "accents")');
  const kept = [];
  for (const accent of map.accents.filter(a => a.key && a.t >= start && a.t < start + duration).sort((a, b) => a.t - b.t)) {
    const last = kept.at(-1);
    if (last && accent.t - last.t < apart) { if (accent.strength > last.strength) kept[kept.length - 1] = accent; continue; }
    kept.push(accent);
  }
  return kept.map(accent => Number((accent.t - start).toFixed(3)));
}

if (process.argv[1] && import.meta.url === new URL(`file://${fs.realpathSync(process.argv[1])}`).href) {
  const [file, ...rest] = process.argv.slice(2), options = {};
  for (let i = 0; i < rest.length; i += 2) {
    const name = rest[i]?.replace(/^--/, ''), value = Number(rest[i + 1]);
    if (!['start', 'duration', 'apart'].includes(name) || !Number.isFinite(value)) { console.error(`hits: ${rest[i]} ${rest[i + 1] ?? ''} is not an option; --start, --duration and --apart take seconds`); process.exit(2); }
    options[name] = value;
  }
  if (!file) { console.error('hits: give the track map: node hits.mjs derived/track/<name>.json [--start S] [--duration D]'); process.exit(2); }
  try { console.log(JSON.stringify({hits: cameraHits(JSON.parse(fs.readFileSync(file, 'utf8')), options)})); }
  catch (error) { console.error(error.message); process.exit(1); }
}
