import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {readCatalog, readCatalogOptions, readThemePreviews, previewVariantsFor, TEMPLATE} from '../src/catalog-data.mjs';
import {argTypesFor, defaultArgs, validateArgs, makeFilm, FORMATS, BRANDBOOKS, MATERIALS, MATERIAL_COMPONENTS, DEFAULT_BRANDBOOK, FONTS, DEFAULT_FONT} from '../src/model.mjs';
import {readBrandbooks} from '../src/brandbook-data.mjs';

const require = createRequire(import.meta.url);
const canonical = require(path.join(TEMPLATE, 'source/lib/components/catalog.json'));
const {problems} = require(path.join(TEMPLATE, 'source/lib/film.cjs'));
const {compile} = require(path.join(TEMPLATE, 'source/lib/compiler/plan.cjs'));
const entries = readCatalog();
const entry = type => entries.find(item => item.type === type);
const tooling = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultBook = Object.keys(BRANDBOOKS)[0];

test('bundled stories, samples and toolbars use English copy', {skip: !!(process.env.PURE_KINETIC_TEMPLATE || process.env.PURE_KINETIC_BRANDBOOKS)}, async () => {
  const assertBundledCopy = (value, surface) => {
    assert.doesNotMatch(JSON.stringify(value), /\p{Script=Cyrillic}/u, `Unexpected Cyrillic in ${surface}`);
  };
  for (const item of entries) {
    assertBundledCopy([item.description, defaultArgs(item), argTypesFor(item), item.variants, item.examples], item.type);
  }
  for (const filename of fs.readdirSync(path.join(tooling, 'generated')).filter(name => name.endsWith('.stories.mjs'))) {
    assertBundledCopy(fs.readFileSync(path.join(tooling, 'generated', filename), 'utf8'), filename);
  }
  const config = await build({entryPoints: [path.join(tooling, '.storybook/preview.mjs')], bundle: true, write: false,
    format: 'esm', loader: {'.css': 'empty'},
    // The docs page is React and holds no copy: left out of this bundle.
    plugins: [{name: 'no-docs-page', setup(b) {
      b.onResolve({filter: /docs-page\.mjs$/}, () => ({path: 'docs-page', namespace: 'empty'}));
      b.onLoad({filter: /.*/, namespace: 'empty'}, () => ({contents: 'export default null'}));
    }}]});
  const preview = await import('data:text/javascript;base64,' + Buffer.from(config.outputFiles[0].contents).toString('base64'));
  assertBundledCopy(preview.default.globalTypes, 'toolbar titles, descriptions and items');
  assert.equal(preview.default.globalTypes.brandbook.toolbar.items.find(item => item.value === DEFAULT_BRANDBOOK).title, 'Default');
  const userQuery = 'Занятия во вторник';
  assert.equal(makeFilm(entry('glass-search'), {query: userQuery}).scenes[0].query, userQuery);
});

test('source override selects the catalogue, semantic validation and portable runtime together', () => {
  const selected = fs.readFileSync(path.join(TEMPLATE, 'source/lib/components/metadata.mjs'));
  assert.deepEqual(fs.readFileSync(path.join(tooling, 'generated/metadata.mjs')), selected);
  assert.deepEqual(fs.readFileSync(path.join(tooling, 'public/pk/lib/components/metadata.mjs')), selected);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tooling, 'generated/catalog.json'))), entries);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-storybook-template-'));
  const alias = path.join(temporary, 'selected-kit');
  try {
    fs.symlinkSync(TEMPLATE, alias, 'dir');
    const code = `import {TEMPLATE,readCatalog} from ${JSON.stringify(new URL('../src/catalog-data.mjs', import.meta.url).href)};console.log(JSON.stringify({template:TEMPLATE,types:readCatalog().map(entry=>entry.type)}));`;
    const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], {
      env: {...process.env, PURE_KINETIC_TEMPLATE: alias}, encoding: 'utf8',
    }));
    assert.equal(result.template, alias);
    assert.deepEqual(result.types, entries.map(item => item.type));
  } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
});

