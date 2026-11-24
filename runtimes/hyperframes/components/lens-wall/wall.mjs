// Lens Wall: an endless wall of the film's own photos and videos seen
// through a lens that swells whatever is under it, a camera that travels the
// wall, stops on the pictures the film names and opens each to the full frame.
//
// Everything on the screen is a pure function of the scene's time: `plan`
// checks a recipe and lays out the route, `stateAt` says where the camera is
// and what is open, `tilesAt` where every tile stands under the lens. `mount`
// (the browser) only paints that. Node runs the same functions in build.mjs
// and in the tests.

const SQRT_PI_2 = Math.sqrt(Math.PI) / 2;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const ease = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const mod = (a, n) => ((a % n) + n) % n;
const round = value => Math.round(value * 1000) / 1000;

export const VIDEO = /\.(mp4|mov|m4v|webm)$/i;
export const IMAGE = /\.(jpe?g|png|webp|avif|gif|svg)$/i;
export const LIMITS = {media: 60, videos: 8, stops: 24, caption: 28};
// The wall's own example videos, at their public address: the component is
// handed to others, so what it needs beyond its code comes from our CDN. A
// wall has PLACES places: a film's files take them one by one, the examples
// keep the rest, and PLACES files of the film's leave no example.
export const EXAMPLES = ['a1.mp4', 'a2.mp4', 'a3.mp4', 'a4.mp4', 'a5.mp4', 'a6.mp4', 'a7.mp4'];
export const PLACES = 7;
export const PUBLIC = 'https://motion-fab-share.b-cdn.net/components/lens-wall';
export const examplesFor = own => EXAMPLES.slice(0, Math.max(0, PLACES - own)).map(file => `${PUBLIC}/${file}`);
// The ways a camera with nowhere to go crosses the wall.
export const PATHS = ['drift', 'orbit', 'wave', 'eight', 'zigzag'];

// Abramowitz and Stegun 7.1.26: within 1.5e-7, the same on every machine.
export function erf(x) {
  if (x === 0) return 0;
  const sign = x < 0 ? -1 : 1, a = Math.abs(x), t = 1 / (1 + .3275911 * a);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592) * t;
  return sign * (1 - poly * Math.exp(-a * a));
}

