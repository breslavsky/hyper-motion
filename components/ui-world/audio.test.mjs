import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import crypto from 'node:crypto';
import { buildAudio } from './audio.mjs';
import { compile } from './model.mjs';

async function workspace(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-world-audio-test-'));
  try { return await run(directory); } finally { await fs.rm(directory, { recursive: true, force: true }); }
}

test('all three formats produce the same 13 sample-accurate audio events', async () => workspace(async (destination) => {
  const builds = [];
  for (const aspect of ['16:9', '1:1', '9:16']) {
    const plan = compile({ aspect });
    const result = await buildAudio({ destination: path.join(destination, aspect.replace(':', 'x')), events: plan.events });
    assert.equal(result.clips.length, 13);
    assert.equal(result.assets.length, 5);
    for (const clip of result.clips) {
      const event = plan.events.find((candidate) => candidate.id === clip.eventId);
      assert.equal(clip.start, event.time);
      assert.ok(clip.start + clip.duration <= 6);
      assert.ok(!path.isAbsolute(clip.src));
    }
    builds.push(result);
  }
  assert.deepEqual(builds[0], builds[1]);
  assert.deepEqual(builds[0], builds[2]);
}));

test('bundled PCM has no clipped samples, starts within 1ms and fades to zero', async () => workspace(async (destination) => {
  const result = await buildAudio({ destination, events: compile().events });
  for (const asset of result.assets) {
    const bytes = await fs.readFile(path.join(destination, asset.src));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.readUInt16LE(22), 1);
    assert.equal(bytes.readUInt32LE(24), 48000);
    assert.equal(bytes.readUInt16LE(34), 16);
    assert.equal(bytes.readInt16LE(44), 0);
    assert.equal(bytes.readInt16LE(bytes.length - 2), 0);
    const samples = Array.from({ length: (bytes.length - 44) / 2 }, (_, i) => bytes.readInt16LE(44 + i * 2) / 32768);
    const peak = Math.max(...samples.map(Math.abs));
    const onset = samples.findIndex((value) => Math.abs(value) >= peak * 0.01) / 48000;
    assert.ok(peak <= 10 ** (-3 / 20) + 1 / 32768);
    assert.ok(onset <= 0.001, `${asset.id}: late onset ${onset}`);
    assert.equal(asset.duration, samples.length / 48000);
  }
}));

test('component mute and gain change only their own event clips', async () => workspace(async (destination) => {
  const events = compile().events;
  const muted = await buildAudio({ destination, events, kit: { targets: { slider: { mute: true } } } });
  assert.deepEqual(muted.clips.map((clip) => clip.eventId), ['toggle-on', 'ball-detach']);
  const reduced = await buildAudio({ destination, events, kit: { gain: 0.5, targets: { switch: { gain: 0.5 } } } });
  assert.equal(reduced.clips.find((clip) => clip.kind === 'switch.on').gain, 0.32 * 0.5 * 0.5);
  assert.equal(reduced.clips.find((clip) => clip.kind === 'actor.land').gain, 0.5 * 0.5);
  const silent = await buildAudio({ destination, events, kit: { mute: true } });
  assert.equal(silent.clips.length, 0);
  assert.equal(silent.mutedEvents.length, 13);
}));

test('semantic remapping preserves event time and supports target-specific overrides', async () => workspace(async (destination) => {
  const events = compile().events;
  const result = await buildAudio({ destination, events, kit: {
    mapping: { 'switch.on': { sound: 'wood', gain: 0.25 }, 'slider.tick': false },
    targets: { slider: { mapping: { 'slider.complete': 'pop' } } },
  } });
  assert.equal(result.clips.length, 4);
  assert.deepEqual(result.clips.find((clip) => clip.kind === 'switch.on'), {
    id: 'sfx-toggle-on', src: 'assets/ui-world-audio/wood.wav', start: 0.5,
    duration: result.assets.find((asset) => asset.id === 'wood').duration,
    gain: 0.25, eventId: 'toggle-on', kind: 'switch.on', target: 'switch', sound: 'wood',
  });
  assert.equal(result.clips.find((clip) => clip.kind === 'slider.complete').sound, 'pop');
}));

test('malformed events, unsafe files and tails outside the recipe fail before placement', async () => workspace(async (destination) => {
  const event = compile().events[0];
  for (const events of [[event, event], [{ ...event, time: NaN }], [{ ...event, time: 7 }],
    [{ ...event, kind: 'unknown' }], [{ ...event, id: '../escape' }]]) {
    await assert.rejects(buildAudio({ destination, events }));
  }
  await assert.rejects(buildAudio({ destination, events: [event], kit: { mapping: { 'switch.on': '../outside.wav' } } }), /sound/);
  await assert.rejects(buildAudio({ destination, events: [event], kit: { gain: 2 } }), /gain/);
  await assert.rejects(buildAudio({ destination, events: [{ ...event, time: 5.9 }], kit: { mapping: { 'switch.on': 'ding' } } }), /tail/);
}));
