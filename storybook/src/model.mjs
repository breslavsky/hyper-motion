// Browser-safe Storybook controls; the shipped compiler still owns all layout
// and timing. This module only translates controls into a film recipe.
import definitions from '../generated/metadata.mjs';
import brandbooks from '../generated/brandbooks.mjs';
import settings from '../generated/settings.mjs';

export const FORMATS = Object.freeze(['16:9', '9:16', '1:1']);
const freeze=value=>{for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);return Object.freeze(value);};
export const BRANDBOOKS = freeze(brandbooks);
export const MATERIALS = Object.freeze([...settings.materials]);
// The toolbar's font: the brandbook's own (or the style's) unless a bundled family is picked.
export const FONTS = Object.freeze([...settings.fonts]);
export const DEFAULT_FONT = 'default';
export const MATERIAL_COMPONENTS = Object.freeze([...settings.materialComponents]);
// Outside the manifest ID pattern: a real book cannot shadow native defaults.
export const DEFAULT_BRANDBOOK = '__default__';
// The look a preview is drawn in. A brandbook is colours and a font and never changes how anything
// moves; a look is the kit's own: how text comes in (a spring, a mask, a slam, letters that decode),
// its transitions, its texture and its colours. Glass unless the toolbar picks another.
export const LOOKS = Object.freeze([...settings.looks]);
export const DEFAULT_LOOK = 'glass';
const PALETTE = new Set(['paper', 'ink', 'lime', 'sage', 'peach', 'electric', 'coral', 'sky', 'lilac', 'butter', 'brand', 'brand2']);
const clone = value => value === undefined ? undefined : structuredClone(value);
const empty = value => value === undefined || value === null || value === '';
const beatsMax = entry => Math.min(32, (entry.beatRange?.[1] ?? 30) + 2);
const glassTiming = entry => entry.family === 'glass' && Boolean(entry.fields.timing);
const bpmField = {kind: 'number', min: 60, max: 180};

function fieldDescription(spec) {
  const details = [spec.optional ? 'Optional' : 'Required'];
  const unit = spec.kind === 'string' ? ' characters' : spec.kind === 'array' ? ' items' : '';
  if (spec.min !== undefined) details.push(`minimum ${spec.min}${unit}`);
  if (spec.max !== undefined) details.push(`maximum ${spec.max}${unit}`);
  if (spec.wide !== undefined) details.push(`maximum ${spec.wide} characters for non-Latin copy`);
  if (spec.int) details.push('whole number');
  if (spec.kind === 'enum') details.push(`one of ${spec.values.join(', ')}`);
  return details.join(' · ');
}

export function argTypesFor(entry) {
  const timedGlass = glassTiming(entry);
  const fields = Object.fromEntries(Object.entries(entry.fields).map(([name, spec]) => {
    const control = spec.kind === 'enum' ? {type: 'select'}
      : spec.kind === 'bool' ? {type: 'boolean'}
        : spec.kind === 'number' ? {type: 'number', ...(spec.min !== undefined ? {min: spec.min} : {}), ...(spec.max !== undefined ? {max: spec.max} : {}), ...(spec.int ? {step: 1} : {})}
          : ['array', 'tuple', 'object', 'rect'].includes(spec.kind) ? {type: 'object'}
            : {type: 'text'};
    let description = fieldDescription(spec);
    if (timedGlass && name === 'speed') {
      control.step = 0.05;
      description = 'Animation speed within this scene. Choose 0.25× to 4×. Defaults to 1×.';
    }
    if (timedGlass && name === 'timing') {
      const actions = Object.entries(spec.fields).map(([key, field]) => field.kind === 'array' ? key + '[]' : key);
      description = `Set events in beats from the start of the scene. Fractional beats are supported. Available events are ${actions.join(', ')}.`;
    }
    const placeholder = entry.type === 'glass-search' && name === 'placeholder';
    return [name, {
      control, ...(spec.kind === 'enum' ? {options: [...spec.values]} : {}),
      ...(placeholder ? {name: 'Placeholder'} : {}),
      description: placeholder ? 'Text shown before typing. Clear it to hide the hint.' : description,
      table: {category: timedGlass && ['timing', 'speed'].includes(name) ? 'Timing' : ['place', 'size'].includes(name) ? 'Placement' : 'Component', type: {summary: spec.kind},
        ...(Object.hasOwn(spec, 'default') ? {defaultValue: {summary: String(spec.default)}} : {})},
    }];
  }));
  return {
    ...fields,
    beats: {control: {type: 'number', min: 1, max: timedGlass ? 32 : beatsMax(entry), step: 1}, description: `Scene duration in beats. The usual range is ${(entry.beatRange ?? [1, 30]).join('–')}.`, table: {category: 'Timing'}},
    ...(timedGlass ? {bpm: {control: {type: 'number', min: bpmField.min, max: bpmField.max}, description: 'Music tempo for the whole film in beats per minute.', table: {category: 'Timing'}}} : {}),
  };
}