// A recipe checked and filled in. Returns {errors} or {spec}: every length in
// pixels of the frame, every time in seconds of the scene.
export function plan(recipe) {
  const errors = [];
  const bad = message => { errors.push(message); };
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return {errors: ['the recipe must be a JSON object']};
  const number = (value, fallback, low, high, name) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) {
      bad(`"${name}" must be a number from ${low} to ${high}`);
      return fallback;
    }
    return value;
  };
  const known = (object, keys, where) => {
    for (const key of Object.keys(object)) if (!keys.includes(key)) bad(`${where} has no field "${key}" (it has: ${keys.join(', ')})`);
  };
  known(recipe, ['id', 'width', 'height', 'duration', 'start', 'track', 'media', 'tile', 'stagger', 'lens', 'drift',
    'path', 'dim', 'background', 'stops'], 'the recipe');

  const id = recipe.id;
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(id)) bad('"id" must be lowercase letters, digits and hyphens, starting with a letter');
  const width = number(recipe.width, 1080, 240, 4096, 'width');
  const height = number(recipe.height, 1920, 240, 4096, 'height');
  if (!Number.isInteger(width) || !Number.isInteger(height)) bad('"width" and "height" are whole pixels');
  const duration = number(recipe.duration, 8, 1, 120, 'duration');
  const start = number(recipe.start, 0, 0, 3600, 'start');
  const track = recipe.track ?? 1;
  if (!Number.isInteger(track) || track < 0) bad('"track" must be a whole number, 0 or more');
  const short = Math.min(width, height);

  const media = [];
  if (!Array.isArray(recipe.media) || !recipe.media.length) bad('"media" lists the photos and videos of the wall: at least one');
  else if (recipe.media.filter(row => VIDEO.test(typeof row === 'string' ? row : row?.src ?? '')).length > LIMITS.videos) bad(`"media" holds ${LIMITS.videos} videos at most: each plays in its tiles and is decoded for every frame`);
  else if (recipe.media.length > LIMITS.media) bad(`"media" holds ${LIMITS.media} files at most`);
  else recipe.media.forEach((row, index) => {
    const item = typeof row === 'string' ? {src: row} : row;
    const where = `media ${index + 1}`;
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.src !== 'string') return bad(`${where} must be a file path or {"src": path}`);
    known(item, ['src', 'from'], where);
    const video = VIDEO.test(item.src);
    if (!video && !IMAGE.test(item.src)) bad(`${where}: ${item.src} is neither a picture (jpg, png, webp, avif, gif) nor a video (mp4, mov, m4v, webm)`);
    if (item.from !== undefined && !video) bad(`${where}: "from" is where a video starts; a picture has none`);
    media.push({src: item.src, kind: video ? 'video' : 'image',
      from: video ? number(item.from, 0, 0, 3600, `${where} from`) : 0});
  });

  const tileIn = recipe.tile ?? {};
  if (typeof tileIn !== 'object' || Array.isArray(tileIn)) bad('"tile" must be an object');
  else known(tileIn, ['width', 'aspect', 'gap', 'radius'], '"tile"');
  const aspect = tileIn.aspect ?? '2:3';
  const ratio = typeof aspect === 'string' && /^\d{1,2}:\d{1,2}$/.test(aspect) ? aspect.split(':').map(Number) : null;
  if (!ratio || !ratio[0] || !ratio[1] || ratio[0] / ratio[1] < .4 || ratio[0] / ratio[1] > 2.5) bad('"tile.aspect" is width:height, such as 2:3, 1:1 or 16:9');
  const tileWidth = Math.round(number(tileIn.width, Math.round(short * .105), 24, short / 2, 'tile.width'));
  const tileHeight = Math.round(tileWidth * (ratio ? ratio[1] / ratio[0] : 1.5));
  const gap = number(tileIn.gap, Math.round(tileWidth * .09), 0, tileWidth, 'tile.gap');
  const radius = number(tileIn.radius, Math.round(tileWidth * .08), 0, tileWidth / 2, 'tile.radius');

  const lensIn = recipe.lens ?? {};
  if (typeof lensIn !== 'object' || Array.isArray(lensIn)) bad('"lens" must be an object');
  else known(lensIn, ['x', 'y', 'radius', 'magnify'], '"lens"');
  const lens = {
    x: round(number(lensIn.x, .5, 0, 1, 'lens.x') * width),
    y: round(number(lensIn.y, .5, 0, 1, 'lens.y') * height),
    radius: round(number(lensIn.radius, .22, .05, 2, 'lens.radius') * short),
    magnify: number(lensIn.magnify, 3, 1, 6, 'lens.magnify'),
  };

  const pitchX = tileWidth + gap, pitchY = tileHeight + gap;
  const driftIn = recipe.drift ?? [.22, -.08];
  let drift = [0, 0];
  if (!Array.isArray(driftIn) || driftIn.length !== 2 || !driftIn.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 4)) {
    bad('"drift" is [right, down] in tiles a second, each from -4 to 4');
  } else drift = [round(driftIn[0] * pitchX), round(driftIn[1] * pitchY)];
  const path = recipe.path ?? 'drift';
  if (!PATHS.includes(path)) bad(`"path" is one of ${PATHS.join(', ')}`);
  const dim = number(recipe.dim, .5, 0, 1, 'dim');
  const background = recipe.background ?? '#0b0c10';
  if (typeof background !== 'string' || !/^#[\da-f]{6}$/i.test(background)) bad('"background" is a colour as #rrggbb');
  if (recipe.stagger !== undefined && typeof recipe.stagger !== 'boolean') bad('"stagger" is true or false');

  const stops = [];
  const stopsIn = recipe.stops ?? [];
  if (!Array.isArray(stopsIn) || stopsIn.length > LIMITS.stops) bad(`"stops" is a list of ${LIMITS.stops} stops at most`);
  else {
    let free = 0;
    stopsIn.forEach((row, index) => {
      const where = `stop ${index + 1}`;
      if (!row || typeof row !== 'object' || Array.isArray(row)) return bad(`${where} must be an object`);
      known(row, ['media', 'at', 'travel', 'hold', 'open', 'close', 'fit', 'sound', 'caption'], where);
      if (!Number.isInteger(row.media) || row.media < 1 || row.media > media.length) return bad(`${where}: "media" is the number of a file of "media", 1 to ${media.length}`);
      const item = media[row.media - 1];
      const travel = number(row.travel, 1.2, .2, 10, `${where} travel`);
      const at = number(row.at, round(free + travel), 0, 3600, `${where} at`);
      const hold = number(row.hold, .35, 0, 60, `${where} hold`);
      const open = number(row.open, 2.5, 0, 120, `${where} open`);
      if (open > 0 && open < .6) bad(`${where}: "open" is 0 (the camera only stops) or at least 0.6 s`);
      const end = round(at + hold + open);
      if (at - travel < free - 1e-6) bad(`${where} arrives at ${at} s after a ${travel} s travel, but the camera is busy until ${round(free)} s: move "at" to ${round(free + travel)} or later`);
      if (end > duration + 1e-3) bad(`${where} ends at ${end} s, after the scene's ${duration} s`);
      const last = end > duration - 1e-3;
      if (row.close !== undefined && typeof row.close !== 'boolean') bad(`${where}: "close" is true or false`);
      if (row.fit !== undefined && !['cover', 'contain'].includes(row.fit)) bad(`${where}: "fit" is cover or contain`);
      if (row.sound !== undefined && (typeof row.sound !== 'boolean' || (row.sound && item?.kind !== 'video'))) bad(`${where}: "sound" is true for a video that keeps its sound`);
      if (row.caption !== undefined && (typeof row.caption !== 'string' || !row.caption.trim() || row.caption.length > LIMITS.caption || /[\n\r<>]/.test(row.caption))) {
        bad(`${where}: "caption" is one line of ${LIMITS.caption} characters at most`);
      }
      if ((row.caption || row.sound || row.fit) && !open) bad(`${where}: "caption", "sound" and "fit" belong to a stop that opens ("open" above 0)`);
      stops.push({media: row.media - 1, at: round(at), travel, hold, open, end,
        close: open > 0 && (row.close ?? !last), fit: row.fit ?? 'auto', sound: row.sound === true,
        caption: row.caption?.trim() ?? ''});
      free = end;
    });
  }
  if (errors.length) return {errors};
  const spec = {id, width, height, duration, start, track, media, stagger: recipe.stagger === true,
    tile: {width: tileWidth, height: tileHeight, gap, radius, pitchX, pitchY},
    lens, drift, path, dim, background: background.toLowerCase(), stops};
  spec.route = route(spec);
  return {spec};
}

