import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {readCatalog, readCatalogOptions, readThemePreviews, storyTitle, TEMPLATE} from '../src/catalog-data.mjs';
import {prepareSequences} from './sequences.mjs';
import {prepareFolio} from './folio.mjs';
import {readBrandbooks} from '../src/brandbook-data.mjs';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(TEMPLATE, 'source');
const generated = path.join(here, 'generated'), output = path.join(here, 'public/pk');
const require = createRequire(import.meta.url);
const hf = path.dirname(require.resolve('hyperframes/package.json'));
const version = JSON.parse(fs.readFileSync(path.join(hf, 'package.json'))).version;
if (version !== '0.9.19') throw new Error(`Expected pinned HyperFrames 0.9.19, got ${version}`);
const catalog = readCatalog(), settings = readCatalogOptions();
const brandbooks = readBrandbooks();
const themes = readThemePreviews(catalog, settings);
// These are disposable build outputs only. The source kit is never edited.
fs.rmSync(generated, {recursive: true, force: true});
fs.mkdirSync(generated, {recursive: true}); fs.mkdirSync(output, {recursive: true});
// The Controls validator and preview runtime must use the same selected kit.
fs.copyFileSync(path.join(source, 'lib/components/metadata.mjs'), path.join(generated, 'metadata.mjs'));
// The library's own icon: the browser tab's and the sidebar's.
for (const name of ['favicon.svg', 'icon.svg']) fs.copyFileSync(path.join(here, 'src/icon.svg'), path.join(here, 'public', name));
fs.rmSync(path.join(output, 'lib'), {recursive: true, force: true});
fs.cpSync(path.join(source, 'lib'), path.join(output, 'lib'), {recursive: true});
// Controls accept new emoji too; serve the kit's own complete Fluent set.
fs.mkdirSync(path.join(output, 'assets'), {recursive: true});
fs.writeFileSync(path.join(output, 'assets/emoji.json'), gunzipSync(fs.readFileSync(path.join(source, 'lib/emoji.json.gz'))));
// The Glass background picker's samples are not copied here: the preview
// loads them from our public CDN (preview.mjs), so the build needs nothing
// outside this folder and the kit.
for (const name of ['glass-bahamas.webp', 'glass-street.mp4']) fs.rmSync(path.join(output, 'assets', name), {force: true});
for(const book of Object.values(brandbooks)){
  const assets=[typeof book.brand.font==='object'?book.brand.font.src:null,book.brand.logo].filter(Boolean);
  for(const asset of assets){
    const target=path.join(output,asset);
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(source,asset),target);
  }
}
for (const name of ['hyperframes-player.global.js', 'hyperframe.runtime.iife.js']) fs.copyFileSync(path.join(hf, 'dist', name), path.join(output, name));
for (const name of ['preview.html', 'preview.mjs']) fs.copyFileSync(path.join(here, 'src', name), path.join(output, name));
// The camera's pages: a plain composition per example, its world and its recipe written into it.
{
  const {cameraExamples} = await import('../src/camera-examples.mjs');
  const page = fs.readFileSync(path.join(here, 'src/camera-page.html'), 'utf8');
  for (const example of cameraExamples) {
    const recipe = {width: example.width, height: example.height, ...example.recipe};
    fs.writeFileSync(path.join(output, `camera-${example.id}.html`), page.replaceAll('__W__', String(example.width)).replaceAll('__H__', String(example.height))
      .replace('__DURATION__', String(recipe.duration)).replace('__STYLE__', () => example.style).replace('__WORLD__', () => example.world).replace('__RECIPE__', () => JSON.stringify(recipe)));
  }
}
// The finish's pages: the component itself beside them (it is no part of the kit), and a composition per example.
{
  const {finishExamples} = await import('../src/finish-examples.mjs');
  const page = fs.readFileSync(path.join(here, 'src/finish-page.html'), 'utf8');
  fs.mkdirSync(path.join(output, 'finish'), {recursive: true});
  fs.copyFileSync(path.resolve(here, '../components/finish/finish.mjs'), path.join(output, 'finish/finish.mjs'));
  for (const example of finishExamples) {
    fs.writeFileSync(path.join(output, `finish-${example.id}.html`), page.replaceAll('__W__', String(example.width)).replaceAll('__H__', String(example.height))
      .replaceAll('__DURATION__', String(example.duration)).replace('__STYLE__', () => example.style).replace('__WORLD__', () => example.world)
      .replace('__RECIPE__', () => JSON.stringify(example.recipe)).replace('__BEATS__', JSON.stringify(example.beats)).replace('__LAST__', String(example.last)));
  }
}
await build({entryPoints: [path.join(source, 'lib/compiler/plan.cjs')], outfile: path.join(output, 'compiler.mjs'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022'});
fs.writeFileSync(path.join(generated, 'catalog.json'), JSON.stringify(catalog, null, 2)+'\n');
fs.writeFileSync(path.join(generated, 'settings.json'), JSON.stringify(settings, null, 2)+'\n');
fs.writeFileSync(path.join(generated, 'settings.mjs'), 'export default '+JSON.stringify(settings)+';\n');
fs.writeFileSync(path.join(generated, 'brandbooks.json'), JSON.stringify(brandbooks, null, 2)+'\n');
fs.writeFileSync(path.join(generated, 'brandbooks.mjs'), 'export default '+JSON.stringify(brandbooks)+';\n');
fs.writeFileSync(path.join(generated, 'themes.json'), JSON.stringify(themes, null, 2)+'\n');
const sequences = [...prepareSequences(output), await prepareFolio(output)];
fs.writeFileSync(path.join(generated, 'sequences.json'), JSON.stringify(sequences, null, 2)+'\n');
// A specimen copied by an earlier build is not served any more.
for (const file of ['dark-button-glass.html', 'dark-button-glass.mjs']) fs.rmSync(path.join(output, file), {force: true});
for (const entry of catalog) {
  const code = `// Generated from the maintained Pure Kinetic catalogue. Do not edit.\nimport catalog from './catalog.json';\nimport {renderComponent} from '../src/render.mjs';\nimport {defaultArgs, argTypesFor} from '../src/model.mjs';\nconst entry = catalog.find(item => item.type === ${JSON.stringify(entry.type)});\nexport default {title: ${JSON.stringify(storyTitle(entry))}, tags: ['autodocs'], ${settings.materialComponents.includes(entry.type)?'':"globals: {material: 'glass'}, "}args: defaultArgs(entry), argTypes: argTypesFor(entry), parameters: {docs: {description: {component: entry.description}}}, render: (args, context) => renderComponent(entry, args, {...context.globals, exampleMaterial: context.parameters.material}, {viewMode: context.viewMode, storyId: context.id})};\nexport const Preview = {name: 'Component'};\n`;
  // CSF's static indexer reads identifier property keys for the display name.
  const stories = [...entry.variants, ...entry.examples].map(variant => `export const ${variant.exportName} = {name: ${JSON.stringify(variant.name)}, args: ${JSON.stringify(variant.args)}};\n`).join('');
  // An example names its material as a parameter, not as a pinned global:
  // Storybook lets no toolbar override a story's own globals.
  const materials = (themes.find(theme => theme.type === entry.type)?.variants ?? []).map(variant => `export const ${variant.exportName} = {name: ${JSON.stringify(variant.name)}, parameters: ${JSON.stringify(variant.globals)}};\n`).join('');
  fs.writeFileSync(path.join(generated, `${entry.type}.stories.mjs`), code + stories + materials);
}
// B-Rolls: Glass scenes laid over footage that plays on a track of its own
// (`over`), at the bottom of the frame. The preview lays a
// sample video under them (src/preview.mjs).
const BROLLS = [
  // Over somebody who talks to the camera the face is the picture: every panel is small and stands at the bottom, in the middle.
  ...['glass-like', 'glass-follow', 'glass-rating', 'glass-message', 'glass-call', 'glass-island', 'glass-checklist', 'glass-search', 'glass-ask']
    .map(type => [type, {place: 'bottom', size: 'small'}]),
];
for (const [type, stands] of BROLLS) {
  if (!catalog.some(entry => entry.type === type)) continue;
  const code = `// Generated: a Glass scene over footage. Do not edit.\nimport catalog from './catalog.json';\nimport {renderComponent} from '../src/render.mjs';\nimport {defaultArgs, argTypesFor} from '../src/model.mjs';\nconst entry = catalog.find(item => item.type === ${JSON.stringify(type)});\nexport default {title: ${JSON.stringify('B-Rolls/' + type)}, args: {...defaultArgs(entry), over: true, background: {clip: 'footage'}, ...${JSON.stringify(stands)}}, argTypes: argTypesFor(entry), parameters: {material: 'dark-glass', docs: {description: {component: 'Over footage that plays on a track of its own: the scene draws only its glass and bends the footage under it, which it is given as the clip it lies over.'}}}, render: (args, context) => renderComponent(entry, args, {...context.globals, exampleMaterial: context.parameters.material}, {viewMode: context.viewMode, storyId: context.id})};\nexport const Preview = {name: 'Over footage'};\n`;
  fs.writeFileSync(path.join(generated, `b-roll-${type}.stories.mjs`), code);
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function hashes(directory, prefix = '') {
  return Object.fromEntries(fs.readdirSync(directory).sort().flatMap(name => {
    const file = path.join(directory, name), relative = `${prefix}${name}`;
    if (fs.statSync(file).isDirectory()) return Object.entries(hashes(file, `${relative}/`));
    return name === 'catalog-build.json' ? [] : [[relative, sha(fs.readFileSync(file))]];
  }));
}
const evidence = {nativeAssets: hashes(output), storybookSource: hashes(path.join(here, 'src')), stories: hashes(path.join(here, 'stories')), examples: hashes(path.join(here, 'examples')), config: hashes(path.join(here, '.storybook')), catalogue: sha(JSON.stringify(catalog)), themes: sha(JSON.stringify(themes)), settings: sha(JSON.stringify(settings)), brandbooks:sha(JSON.stringify(brandbooks))};
fs.writeFileSync(path.join(output, 'catalog-build.json'), JSON.stringify({schema: 'pure-kinetic.storybook.v1', runtime: version, components: catalog.length, sequences: sequences.map(item => item.id), digest: sha(JSON.stringify(evidence)), evidence}, null, 2)+'\n');
console.log(`Prepared ${catalog.length} live components and ${sequences.length} sequences with HyperFrames ${version}.`);
