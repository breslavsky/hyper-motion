// Offline developer tool: pin, decode, trim and measure the five local CC0 effects.
// buildAudio only copies the resulting WAVs; it never invokes FFmpeg or a network service.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../../..');
const catalog = JSON.parse(fs.readFileSync(path.join(REPO, 'sounds/catalog.json')));
const sources = JSON.parse(fs.readFileSync(path.join(REPO, 'sounds/sources.json')));
const chosen = { switch: 'toggle-4', pop: 'drop-4', wood: 'impact-wood-medium-1', tick: 'tick-1', ding: 'impact-bell-heavy-0' };
const sampleRate = 48000;
const hash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const db = (level) => level > 0 ? 20 * Math.log10(level) : -120;
const assets = {};

for (const [name, id] of Object.entries(chosen)) {
  const entry = catalog.sounds.find((sound) => sound.id === id);
  const upstream = sources.find((source) => source.id === entry.source);
  if (upstream.license !== 'CC0-1.0') throw new Error(`${id}: expected redistributable CC0 audio`);
  const original = path.join(REPO, 'sounds/files', entry.file);
  const originalBytes = fs.readFileSync(original);
  if (hash(originalBytes) !== entry.sha256) throw new Error(`${id}: local source differs from pinned catalog`);
  const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', original, '-f', 'f32le', '-ac', '1', '-ar', String(sampleRate), 'pipe:1'], { maxBuffer: 8 * 1024 * 1024 });
  if (decoded.status !== 0) throw new Error(decoded.stderr.toString());
  const samples = Array.from({ length: decoded.stdout.length / 4 }, (_, index) => decoded.stdout.readFloatLE(index * 4));
  const originalPeak = Math.max(...samples.map(Math.abs));
  const threshold = originalPeak * 10 ** (-55 / 20);
  const first = samples.findIndex((value) => Math.abs(value) > threshold);
  let last = samples.length - 1;
  while (last > first && Math.abs(samples[last]) <= threshold) last -= 1;
  if (first < 0) throw new Error(`${id}: silent source`);
  const start = Math.max(0, first - Math.round(sampleRate * 0.0005));
  const end = Math.min(samples.length, last + Math.round(sampleRate * 0.004) + 1);
  const trimmed = samples.slice(start, end);
  const fadeIn = Math.min(Math.round(sampleRate * 0.0003), Math.floor(trimmed.length / 8));
  const fadeOut = Math.min(Math.round(sampleRate * 0.004), Math.floor(trimmed.length / 4));
  const normalization = 10 ** (-3 / 20) / originalPeak;
  for (let i = 0; i < trimmed.length; i += 1) {
    const envelope = Math.min(1, i / Math.max(1, fadeIn), (trimmed.length - 1 - i) / Math.max(1, fadeOut));
    trimmed[i] *= normalization * Math.max(0, envelope);
  }
  const rampedPeak = Math.max(...trimmed.map(Math.abs));
  const finalNormalization = 10 ** (-3 / 20) / rampedPeak;
  for (let i = 0; i < trimmed.length; i += 1) trimmed[i] *= finalNormalization;
  const wav = Buffer.alloc(44 + trimmed.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(trimmed.length * 2, 40);
  for (let i = 0; i < trimmed.length; i += 1) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, trimmed[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(path.join(HERE, `${name}.wav`), wav);
  const pcm = trimmed.map((_, index) => wav.readInt16LE(44 + index * 2) / 32768);
  const peak = Math.max(...pcm.map(Math.abs));
  const onsetFrame = pcm.findIndex((value) => Math.abs(value) >= peak * 0.01);
  assets[name] = {
    file: `${name}.wav`, sha256: hash(wav), bytes: wav.length,
    sampleRate, channels: 1, frames: pcm.length, duration: pcm.length / sampleRate,
    onsetSeconds: onsetFrame / sampleRate, peakDbFS: db(peak),
    rmsDbFS: db(Math.sqrt(pcm.reduce((sum, value) => sum + value * value, 0) / pcm.length)),
    source: { id, file: entry.file, sha256: entry.sha256, library: upstream.name, url: upstream.page,
      version: '1.0', archiveSha256: upstream.sha256, license: upstream.license, licenseUrl: upstream.licenseUrl },
    processing: { format: 'mono PCM16 WAV, 48000 Hz', trimStartSeconds: start / sampleRate,
      trimEndSeconds: (samples.length - end) / sampleRate, silenceThresholdDb: -55,
      peakTargetDbFS: -3, fadeInSeconds: fadeIn / sampleRate, fadeOutSeconds: fadeOut / sampleRate },
  };
}
fs.writeFileSync(path.join(HERE, 'catalog.json'), `${JSON.stringify({ version: 1, assets }, null, 2)}\n`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(assets).map(([name, a]) => [name, { duration: a.duration, onsetSeconds: a.onsetSeconds, peakDbFS: a.peakDbFS }]))));
