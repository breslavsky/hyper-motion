// The geometry of kinetic-burst-words that needs no renderer: a glyph's
// outline as closed loops of points, a letter broken along a straight line
// into whole pieces, and a line of text laid out by its glyphs' advances.
// The scene (scenes/kinetic-burst-words.mjs) extrudes what this returns.

/** A generator of numbers in 0..1 that repeats for its seed. */
export const seeded = seed => {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Twice the area of a loop, signed: negative for a clockwise one (y up). */
export const area2 = loop => {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x0, y0] = loop[i], [x1, y1] = loop[(i + 1) % loop.length];
    sum += x0 * y1 - x1 * y0;
  }
  return sum;
};

const inside = (loop, [x, y]) => {
  let odd = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [xi, yi] = loop[i], [xj, yj] = loop[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) odd = !odd;
  }
  return odd;
};

/** A glyph's contours ("M x y L x y Q cx cy x y C c1 c2 x y Z") as loops of points, its curves in `steps` chords. */
export function loops(path, steps = 6) {
  const words = String(path ?? '').trim().split(/\s+/).filter(Boolean), out = [];
  let loop = null, at = 0;
  const number = () => Number(words[at++]), point = () => [number(), number()];
  const close = () => {
    if (!loop) return;
    const last = loop[loop.length - 1], first = loop[0];
    if (loop.length > 1 && last[0] === first[0] && last[1] === first[1]) loop.pop();
    if (loop.length >= 3) out.push(loop);
    loop = null;
  };
  while (at < words.length) {
    const command = words[at++];
    if (command === 'M') { close(); loop = [point()]; }
    else if (command === 'L') loop.push(point());
    else if (command === 'Q') {
      const [x0, y0] = loop[loop.length - 1], [cx, cy] = point(), [x, y] = point();
      for (let i = 1; i <= steps; i++) { const k = i / steps, m = 1 - k; loop.push([m * m * x0 + 2 * m * k * cx + k * k * x, m * m * y0 + 2 * m * k * cy + k * k * y]); }
    } else if (command === 'C') {
      const [x0, y0] = loop[loop.length - 1], [ax, ay] = point(), [bx, by] = point(), [x, y] = point();
      for (let i = 1; i <= steps; i++) { const k = i / steps, m = 1 - k; loop.push([m ** 3 * x0 + 3 * m * m * k * ax + 3 * m * k * k * bx + k ** 3 * x, m ** 3 * y0 + 3 * m * m * k * ay + 3 * m * k * k * by + k ** 3 * y]); }
    } else if (command === 'Z') close();
    else throw new Error(`Unknown outline command: ${command}`);
  }
  close();
  return out;
}

/**
 * The part of a shape on one side of a straight line, as whole loops.
 * `shape` is loops read by the even-odd rule with the filled side always on
 * one hand of the way round (outer loops one way, holes the other), as a
 * font draws them. The line goes through `point` across `normal`; the side
 * kept is where (p - point) . normal > 0. Where the line crosses the shape
 * the cut is closed along the line, so a letter cut through a hole comes
 * out as solid pieces and not as a ring with a slit.
 */
export function half(shape, point, normal) {
  const side = ([x, y]) => { const d = (x - point[0]) * normal[0] + (y - point[1]) * normal[1]; return d === 0 ? 1e-9 : d; };
  const along = ([x, y]) => (x - point[0]) * -normal[1] + (y - point[1]) * normal[0];
  const whole = [], chains = [];
  for (const loop of shape) {
    const d = loop.map(side);
    if (d.every(v => v > 0)) { whole.push(loop); continue; }
    if (d.every(v => v < 0)) continue;
    // Start outside, so every kept run of points is entered and left once.
    const first = d.findIndex(v => v < 0), n = loop.length;
    let chain = null;
    for (let step = 0; step < n; step++) {
      const i = (first + step) % n, j = (i + 1) % n;
      if (d[i] > 0) chain.points.push(loop[i]);
      if ((d[i] > 0) !== (d[j] > 0)) {
        const k = d[i] / (d[i] - d[j]), cross = [loop[i][0] + (loop[j][0] - loop[i][0]) * k, loop[i][1] + (loop[j][1] - loop[i][1]) * k];
        if (d[j] > 0) chain = {points: [cross], from: along(cross)};
        else { chain.points.push(cross); chain.to = along(cross); chains.push(chain); chain = null; }
      }
    }
  }
  // Along the line the crossings alternate: into the shape, out of it. Each such pair is one closing edge.
  const ends = chains.flatMap(chain => [{at: chain.from, chain, enters: true}, {at: chain.to, chain, enters: false}]).sort((a, b) => a.at - b.at);
  const next = new Map();
  for (let i = 0; i + 1 < ends.length; i += 2) {
    const [a, b] = [ends[i], ends[i + 1]];
    if (a.enters === b.enters) continue; // a crossing too close to tell: that sliver is dropped
    const [leaves, enters] = a.enters ? [b, a] : [a, b];
    next.set(leaves.chain, enters.chain);
  }
  const closed = [], used = new Set();
  for (const start of chains) {
    if (used.has(start)) continue;
    const loop = [];
    let chain = start, sound = true;
    while (chain && !used.has(chain)) { used.add(chain); loop.push(...chain.points); chain = next.get(chain); }
    if (chain !== start) sound = false;
    if (sound && loop.length >= 3) closed.push(loop);
  }
  return [...whole, ...closed];
}

