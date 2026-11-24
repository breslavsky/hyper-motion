// Build a fixed example with the same compiler/hosts/presentation as a film.
// Only its audio host is omitted, matching the catalogue's visual-preview scope.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {TEMPLATE} from '../src/catalog-data.mjs';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const source = path.join(TEMPLATE, 'source');
const {compile} = require(path.join(source, 'lib/compiler/plan.cjs'));
const {buildProject} = require(path.join(source, 'lib/build.cjs'));
const {problems} = require(path.join(source, 'lib/film.cjs'));
export const ASPECTS = Object.freeze({landscape: '16:9', portrait: '9:16', square: '1:1'});
export const readSequenceExample = () => JSON.parse(fs.readFileSync(path.join(here, 'examples/idea-to-action.json'), 'utf8'));

export function visualPreview(html) {
  const music = /<audio\b[^>]*\bid="music"[^>]*>[\s\S]*?<\/audio>/g;
  assert.equal([...html.matchAll(music)].length, 1, 'Expected the production builder to emit one music host');
  return html.replace(music, '').replace('</body>', '<script>window.addEventListener("pagehide",()=>window.__pkFilm?.dispose?.());</script><script src="hyperframe.runtime.iife.js"></script></body>');
}

export function prepareSequences(output) {
  const example = readSequenceExample();
  assert.equal(example.labels.length, example.film.scenes.length);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-storybook-sequence-'));
  const variants = {};
  let sharedDefinitions;
  try {
    for (const [format, aspect] of Object.entries(ASPECTS)) {
      const film = {...structuredClone(example.film), aspect};
      assert.deepEqual(problems(film), [], `${example.id}: ${aspect}`);
      const plan = compile(film);
      const {html} = buildProject(temporary, film, plan);
      const manifest = JSON.parse(fs.readFileSync(path.join(temporary, 'native-project.json'), 'utf8'));
      if (sharedDefinitions) assert.deepEqual(manifest.definitions, sharedDefinitions, 'Shared sequence definitions must have identical types and durations across formats');
      sharedDefinitions = manifest.definitions;
      const filename = `sequence-${example.id}-${format}.html`;
      fs.writeFileSync(path.join(output, filename), visualPreview(html));
      variants[format] = {
        url: `pk/${filename}`, film, width: plan.width, height: plan.height, duration: plan.duration,
        scenes: plan.scenes.map((ps, index) => ({index, type: ps.scene.type, label: example.labels[index],
          start: ps.start, duration: ps.dur, transition: ps.transition, transitionDuration: ps.trDur,
          at: ps.start + Math.min(ps.dur * .6, ps.dur - .05)})),
      };
    }
    // Definition files are reusable: every native host supplies its own plan,
    // format and variables. Keep HTML roots beside these shared resources.
    fs.rmSync(path.join(output, 'compositions'), {recursive: true, force: true});
    fs.cpSync(path.join(temporary, 'compositions'), path.join(output, 'compositions'), {recursive: true});
    return [{id: example.id, name: example.name, description: example.description, globals: example.globals, variants}];
  } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
}
