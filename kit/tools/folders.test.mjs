// Every scene of Pure Kinetic stands in one folder, by what the viewer sees (components/folders.json).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const catalog = require('../source/lib/components/catalog.json');
const own = require('../source/lib/components/metadata.cjs');
const {folders} = require('../source/lib/components/folders.json');

// The sections the Storybook gives a place of their own, and the one scene left where it was.
const ELSEWHERE = new Set(['glass', 'three', 'lens-wall']);
const LEFT = new Set(['ride']);

test('one principle: every scene of the section is in exactly one of the eight folders', () => {
  assert.deepEqual(Object.keys(folders), ['words', 'sentences', 'screens', 'controls', 'data', 'pictures', 'brand', 'shapes']);
  const placed = Object.values(folders).flat();
  assert.equal(new Set(placed).size, placed.length, 'a scene stands in two folders');
  const due = Object.keys(catalog).filter(type => !ELSEWHERE.has(catalog[type].family) && !own[type]?.section && !LEFT.has(type));
  assert.deepEqual(due.filter(type => !placed.includes(type)), [], 'a new scene has no folder: put it where what the viewer sees says');
  assert.deepEqual(placed.filter(type => !due.includes(type)), [], 'a folder names a scene that is not of this section');
});

test('the list of scenes the kit prints names them as the folders do, and the others by their section', () => {
  const {listScenes} = require('../source/lib/scene.cjs');
  const listed = listScenes();
  assert.deepEqual(listed.folders, folders);
  const inFolders = new Set(Object.values(folders).flat()), inSections = Object.values(listed.sections).flat();
  assert.deepEqual([...inFolders, ...inSections].sort(), Object.keys(catalog).sort());
  assert.ok(inSections.every(name => !inFolders.has(name)));
  assert.equal(listScenes('tabs').folder, 'data');
  assert.equal(listScenes('ride').section, 'ride');
  assert.equal(listScenes('tabs').family, undefined);
});

test('a scene from a technique goes into a folder of its own file', () => {
  const tool = require('node:fs').readFileSync(new URL('./technique.py', import.meta.url), 'utf8');
  assert.match(tool, /COMPONENTS \/ "scenes" \/ args\.into \/ f"\{args\.scene\}\.mjs"/);
  assert.match(tool, /scene-files\.cjs/);
});
