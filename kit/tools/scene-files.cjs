#!/usr/bin/env node
// The list of the scenes that have a file of their own, scenes/<folder>/<type>.mjs, written for the
// kit to import them all at once: source/lib/components/scenes/folders.mjs.
//
//   node kit/tools/scene-files.cjs            say whether the list is current
//   node kit/tools/scene-files.cjs --write    write it again
//
// They are imported by name and not found by path when a scene mounts: a module asked for at mount
// arrives a moment later, and a film of heavy scenes was not ready in time when its scenes' modules
// came that way (components/index.mjs).
const fs = require('node:fs'), path = require('node:path');

const LIB = path.join(__dirname, '../source/lib/components');
const TARGET = path.join(LIB, 'scenes/folders.mjs');

function written() {
  const {folders} = JSON.parse(fs.readFileSync(path.join(LIB, 'folders.json'), 'utf8'));
  const rows = [];
  for (const [folder, types] of Object.entries(folders)) for (const type of types) {
    const file = path.join(LIB, 'scenes', folder, `${type}.mjs`);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const kind = /^export function create\(K\)/m.test(text) ? 'create' : /^export const factory = /m.test(text) ? 'factory' : null;
    if (!kind) throw new Error(`${folder}/${type}.mjs exports neither create(K) nor factory`);
    rows.push({folder, type, kind, name: `${kind}_${type.replace(/[^A-Za-z0-9]/g, '_')}`});
  }
  const lines = ['// Written by kit/tools/scene-files.cjs from folders.json and the files that exist. Do not edit.'];
  for (const row of rows) lines.push(`import {${row.kind} as ${row.name}} from './${row.folder}/${row.type}.mjs';`);
  lines.push('/** Scenes that are their own factory. */');
  lines.push(`export const plain = {${rows.filter(row => row.kind === 'factory').map(row => `${JSON.stringify(row.type)}: ${row.name}`).join(', ')}};`);
  lines.push("/** Scenes built over the kit's context: each gives its factory for a context. */");
  lines.push(`export const made = {${rows.filter(row => row.kind === 'create').map(row => `${JSON.stringify(row.type)}: ${row.name}`).join(', ')}};`);
  return {text: `${lines.join('\n')}\n`, types: rows.map(row => row.type)};
}

module.exports = {written, TARGET};

if (require.main === module) {
  const {text, types} = written();
  if (process.argv.includes('--write')) { fs.writeFileSync(TARGET, text); console.log(`${types.length} scenes have a file of their own`); }
  else if (!fs.existsSync(TARGET) || fs.readFileSync(TARGET, 'utf8') !== text) { console.error('scenes/folders.mjs is not current: node kit/tools/scene-files.cjs --write'); process.exit(1); }
  else console.log(`current: ${types.length} scenes`);
}
