// Tooling-only projection of the shipped catalogue. Nothing here owns a scene.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
export const TEMPLATE = process.env.PURE_KINETIC_TEMPLATE
  ? path.resolve(process.env.PURE_KINETIC_TEMPLATE)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../kit');
const source = path.join(TEMPLATE, 'source');
const read = name => JSON.parse(fs.readFileSync(path.join(TEMPLATE, name), 'utf8'));
const clone = value => structuredClone(value);
const timingExamples = {
  ask: [{
    exportName: 'OnTheBeat', name: 'On the beat',
    args: {text: 'Any openings on Tuesday?', reply: 'Three spots left.', beats: 6, bpm: 120, speed: 1,
      timing: {open: 0.5, type: 1, typed: 2.5, send: 3, reply: 4}},
  }],
  'glass-send-prompt': [{
    exportName: 'CameraFlight', name: 'Long pullback',
    args: {bpm: 96, beats: 14, timing: {typed: 2.5, pull: 3, landed: 7, send: 7.25, sent: 13.25}},
  }, {
    exportName: 'SendWave', name: 'Send wave',
    args: {bpm: 100, beats: 14, timing: {typed: 2.5, pull: 2.75, landed: 4.5, send: 5, sent: 13}},
  }],
};

// A scene that takes a picture or a video of the user's is also shown with one: named examples with the
// Storybook's own sample files (src/preview.mjs loads them from our public CDN).
export const MEDIA_EXAMPLES = {
  'kinetic-swap-words': [
    {exportName: 'ExampleVideo', name: 'With a video', args: {beats: 8, video: 'assets/talking-head.mp4'}},
    {exportName: 'ExampleImage', name: 'With a picture', args: {beats: 8, image: 'assets/glass-bahamas.webp'}},
    // The clip is handed over: it goes to a part of the frame and the same video goes on there as the film's own clip.
    {exportName: 'ExampleHandedFull', name: 'Handed over to the whole frame', args: {beats: 8, video: 'assets/talking-head.mp4', to: {x: 0, y: 0, w: 1, h: 1}}},
    {exportName: 'ExampleHandedPart', name: 'Handed over to a part of the frame', args: {beats: 8, video: 'assets/talking-head.mp4', to: {x: 0.52, y: 0.12, w: 0.4, h: 0.76}}},
  ],
};

/** Named stories opt in through canonical metadata; values stay in its enum. */
export function previewVariantsFor(type, fields, selected) {
  if (selected === undefined) return [];
  if (!Array.isArray(selected) || selected.some(name => typeof name !== 'string' || !name)
      || new Set(selected).size !== selected.length) {
    throw new Error(`${type}.previewVariants must be a list of distinct enum field names`);
  }
  const identifier = value => {
    const text = String(value);
    return text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^a-zA-Z0-9]+/).filter(Boolean)
      .map(part => part[0].toUpperCase()+part.slice(1)).join('')
      || 'Code'+[...text].map(character => character.codePointAt(0).toString(16)).join('_');
  };
  const variants = selected.flatMap(field => {
    const spec = fields[field];
    if (spec?.kind !== 'enum' || !Array.isArray(spec.values) || !spec.values.length
        || spec.values.some(value => !(['string', 'boolean', 'number'].includes(typeof value))
          || typeof value === 'number' && !Number.isFinite(value) || value === '')
        || new Set(spec.values).size !== spec.values.length) {
      throw new Error(`${type}.previewVariants: ${field} must name an enum with distinct nonempty primitive values`);
    }
    return spec.values.map(value => ({
      exportName: `Variant${identifier(field)}${identifier(value)}`,
      name: `${field}: ${value}`,
      args: {[field]: clone(value)},
    }));
  });
  if (new Set(variants.map(variant => variant.exportName)).size !== variants.length) {
    throw new Error(`${type}.previewVariants produce colliding story names; use distinct enum labels`);
  }
  return variants;
}

export function readCatalogOptions(catalog = read('source/lib/components/catalog.json')) {
  const {looks, metalVariants = [], materials, paces} = require(path.join(source, 'lib/compiler/plan.cjs'));
  if(!Array.isArray(materials)||!materials.includes('glass')||!materials.includes('metal'))throw new Error('The selected Pure Kinetic kit needs independent material support; update the kit before preparing Storybook');
  const materialComponents = Object.keys(catalog).filter(type =>
    catalog[type].family === 'glass' && catalog[type].renderMode === 'webgl');
  // The families a film may name in brand.font: the toolbar offers them.
  const {BUNDLED_FONTS: fonts} = require(path.join(source, 'lib/film.cjs'));
  if(!Array.isArray(fonts)||!fonts.length)throw new Error('The selected Pure Kinetic kit names no bundled fonts; update the kit before preparing Storybook');
  return {looks: Object.keys(looks), metalVariants: [...metalVariants], materials:[...materials], materialComponents, fonts:[...fonts], previewPace: paces.normal};
}