test('opted-in enum variants are generated from canonical values and remain valid recipes', () => {
  const definitions = require(path.join(TEMPLATE, 'source/lib/components/metadata.cjs'));
  for (const item of entries) {
    const selected = definitions[item.type]?.previewVariants ?? [];
    assert.equal(item.variants.length, selected.reduce((sum, field) => sum + item.fields[field].values.length, 0));
    const code = fs.readFileSync(path.join(tooling, 'generated', `${item.type}.stories.mjs`), 'utf8');
    assert.match(code, /export const Preview =/);
    assert.ok(code.includes('{viewMode: context.viewMode, storyId: context.id}'), 'Generated Docs stories must opt into visible-preview lifecycle');
    assert.equal(new Set(item.variants.map(variant => variant.exportName)).size, item.variants.length);
    for (const variant of item.variants) {
      assert.ok(code.includes(`export const ${variant.exportName} = {name: ${JSON.stringify(variant.name)}, args: ${JSON.stringify(variant.args)}};`));
      for (const aspect of FORMATS) assert.deepEqual(problems(makeFilm(item, variant.args, {aspect})), [], `${item.type}/${variant.name}/${aspect}`);
    }
  }
  const orb = entry('thinking-orb');
  if (orb) {
    assert.deepEqual(orb.variants.map(variant => variant.args.state), orb.fields.state.values);
    assert.deepEqual(argTypesFor(orb).state.options, orb.fields.state.values);
  }
});

test('invalid preview variant declarations fail preparation before stories are generated', () => {
  const fields = {state: {kind: 'enum', values: ['a', 'b']}, title: {kind: 'string'}};
  assert.deepEqual(previewVariantsFor('fixture', fields), []);
  for (const selected of ['state', ['state', 'state'], ['missing'], ['title'], [null]]) {
    assert.throws(() => previewVariantsFor('fixture', fields, selected), /fixture.previewVariants/);
  }
  for (const values of [[], ['a', 'a'], [''], [null], [Infinity], [{}]]) {
    assert.throws(() => previewVariantsFor('fixture', {state: {kind: 'enum', values}}, ['state']), /distinct nonempty primitive/);
  }
  assert.throws(() => previewVariantsFor('fixture', {state: {kind: 'enum', values: ['a-b', 'a b']}}, ['state']), /colliding story names/);
  const forward = previewVariantsFor('fixture', fields, ['state']);
  const reversed = previewVariantsFor('fixture', {state: {...fields.state, values: ['b', 'a']}}, ['state']);
  assert.deepEqual(forward.map(variant => variant.exportName), reversed.map(variant => variant.exportName).reverse());
});

test('Liquid Glass stories expose native camera and morph controls with reusable recipes', () => {
  const flow = entry('glass-flow');
  // A selected older template can still be catalogued without this port.
  if (!flow) return;
  const island = entry('glass-island'), lens = entry('glass-lens');
  assert.deepEqual(island.variants.map(variant => variant.args), [
    {camera: 'static'}, {camera: 'orbit'}, {exit: 'hold'}, {exit: 'collapse'},
  ]);
  assert.deepEqual(lens.variants.map(variant => variant.args), [{camera: 'static'}, {camera: 'orbit'}]);
  assert.deepEqual(argTypesFor(island).camera.options, ['static', 'orbit']);
  assert.deepEqual(argTypesFor(island).exit.options, ['hold', 'collapse']);
  assert.equal(defaultArgs(island).camera, 'orbit');
  assert.equal(defaultArgs(lens).camera, 'static');
  for (const item of [island, lens, flow]) assert.equal(item.renderMode, 'webgl');
  const film = makeFilm(flow, {title: 'First surface', nextTitle: 'Next surface'}, {material: 'glass', aspect: '9:16'});
  assert.deepEqual(problems(film), []);
  assert.equal(film.scenes.length, 1, 'The continuous fly-through belongs to one persistent native world');
  assert.equal(film.scenes[0].title, 'First surface');
  assert.equal(film.scenes[0].nextTitle, 'Next surface');
  assert.equal(compile(film).scenes[0].scene.type, 'glass-flow');
  assert.match(validateArgs(island, {camera: 'free'}).join('\n'), /camera.*choose/);
  assert.match(validateArgs(island, {exit: 'fly'}).join('\n'), /exit.*choose/);
  const ask = entry('glass-ask');
  if (ask?.renderMode === 'webgl') {
    assert.deepEqual(ask.variants.map(variant => variant.args), [{camera: 'static'}, {camera: 'orbit'}, {exit: 'drop'}, {exit: 'hold'}]);
    assert.equal(defaultArgs(ask).camera, 'orbit');
    const scene = makeFilm(ask, {text: 'When?', reply: 'Tuesday', camera: 'static'}, {material: 'metal'}).scenes[0];
    assert.deepEqual([scene.text, scene.reply, scene.camera], ['When?', 'Tuesday', 'static']);
  }
});

