#!/usr/bin/env node
// Explicit sequence entry point; existing film.json scene composition is unchanged.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile} from './lib/sequences/document-flow/model.mjs';
import {buildProject} from './lib/sequences/document-flow/build.mjs';

async function main(argv) {
  const [command, input, ...rest] = argv;
  if (!['validate', 'review', 'build'].includes(command) || !input) throw new Error('Usage: node sequence.mjs <validate|review|build> recipe.json [--out fresh-directory]');
  const outIndex = rest.indexOf('--out');
  if (rest.some((arg, index) => index !== outIndex && index !== outIndex + 1) || (outIndex >= 0 && !rest[outIndex + 1])) throw new Error('Only --out fresh-directory is supported');
  if (command !== 'build' && rest.length) throw new Error('--out belongs to build');
  if (command === 'build' && outIndex < 0) throw new Error('build requires --out fresh-directory');
  const file = path.resolve(input), recipe = JSON.parse(fs.readFileSync(file, 'utf8'));
  const plan = compile(recipe);
  if (command === 'validate') return {ok: true, schema: plan.recipe.schema, aspect: plan.recipe.aspect, seconds: plan.duration, events: plan.events.length};
  if (command === 'review') return {schema: 'document-flow-review.v1', aspect: plan.recipe.aspect, seconds: plan.duration, bpm: plan.bpm,
    brand: plan.brand, content: plan.recipe.content, events: plan.events,
    note: 'Resolved content and semantic timing. This is not a visual quality score.'};
  const optionsFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'build-options.json');
  const options = fs.existsSync(optionsFile) ? JSON.parse(fs.readFileSync(optionsFile, 'utf8')) : {};
  const built = await buildProject(path.resolve(rest[outIndex + 1]), recipe, {...options, documentsDirectory: path.dirname(file)});
  return {ok: true, project: built.project, width: built.width, height: built.height, seconds: built.duration,
    audioClips: built.audio.clips.length, music: Boolean(built.audio.music), sourceAggregate: built.receipt.aggregate};
}

main(process.argv.slice(2)).then(result => process.stdout.write(JSON.stringify(result, null, 2) + '\n')).catch(error => {
  process.stderr.write(`sequence: ${error.message}\n`); process.exitCode = 1;
});
