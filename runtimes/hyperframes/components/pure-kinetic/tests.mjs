import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildProject } from './build.mjs';
import { components, looks, nativeVariables, validateContent, validateDuration, validateStyle } from './catalog.mjs';

test('all five component defaults satisfy the exported contract', () => {
  assert.deepEqual(Object.keys(components).sort(), ['chart', 'controls', 'phone3d', 'stack', 'title']);
  for (const kind of Object.keys(components)) assert.ok(validateContent(kind));
});

test('array content is copied before an instance can mutate it', () => {
  const input = { labels: ['A', 'B'], values: [12, 24] };
  const first = validateContent('chart', input);
  first.labels[0] = 'Changed';
  assert.equal(input.labels[0], 'A');
  assert.equal(validateContent('chart', input).labels[0], 'A');
});

test('chart rejects misleading or incomplete numeric series', () => {
  for (const values of [[1], [-1, 2], [NaN, 2], [Infinity, 2], ['12', 24], [1_000_001, 2]]) {
    assert.throws(() => validateContent('chart', { labels: ['A', 'B'], values }), /chart.values/);
  }
  assert.throws(() => validateContent('chart', { labels: ['A', ''], values: [1, 2] }), /chart.labels/);
  assert.throws(() => validateContent('chart', { labels: ['A'], values: [1] }), /chart.labels/);
  assert.throws(() => validateContent('chart', { labels: Array(7).fill('A'), values: Array(7).fill(1) }), /chart.labels/);
});

test('component content fails early on unknown fields and invalid text', () => {
  assert.throws(() => validateContent('controls', { toggles: ['Only one'] }), /controls.toggles/);
  assert.throws(() => validateContent('controls', { toggles: ['First', '   '] }), /controls.toggles/);
  assert.throws(() => validateContent('controls', { title: 'x'.repeat(43) }), /controls.title/);
  assert.throws(() => validateContent('title', { text: '' }), /title.text/);
  assert.throws(() => validateContent('title', { html: '<script>bad()</script>' }), /unsupported content field/);
  assert.throws(() => validateContent('missing'), /unknown component/);
});

test('style accepts only local font families and bounded numeric tokens', () => {
  for (const look of Object.values(looks)) assert.deepEqual(validateStyle(look), look);
  for (const input of [{ font: 'Remote font' }, { weight: 1000 }, { weight: NaN }, { tracking: -1 },
    { fg: 'red' }, { bg: 'url(https://example.invalid/image)' }, { accent: '#fff' },
    { palette: [] }, { palette: ['red'] }, { css: 'body {display:none}' }]) {
    assert.throws(() => validateStyle(input), /style\./);
  }
});

test('duration contract includes both short and long pilot clips', () => {
  for (const duration of [2, 4, 8]) assert.equal(validateDuration(duration), duration);
  for (const duration of [0, 1.99, 8.01, Infinity, NaN, '4']) assert.throws(() => validateDuration(duration), /duration/);
});

test('native variables keep arrays as lossless JSON with explicit content/style/timing roles', () => {
  const content = validateContent('chart', { labels: ['Запросы', 'Оплаты'], values: [0, 42] });
  const variables = nativeVariables('chart', content, looks.editorial, 2);
  assert.deepEqual(JSON.parse(variables.find((field) => field.id === 'labels').default), content.labels);
  assert.deepEqual(JSON.parse(variables.find((field) => field.id === 'values').default), [0, 42]);
  assert.equal(variables.find((field) => field.id === 'labels').role, 'content');
  assert.equal(variables.find((field) => field.id === 'style').role, 'style');
  assert.equal(variables.find((field) => field.id === 'duration').role, 'timing');
});

test('project generation rejects invalid host IDs and timing before writing files', () => {
  const destination = path.join(os.tmpdir(), `pk-invalid-${process.pid}`);
  const scene = { id: 'chart-one', kind: 'chart' };
  assert.throws(() => buildProject(destination, { scenes: [scene, scene] }), /unique lowercase id/);
  assert.throws(() => buildProject(destination, { scenes: [{ ...scene, id: '../escape' }] }), /unique lowercase id/);
  assert.throws(() => buildProject(destination, { scenes: [{ ...scene, id: 'main' }] }), /unique lowercase id/);
  assert.throws(() => buildProject(destination, { scenes: [{ ...scene, start: -1 }] }), /nonnegative seconds/);
  assert.throws(() => buildProject(destination, { scenes: [{ ...scene, duration: 9 }] }), /duration/);
  assert.throws(() => buildProject(destination, { aspect: '4:5', scenes: [scene] }), /aspect/);
  assert.equal(fs.existsSync(destination), false);
});

test('standalone output exposes separate native components without copying the Pure Kinetic engine', () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-native-contract-'));
  try {
    const result = buildProject(destination, { aspect: '16:9', scenes: [
      { id: 'chart-one', kind: 'chart', duration: 2, content: { title: '</script><script>test</script>' } },
      { id: 'chart-two', kind: 'chart', duration: 8 },
      { id: 'controls-one', kind: 'controls', duration: 4 },
    ] });
    assert.equal(result.duration, 14);
    assert.deepEqual(result.scenes.map((scene) => scene.start), [0, 2, 10]);
    const index = fs.readFileSync(path.join(destination, 'index.html'), 'utf8');
    for (const definition of ['chart-2', 'chart-8', 'controls-4']) {
      assert.ok(index.includes(`data-composition-src="compositions/${definition}.html"`));
    }
    const chart = fs.readFileSync(path.join(destination, 'compositions/chart-2.html'), 'utf8');
    assert.ok(chart.includes('data-composition-variables='));
    assert.ok(chart.includes('getVariables'));
    assert.ok(!chart.includes('</script><script>test</script>'));
    assert.ok(fs.existsSync(path.join(destination, 'assets/pk/scenes/chart.mjs')));
    assert.ok(fs.existsSync(path.join(destination, 'assets/pk/scenes/controls.mjs')));
    assert.equal(fs.existsSync(path.join(destination, 'assets/pk/scenes/phone3d.mjs')), false);
    assert.equal(fs.existsSync(path.join(destination, 'assets/pk/engine')), false);
    assert.throws(() => buildProject(destination, { scenes: [{ kind: 'title' }] }), /already contains index.html/);
  } finally {
    fs.rmSync(destination, { recursive: true, force: true });
  }
});

test('two instances reuse one definition and keep their own native variables', () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-shared-definition-'));
  try {
    buildProject(destination, {scenes:[{id:'first',kind:'title',content:{text:'First'}},{id:'second',kind:'title',content:{text:'Second'},look:'loud'}]});
    assert.deepEqual(fs.readdirSync(path.join(destination,'compositions')),['title-4.html']);
    const index=fs.readFileSync(path.join(destination,'index.html'),'utf8');
    assert.equal(index.match(/data-composition-src="compositions\/title-4.html"/g).length,2);
    assert.ok(index.includes('First')&&index.includes('Second'));
  } finally { fs.rmSync(destination,{recursive:true,force:true}); }
});

test('style palettes are private to each validated instance', () => {
  const palette=['#112233'];
  const a=validateStyle({palette}),b=validateStyle({palette});a.palette[0]='#ffffff';
  assert.equal(b.palette[0],'#112233');assert.equal(palette[0],'#112233');
});
