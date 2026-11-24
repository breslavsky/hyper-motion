import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {VERT_SHADER_SRC, FRAG_SHADER_SRC} from './vendor/shaders.mjs';
import {METAL_PRESETS} from './metal.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = JSON.parse(fs.readFileSync(new URL('./vendor/INTEGRITY.json', import.meta.url)));

test('vendored material preserves the upstream shader strings, source receipts and licenses', () => {
  assert.equal(sha(VERT_SHADER_SRC), receipt.shader.vertexSha256);
  assert.equal(sha(FRAG_SHADER_SRC), receipt.shader.fragmentSha256);
  assert.deepEqual(METAL_PRESETS, ['silver', 'gold', 'chromatic']);
  for (const [name, entry] of Object.entries(receipt.files)) {
    const bytes = fs.readFileSync(new URL(`./vendor/${name}`, import.meta.url));
    assert.equal(sha(bytes), entry.sha256, name);
    assert.equal(bytes.length, entry.bytes, name);
  }
  assert.equal(receipt.library.license, 'MIT');
  assert.equal(receipt.shader.license, 'Apache-2.0');
});

test('portable template ships the exact canonical renderer and license files', () => {
  const require = createRequire(import.meta.url);
  const {canonical, destination, files} = require('../../kit/tools/sync-metal.cjs');
  for (const name of files) assert.deepEqual(fs.readFileSync(`${destination}/${name}`), fs.readFileSync(`${canonical}/${name}`), name);
});
