// One camera over a page that is one world: the page's content lies on a
// sheet, and the camera is the one transform of that sheet. It goes from
// stop to stop without a cut, each stop a thing of the page to look at, and
// on top of that way it takes the hits of the music, a little life of the
// hand, and the blur of its own speed. Taken out of the `ride` scene, which
// has had this camera since it was written and now uses this file.
//
// Every answer is a pure function of the time asked for: the same moment
// gives the same camera whatever was asked before, so a page seeks backwards
// and renders the same every time.

export const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
export const mix = (a, b, k) => a + (b - a) * k;
/** A move that speeds up and then slows down. */
export const smooth = u => { const k = clamp(u); return k * k * (3 - 2 * k); };

/** The pose that shows a rectangle of the world whole, taking `fill` of the view. */
export function lookAt(rect, view, {fill = 0.8, least = 0, most = Infinity} = {}) {
  if (!(rect.w > 0 && rect.h > 0)) throw new Error('camera: a thing to look at has no size');
  return {x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, zoom: clamp(Math.min(view.w * fill / rect.w, view.h * fill / rect.h), least, most)};
}

/**
 * The pose on the way from `a` to `b`, `k` of the way there (0..1, eased by
 * the caller). In the middle of the way the camera stands back by `pull` of
 * its zoom, as one does to see where one is going.
 */
export function travel(a, b, k, pull = 0.1) {
  const pose = {x: mix(a.x, b.x, k), y: mix(a.y, b.y, k), zoom: mix(a.zoom, b.zoom, k) * (1 - pull * Math.sin(Math.PI * k))};
  if (a.roll !== undefined || b.roll !== undefined) pose.roll = mix(a.roll ?? 0, b.roll ?? 0, k);
  return pose;
}

/**
 * A way through stops. Each stop: `at`, the moment the camera is there; its
 * pose `{x, y, zoom, roll?}`; and `move`, how long the way to it takes (by
 * default most of the time since the stop before, 1.2 s at most). Returns the
 * pose at a moment.
 */
export function cameraPath(stops, {pull = 0.1} = {}) {
  if (!Array.isArray(stops) || !stops.length) throw new Error('camera: a path needs at least one stop');
  const way = stops.map((stop, i) => {
    if (!Number.isFinite(stop.at)) throw new Error(`camera: stop ${i + 1} has no time`);
    if (i && stop.at <= stops[i - 1].at) throw new Error(`camera: stop ${i + 1} is not after stop ${i}`);
    const gap = i ? stop.at - stops[i - 1].at : 0;
    return {...stop, move: i ? clamp(stop.move ?? Math.min(gap * 0.7, 1.2), 0.05, gap) : 0};
  });
  return l => {
    let i = way.findIndex(stop => l < stop.at);
    if (i < 0) return {...way.at(-1).pose};
    if (i === 0) return {...way[0].pose};
    const to = way[i], from = way[i - 1];
    return travel(from.pose, to.pose, smooth((l - (to.at - to.move)) / to.move), to.pull ?? pull);
  };
}

/** How much a hit lifts the zoom at a moment: up at once and down slowly, smooth at both ends. 0..1. */
export function kick(l, hits, decay = 0.3) {
  let most = 0;
  for (const hit of hits ?? []) {
    const u = (l - hit) / decay;
    // The top comes a quarter of the way in; it leaves rest and comes back to it without a corner.
    if (u > 0 && u < 1) most = Math.max(most, Math.sin(Math.PI * (1 - (1 - u) ** 2.5)) ** 2);
  }
  return most;
}

/** The life of a hand that holds the camera: a slow wander that repeats for its seed. */
export function drift(l, {amount = 0, rate = 0.35, seed = 1} = {}) {
  if (!amount) return {x: 0, y: 0, roll: 0};
  const wave = (n, f) => Math.sin(l * rate * f * 2 * Math.PI + seed * n * 1.7);
  return {
    x: (wave(1, 1) * 0.6 + wave(2, 2.3) * 0.3 + wave(3, 4.1) * 0.1) * amount,
    y: (wave(4, 0.8) * 0.6 + wave(5, 1.9) * 0.3 + wave(6, 3.7) * 0.1) * amount * 0.8,
    roll: (wave(7, 0.6) * 0.7 + wave(8, 1.7) * 0.3) * amount * 0.0006,
  };
}

/**
 * A whole camera: a path, the hits it takes, its life, and its speed.
 *   view   {w, h}: the frame
 *   eye    {x, y}: where on the frame the looked-at point stands (the middle by default)
 *   stops  as for cameraPath
 *   hits   moments of the music the camera takes; `punch` how much (a share of the zoom), `decay` how long
 *   life   {amount (px), rate, seed}
 *   blur   how much of its speed the camera shows, in seconds of shutter (0 for none)
 * `at(l)` gives `{x, y, zoom, roll, shift: {x, y}, speed, blur}`: speed in px of the frame a second.
 */