test('the long camera flight fits the requested four musical beats in a single 3D scene', () => {
  const item = entry('glass-send-prompt');
  if (!item) return;
  const {args} = item.examples.find(story => story.exportName === 'CameraFlight');
  const recipe = makeFilm(item, args, {aspect: '9:16'});
  assert.deepEqual(problems(recipe), []);
  const plan = compile(recipe);
  assert.equal(plan.scenes.length, 1);
  const {timing} = plan.scenes[0].scene;
  assert.equal((timing.landed - timing.pull) * plan.beat, 2.5);
  assert.equal(plan.audioEvents.find(event => event.kind === 'whoosh').t, 1.875);
  assert.equal(plan.audioEvents.find(event => event.kind === 'click').t, 4.53125);
});

test('the send wave example launches on the click cue and settles on its authored beat', () => {
  const item = entry('glass-send-prompt');
  if (!item) return;
  const {args} = item.examples.find(story => story.exportName === 'SendWave');
  const film = makeFilm(item, {...defaultArgs(item), ...args}, {aspect: '9:16'});
  assert.deepEqual(problems(film), []);
  const plan = compile(film);
  const {timing} = plan.scenes[0].scene;
  const click = plan.audioEvents.find(event => event.kind === 'click');
  assert.equal(click.t, 3);
  assert.equal(timing.send * plan.beat, click.t);
  assert.equal(timing.sent * plan.beat, 7.8);
  assert.ok(plan.scenes[0].dur > timing.sent * plan.beat);
});

test('every shipped component has one documented, serializable catalogue entry', () => {
  assert.ok(entries.length > 0);
  assert.deepEqual(entries.map(item => item.type).sort(), Object.keys(canonical).sort());
  assert.equal(new Set(entries.map(item => item.type)).size, entries.length);
  assert.deepEqual(JSON.parse(JSON.stringify(entries)), entries);
  for (const item of entries) {
    assert.equal(item.sample.type, item.type);
    assert.ok(item.description.length > item.type.length, item.type);
    assert.ok(Object.keys(item.fields).length, item.type);
    assert.ok(item.source.endsWith('.mjs'), item.type);
  }
});

test('optical controls expose reusable camera examples without changing the existing content recipe',()=>{
  const controls=entry('glass-controls');
  // Source overrides may select a kit from before the optical controls port.
  if(!controls?.fields.camera)return;
  assert.equal(controls.renderMode,'webgl');
  assert.deepEqual(controls.variants.map(variant=>variant.args),[{camera:'static'},{camera:'orbit'}]);
  assert.deepEqual(argTypesFor(controls).camera.options,['static','orbit']);
  assert.equal(defaultArgs(controls).camera,'orbit');
  const copy={title:'Autopilot',toggles:['Reminders','Waitlist','Payments'],slider:'Capacity'};
  for(const aspect of FORMATS)for(const camera of ['static','orbit']){
    const film=makeFilm(controls,{...copy,camera},{material:'glass',aspect});
    assert.deepEqual(problems(film),[]);
    const scene=compile(film).scenes[0].scene;
    for(const key of ['title','toggles','slider','camera'])assert.deepEqual(scene[key],{...copy,camera}[key]);
  }
  assert.match(validateArgs(controls,{camera:'free'}).join('\n'),/camera.*choose/);
});

