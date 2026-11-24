// Publish the canonical continuous world, including its native audio tracks.
// The adapter changes browser bootstrap order only; the authored world is intact.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {TEMPLATE} from '../src/catalog-data.mjs';

const SOURCE = path.join(TEMPLATE, 'source/lib/sequences/document-flow');
const [{buildProject}, {audioContract}] = await Promise.all([
  import(pathToFileURL(path.join(SOURCE, 'build.mjs')).href),
  import(pathToFileURL(path.join(SOURCE, 'audio-contract.mjs')).href),
]);
export const FOLIO_FORMATS = Object.freeze({landscape: '16:9', portrait: '9:16', square: '1:1'});
const OWNERSHIP = '.storybook-folio.json';
const SCHEMA = 'pure-kinetic.storybook-folio.v1';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pretty = value => JSON.stringify(value, null, 2)+'\n';
export const readFolioExample = () => JSON.parse(fs.readFileSync(path.join(SOURCE, 'examples/folio.json'), 'utf8'));

function fileHashes(directory, omitOwnership = false) {
  const files = {};
  for (const relative of fs.readdirSync(directory, {recursive: true}).sort()) {
    if (omitOwnership && relative === OWNERSHIP) continue;
    const file = path.join(directory, relative), stat = fs.lstatSync(file);
    assert.ok(!stat.isSymbolicLink(), `Generated Folio output cannot contain symlinks: ${relative}`);
    if (stat.isFile()) files[relative] = sha(fs.readFileSync(file));
    else assert.ok(stat.isDirectory(), `Generated Folio output must contain regular files: ${relative}`);
  }
  return files;
}

function assertReplaceable(destination) {
  if (!fs.existsSync(destination) && !fs.lstatSync(destination, {throwIfNoEntry: false})) return;
  const stat = fs.lstatSync(destination);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'Folio destination must be a real directory');
  if (!fs.readdirSync(destination).length) return;
  const marker = path.join(destination, OWNERSHIP);
  assert.ok(fs.existsSync(marker) && !fs.lstatSync(marker).isSymbolicLink(), 'Refusing to replace unowned Folio output');
  const receipt = JSON.parse(fs.readFileSync(marker, 'utf8'));
  assert.equal(receipt.schema, SCHEMA, 'Refusing to replace unowned Folio output');
  assert.deepEqual(fileHashes(destination, true), receipt.files, 'Refusing to replace modified or additional Folio output');
}

export function folioPreviewHTML(html) {
  const bootstrap = "<script>document.getElementById('main').documentFlowVariables=window.__hyperframes?.getVariables?.()||{};</script>";
  assert.equal(html.split(bootstrap).length-1, 1, 'Expected exactly one native root-variable bootstrap');
  assert.equal([...html.matchAll(/<div\s+id="main"(?=[\s>])/g)].length, 1, 'Expected one native main root');
  assert.equal(html.split('</body>').length-1, 1, 'Expected one native closing body');
  const teardown = '<script>window.addEventListener("pagehide",()=>{for(const root of document.querySelectorAll("[data-sequence-root]"))root.documentFlow?.dispose?.();for(const timeline of new Set(Object.values(window.__timelines??{})))timeline.kill();window.__timelines={};},{once:true});</script>';
  // The native CLI hoists scripts; the ordinary browser executes this bootstrap
  // immediately. Keep it after #main and before the native runtime starts.
  return html.replace('<html ', '<html lang="en" ').replace(bootstrap, '').replace('</body>', `${bootstrap}${teardown}<script src="../hyperframe.runtime.iife.js"></script></body>`);
}

export function copySharedFolioAssets(source, destination) {
  for (const relative of Object.keys(fileHashes(source))) {
    // Timing metadata varies with format; the native runtime does not fetch it.
    // Keep each original plan separately instead of overwriting a shared file.
    if (relative === 'document-flow-audio/audio-plan.json') continue;
    const from = path.join(source, relative), to = path.join(destination, relative);
    if (fs.existsSync(to)) assert.deepEqual(fs.readFileSync(to), fs.readFileSync(from), `Shared Folio asset differs across formats: ${relative}`);
    else { fs.mkdirSync(path.dirname(to), {recursive: true}); fs.copyFileSync(from, to); }
  }
}

