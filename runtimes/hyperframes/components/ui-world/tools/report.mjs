import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FORMATS = [
  { id: '16x9', label: 'Landscape', ratio: '16:9', width: 1920, height: 1080 },
  { id: '1x1', label: 'Square', ratio: '1:1', width: 1080, height: 1080 },
  { id: '9x16', label: 'Portrait', ratio: '9:16', width: 1080, height: 1920 },
];
const REFERENCE = 'https://www.motionfab.app/en/prompts/looping-ui-ball-ride-through-an-app-interface';

/** Build a movable, offline gallery beside the three completed native renders. */
export function buildGallery(directory) {
  const output = path.resolve(directory);
  const media = FORMATS.map(format => {
    const file = `ui-world-${format.id}.mp4`, absolute = path.join(output, file);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).size) throw new Error(`Render is not ready: ${absolute}`);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', absolute], { encoding: 'utf8' }));
    const video = probe.streams.find(stream => stream.codec_type === 'video');
    const duration = Number(video?.duration ?? probe.format.duration);
    const [numerator, denominator] = String(video?.avg_frame_rate ?? '0/1').split('/').map(Number);
    const fps = numerator / denominator;
    if (video?.width !== format.width || video?.height !== format.height || Math.abs(duration - 6) > .05 || Math.abs(fps - 60) > .01) {
      throw new Error(`${file}: expected ${format.width}×${format.height}, 6 seconds and 60 fps`);
    }
    const poster = `qa/${format.id}-0.5.png`;
    return { ...format, file, duration, fps, hasAudio: probe.streams.some(stream => stream.codec_type === 'audio'),
      poster: fs.existsSync(path.join(output, poster)) ? poster : undefined };
  });
  const cards = media.map((item, index) => `<article class="preview">
    <header class="preview-header"><div><span class="format">${item.ratio}</span><h2>${item.label}</h2></div><span class="audio-tag">${index ? 'MUTED' : 'SOUND ON'}</span></header>
    <div class="video-frame"><video id="video-${item.id}" data-format="${item.id}" controls playsinline preload="auto"${index ? ' muted' : ''}${item.poster ? ` poster="${item.poster}"` : ''} aria-label="${item.label} prototype, ${item.ratio}"><source src="${item.file}" type="video/mp4"></video></div>
    <footer class="preview-footer"><span>${item.width} × ${item.height}</span><a href="${item.file}">Open video <span aria-hidden="true">↗</span></a></footer>
  </article>`).join('\n');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UI World — Three-format prototype</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%230D0B1E'/%3E%3Ccircle cx='16' cy='16' r='8' fill='%23FB2D89'/%3E%3C/svg%3E">
