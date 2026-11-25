// A Glass scene over the film's own footage, through a real HyperFrames render.
// The scene looks at the clip under it (`background.clip`): this holds the two
// things that rests on, which are HyperFrames' own and could change with it.
// The footage around the glass is the film's, untouched; and the glass shows
// the clip's frame of that very moment, in a render as on a page (the frame
// HyperFrames decodes for the clip and lays beside its <video>).
// Run by hand: node kit/tools/glass-over-native.mjs [--keep]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), lib = path.resolve(here, '../source/lib');
const hyperframes = path.resolve(here, '../node_modules/.bin/hyperframes');
const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-over-native-'));
const run = (file, args, options = {}) => execFileSync(file, args, {cwd: project, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...options});
const W = 1920, H = 1080, RED = [204, 32, 32], GREEN = [32, 204, 32];
try {
  fs.cpSync(lib, path.join(project, 'kit'), {recursive: true, dereference: true});
  fs.mkdirSync(path.join(project, 'assets'));
  // Footage that says what time it is: red for a second and a half, then green.
  const colour = ([r, g, b]) => `color=c=0x${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}:s=1280x720:r=30:d=1.5`;
  run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', colour(RED), '-f', 'lavfi', '-i', colour(GREEN), '-filter_complex', 'concat=n=2:v=1', '-pix_fmt', 'yuv420p', 'assets/footage.mp4']);
  fs.writeFileSync(path.join(project, 'index.html'), '<video id="footage" class="clip" data-track-index="0"></video>');
  const recipe = {id: 'card', aspect: '16:9', style: 'editorial', material: 'glass', brand: {name: 'Nook'}, start: 0, track: 2,
    scene: {type: 'glass-island', beats: 6, over: true, background: {clip: 'footage'}, camera: 'static', title: 'Over footage', body: 'The glass sees the clip.'}};
  const built = JSON.parse(run('node', ['kit/scene.cjs', '-'], {input: JSON.stringify(recipe), stdio: ['pipe', 'pipe', 'pipe']}).toString());
  fs.writeFileSync(path.join(project, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden;background:#000}
#root{position:relative;width:${W}px;height:${H}px;overflow:hidden}#footage{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}</style>
${built.head.join('')}<script src="kit/vendor/gsap/gsap.min.js"></script></head><body>
<div id="root" data-composition-id="main" data-width="${W}" data-height="${H}" data-duration="3" data-fps="30">
<video id="footage" class="clip" src="assets/footage.mp4" muted playsinline data-start="0" data-duration="3" data-track-index="0" data-media-start="0"></video>
${built.mount}
</div><script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true}).to({},{duration:3},0);</script></body></html>`);
  run(hyperframes, ['render', '.', '--output', 'out.mp4']);
  const frame = at => run('ffmpeg', ['-v', 'error', '-ss', String(at), '-i', 'out.mp4', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  const pixel = (pixels, x, y) => [...pixels.subarray((y * W + x) * 3, (y * W + x) * 3 + 3)];
  // A colour is told by which channel leads: the encoder's colour matrix moves the exact values.
  const leads = (seen, colour, by) => {const lead = colour.indexOf(Math.max(...colour)); return seen.every((v, i) => i === lead ? v > 110 : seen[lead] > v + by);};
  for (const [at, colourOf] of [[1, RED], [2.4, GREEN]]) {
    const pixels = frame(at), corner = pixel(pixels, 60, 60), glass = pixel(pixels, W / 2 + 420, H / 2 + 40);
    // Around the glass the film's footage is seen as it is.
    assert.ok(leads(corner, colourOf, 100), `the footage beside the glass at ${at} s is ${corner}`);
    // In the glass: the clip's frame of this moment, not black, not the other half of the clip.
    assert.ok(leads(glass, colourOf, 50), `the glass at ${at} s shows ${glass}, not the clip's frame of that moment`);
  }
  console.log('glass over footage: the render shows the footage beside the glass and its frame of the moment inside it');
} finally {
  if (process.argv.includes('--keep')) console.log(project); else fs.rmSync(project, {recursive: true, force: true});
}