test('every default recipe passes the production validator in all three formats', () => {
  for (const item of entries) for (const aspect of FORMATS) {
    const film = makeFilm(item, defaultArgs(item), {aspect});
    assert.deepEqual(problems(film), [], `${item.type} ${aspect}`);
    const plan = compile(film);
    assert.equal(plan.width / plan.height, Number(aspect.split(':')[0]) / Number(aspect.split(':')[1]));
    assert.equal(plan.scenes[0].scene.type, item.type);
  }
});

test('brandbooks supply the complete brand unchanged in every material and format', () => {
  assert.deepEqual(BRANDBOOKS, JSON.parse(fs.readFileSync(path.join(tooling, 'generated/brandbooks.json'))));
  assert.ok(defaultBook, 'The catalogue needs at least one complete brandbook');
  if (!process.env.PURE_KINETIC_TEMPLATE) assert.deepEqual([...MATERIALS].sort(), ['dark-glass', 'glass', 'metal']);
  assert.deepEqual(readCatalogOptions().materials, MATERIALS);
  for (const [brandbook, book] of Object.entries(BRANDBOOKS)) {
    assert.ok(book.label && book.brand.name && book.brand.font);
    for (const role of ['background', 'foreground', 'accent', 'accent2']) assert.ok(book.brand.tokens[role], `${brandbook}/${role}`);
    for (const material of MATERIALS) for (const aspect of FORMATS) {
      const film = makeFilm(entry('glass-island'), {}, {brandbook, material, aspect});
      assert.deepEqual(problems(film), []);
      assert.deepEqual(film.brand, book.brand);
      assert.equal(film.style, 'glass'); assert.equal(film.material, material);
    }
  }
  const defaults = makeFilm(entry('title'),{}, {brandbook:defaultBook});
  assert.deepEqual(defaults.brand, BRANDBOOKS[defaultBook].brand);
  assert.equal(defaults.material, undefined);
});

test('no brandbook restores native colours and typography without changing the selected material',()=>{
  assert.ok(!Object.hasOwn(BRANDBOOKS,DEFAULT_BRANDBOOK));
  const {looks}=require(path.join(TEMPLATE,'source/lib/compiler/plan.cjs'));
  for(const material of MATERIALS)for(const aspect of FORMATS){
    const native=makeFilm(entry('glass-island'),{}, {brandbook:DEFAULT_BRANDBOOK,material,aspect});
    assert.deepEqual(native.brand,{name:'Nook',url:'nook.app'});
    assert.deepEqual(problems(native),[]);
    const plan=compile(native);
    assert.equal(plan.look.material.type,material);
    assert.deepEqual(plan.look.display,looks.glass.display,'Native typography must reach the renderer');
    for(const [role,color] of Object.entries(looks.glass.palette))assert.equal(plan.palette[role],color);
    assert.equal(plan.scenes[0].brandBase,undefined,'No compiled brand colour override may survive clearing the book');
    const branded=makeFilm(entry('glass-island'),{}, {brandbook:defaultBook,material,aspect});
    assert.notDeepEqual(compile(branded).palette,plan.palette);
    for(const brandbook of [undefined,null,'',DEFAULT_BRANDBOOK]){
      assert.deepEqual(makeFilm(entry('glass-island'),{}, {brandbook,material,aspect}),native);
    }
    assert.deepEqual(branded.brand,BRANDBOOKS[defaultBook].brand,'Clearing a book must not mutate it');
  }
});

