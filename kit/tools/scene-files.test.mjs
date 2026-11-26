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
