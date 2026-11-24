// Hosted liquid-metal material. HyperFrames supplies every time value.
// Original Paper shader strings and metal-fx palettes are in vendor/.
import {VERT_SHADER_SRC, FRAG_SHADER_SRC} from './vendor/shaders.mjs';
import {PRESETS} from './vendor/presets.mjs';

export const METAL_PRESETS = Object.freeze(['silver', 'gold', 'chromatic']);
const POOLS = new WeakMap();
const FLOATS = ['repetition', 'softness', 'shiftRed', 'shiftBlue', 'distortion', 'contour', 'angle', 'shape', 'originX', 'originY', 'worldWidth', 'worldHeight', 'fit', 'scale', 'rotation', 'offsetX', 'offsetY'];
const NAMES = ['resolution', 'time', 'pixelRatio', 'colorBack', 'colorTint', 'isImage', 'image', 'imageAspectRatio', 'neutral', ...FLOATS];
const rgba = hex => [1, 3, 5, 7].map((start, index) => index === 3 && hex.length === 7 ? 1 : parseInt(hex.slice(start, start + 2), 16) / 255);

// Liquid Glass 3D surfaces use the original MetalFx button's quiet centre;
// the Paper shader supplies the animated metallic rim.
export function resolveBrandMetalColors(tokens={}, {background,foreground,accent}={}) {
  const color=(value,fallback)=>{
    const raw=/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value??'')?value:fallback;
    return raw.length===4?'#'+[...raw.slice(1)].map(c=>c+c).join(''):raw;
  };
  const channels=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const mix=(a,b,t)=>'#'+channels(a).map((v,i)=>Math.round(v+(channels(b)[i]-v)*t).toString(16).padStart(2,'0')).join('');
  const lum=hex=>channels(hex).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const ink=color(foreground??tokens.foreground,'#ffffff'),lightInk=lum(ink)>Math.sqrt(.0525)-.05;
  const bg=color(tokens.background??background,lightInk?'#141414':'#eeeeee');
  const tint=color(tokens.accent??accent,bg);
  const brandTint=mix(bg,tint,.04),substrate=lightInk?'#272727':'#ffffff';
  const seed=tokens.background||tokens.accent?mix(substrate,brandTint,.16):substrate;
  const opposite=lightInk?'#000000':'#ffffff';
  const contrast=surface=>{const a=lum(surface),b=lum(ink);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
  let base=seed;
  for(let step=1;step<=20&&contrast(base)<4.5;step++)base=mix(seed,opposite,step/20);
  return Object.freeze({background:bg,foreground:ink,base,rim:mix('#e6e6e6',brandTint,.1),
    shadow:mix(base,'#000000',.12),highlight:mix(base,'#ffffff',.04)});
}
function number(value, name, low, high = Infinity) {
  if (!Number.isFinite(value) || value < low || value > high) throw new Error(`Metal ${name} must be between ${low} and ${high}`);
  return value;
}
function shape(width, height, radius, ringWidth) {
  number(width, 'width', 1); number(height, 'height', 1);
  number(radius, 'radius', 0); number(ringWidth, 'ringWidth', 0);
  return {width, height, radius: Math.min(radius, width / 2, height / 2), ringWidth: Math.min(ringWidth, width / 2, height / 2)};
}
function shader(gl, type, source) {
  const item = gl.createShader(type);
  if (!item) throw new Error('Metal could not allocate a shader');
  gl.shaderSource(item, source); gl.compileShader(item);
  if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) {
    const reason = gl.getShaderInfoLog(item); gl.deleteShader(item);
    throw new Error(`Metal shader compilation failed: ${reason}`);
  }
  return item;
}
function pipeline(pool) {
  const {gl} = pool;
  const vert = shader(gl, gl.VERTEX_SHADER, VERT_SHADER_SRC);
  let frag, program, buffer, texture;
  try {
    // Keep the vendored shader intact. Neutral sampling remains available to
    // callers; the button finish uses the original chromatic colour separation.
    const source=FRAG_SHADER_SRC.replace('uniform float u_time;','uniform float u_time;\nuniform float u_neutral;')
      .replace('fragColor = vec4(color, opacity);','if (u_neutral > .5) color = vec3(dot(color, vec3(.2126, .7152, .0722)));\n  fragColor = vec4(color, opacity);');
    frag = shader(gl, gl.FRAGMENT_SHADER, source);
    program = gl.createProgram();
    if (!program) throw new Error('Metal could not allocate a program');
    gl.attachShader(program, vert); gl.attachShader(program, frag); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Metal program linking failed: ${gl.getProgramInfoLog(program)}`);
    gl.useProgram(program);
    buffer = gl.createBuffer(); texture = gl.createTexture();
    if (!buffer || !texture) throw new Error('Metal could not allocate buffers');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,255]));
    for (const key of ['TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER']) gl.texParameteri(gl.TEXTURE_2D, gl[key], gl.LINEAR);
    for (const key of ['TEXTURE_WRAP_S', 'TEXTURE_WRAP_T']) gl.texParameteri(gl.TEXTURE_2D, gl[key], gl.CLAMP_TO_EDGE);
    Object.assign(pool, {program, buffer, texture, uniforms: Object.fromEntries(NAMES.map(name => [name, gl.getUniformLocation(program, `u_${name}`)])), key: null});
  } catch (error) {
    if (program) gl.deleteProgram(program); if (buffer) gl.deleteBuffer(buffer); if (texture) gl.deleteTexture(texture);
    throw error;
  } finally {
    gl.deleteShader(vert); if (frag) gl.deleteShader(frag);
  }
}
function acquire(doc) {
  let pool = POOLS.get(doc);
  if (!pool) {
    const canvas = doc.createElement('canvas');
    const gl = canvas.getContext('webgl2', {alpha:true, premultipliedAlpha:true, antialias:false, preserveDrawingBuffer:true});
    if (!gl) throw new Error('Metal requires WebGL2');
    pool = {canvas, gl, count:0, lost:false, key:null};
    pool.onLost = event => {event.preventDefault(); pool.lost = true; pool.key = null;};
    pool.onRestored = () => {pipeline(pool); pool.lost = false;};
    try {pipeline(pool);} catch (error) {gl.getExtension('WEBGL_lose_context')?.loseContext(); throw error;}
    canvas.addEventListener('webglcontextlost', pool.onLost);
    canvas.addEventListener('webglcontextrestored', pool.onRestored);
    POOLS.set(doc, pool);
  }
  pool.count++;
  return pool;
}
function release(doc, pool) {
  if (--pool.count) return;
  POOLS.delete(doc);
  pool.canvas.removeEventListener('webglcontextlost', pool.onLost);
  pool.canvas.removeEventListener('webglcontextrestored', pool.onRestored);
  pool.gl.deleteBuffer(pool.buffer); pool.gl.deleteProgram(pool.program); pool.gl.deleteTexture(pool.texture);
  pool.gl.getExtension('WEBGL_lose_context')?.loseContext();
  pool.canvas.width = pool.canvas.height = 1;
}
function sheet(pool, preset, theme, time, pixelRatio, neutral) {
  if (pool.lost || pool.gl.isContextLost()) throw new Error('Metal WebGL2 context is lost');
  // Preserve the original canonical 96px material sheet and capped DPR.
  // Adjacent glyphs at the same time reuse it without another GPU draw.
  const dpr = Math.min(2, pixelRatio), size = Math.round(96 * dpr);
  const key = `${preset}:${theme}:${time}:${size}:${dpr}:${neutral}`;
  if (pool.key === key) return pool.canvas;
  const {gl, uniforms:u, canvas} = pool, mode = PRESETS[preset].modes[theme];
  if (canvas.width !== size || canvas.height !== size) {canvas.width = size; canvas.height = size;}
  gl.useProgram(pool.program);
  gl.viewport(0, 0, size, size); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(u.resolution, size, size); gl.uniform1f(u.pixelRatio, dpr);
  gl.uniform4fv(u.colorBack, rgba(mode.colorBack)); gl.uniform4fv(u.colorTint, rgba(neutral?'#ffffff00':mode.colorTint));
  for (const name of FLOATS) gl.uniform1f(u[name], neutral&&['shiftRed','shiftBlue'].includes(name)?0:mode[name]);
  gl.uniform1f(u.neutral,neutral?1:0);
  gl.uniform1i(u.isImage, 0); gl.uniform1i(u.image, 0); gl.uniform1f(u.imageAspectRatio, 1);
  gl.uniform1f(u.time, time * mode.speed);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  pool.key = key;
  return canvas;
}

/**
 * Create an owned Canvas2D material. Dimensions/radius/ringWidth are CSS units.
 * mask, when supplied, paints alpha in backing-store pixels and replaces ring.
 * It is called synchronously after the sheet is drawn: mask(ctx,w,h,pixelRatio).
 * Everything visible depends only on draw(seconds), options and the mask.
 */
export function createMetal({canvas, width = canvas?.width, height = canvas?.height, preset = 'silver', theme = 'dark', kind = 'fill', radius = 0, ringWidth = 2, speed = 1, strength = 1, pixelRatio = 1, shaderScale = kind === 'ring' ? 1.6 : 1, mask, neutral = false} = {}) {
  if (!canvas?.ownerDocument || !canvas.getContext) throw new Error('Metal needs an HTML canvas');
  if (!METAL_PRESETS.includes(preset)) throw new Error(`Unknown Metal preset: ${preset}`);
  if (!['light', 'dark'].includes(theme)) throw new Error(`Unknown Metal theme: ${theme}`);
  if (!['fill', 'ring'].includes(kind)) throw new Error(`Unknown Metal kind: ${kind}`);
  number(speed, 'speed', 0, 4); number(strength, 'strength', 0, 1); number(pixelRatio, 'pixelRatio', 0.25, 4); number(shaderScale, 'shaderScale', 0.01, 8);
  if (mask !== undefined && typeof mask !== 'function') throw new Error('Metal mask must be a function');
  let geometry = shape(width, height, radius, ringWidth), disposed = false, time = 0;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Metal needs an unused Canvas2D output');
  const maskCanvas = mask ? canvas.ownerDocument.createElement('canvas') : null;
  const maskContext = maskCanvas?.getContext('2d');
  if (maskCanvas && !maskContext) throw new Error('Metal could not create an alpha mask');
  const doc = canvas.ownerDocument, pool = acquire(doc);
  const options = Object.freeze({preset, theme, kind, speed, strength, pixelRatio, shaderScale, neutral});
  function size() {
    canvas.width = Math.max(1, Math.round(geometry.width * pixelRatio)); canvas.height = Math.max(1, Math.round(geometry.height * pixelRatio));
    if (maskCanvas) {maskCanvas.width = canvas.width; maskCanvas.height = canvas.height;}
  }
  function active() {if (disposed) throw new Error('Metal instance is disposed');}
  function draw(seconds) {
    active(); number(seconds, 'time', 0); time = seconds;
    const source = sheet(pool, preset, theme, seconds * speed, pixelRatio, neutral), w = canvas.width, h = canvas.height;
    const sourceW = Math.min(source.width, (w * source.width / (140 * pixelRatio)) / shaderScale);
    const sourceH = Math.min(source.height, (h * source.height / (40 * pixelRatio)) / shaderScale);
    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath(); ctx.roundRect(0, 0, w, h, geometry.radius * pixelRatio); ctx.clip();
      ctx.globalAlpha = strength * PRESETS[preset].modes[theme].shaderOpacity;
      ctx.drawImage(source, (source.width - sourceW) / 2, (source.height - sourceH) / 2, sourceW, sourceH, 0, 0, w, h);
      ctx.globalAlpha = 1;
      if (mask) {
        // Compose the whole mask before cutting the sheet: multiple glyph or
        // line draws must form a union, rather than erasing previous shapes.
        maskContext.save();
        try {
          maskContext.setTransform(1, 0, 0, 1, 0, 0); maskContext.globalCompositeOperation = 'source-over'; maskContext.globalAlpha = 1;
          maskContext.clearRect(0, 0, w, h); maskContext.fillStyle = '#000'; mask(maskContext, w, h, pixelRatio);
        } finally {maskContext.restore();}
        ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(maskCanvas, 0, 0);
      } else if (kind === 'ring' && geometry.ringWidth < Math.min(geometry.width, geometry.height) / 2) {
        const inset = geometry.ringWidth * pixelRatio;
        ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.roundRect(inset, inset, w - 2 * inset, h - 2 * inset, Math.max(0, geometry.radius * pixelRatio - inset)); ctx.fill();
      }
    } finally {ctx.restore();}
    return canvas;
  }
  function resize(nextWidth, nextHeight, patch = {}) {
    active();
    const next = shape(nextWidth, nextHeight, patch.radius ?? geometry.radius, patch.ringWidth ?? geometry.ringWidth);
    if (Object.keys(next).some(key => next[key] !== geometry[key])) {geometry = next; size();}
    return api;
  }
  function dispose() {
    if (disposed) return;
    disposed = true; release(doc, pool);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (maskCanvas) maskCanvas.width = maskCanvas.height = 1;
  }
  const api = Object.freeze({canvas, options, draw, resize, dispose, get time(){return time;}, get disposed(){return disposed;}, get width(){return geometry.width;}, get height(){return geometry.height;}});
  size(); return api;
}
