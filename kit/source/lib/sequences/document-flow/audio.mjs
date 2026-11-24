// Build-time native audio placement. Visuals and effects share semantic events.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateSoundTargets, audioGain, audioMute, resolveSoundMapping, EVENT_KINDS} from './sound-contract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, 'audio-assets');
const OUTPUT = 'assets/document-flow-audio';
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const DEFAULT_AUDIO_KIT = Object.freeze({
  'document.arrive': Object.freeze({sound: 'pop', gain: .1}),
  'scan.start': Object.freeze({sound: 'switch', gain: .3}),
  'document.scanned': Object.freeze({sound: 'tick', gain: .16}),
  'document.sorted': Object.freeze({sound: 'wood', gain: .3}),
  'action.start': Object.freeze({sound: 'switch', gain: .24}),
  'category.ready': Object.freeze({sound: 'tick', gain: .12}),
  'cta.reveal': Object.freeze({sound: 'ding', gain: .38}),
});

export async function buildAudio({destination, events, kit = {}, duration, bpm}) {
  validateSoundTargets(kit, events);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60) throw new Error('audio.duration: expected 0 < seconds <= 60');
  if (!Number.isFinite(bpm) || bpm < 96 || bpm > 132) throw new Error('audio.bpm: expected 96–132');
  if (!Array.isArray(events)) throw new Error('audio.events: expected an array');
  const catalog = JSON.parse(await fs.readFile(path.join(ASSETS, 'catalog.json'), 'utf8'));
  const bed = JSON.parse(await fs.readFile(path.join(ASSETS, 'music.json'), 'utf8'));
  const folder = path.join(destination, OUTPUT);
  const master = audioGain(kit.gain), mute = audioMute(kit.mute);
  const used = new Set(), ids = new Set(), mutedEvents = [], clips = [];
  for (const [i, event] of events.entries()) {
    const where = `audio.events[${i}]`;
    if (!event || typeof event !== 'object') throw new Error(`${where}: expected an event`);
    if (!ID.test(event.id ?? '') || ids.has(event.id)) throw new Error(`${where}.id: expected a unique safe event id`);
    ids.add(event.id);
    if (!ID.test(event.target ?? '')) throw new Error(`${where}.target: expected a safe target id`);
    if (!EVENT_KINDS.includes(event.kind)) throw new Error(`${where}.kind: unsupported event kind`);
    if (!Number.isFinite(event.time) || event.time < 0 || event.time >= duration) throw new Error(`${where}.time: expected a time inside the sequence`);
    const strength = audioGain(event.strength, `${where}.strength`);
    const target = kit.targets?.[event.target] ?? {};
    let selected = resolveSoundMapping(DEFAULT_AUDIO_KIT[event.kind], kit.mapping?.[event.kind]);
    selected = resolveSoundMapping(selected, target.mapping?.[event.kind]);
    const gain = selected.gain * master * audioGain(target.gain) * strength;
    if (mute || target.mute || selected.mute || gain === 0) {mutedEvents.push(event.id); continue;}
    const asset = catalog.assets[selected.sound];
    if (event.time + asset.duration > duration + 1e-9) throw new Error(`${where}: ${selected.sound} tail exceeds the sequence; allocate ending hold or choose a shorter sound`);
    used.add(selected.sound);
    clips.push({id: `sfx-${event.id}`, src: `${OUTPUT}/${asset.file}`, start: event.time,
      duration: asset.duration, gain, eventId: event.id, kind: event.kind,
      target: event.target, sound: selected.sound, playbackRate: 1});
  }
  clips.sort((a, b) => a.start - b.start || a.eventId.localeCompare(b.eventId, 'en'));
  const assets = [];
  await fs.mkdir(folder, {recursive: true});
  async function copyPinned(asset, id) {
    const bytes = await fs.readFile(path.join(ASSETS, asset.file));
    if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) throw new Error(`audio.assets.${id}: pinned bytes/hash mismatch`);
    await fs.writeFile(path.join(folder, asset.file), bytes);
    assets.push({id, src: `${OUTPUT}/${asset.file}`, ...asset});
  }
  for (const id of [...used].sort()) await copyPinned(catalog.assets[id], id);
  let music = null;
  if (!mute && !kit.musicMute && audioGain(kit.musicGain, 'sound.musicGain', .32) > 0 && master > 0) {
    const playbackRate = bpm / bed.bpm;
    if (Math.abs(duration - bed.beats * 60 / bpm) > .001) throw new Error('audio.music: the reusable pulse bed requires exactly 32 musical beats');
    await copyPinned(bed, 'pulse');
    music = {id: 'music-document-flow', src: `${OUTPUT}/${bed.file}`, start: 0, duration,
      gain: audioGain(kit.musicGain, 'sound.musicGain', .32) * master, playbackRate,
      fadeIn: .012, fadeOut: .24 / playbackRate, sourceBpm: bed.bpm, sourceDuration: bed.duration,
      note: 'Native playback rate follows the same musical grid as the actions; tempo changes also transpose this demonstration bed.'};
  }
  const provenance = JSON.parse(await fs.readFile(path.join(ASSETS, 'SOURCE.json'), 'utf8'));
  provenance.note += ' The pulse bed is the existing original Pure Kinetic pulse arrangement, synthesized once without scene effects; music.json records preparation and metrics. Native playback-rate changes tempo and pitch together.';
  await fs.writeFile(path.join(folder, 'SOURCE.json'), JSON.stringify(provenance, null, 2) + '\n');
  if (music) await fs.copyFile(path.join(ASSETS, 'music.json'), path.join(folder, 'music.json'));
  const result = {schema: 'document-flow-audio.v1', bpm, duration, clips, music, mutedEvents, assets,
    provenance: `${OUTPUT}/SOURCE.json`};
  await fs.writeFile(path.join(folder, 'audio-plan.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}
