// Supplement the native renderer measurements with content and overlap checks.
// This module consumes JSON only; it neither opens a browser nor changes a film.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AUDIT_VERSION = 'content-and-overlap-v1';
const compact = value => String(value ?? '').normalize('NFC').replace(/\*/g, '').replace(/\s/gu, '');
const readable = text => text && (text.opacity === undefined || text.opacity >= .1);
const finiteBox = box => box && ['left', 'top', 'right', 'bottom'].every(key => Number.isFinite(box[key])) && box.right > box.left && box.bottom > box.top;

function expectedFields(kind, data) {
  const expected = [];
  const add = (field, text, source = 'dom') => { if (compact(text)) expected.push({ field, text: String(text), source }); };
  switch (kind) {
    case 'title': add('text', data.text); add('sub', data.sub); break;
    case 'stack': data.words?.forEach((text, i) => add(`words[${i}]`, text)); break;
    case 'chart':
      add('title', data.title);
      data.labels?.forEach((text, i) => add(`labels.${i}`, text));
      data.values?.forEach((value, i) => add(`values.${i}`, `${value}${data.suffix ?? ''}`));
      break;
    case 'controls':
      add('title', data.title);
      data.toggles?.forEach((text, i) => add(`toggles.${i}`, text));
      add('slider', data.slider);
      break;
    case 'phone3d': add('caption', data.caption); add('appName', data.appName, 'canvas'); break;
    default: return null;
  }
  return expected;
}

function domField(instance, text) {
  if (text.field) return text.field;
  // The phone caption is one DOM text node which may have several line rects.
  if (instance.kind === 'phone3d' && compact(text.text) === compact(instance.data?.caption)) return 'caption';
  return text.group ? `group:${text.group}` : null;
}

function visibleCanvas(instance) {
  return (instance.canvas ?? []).filter(text => text.visible === true && !text.intentionalClip &&
    finiteBox({ left: text.x, top: text.y, right: text.x + text.width, bottom: text.y + text.height }));
}

function contentMatches(expected, rows) {
  const target = compact(expected);
  // A wrapped DOM text node repeats its complete text in each measured rect.
  // Titles instead supply individual glyphs; whitespace-only nodes are omitted
  // by the native inspector, so compare their ordered non-whitespace sequence.
  const fragments = rows.map(row => compact(row.text));
  return fragments.every(fragment => fragment === target) || fragments.join('') === target;
}

function boxesFor(instance) {
  const boxes = [];
  for (const text of (instance.texts ?? []).filter(readable)) {
    const field = domField(instance, text);
    if (field && finiteBox(text.ink)) boxes.push({ field, text: text.text, ...text.ink });
  }
  for (const text of visibleCanvas(instance)) {
    const box = { left: text.x, top: text.y, right: text.x + text.width, bottom: text.y + text.height };
    const field = String(text.key ?? '').split(/[:.\[]/)[0];
    if (field && finiteBox(box)) boxes.push({ field, text: text.text, ...box });
  }
  return boxes;
}

/** Return supplemental faults without mutating the native result. */
export function auditResult(result) {
  const faults = [];
  const fault = details => faults.push({ audit: AUDIT_VERSION, ...details });
  if (!Array.isArray(result?.samples) || !result.samples.length) {
    fault({ reason: 'audit:no-samples' });
    return faults;
  }
  const instances = new Map();
  for (const sample of result.samples) for (const instance of sample.instances ?? []) {
    if (!instances.has(instance.id)) instances.set(instance.id, []);
    instances.get(instance.id).push({ sample, instance });
  }
  if (!instances.size) fault({ reason: 'audit:no-instances' });
  for (const [id, history] of instances) {
    // Completed/hidden hosts can remain in the registry. In particular the
    // first overlapping instance must be checked before its own end, rather
    // than at the last global sample where only the second instance is active.
    const active = history.filter(({ instance }) => Number.isFinite(instance.duration) && instance.duration > 0 &&
      Number.isFinite(instance.time) && instance.time > 0 && instance.time < instance.duration - 1e-7);
    const last = active.sort((a, b) => a.instance.time - b.instance.time || a.sample.time - b.sample.time).at(-1);
    if (!last) { fault({ reason: 'audit:no-active-sample', instance: id }); continue; }
    const { sample, instance } = last;
    const place = { time: sample.time, localTime: instance.time, instance: id };
    if (instance.time < instance.duration * .6) {
      fault({ ...place, reason: 'audit:no-settled-sample' });
      continue;
    }
    if (!instance.data || typeof instance.data !== 'object' || Array.isArray(instance.data)) {
      fault({ ...place, reason: 'audit:missing-content-contract' });
      continue;
    }
    const expected = expectedFields(instance.kind, instance.data);
    if (!expected) { fault({ ...place, reason: 'audit:unknown-component', kind: instance.kind }); continue; }
    if (!expected.length) { fault({ ...place, reason: 'audit:empty-content-contract' }); continue; }
    const dom = (instance.texts ?? []).filter(text => readable(text) && finiteBox(text.ink));
    const canvas = visibleCanvas(instance);
    if (!dom.length && !canvas.length) fault({ ...place, reason: 'audit:empty-active-instance' });
    for (const field of expected) {
      const rows = field.source === 'canvas'
        ? canvas.filter(text => String(text.key ?? '').split(/[:.\[]/)[0] === field.field)
        : dom.filter(text => domField(instance, text) === field.field);
      if (!rows.length || !contentMatches(field.text, rows)) fault({ ...place, reason: 'audit:content',
        field: field.field, source: field.source, expected: field.text, actual: rows.map(row => row.text) });
    }
    const boxes = boxesFor(instance), reported = new Set();
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.field === b.field) continue; // Intentional kerning and glyph overlap.
      const pair = [a.field, b.field].sort().join('\0');
      if (reported.has(pair)) continue;
      const overlap = { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top),
        right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) };
      // One device pixel covers antialiasing/measurement rounding. Dim stack
      // lines still count: opacity is not permission to overlap other words.
      if (overlap.right - overlap.left > 1 && overlap.bottom - overlap.top > 1) {
        reported.add(pair);
        fault({ ...place, reason: 'audit:overlap', fields: [a.field, b.field], texts: [a.text, b.text], overlap });
      }
    }
  }
  return faults;
}

export function auditDirectory(directory) {
  const files = fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort();
  if (!files.length) throw new Error(`No native result JSON files found in ${directory}`);
  const summaries = [];
  for (const name of files) {
    const file = path.join(directory, name), result = JSON.parse(fs.readFileSync(file, 'utf8'));
    const supplemental = auditResult(result);
    result.faults = [...(result.faults ?? []).filter(item => item.audit !== AUDIT_VERSION), ...supplemental];
    result.supplementalAudit = { version: AUDIT_VERSION, passed: supplemental.length === 0, faults: supplemental.length };
    result.passed = result.renderReady === true && !result.error && !(result.errors ?? []).length &&
      !(result.externalRequests ?? []).length && !result.faults.length;
    fs.writeFileSync(file, JSON.stringify(result, null, 2));
    summaries.push({ id: result.id ?? name, passed: result.passed, supplementalFaults: supplemental.length });
  }
  return summaries;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node audit.mjs <native-results-directory>');
    const summaries = auditDirectory(path.resolve(process.argv[2]));
    for (const summary of summaries) console.log(JSON.stringify(summary));
    process.exitCode = summaries.every(result => result.passed) ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
