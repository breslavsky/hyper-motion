import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {readCatalog, readCatalogOptions, readThemePreviews, TEMPLATE} from '../src/catalog-data.mjs';
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
fs.copyFileSync(path.join(here, 'node_modules/storybook/assets/browser/favicon.svg'), path.join(here, 'public/favicon.svg'));
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
await build({entryPoints: [path.join(source, 'lib/compiler/plan.cjs')], outfile: path.join(output, 'compiler.mjs'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022'});
fs.writeFileSync(path.join(generated, 'catalog.json'), JSON.stringify(catalog, null, 2)+'\n');
fs.writeFileSync(path.join(generated, 'settings.json'), JSON.stringify(settings, null, 2)+'\n');
fs.writeFileSync(path.join(generated, 'settings.mjs'), 'export default '+JSON.stringify(settings)+';\n');
fs.writeFileSync(path.join(generated, 'brandbooks.json'), JSON.stringify(brandbooks, null, 2)+'\n');
fs.writeFileSync(path.join(generated, 'brandbooks.mjs'), 'export default '+JSON.stringify(brandbooks)+';\n');
fs.writeFileSync(path.join(generated, 'themes.json'), JSON.stringify(themes, null, 2)+'\n');
const sequences = [...prepareSequences(output), await prepareFolio(output)];
fs.writeFileSync(path.join(generated, 'sequences.json'), JSON.stringify(sequences, null, 2)+'\n');
if (settings.materials.includes('dark-glass')) {
  fs.copyFileSync(path.join(here, 'src/dark-button-glass.stories.mjs'), path.join(generated, 'dark-button-glass.stories.mjs'));
  for (const file of ['dark-button-glass.html', 'dark-button-glass.mjs']) {
    fs.copyFileSync(path.join(here, 'src', file), path.join(output, file));
  }
}
// The sidebar's folders are the catalogue's families, but the scenes drawn in
// depth stand together: Three.js scenes and the wall under a lens.
const GROUPS = {three: '3d', 'lens-wall': '3d'};
for (const entry of catalog) {
  const code = `// Generated from the maintained Pure Kinetic catalogue. Do not edit.\nimport catalog from './catalog.json';\nimport {renderComponent} from '../src/render.mjs';\nimport {defaultArgs, argTypesFor} from '../src/model.mjs';\nconst entry = catalog.find(item => item.type === ${JSON.stringify(entry.type)});\nexport default {title: ${JSON.stringify(`Pure Kinetic/${GROUPS[entry.family]??entry.family}/${entry.type}`)}, tags: ['autodocs'], ${settings.materialComponents.includes(entry.type)?'':"globals: {material: 'glass'}, "}args: defaultArgs(entry), argTypes: argTypesFor(entry), parameters: {docs: {description: {component: entry.description}}}, render: (args, context) => renderComponent(entry, args, context.globals, {viewMode: context.viewMode, storyId: context.id})};\nexport const Preview = {name: 'Component'};\n`;
  // CSF's static indexer reads identifier property keys for the display name.
  const stories = [...entry.variants, ...entry.examples].map(variant => `export const ${variant.exportName} = {name: ${JSON.stringify(variant.name)}, args: ${JSON.stringify(variant.args)}};\n`).join('');
  fs.writeFileSync(path.join(generated, `${entry.type}.stories.mjs`), code + stories);
}
for (const theme of themes) {
  const code = `// Generated from the maintained look and component catalogue. Do not edit.\nimport catalog from './catalog.json';\nimport {renderComponent} from '../src/render.mjs';\nimport {defaultArgs, argTypesFor} from '../src/model.mjs';\nconst entry = catalog.find(item => item.type === ${JSON.stringify(theme.type)});\nexport default {title: ${JSON.stringify(theme.title)}, tags: ['autodocs'], args: defaultArgs(entry), argTypes: argTypesFor(entry), parameters: {docs: {description: {component: 'Glass, Dark Glass and Metal on the same production 3D '+entry.type+' component. Material applies only to the 3D surface; typography and HTML controls keep their brand styling. Default uses the component’s colors and font. Select a brandbook to use its colors and font. Each named example starts on its own material; the 3D material toolbar switches all of them. Content, brandbook and format remain editable.'}}}, render: (args, context) => renderComponent(entry, args, {...context.globals, exampleMaterial: context.parameters.material}, {viewMode: context.viewMode, storyId: context.id})};\n`;
  // An example names its material as a parameter, not as a pinned global:
  // Storybook lets no toolbar override a story's own globals.
  const variants = theme.variants.map(variant => `export const ${variant.exportName} = {name: ${JSON.stringify(variant.name)}, parameters: ${JSON.stringify(variant.globals)}};\n`).join('');
  fs.writeFileSync(path.join(generated, `theme-material-${theme.type}.stories.mjs`), code + variants);
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