// Which file a cell of the endless wall shows. Neighbours differ as soon as
// there are files enough: a step along a row is one file, a step along a
// column a stride that is neither 0 nor one file either way.
export function mediaAt(col, row, count) {
  if (count < 2) return 0;
  let stride = 1;
  if (count === 4) stride = 2;
  else if (count > 4) {
    stride = Math.max(2, Math.min(count - 2, Math.round(count * .382)));
  }
  return mod(col + row * stride, count);
}

export function cellCentre(spec, col, row) {
  const shift = spec.stagger && mod(col, 2) === 1 ? .5 : 0;
  return [col * spec.tile.pitchX, (row + shift) * spec.tile.pitchY];
}

// Seconds of full speed a camera has behind it `time` seconds after it set
// off: from rest it takes RAMP seconds to reach its speed.
const RAMP = .7;
function driftTime(time, fromRest) {
  if (!fromRest) return time;
  const x = clamp(time / RAMP);
  return RAMP * (x * x * x - x * x * x * x / 2) + Math.max(0, time - RAMP);
}

// Where a camera is after `along` pixels of its path, from where it set off.
// Every path leaves along the drift's direction; the wall has no edges, so a
// path only has to be pleasant to follow.
export function pathAt(spec, along) {
  const [vx, vy] = spec.drift, speed = Math.hypot(vx, vy);
  if (!speed) return [0, 0];
  const fx = vx / speed, fy = vy / speed;          // forward
  const sx = -fy, sy = fx;                          // to the side
  const unit = spec.tile.pitchY;
  let forward = along, side = 0;
  if (spec.path === 'orbit') {
    const r = unit * 1.5;
    forward = r * Math.sin(along / r); side = r * (1 - Math.cos(along / r));
  } else if (spec.path === 'wave') {
    side = unit * .8 * Math.sin(along * 2 * Math.PI / (unit * 5));
  } else if (spec.path === 'eight') {
    const r = unit * 1.7, turn = along / r;
    forward = r * Math.sin(turn); side = r * .55 * Math.sin(2 * turn);
  } else if (spec.path === 'zigzag') {
    // A triangle with its corners rounded: straight legs, turns that are not a jolt.
    side = unit * .9 * (2 / Math.PI) * Math.asin(.94 * Math.sin(along * 2 * Math.PI / (unit * 4.5)));
  }
  return [forward * fx + side * sx, forward * fy + side * sy];
}

