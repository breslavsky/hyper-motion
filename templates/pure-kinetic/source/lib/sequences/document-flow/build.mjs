import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {compile} from './model.mjs';
import {buildAudio} from './audio.mjs';
import {audioContract} from './audio-contract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(HERE, '../..');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const js = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const pretty = value => JSON.stringify(value, null, 2) + '\n';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = (from, to) => {fs.mkdirSync(path.dirname(to), {recursive: true}); fs.copyFileSync(from, to);};
const MODULES = ['model.mjs', 'view.mjs', 'runtime.mjs', 'audio-contract.mjs', 'sound-contract.mjs', 'SOURCE.json'];

function fontCSS() {
  const latin = [
    ['Geist', 'Geist-Variable.woff2', '100 900', ''],
    ['Geist Mono', 'GeistMono-Variable.woff2', '100 900', ''],
    ['Archivo', 'Archivo-Variable.woff2', '100 900', 'font-stretch:62% 125%;'],
  ].map(([family, file, weight, stretch]) => `@font-face{font-family:"${family}";src:url("assets/fonts/${file}") format("woff2");font-weight:${weight};font-style:normal;font-display:block;${stretch}}`).join('\n');
  // Inline both parts so the native compiler sees the real local faces. Matching
  // weight/stretch descriptors preserve the composite Latin/script families.
  return latin + '\n' + fs.readFileSync(path.join(LIB, 'fonts.css'), 'utf8').replaceAll('url("fonts/', 'url("assets/fonts/');
}

function audioTag(clip, index, music = false, instanceId = 'document-flow') {
  return `<audio id="${escape(instanceId)}-${escape(clip.id)}" data-sequence-instance="${escape(instanceId)}" class="clip" src="${escape(clip.src)}" data-start="${clip.start}" data-duration="${clip.duration}" data-volume="${clip.gain}" data-playback-rate="${clip.playbackRate}" data-track-index="${index}"${music ? ` data-sequence-music="pulse" data-fade-in="${clip.fadeIn}" data-fade-out="${clip.fadeOut}"` : ` data-sequence-event="${escape(clip.eventId)}" data-sequence-kind="${escape(clip.kind)}" data-sequence-target="${escape(clip.target)}"`}></audio>`;
}

