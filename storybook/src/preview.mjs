import compiler from './compiler.mjs';
import {mountScene} from './lib/components/runtime.mjs';

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
  };
  const sample = background && SAMPLES[background.image ?? background.video];
  if (sample && !options.assetUrls) options.assetUrls = {[background.image ?? background.video]: sample};
  // A scene's own sample video (the laptop's screen) comes from there too.
  if (SAMPLES[ps.scene.video]) options.assetUrls = {...options.assetUrls, [ps.scene.video]: SAMPLES[ps.scene.video]};
  const ready = mountScene(root, {id: 'main', plan, ps, clipStart: 0, clipDuration: plan.duration, options}, {}, window.gsap).then(({timeline, instance}) => {
    window.__timelines.main = timeline;
    window.__storybookComponent = {instance, plan, film};
    window.dispatchEvent(new Event('pk-preview-mounted'));
    window.addEventListener('pagehide', () => instance.dispose(), {once: true});
  });
  window.__hf.buildReady.pk = ready;
  const runtime = document.createElement('script'); runtime.src = './hyperframe.runtime.iife.js'; runtime.onerror = () => fail(new Error('HyperFrames runtime failed to load.')); document.head.append(runtime);
  await ready;
} catch (error) { fail(error); }
