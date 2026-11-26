// The list the kit imports its own-file scenes from is what the folders and the files say.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {written, TARGET} = require('./scene-files.cjs');
const catalog = require('../source/lib/components/catalog.json');
const {folders} = require('../source/lib/components/folders.json');

test('scenes/folders.mjs is current, and a scene with a file of its own is of that folder in the catalogue', () => {
  const {text, types} = written();
  assert.equal(fs.readFileSync(TARGET, 'utf8'), text, 'run `node kit/tools/scene-files.cjs --write`');
  const folderOf = Object.fromEntries(Object.entries(folders).flatMap(([folder, list]) => list.map(type => [type, folder])));
  for (const type of types) assert.equal(catalog[type].family, folderOf[type], `${type}: its family in catalog.json is its folder once its code is there`);
});

test('a scene in a file of its own stands on nothing of the file it was taken from', () => {
  // A scene that fell back on another through the old shared table (`SCENES.prompt`) threw only when it was drawn that way.
  const lib = new URL('../source/lib/components/scenes/', import.meta.url);
  for (const [folder, types] of Object.entries(folders)) for (const type of types) {
    const text = fs.readFileSync(new URL(`${folder}/${type}.mjs`, lib), 'utf8').replace(/\/\/[^\n]*/g, '');
    assert.doesNotMatch(text, /\bSCENES\b/, `${folder}/${type}.mjs`);
    if (/\bsceneFactories\b/.test(text)) assert.match(text, /(const|import \{)\s*\{?\s*sceneFactories|createFamily/, `${folder}/${type}.mjs uses a table of scenes it does not have`);
  }
});