export async function prepareFolio(output) {
  const root = path.resolve(output), destination = path.join(root, 'folio');
  fs.mkdirSync(root, {recursive: true});
  assert.ok(!fs.lstatSync(root).isSymbolicLink(), 'Storybook output must be a real directory');
  assertReplaceable(destination);
  let temporary, staging;
  try {
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-storybook-folio-'));
    staging = fs.mkdtempSync(path.join(root, '.folio-preview-'));
    const example = readFolioExample(), variants = {};
    assert.equal(example.bpm, 108, 'The Folio demonstration follows its canonical 108 BPM score');
    for (const [format, aspect] of Object.entries(FOLIO_FORMATS)) {
      const recipe = {...structuredClone(example), aspect}, instanceId = `folio-${format}`;
      const native = path.join(temporary, format);
      const built = await buildProject(native, recipe, {instanceId});
      const {plan, audio, receipt} = built;
      copySharedFolioAssets(path.join(native, 'assets'), path.join(staging, 'assets'));
      fs.mkdirSync(path.join(staging, 'compositions'), {recursive: true});
      fs.copyFileSync(path.join(native, `compositions/${instanceId}.html`), path.join(staging, `compositions/${instanceId}.html`));
      fs.writeFileSync(path.join(staging, `${format}.html`), folioPreviewHTML(fs.readFileSync(path.join(native, 'index.html'), 'utf8')));
      for (const [from, suffix] of [['recipe.json', 'recipe.json'], ['sequence-project.json', 'project.json'],
        ['source-receipt.json', 'builder-receipt.json'], ['assets/document-flow-audio/audio-plan.json', 'audio-plan.json']]) {
        fs.copyFileSync(path.join(native, from), path.join(staging, `${format}.${suffix}`));
      }
      const labels = ['Intro', ...recipe.content.steps, 'Finale'];
      variants[format] = {url: `pk/folio/${format}.html`, recipe: plan.recipe, instanceId,
        projectUrl: `pk/folio/${format}.project.json`, audioPlanUrl: `pk/folio/${format}.audio-plan.json`,
        width: plan.width, height: plan.height, duration: plan.duration,
        phases: plan.phases.map((phase, index) => ({index, id: phase.id, label: labels[index], start: phase.start,
          duration: phase.end-phase.start, at: Math.min(phase.end-.15, phase.start+(phase.end-phase.start)*(phase.id === 'create' ? .85 : .6))})),
        audioSummary: {bpm: plan.bpm, events: plan.events.length, effects: audio.clips.length, music: Boolean(audio.music),
          musicGain: audio.music?.gain ?? 0, playbackRate: audio.music?.playbackRate ?? 1, contractHash: sha(audioContract(plan))},
        sourceReceipt: {url: `pk/folio/${format}.builder-receipt.json`, aggregate: receipt.aggregate},
      };
    }
    fs.writeFileSync(path.join(staging, OWNERSHIP), pretty({schema: SCHEMA, files: fileHashes(staging)}));
    // Preserve unrelated siblings and reject user edits or foreign files inside
    // our previous generated folder before replacing only this owned subtree.
    assertReplaceable(destination);
    if (fs.existsSync(destination)) fs.rmSync(destination, {recursive: true});
    fs.renameSync(staging, destination);
    return {id: 'folio', name: 'Folio — Continuous Story',
      description: 'Six documents move through collection, sorting and creation in one world with a shared camera and Folio’s visual style. Music and sound effects follow the same events.',
      globals: {brandbook: null, material: null}, continuous: true, hasAudio: true, variants};
  } finally {
    if (temporary) fs.rmSync(temporary, {recursive: true, force: true});
    if (staging) fs.rmSync(staging, {recursive: true, force: true});
  }
}
