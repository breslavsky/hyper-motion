// Resolve semantic events into native HyperFrames audio clips using local CC0 files.
// This module runs at build time. It never creates an AudioContext or plays audio.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, 'audio-assets');
const OUTPUT = 'assets/ui-world-audio';
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/;
const hash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const defaults = {
  'switch.on': { sound: 'switch', gain: 0.32 },
  'actor.detach': { sound: 'pop', gain: 0.38 },
  'actor.land': { sound: 'wood', gain: 0.50 },
  'slider.tick': { sound: 'tick', gain: 0.10 },
  'slider.complete': { sound: 'ding', gain: 0.32 },
};
export const DEFAULT_AUDIO_KIT = Object.freeze({
  gain: 1, mute: false,
  mapping: Object.freeze(Object.fromEntries(Object.entries(defaults).map(([kind, entry]) => [kind, Object.freeze(entry)]))),
});

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: expected an object`);
  return value;
}
function keys(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label}.${key}: unsupported option`);
}
function gain(value, label) {
  if (value === undefined) return 1;
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label}: use a linear gain from 0 to 1`);
  return value;
}
function mute(value, label) {
  if (value !== undefined && typeof value !== 'boolean') throw new Error(`${label}: expected a boolean`);
  return value ?? false;
}
function mapping(base, override, label, assets) {
  if (override === undefined) return { ...base };
  if (override === false) return { ...base, mute: true };
  if (typeof override === 'string') override = { sound: override };
  keys(override, ['sound', 'gain', 'mute'], label);
  const next = { ...base, ...override };
  if (!assets[next.sound]) throw new Error(`${label}.sound: use ${Object.keys(assets).join(', ')}`);
  next.gain = gain(next.gain, `${label}.gain`);
  next.mute = mute(next.mute, `${label}.mute`);
  return next;
}
function checkMappings(value, label, assets) {
  if (value === undefined) return;
  object(value, label);
  for (const [kind, override] of Object.entries(value)) {
    if (!defaults[kind]) throw new Error(`${label}.${kind}: unsupported event kind`);
    mapping(defaults[kind], override, `${label}.${kind}`, assets);
  }
}

/**
 * kit: {gain?, mute?, mapping?, targets?: {[componentId]: {gain?, mute?, mapping?}}}.
 * A mapping value is a sound alias, {sound?, gain?, mute?}, or false to mute it.
 * Gains are linear (native data-volume). Component target settings multiply the
 * semantic gain and master gain. No timing is inferred or rounded to video FPS.
 */
export async function buildAudio({ destination, events, kit = {}, duration = 6 }) {
  if (typeof destination !== 'string' || !destination.trim()) throw new Error('audio.destination: expected a project directory');
  if (!Array.isArray(events)) throw new Error('audio.events: expected an array');
  if (!Number.isFinite(duration) || duration <= 0 || duration > 120) throw new Error('audio.duration: expected positive seconds, at most 120');
  const catalog = JSON.parse(await fs.readFile(path.join(ASSETS, 'catalog.json'), 'utf8'));
  const available = catalog.assets;
  keys(kit, ['gain', 'mute', 'mapping', 'targets'], 'audio.kit');
  const masterGain = gain(kit.gain, 'audio.kit.gain');
  const masterMute = mute(kit.mute, 'audio.kit.mute');
  checkMappings(kit.mapping, 'audio.kit.mapping', available);
  if (kit.targets !== undefined) object(kit.targets, 'audio.kit.targets');
  for (const [target, options] of Object.entries(kit.targets ?? {})) {
    if (!ID.test(target)) throw new Error(`audio.kit.targets: invalid component id ${target}`);
    keys(options, ['gain', 'mute', 'mapping'], `audio.kit.targets.${target}`);
    gain(options.gain, `audio.kit.targets.${target}.gain`);
    mute(options.mute, `audio.kit.targets.${target}.mute`);
    checkMappings(options.mapping, `audio.kit.targets.${target}.mapping`, available);
  }
  const ids = new Set();
  const used = new Set();
  const mutedEvents = [];
  const clips = [];
  for (const [index, event] of events.entries()) {
    object(event, `audio.events[${index}]`);
    if (typeof event.id !== 'string' || !ID.test(event.id) || ids.has(event.id)) throw new Error(`audio.events[${index}].id: use a unique safe event id`);
    ids.add(event.id);
    if (!Number.isFinite(event.time) || event.time < 0 || event.time > duration) throw new Error(`audio.events[${index}].time: use seconds within the recipe`);
    if (!defaults[event.kind]) throw new Error(`audio.events[${index}].kind: unsupported event ${event.kind}`);
    if (typeof event.target !== 'string' || !ID.test(event.target)) throw new Error(`audio.events[${index}].target: use a component id`);
    const target = kit.targets?.[event.target] ?? {};
    let selected = mapping(defaults[event.kind], kit.mapping?.[event.kind], `audio.kit.mapping.${event.kind}`, available);
    selected = mapping(selected, target.mapping?.[event.kind], `audio.kit.targets.${event.target}.mapping.${event.kind}`, available);
    const clipGain = selected.gain * masterGain * gain(target.gain, `audio.kit.targets.${event.target}.gain`);
    if (masterMute || mute(target.mute, `audio.kit.targets.${event.target}.mute`) || selected.mute || clipGain === 0) {
      mutedEvents.push(event.id);
      continue;
    }
    const asset = available[selected.sound];
    if (event.time + asset.duration > duration) throw new Error(`audio.events[${index}]: ${selected.sound} tail exceeds the recipe`);
    used.add(selected.sound);
    clips.push({
      id: `sfx-${event.id}`, src: `${OUTPUT}/${asset.file}`, start: event.time,
      duration: asset.duration, gain: clipGain, eventId: event.id,
      kind: event.kind, target: event.target, sound: selected.sound,
    });
  }
  // Stable ordering keeps equal-time events and the output manifest repeatable.
  clips.sort((a, b) => a.start - b.start || a.eventId.localeCompare(b.eventId, 'en'));
  const destinationRoot = path.resolve(destination);
  const folder = path.join(destinationRoot, OUTPUT);
  await fs.mkdir(folder, { recursive: true });
  const assets = [];
  for (const name of [...used].sort()) {
    const meta = available[name];
    const bytes = await fs.readFile(path.join(ASSETS, meta.file));
    if (bytes.length !== meta.bytes || hash(bytes) !== meta.sha256) throw new Error(`audio.assets.${name}: bundled file failed its pinned SHA-256 check`);
    await fs.writeFile(path.join(folder, meta.file), bytes);
    assets.push({ id: name, src: `${OUTPUT}/${meta.file}`, ...meta });
  }
  const source = JSON.parse(await fs.readFile(path.join(ASSETS, 'SOURCE.json'), 'utf8'));
  await fs.writeFile(path.join(folder, 'SOURCE.json'), `${JSON.stringify(source, null, 2)}\n`);
  const provenance = {
    sourceFile: `${OUTPUT}/SOURCE.json`, catalogFile: `${OUTPUT}/catalog.json`,
    license: 'CC0-1.0', sampleRate: 48000, channels: 1,
    note: 'Local pinned assets only. Onsets trimmed before placement; no leading-silence timing offset, browser playback calls, generated music or voiceover.',
  };
  await fs.writeFile(path.join(folder, 'catalog.json'), `${JSON.stringify({ version: 1, assets: Object.fromEntries(assets.map(({ id, ...asset }) => [id, asset])) }, null, 2)}\n`);
  const result = { clips, assets, provenance, mutedEvents };
  await fs.writeFile(path.join(folder, 'audio-plan.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

export default buildAudio;
