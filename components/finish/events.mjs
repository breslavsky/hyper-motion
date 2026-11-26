#!/usr/bin/env node
// The events a finish takes, from the map of a reference video: its flashes,
// its shake bursts and its hits inside the finish's time, counted from the
// finish's start.
//
//   node events.mjs <reference map .json> [--start S] [--duration D]
//
// The map is what `harness reference-map --json` writes: `events` with
// `flashes` [{t, frames, kind}], `shakes` [{t, d, amp}] and `hits` [t].
// Prints {"flashes", "shakes", "hits"} for mountFinish, as they are.
import fs from 'node:fs';

/** The flashes, shakes and hits of a reference map between `start` and `start + duration`, their times counted from `start`. */
export function finishEvents(map, {start = 0, duration = Infinity} = {}) {
  const events = map?.events;
  if (!events || !Array.isArray(events.flashes) || !Array.isArray(events.shakes) || !Array.isArray(events.hits)) throw new Error('events: the file is not a reference map (no "events" with flashes, shakes and hits)');
  const inside = t => t >= start && t < start + duration, from = t => Number((t - start).toFixed(3));
  return {
    flashes: events.flashes.filter(flash => inside(flash.t)).map(flash => ({t: from(flash.t), frames: flash.frames, kind: flash.kind})),
    // A shake larger than the finish allows is the reference's camera thrown about: kept at the most a finish shakes.
    shakes: events.shakes.filter(shake => inside(shake.t)).map(shake => ({t: from(shake.t), d: shake.d, amp: Math.min(shake.amp, 0.1)})),
    hits: events.hits.filter(inside).map(from),
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${fs.realpathSync(process.argv[1])}`).href) {
  const [file, ...rest] = process.argv.slice(2), options = {};
  for (let i = 0; i < rest.length; i += 2) {
    const name = rest[i]?.replace(/^--/, ''), value = Number(rest[i + 1]);
    if (!['start', 'duration'].includes(name) || !Number.isFinite(value)) { console.error(`events: ${rest[i]} ${rest[i + 1] ?? ''} is not an option; --start and --duration take seconds`); process.exit(2); }
    options[name] = value;
  }
  if (!file) { console.error('events: give the reference map: node events.mjs derived/reference/<name>.dynamics.json [--start S] [--duration D]'); process.exit(2); }
  try { console.log(JSON.stringify(finishEvents(JSON.parse(fs.readFileSync(file, 'utf8')), options))); }
  catch (error) { console.error(error.message); process.exit(1); }
}