test('an external brandbook manifest replaces the bundled books and rejects incomplete brands', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-storybook-brands-'));
  const file = path.join(temporary, 'brandbooks.json');
  const books = {
    acme: {label: 'Acme', brand: {name: 'Acme', url: 'acme.example', font: 'Archivo',
      tokens: {background: '#101419', foreground: '#f3f5ef', accent: '#b9f24a', accent2: '#83d5ff'}}},
    studio: {label: 'Studio', brand: {name: 'Studio', font: 'Geist',
      tokens: {background: '#fff8f0', foreground: '#2a1c17', accent: '#e85d3f', accent2: '#f2bf55'}}},
  };
  const write = value => fs.writeFileSync(file, JSON.stringify(value));
  try {
    write(books); assert.deepEqual(readBrandbooks(file), books);
    const code = `import {readBrandbooks} from ${JSON.stringify(new URL('../src/brandbook-data.mjs', import.meta.url).href)};console.log(JSON.stringify(readBrandbooks()));`;
    const fromEnvironment = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], {
      env: {...process.env, PURE_KINETIC_BRANDBOOKS: file}, encoding: 'utf8',
    }));
    assert.deepEqual(fromEnvironment, books, 'The external manifest replaces rather than merges the bundled book map');
    for (const invalid of [{}, [], {...books, 'Bad ID': books.acme},
      {acme: {...books.acme, brand: {...books.acme.brand, font: undefined}}},
      {acme: {...books.acme, brand: {...books.acme.brand, tokens: {background: '#fff'}}}},
      {acme: {...books.acme, brand: {...books.acme.brand, font: 'Missing Font'}}},
      {acme: {...books.acme, brand: {...books.acme.brand, font: {family: 'Missing Asset', src: 'assets/__missing_storybook_font.woff2'}}}},
    ]) {
      write(invalid); assert.throws(() => readBrandbooks(file), /brandbook/i);
    }
  } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
});

test('bundled demo books cover the former themes with readable foregrounds',()=>{
  const books=readBrandbooks(path.join(tooling,'brandbooks.json'));
  const {looks,metalVariants}=require(path.join(TEMPLATE,'source/lib/compiler/plan.cjs'));
  for(const id of ['nook','lime','warm',...Object.keys(looks),
    ...metalVariants.filter(value=>value!=='silver').map(value=>`metal-${value}`)]){
    assert.ok(books[id],`Missing former palette: ${id}`);
  }
  const luminance=hex=>{
    const raw=hex.slice(1),six=raw.length===3?raw.replace(/./g,c=>c+c):raw;
    const rgb=[0,2,4].map(i=>parseInt(six.slice(i,i+2),16)/255)
      .map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
    return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
  };
  for(const [id,{brand}] of Object.entries(books)){
    const values=[brand.tokens.background,brand.tokens.foreground].map(luminance).sort((a,b)=>b-a);
    assert.ok((values[0]+0.05)/(values[1]+0.05)>=4.5,`${id}: text must remain readable`);
  }
});