// The camera's way as segments, each a pure function of time. The camera's
// place is the point of the wall under the centre of the lens.
function route(spec) {
  const segments = [];
  const count = spec.media.length;
  const speed = Math.hypot(spec.drift[0], spec.drift[1]);
  let time = 0, place = [0, 0], rest = false;
  const drifted = (from, fromRest, elapsed) => {
    const [dx, dy] = pathAt(spec, speed * driftTime(elapsed, fromRest));
    return [from[0] + dx, from[1] + dy];
  };
  for (const [index, stop] of spec.stops.entries()) {
    const leave = stop.at - stop.travel;
    if (leave > time + 1e-9) segments.push({kind: 'drift', t0: time, t1: leave, from: place, rest});
    const from = drifted(place, rest, leave - time);
    const before = drifted(place, rest, Math.max(0, leave - time - 1e-3));
    const velocity = leave - time > 1e-3 ? [(from[0] - before[0]) / 1e-3, (from[1] - before[1]) / 1e-3]
      : rest ? [0, 0] : [spec.drift[0], spec.drift[1]];
    const cell = nearestCell(spec, from, velocity, stop.media, count);
    const to = cellCentre(spec, cell[0], cell[1]);
    segments.push({kind: 'travel', t0: leave, t1: stop.at, from, to, velocity, stop: index});
    segments.push({kind: 'stop', t0: stop.at, t1: stop.end, at: to, stop: index, cell});
    time = stop.end; place = to; rest = true;
  }
  if (time < spec.duration) segments.push({kind: 'drift', t0: time, t1: spec.duration, from: place, rest});
  return segments;
}

// The nearest cell that shows the file, far enough to be a journey and, of
// equally near ones, the one ahead of the drift. Ties end by column and row.
function nearestCell(spec, from, velocity, media, count) {
  const {pitchX, pitchY} = spec.tile;
  const least = Math.min(pitchX, pitchY) * 1.5;
  const reach = Math.max(4, count + 2);
  const col0 = Math.round(from[0] / pitchX), row0 = Math.round(from[1] / pitchY);
  let best = null;
  for (let row = row0 - reach; row <= row0 + reach; row++) {
    for (let col = col0 - reach; col <= col0 + reach; col++) {
      if (mediaAt(col, row, count) !== media) continue;
      const [x, y] = cellCentre(spec, col, row);
      const dx = x - from[0], dy = y - from[1], distance = Math.hypot(dx, dy);
      if (distance < least) continue;
      const ahead = (dx * velocity[0] + dy * velocity[1]) / (distance * (Math.hypot(velocity[0], velocity[1]) || 1));
      const score = distance - ahead * least * .5;
      if (!best || score < best.score - 1e-6
          || (Math.abs(score - best.score) <= 1e-6 && (col < best.col || (col === best.col && row < best.row)))) {
        best = {score, col, row};
      }
    }
  }
  return [best.col, best.row];
}