/** Loops sorted into solids: each an outer loop with the holes that lie in it. Slivers under `least` of area are dropped. */
export function solids(shape, least = 0) {
  const kept = shape.filter(loop => Math.abs(area2(loop)) / 2 > least);
  if (!kept.length) return [];
  // The largest loop is an outer one; every loop that turns its way is outer too.
  const outerSign = Math.sign(area2(kept.reduce((a, b) => (Math.abs(area2(a)) >= Math.abs(area2(b)) ? a : b))));
  const outers = kept.filter(loop => Math.sign(area2(loop)) === outerSign).map(loop => ({outer: loop, holes: []}));
  for (const hole of kept.filter(loop => Math.sign(area2(loop)) !== outerSign)) {
    const home = outers.filter(solid => inside(solid.outer, hole[0])).sort((a, b) => Math.abs(area2(a.outer)) - Math.abs(area2(b.outer)))[0];
    if (home) home.holes.push(hole);
  }
  return outers;
}

const boxOf = loopsOf => {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const loop of loopsOf) for (const [x, y] of loop) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return {x0, y0, x1, y1, w: x1 - x0, h: y1 - y0};
};

/**
 * A glyph broken into pieces: one straight cut near its middle, at an angle
 * of its own. A glyph too small to break (a full stop) stays whole. Each
 * piece: its loops, and its middle, which it turns about.
 */
export function shatter(shape, random, em = 1000) {
  const all = solids(shape, em * em * 2e-5);
  if (!all.length) return [];
  const box = boxOf(all.map(solid => solid.outer));
  const small = box.w * box.h < em * em * 0.06;
  const angle = (random() - 0.5) * 1.5 + (box.h > box.w * 1.6 ? 0 : Math.PI / 2) * (random() < 0.7 ? 1 : 0);
  const normal = [Math.sin(angle), Math.cos(angle)];
  const point = [box.x0 + box.w * (0.38 + 0.24 * random()), box.y0 + box.h * (0.38 + 0.24 * random())];
  const parts = small ? all : [...solids(half(shape, point, normal), em * em * 4e-4), ...solids(half(shape, point, [-normal[0], -normal[1]]), em * em * 4e-4)];
  // A glyph whose own contours overlap (a cedilla drawn over its letter) cannot be read by the even-odd
  // rule: where the pieces do not add up to the glyph, it stays whole.
  const filled = list => list.reduce((sum, solid) => sum + (Math.abs(area2(solid.outer)) - solid.holes.reduce((inner, hole) => inner + Math.abs(area2(hole)), 0)) / 2, 0);
  const sound = parts.length && Math.abs(filled(parts) - filled(all)) <= filled(all) * 0.03;
  return (sound ? parts : all).map(solid => {
    const b = boxOf([solid.outer]);
    return {...solid, middle: [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2], size: Math.max(b.w, b.h)};
  });
}

/** A line's glyphs with their places, in font units: x runs from 0, the baseline is y = 0. Words carry `word`. */
export function lay(font, text) {
  const units = [];
  let x = 0, word = 0;
  for (const ch of Array.from(String(text ?? '').trim().replace(/\s+/gu, ' '))) {
    if (ch === ' ') { x += (font.glyphs[' ']?.[0] ?? font.unitsPerEm * 0.28); word++; continue; }
    const glyph = font.glyphs[ch];
    if (!glyph) throw new Error(`kinetic-burst-words: ${font.family} ${font.weight} has no ${JSON.stringify(ch)}; the line is set in letters, digits and marks of Latin and Cyrillic`);
    if (glyph[1]) units.push({ch, x, advance: glyph[0], path: glyph[1], word, index: units.length});
    x += glyph[0];
  }
  return {units, width: x, words: word + 1};
}