export function createCamera({view, eye, stops, hits = [], punch = 0.04, decay = 0.3, life, blur = 0.0025, pull} = {}) {
  if (!(view?.w > 0 && view?.h > 0)) throw new Error('camera: the view needs a size');
  const centre = eye ?? {x: view.w / 2, y: view.h / 2}, way = cameraPath(stops, {pull});
  const bare = l => {
    const pose = way(l), hand = drift(l, life);
    return {x: pose.x, y: pose.y, zoom: pose.zoom * (1 + punch * kick(l, hits, decay)), roll: (pose.roll ?? 0) * Math.PI / 180 + hand.roll, shift: {x: hand.x, y: hand.y}};
  };
  // Where a point of the world stands on the frame.
  const seen = (state, x, y) => {
    const c = Math.cos(state.roll), s = Math.sin(state.roll), dx = (x - state.x) * state.zoom, dy = (y - state.y) * state.zoom;
    return [centre.x + state.shift.x + dx * c - dy * s, centre.y + state.shift.y + dx * s + dy * c];
  };
  const at = l => {
    const state = bare(l), dt = 1 / 240, before = bare(l - dt), after = bare(l + dt);
    // Its speed is that of the frame's corner over the world: a pan, a zoom and a turn all count.
    const [x0, y0] = seen(before, state.x + view.w / 2 / state.zoom, state.y + view.h / 2 / state.zoom);
    const [x1, y1] = seen(after, state.x + view.w / 2 / state.zoom, state.y + view.h / 2 / state.zoom);
    const speed = Math.hypot(x1 - x0, y1 - y0) / (2 * dt);
    return {...state, speed, blur: speed * blur};
  };
  /** The transform of the sheet, its origin at its top left corner. */
  const css = (state, px = value => `${value.toFixed(3)}px`) =>
    `translate(${px(centre.x + state.shift.x)},${px(centre.y + state.shift.y)}) rotate(${state.roll.toFixed(6)}rad) scale(${state.zoom.toFixed(5)}) translate(${px(-state.x)},${px(-state.y)})`;
  return {at, css, seen, eye: centre};
}

/** The rectangle an element takes in the world it lies in, as it is laid out (no transforms). */
export function rectIn(world, node) {
  let x = 0, y = 0;
  for (let step = node; step && step !== world; step = step.offsetParent) { x += step.offsetLeft; y += step.offsetTop; }
  return {x, y, w: node.offsetWidth, h: node.offsetHeight};
}

/**
 * The camera of a page. `world` is the element everything lies in; a stop
 * says what to look at:
 *   {at: 2, look: 'chart', fill: 0.8}    an element with data-cam="chart" (or an element, or {x, y, w, h})
 *   {at: 6, look: 'all'}                 everything that has a data-cam
 *   {at: 4, x: 900, y: 400, zoom: 2}     a pose given outright
 * with `roll` (degrees), `move` and `pull` as for cameraPath. Options:
 * `width`, `height`, `duration`, `hits`, `punch`, `decay`, `life`, `blur`,
 * `eye`. Returns `{draw(l), at(l), attach(timeline, start)}`: `attach` puts
 * the camera on the page's own GSAP timeline.
 */
export function mountCamera(world, {width, height, duration, stops, least = 0.2, most = 8, ...rest}) {
  if (!world) throw new Error('camera: no world to look at');
  if (!(duration > 0)) throw new Error('camera: the camera needs a duration');
  const view = {w: width, h: height}, named = [...world.querySelectorAll('[data-cam]')];
  const rectOf = look => {
    if (look === 'all') {
      if (!named.length) return {x: 0, y: 0, w: world.offsetWidth || width, h: world.offsetHeight || height};
      const all = named.map(node => rectIn(world, node));
      const x0 = Math.min(...all.map(r => r.x)), y0 = Math.min(...all.map(r => r.y));
      return {x: x0, y: y0, w: Math.max(...all.map(r => r.x + r.w)) - x0, h: Math.max(...all.map(r => r.y + r.h)) - y0};
    }
    if (typeof look === 'string') {
      const node = named.find(item => item.dataset.cam === look);
      if (!node) throw new Error(`camera: nothing on the page has data-cam="${look}" (there ${named.length ? `are ${named.map(item => item.dataset.cam).join(', ')}` : 'is none'})`);
      return rectIn(world, node);
    }
    return look?.nodeType === 1 ? rectIn(world, look) : look;
  };
  const posed = stops.map((stop, i) => {
    const pose = stop.look === undefined ? {x: stop.x, y: stop.y, zoom: stop.zoom ?? 1} : lookAt(rectOf(stop.look), view, {fill: stop.fill ?? 0.8, least, most});
    if (stop.look !== undefined && stop.zoom !== undefined) pose.zoom = stop.zoom;
    if (![pose.x, pose.y, pose.zoom].every(Number.isFinite)) throw new Error(`camera: stop ${i + 1} says neither what to look at nor a pose`);
    return {at: stop.at, move: stop.move, pull: stop.pull, pose: {...pose, roll: stop.roll ?? 0}};
  });
  const camera = createCamera({view, stops: posed, ...rest});
  Object.assign(world.style, {transformOrigin: '0 0', willChange: 'transform'});
  const draw = l => {
    const state = camera.at(l);
    world.style.transform = camera.css(state);
    world.style.filter = state.blur > 0.4 ? `blur(${Math.min(state.blur, 16).toFixed(2)}px)` : 'none';
    return state;
  };
  // The page's clock is a function GSAP calls: a plain number tweened, the camera drawn on every update.
  const attach = (timeline, start = 0) => {
    const clock = {time: 0};
    timeline.to(clock, {time: duration, duration, ease: 'none', onUpdate: () => draw(clock.time)}, start);
    draw(0);
    return timeline;
  };
  draw(0);
  return {draw, at: camera.at, seen: camera.seen, attach};
}
