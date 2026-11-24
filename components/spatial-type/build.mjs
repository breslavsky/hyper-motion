import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {normalize} from './lib/model.mjs';
import recipe from './recipe.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export function buildProject(destination, input = recipe) {
  const config = normalize(input), dest = path.resolve(destination);
  if (dest === HERE || dest.startsWith(HERE + path.sep)) throw new Error('Build outside the component source directory');
  if (fs.existsSync(dest) && fs.readdirSync(dest).length) throw new Error('Destination must be empty; never overwrite an authored project');
  const kit = path.join(dest, 'compositions/components/spatial-type');
  fs.mkdirSync(kit, {recursive: true});
  fs.cpSync(HERE, kit, {recursive: true, filter: source => !source.endsWith('.test.mjs') && !source.endsWith(`${path.sep}probe.mjs`) && !source.includes(`${path.sep}__pycache__`)});
  fs.writeFileSync(path.join(kit, 'recipe.mjs'), '// Editable project recipe. Engine modules are shared by this scene only.\nexport default ' + JSON.stringify(config, null, 2) + ';\n');
  const definition = path.join(kit, 'spatial-type.html');
  fs.writeFileSync(definition, fs.readFileSync(definition, 'utf8').replace('data-composition-duration="6"', `data-composition-duration="${config.duration}"`));
  fs.writeFileSync(path.join(dest, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${config.width}px;height:${config.height}px;overflow:hidden;background:${config.look.background}}#main{position:relative;width:${config.width}px;height:${config.height}px}
</style></head><body><script src="compositions/components/spatial-type/vendor/gsap-3.14.2.min.js"></script>
<div id="main" data-composition-id="main" data-width="${config.width}" data-height="${config.height}" data-duration="${config.duration}">
<div id="spatial-scene" class="clip" data-composition-id="spatial-scene" data-composition-src="compositions/components/spatial-type/spatial-type.html" data-start="0" data-duration="${config.duration}" data-track-index="1" data-track-kind="graphics" data-width="${config.width}" data-height="${config.height}" style="position:absolute;inset:0"></div></div>
<script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true}).to({},{duration:${config.duration}});</script></body></html>`);
  fs.writeFileSync(path.join(dest, 'hyperframes.json'), JSON.stringify({$schema: 'https://hyperframes.heygen.com/schema/hyperframes.json', paths: {blocks: 'compositions', components: 'compositions/components', assets: 'assets'}}, null, 2) + '\n');
  const result = {project: dest, width: config.width, height: config.height, duration: config.duration, words: config.words.map(w => w.text), recipe: path.join(kit, 'recipe.mjs')};
  fs.writeFileSync(path.join(dest, 'component-project.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), destination = args[args.indexOf('--out') + 1];
  if (!args.includes('--out') || !destination) throw new Error('Usage: node build.mjs --out /empty/directory [--config recipe.mjs|recipe.json]');
  let config = recipe;
  if (args.includes('--config')) {
    const filename = path.resolve(args[args.indexOf('--config') + 1]);
    config = filename.endsWith('.json') ? JSON.parse(fs.readFileSync(filename, 'utf8')) : (await import(pathToFileURL(filename))).default;
  }
  console.log(JSON.stringify(buildProject(destination, config)));
}
