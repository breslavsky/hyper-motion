import recipe from './recipe.mjs';
import {createSpatialType} from './lib/world.mjs';
import {clamp} from './lib/model.mjs';

export function mergeConfig(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) throw new Error('config override must be an object');
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('invalid config key');
    result[key] = value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])
      ? mergeConfig(result[key], value) : structuredClone(value);
  }
  return result;
}

export async function mount(root, host, variables = {}, gsap = globalThis.gsap) {
  if (!root?.querySelector || root.spatialTypeInstance) throw new Error('A fresh native mount root is required');
  if (!gsap?.timeline) throw new Error('HyperFrames paused timeline service is required');
  const override = typeof variables.config === 'string' ? (variables.config.trim() ? JSON.parse(variables.config) : {}) : variables.config ?? {};
  const config = mergeConfig(recipe, override);
  for (const key of ['duration', 'width', 'height']) if (host[key] != null) config[key] = Number(host[key]);
  const start = Number(host.start ?? 0);
  if (!Number.isFinite(start)) throw new Error('mount start must be finite');
  const canvas = root.querySelector('canvas');
  let api = null, last = 0, disposed = false;
  const ready = createSpatialType(canvas, config).then(world => {
    if (disposed) {world.dispose(); return;}
    api = world; api.seek(last);
  });
  const onSeek = event => {
    const globalTime = Number(event.detail?.time);
    if (!Number.isFinite(globalTime) || disposed) return;
    last = clamp(globalTime - start, 0, config.duration);
    if (api) api.seek(last);
    else event.detail.waitUntil?.(ready.then(() => {if (api && !disposed) api.seek(last);}));
  };
  window.addEventListener('hf-seek', onSeek);
  const timeline = gsap.timeline({paused: true}).to({}, {duration: config.duration}, 0);
  const instance = {config: {...config, start}, canvas, get api() {return api;}, get time() {return last;},
    dispose() {
      if (disposed) return; disposed = true;
      window.removeEventListener('hf-seek', onSeek); window.removeEventListener('pagehide', instance.dispose);
      timeline.kill(); api?.dispose(); delete root.spatialTypeInstance;
    }};
  root.spatialTypeInstance = instance;
  window.addEventListener('pagehide', instance.dispose, {once: true});
  try {await ready;} catch (error) {instance.dispose(); throw error;}
  return {timeline, instance};
}