// Where the camera is and what is open at a time of the scene.
export function stateAt(spec, seconds) {
  const time = clamp(seconds, 0, spec.duration);
  const segments = spec.route;
  let segment = segments[segments.length - 1];
  for (const candidate of segments) if (time < candidate.t1) { segment = candidate; break; }
  let x, y, open = null;
  if (segment.kind === 'drift') {
    const [dx, dy] = pathAt(spec, Math.hypot(spec.drift[0], spec.drift[1]) * driftTime(time - segment.t0, segment.rest));
    x = segment.from[0] + dx; y = segment.from[1] + dy;
  } else if (segment.kind === 'travel') {
    const length = segment.t1 - segment.t0, s = clamp((time - segment.t0) / length);
    const h00 = 2 * s * s * s - 3 * s * s + 1, h10 = s * s * s - 2 * s * s + s, h01 = 1 - h00;
    x = h00 * segment.from[0] + h10 * length * segment.velocity[0] + h01 * segment.to[0];
    y = h00 * segment.from[1] + h10 * length * segment.velocity[1] + h01 * segment.to[1];
  } else {
    [x, y] = segment.at;
    const stop = spec.stops[segment.stop];
    if (stop.open > 0) {
      const begin = stop.at + stop.hold, grow = Math.min(.55, stop.open / 2), shrink = Math.min(.45, stop.open / 2);
      let amount = ease(clamp((time - begin) / grow));
      if (stop.close) amount *= 1 - ease(clamp((time - (stop.end - shrink)) / shrink));
      if (time >= begin) open = {stop: segment.stop, media: stop.media, amount};
    }
  }
  return {time, x, y, open};
}

// The lens. A point of the wall `u` pixels from the lens's centre lands
// `reach(u)` pixels from it on the screen: its neighbourhood is `along(u)`
// times larger along the radius and `reach(u) / u` across it. In the centre
// both are `magnify`; far away the wall is its own size again.
export function lensAt(spec, u) {
  const {radius, magnify} = spec.lens;
  const along = 1 + (magnify - 1) * Math.exp(-(u / radius) * (u / radius));
  const reach = u + (magnify - 1) * radius * SQRT_PI_2 * erf(u / radius);
  return {along, across: u > 1e-6 ? reach / u : magnify, reach};
}

// Every tile that reaches into the frame, the far ones first. A tile is drawn
// as its rectangle around (0, 0) under the transform [a, b, c, d, x, y].
export function tilesAt(spec, state) {
  const {width, height, lens, tile} = spec;
  const count = spec.media.length;
  const far = Math.max(Math.hypot(lens.x, lens.y), Math.hypot(width - lens.x, lens.y),
    Math.hypot(lens.x, height - lens.y), Math.hypot(width - lens.x, height - lens.y));
  const half = Math.hypot(tile.width, tile.height) / 2;
  const reach = far + half;
  const col0 = Math.floor((state.x - reach) / tile.pitchX), col1 = Math.ceil((state.x + reach) / tile.pitchX);
  const row0 = Math.floor((state.y - reach) / tile.pitchY) - 1, row1 = Math.ceil((state.y + reach) / tile.pitchY);
  const tiles = [];
  for (let row = row0; row <= row1; row++) {
    for (let col = col0; col <= col1; col++) {
      const [wx, wy] = cellCentre(spec, col, row);
      const dx = wx - state.x, dy = wy - state.y, u = Math.hypot(dx, dy);
      const {along, across} = lensAt(spec, u);
      const x = lens.x + dx * across, y = lens.y + dy * across;
      const size = half * Math.max(along, across);
      if (x < -size || x > width + size || y < -size || y > height + size) continue;
      const rx = u > 1e-6 ? dx / u : 1, ry = u > 1e-6 ? dy / u : 0, stretch = along - across;
      tiles.push({col, row, media: mediaAt(col, row, count), x, y, u,
        a: across + stretch * rx * rx, b: stretch * rx * ry, c: stretch * rx * ry, d: across + stretch * ry * ry,
        scale: Math.max(along, across),
        shade: spec.dim * (1 - Math.exp(-(u / lens.radius) * (u / lens.radius)))});
    }
  }
  return tiles.sort((p, q) => q.u - p.u || p.row - q.row || p.col - q.col);
}

