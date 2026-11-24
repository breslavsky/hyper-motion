import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {ASPECTS, prepareSequences, readSequenceExample, visualPreview} from '../scripts/sequences.mjs';
import {TEMPLATE} from '../src/catalog-data.mjs';

const require = createRequire(import.meta.url);
const {problems} = require(path.join(TEMPLATE, 'source/lib/film.cjs'));
const {compile} = require(path.join(TEMPLATE, 'source/lib/compiler/plan.cjs'));
const decode = value => value.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&amp;', '&');

test('the example remains a valid film with the same brand, scene order and timing in three formats', () => {
  const {film, globals, labels} = readSequenceExample();
  // The example keeps its own look: it locks the toolbar's brandbook and material.
  assert.deepEqual(globals, {brandbook: null, material: null});
  assert.equal(film.brand.font, 'Geist'); assert.equal(film.style, 'editorial');
  // The film carries its own colours: the toolbar has no brand preset to take them from.
  assert.deepEqual(Object.keys(film.brand.tokens), ['background', 'foreground', 'accent', 'accent2']);
  assert.equal(labels.length, film.scenes.length);
  const plans = Object.values(ASPECTS).map(aspect => {
    const recipe = {...film, aspect};
    assert.deepEqual(problems(recipe), []);
    return compile(recipe);
  });
  for (const plan of plans) {
    assert.equal(plan.scenes.length, 4);
    assert.deepEqual(plan.scenes.map(ps => ps.scene.type), ['title', 'typewriter', 'modal-morph', 'endcard']);
    assert.deepEqual(plan.scenes.map(ps => [ps.start, ps.dur, ps.trDur]), plans[0].scenes.map(ps => [ps.start, ps.dur, ps.trDur]));
    assert.ok(plan.scenes.slice(1).every(ps => ps.trDur > 0), 'Every scene boundary must demonstrate a transition');
    assert.ok(plan.scenes.at(-1).dur >= 3.3, 'The closing needs its entrance and a readable hold');
  }
});

test('three static native projects retain per-host geometry and shared definitions without a missing audio asset', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-storybook-example-test-'));
  try {
    const [example] = prepareSequences(output);
    assert.equal(Object.keys(example.variants).length, 3);
    for (const [format, variant] of Object.entries(example.variants)) {
      const html = fs.readFileSync(path.join(output, path.basename(variant.url)), 'utf8');
      assert.equal(variant.film.aspect, ASPECTS[format]);
      assert.equal(variant.scenes.length, 4);
      const configs = [...html.matchAll(/data-pk-config='([^']+)'/g)].map(match => JSON.parse(decode(match[1])));
      assert.equal(configs.length, 4);
      for (const [index, config] of configs.entries()) {
        assert.equal(config.id, `s${index + 1}`);
        assert.equal(config.plan.width, variant.width, 'Shared definitions must not substitute the last generated format');
        assert.equal(config.plan.height, variant.height);
        assert.equal(config.ps.scene.type, variant.scenes[index].type);
      }
      const definitions = [...html.matchAll(/data-composition-src="([^"]+)"/g)].map(match => match[1]);
      assert.equal(definitions.length, 4);
      assert.ok(definitions.every(file => fs.existsSync(path.join(output, file))));
      assert.ok(definitions.every(file => !file.startsWith('/')), 'Root-relative assets break prefix hosting');
      assert.doesNotMatch(html, /<audio\b|assets\/music\.m4a/);
      assert.match(html, /src="hyperframe\.runtime\.iife\.js"/);
      assert.match(html, /pagehide.*__pkFilm\?\.dispose/);
      for (let index = 1; index < configs.length; index++) {
        const previous = configs[index - 1], current = configs[index];
        assert.ok(previous.clipStart + previous.clipDuration > current.clipStart, 'Native scene hosts must overlap for the transition');
        assert.ok(current.clipStart < current.ps.start);
      }
    }
  } finally { fs.rmSync(output, {recursive: true, force: true}); }
});

test('visual-only adaptation fails visibly if the production audio contract changes', () => {
  assert.throws(() => visualPreview('<html><body></body></html>'), /one music host/);
  assert.throws(() => visualPreview('<body><audio id="music"></audio><audio id="music"></audio></body>'), /one music host/);
});

test('the selected template supplies sequence validation, compilation and native building together', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-sequence-selected-kit-'));
  try {
    const selected = path.join(fixture, 'selected'), lib = path.join(selected, 'source/lib');
    const output = path.join(fixture, 'preview'), calls = path.join(fixture, 'calls.jsonl');
    fs.mkdirSync(path.join(lib, 'compiler'), {recursive: true}); fs.mkdirSync(output);
    for (const [file, method] of [['film.cjs', 'problems'], ['compiler/plan.cjs', 'compile'], ['build.cjs', 'buildProject']]) {
      const canonical = path.join(TEMPLATE, 'source/lib', file);
      const marker = method === 'compile' ? 'result.storybookSelectedKit="selected-sequence";' : '';
      fs.writeFileSync(path.join(lib, file), `const fs=require('node:fs');const native=require(${JSON.stringify(canonical)});module.exports={...native,${method}(...args){fs.appendFileSync(${JSON.stringify(calls)},${JSON.stringify(method+'\n')});const result=native.${method}(...args);${marker}return result;}};\n`);
    }
    const code = `const {prepareSequences}=await import(${JSON.stringify(new URL('../scripts/sequences.mjs', import.meta.url).href)});console.log(JSON.stringify(prepareSequences(${JSON.stringify(output)})));`;
    const [prepared] = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], {
      env: {...process.env, PURE_KINETIC_TEMPLATE: selected}, encoding: 'utf8', timeout: 30000,
    }));
    const methods = fs.readFileSync(calls, 'utf8').trim().split('\n');
    for (const method of ['problems', 'compile', 'buildProject']) assert.equal(methods.filter(value => value === method).length, 3);
    for (const variant of Object.values(prepared.variants)) {
      const html = fs.readFileSync(path.join(output, path.basename(variant.url)), 'utf8');
      const configs = [...html.matchAll(/data-pk-config='([^']+)'/g)].map(match => JSON.parse(decode(match[1])));
      assert.equal(configs.length, 4); assert.ok(configs.every(config => config.plan.storybookSelectedKit === 'selected-sequence'));
    }
  } finally { fs.rmSync(fixture, {recursive: true, force: true}); }
});
