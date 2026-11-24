// Regression contracts for the catalog's shared Radix-based system.
// Real font fitting, glyph geometry and visual hierarchy are tested in a browser
// by registry-native.mjs; these tests deliberately do not emulate the DOM.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createDesignSystem, RADIX_TOKENS, ROLE_STEPS} from '../source/lib/components/design-system.mjs';

const context = (width = 1920, height = 1080) => {
  const S = Math.min(width, height) / 1080;
  return {W: width, H: height, S, type: {label: 36 * S * (height > width * 1.2 ? 1.1 : 1)}};
};

test('runtime token values match the pinned upstream CSS and verified license', () => {
  const directory = fileURLToPath(new URL('../source/lib/components/upstream/radix-themes/', import.meta.url));
  const receipt = JSON.parse(fs.readFileSync(path.join(directory, 'RECEIPT.json'), 'utf8'));
  assert.equal(receipt.package, '@radix-ui/themes');
  assert.equal(receipt.version, '3.3.0');
  assert.equal(receipt.license, 'MIT');
  assert.match(receipt.integrity, /^sha512-/);
  const archive = path.resolve(directory, receipt.archiveRoot);
  assert.equal(archive, fileURLToPath(new URL('./upstream/radix-themes-3.3.0/', import.meta.url)).replace(/\/$/, ''));
  for (const [name, digest] of Object.entries(receipt.files)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(archive, name))).digest('hex'), digest, name);
  }
  assert.equal(fs.readFileSync(path.join(directory, 'LICENSE'), 'utf8'), fs.readFileSync(path.join(archive, 'LICENSE'), 'utf8'));
  const css = fs.readFileSync(path.join(archive, 'tokens/base.css'), 'utf8');
  for (const [token, exported] of Object.entries({space: 'space', 'font-size': 'fontSizes', 'line-height': 'lineHeights', radius: 'radius'})) {
    const parsed = [...css.matchAll(new RegExp(`--${token}-(\\d+): calc\\((\\d+)px`, 'g'))]
      .sort((a, b) => Number(a[1]) - Number(b[1])).map(match => Number(match[2]));
    assert.deepEqual(RADIX_TOKENS[exported], parsed, token);
  }
  const tracking = [...css.matchAll(/--letter-spacing-(\d+): ([^;]+);/g)]
    .sort((a, b) => Number(a[1]) - Number(b[1])).map(match => match[2]);
  assert.deepEqual(RADIX_TOKENS.letterSpacing, tracking);
});

test('headings retain hierarchy even at their smallest permitted size', () => {
  for (const [width, height] of [[1080, 1920], [1080, 1080], [1920, 1080], [720, 1280]]) {
    const D = createDesignSystem(context(width, height));
    assert.ok(D.type('sceneTitle').minSize >= D.type('body').size * 1.25);
    assert.ok(D.type('cardTitle').minSize > D.type('body').size);
    assert.ok(D.type('cardTitle').minSize > D.type('button').size);
    assert.ok(D.type('button').size < D.type('body').size);
    assert.equal(D.type('button').minSize, D.type('button').size, 'A button cannot silently shrink to label size');
    assert.equal(D.type('label').minSize, D.type('label').size, 'Readable labels have one stable rung');
  }
});

test('format scaling keeps type, spacing and controls in the same proportion', () => {
  const base = createDesignSystem(context());
  for (const [width, height] of [[1080, 1920], [1080, 1080], [1920, 1080], [720, 1280], [3840, 2160]]) {
    const K = context(width, height), D = createDesignSystem(K), factor = D.unit / base.unit;
    assert.ok(D.type('label').size >= K.type.label - 1e-9);
    for (const role of Object.keys(ROLE_STEPS)) {
      assert.ok(Math.abs(D.type(role).size / base.type(role).size - factor) < 1e-12);
      assert.ok(Math.abs(D.type(role).lineHeight / base.type(role).lineHeight - factor) < 1e-12);
    }
    for (let step = 1; step <= 9; step++) assert.equal(D.space(step), RADIX_TOKENS.space[step - 1] * D.unit);
    for (let step = 1; step <= 6; step++) assert.equal(D.radius(step), RADIX_TOKENS.radius[step - 1] * D.unit);
    const button = D.control('button');
    assert.equal(button.role, 'button');
    assert.ok(Math.abs(button.height - D.type('button').lineHeight - 2 * button.paddingY) < 1e-10);
    assert.equal(button.paddingX, D.space(3));
    assert.equal(button.gap, D.space(2));
    assert.equal(button.radius, D.radius(2));
  }
});

test('presentation scaling preserves the projected size of the entire system', () => {
  const K = context(), base = createDesignSystem(K);
  for (const scale of [1, .9, .8888888889]) {
    const D = createDesignSystem({...K, presentationScale: scale});
    assert.ok(Math.abs(D.unit * scale - base.unit) < 1e-9);
    for (const role of Object.keys(ROLE_STEPS)) {
      assert.ok(Math.abs(D.type(role).size * scale - base.type(role).size) < 1e-9, role);
      assert.ok(Math.abs(D.type(role).lineHeight * scale - base.type(role).lineHeight) < 1e-9, role);
    }
    assert.ok(Math.abs(D.space(4) * scale - base.space(4)) < 1e-9);
    assert.ok(Math.abs(D.control('button').height * scale - base.control('button').height) < 1e-9);
  }
});

test('unknown roles and off-scale spacing fail instead of creating local styles', () => {
  const D = createDesignSystem(context());
  for (const role of ['giantButton', '', null]) assert.throws(() => D.type(role));
  for (const step of [0, -1, 1.5, 10, NaN, undefined]) assert.throws(() => D.space(step));
  for (const step of [0, -1, 1.5, 7, NaN, undefined]) assert.throws(() => D.radius(step));
  assert.throws(() => D.control('giantButton'));
});

test('embedded surfaces scale the complete system without changing control hierarchy',()=>{
  const D=createDesignSystem(context());
  for(const factor of [.25,.5,1,2]){
    const local=D.forSurface(factor);
    for(const role of Object.keys(ROLE_STEPS)){
      assert.equal(local.type(role).size,D.type(role).size*factor);
      assert.equal(local.type(role).lineHeight,D.type(role).lineHeight*factor);
    }
    assert.equal(local.control('button').height,D.control('button').height*factor);
    assert.equal(local.space(3),D.space(3)*factor);
    assert.equal(local.radius(3),D.radius(3)*factor);
    assert.deepEqual(local.forSurface(2).steps('hero'),D.forSurface(factor*2).steps('hero'));
  }
  for(const value of [0,-1,NaN,Infinity])assert.throws(()=>D.forSurface(value));
});