test('material stories compare Glass, Dark Glass and Metal on each shared 3D component', () => {
  const options = readCatalogOptions(), themes = readThemePreviews(entries, options);
  const expected = Object.entries(canonical)
    .filter(([, item]) => item.family === 'glass' && item.renderMode === 'webgl').map(([type]) => type);
  assert.deepEqual(MATERIAL_COMPONENTS,expected);
  if (!process.env.PURE_KINETIC_TEMPLATE) assert.ok(expected.includes('glass-ask'));
  assert.deepEqual(themes.map(theme=>theme.type),MATERIAL_COMPONENTS);
  assert.equal(new Set(themes.map(theme => theme.type)).size, themes.length);
  for (const theme of themes) {
    const item = entry(theme.type);
    assert.equal(item.renderMode,'webgl');
    assert.ok(item.source.endsWith('/glass/components.mjs'));
    // A scene with a section of its own (a ride) stands there, not under Glass.
    assert.equal(theme.title,`${item.section ?? 'Glass'}/${item.type}`);
    const code = fs.readFileSync(path.join(tooling, 'generated', `${theme.type}.stories.mjs`), 'utf8');
    assert.ok(code.includes(`title: ${JSON.stringify(theme.title)}`));
    assert.deepEqual(theme.variants.map(variant => variant.globals), MATERIALS.map(material => ({material})));
    if (MATERIALS.includes('dark-glass')) assert.deepEqual(theme.variants.find(variant => variant.globals.material === 'dark-glass'),
      {exportName:'DarkGlass', name:'Dark Glass', globals:{material:'dark-glass'}});
    for (const variant of theme.variants) {
      assert.ok(code.includes(`export const ${variant.exportName} = {name: ${JSON.stringify(variant.name)}, parameters: ${JSON.stringify(variant.globals)}};`));
      for (const aspect of FORMATS) {
        const film = makeFilm(item, {}, {...variant.globals, aspect});
        assert.deepEqual(problems(film), [], `${theme.title}/${variant.name}/${aspect}`);
        assert.equal(film.style, 'glass');
        assert.equal(film.material, variant.globals.material);
        assert.equal(film.scenes[0].material, undefined, 'Material controls belong to the film');
        assert.equal(compile(film).look.material.type, variant.globals.material);
      }
    }
  }
  const generatedComparisons=fs.readdirSync(path.join(tooling,'generated')).filter(name=>name.startsWith('theme-material-')).sort();
  assert.deepEqual(generatedComparisons,[],'The materials are examples of each scene, not stories of their own');
  assert.throws(() => makeFilm(entry('title'), {}, {material: 'bronze'}), /Unknown material/i);
});

test('material globals leave typography, buttons and flat cards unchanged',()=>{
  const flat=entries.filter(item=>!MATERIAL_COMPONENTS.includes(item.type));
  for(const type of ['title','endcard'])assert.ok(flat.some(item=>item.type===type),type);
  for(const item of entries){
    const code=fs.readFileSync(path.join(tooling,'generated',`${item.type}.stories.mjs`),'utf8');
    assert.equal(code.includes("globals: {material: 'glass'}"),!MATERIAL_COMPONENTS.includes(item.type),
      `${item.type}: Storybook must disable the 3D material selector outside supported surfaces`);
  }
  for(const item of flat)for(const aspect of FORMATS)for(const brandbook of [DEFAULT_BRANDBOOK,defaultBook]){
    const baseline=makeFilm(item,{}, {aspect,brandbook});
    for(const material of MATERIALS){
      const stale=makeFilm(item,{}, {aspect,brandbook,material});
      assert.equal(Object.hasOwn(stale,'material'),false,`${item.type}: a stale toolbar setting must not enter the recipe`);
      assert.deepEqual(stale,baseline,`${item.type}: brand, text, controls and timing must remain unchanged`);
    }
  }
});

test('changing material preserves the brandbook, content and compiled motion in every format', () => {
  for (const type of MATERIAL_COMPONENTS) {
    const item = entry(type);
    for (const aspect of FORMATS) for (const brandbook of [DEFAULT_BRANDBOOK,...Object.keys(BRANDBOOKS)]) {
      const args = {...defaultArgs(item), ...(item.fields.camera ? {camera: 'orbit'} : {})};
      const glass = makeFilm(item, args, {material: 'glass', aspect, brandbook});
      const glassPlan = compile(glass);
      const {material: glassMaterial, ...glassMotion} = glassPlan.look;
      assert.equal(glassMaterial.type, 'glass');
      for (const material of MATERIALS.filter(value => value !== 'glass')) {
        const film = makeFilm(item, args, {material, aspect, brandbook});
        assert.deepEqual(problems(film), [], `${type}/${aspect}/${brandbook}/${material}`);
        assert.deepEqual(film.brand, glass.brand);
        assert.deepEqual(film.scenes, glass.scenes);
        const plan = compile(film), {material: finish, ...motion} = plan.look;
        assert.equal(finish.type, material);
        assert.deepEqual(motion, glassMotion, 'Material selection must preserve the motion style');
        assert.deepEqual(plan.scenes, glassPlan.scenes, 'Material selection must preserve scene colours, timing, transitions and camera controls');
        assert.deepEqual(plan.palette, glassPlan.palette, 'Material selection must preserve the brand palette');
      }
    }
  }
});

