// The record of what clock every scene keeps is the measurement: a scene whose moments move from
// seconds onto the film's beats (or back) says so by changing the record with it.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {measure, RECORD} = require('./scene-clocks.cjs');

test('every scene keeps the clock the record says it keeps', () => {
  const kept = JSON.parse(fs.readFileSync(RECORD, 'utf8')), found = measure();
  const changed = Object.keys(found).filter(type => found[type].clock !== kept[type]?.clock)
    .map(type => `${type}: ${kept[type]?.clock ?? 'not in the record'} -> ${found[type].clock}`);
  assert.deepEqual(changed, [], 'run `node kit/tools/scene-clocks.cjs --write` and commit the record with the scene');
  assert.deepEqual(Object.keys(kept).filter(type => !(type in found)), [], 'the record names a scene the catalogue no longer has');
  // No scene's clock is unknown: every type has a sample that plans.
  assert.deepEqual(Object.keys(found).filter(type => found[type].clock === 'unknown'), []);
});
