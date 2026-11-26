// The finish of a film: the look of the picture as a whole, laid over a page
// and driven by time. Film grain, a chromatic fringe that swells on the hits
// of the music, a vignette, a flash of a frame or two, bursts of camera shake
// and a slow light leak. Every part is optional.
//
// Every answer is a pure function of the time asked for. What looks random
// (the grain, the way a shake throws the frame) is hashed from the frame's
// number and a seed, so the same moment gives the same picture whatever was
// asked before: a page seeks backwards, a still equals the render, and two
// renders are the same file.

export const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
/** A move that speeds up and then slows down. */
export const smooth = u => { const k = clamp(u); return k * k * (3 - 2 * k); };
/** A burst, `u` of the way through it (0..1): up fast, down slowly, leaving rest and coming back to it without a corner. 0..1. */
export const burst = u => {
  if (!(u > 0 && u < 1)) return 0;
  const value = Math.sin(Math.PI * (1 - (1 - u) ** 2.5)) ** 2;
  // What a division leaves of a moment that is the burst's very end is rest too.
  return value < 1e-12 ? 0 : value;
};

/** The frame a moment falls in. A moment a hair short of a frame's start, as a division leaves it, is that frame. */
export const frameOf = (l, fps = 30) => Math.floor(l * fps + 1e-4);

