#!/usr/bin/env node
// One scene of the kit as a native HyperFrames composition, for a film that is
// not Pure Kinetic's: a search field of liquid glass in a Simple Motion film,
// say. The kit travels as this folder; nothing else of the template is needed.
// Other templates get it from the shared catalogue (kinetic-scenes).
//
//   node <kit>/scene.cjs recipe.json     (or "-" to read the recipe from stdin)
//
// run in the project's source folder, where its index.html is. The recipe is
// a film of one scene, written as Pure Kinetic's guide writes scenes:
//
//   {"id": "glass-search", "aspect": "9:16", "style": "editorial", "material": "glass",
//    "brand": {"name": "Nook"}, "start": 4.5, "track": 3,
//    "scene": {"type": "glass-search", "beats": 6, "query": "Tuesday classes"}}
//
// `id` names the composition (letters, digits, hyphens), `start` is where it
// begins in the film in seconds, `track` its HyperFrames track; everything
// else but `scene` is a field of film.json (style, material, brand, bpm,
// pace, palette). It writes compositions/pk-<id>.html and the scene's emoji
// into assets/emoji.json, and prints what to put on the page: the two style
// sheets for <head>, the host element, how long the scene is, and its sound
// cues with their times in the film, for the film's own soundtrack. Nothing
// is printed for a recipe the kit refuses: its errors go to stderr.
//
//   node <kit>/scene.cjs --list           the scenes the kit can build
//   node <kit>/scene.cjs --list search    one scene: its fields and a recipe that works
const fs = require('node:fs');
const path = require('node:path');
const {compile} = require('./compiler/plan.cjs');
const {problems, emojiOf} = require('./film.cjs');
const {nativeClips, sceneVariables, sceneDefinition, sceneHost} = require('./build.cjs');

function buildScene(recipe, out = process.cwd()) {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) throw new Error('the recipe must be a JSON object');
  const {id, scene, start = 0, track = 1, ...film} = recipe;
  const errors = [];
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(id)) errors.push('"id" must be lowercase letters, digits and hyphens, starting with a letter');
  if (!scene || typeof scene !== 'object' || Array.isArray(scene)) errors.push('"scene" must be one scene, as in film.json "scenes"');
  if (!(Number.isFinite(start) && start >= 0)) errors.push('"start" must be a time in seconds, 0 or later');
  if (!(Number.isInteger(track) && track >= 0)) errors.push('"track" must be a whole number, 0 or more');
  if ('scenes' in film) errors.push('give one "scene"; a film of several scenes is Pure Kinetic\'s own film.json');
  if (errors.length) return {errors};
  film.scenes = [scene];
  const refused = problems(film);
  if (refused.length) return {errors: refused};

  const plan = compile(film), ps = plan.scenes[0], clip = nativeClips(plan)[0];
  // The kit's runtime as the page sees it: this folder, from the project's source.
  const kit = path.relative(out, __dirname).split(path.sep).join('/') || '.';
  if (kit.startsWith('..')) return {errors: [`the kit (${__dirname}) must be inside the folder the page is in (${out})`]};
  const definitionId = `pk-${id}`, file = `${definitionId}.html`;
  const config = {id, plan, ps, clipStart: clip.start, clipDuration: clip.duration, options: {}};
  const variables = sceneVariables(plan, ps);
  fs.mkdirSync(path.join(out, 'compositions'), {recursive: true});
  fs.writeFileSync(path.join(out, 'compositions', file),
    sceneDefinition({definitionId, duration: clip.duration, variables, config, runtime: `./${kit}/components/runtime.mjs`}));

  // The page draws emoji with the kit's own set, kept for the whole film in
  // one file: this scene's are added to what other scenes already put there.
  const drawn = path.join(out, 'assets', 'emoji.json'), mine = emojiOf(film);
  let kept = {};
  if (fs.existsSync(drawn)) {
    const before = JSON.parse(fs.readFileSync(drawn, 'utf8'));
    if (before && typeof before.emoji === 'object') kept = before.emoji;
  }
  const emoji = {size: mine.size, emoji: Object.fromEntries(Object.entries({...kept, ...mine.emoji}).sort())};
  fs.mkdirSync(path.dirname(drawn), {recursive: true});
  fs.writeFileSync(drawn, `${JSON.stringify(emoji)}\n`);

  const time = value => Number(value.toFixed(3));
  return {
    file: `compositions/${file}`,
    duration: clip.duration,
    head: [`<link rel="stylesheet" href="${kit}/components/presentation.css">`, `<link rel="stylesheet" href="${kit}/fonts.css">`],
    mount: sceneHost({id, file, variables, config, start, duration: clip.duration, track, width: plan.width, height: plan.height}),
    sounds: (plan.audioEvents ?? []).map(({t, kind, strength}) => ({at: time(start + t), kind, ...(strength === undefined ? {} : {strength})})),
  };
}

// What the kit can build. A scene written for this kit says its fields in a
// line of the guide and has a sample; the others are named with their family.
function listScenes(type) {
  const own = require('./components/metadata.cjs'), catalog = require('./components/catalog.json');
  if (type === undefined) {
    const families = {};
    for (const [name, row] of Object.entries(catalog)) (families[row.family] ??= []).push(name);
    return {families, described: Object.keys(own).filter(name => own[name].guide && own[name].sample)};
  }
  if (!Object.hasOwn(catalog, type)) return {errors: [`there is no scene "${type}": --list names them`]};
  const definition = Object.hasOwn(own, type) ? own[type] : null;
  return {type, ...catalog[type], guide: definition?.guide ?? null,
    recipe: definition?.sample ? {id: type, aspect: '9:16', style: 'editorial', brand: {name: 'Brand'}, start: 0, track: 1, scene: definition.sample} : null};
}

module.exports = {buildScene, listScenes};

if (require.main === module) {
  const file = process.argv[2];
  if (file === '--list') {
    const listed = listScenes(process.argv[3]);
    if (listed.errors) { process.stderr.write(listed.errors.map(line => `${line}\n`).join('')); process.exit(1); }
    process.stdout.write(`${JSON.stringify(listed, null, 2)}\n`);
    process.exit(0);
  }
  if (!file) { process.stderr.write('usage: node scene.cjs <recipe.json | -> | --list [scene]\n'); process.exit(2); }
  let recipe;
  try { recipe = JSON.parse(fs.readFileSync(file === '-' ? 0 : file, 'utf8')); }
  catch (error) { process.stderr.write(`${file}: ${error.message}\n`); process.exit(2); }
  let result;
  try { result = buildScene(recipe); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exit(1); }
  if (result.errors) { process.stderr.write(result.errors.map(line => `${line}\n`).join('')); process.exit(1); }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