<style>
:root{color-scheme:dark;--bg:#090812;--panel:#100e1b;--line:#ffffff13;--text:#f8f7fc;--muted:#a19caf;--pink:#fb2d89}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,a,input{-webkit-tap-highlight-color:transparent}button,input{font:inherit}button,a{touch-action:manipulation}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--pink);outline-offset:5px}main{max-width:1480px;margin:auto;padding:38px 34px 32px}.eyebrow{display:flex;align-items:center;gap:9px;color:var(--muted);font-size:11px;font-weight:650;letter-spacing:.18em;text-transform:uppercase}.dot{width:7px;height:7px;border-radius:50%;background:var(--pink);display:inline-block}.top{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin:18px 0 28px}h1{font-size:clamp(28px,3.2vw,44px);font-weight:570;line-height:1.08;letter-spacing:-.055em;margin:0 0 12px}.intro{color:var(--muted);margin:0;font-size:14px}.top-meta{color:var(--muted);font-size:12px;text-align:right;white-space:nowrap;padding-bottom:3px}.top-meta strong{font-weight:500;color:#dbd7e6;display:block;margin-bottom:3px}.transport{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:15px 17px;border:1px solid var(--line);background:var(--panel);border-radius:15px}.buttons{display:flex;gap:8px;align-items:center}.button{display:inline-flex;align-items:center;justify-content:center;gap:9px;background:transparent;color:#dad7e4;border:1px solid #ffffff19;border-radius:9px;height:39px;padding:0 16px;font-size:13px;font-weight:580;transition:background .15s}.button:hover{background:#ffffff0b}.button.primary{background:var(--text);color:#151221;border-color:var(--text);min-width:117px}.button.primary:hover{background:#e7e2f0}.button:disabled{opacity:.4;cursor:wait}.button svg{width:13px;height:13px;fill:currentColor}.transport-note{display:flex;align-items:center;gap:16px;font-size:12px;color:var(--muted)}#status{color:#d7d2e3}.timeline{padding:18px 3px 21px}.time-row{display:flex;align-items:center;gap:18px}#scrub{flex:1;min-width:0;height:5px;accent-color:var(--pink);cursor:pointer;margin:0}#time{font-variant-numeric:tabular-nums;color:#c1bbd0;font-size:12px;width:86px;text-align:right}.events{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.event{border:1px solid var(--line);border-radius:6px;background:transparent;color:var(--muted);padding:5px 9px;font-size:11px}.event span{font-variant-numeric:tabular-nums;color:#ded8ed;margin-right:6px}.event:hover,.event.reached{border-color:#fb2d8940;background:#fb2d8909;color:#ead9e3}.gallery{display:grid;grid-template-columns:1.5fr 1fr .72fr;gap:16px;align-items:stretch}.preview{border:1px solid var(--line);border-radius:17px;overflow:hidden;background:var(--panel);min-width:0}.preview-header{display:flex;justify-content:space-between;align-items:center;padding:17px 18px 15px;gap:12px}.preview-header>div{display:flex;align-items:center;gap:10px}.format{font-size:11px;color:var(--muted);border:1px solid #ffffff19;padding:2px 6px;border-radius:5px;white-space:nowrap}h2{font-size:14px;font-weight:560;margin:0;letter-spacing:-.015em}.audio-tag{font-size:8px;color:#948b9f;letter-spacing:.09em;white-space:nowrap}.preview:first-child .audio-tag{color:#f78fbc}.video-frame{height:390px;background:#0d0b1e;border-top:1px solid #ffffff06;border-bottom:1px solid #ffffff06}.video-frame video{display:block;width:100%;height:100%;object-fit:contain;background:#0d0b1e}.preview-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}.preview-footer a{color:#ded8e9;text-decoration:none;white-space:nowrap}.preview-footer a:hover{text-decoration:underline}.architecture{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:25px;padding-top:22px;border-top:1px solid var(--line)}.architecture h3{font-size:12px;font-weight:650;color:#e5dfed;margin:0 0 5px}.architecture p{font-size:12px;color:var(--muted);margin:0;max-width:350px}.bottom{display:flex;justify-content:space-between;gap:20px;margin-top:24px;color:#756d85;font-size:11px}.bottom a{color:#a9a0b9;text-decoration:none}.bottom a:hover{color:var(--text)}#error{background:#3c1729;border:1px solid #f96da64d;color:#ffe4ef;padding:14px;border-radius:10px;margin:0 0 18px;font-size:13px}#error[hidden]{display:none}
@media(min-width:1500px){.video-frame{height:430px}}@media(max-width:1000px){main{padding:28px 22px}.gallery{grid-template-columns:1.35fr 1fr}.preview:last-child{grid-column:1/-1}.preview:last-child .video-frame{height:460px}.video-frame{height:310px}.top-meta{display:none}.architecture{gap:20px}}@media(max-width:640px){main{padding:25px 16px}.top{margin:17px 0 22px}h1{font-size:32px}.intro{font-size:13px}.transport{align-items:flex-start;flex-direction:column;gap:11px;padding:13px}.buttons{width:100%;gap:7px}.button{flex:1;padding:0 11px}.transport-note{width:100%;justify-content:space-between;font-size:11px}.gallery{grid-template-columns:1fr;gap:14px}.preview:last-child{grid-column:auto}.video-frame{height:auto;aspect-ratio:16/9}.preview:nth-child(2) .video-frame{aspect-ratio:1}.preview:last-child .video-frame{height:min(115vw,540px);aspect-ratio:auto}.architecture{grid-template-columns:1fr;gap:17px}.architecture p{max-width:none}.bottom{flex-direction:column;gap:9px}.audio-tag{font-size:9px}}
</style></head><body><main>
<div class="eyebrow"><span class="dot"></span> Motion Fab · UI World · Prototype 01</div>
<div class="top"><div><h1>One ball. One continuous world.</h1><p class="intro">A switch becomes a slider. The same interaction, composed for three screens.</p></div><div class="top-meta"><strong>Native HyperFrames renders</strong>6 seconds · 60 fps · local playback</div></div>
<div id="error" role="alert" hidden></div>
<section class="transport" aria-label="Synchronized playback"><div class="buttons">
<button class="button primary" id="play" disabled><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2 14 8 4 14Z"/></svg>Play all</button>
<button class="button" id="pause" disabled><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h4v12H3zm6 0h4v12H9z"/></svg>Pause</button>
<button class="button" id="restart" disabled><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.7V1H2v5.5h5.5V5H4.7A4.5 4.5 0 1 1 3.6 10H2a6 6 0 1 0 1.5-6.3Z"/></svg>Restart</button>
</div><div class="transport-note"><span id="status" aria-live="polite">Loading videos…</span><span>Sound: 16:9 only</span></div></section>
<section class="timeline" aria-label="Interaction timeline"><div class="time-row"><input id="scrub" type="range" min="0" max="6" step="0.001" value="0" aria-label="Seek all videos" disabled><output id="time">0.00 / 6.00s</output></div><div class="events">
<button class="event" data-time="0.5"><span>0.5s</span>Toggle</button><button class="event" data-time="1"><span>1.0s</span>Jump</button><button class="event" data-time="1.5"><span>1.5s</span>Land</button><button class="event" data-time="4.5"><span>4.5s</span>Complete</button>
</div></section>
<section class="gallery" aria-label="Video formats">${cards}</section>
<section class="architecture" aria-label="Prototype architecture"><div><h3>Shared world</h3><p>Switch and slider keep their anchors. One camera reframes the world for each format.</p></div><div><h3>One actor</h3><p>The same ball belongs to the switch, flies freely, then becomes the slider handle.</p></div><div><h3>One event schedule</h3><p>Toggle, jump, landing and value crossings drive the motion and synchronized sound.</p></div></section>
<footer class="bottom"><span>Offline gallery · Full frames preserved · Native controls on every video</span><a href="${REFERENCE}" target="_blank" rel="noopener noreferrer">View the original reference recipe ↗</a></footer>
</main><script>
const media = ${JSON.stringify(media).replaceAll('<', '\\u003c')};
const videos = media.map(function(item){ return document.getElementById('video-' + item.id); });
const master = videos[0], status = document.getElementById('status'), scrub = document.getElementById('scrub'), time = document.getElementById('time');
const playButton = document.getElementById('play'), pauseButton = document.getElementById('pause'), restartButton = document.getElementById('restart');
let synchronized = false, operation = 0, ready = false;
function soundOwner(){ videos.forEach(function(video,index){ video.muted = index !== 0; }); }
videos.slice(1).forEach(function(video){ video.addEventListener('volumechange', function(){ if (!video.muted) video.muted = true; }); });
function updateClock(){
  const value = Math.min(6, Math.max(0, master.currentTime || 0));
  scrub.value = value; time.textContent = value.toFixed(2) + ' / 6.00s';
  document.querySelectorAll('.event').forEach(function(button){ button.classList.toggle('reached', value >= Number(button.dataset.time)); });
  document.body.dataset.synchronized = String(synchronized);
}
function stop(label){
  operation++; synchronized = false; videos.forEach(function(video){ video.pause(); });
  status.textContent = label || 'Paused'; updateClock();
}
function seekVideo(video, target){
  return new Promise(function(resolve,reject){
    if (!video.seeking && Math.abs(video.currentTime-target) < .001) { resolve(); return; }
    function done(){ cleanup(); resolve(); }
    function failed(){ cleanup(); reject(new Error('Unable to seek a local video.')); }
    function cleanup(){ video.removeEventListener('seeked',done); video.removeEventListener('error',failed); }
    video.addEventListener('seeked',done); video.addEventListener('error',failed); video.currentTime = target;
  });
}
function showError(error){ document.getElementById('error').hidden = false; document.getElementById('error').textContent = error.message || String(error); status.textContent = 'Playback unavailable'; }
async function seekAll(target){
  stop('Paused at ' + target.toFixed(2) + 's'); const token = operation;
  try { await Promise.all(videos.map(function(video){ return seekVideo(video,target); })); if (token === operation) updateClock(); } catch(error){ if (token === operation) showError(error); }
}
async function playAll(restart){
  if (!ready) return;
  const target = restart || master.ended || master.currentTime >= 5.99 ? 0 : master.currentTime;
  stop('Synchronizing…'); const token = operation; soundOwner();
  try {
    await Promise.all(videos.map(function(video){ return seekVideo(video,target); }));
    if (token !== operation) return;
    synchronized = true; await Promise.all(videos.map(function(video){ return video.play(); }));
    if (token === operation) status.textContent = 'Playing together';
  } catch(error){ if (token !== operation) return; stop('Paused'); showError(error); }
}
playButton.addEventListener('click',function(){ playAll(false); });
pauseButton.addEventListener('click',function(){ stop('Paused'); });
restartButton.addEventListener('click',function(){ playAll(true); });
scrub.addEventListener('input',function(){ seekAll(Number(scrub.value)); });
document.querySelectorAll('.event').forEach(function(button){ button.addEventListener('click',function(){ if(ready) seekAll(Number(button.dataset.time)); }); });
master.addEventListener('ended',function(){ stop('Complete · replay any time'); });
videos.forEach(function(video){ video.addEventListener('pause',function(){ if (synchronized && !video.ended) stop('Paused'); }); });
master.addEventListener('timeupdate',updateClock);
function frame(){
  if (synchronized && !master.paused && !master.ended) videos.slice(1).forEach(function(video){
    if (!video.seeking && Math.abs(video.currentTime-master.currentTime) > .075) video.currentTime = master.currentTime;
  });
  updateClock(); requestAnimationFrame(frame);
}
soundOwner();
Promise.all(videos.map(function(video,index){ return new Promise(function(resolve,reject){
  function loaded(){
    const expected = media[index];
    if (video.videoWidth !== expected.width || video.videoHeight !== expected.height || Math.abs(video.duration-6) > .05) { reject(new Error(expected.file + ': unexpected video dimensions or duration.')); return; }
    resolve();
  }
  if (video.readyState >= 1) loaded(); else video.addEventListener('loadedmetadata',loaded,{once:true});
  video.addEventListener('error',function(){ reject(new Error('Could not load ' + media[index].file + '. Keep gallery.html beside the three MP4 files.')); },{once:true});
}); })).then(function(){ ready = true; [playButton,pauseButton,restartButton,scrub].forEach(function(element){ element.disabled = false; }); status.textContent = 'Ready'; }).catch(showError);
requestAnimationFrame(frame);
window.__gallery = {media:media,get synchronized(){return synchronized;},get ready(){return ready;}};
</script></body></html>`;
  fs.writeFileSync(path.join(output, 'gallery.html'), html);
  fs.writeFileSync(path.join(output, 'gallery-metadata.json'), JSON.stringify({ reference: REFERENCE, media }, null, 2));
  return { gallery: path.join(output, 'gallery.html'), media };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Usage: node report.mjs <render-output-directory>');
  console.log(JSON.stringify(buildGallery(process.argv[2])));
}