/** Whole numbers mixed into one number in 0..1 (never 1): the same numbers, the same answer. */
export function hash(...numbers) {
  let h = 0x9e3779b9;
  for (const number of numbers) {
    h = Math.imul(h ^ (number | 0), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

/**
 * The grain of one frame: `count` values 0..255 around the middle grey, which
 * a painter lays out as it likes (mountFinish: one small canvas, scaled up).
 * The values of a frame follow from its number and the seed alone.
 */
export function grainAt(frame, seed = 1, count = 0) {
  const out = new Uint8Array(count);
  let state = Math.floor(hash(frame, seed, 7) * 4294967296) | 0;
  for (let i = 0; i < count; i++) {
    state = (state + 0x6d2b79f5) | 0;
    let r = Math.imul(state ^ (state >>> 15), 1 | state);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    r ^= r >>> 14;
    // Two throws averaged: most grains near the grey, few far from it.
    out[i] = ((r & 255) + ((r >>> 8) & 255)) >> 1;
  }
  return out;
}

/**
 * Where the shakes throw the frame at a moment, as shares of its width.
 * A shake `{t, d, amp}` starts at `t`, lasts `d` seconds and throws the frame
 * `amp` at most. The throw changes every `step` frames, hashed from the
 * frame's number; how far it goes rises and dies away smoothly.
 * `reach` is the farthest the frame can be at that moment.
 */
export function shakeAt(l, shakes, fps = 30, seed = 1, step = 1) {
  let x = 0, y = 0, reach = 0;
  const beat = Math.floor(frameOf(l, fps) / step);
  (shakes ?? []).forEach((shake, i) => {
    const far = shake.amp * burst((l - shake.t) / shake.d);
    if (!far) return;
    const turn = hash(beat, seed, i, 1) * 2 * Math.PI, length = 0.6 + 0.4 * hash(beat, seed, i, 2);
    x += Math.cos(turn) * length * far;
    y += Math.sin(turn) * length * far;
    reach += far;
  });
  return {x, y, reach};
}

/**
 * The flash on at a moment: `{kind, amount}`, `kind` null and `amount` 0 when
 * there is none. A flash `{t, frames, kind}` covers `frames` whole frames
 * from the frame `t` falls on. A flash is a state of a frame, not a move.
 */
export function flashAt(l, flashes, fps = 30) {
  const frame = frameOf(l, fps);
  let on = {kind: null, amount: 0};
  for (const flash of flashes ?? []) {
    const first = Math.round(flash.t * fps);
    if (frame >= first && frame < first + (flash.frames ?? 1)) on = {kind: flash.kind ?? 'white', amount: flash.amount ?? 1};
  }
  return on;
}

/**
 * How far apart the colours stand at a moment, as a share of the frame's
 * width: `rest` always, and `hit` more on a hit, which dies away in `decay`
 * seconds, smooth at both ends.
 */
export function fringeAt(l, hits, {rest = 0.001, hit = 0.003, decay = 0.3} = {}) {
  let most = 0;
  for (const moment of hits ?? []) most = Math.max(most, burst((l - moment) / decay));
  return rest + hit * most;
}

/** Where the light leak stands (shares of the frame, from its middle) and how bright it is: a slow wander that repeats for its seed. */
export function leakAt(l, {amount = 0, rate = 0.04, seed = 1} = {}) {
  if (!amount) return {x: 0, y: 0, amount: 0};
  const wave = (n, f) => Math.sin(l * rate * f * 2 * Math.PI + seed * n * 1.7);
  return {
    x: (wave(1, 1) * 0.7 + wave(2, 2.3) * 0.3) * 0.45,
    y: (wave(3, 0.7) * 0.7 + wave(4, 1.9) * 0.3) * 0.3,
    amount: amount * (0.65 + 0.35 * wave(5, 1.3)),
  };
}

const part = (value, defaults, key) => (value === false || value === 0 || value === null ? null : {...defaults, ...(typeof value === 'number' ? {[key]: value} : value === true ? {} : value)});

/**
 * A whole finish, with no page.
 *   duration  how long the layer lasts, in seconds (needed)
 *   fps       the film's frames a second (30)
 *   seed      what the grain and the shakes are hashed from
 *   grain     how strong (0.1; 0.3 is heavy), or {amount, hold}: `hold` frames a grain stays (1)
 *   fringe    the colours' distance at rest as a share of the width (0.001), or {rest, hit, decay}
 *   vignette  how dark the corners are (0.3), or {amount, inner, color}
 *   flashes   [{t, frames, kind: 'white' | 'black'}]
 *   shakes    [{t, d, amp}], `amp` a share of the width, a tenth at most; `step` frames a throw stays (1)
 *   hits      [t]: moments the fringe swells
 *   leak      {amount, rate, seed, color, size}: off unless given
 * Times are seconds from the layer's start. `false` or 0 turns a part off.
 * `at(l)` gives `{frame, grain: {amount, frame}, fringe, shake: {x, y, reach}, flash: {kind, amount}, vignette, leak: {x, y, amount}}`.
 */
export function createFinish({duration, fps = 30, seed = 1, grain = 0.1, fringe = 0.001, vignette = 0.3, flashes = [], shakes = [], hits = [], leak = null, step = 1} = {}) {
  if (!(duration > 0)) throw new Error('finish: the finish needs a duration');
  if (!(fps > 0)) throw new Error('finish: the finish needs the film\'s frames a second');
  if (![1, 2, 3, 4].includes(step)) throw new Error(`finish: a throw of a shake stays 1 to 4 frames, not ${step}`);
  for (const [name, list] of Object.entries({flashes, shakes, hits})) if (!Array.isArray(list)) throw new Error(`finish: ${name} is a list`);
  flashes.forEach((flash, i) => {
    if (!Number.isFinite(flash?.t)) throw new Error(`finish: flash ${i + 1} has no time`);
    if (flash.kind !== undefined && flash.kind !== 'white' && flash.kind !== 'black') throw new Error(`finish: flash ${i + 1} is white or black, not ${flash.kind}`);
    if (flash.frames !== undefined && !(Number.isInteger(flash.frames) && flash.frames >= 1)) throw new Error(`finish: flash ${i + 1} lasts a whole number of frames, one at least`);
    if (flash.amount !== undefined && !(flash.amount >= 0 && flash.amount <= 1)) throw new Error(`finish: flash ${i + 1} has an amount outside 0..1`);
  });
  shakes.forEach((shake, i) => {
    if (!Number.isFinite(shake?.t)) throw new Error(`finish: shake ${i + 1} has no time`);
    if (!(shake.d > 0)) throw new Error(`finish: shake ${i + 1} has no length`);
    if (!(shake.amp >= 0)) throw new Error(`finish: shake ${i + 1} has no amplitude`);
    if (shake.amp > 0.1) throw new Error(`finish: shake ${i + 1} throws the frame ${shake.amp} of its width; a tenth is the most`);
  });
  hits.forEach((hit, i) => { if (!Number.isFinite(hit)) throw new Error(`finish: hit ${i + 1} is not a time`); });
  const parts = {
    grain: part(grain, {amount: 0.1, hold: 1}, 'amount'),
    fringe: part(fringe, {rest: 0.001, hit: 0.003, decay: 0.3}, 'rest'),
    vignette: part(vignette, {amount: 0.3, inner: 0.45, color: '#000'}, 'amount'),
    leak: part(leak, {amount: 0.2, rate: 0.04, seed, color: '#ff9a4d', size: 0.7}, 'amount'),
  };
  if (parts.grain && !(parts.grain.amount > 0 && parts.grain.amount <= 1)) throw new Error('finish: the grain is a strength above 0 and 1 at most');
  if (parts.grain && !(Number.isInteger(parts.grain.hold) && parts.grain.hold >= 1)) throw new Error('finish: a grain stays a whole number of frames, one at least');
  if (parts.fringe && !(parts.fringe.rest >= 0 && parts.fringe.hit >= 0 && parts.fringe.rest + parts.fringe.hit <= 0.05)) throw new Error('finish: the fringe is a share of the width, a twentieth at most with its hit');
  if (parts.fringe && !(parts.fringe.decay > 0)) throw new Error('finish: the fringe of a hit needs a time to die away in');
  if (parts.vignette && !(parts.vignette.amount > 0 && parts.vignette.amount <= 1)) throw new Error('finish: the vignette is a darkness above 0 and 1 at most');
  const none = {x: 0, y: 0, reach: 0};
  const at = moment => {
    const l = clamp(moment, 0, duration), frame = frameOf(l, fps);
    return {
      frame,
      grain: parts.grain ? {amount: parts.grain.amount, frame: Math.floor(frame / parts.grain.hold)} : null,
      fringe: parts.fringe ? fringeAt(l, hits, parts.fringe) : 0,
      shake: shakes.length ? shakeAt(l, shakes, fps, seed, step) : none,
      flash: flashAt(l, flashes, fps),
      vignette: parts.vignette ? parts.vignette.amount : 0,
      leak: parts.leak ? leakAt(l, parts.leak) : null,
    };
  };
  return {at, parts, fps, seed, duration};
}

const SVG = 'http://www.w3.org/2000/svg';
let filters = 0;

/**
 * The finish of a page. `root` is the composition's root element; `target`
 * (by default the element with `data-finish`, else the root's first child) is
 * what shakes and takes the fringe; the grain, the vignette, the leak and the
 * flash are laid over the root, last, and take no clicks. Options: `width`,
 * `height`, `fps`, `duration`, `seed`, `grain`, `fringe`, `vignette`,
 * `flashes`, `shakes`, `hits`, `leak`, `step` as for createFinish, and
 *   grain.size   px of the frame one grain takes (2 at 1080 on the short side)
 *   grain.blend  how the grain is laid on: 'soft-light' unless given
 *   cover        whether the target grows a little under a shake so its edges never show (true)
 * Returns `{draw(l), at(l), attach(timeline, start)}`: `attach` puts the
 * finish on the page's own GSAP timeline.
 */
export function mountFinish(root, {width, height, target, cover = true, ...rest} = {}) {
  if (!root) throw new Error('finish: no root to lay the finish over');
  if (!(width > 0 && height > 0)) throw new Error('finish: the finish needs the frame\'s width and height');
  const finish = createFinish(rest), {parts, seed, duration} = finish;
  const subject = target ?? root.querySelector?.('[data-finish]') ?? root.firstElementChild;
  const moves = rest.shakes?.length || parts.fringe;
  if (moves && !subject) throw new Error('finish: nothing to shake: the root has no element with data-finish and no child');
  const doc = root.ownerDocument;
  const layer = (name, style) => {
    const node = doc.createElement(name);
    Object.assign(node.style, {position: 'absolute', left: '0', top: '0', width: `${width}px`, height: `${height}px`, pointerEvents: 'none', zIndex: '2147483000', ...style});
    node.setAttribute('data-finish-layer', '');
    return node;
  };
  const added = [];
  const svg = (name, attributes, parent) => {
    const node = doc.createElementNS(SVG, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    parent?.appendChild(node);
    return node;
  };

  // The fringe: the red of the picture a little to the left, the blue a little to the right, the green where it was.
  let red, blue, fringeId;
  if (parts.fringe) {
    fringeId = `finish-fringe-${++filters}`;
    const holder = svg('svg', {width: 0, height: 0, 'aria-hidden': 'true'});
    Object.assign(holder.style, {position: 'absolute', width: '0', height: '0', pointerEvents: 'none'});
    const filter = svg('filter', {id: fringeId, x: 0, y: 0, width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB'}, holder);
    // One colour of a picture, the other two put out, its alpha kept.
    const only = (channel, input, result) => svg('feColorMatrix', {in: input, type: 'matrix', result, values: [0, 1, 2].map(row => (row === channel ? ['1 0 0 0 0', '0 1 0 0 0', '0 0 1 0 0'][row] : '0 0 0 0 0')).join(' ') + ' 0 0 0 1 0'}, filter);
    red = svg('feOffset', {in: 'SourceGraphic', dx: 0, dy: 0, result: 'red-moved'}, filter);
    only(0, 'red-moved', 'red');
    blue = svg('feOffset', {in: 'SourceGraphic', dx: 0, dy: 0, result: 'blue-moved'}, filter);
    only(2, 'blue-moved', 'blue');
    only(1, 'SourceGraphic', 'green');
    svg('feBlend', {mode: 'screen', in: 'red', in2: 'green', result: 'red-green'}, filter);
    svg('feBlend', {mode: 'screen', in: 'blue', in2: 'red-green'}, filter);
    added.push(holder);
  }

  let leak;
  if (parts.leak) {
    const size = parts.leak.size * width;
    leak = layer('div', {left: `${(width - size) / 2}px`, top: `${(height - size) / 2}px`, width: `${size}px`, height: `${size}px`, mixBlendMode: 'screen', background: `radial-gradient(closest-side, ${parts.leak.color} 0%, transparent 100%)`});
    added.push(leak);
  }

  // The grain: one small canvas of grey noise, scaled up to the frame.
  let canvas, context, image, cells = 0, painted = null;
  if (parts.grain) {
    const size = parts.grain.size ?? Math.max(1, Math.round(Math.min(width, height) / 540));
    canvas = layer('canvas', {mixBlendMode: parts.grain.blend ?? 'soft-light', opacity: String(parts.grain.amount)});
    canvas.width = Math.ceil(width / size);
    canvas.height = Math.ceil(height / size);
    cells = canvas.width * canvas.height;
    context = canvas.getContext?.('2d') ?? null;
    image = context?.createImageData(canvas.width, canvas.height) ?? null;
    added.push(canvas);
  }

  if (parts.vignette) {
    // The darkness comes in as a move does: slowly, then faster, then slowly again.
    const {amount, inner, color} = parts.vignette;
    const stops = Array.from({length: 9}, (_, i) => `color-mix(in srgb, ${color} ${(smooth(i / 8) * amount * 100).toFixed(2)}%, transparent) ${((inner + (1 - inner) * i / 8) * 100).toFixed(2)}%`);
    added.push(layer('div', {background: `radial-gradient(ellipse farthest-corner at 50% 50%,${stops.join(', ')})`}));
  }

  const flash = rest.flashes?.length ? layer('div', {display: 'none'}) : null;
  if (flash) added.push(flash);
  for (const node of added) root.appendChild(node);

  const px = value => `${value.toFixed(3)}px`;
  const draw = l => {
    const state = finish.at(l);
    if (canvas && image && state.grain.frame !== painted) {
      const values = grainAt(state.grain.frame, seed, cells), data = image.data;
      for (let i = 0, j = 0; i < cells; i++, j += 4) { data[j] = data[j + 1] = data[j + 2] = values[i]; data[j + 3] = 255; }
      context.putImageData(image, 0, 0);
      painted = state.grain.frame;
    }
    if (parts.fringe) {
      const far = state.fringe * width;
      red.setAttribute('dx', (-far).toFixed(3));
      blue.setAttribute('dx', far.toFixed(3));
      subject.style.filter = far > 0.01 ? `url(#${fringeId})` : 'none';
    }
    if (rest.shakes?.length) {
      // `translate` and `scale` are the element's own properties: they stand outside its `transform`.
      const {x, y, reach} = state.shake;
      subject.style.translate = reach ? `${px(x * width)} ${px(y * width)}` : 'none';
      subject.style.scale = reach && cover ? (1 + 2 * reach * width / Math.min(width, height)).toFixed(5) : 'none';
    }
    if (leak) {
      leak.style.translate = `${px(state.leak.x * width)} ${px(state.leak.y * height)}`;
      leak.style.opacity = state.leak.amount.toFixed(4);
    }
    if (flash) {
      flash.style.display = state.flash.amount ? 'block' : 'none';
      flash.style.background = state.flash.kind === 'black' ? '#000' : '#fff';
      flash.style.opacity = String(state.flash.amount);
    }
    return state;
  };
  // The finish's clock is a function GSAP calls with the time, so a seek draws the finish too,
  // whether or not the seek lets callbacks run.
  const attach = (timeline, start = 0) => {
    let now = 0;
    const clock = {time(value) { if (value === undefined) return now; now = clamp(value, 0, duration); draw(now); }};
    timeline.to(clock, {time: duration, duration, ease: 'none'}, start);
    draw(0);
    return timeline;
  };
  draw(0);
  return {draw, at: finish.at, attach};
}
