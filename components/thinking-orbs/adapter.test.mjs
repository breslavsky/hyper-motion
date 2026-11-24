import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ORB_STATES, PRESET_SIZES, createOrb, sampleOrb } from './orb.mjs';
import { MODE_FRAMES, resolvePreset } from './vendor/engine.es.js';

const golden = JSON.parse(await readFile(new URL('./vendor/orbs-golden.json', import.meta.url), 'utf8'));

function close(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label} length`);
  for (let index = 0; index < actual.length; index++) {
    assert.ok(Number.isFinite(actual[index]), `${label}[${index}] must be finite`);
    assert.ok(Math.abs(actual[index] - expected[index]) <= golden.tolerance,
      `${label}[${index}]: ${actual[index]} != ${expected[index]}`);
  }
}

for (const state of ORB_STATES) {
  test(`${state}: vendored engine matches every upstream golden vector`, () => {
    const cases = golden.cases.filter((entry) => entry.state === state);
    assert.equal(cases.length, 8);
    for (const entry of cases) {
      const preset = resolvePreset(state, entry.size);
      assert.deepEqual(preset, golden.resolved[`${state}-${entry.size}`]);
      // Golden timestamps are raw mode time. Dividing by preset speed and
      // multiplying back can perturb z-sorting of face-on equal-depth dots at
      // machine epsilon. Validate the upstream vectors at their exact times;
      // validate the adapter's clock and order-independent seeking separately.
      const frame = MODE_FRAMES[preset.mode](entry.size, entry.t, preset.opts);
      assert.equal(frame.dots.length, entry.dotCount, `${entry.key} dot count`);
      assert.equal(frame.lines.length, entry.lineCount, `${entry.key} line count`);
      close(frame.dots.flatMap((d) => [d.x, d.y, d.z, d.r, d.white, d.a ?? 1]), entry.dots, `${entry.key} dots`);
      close(frame.lines.flatMap((l) => [l.x1, l.y1, l.x2, l.y2, l.white, l.a ?? 1, l.w]), entry.lines, `${entry.key} lines`);
    }
  });
}

test('all three preset sizes remain finite, sorted, and seekable in arbitrary order', () => {
  for (const state of ORB_STATES) {
    for (const presetSize of PRESET_SIZES) {
      const options = { state, presetSize };
      const target = sampleOrb(options, 1.7);
      for (const seconds of [0, 8.3, 0.2, 36, 1.7]) {
        const frame = sampleOrb(options, seconds);
        assert.ok(frame.dots.length > 0);
        assert.ok(frame.dots.every((dot) => Object.values(dot).every(Number.isFinite)));
        assert.ok(frame.lines.every((line) => Object.values(line).every(Number.isFinite)));
        assert.ok(frame.dots.every((dot, index) => index === 0 || dot.z >= frame.dots[index - 1].z));
      }
      assert.deepEqual(sampleOrb(options, 1.7), target);
      target.dots[0].x = -12345;
      assert.notEqual(sampleOrb(options, 1.7).dots[0].x, -12345, 'callers cannot mutate future frames');
    }
  }
});

test('speed changes clock only; output size, resolution, theme and tint preserve geometry', () => {
  for (const state of ORB_STATES) {
    assert.deepEqual(sampleOrb({ state, speed: 2 }, 0.85), sampleOrb({ state }, 1.7));
    assert.deepEqual(sampleOrb({ state, speed: 0 }, 19), sampleOrb({ state }, 0));
    assert.deepEqual(
      sampleOrb({ state, size: 640, pixelRatio: 2, dark: false, color: '#86afff' }, 1.7),
      sampleOrb({ state, size: 64, pixelRatio: 1, dark: true }, 1.7),
    );
  }
});

function fakeCanvas() {
  const calls = [];
  const ctx = { calls };
  for (const name of ['save', 'restore', 'setTransform', 'clearRect', 'beginPath', 'arc', 'fill', 'moveTo', 'lineTo', 'stroke']) {
    ctx[name] = (...args) => calls.push([name, ...args]);
  }
  const canvas = { width: 300, height: 150, style: { width: '30px', height: '15px' }, getContext: () => ctx };
  return { canvas, ctx, calls };
}

test('each Canvas owns its frame, explicit resolution, and disposable lifecycle', () => {
  const first = fakeCanvas();
  const second = fakeCanvas();
  const a = createOrb(first.canvas, { state: 'searching', size: 160, pixelRatio: 2 });
  const b = createOrb(second.canvas, { state: 'connecting', size: 640, color: '#6af', dark: false });
  assert.equal(first.canvas.width, 320);
  assert.equal(first.canvas.style.width, '160px');
  const target = a.draw(2);
  assert.deepEqual(first.calls[1], ['setTransform', 5, 0, 0, 5, 0, 0]);
  b.draw(9);
  assert.deepEqual(a.draw(2), target);
  assert.throws(() => createOrb(first.canvas), /already has an active orb/);
  assert.ok(Object.isFrozen(a.options));
  a.dispose();
  a.dispose();
  assert.equal(first.canvas.width, 300);
  assert.equal(first.canvas.height, 150);
  assert.equal(first.canvas.style.width, '30px');
  assert.throws(() => a.draw(0), /disposed/);
  assert.throws(() => a.frame(0), /disposed/);
  assert.doesNotThrow(() => b.draw(0));
  const replacement = createOrb(first.canvas, { state: 'shaping' });
  replacement.draw(0);
  replacement.dispose();
  b.dispose();
});

test('invalid configuration fails before allocating the Canvas', () => {
  const cases = [
    null, [], { state: 'missing' }, { state: null }, { size: 0 }, { size: Infinity },
    { size: 4096, pixelRatio: 4 }, { size: 1, pixelRatio: 0.25 }, { pixelRatio: 0 },
    { presetSize: 80 }, { speed: -1 }, { speed: NaN }, { dark: 'true' },
    { color: 'red' }, { color: '#ff' }, { color: 'rgb(256,0,0)' }, { color: null },
    { color: 'rgba(1,2,3,0.5)' }, { unsupported: 1 },
  ];
  for (const options of cases) {
    const { canvas } = fakeCanvas();
    assert.throws(() => createOrb(canvas, options));
    assert.equal(canvas.width, 300, 'invalid configuration leaves the canvas untouched');
  }
  for (const seconds of [-1, Infinity, NaN, '1', Number.MAX_VALUE]) {
    assert.throws(() => sampleOrb({}, seconds), /time|seconds/);
  }
  assert.doesNotThrow(() => sampleOrb({ color: 'rgb(12, 34.5, 56)' }, 0));
});

test('vendored runtime is unchanged, local-only and free from React or an autonomous clock', async () => {
  const provenance = JSON.parse(await readFile(new URL('./vendor/INTEGRITY.json', import.meta.url), 'utf8'));
  for (const [file, metadata] of Object.entries(provenance.files)) {
    const bytes = await readFile(new URL(`./vendor/${file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256, file);
  }
  const engine = await readFile(new URL('./vendor/engine.es.js', import.meta.url), 'utf8');
  const chunk = await readFile(new URL('./vendor/index-B8WsUNf5.js', import.meta.url), 'utf8');
  assert.deepEqual([...engine.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]), ['./index-B8WsUNf5.js']);
  assert.doesNotMatch(chunk, /\bimport\s|\brequire\s*\(|requestAnimationFrame|performance\.now|Date\.now|Math\.random/);
  const adapter = await readFile(new URL('./orb.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(adapter, /requestAnimationFrame|performance\.now|Date\.now|setInterval|setTimeout/);
});
