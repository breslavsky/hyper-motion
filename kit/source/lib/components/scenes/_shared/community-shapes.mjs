// Community moves rebuilt for native clocks, instance-local DOM and the film's design tokens.
// Provenance is in metadata.from and tools/techniques.json; no source-page styling is retained.
import metadata from '../../metadata.mjs';

const TAU = Math.PI * 2;
const clamp = value => Math.min(1, Math.max(0, value));
const progress = (time, start, duration) => clamp((time - start) / duration);
const backOut = value => {
  const u = clamp(value) - 1;
  return 1 + 3.2 * u * u * u + 2.2 * u * u;
};

/** Equal-angle radii let unlike outlines interpolate without changing their topology. */
export function samplePolarShape(name, count = 240) {
  if (name === 'circle') return Array(count).fill(1);
  const n = name === 'triangle' ? 3 : name === 'star' ? 10 : 4;
  const offset = name === 'square' ? Math.PI / 4 : -Math.PI / 2;
  const vertices = Array.from({length: n}, (_, i) => {
    const angle = offset + TAU * i / n;
    const radius = name === 'star' && i % 2 ? 0.46 : name === 'triangle' ? 1.2 : 1.27;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
  return Array.from({length: count}, (_, index) => {
    const angle = TAU * index / count, dx = Math.cos(angle), dy = Math.sin(angle);
    let distance = Infinity;
    for (let i = 0; i < vertices.length; i++) {
      const [ax, ay] = vertices[i], [bx, by] = vertices[(i + 1) % vertices.length];
      const ex = bx - ax, ey = by - ay, cross = dx * ey - dy * ex;
      if (Math.abs(cross) < 1e-9) continue;
      const ray = (ax * ey - ay * ex) / cross, edge = (ax * dy - ay * dx) / cross;
      if (ray > 0 && edge >= -1e-6 && edge <= 1 + 1e-6) distance = Math.min(distance, ray);
    }
    return distance;
  });
}

/** Evaluate directly from the requested time, including negative echo times. */
export function polarPose(time, schedule, outlines, delay = 0) {
  let index = 0, amount = 0;
  for (const [i, change] of schedule.changes.entries()) {
    if (time >= change.at + delay) {
      index = i;
      amount = backOut(progress(time, change.at + delay, change.duration));
    }
  }
  const a = outlines[index], b = outlines[index + 1] ?? a;
  const radii = a.map((radius, i) => radius + (b[i] - radius) * amount);
  const rotation = schedule.changes.reduce((angle, change) => angle + TAU / 3 * backOut(progress(time, change.at + delay, change.duration)), 0);
  return {radii, rotation};
}

export function letterFlipPose(time, start, duration) {
  const k = progress(time, start, duration), eased = 1 - (1 - k) ** 2;
  const angle = k === 1 ? 0 : -450 * (1 - eased);
  return {angle, back: Math.cos(angle * Math.PI / 180) < 0, visible: time >= start};
}

function pathData(radii, rotation, radius, x = 0, y = 0) {
  return radii.map((r, i) => {
    const a = TAU * i / radii.length + rotation;
    return `${i ? 'L' : 'M'}${(x + Math.cos(a) * r * radius).toFixed(2)},${(y + Math.sin(a) * r * radius).toFixed(2)}`;
  }).join('') + 'Z';
}

function svgElement(parent, tag, attributes = {}) {
  const node = parent.ownerDocument.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  parent.appendChild(node);
  return node;
}

export function createFamily(K) {
  const sceneFactories = {};
  const polar = {...metadata.polar, build({p, cam, fg, accent}) {
    const {S, safe, el, set, px} = K;
    const scene = p.scene, len = p.ldur ?? p.dur, schedule = this.times(scene, len, p.beatLen);
    const outlines = (scene.shapes ?? ['circle', 'triangle', 'star', 'square']).map(shape => samplePolarShape(shape));
    const labelled = Boolean(scene.label);
    const diagramHeight = safe.h * (labelled ? 0.72 : 0.92);
    const diameter = Math.min(safe.w * 0.94, diagramHeight);
    const cx = safe.x + safe.w / 2, cy = safe.y + safe.h * (labelled ? 0.6 : 0.5);
    const svg = svgElement(cam, 'svg', {viewBox: '-500 -500 1000 1000', width: diameter, height: diameter, 'aria-hidden': 'true'});
    set(svg, {position: 'absolute', left: px(cx - diameter / 2), top: px(cy - diameter / 2), overflow: 'visible'});
    // All visual geometry, including satellites and spring overshoot, stays within the view box.
    const echoes = Array.from({length: 6}, () => svgElement(svg, 'path', {fill: 'none', stroke: accent, 'stroke-width': 2.5}));
    const hero = svgElement(svg, 'path', {fill: fg});
    const satellites = scene.satellites === false ? [] : Array.from({length: 12}, () => svgElement(svg, 'path', {fill: accent}));
    let label = null;
    if (labelled) {
      label = el('div', 'display', cam, scene.label);
      set(label, {position: 'absolute', left: px(safe.x + safe.w * 0.04), top: px(safe.y + safe.h * 0.025), width: px(safe.w * 0.92), color: fg, textAlign: 'center'});
      K.design.fitSize(label, safe.w * 0.92, K.design.type('sceneTitle').lineHeight*2, 'sceneTitle');
    }
    return time => {
      const growth = backOut(progress(time, schedule.reveal, schedule.grow));
      const radius = 175 * growth;
      const pose = polarPose(time, schedule, outlines);
      const echoStep = Math.min(len * 0.01, schedule.changes[0].duration * 0.12);
      const earlier = polarPose(time - echoStep, schedule, outlines);
      const speed = Math.abs(pose.rotation - earlier.rotation) / Math.max(1e-6, echoStep);
      for (let i = 0; i < echoes.length; i++) {
        const age = echoes.length - i, old = polarPose(time - echoStep * age, schedule, outlines);
        echoes[i].setAttribute('d', pathData(pose.radii, old.rotation, radius));
        echoes[i].setAttribute('opacity', (clamp(speed / 8) * (0.48 - age * 0.06)).toFixed(4));
      }
      hero.setAttribute('d', pathData(pose.radii, pose.rotation, radius));
      satellites.forEach((node, i) => {
        const open = 1 - (1 - progress(time, schedule.reveal + i * schedule.grow * 0.025, schedule.grow)) ** 3;
        const angle = time / len * 0.8 + TAU * i / satellites.length - Math.PI / 2;
        const satellite = polarPose(time, schedule, outlines, schedule.changes[0].duration * (0.12 + i * 0.018));
        node.setAttribute('d', pathData(satellite.radii, satellite.rotation + angle, 21 * open, Math.cos(angle) * 385 * open, Math.sin(angle) * 385 * open));
      });
      if (label) set(label, {opacity: clamp((time - schedule.reveal) / schedule.grow).toFixed(4)});
    };
  }};
  sceneFactories.polar = given => polar.build(given);

  const letterflip = {...metadata.letterflip, build({p, cam, fg, accent}) {
    const {S, safe, el, set, px} = K;
    const schedule = this.times(p.scene, p.ldur ?? p.dur, p.beatLen);
    const wrap = el('div', 'center', cam);
    const line = el('div', 'display', wrap);
    line.setAttribute('aria-label', p.scene.text);
    set(line, {color: fg, textAlign: 'center', perspective: px(1400 * S), overflow: 'visible', padding: '0.12em 0'});
    if (/[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/u.test(p.scene.text)) line.setAttribute('dir', 'rtl');
    const letters = [];
    for (const [groupIndex, group] of schedule.groups.entries()) {
      if (groupIndex) line.appendChild(line.ownerDocument.createTextNode(' '));
      const word = el('span', 'word', line);
      set(word, {display: 'inline-block', whiteSpace: 'nowrap', transformStyle: 'preserve-3d'});
      for (const text of group) {
        const glyph = el('span', 'glyph', word, text);
        // The scene camera intentionally translates this centered 3D flip.
        // Its projected bounding-box center travels; it is not a stationary
        // 2D spinner. Keep the pivot invariant checked in the native probe.
        glyph.setAttribute('data-layout-allow-orbit', '');
        set(glyph, {display: 'inline-block', transformOrigin: '50% 50%', backfaceVisibility: 'visible', transformStyle: 'preserve-3d'});
        letters.push(glyph);
      }
    }
    K.design.fitSize(line, safe.w * 0.88, safe.h * 0.62, 'hero');
    return time => {
      letters.forEach((node, i) => {
        const action = schedule.letters[i], pose = letterFlipPose(time, action.at, action.duration);
        set(node, {transform: `rotateY(${pose.angle.toFixed(3)}deg)`, color: pose.back ? accent : fg, visibility: pose.visible ? 'visible' : 'hidden'});
      });
    };
  }};
  sceneFactories.letterflip = given => letterflip.build(given);
  return {sceneFactories};
}
