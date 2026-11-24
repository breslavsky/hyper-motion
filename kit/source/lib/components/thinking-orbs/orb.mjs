import { MODE_FRAMES, STATE_TO_MODE, resolvePreset, paintFrame } from './vendor/engine.es.js';

/** A clock-free Canvas binding for the unchanged Thinking Orbs engine. */
export const ORB_STATES = Object.freeze(Object.keys(STATE_TO_MODE));
export const PRESET_SIZES = Object.freeze([20, 32, 64]);

const activeCanvases = new WeakMap();
const optionKeys = new Set(['state', 'size', 'presetSize', 'pixelRatio', 'speed', 'dark', 'color']);

function numberIn(name, value, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be a finite number between ${minimum} and ${maximum}`);
  }
  return value;
}

function time(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError('seconds must be a finite nonnegative number');
  }
  return seconds;
}

function tintFrom(color) {
  if (color === undefined) return undefined;
  if (typeof color !== 'string') throw new TypeError('color must be #rgb, #rrggbb, or rgb(r, g, b)');
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3) digits = digits.replace(/./g, (c) => c + c);
    const value = Number.parseInt(digits, 16);
    return Object.freeze({ r: value >> 16 & 255, g: value >> 8 & 255, b: value & 255 });
  }
  const rgb = color.trim().match(/^rgb\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)$/i);
  if (rgb) {
    const channels = rgb.slice(1).map(Number);
    channels.forEach((value) => numberIn('color channel', value, 0, 255));
    return Object.freeze({ r: channels[0], g: channels[1], b: channels[2] });
  }
  throw new TypeError('color must be #rgb, #rrggbb, or rgb(r, g, b)');
}

function prepare(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('options must be an object');
  for (const key of Object.keys(input)) {
    if (!optionKeys.has(key)) throw new TypeError(`unknown orb option: ${key}`);
  }
  const options = {
    state: input.state === undefined ? 'searching' : input.state,
    size: input.size === undefined ? 256 : input.size,
    presetSize: input.presetSize === undefined ? 64 : input.presetSize,
    pixelRatio: input.pixelRatio === undefined ? 1 : input.pixelRatio,
    speed: input.speed === undefined ? 1 : input.speed,
    dark: input.dark === undefined ? true : input.dark,
    ...(input.color === undefined ? {} : { color: input.color }),
  };
  if (!ORB_STATES.includes(options.state)) throw new RangeError(`state must be one of ${ORB_STATES.join(', ')}`);
  numberIn('size', options.size, 1, 4096);
  numberIn('pixelRatio', options.pixelRatio, 0.25, 4);
  numberIn('speed', options.speed, 0, 16);
  if (!PRESET_SIZES.includes(options.presetSize)) throw new RangeError('presetSize must be 20, 32, or 64');
  if (typeof options.dark !== 'boolean') throw new TypeError('dark must be a boolean');
  const backingSize = Math.round(options.size * options.pixelRatio);
  if (backingSize < 1 || backingSize > 8192) throw new RangeError('size × pixelRatio must round to 1–8192 pixels');
  const tint = tintFrom(options.color);
  const preset = resolvePreset(options.state, options.presetSize);
  // The upstream resolver caches its presets. Keep one private immutable copy.
  const modeOptions = Object.freeze({ ...preset.opts });
  const frameFn = MODE_FRAMES[preset.mode];
  const frame = (seconds) => {
    const effectiveTime = time(seconds) * preset.speed * options.speed;
    if (!Number.isFinite(effectiveTime)) throw new RangeError('effective orb time must be finite');
    return frameFn(options.presetSize, effectiveTime, modeOptions);
  };
  return { options: Object.freeze(options), backingSize, tint, frame };
}

/**
 * Pure geometry in the upstream preset's logical pixels. `size` controls the
 * output Canvas only; the hand-tuned 20/32/64 geometry is never retuned implicitly.
 */
export function sampleOrb(options, seconds) {
  return prepare(options).frame(seconds);
}

/**
 * Create an explicitly driven orb. Call draw(localSeconds) from a HyperFrames
 * timeline setter. This adapter owns no timers, animation loops, or listeners.
 * Output pixels are independent of the machine's devicePixelRatio.
 */
export function createOrb(canvas, input = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('canvas must provide a 2D context');
  if (activeCanvases.has(canvas)) throw new Error('canvas already has an active orb; dispose it before remounting');
  const prepared = prepare(input);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('a Canvas 2D context is required');
  const original = { width: canvas.width, height: canvas.height, cssWidth: canvas.style?.width, cssHeight: canvas.style?.height };
  const { options, backingSize, tint } = prepared;
  canvas.width = backingSize;
  canvas.height = backingSize;
  if (canvas.style) {
    canvas.style.width = `${options.size}px`;
    canvas.style.height = `${options.size}px`;
  }
  let disposed = false;
  const check = () => { if (disposed) throw new Error('orb has been disposed'); };
  const api = {
    options,
    frame(seconds) {
      check();
      return prepared.frame(seconds);
    },
    draw(seconds) {
      check();
      const frame = prepared.frame(seconds);
      const scale = backingSize / options.presetSize;
      ctx.save();
      try {
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, options.presetSize, options.presetSize);
        paintFrame(ctx, frame, options.dark, tint);
      } finally {
        ctx.restore();
      }
      return frame;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      activeCanvases.delete(canvas);
      canvas.width = original.width;
      canvas.height = original.height;
      if (canvas.style) {
        canvas.style.width = original.cssWidth;
        canvas.style.height = original.cssHeight;
      }
    },
  };
  activeCanvases.set(canvas, api);
  return Object.freeze(api);
}
