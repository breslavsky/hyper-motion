import compiler from './compiler.mjs';
import {mountScene} from './lib/components/runtime.mjs';
import metadata from './lib/components/metadata.mjs';

const root = document.getElementById('root');
function fail(error) {
  const message = String(error?.stack ?? error);
  window.__hfPreviewErrors ??= []; window.__hfPreviewErrors.push(message);
  const node = document.createElement('pre'); node.className = 'preview-error'; node.textContent = message; root.append(node);
  console.error(error);
}
try {
  const film = JSON.parse(decodeURIComponent(location.hash.slice(1)));
  const plan = compiler.compile(film), ps = plan.scenes[0];
  if (plan.scenes.length !== 1 || !Number.isFinite(plan.duration)) throw new Error('Expected one component with a finite duration.');
  for (const node of [document.documentElement, document.body, root]) Object.assign(node.style, {width: `${plan.width}px`, height: `${plan.height}px`});
  Object.assign(root.dataset, {width: plan.width, height: plan.height, duration: plan.duration});
  window.__timelines = {};
  window.__hf ??= {}; window.__hf.buildReady ??= {};
  // The player is displayed smaller than the composition. Keep logical layout
  // and DOM text at full resolution; use a lighter optical buffer in this preview.
  // Exported films never pass this option and retain their native pixel size.
  const options = {previewScale: .5};
  const blob = new URL(location.href).searchParams.get('localBackground');
  const background = ps.scene.background;
  if (blob && background) {
    const url = new URL(blob);
    if (url.protocol !== 'blob:' || url.origin !== location.origin) throw new Error('Invalid local background URL');
    options.assetUrls = {[background.image ?? background.video]:url.href};
  }
  // The sample backgrounds of the picker (glass-background.mjs) are loaded
  // from our public CDN, as everything a component needs beyond its code is.
  const SAMPLES = {
    'assets/glass-bahamas.webp': 'https://motion-fab-share.b-cdn.net/components/glass/bahamas.webp',
    'assets/glass-street.mp4': 'https://motion-fab-share.b-cdn.net/components/glass/street.mp4',
    // The presenter of Talking Head's own demo, without its sound: the footage under the B-Rolls.
    'assets/talking-head.mp4': 'https://motion-fab-share.b-cdn.net/components/glass/talking-head.mp4',
  };
  const sample = background && SAMPLES[background.image ?? background.video];
  if (sample && !options.assetUrls) options.assetUrls = {[background.image ?? background.video]: sample};
  // A scene's own sample video (the laptop's screen) comes from there too.
  if (SAMPLES[ps.scene.video]) options.assetUrls = {...options.assetUrls, [ps.scene.video]: SAMPLES[ps.scene.video]};
  // And a scene's own sample picture.
  if (SAMPLES[ps.scene.image]) options.assetUrls = {...options.assetUrls, [ps.scene.image]: SAMPLES[ps.scene.image]};
  // The scene's own sound cues (a key typed, a button clicked, a panel that
  // opens), played by small free sounds from our public CDN: one <audio> clip
  // a cue, which HyperFrames plays in step with the scene and the player's
  // sound button turns on. In a film these cues go to its soundtrack.
  const SOUNDS = {from: 'https://motion-fab-share.b-cdn.net/components/sounds/', as: {sparkle: 'chime'},
    seconds: {tick: .03, type: .03, click: .12, pop: .3, ping: .3, chime: 2.3, whoosh: .65}, level: {sparkle: .6, chime: .8, whoosh: .7}};
  (plan.cues ?? []).forEach((cue, i) => {
    const name = SOUNDS.as[cue.kind] ?? cue.kind, seconds = SOUNDS.seconds[name], left = plan.duration - cue.t;
    if (!seconds || left < .02) return;
    const clip = Object.assign(document.createElement('audio'), {id: `pk-sound-${i}`, preload: 'auto', src: `${SOUNDS.from}${name}.mp3`});
    Object.assign(clip.dataset, {start: cue.t.toFixed(4), duration: Math.min(seconds, left).toFixed(4), trackIndex: String(40 + i),
      volume: Math.min(1, (cue.strength ?? 1) * (SOUNDS.level[cue.kind] ?? 1)).toFixed(3), previewSound: cue.kind});
    root.append(clip);
  });
  // A scene laid over footage (`over`) has none of its own: the preview plays
  // a sample under it, as the film's clip "footage", in step with the scene.
  let footage = null;
  if (ps.scene.over) {
    const video = Object.assign(document.createElement('video'), {muted: true, loop: true, playsInline: true, crossOrigin: 'anonymous', src: SAMPLES['assets/talking-head.mp4'], id: 'footage'});
    video.dataset.previewFootage = '';
    // It is a tall clip: a wide or square frame keeps the head, not the middle of the picture.
    Object.assign(video.style, {position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%'});
    root.prepend(video);
    await new Promise(resolve => { video.addEventListener('loadeddata', resolve, {once: true}); video.addEventListener('error', resolve, {once: true}); });
    footage = {follow(timeline) {
      let moved = 0;
      timeline.eventCallback('onUpdate', () => {
        moved = performance.now();
        const at = timeline.time() % (video.duration || 1);
        if (Math.abs(video.currentTime - at) > .3) video.currentTime = at;
      });
      const pace = setInterval(() => { if (performance.now() - moved < 160) video.play().catch(() => {}); else video.pause(); }, 120);
      window.addEventListener('pagehide', () => clearInterval(pace), {once: true});
    }};
  }
  // A scene that hands its picture over (`handoff` of its definition: a clip standing in a part of the frame
  // as the scene ends) is shown with what takes it up: the same video as a clip of the film, in that place,
  // from that moment, for a few seconds more. That is the whole of a hand-over, as a film does it.
  const speed = ps.speed ?? 1;
  const handed = metadata[ps.scene.type]?.handoff?.(ps.scene, ps.ldur ?? ps.dur * speed, plan.beat * speed) ?? null;
  const AFTER = 2.5;
  let next = null;
  if (handed?.video) {
    const at = ps.start + handed.at / speed, {x, y, w, h} = handed.to;
    next = Object.assign(document.createElement('video'), {id: 'pk-handed', className: 'clip', muted: true, playsInline: true, crossOrigin: 'anonymous', preload: 'auto',
      src: options.assetUrls?.[handed.video] ?? handed.video});
    Object.assign(next.dataset, {start: at.toFixed(4), duration: AFTER.toFixed(4), trackIndex: '30', mediaStart: at.toFixed(4), volume: '0', previewHanded: ''});
    Object.assign(next.style, {position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, objectFit: 'cover', zIndex: '50'});
    root.append(next);
    root.dataset.duration = String(at + AFTER);
  }
  const ready = mountScene(root, {id: 'main', plan, ps, clipStart: 0, clipDuration: plan.duration, options}, {}, window.gsap).then(({timeline, instance}) => {
    // The film goes on after the scene for as long as the clip that takes its picture up.
    if (next) timeline.to({}, {duration: Number(root.dataset.duration) - timeline.duration()}, timeline.duration());
    window.__timelines.main = timeline;
    footage?.follow(timeline);
    window.__storybookComponent = {instance, plan, film};
    window.dispatchEvent(new Event('pk-preview-mounted'));
    window.addEventListener('pagehide', () => instance.dispose(), {once: true});
  });
  window.__hf.buildReady.pk = ready;
  const runtime = document.createElement('script'); runtime.src = './hyperframe.runtime.iife.js'; runtime.onerror = () => fail(new Error('HyperFrames runtime failed to load.')); document.head.append(runtime);
  await ready;
} catch (error) { fail(error); }
