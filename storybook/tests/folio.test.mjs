import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {FOLIO_FORMATS, readFolioExample, prepareFolio, folioPreviewHTML, copySharedFolioAssets} from '../scripts/folio.mjs';
import {TEMPLATE} from '../src/catalog-data.mjs';

const SOURCE = path.join(TEMPLATE, 'source/lib/sequences/document-flow');
const [{compile}, {audioContract}] = await Promise.all([
  import(pathToFileURL(path.join(SOURCE, 'model.mjs')).href),
  import(pathToFileURL(path.join(SOURCE, 'audio-contract.mjs')).href),
]);
const hash = value => createHash('sha256').update(value).digest('hex');
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
let output, entry;
before(async () => { output = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-folio-test-')); entry = await prepareFolio(output); });
after(() => fs.rmSync(output, {recursive: true, force: true}));

test('Folio preserves its canonical recipe, one continuous world and readable phase targets in all formats', () => {
  const example = JSON.parse(fs.readFileSync(path.join(SOURCE, 'examples/folio.json'), 'utf8'));
  assert.deepEqual(readFolioExample(), example);
  assert.equal(entry.id, 'folio'); assert.ok(entry.continuous && entry.hasAudio);
  assert.deepEqual(entry.globals, {brandbook: null, material: null});
  assert.deepEqual(Object.keys(entry.variants), Object.keys(FOLIO_FORMATS));
  for (const [format, variant] of Object.entries(entry.variants)) {
    assert.deepEqual(variant.recipe, {...example, aspect: FOLIO_FORMATS[format]});
    const plan = compile(variant.recipe);
    assert.deepEqual([variant.width, variant.height, variant.duration], [plan.width, plan.height, plan.duration]);
    assert.equal(plan.bpm, 108); assert.equal(plan.duration, 32*60/108);
    assert.deepEqual(variant.phases.map(phase => phase.id), ['intro', 'collect', 'arrange', 'create', 'end']);
    for (const phase of variant.phases) assert.ok(phase.at > phase.start && phase.at < phase.start+phase.duration);
    assert.ok(variant.phases[3].at/plan.beat >= 25.1, 'Create preview must show the completed artwork');
    const html = fs.readFileSync(path.join(output, variant.url.slice(3)), 'utf8');
    const hosts = [...html.matchAll(/<div\b[^>]*data-composition-src="[^"]+"[^>]*>/g)].map(match => attributes(match[0]));
    assert.equal(hosts.length, 1); assert.equal(hosts[0]['data-composition-id'], variant.instanceId);
    assert.equal(Number(hosts[0]['data-width']), variant.width); assert.equal(Number(hosts[0]['data-height']), variant.height);
    assert.ok(fs.existsSync(path.join(output, 'folio', hosts[0]['data-composition-src'])));
    const runtimeURL = new URL('../hyperframe.runtime.iife.js', `https://example.invalid/catalog/${variant.url}`);
    assert.equal(runtimeURL.pathname, '/catalog/pk/hyperframe.runtime.iife.js');
    assert.ok(html.indexOf("document.getElementById('main')") > html.indexOf('<div id="main"'), 'Browser bootstrap cannot run before its root exists');
    assert.ok(html.indexOf("document.getElementById('main')") < html.indexOf('src="../hyperframe.runtime.iife.js"'));
    assert.match(html, /pagehide.*\[data-sequence-root\].*documentFlow\?\.dispose/);
  }
});

test('all 26 native effects and the music host retain the compiled audio schedule and matching readiness contract', () => {
  for (const [format, variant] of Object.entries(entry.variants)) {
    const plan = compile(variant.recipe), folder = path.join(output, 'folio');
    const audio = JSON.parse(fs.readFileSync(path.join(folder, `${format}.audio-plan.json`), 'utf8'));
    assert.equal(plan.events.length, 26); assert.equal(audio.clips.length, 26); assert.ok(audio.music);
    assert.equal(variant.audioSummary.contractHash, hash(audioContract(plan)));
    const html = fs.readFileSync(path.join(folder, `${format}.html`), 'utf8');
    const hosts = [...html.matchAll(/<audio\b[^>]*>/g)].map(match => attributes(match[0]));
    assert.equal(hosts.length, 27); assert.equal(new Set(hosts.map(host => host.id)).size, 27);
    for (const clip of [...audio.clips, audio.music]) {
      const host = hosts.find(item => item.id === `${variant.instanceId}-${clip.id}`); assert.ok(host);
      for (const [attribute, value] of [['src', clip.src], ['data-start', clip.start], ['data-duration', clip.duration],
        ['data-volume', clip.gain], ['data-playback-rate', clip.playbackRate]]) assert.equal(host[attribute], String(value));
      if (clip.eventId) {
        assert.equal(host['data-sequence-event'], clip.eventId);
        assert.equal(clip.start, plan.events.find(event => event.id === clip.eventId).time);
      } else {
        assert.equal(host['data-sequence-music'], 'pulse'); assert.equal(host['data-fade-in'], String(clip.fadeIn));
        assert.equal(host['data-fade-out'], String(clip.fadeOut));
      }
    }
    for (const asset of audio.assets) {
      const bytes = fs.readFileSync(path.join(folder, asset.src));
      assert.equal(bytes.length, asset.bytes); assert.equal(hash(bytes), asset.sha256);
    }
    const definition = fs.readFileSync(path.join(folder, `compositions/${variant.instanceId}.html`), 'utf8');
    const embedded = definition.match(/expectedAudio:("(?:[^"\\]|\\.)*")/);
    assert.ok(embedded); assert.equal(JSON.parse(embedded[1]), audioContract(plan));
    assert.match(definition, /window\.__hf\.buildReady\['document-flow:'\+instanceId\]=setup/);
  }
});

test('shared assets remain original production bytes and the preview omits portable builder copies', () => {
  const folder = path.join(output, 'folio');
  assert.ok(!fs.existsSync(path.join(folder, 'source')));
  assert.ok(!fs.existsSync(path.join(folder, 'assets/document-flow-audio/audio-plan.json')));
  for (const [format, variant] of Object.entries(entry.variants)) {
    const receipt = JSON.parse(fs.readFileSync(path.join(folder, `${format}.builder-receipt.json`), 'utf8'));
    assert.equal(receipt.aggregate, variant.sourceReceipt.aggregate);
    assert.equal(receipt.aggregate, hash(JSON.stringify(receipt.files)));
    assert.equal(receipt.recipe, hash(JSON.stringify(variant.recipe, null, 2)+'\n'));
    for (const [file, digest] of Object.entries(receipt.implementation)) assert.equal(hash(fs.readFileSync(path.join(SOURCE, file))), digest);
    for (const [file, digest] of Object.entries(receipt.files)) {
      if (file === 'index.html') continue; // Guarded browser bootstrap adaptation.
      const actual = file === 'assets/document-flow-audio/audio-plan.json' ? `${format}.audio-plan.json` : file;
      assert.equal(hash(fs.readFileSync(path.join(folder, actual))), digest, `Published native bytes differ: ${file}`);
    }
  }
});

test('the browser adapter fails clearly when the native bootstrap shape changes', () => {
  assert.throws(() => folioPreviewHTML('<body><div id="main"></div></body>'), /exactly one native root-variable bootstrap/);
  const html = fs.readFileSync(path.join(output, 'folio/landscape.html'), 'utf8');
  const bootstrap = html.match(/<script>document\.getElementById\('main'\).*?<\/script>/)[0];
  assert.throws(() => folioPreviewHTML(html.replace('</body>', bootstrap+'</body>')), /exactly one native root-variable bootstrap/);
});

test('generation replaces only verified owned files and preserves unrelated or manually added evidence', async () => {
  const sibling = path.join(output, 'keep.txt'); fs.writeFileSync(sibling, 'unrelated output');
  const second = await prepareFolio(output); assert.deepEqual(second, entry);
  assert.equal(fs.readFileSync(sibling, 'utf8'), 'unrelated output');
  const foreign = path.join(output, 'folio/keep.txt'); fs.writeFileSync(foreign, 'manual addition');
  try {
    await assert.rejects(prepareFolio(output), /modified or additional Folio output/);
    assert.equal(fs.readFileSync(foreign, 'utf8'), 'manual addition');
    assert.ok(!fs.readdirSync(output).some(name => name.startsWith('.folio-preview-')));
  } finally { fs.unlinkSync(foreign); }
  const unowned = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-folio-unowned-'));
  try {
    fs.mkdirSync(path.join(unowned, 'folio')); fs.writeFileSync(path.join(unowned, 'folio/user.txt'), 'user');
    await assert.rejects(prepareFolio(unowned), /unowned Folio output/);
    assert.equal(fs.readFileSync(path.join(unowned, 'folio/user.txt'), 'utf8'), 'user');
  } finally { fs.rmSync(unowned, {recursive: true, force: true}); }
});

test('shared-assets deduplication rejects format-dependent runtime bytes', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-folio-assets-'));
  try {
    const source = path.join(fixture, 'from'), destination = path.join(fixture, 'to'); fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'runtime.mjs'), 'first format'); copySharedFolioAssets(source, destination);
    fs.writeFileSync(path.join(source, 'runtime.mjs'), 'different second format');
    assert.throws(() => copySharedFolioAssets(source, destination), /Shared Folio asset differs across formats/);
    assert.equal(fs.readFileSync(path.join(destination, 'runtime.mjs'), 'utf8'), 'first format');
  } finally { fs.rmSync(fixture, {recursive: true, force: true}); }
});

