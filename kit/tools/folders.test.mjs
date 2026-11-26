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