test('scene inputs and returned recipes are isolated; presentation controls never enter the scene', () => {
  const item = entry('drag');
  const original = structuredClone(item);
  const args = defaultArgs(item);
  args.files[0] = 'new.pdf';
  const film = makeFilm(item, {...args, unknown: 'ignored', brandName: 'Acme', brandAccent: '#456abc'}, {brandbook: defaultBook});
  assert.deepEqual(item, original);
  assert.equal(film.scenes[0].files[0], 'new.pdf');
  assert.deepEqual(film.brand, BRANDBOOKS[defaultBook].brand, 'Removed brand controls cannot override the selected book');
  assert.equal(film.scenes[0].unknown, undefined);
  assert.equal(film.scenes[0].brandAccent, undefined);
  film.scenes[0].files[0] = 'changed-again.pdf';
  film.brand.tokens.accent = '#000000';
  assert.equal(args.files[0], 'new.pdf');
  assert.deepEqual(makeFilm(item, {}, {brandbook: defaultBook}).brand, BRANDBOOKS[defaultBook].brand, 'Returned recipes must not mutate the shared brandbook');
});

test('stale toolbar globals and removed brand controls cannot override the selected brandbook or material', () => {
  const selected = {brandbook: defaultBook, material: 'glass', aspect: '1:1'};
  const stale = {font: 'Missing Font', look: 'metal', metalVariant: 'gold', brand: 'missing'};
  const oldArgs = {brandName: 'Wrong', brandBackground: '#000000', brandForeground: '#ffffff', brandAccent: '#ff0000', brandAccent2: '#00ff00'};
  assert.deepEqual(makeFilm(entry('title'), oldArgs, {...selected, ...stale}), makeFilm(entry('title'), {}, selected));
  for (const item of entries) {
    const controls = argTypesFor(item);
    const filmFields = item.family === 'glass' && item.fields.timing ? ['beats', 'bpm'] : ['beats'];
    assert.deepEqual(Object.keys(controls).sort(), [...new Set([...Object.keys(item.fields), ...filmFields])].sort());
    for (const name of Object.keys(oldArgs)) assert.equal(controls[name], undefined, `${item.type}/${name}`);
  }
});

test('the toolbar font names a bundled family over the brandbook, and leaves it alone by default', () => {
  const item = entry('title'), plain = makeFilm(item, {}, {brandbook: defaultBook});
  assert.deepEqual(makeFilm(item, {}, {brandbook: defaultBook, font: DEFAULT_FONT}), plain);
  for (const font of FONTS) {
    const film = makeFilm(item, {}, {brandbook: defaultBook, font});
    assert.equal(film.brand.font, font);
    assert.deepEqual({...film, brand: {...film.brand, font: plain.brand.font}}, {...plain, brand: {...plain.brand, font: plain.brand.font}});
  }
  assert.ok(FONTS.length > 1);
});

test('optional controls can be cleared without suppressing required fields', () => {
  const film = makeFilm(entry('title'), {sub: ''});
  assert.equal(Object.hasOwn(film.scenes[0], 'sub'), false);
  assert.deepEqual(problems(film), []);
  assert.match(validateArgs(entry('title'), {text: ''}).join('\n'), /text.*at least/);
  assert.throws(() => makeFilm(entry('title'), {text: null}), /text.*required/);
});

test('Search exposes an editable Placeholder and preserves a deliberately empty hint', () => {
  const search = entry('glass-search');
  const control = argTypesFor(search).placeholder;
  assert.equal(control.name, 'Placeholder');
  assert.equal(control.control.type, 'text');
  assert.equal(control.table.defaultValue.summary, 'Search...');
  assert.equal(defaultArgs(search).placeholder, 'Search...');
  for (const [args, expected] of [[{}, 'Search...'], [{placeholder: 'Find a class'}, 'Find a class'], [{placeholder: ''}, '']]) {
    const film = makeFilm(search, args);
    assert.deepEqual(problems(film), []);
    assert.equal(compile(film).scenes[0].scene.placeholder, expected);
  }
  assert.equal(Object.hasOwn(makeFilm(search, {placeholder: undefined}).scenes[0], 'placeholder'), false);
});