test('the selected template supplies the Folio recipe, native builder and audio contract together', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-folio-selected-kit-'));
  try {
    const selected = path.join(fixture, 'selected'), source = path.join(selected, 'source/lib/sequences/document-flow');
    const calls = path.join(fixture, 'calls.jsonl'), output = path.join(fixture, 'preview');
    fs.mkdirSync(path.join(source, 'examples'), {recursive: true});
    const recipe = readFolioExample(); recipe.brand.name = 'Selected Folio';
    fs.writeFileSync(path.join(source, 'examples/folio.json'), JSON.stringify(recipe));
    for (const [file, method] of [['build.mjs', 'buildProject'], ['audio-contract.mjs', 'audioContract']]) {
      const canonical = pathToFileURL(path.join(SOURCE, file)).href;
      fs.writeFileSync(path.join(source, file), `import fs from 'node:fs';import {${method} as native} from ${JSON.stringify(canonical)};export function ${method}(...args){fs.appendFileSync(${JSON.stringify(calls)},${JSON.stringify(method+'\n')});return native(...args);}\n`);
    }
    const code = `const {prepareFolio}=await import(${JSON.stringify(new URL('../scripts/folio.mjs', import.meta.url).href)});console.log(JSON.stringify(await prepareFolio(${JSON.stringify(output)})));`;
    const prepared = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], {
      env: {...process.env, PURE_KINETIC_TEMPLATE: selected}, encoding: 'utf8', timeout: 30000,
    }));
    const methods = fs.readFileSync(calls, 'utf8').trim().split('\n');
    assert.equal(methods.filter(value => value === 'buildProject').length, 3);
    assert.equal(methods.filter(value => value === 'audioContract').length, 3);
    for (const [format, variant] of Object.entries(prepared.variants)) {
      assert.equal(variant.recipe.brand.name, 'Selected Folio');
      const project = JSON.parse(fs.readFileSync(path.join(output, 'folio', `${format}.project.json`), 'utf8'));
      assert.equal(project.plan.brand.name, 'Selected Folio'); assert.equal(project.audio.clips.length, 26);
      assert.equal(variant.audioSummary.contractHash, hash(audioContract(project.plan)));
    }
  } finally { fs.rmSync(fixture, {recursive: true, force: true}); }
});
