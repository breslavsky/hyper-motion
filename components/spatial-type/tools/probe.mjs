// Native acceptance: installed definition, isolated instances and seek-safe pixels.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import recipe from '../recipe.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(HERE, '..');
const REPO = path.resolve(KIT, '../..');
const packageRoot = path.join(REPO, 'kit/node_modules/hyperframes');
const version = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'))).version;
if (version !== '0.9.19') throw new Error(`Expected HyperFrames 0.9.19, got ${version}`);
const dist = path.join(packageRoot, 'dist');
const load = prefix => import(path.join(dist, fs.readdirSync(dist).find(f => f.startsWith(`${prefix}-`) && f.endsWith('.js'))));
const {bundleWithLocalizedFonts} = await load('bundleWithLocalizedFonts');
const {serveStaticProjectHtml} = await load('staticProjectServer');
const {openSettledCompositionPage, seekCompositionTimeline} = await load('captureCompositionFrame');
const sharp = createRequire(path.join(fs.realpathSync(packageRoot), 'package.json'))('sharp');
const output = path.resolve(process.argv[2] ?? '/tmp/motion-fab-spatial-type-qa');
const selected = new RegExp(process.argv[3] ?? '.');
fs.mkdirSync(output, {recursive: true});
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function fingerprint(directory, prefix = '') {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const relative = path.posix.join(prefix, entry.name), file = path.join(directory, entry.name);
    return entry.isDirectory() ? fingerprint(file, relative) : entry.isFile() ? [{path: relative, sha256: hash(fs.readFileSync(file))}] : [];
  }).sort((a, b) => a.path.localeCompare(b.path));
}
const sourceFiles = fingerprint(KIT);
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll("'", '&#39;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

const alternate = {
  ...structuredClone(recipe), duration: 4, seed: 831,
  look: {background: '#150b08', fog: 0.01, exposure: 0.8},
  materials: {face: {color: '#efb06a', roughness: 0.28}, side: {color: '#81502b', roughness: 0.45}},
  words: [
    {id: 'depth', text: 'DEPTH 42', position: [0, 0, 0], visible: [0, 2.6]},
    {id: 'light', text: 'LIGHT', position: [0, -0.3, -4], visible: [2.5, 4],
      slices: [{normal: [1, 0.4, 0], offset: 0.1}],
      fracture: {start: 3, duration: 0.5, separation: 0.06, depth: 0.12}},
  ],
  camera: {keys: [
    {time: 0, position: [0, 0, 10], target: [0, 0, 0], fov: 41},
    {time: 2, position: [1, 0.5, 7], target: [0, 0, 0], fov: 46, ease: 'linear'},
    {time: 4, position: [-0.8, 0.4, 4], target: [0, -0.3, -4], fov: 38, ease: 'linear'},
  ]},
  fields: [{count: 40, seed: 707, bounds: [[-6, 6], [-3, 3], [-10, -1]], start: 0,
    scale: [0.04, 0.15], material: {color: '#edb675', roughness: 0.4}}],
  glints: [], lights: [], transition: null,
  post: {bloom: 0.15, threshold: 1.5, grain: 0, aberration: 0}, motionBlur: {samples: 1, shutter: 0},
};
const jobs = [
  {id: 'default', instances: [{id: 'world', start: 0, config: recipe}]},
  {id: 'alternate-custom-path', prefix: 'visuals/effects/spatial-type', instances: [{id: 'alternate', start: 0.75, config: alternate}]},
  {id: 'two-offset-instances', instances: [
    {id: 'first', start: 0, config: recipe},
    {id: 'second', start: 1.25, config: {...structuredClone(recipe), seed: 991,
      materials: {face: {color: '#d6a372', roughness: 0.3}, side: {color: '#7b4b23', roughness: 0.4}}}},
  ]},
];

function build(job) {
  const project = path.join(output, 'projects', job.id);
  if (fs.existsSync(project)) {
    if (!fs.existsSync(path.join(project, '.probe-owned'))) throw new Error(`Refusing to replace ${project}`);
    fs.rmSync(project, {recursive: true});
  }
  const prefix = job.prefix ?? 'compositions/components/spatial-type';
  fs.mkdirSync(project, {recursive: true});
  fs.writeFileSync(path.join(project, '.probe-owned'), 'spatial-type native acceptance\n');
  fs.cpSync(KIT, path.join(project, prefix), {recursive: true,
    filter: source => !source.includes(`${path.sep}tools${path.sep}`) && !source.endsWith('.test.mjs')});
  fs.mkdirSync(path.join(project, 'assets'), {recursive: true});
  fs.copyFileSync(path.join(REPO, 'components/pure-kinetic/vendor/gsap-3.14.2.min.js'), path.join(project, 'assets/gsap.min.js'));
  const duration = Math.max(...job.instances.map(i => i.start + i.config.duration));
  const hosts = job.instances.map((i, index) => {
    const style = job.instances.length === 1 ? 'position:absolute;inset:0' :
      `position:absolute;left:${index * 960}px;top:270px;width:1920px;height:1080px;transform:scale(.5);transform-origin:0 0`;
    return `<div id="${i.id}" class="clip" data-composition-id="${i.id}" data-composition-src="${prefix}/spatial-type.html" data-start="${i.start}" data-duration="${i.config.duration}" data-track-index="${index + 1}" data-track-kind="graphics" data-width="1920" data-height="1080" data-variable-values='${escape(JSON.stringify({config: i.config}))}' style="${style}"></div>`;
  }).join('\n');
  fs.writeFileSync(path.join(project, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="UTF-8"><style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#090a0b}#main{position:relative;width:1920px;height:1080px}</style><script src="assets/gsap.min.js"></script></head><body><div id="main" data-composition-id="main" data-duration="${duration}" data-width="1920" data-height="1080">${hosts}</div><script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true}).to({},{duration:${duration}});</script></body></html>`);
  fs.writeFileSync(path.join(project, 'hyperframes.json'), JSON.stringify({registry: 'https://example.invalid/custom', paths: {components: path.dirname(prefix)}}));
  return {project, duration};
}
function inspect() {
  return [...document.querySelectorAll('*')].filter(el => el.spatialTypeInstance).map(el => {
    const instance = el.spatialTypeInstance;
    const host = el.closest('[data-composition-src],[data-composition-file]');
    return {hostId: host?.getAttribute('id'), start: Number(host?.dataset.start ?? 0), time: instance.time,
      state: instance.api.inspect(), width: el.querySelector('canvas')?.width, height: el.querySelector('canvas')?.height};
  });
}
async function difference(a, b) {
  const aa = await sharp(a).removeAlpha().raw().toBuffer(), bb = await sharp(b).removeAlpha().raw().toBuffer();
  if (aa.length !== bb.length) return {passed: false, reason: 'different image size'};
  let maxChannelDelta = 0, changedChannels = 0;
  for (let i = 0; i < aa.length; i++) {const delta = Math.abs(aa[i] - bb[i]); maxChannelDelta = Math.max(maxChannelDelta, delta); changedChannels += delta > 0;}
  return {passed: maxChannelDelta <= 1, maxChannelDelta, changedChannels, pixelExact: hash(a) === hash(b)};
}

let browser;
const results = [];
for (const job of jobs.filter(j => selected.test(j.id))) {
  const receipt = {id: job.id, samples: [], repeats: [], errors: [], externalRequests: [], faults: []};
  let page, server;
  try {
    const {project, duration} = build(job); Object.assign(receipt, {project, duration});
    const html = await bundleWithLocalizedFonts(project);
    server = await serveStaticProjectHtml(project, html);
    async function open() {
      const opened = await openSettledCompositionPage(html, server.url, {renderReadyTimeoutMs: 30000, browserGpuMode: 'hardware',
        prelaunched: browser ? {take: async () => ({browser, softwareWebGpu: false})} : undefined,
        beforeNavigate: async tab => {
          tab.on('pageerror', error => receipt.errors.push(error.message));
          await tab.setRequestInterception(true);
          tab.on('request', request => {
            const u = new URL(request.url());
            if (['http:', 'https:'].includes(u.protocol) && !['localhost', '127.0.0.1'].includes(u.hostname)) {
              receipt.externalRequests.push(request.url()); request.abort();
            } else request.continue();
          });
        }});
      browser = opened.browser;
      if (opened.renderReadyTimedOut) receipt.faults.push('buildReady timed out');
      return opened.page;
    }
    page = await open();
    const times = job.id === 'two-offset-instances' ? [1.5, 2.5, 4.5, 5.75] :
      job.id === 'alternate-custom-path' ? [0.75, 1.75, 2.75, 3.75, 4.7] : [0, 1, 2.2, 2.7, 3.5, 4.6, 5.2, 5.9];
    for (const t of times) {
      const started = performance.now(); await seekCompositionTimeline(page, t, {exactTime: true});
      const instances = await page.evaluate(inspect);
      if (instances.length !== job.instances.length) receipt.faults.push(`t${t}: expected ${job.instances.length} instances, got ${instances.length}`);
      for (let i = 0; i < instances.length; i++) {
        const actual = instances[i].state.time ?? instances[i].time;
        const expected = Math.max(0, Math.min(job.instances[i].config.duration, t - job.instances[i].start));
        if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-5) receipt.faults.push(`t${t}/instance${i}: local time ${actual}, expected ${expected}`);
        const state = instances[i].state, config = job.instances[i].config;
        if (state.seed !== config.seed) receipt.faults.push(`t${t}/instance${i}: configured seed missing`);
        if (JSON.stringify(state.words.map(w => w.text)) !== JSON.stringify(config.words.map(w => w.text))) receipt.faults.push(`t${t}/instance${i}: configured words missing`);
        for (const word of state.words) {
          if (!(word.vertexCount > 0 && word.letterCount > 0)) receipt.faults.push(`t${t}/instance${i}/${word.id}: missing real geometry`);
          if (word.materials.face.type !== 'MeshStandardMaterial' || word.materials.face.metalness !== 1) receipt.faults.push(`t${t}/instance${i}/${word.id}: missing metallic 3D material`);
        }
      }
      if (new Set(instances.map(i => i.state.sceneId)).size !== instances.length) receipt.faults.push(`t${t}: instances share a scene`);
      const png = await page.screenshot();
      const file = `${job.id}-${t.toFixed(3)}.png`; fs.writeFileSync(path.join(output, file), png);
      receipt.samples.push({time: t, seekMs: performance.now() - started, instances, frameSha256: hash(png), file});
    }
    if (new Set(receipt.samples.map(s => s.frameSha256)).size < 3) receipt.faults.push('scene did not visibly change at sampled times');
    const t = times[Math.floor(times.length / 2)];
    await seekCompositionTimeline(page, t, {exactTime: true}); const first = await page.screenshot();
    await seekCompositionTimeline(page, duration - 0.01, {exactTime: true}); await seekCompositionTimeline(page, 0, {exactTime: true});
    await seekCompositionTimeline(page, t, {exactTime: true}); const repeated = await page.screenshot();
    receipt.repeats.push({kind: 'reverse-seek', time: t, ...await difference(first, repeated)});
    await page.close(); page = await open(); await seekCompositionTimeline(page, t, {exactTime: true});
    receipt.repeats.push({kind: 'fresh-load', time: t, ...await difference(first, await page.screenshot())});
    for (const repeat of receipt.repeats) if (!repeat.passed) receipt.faults.push(`${repeat.kind} pixels differ`);
    const states = receipt.samples.map(s => s.instances.map(i => i.state.camera));
    if (JSON.stringify(states[0]) === JSON.stringify(states.at(-1))) receipt.faults.push('camera did not change');
    if (job.id === 'alternate-custom-path') {
      const at = receipt.samples.find(s => s.time === 1.75)?.instances[0]?.state;
      const camera = at?.camera;
      if (!camera || Math.abs(camera.position[0] - 0.5) > 1e-5 || Math.abs(camera.fov - 43.5) > 1e-5) receipt.faults.push('configured linear camera midpoint did not reach renderer');
    }
  } catch (error) {receipt.error = error.stack ?? String(error);}
  finally {await page?.close().catch(() => {}); await server?.close();}
  receipt.passed = !receipt.error && !receipt.errors.length && !receipt.externalRequests.length && !receipt.faults.length;
  results.push(receipt); fs.writeFileSync(path.join(output, `${job.id}.json`), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({id: job.id, passed: receipt.passed, faults: receipt.faults, error: receipt.error}));
}
await browser?.close();
const summary = {hyperframes: version, generatedAt: new Date().toISOString(), sourceFiles, cases: results.map(({id, passed, faults, error}) => ({id, passed, faults, error})), passed: results.length > 0 && results.every(r => r.passed)};
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
if (!summary.passed) process.exitCode = 1;
