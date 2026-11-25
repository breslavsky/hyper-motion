// The clips of the Storybook's first page (src/landing.mjs): one scene of each
// kind, rendered by HyperFrames to a small silent mp4 that loops. The page
// plays these instead of four live scenes, which is more than a page can
// carry. Run by hand after a scene shown there changes, then put the files on
// our public CDN (components/landing/):
//   node storybook/scripts/landing-clips.mjs <folder to write into> [id ...]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), kit = path.resolve(here, '../../kit');
const require = createRequire(import.meta.url);
const definitions = require(path.join(kit, 'source/lib/components/metadata.cjs'));
const out = path.resolve(process.argv[2] ?? 'landing-clips');
const FOOTAGE = 'https://motion-fab-share.b-cdn.net/components/glass/talking-head.mp4';
// What each card shows (src/landing.mjs KINDS): the scene's own sample, and for a B-Roll the footage under it.
const CLIPS = [
  {id: 'glass', scene: definitions['glass-search'].sample},
  {id: '3d', scene: definitions.synth3d.sample},
  // A clip that changes takes a new name: the CDN keeps what it has already served.
  {id: 'flat-2', scene: definitions.ride.sample},
  {id: 'b-rolls', footage: true, scene: {...definitions['glass-message'].sample, over: true, background: {clip: 'footage'}, place: 'bottom', size: 'small'}},
];
const W = 1920, H = 1080;
fs.mkdirSync(out, {recursive: true});
const only = process.argv.slice(3);
for (const clip of CLIPS.filter(clip => !only.length || only.includes(clip.id))) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-landing-'));
  const run = (file, args, options = {}) => execFileSync(file, args, {cwd: project, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...options});
  try {
    fs.cpSync(path.join(kit, 'source/lib'), path.join(project, 'kit'), {recursive: true, dereference: true});
    const footage = clip.footage ? '<video id="footage" class="clip" src="assets/footage.mp4" muted playsinline data-start="0" data-duration="DURATION" data-track-index="0" data-media-start="0"></video>' : '';
    if (clip.footage) { fs.mkdirSync(path.join(project, 'assets')); run('curl', ['-sf', '-o', 'assets/footage.mp4', FOOTAGE]); }
    fs.writeFileSync(path.join(project, 'index.html'), footage);
    const recipe = {id: 'card', aspect: '16:9', style: 'glass', brand: {name: 'Nook'}, start: 0, track: 2, scene: clip.scene};
    const built = JSON.parse(run('node', ['kit/scene.cjs', '-'], {input: JSON.stringify(recipe), stdio: ['pipe', 'pipe', 'pipe']}).toString());
    const seconds = built.duration.toFixed(3);
    fs.writeFileSync(path.join(project, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden;background:#101318}
#root{position:relative;width:${W}px;height:${H}px;overflow:hidden}#footage{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 20%}</style>
${built.head.join('')}<script type="importmap">{"imports":{"three":"./kit/vendor/three/three.module.min.js"}}</script><script src="kit/vendor/gsap/gsap.min.js"></script></head><body>
<div id="root" data-composition-id="main" data-width="${W}" data-height="${H}" data-duration="${seconds}" data-fps="30">
${footage.replace('DURATION', seconds)}
${built.mount}
</div><script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true}).to({},{duration:${seconds}},0);</script></body></html>`);
    run(path.join(kit, 'node_modules/.bin/hyperframes'), ['render', '.', '--output', 'film.mp4']);
    // Half the size, no sound, a rest on the last frame before it begins again, and ready to play before it has all arrived.
    const file = path.join(out, `${clip.id}.mp4`);
    run('ffmpeg', ['-v', 'error', '-y', '-i', 'film.mp4', '-an', '-vf', 'scale=960:540,tpad=stop_mode=clone:stop_duration=0.8', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file]);
    console.log(clip.id, seconds, 's', fs.statSync(file).size, 'bytes');
  } finally { fs.rmSync(project, {recursive: true, force: true}); }
}
