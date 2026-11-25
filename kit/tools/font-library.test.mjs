// The font library's families: the files and the CSS are what the list says, the film
// validator takes every family by name, and each carries its licence.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), lib = path.join(here, '../source/lib');
const require = createRequire(import.meta.url);
const {BUNDLED_FONTS, problems} = require('../source/lib/film.cjs');
const library = require('../source/lib/fonts/library.json');

test('the copied faces and the CSS section match the list', () => {
  assert.match(execFileSync(process.execPath, [path.join(here, 'font-library.mjs'), '--check'], {encoding: 'utf8'}), /library families/);
});

test('every family is open, carries its licence and has a Latin face', () => {
  const sources = JSON.parse(fs.readFileSync(path.join(lib, 'fonts/SOURCE.json'), 'utf8')).sources.map(source => source.name);
  for (const family of library.families) {
    assert.match(family.license, /^OFL/);
    assert.ok(fs.readFileSync(path.join(lib, 'fonts', family.licenseFile), 'utf8').includes('SIL OPEN FONT LICENSE'), family.family);
    assert.ok(family.faces.some(face => face.subset === 'latin'), family.family);
    assert.ok(sources.includes(family.family), `${family.family} is not in SOURCE.json`);
  }
});

test('a film may name any bundled family, and no other, in brand.font', () => {
  const film = font => ({aspect: '16:9', style: 'editorial', brand: {name: 'Nook', url: 'nook.app', font}, scenes: [{type: 'title', beats: 4, text: 'Hello there'}]});
  assert.equal(new Set(BUNDLED_FONTS).size, BUNDLED_FONTS.length);
  for (const family of library.families) assert.ok(BUNDLED_FONTS.includes(family.family));
  for (const font of BUNDLED_FONTS) assert.deepEqual(problems(film(font)).filter(line => /brand\.font/.test(line)), [], font);
  assert.ok(problems(film('Comic Sans MS')).some(line => /bundled family/.test(line)));
});
