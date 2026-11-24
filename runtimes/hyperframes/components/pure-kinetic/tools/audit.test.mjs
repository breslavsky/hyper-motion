import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { auditDirectory, auditResult } from './audit.mjs';

const row = (field, text, x = 0, y = 0, opacity = 1) => ({ field, text, opacity, ink: { left: x, top: y, right: x + 30, bottom: y + 20 } });
const instance = (kind, data, texts = [], extra = {}) => ({ id: 'one', kind, data, texts, canvas: [], time: 3.9, duration: 4, ...extra });
const result = (...instances) => ({ id: 'case', renderReady: true, errors: [], externalRequests: [], faults: [], passed: true,
  samples: [{ time: 3.9, instances }] });
const reasons = value => auditResult(value).map(fault => fault.reason);

test('title glyphs retain repeated letters; intentional same-field overlap is allowed', () => {
  const title = instance('title', { text: 'Meet *Nook*.', sub: 'A calm day' }, [
    row('sub', 'A calm day', 0, 60), ...Array.from('MeetNook.').map((letter, i) => row('text', letter, i * 20)),
  ]);
  assert.deepEqual(auditResult(result(title)), []);
});

test('a surviving subtitle cannot hide a missing headline or incorrect copy', () => {
  const title = instance('title', { text: 'Meet *Nook*.', sub: 'A calm day' }, [row('sub', 'A calm day')]);
  assert.ok(auditResult(result(title)).some(fault => fault.field === 'text' && fault.reason === 'audit:content'));
  title.texts.push(row('text', 'Meet something else.', 0, 60));
  assert.ok(auditResult(result(title)).some(fault => fault.field === 'text'));
});

test('wrapped paragraph rects do not duplicate expected text', () => {
  const data = { title: 'Make it yours', toggles: ['Focus mode', 'Smart reminders'], slider: '' };
  const texts = [row('title', data.title), row('title', data.title, 0, 25), row('toggles.0', 'Focus mode', 0, 60),
    row('toggles.1', 'Smart reminders', 0, 90)];
  assert.deepEqual(auditResult(result(instance('controls', data, texts))), []);
});

test('a correct fragment does not excuse unexpected extra text in the same field', () => {
  const title = instance('title', { text: 'Hello', sub: '' }, [row('text', 'Hello'), row('text', 'wrong', 0, 30)]);
  assert.ok(auditResult(result(title)).some(fault => fault.field === 'text'));
});

test('all indexed chart labels and formatted values must be represented', () => {
  const data = { title: 'Growth', labels: ['Same', 'Same'], values: [0, 12.5], suffix: '%' };
  const texts = [row('title', 'Growth'), row('labels.0', 'Same', 0, 30), row('labels.1', 'Same', 0, 60),
    row('values.0', '0%', 50, 30), row('values.1', '12.5%', 50, 60)];
  assert.deepEqual(auditResult(result(instance('chart', data, texts))), []);
  const missing = texts.filter(text => text.field !== 'labels.1');
  assert.ok(auditResult(result(instance('chart', data, missing))).some(fault => fault.field === 'labels.1'));
});

test('dim stack words remain required and their different fields remain distinct', () => {
  const data = { words: ['Less', 'noise', 'More'] };
  const texts = data.words.map((word, i) => row(`words[${i}]`, word, 0, i * 30, i < 2 ? .26 : 1));
  assert.deepEqual(auditResult(result(instance('stack', data, texts))), []);
  texts[0].opacity = .05;
  assert.ok(auditResult(result(instance('stack', data, texts))).some(fault => fault.field === 'words[0]'));
});

test('phone requires projected app-name text even when its DOM caption survives', () => {
  const phone = instance('phone3d', { caption: 'Your day', appName: 'Мой рабочий день' }, [row(undefined, 'Your day')]);
  assert.ok(auditResult(result(phone)).some(fault => fault.field === 'appName'));
  phone.canvas = ['Мой', 'рабочий', 'день'].map((text, i) => ({ key: `appName:${i}`, text, x: 100, y: i * 30, width: 50, height: 20, visible: true }));
  assert.deepEqual(auditResult(result(phone)), []);
  phone.canvas[1].visible = false;
  assert.ok(auditResult(result(phone)).some(fault => fault.field === 'appName'));
  phone.canvas[1].visible = true; phone.canvas[1].intentionalClip = 'entrance';
  assert.ok(auditResult(result(phone)).some(fault => fault.field === 'appName'));
});

test('different field ink boxes cannot overlap; one-pixel edge rounding is tolerated', () => {
  const phone = instance('phone3d', { caption: 'Your day', appName: 'Nook' }, [row(undefined, 'Your day')], {
    canvas: [{ key: 'appName:0', text: 'Nook', x: 10, y: 0, width: 40, height: 20, visible: true }],
  });
  assert.ok(reasons(result(phone)).includes('audit:overlap'));
  phone.canvas[0].x = 29;
  assert.deepEqual(auditResult(result(phone)), []);
});

test('zero-area DOM and canvas records are not evidence of visible content', () => {
  const title = instance('title', { text: 'Hello' }, [row('text', 'Hello')]);
  title.texts[0].ink.right = 0;
  assert.ok(reasons(result(title)).includes('audit:empty-active-instance'));
  const phone = instance('phone3d', { caption: 'Your day', appName: 'Nook' }, [row(undefined, 'Your day')], {
    canvas: [{ key: 'appName:0', text: 'Nook', x: 100, y: 0, width: 0, height: 20, visible: true }],
  });
  assert.ok(auditResult(result(phone)).some(fault => fault.field === 'appName'));
});

test('each overlapping instance is checked at its own last active sample', () => {
  const make = (id, time, text, visible = true) => instance('stack', { words: [text, 'Done'] },
    visible ? [row('words[0]', text), row('words[1]', 'Done', 0, 30)] : [], { id, time });
  const multi = { samples: [
    { time: 3.5, instances: [make('a', 3.5, 'First'), make('b', 1.5, 'Second')] },
    { time: 5.5, instances: [make('a', 4, 'First', false), make('b', 3.5, 'Second')] },
  ] };
  assert.deepEqual(auditResult(multi), []);
  multi.samples[0].instances[0].texts = [];
  assert.ok(auditResult(multi).some(fault => fault.instance === 'a' && fault.reason === 'audit:empty-active-instance'));
});

test('missing coverage and absent content metadata fail closed', () => {
  assert.ok(reasons({}).includes('audit:no-samples'));
  assert.ok(reasons(result()).includes('audit:no-instances'));
  assert.ok(reasons(result(instance('title', undefined))).includes('audit:missing-content-contract'));
  assert.ok(reasons(result(instance('title', { text: 'Hi' }, [], { time: 0 }))).includes('audit:no-active-sample'));
  assert.ok(reasons(result(instance('title', { text: 'Hi' }, [], { time: .5 }))).includes('audit:no-settled-sample'));
  assert.ok(reasons(result(instance('title', { text: 'Hi' }))).includes('audit:empty-active-instance'));
});

test('directory processing is idempotent and preserves native failures', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-content-audit-'));
  try {
    const file = path.join(directory, 'case.json');
    const value = result(instance('title', { text: 'Missing' }));
    value.faults.push({ reason: 'native failure' });
    fs.writeFileSync(file, JSON.stringify(value));
    assert.equal(auditDirectory(directory)[0].passed, false);
    const once = fs.readFileSync(file, 'utf8');
    assert.equal(auditDirectory(directory)[0].passed, false);
    assert.equal(fs.readFileSync(file, 'utf8'), once);
    assert.ok(JSON.parse(once).faults.some(fault => fault.reason === 'native failure'));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