export async function buildProject(destination, spec = {}, {documentsDirectory, instanceId = 'document-flow'} = {}) {
  if (typeof instanceId !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(instanceId) || instanceId === 'main') throw new Error('instanceId: use a unique lowercase composition id other than main');
  const plan = compile(spec), {width, height, duration} = plan;
  const recipe = plan.recipe;
  if (!recipe) throw new Error('sequence compiler did not return a normalized recipe');
  const dest = path.resolve(destination);
  if (fs.existsSync(dest) && (!fs.statSync(dest).isDirectory() || fs.lstatSync(dest).isSymbolicLink() || fs.readdirSync(dest).length)) throw new Error(`destination must be a fresh or empty directory: ${dest}`);
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  const staging = fs.mkdtempSync(path.join(path.dirname(dest), '.document-flow-build-'));
  try {
    for (const name of MODULES) copy(path.join(HERE, name), path.join(staging, 'assets/document-flow', name));
    copy(path.join(LIB, 'vendor/gsap/gsap.min.js'), path.join(staging, 'assets/vendor/gsap/gsap.min.js'));
    copy(path.join(LIB, 'vendor/gsap/SOURCE.json'), path.join(staging, 'assets/vendor/gsap/SOURCE.json'));
    fs.cpSync(path.join(LIB, 'fonts'), path.join(staging, 'assets/fonts'), {recursive: true});
    const audio = await buildAudio({destination: staging, events: plan.events, kit: recipe.sound, duration, bpm: plan.bpm});
    const variables = [
      {id: 'brand', type: 'string', label: 'Brand (JSON)', default: JSON.stringify(recipe.brand)},
      {id: 'content', type: 'string', label: 'Content (JSON; rebuild after event changes)', default: JSON.stringify(recipe.content)},
    ];
    const values = Object.fromEntries(variables.map(item => [item.id, item.default]));
    // Empty child defaults mean inheritance. A nonempty JSON value is always
    // explicit, even when it exactly equals the originally compiled brand.
    const childVariables = variables.map(item => ({...item, default: '', placeholder: `Inherit root ${item.id}, or enter JSON to override`}));
    const vars = escape(JSON.stringify(variables)), childVars = escape(JSON.stringify(childVariables)), defaults = js(values), config = js(recipe);
    fs.mkdirSync(path.join(staging, 'compositions'), {recursive: true});
    // HyperFrames scopes this authored selector to the actual mount, including
    // repeated imports of the same file under different composition aliases.
    // Register the original promise: native readiness rejects stale audio even
    // when the CLI uses its default best-effort render settings.
    fs.writeFileSync(path.join(staging, `compositions/${instanceId}.html`), `<!doctype html><html data-composition-id="${instanceId}" data-composition-duration="${duration}" data-composition-variables='${childVars}'><body><template>
<div data-sequence-container="document-flow" data-composition-id="${instanceId}" data-duration="${duration}">
<style>[data-sequence-container="document-flow"]{position:absolute;inset:0;overflow:hidden}[data-sequence-container="document-flow"] *{box-sizing:border-box}</style>
<div id="${instanceId}-content" class="clip" data-sequence-root="document-flow" data-start="0" data-duration="${duration}" data-track-index="0" style="position:absolute;inset:0"></div>
<script>(function(){const root=document.getElementById('${instanceId}-content');const defaults=${defaults};const local=window.__hyperframes?.getVariables?.()||{};
const host=document.querySelector('[data-composition-id="${instanceId}"]');const instanceId=host.getAttribute('data-composition-id');root.id=instanceId+'-content';
window.__hf=window.__hf||{};window.__hf.buildReady=window.__hf.buildReady||{};
const setup=import('./assets/document-flow/runtime.mjs').then(({mount,resolveVariables})=>mount(root,${config},resolveVariables(root,local,defaults),window.gsap,{expectedAudio:${js(audioContract(plan))},instanceId})).then(({timeline})=>{window.__timelines=window.__timelines||{};window.__timelines['${instanceId}']=timeline;});
window.__hf.buildReady['document-flow:'+instanceId]=setup;
setup.catch(error=>{root.dataset.sequenceError=String(error.message);});})();</script>
</div></template></body></html>`);
    const clips = [...(audio.music ? [audioTag(audio.music, 2, true, instanceId)] : []), ...audio.clips.map((clip, index) => audioTag(clip, index + 3, false, instanceId))].join('\n');
    fs.writeFileSync(path.join(staging, 'index.html'), `<!doctype html><html data-composition-variables='${vars}'><head><meta charset="utf-8"><style>${fontCSS()}\nhtml,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:${plan.brand.background}}#main{position:relative;width:${width}px;height:${height}px}</style></head><body>
<script src="assets/vendor/gsap/gsap.min.js"></script>
<script>document.getElementById('main').documentFlowVariables=window.__hyperframes?.getVariables?.()||{};</script>
<div id="main" data-composition-id="main" data-width="${width}" data-height="${height}" data-duration="${duration}">
<div id="${instanceId}" class="clip" data-composition-id="${instanceId}" data-composition-src="compositions/${instanceId}.html" data-variable-values='{}' data-start="0" data-duration="${duration}" data-track-index="1" data-track-kind="graphics" data-width="${width}" data-height="${height}" style="position:absolute;inset:0"></div>
${clips}
</div><script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true}).to({},{duration:${duration}});</script></body></html>`);
    const sourceFiles = {};
    for (const relative of fs.readdirSync(staging, {recursive: true}).sort()) {
      const file = path.join(staging, relative);
      if (fs.statSync(file).isFile()) sourceFiles[relative] = sha256(fs.readFileSync(file));
    }
    const implementation = {};
    for (const name of [...MODULES, 'build.mjs', 'audio.mjs']) implementation[name] = sha256(fs.readFileSync(path.join(HERE, name)));
    const receipt = {schema: 'document-flow-source.v1', nativeRuntime: 'hyperframes', hyperframes: '0.9.19', gsap: '3.14.2', algorithm: 'sha256',
      implementation, instanceId, recipe: sha256(pretty(recipe)), files: sourceFiles,
      aggregate: sha256(JSON.stringify(sourceFiles))};
    fs.writeFileSync(path.join(staging, 'recipe.json'), pretty(recipe));
    fs.writeFileSync(path.join(staging, 'sequence-project.json'), pretty({schema: 'document-flow-project.v1', plan, audio}));
    fs.writeFileSync(path.join(staging, 'source-receipt.json'), pretty(receipt));
    const documents = new Map();
    for (const name of ['BRIEF.md', 'SPEC.md', 'STORYBOARD.md', 'REVIEW.md']) {
      const from = [documentsDirectory, HERE].filter(Boolean).map(folder => path.join(folder, name)).find(file => fs.existsSync(file));
      if (from) {copy(from, path.join(staging, name)); documents.set(name, from);}
    }
    // Keep editable input and builder dependencies with the rendered project.
    // Rebuild into another fresh folder: generated output is never overwritten.
    fs.mkdirSync(path.join(staging, 'source/lib/sequences/document-flow'), {recursive: true});
    for (const name of [...MODULES, 'build.mjs', 'audio.mjs']) copy(path.join(HERE, name), path.join(staging, 'source/lib/sequences/document-flow', name));
    for (const [name, from] of documents) copy(from, path.join(staging, 'source/lib/sequences/document-flow', name));
    fs.cpSync(ASSET_SOURCE(), path.join(staging, 'source/lib/sequences/document-flow/audio-assets'), {recursive: true, filter: file => !file.endsWith('.py') && !file.includes('__pycache__')});
    fs.cpSync(path.join(LIB, 'fonts'), path.join(staging, 'source/lib/fonts'), {recursive: true});
    copy(path.join(LIB, 'fonts.css'), path.join(staging, 'source/lib/fonts.css'));
    fs.cpSync(path.join(LIB, 'vendor/gsap'), path.join(staging, 'source/lib/vendor/gsap'), {recursive: true});
    copy(path.resolve(LIB, '../sequence.mjs'), path.join(staging, 'source/sequence.mjs'));
    fs.writeFileSync(path.join(staging, 'source/recipe.json'), pretty(recipe));
    fs.writeFileSync(path.join(staging, 'source/build-options.json'), pretty({instanceId}));
    if (fs.existsSync(dest)) fs.rmdirSync(dest);
    fs.renameSync(staging, dest);
    return {project: dest, width, height, duration, plan, audio, receipt};
  } catch (error) {
    fs.rmSync(staging, {recursive: true, force: true});
    throw error;
  }
}

function ASSET_SOURCE() {return path.join(HERE, 'audio-assets');}