/** Material previews reuse production components, samples and field controls. */
// The sidebar has three sections of scenes: Glass, the scenes drawn in depth
// (Three.js and the wall under a lens) as 3D, and every other family as a
// folder of Pure Kinetic.
const SECTIONS = {glass: 'Glass', three: '3D', 'lens-wall': '3D'};
// A scene can name a section of its own (a ride: Rides).
export const storyTitle = entry => entry.section ? `${entry.section}/${entry.type}` : SECTIONS[entry.family] ? `${SECTIONS[entry.family]}/${entry.type}` : `Pure Kinetic/${entry.family}/${entry.type}`;

// The materials a 3D Glass scene is shown in: named examples of the scene's
// own page (Glass, Dark Glass, Metal), not a section of their own.
export function readThemePreviews(catalog = readCatalog(), settings = readCatalogOptions()) {
  return settings.materialComponents.map(type => {
    const entry = catalog.find(item => item.type === type);
    if (!entry) throw new Error(`Material preview needs canonical component ${type}`);
    if (entry.renderMode !== 'webgl') throw new Error(`Material preview needs the 3D implementation of ${type}`);
    return {
      type, title: storyTitle(entry),
      variants: settings.materials.map(material => {
        const words = material.split('-').map(word => word[0].toUpperCase() + word.slice(1));
        return {exportName: words.join(''), name: words.join(' '), globals: {material}};
      }),
    };
  });
}

export function readCatalog() {
  const catalog = read('source/lib/components/catalog.json');
  const written = require(path.join(source, 'lib/compiler/fields.cjs'));
  const definitions = require(path.join(source, 'lib/compiler/definitions.cjs'));
  const beats = read('source/lib/beats.json');
  const limits = read('source/lib/limits.json').limits ?? {};
  const guide = new Map([...fs.readFileSync(path.join(TEMPLATE, 'AGENTS.md'), 'utf8')
    .matchAll(/^- ([a-z0-9-]+) (.+)$/gm)].map(match => [match[1], `${match[1]} ${match[2]}`]));
  const samples = new Map();
  const fill = value => JSON.parse(JSON.stringify(value)
    .replaceAll('{name}', 'Nook').replaceAll('{NAME}', 'NOOK')
    .replaceAll('{url}', 'nook.app').replaceAll('{tagline}', 'Ideas in motion'));
  for (const film of read('tools/kinetic/templates.json')) {
    for (const scene of film.scenes) if (!samples.has(scene.type)) {
      // Template examples can refer to the original product's uploaded images.
      // Use the same asset-free sample selection as native catalogue acceptance.
      const {image, images, ...sample} = scene;
      samples.set(scene.type, fill(sample));
    }
  }
  for (const scene of read('tools/kinetic/samples.json')) {
    if (!samples.has(scene.type)) samples.set(scene.type, fill(scene));
  }
  for (const [type, definition] of Object.entries(definitions)) {
    if (definition.sample) samples.set(type, fill(definition.sample));
  }
  const {looks: availableLooks, metalVariants: availableMetalVariants, materialComponents} = readCatalogOptions(catalog);
  return Object.entries(catalog).map(([type, metadata]) => {
    const sample = samples.get(type);
    const definition = definitions[type];
    const familyFile = metadata.family === 'builtin' ? 'builtin.mjs' : `scenes/${metadata.family}.mjs`;
    if (!sample) throw new Error(`Catalogue component ${type} has no canonical sample`);
    if (!written[type] && !definition?.fields) throw new Error(`Catalogue component ${type} has no field schema`);
    const fields = clone(definition?.fields ?? written[type]);
    // Include the measured non-Latin limits shown by the production validator.
    for (const [fieldPath, maximum] of Object.entries(limits[type] ?? {})) {
      let spec = fields;
      for (const step of fieldPath.match(/[^.[\]]+|\[\]/g) ?? []) {
        spec = !spec ? null : step === '[]' ? spec.of : (spec.fields ?? spec)[step];
      }
      if (spec?.kind === 'string' && typeof maximum === 'number' && maximum < (spec.max ?? Infinity)) {
        spec.wide = Math.max(spec.min ?? 1, maximum);
      }
    }
    return {
      type,
      family: metadata.family,
      ...(definition?.section ? {section: definition.section} : {}),
      renderMode: metadata.renderMode,
      owned: Boolean(metadata.owned),
      description: definition?.guide ?? guide.get(type) ?? type,
      sample: clone(sample),
      fields,
      variants: previewVariantsFor(type, fields, definition?.previewVariants),
      examples: [...(fields.timing ? clone(timingExamples[type] ?? []) : []), ...clone(MEDIA_EXAMPLES[type] ?? [])],
      beatRange: clone(beats[type] ?? [1, 30]),
      availableLooks: [...availableLooks],
      availableMetalVariants: [...availableMetalVariants],
      source: `kit/source/lib/components/${materialComponents.includes(type) ? 'glass/components.mjs' : familyFile}`,
      ...(definition?.from ? {provenance: clone(definition.from)} : {}),
    };
  });
}