export function defaultArgs(entry) {
  const args = {beats: entry.sample.beats};
  if (glassTiming(entry)) args.bpm = 120;
  for (const [name, spec] of Object.entries(entry.fields)) {
    if (Object.hasOwn(entry.sample, name)) args[name] = clone(entry.sample[name]);
    else if (Object.hasOwn(spec, 'default')) args[name] = clone(spec.default);
  }
  return args;
}

function valueErrors(value, spec, at) {
  if (value === undefined || value === null) {
    return spec.optional ? [] : [`${at}: required`];
  }
  if (spec.kind === 'string') {
    if (typeof value !== 'string') return [`${at}: must be text`];
    const length = [...value.trim()].length;
    const maximum = spec.wide && /[^\u0000-\u024F\u2000-\u206F]/.test(value) ? Math.min(spec.max ?? Infinity, spec.wide) : spec.max;
    if (spec.min !== undefined && length < spec.min) return [`${at}: use at least ${spec.min} characters`];
    if (maximum !== undefined && length > maximum) return [`${at}: use at most ${maximum} characters (currently ${length})`];
    return [];
  }
  if (spec.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return [`${at}: must be a finite number`];
    if (spec.int && !Number.isInteger(value)) return [`${at}: must be a whole number`];
    if (spec.min !== undefined && value < spec.min) return [`${at}: minimum ${spec.min}`];
    if (spec.max !== undefined && value > spec.max) return [`${at}: maximum ${spec.max}`];
  } else if (spec.kind === 'bool') {
    if (typeof value !== 'boolean') return [`${at}: must be true or false`];
  } else if (spec.kind === 'enum') {
    if (!spec.values.includes(value)) return [`${at}: choose ${spec.values.join(', ')}`];
  } else if (spec.kind === 'colour') {
    if (typeof value !== 'string' || (!PALETTE.has(value) && !/^#[0-9a-fA-F]{3,8}$/.test(value))) return [`${at}: use a palette name or #hex colour`];
  } else if (spec.kind === 'rect') {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || !['x', 'y', 'w', 'h'].every(key => Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 1)) return [`${at}: x, y, w and h must be numbers from 0 to 1`];
  } else if (spec.kind === 'array' || spec.kind === 'tuple') {
    if (!Array.isArray(value)) return [`${at}: must be a list`];
    if (spec.kind === 'tuple' && value.length !== spec.of.length) return [`${at}: needs exactly ${spec.of.length} items`];
    if (spec.min !== undefined && value.length < spec.min) return [`${at}: needs at least ${spec.min} items`];
    if (spec.max !== undefined && value.length > spec.max) return [`${at}: accepts at most ${spec.max} items`];
    return value.flatMap((item, index) => valueErrors(item, spec.kind === 'tuple' ? spec.of[index] : spec.of, `${at}[${index}]`));
  } else if (spec.kind === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${at}: must be an object`];
    return Object.entries(spec.fields).flatMap(([name, field]) => valueErrors(value[name], field, `${at}.${name}`));
  }
  return [];
}

function sceneFromArgs(entry, values) {
  const scene = {type: entry.type, beats: values.beats};
  for (const [name, spec] of Object.entries(entry.fields)) {
    const value = values[name];
    const acceptsBlank = spec.kind === 'string' && spec.min === 0;
    if (spec.optional && (value == null || (value === '' && !acceptsBlank))) continue;
    scene[name] = clone(value);
  }
  return scene;
}

export function validateArgs(entry, args = {}) {
  const values = {...defaultArgs(entry), ...args};
  const scene = sceneFromArgs(entry, values);
  const errors = Object.entries(entry.fields).flatMap(([name, spec]) => valueErrors(scene[name], spec, name));
  const timedGlass = glassTiming(entry);
  if (timedGlass) errors.push(...valueErrors(values.bpm, bpmField, 'bpm'));
  const definition = definitions[entry.type];
  const authoredTiming = timedGlass && definition.hasAuthoredTiming(scene);
  errors.push(...valueErrors(values.beats, {kind: 'number', min: 1, max: authoredTiming ? 32 : beatsMax(entry)}, 'beats'));
  // Reuse component-owned relational and media rules (scan categories, matching
  // image lists, literal quote emphasis) instead of maintaining weaker copies.
  if (!errors.length && (definition?.validate || timedGlass)) {
    errors.push(...(definition.validate?.(scene) ?? []));
    if (timedGlass && !errors.length) {
      const localBeat = 60 / values.bpm * settings.previewPace.speed;
      const actualBeats = Math.max(1, Math.round(values.beats * settings.previewPace.beats));
      try { definition.retime(scene, actualBeats * localBeat, localBeat); }
      catch (error) { errors.push(error.message); }
    }
  }
  return errors;
}

export function makeFilm(entry, args = {}, globals = {}) {
  // URL-safe toolbar values survive Storybook's colon-delimited globals links.
  const aspect = {landscape: '16:9', portrait: '9:16', square: '1:1'}[globals.aspect] ?? globals.aspect ?? '16:9';
  const brandbook = empty(globals.brandbook) ? DEFAULT_BRANDBOOK : globals.brandbook;
  // A look the kit does not have (a stale link) is no choice: the preview stays in Glass.
  const look = LOOKS.includes(globals.look) ? globals.look : DEFAULT_LOOK;
  // The toolbar's "example" keeps a material example on the material it is
  // named after (exampleMaterial); elsewhere it is plain glass.
  // A family the kit does not bundle (a stale link) is no choice: the brandbook's font stays.
  const font = FONTS.includes(globals.font) ? globals.font : DEFAULT_FONT;
  const picked = globals.material ?? 'example';
  const material = picked === 'example' ? globals.exampleMaterial ?? 'dark-glass' : picked;
  if (!FORMATS.includes(aspect)) throw new Error(`Unknown aspect: ${aspect}`);
  if (brandbook!==DEFAULT_BRANDBOOK&&!Object.hasOwn(BRANDBOOKS, brandbook)) throw new Error(`Unknown brandbook: ${brandbook}`);
  if (!MATERIALS.includes(material)) throw new Error(`Unknown material: ${material}`);
  const errors = validateArgs(entry, args);
  if (errors.length) throw new Error(errors.join('\n'));
  const values = {...defaultArgs(entry), ...args};
  return {
    aspect, style: look, ...(MATERIAL_COMPONENTS.includes(entry.type)?{material}:{}), pace: 'normal',
    ...(glassTiming(entry) ? {music: {bpm: values.bpm}} : {}),
    // The validator requires sample identity, but no visual brand overrides.
    brand: {...(brandbook===DEFAULT_BRANDBOOK?{name:'Nook',url:'nook.app'}:clone(BRANDBOOKS[brandbook].brand)), ...(font===DEFAULT_FONT?{}:{font})},
    scenes: [sceneFromArgs(entry, values)],
  };
}