// The rectangle an opened picture takes: from its tile under the lens to the
// frame (cover) or to its own shape inside the frame (contain).
export function openRect(spec, stop, amount, natural) {
  const {width, height, lens, tile} = spec;
  const m = lens.magnify;
  const from = {x: lens.x - tile.width * m / 2, y: lens.y - tile.height * m / 2, w: tile.width * m, h: tile.height * m, r: tile.radius * m};
  let to = {x: 0, y: 0, w: width, h: height, r: 0};
  const shape = natural && natural[0] > 0 && natural[1] > 0 ? natural[0] / natural[1] : width / height;
  const frame = width / height;
  // Covering the frame keeps this share of the picture; under 3/4 of it the
  // picture is shown whole instead, unless the stop says which.
  const kept = Math.min(shape / frame, frame / shape);
  const contain = stop.fit === 'contain' || (stop.fit === 'auto' && kept < .75);
  if (contain) {
    const w = shape > frame ? width : height * shape, h = shape > frame ? width / shape : height;
    to = {x: (width - w) / 2, y: (height - h) / 2, w, h, r: 0};
  }
  const mix = (p, q) => p + (q - p) * amount;
  return {x: mix(from.x, to.x), y: mix(from.y, to.y), w: mix(from.w, to.w), h: mix(from.h, to.h), r: mix(from.r, to.r), contain};
}

// ---------------------------------------------------------------- browser

function load(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Lens Wall could not load ${src}`));
    image.src = src;
  });
}

const sizeOf = image => [image.naturalWidth || image.videoWidth || image.width, image.naturalHeight || image.videoHeight || image.height];

// A picture cropped to the tile's shape at one size, so a frame never scales
// a camera photo down to a tile two hundred times.
function thumb(image, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w)); canvas.height = Math.max(1, Math.round(h));
  const [iw, ih] = sizeOf(image);
  const scale = Math.max(canvas.width / iw, canvas.height / ih);
  const sw = canvas.width / scale, sh = canvas.height / scale;
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// The painter: `draw(seconds)` paints the wall on the canvas and places what
// is open. `sources` holds one loaded picture (an image or a canvas) per file
// of the wall; `frames[i]` and `captions[i]` are the elements of stop `i`
// that opens (an element that fills its frame inside), or nothing. A source
// named in `live` changes between frames (a canvas a video is painted into,
// already in the tile's shape): it is drawn as it is at that moment.
export function createPainter({canvas, spec, sources, frames = [], captions = [], live = []}) {
  canvas.width = spec.width; canvas.height = spec.height;
  const context = canvas.getContext('2d');
  const {tile, lens} = spec;
  const levels = sources.map((image, index) => (live[index] ? [image, image] : [
    thumb(image, tile.width * 1.25, tile.height * 1.25),
    thumb(image, tile.width * lens.magnify, tile.height * lens.magnify),
  ]));
  const natural = spec.stops.map(stop => sizeOf(sources[stop.media]));
  const [r, g, b] = [1, 3, 5].map(at => parseInt(spec.background.slice(at, at + 2), 16));
  const shadeOf = alpha => `rgba(${r},${g},${b},${alpha})`;

  return function draw(seconds) {
    const state = stateAt(spec, seconds);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = spec.background;
    context.fillRect(0, 0, spec.width, spec.height);
    for (const t of tilesAt(spec, state)) {
      context.setTransform(t.a, t.b, t.c, t.d, t.x, t.y);
      context.save();
      context.beginPath();
      context.roundRect(-tile.width / 2, -tile.height / 2, tile.width, tile.height, tile.radius);
      context.clip();
      context.drawImage(levels[t.media][t.scale > 1.25 ? 1 : 0], -tile.width / 2, -tile.height / 2, tile.width, tile.height);
      if (t.shade > .004) {
        context.fillStyle = shadeOf(t.shade);
        context.fillRect(-tile.width / 2, -tile.height / 2, tile.width, tile.height);
      }
      context.restore();
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    if (state.open) {
      context.fillStyle = shadeOf(.86 * state.open.amount);
      context.fillRect(0, 0, spec.width, spec.height);
    }
    spec.stops.forEach((stop, index) => {
      const frame = frames[index], caption = captions[index];
      const on = state.open?.stop === index && state.open.amount > 0;
      if (caption) caption.style.opacity = on ? String(clamp((state.open.amount - .55) / .45)) : '0';
      if (!frame) return;
      frame.style.visibility = on ? 'visible' : 'hidden';
      if (!on) return;
      const rect = openRect(spec, stop, state.open.amount, natural[index]);
      Object.assign(frame.style, {left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px`, borderRadius: `${rect.r}px`});
    });
    return state;
  };
}