test('Glass preview authors a musical slot and synchronizes the send press at different tempos', () => {
  const item = entry('glass-ask');
  const timing = {open: 0.5, type: 1, typed: 2.5, send: 3, reply: 4};
  for (const bpm of [90, 120, 150]) {
    const film = makeFilm(item, {bpm, beats: 6, speed: 1.5, timing});
    assert.deepEqual(problems(film), []);
    assert.deepEqual(film.music, {bpm});
    assert.equal(film.scenes[0].bpm, undefined);
    const plan = compile(film);
    assert.ok(Math.abs(plan.scenes[0].dur - 6 * 60 / bpm) < 1e-9);
    const send = plan.audioEvents.find(event => event.kind === 'click' && event.strength === 0.9);
    assert.ok(Math.abs(send.t - 3 * 60 / bpm) < 1e-9);
  }
  for (const bad of [{speed: 0}, {bpm: 0}, {timing: {send: 99}}, {timing: {reply: 1, send: 2}}, {timing: {typo: 3}}]) {
    assert.ok(validateArgs(item, bad).length > 0, JSON.stringify(bad));
  }
  assert.deepEqual(problems(makeFilm(item, {beats: 16, timing: {send: 12}})), []);
  assert.ok(validateArgs(item, {beats: 16}).length > 0);
});

test('nested field, enum, numeric and colour constraints reject bad controls before mounting', () => {
  assert.match(validateArgs(entry('scan'), {items: [{label: 'x', category: 0}, {label: 'y'}, {label: 'z'}]}).join('\n'), /items\[0\].category/);
  assert.match(validateArgs(entry('title'), {text: 'x'.repeat(1000)}).join('\n'), /at most/);
  assert.match(validateArgs(entry('title'), {beats: Number.NaN}).join('\n'), /finite number/);
  assert.match(validateArgs(entry('title'), {beats: 32}).join('\n'), /maximum/);
  const variant = entries.find(item => Object.values(item.fields).some(spec => spec.kind === 'enum'));
  const field = Object.keys(variant.fields).find(name => variant.fields[name].kind === 'enum');
  assert.match(validateArgs(variant, {[field]: 'not-an-option'}).join('\n'), /choose/);
  for (const globals of [{aspect: '4:3'}, {brandbook: 'missing'}, {material: 'missing'}]) {
    assert.throws(() => makeFilm(entry('title'), {}, globals), /Unknown/);
  }
});

test('component-owned semantic rules match the production validator', () => {
  const scan = defaultArgs(entry('scan'));
  scan.items[0].category = scan.categories.length + 1;
  assert.match(validateArgs(entry('scan'), scan).join('\n'), /categories.length/);
  const accordion = defaultArgs(entry('accordion'));
  accordion.images = ['assets/a.png', 'assets/b.png', 'assets/c.png'];
  assert.match(validateArgs(entry('accordion'), accordion).join('\n'), /exactly one/);
  const proof = entry('testimonial-proof-card');
  assert.match(validateArgs(proof, {emphasis: 'Not found in the quote'}).join('\n'), /verbatim/);
  assert.deepEqual(validateArgs(entry('highlight'), {mark: 'sky'}), []);
});

test('controls reflect canonical field kinds, ranges and measured text limits', () => {
  for (const item of entries) {
    const controls = argTypesFor(item);
    for (const [name, spec] of Object.entries(item.fields)) {
      assert.ok(controls[name], `${item.type}.${name}`);
      if (spec.kind === 'enum') assert.deepEqual(controls[name].options, spec.values);
      if (spec.kind === 'number' && spec.max !== undefined) assert.equal(controls[name].control.max, spec.max);
      if (spec.wide !== undefined) assert.ok(controls[name].description.includes(String(spec.wide)));
    }
  }
});
