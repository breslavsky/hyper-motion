// Time and layout only: no DOM, GPU, module-global state or autonomous clock.
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const progress = (t, start, duration) => duration > 0 ? clamp((t - start) / duration) : Number(t >= start);
export const ease = (x, name = 'smooth') => {
  x = clamp(x);
  if (name === 'linear') return x;
  if (name === 'hold') return x === 1 ? 1 : 0;
  if (name === 'in') return x * x * x;
  if (name === 'out') return 1 - (1 - x) ** 3;
  return x * x * (3 - 2 * x);
};
export function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mix = (a, b, t) => Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], t)) : lerp(a, b, t);
export function sample(keys, time, fallback = 0) {
  if (keys == null) return fallback;
  if (!Array.isArray(keys)) return keys;
  if (!keys.length) return fallback;
  if (time <= keys[0].time) return keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    if (time <= keys[i].time) {
      const a = keys[i - 1], b = keys[i];
      return mix(a.value, b.value, ease(progress(time, a.time, b.time - a.time), b.ease ?? 'smooth'));
    }
  }
  return keys.at(-1).value;
}
function finiteTree(value, path = 'config') {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${path} must be finite`);
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) finiteTree(v, `${path}.${k}`);
}
function positive(value, name, min = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= min) throw new Error(`${name} must be greater than ${min}`);
  return value;
}
function vector(v, name) {
  if (!Array.isArray(v) || v.length !== 3 || v.some(n => typeof n !== 'number' || !Number.isFinite(n))) throw new Error(`${name} must contain three finite numbers`);
  return v;
}
function track(value, name, vectorValue = false) {
  if (value == null) return;
  if (!Array.isArray(value) || !value.length) throw new Error(`${name} must be a nonempty keyframe array`);
  let previous = -Infinity;
  for (const key of value) {
    if (typeof key.time !== 'number' || key.time < 0 || key.time <= previous) throw new Error(`${name} times must increase strictly from zero or later`);
    previous = key.time;
    if (vectorValue) vector(key.value, name);
    else if (typeof key.value !== 'number') throw new Error(`${name} value must be numeric`);
    if (key.ease && !['linear', 'smooth', 'in', 'out', 'hold'].includes(key.ease)) throw new Error(`${name} has an unknown easing`);
  }
}
export function normalize(input) {
  finiteTree(input);
  const c = structuredClone(input);
  positive(c.duration, 'duration');
  c.width ??= 1920; c.height ??= 1080; c.fps ??= 30; c.pixelRatio ??= 1;
  positive(c.width, 'width'); positive(c.height, 'height'); positive(c.fps, 'fps'); positive(c.pixelRatio, 'pixelRatio');
  if (c.pixelRatio > 2) throw new Error('pixelRatio must not exceed 2');
  c.seed ??= 77;
  if (!Number.isInteger(c.seed)) throw new Error('seed must be an integer');
  if (!Array.isArray(c.words) || !c.words.length) throw new Error('words must be nonempty');
  const ids = new Set();
  for (const [index, w] of c.words.entries()) {
    w.id ??= `word-${index}`;
    if (ids.has(w.id)) throw new Error(`duplicate word id ${w.id}`);
    ids.add(w.id);
    if (typeof w.text !== 'string' || !w.text.trim() || w.text.includes('\n')) throw new Error('each word needs a nonempty single-line text');
    w.font ??= 'wide'; w.position ??= [0, 0, 0]; w.rotation ??= [0, 0, 0]; w.scale ??= [1, 1, 1];
    vector(w.position, 'word.position'); vector(w.rotation, 'word.rotation'); vector(w.scale, 'word.scale');
    if (w.scale.some(v => v <= 0)) throw new Error('word.scale must be positive');
    w.geometry = {depth: 0.42, bevel: 0.035, curveSegments: 10, bevelSegments: 4, tracking: 0, ...w.geometry};
    positive(w.geometry.depth, 'depth');
    if (typeof w.geometry.bevel !== 'number' || w.geometry.bevel < 0 || !Number.isInteger(w.geometry.curveSegments) || w.geometry.curveSegments < 1 || w.geometry.curveSegments > 64 || !Number.isInteger(w.geometry.bevelSegments) || w.geometry.bevelSegments < 1 || w.geometry.bevelSegments > 16) throw new Error('invalid geometry resolution or bevel');
    if (w.width != null) positive(w.width, 'word.width');
    w.visible ??= [0, c.duration];
    if (!Array.isArray(w.visible) || w.visible.length !== 2 || w.visible[1] <= w.visible[0]) throw new Error('word.visible must be [start,end]');
    for (const k of ['position', 'rotation', 'scale']) track(w.animate?.[k], `word.animate.${k}`, true);
    track(w.emissive, 'word.emissive');
    if (w.assembly) {
      positive(w.assembly.duration, 'assembly.duration');
      w.assembly.start ??= 0; w.assembly.stagger ??= 0; w.assembly.offset ??= [4, 0, -1];
      vector(w.assembly.offset, 'assembly.offset');
    }
    if (w.fracture) {
      w.fracture = {start: 0, duration: 1, separation: 0.06, shear: 0.18, depth: 0.12, rotation: 0.05, seed: c.seed + index, ...w.fracture};
      positive(w.fracture.duration, 'fracture.duration');
      w.slices ??= [{normal: [0.9, 0.42, 0], offset: 0.02}];
    }
    for (const cut of w.slices ?? []) {
      vector(cut.normal, 'slice.normal');
      if (Math.hypot(...cut.normal) < 1e-8 || Math.abs(cut.normal[2]) > 1e-8) throw new Error('slice normal must be a nonzero vector in the glyph XY plane');
      cut.offset ??= 0;
    }
    if ((w.slices?.length ?? 0) > 2) throw new Error('at most two slice planes per glyph');
  }
  if (!c.camera?.keys?.length) throw new Error('camera.keys required');
  let previous = -Infinity;
  for (const key of c.camera.keys) {
    if (typeof key.time !== 'number' || key.time < 0 || key.time <= previous) throw new Error('camera times must strictly increase');
    previous = key.time;
    vector(key.position, 'camera.position'); vector(key.target, 'camera.target');
    if (Math.hypot(...key.position.map((n, i) => n - key.target[i])) < 1e-7) throw new Error('camera position and target must differ');
    key.fov ??= c.camera.fov ?? 30; key.roll ??= 0;
    if (key.fov <= 1 || key.fov >= 150) throw new Error('camera fov must be between 1 and 150');
  }
  c.camera.near ??= 0.02; c.camera.far ??= 400;
  if (c.camera.near <= 0 || c.camera.far <= c.camera.near) throw new Error('invalid camera clipping range');
  c.fields ??= [];
  for (const [i, f] of c.fields.entries()) {
    f.seed ??= c.seed + i; f.count ??= 180; f.start ??= 0; f.fade ??= 0.35; f.end ??= c.duration;
    f.bounds ??= [[-8, 8], [-4, 4], [-28, -1]];
    if (!Number.isInteger(f.count) || f.count < 0 || f.count > 4000) throw new Error('field count must be an integer from 0 to 4000');
    if (f.bounds.length !== 3 || f.bounds.some(r => r.length !== 2 || r[1] <= r[0])) throw new Error('field bounds must be three increasing ranges');
    f.scale ??= [0.025, 0.18]; f.stretch ??= [1, 2.5, 0.25]; f.drift ??= [0.15, 0.1, 0.15]; f.spin ??= 0.8;
    if (!Array.isArray(f.scale) || f.scale.length !== 2 || f.scale[0] <= 0 || f.scale[1] < f.scale[0]) throw new Error('field scale must be a positive increasing range');
    if (f.alphabet != null && (typeof f.alphabet !== 'string' || !f.alphabet.trim())) throw new Error('field.alphabet needs drawable characters');
    if (f.burst) {f.burst.tau ??= 0.8; positive(f.burst.tau, 'field.burst.tau');}
    vector(f.stretch, 'field.stretch'); vector(f.drift, 'field.drift');
  }
  c.look = {background: '#020203', fog: 0.035, exposure: 1, envRotation: -0.12, ...c.look};
  if (typeof c.look.background !== 'string' || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(c.look.background)) throw new Error('look.background must be a hex RGB color');
  if (c.environment?.width != null && (![128, 256, 512, 1024, 2048].includes(c.environment.width))) throw new Error('environment.width must be 128,256,512,1024 or2048');
  c.post = {bloom: 0.22, radius: 0.35, threshold: 1.4, grain: 0, aberration: 0, ...c.post};
  for (const k of ['bloom', 'radius', 'threshold', 'exposure', 'flash', 'wash']) if (Array.isArray(c.post[k])) track(c.post[k], `post.${k}`);
  c.motionBlur = {samples: 1, shutter: 0, ...c.motionBlur};
  if (!Number.isInteger(c.motionBlur.samples) || c.motionBlur.samples < 1 || c.motionBlur.samples > 12 || c.motionBlur.shutter < 0 || c.motionBlur.shutter > 2) throw new Error('invalid motionBlur samples or shutter');
  c.glints ??= []; c.lights ??= [];
  for (const g of c.glints) { vector(g.position, 'glint.position'); positive(g.width, 'glint.width'); }
  return c;
}
export function cameraAt(c, time) {
  const field = name => sample(c.camera.keys.map(k => ({time: k.time, value: k[name], ease: k.ease})), time);
  return {position: field('position'), target: field('target'), fov: field('fov'), roll: field('roll')};
}
export function wordAt(w, time, letterCount = [...w.text].length) {
  const p = w.fracture ? ease(progress(time, w.fracture.start, w.fracture.duration), 'out') : 0;
  return {visible: time >= w.visible[0] && time < w.visible[1], position: sample(w.animate?.position, time, w.position),
    rotation: sample(w.animate?.rotation, time, w.rotation), scale: sample(w.animate?.scale, time, w.scale), fracture: p,
    emissive: sample(w.emissive, time, 0), assembly: Array.from({length: letterCount}, (_, i) => w.assembly
      ? 1 - ease(progress(time, w.assembly.start + i * w.assembly.stagger, w.assembly.duration), 'out') : 0)};
}
export function makeField(f) {
  const r = seeded(f.seed), range = a => lerp(a[0], a[1], r());
  return Array.from({length: f.count}, (_, i) => ({index: i, position: f.bounds.map(range),
    rotation: [r(), r(), r()].map(x => x * Math.PI * 2), spin: [r(), r(), r()].map(x => (x - 0.5) * f.spin),
    drift: f.drift.map(x => (r() - 0.5) * 2 * x), scale: f.stretch.map(x => x * range(f.scale)),
    birth: f.start + r() * (f.spread ?? 0), phase: r() * Math.PI * 2}));
}
export function shardAt(d, f, time) {
  const age = Math.max(0, time - d.birth), gain = time < f.end ? ease(progress(time, d.birth, f.fade)) : 0;
  const burst = f.burst ? (f.burst.tau ?? 0.8) * (1 - Math.exp(-age / (f.burst.tau ?? 0.8))) : 0;
  return {position: d.position.map((v, i) => v + d.drift[i] * age + burst * (d.position[i] - (f.burst?.origin?.[i] ?? 0)) * (f.burst?.speed ?? 1)),
    rotation: d.rotation.map((v, i) => v + d.spin[i] * time), scale: d.scale.map(v => v * gain), gain};
}
export function transitionAt(spec, time) {
  if (!spec) return {opacity: 0, height: 1, line: 0, reveal: 0};
  const {bloom = 0.2, hold = 0.1, collapse = 0.1, line = 0.08, reveal = 0.2} = spec.durations ?? {};
  const t = time - spec.start, a = bloom + hold, b = a + collapse, end = b + line;
  if (t < 0 || t >= end + reveal) return {opacity: 0, height: 1, line: 0, reveal: 0};
  if (t < a) return {opacity: ease(progress(t, 0, bloom), 'in'), height: 1, line: 0, reveal: 0};
  if (t < b) return {opacity: 1, height: lerp(1, 0.004, ease(progress(t, a, collapse), 'in')), line: 0, reveal: 0};
  if (t < end) return {opacity: 0, height: 0, line: 1, reveal: 0};
  return {opacity: 0, height: 0, line: 1 - progress(t, end, reveal), reveal: progress(t, end, reveal)};
}
