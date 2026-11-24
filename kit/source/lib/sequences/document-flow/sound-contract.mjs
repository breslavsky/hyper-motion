// Browser-safe validation shared by the recipe compiler and offline audio build.
export const SOUND_ALIASES = Object.freeze(['switch', 'pop', 'wood', 'tick', 'ding']);
export const EVENT_KINDS = Object.freeze(['document.arrive', 'scan.start', 'document.scanned', 'document.sorted', 'action.start', 'category.ready', 'cta.reveal']);
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: expected an object`);
  return value;
}
function keys(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label}.${key}: unsupported option`);
}
export function audioGain(value, label = 'sound.gain', fallback = 1) {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label}: expected a gain from 0 to 1`);
  return value;
}
export function audioMute(value, label = 'sound.mute') {
  if (value !== undefined && typeof value !== 'boolean') throw new Error(`${label}: expected a boolean`);
  return value ?? false;
}
function validateMapping(value, label) {
  if (value === false) return;
  if (typeof value === 'string') value = {sound: value};
  keys(value, ['sound', 'gain', 'mute'], label);
  if (own(value, 'sound') && !SOUND_ALIASES.includes(value.sound)) throw new Error(`${label}.sound: expected ${SOUND_ALIASES.join(', ')}`);
  audioGain(value.gain, `${label}.gain`);
  audioMute(value.mute, `${label}.mute`);
}
function mappings(value, label) {
  if (value === undefined) return;
  object(value, label);
  for (const [kind, override] of Object.entries(value)) {
    if (!EVENT_KINDS.includes(kind)) throw new Error(`${label}.${kind}: unsupported event kind`);
    validateMapping(override, `${label}.${kind}`);
  }
}
export function validateSound(kit = {}) {
  keys(kit, ['gain', 'mute', 'musicGain', 'musicMute', 'mapping', 'targets'], 'sound');
  audioGain(kit.gain);
  audioGain(kit.musicGain, 'sound.musicGain', .32);
  audioMute(kit.mute);
  audioMute(kit.musicMute, 'sound.musicMute');
  mappings(kit.mapping, 'sound.mapping');
  if (kit.targets !== undefined) object(kit.targets, 'sound.targets');
  for (const [id, target] of Object.entries(kit.targets ?? {})) {
    if (!ID.test(id)) throw new Error(`sound.targets: invalid target id ${id}`);
    keys(target, ['gain', 'mute', 'mapping'], `sound.targets.${id}`);
    audioGain(target.gain, `sound.targets.${id}.gain`);
    audioMute(target.mute, `sound.targets.${id}.mute`);
    mappings(target.mapping, `sound.targets.${id}.mapping`);
  }
  return kit;
}

export function validateSoundTargets(kit = {}, events = []) {
  validateSound(kit);
  if (!Array.isArray(events)) throw new Error('sound events: expected an array');
  const targets = new Set(events.map(event => event?.target));
  for (const target of Object.keys(kit.targets ?? {})) {
    if (!targets.has(target)) throw new Error(`sound.targets.${target}: no event has this target`);
  }
  return kit;
}

export function resolveSoundMapping(base, override) {
  if (override === undefined) return {...base};
  if (override === false) return {...base, mute: true};
  return {...base, ...(typeof override === 'string' ? {sound: override} : override)};
}