// A video of the wall as a canvas that holds its frame at the film's moment,
// cropped to cover `width` x `height`. `input` is the <video> the composition
// declares for it: HyperFrames plays and seeks it in a preview, and in a
// render puts the decoded frame next to it as an image and seeks again.
function videoSource(input, width, height, repaint) {
  const element = document.createElement('canvas');
  element.width = Math.max(1, Math.round(width)); element.height = Math.max(1, Math.round(height));
  const context = element.getContext('2d', {alpha: false});
  let shown = null;
  const paint = (frame, w, h) => {
    const scale = Math.max(element.width / w, element.height / h);
    context.drawImage(frame, (element.width - w * scale) / 2, (element.height - h * scale) / 2, w * scale, h * scale);
  };
  // True when the canvas now holds another frame than before.
  function refresh() {
    const injected = input.nextElementSibling;
    if (injected?.classList?.contains('__render_frame__')) {
      if (!injected.complete || !injected.naturalWidth || injected.src === shown) return false;
      shown = injected.src; paint(injected, injected.naturalWidth, injected.naturalHeight);
      return true;
    }
    if (input.readyState < 2 || !input.videoWidth) return false;
    paint(input, input.videoWidth, input.videoHeight);
    return true;
  }
  const changed = () => { if (refresh()) repaint(); };
  for (const name of ['loadeddata', 'seeked']) input.addEventListener(name, changed);
  window.addEventListener('hf-seek', changed);
  const held = window.__HF_RENDER_FRAME_VIDEO_IDS?.includes(input.getAttribute('data-hf-render-id') || input.id);
  const ready = held || input.readyState >= 2 ? Promise.resolve() : new Promise((resolve, reject) => {
    input.addEventListener('loadeddata', resolve, {once: true});
    input.addEventListener('error', () => reject(new Error(`Lens Wall could not load ${input.getAttribute('src')}`)), {once: true});
  });
  return {element, refresh, ready, size: () => [input.videoWidth || element.width, input.videoHeight || element.height],
    dispose() { for (const name of ['loadeddata', 'seeked']) input.removeEventListener(name, changed); window.removeEventListener('hf-seek', changed); }};
}

// The wall as a composition of its own (build.mjs writes the markup): the
// scene's time comes from a GSAP clock whose setter paints. A video plays in
// its tiles from the input the markup declares for it.
export async function mount(root, spec, gsap) {
  if (!root || !gsap?.timeline) throw new Error('Lens Wall needs its root and the page\'s GSAP');
  let draw = () => {}, time = 0;
  const big = [spec.tile.width * spec.lens.magnify, spec.tile.height * spec.lens.magnify];
  const videos = [];
  const sources = await Promise.all(spec.media.map(async (item, index) => {
    if (item.kind !== 'video') return load(item.src);
    const video = videoSource(root.querySelector(`[data-lens-input="${index}"]`), big[0], big[1], () => draw(time));
    videos.push(video);
    await video.ready;
    video.refresh();
    if (item.size) { video.element.naturalWidth = item.size[0]; video.element.naturalHeight = item.size[1]; }
    return video.element;
  }));
  if (document.fonts?.ready) await document.fonts.ready;
  const frames = spec.stops.map((_, index) => root.querySelector(`[data-lens-open="${index}"]`));
  const captions = spec.stops.map((_, index) => root.querySelector(`[data-lens-caption="${index}"]`));
  for (const caption of captions) {
    if (!caption) continue;
    // One line that fits the frame: a long caption is set smaller, never cut.
    const room = caption.parentElement.clientWidth;
    if (caption.scrollWidth > room) caption.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(caption).fontSize) * room / caption.scrollWidth)}px`;
  }
  const paint = createPainter({canvas: root.querySelector('canvas[data-lens-wall]'), spec, sources, frames, captions,
    live: spec.media.map(item => item.kind === 'video')});
  draw = seconds => { for (const video of videos) video.refresh(); return paint(seconds); };
  const clock = {get time() { return time; }, set time(value) { time = clamp(value, 0, spec.duration); draw(time); }};
  const timeline = gsap.timeline({paused: true}).to(clock, {time: spec.duration, duration: spec.duration, ease: 'none'}, 0);
  draw(0);
  root.lensWall = {spec, draw, get time() { return time; }, dispose() { timeline.kill(); for (const video of videos) video.dispose(); delete root.lensWall; }};
  return {timeline};
}
