// SVG presentation only. The model owns time, actions, ownership and camera.
const NS = 'http://www.w3.org/2000/svg';
let serial = 0;
const clamp = value => Math.max(0, Math.min(1, Number(value)));
const set = (node, attributes) => {
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
};
const svgElement = (document, tag, parent, attributes = {}, text) => {
  const node = document.createElementNS(NS, tag);
  set(node, attributes);
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
};

export async function createView({ root, width, height, style, layout, labels = {} }) {
  if (!root || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error('ui-world view requires an attached root and positive frame dimensions.');
  }
  const document = root.ownerDocument;
  const copy = { switch: 'FOCUS', slider: 'INTENSITY', ...labels };
  for (const key of ['switch', 'slider']) if (typeof copy[key] !== 'string' || !copy[key].trim()) throw new Error(`labels.${key} must contain visible text.`);
  await document.fonts.load(`600 24px "${style.font}"`, `${copy.switch} ${copy.slider} 0123456789`);
  await document.fonts.ready;
  const s = (tag, parent, attributes, text) => svgElement(document, tag, parent, attributes, text);
  const id = `ui-world-grid-${++serial}`;
  const svg = s('svg', root, {
    xmlns: NS, width, height, viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none', role: 'img', 'aria-label': 'A focus switch becomes an intensity slider',
    'data-ui-world': '',
  });
  Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', overflow: 'hidden' });
  const defs = s('defs', svg);
  const pattern = s('pattern', defs, { id, width: 24, height: 24, patternUnits: 'userSpaceOnUse' });
  s('circle', pattern, { cx: 12, cy: 12, r: .7, fill: style.muted, opacity: .22 });
  s('rect', svg, { x: 0, y: 0, width, height, fill: style.bg, 'data-world-background': '' });
  const world = s('g', svg, { 'data-world-camera': '' });
  const grid = s('rect', world, { fill: `url(#${id})`, 'aria-hidden': 'true' });

  const sw = layout.switch;
  const switchGroup = s('g', world, { 'data-widget': 'switch' });
  const switchTrack = { x: sw.cx - sw.w / 2, y: sw.cy - sw.h / 2, width: sw.w, height: sw.h, rx: sw.h / 2 };
  s('rect', switchGroup, { ...switchTrack, fill: style.control });
  const switchOn = s('rect', switchGroup, { ...switchTrack, fill: style.accent, opacity: 0 });
  s('rect', switchGroup, { ...switchTrack, fill: 'none', stroke: style.fg, 'stroke-opacity': .04, 'stroke-width': .75 });

  const textStyle = {
    'font-family': `"${style.font}", sans-serif`, 'font-size': 24, 'font-weight': 600,
    'letter-spacing': '2.2', 'text-anchor': 'middle', fill: style.muted,
  };
  const switchLabel = s('text', switchGroup, {
    ...textStyle, x: sw.cx, y: sw.cy + sw.h / 2 + 43, 'data-label': 'switch',
  }, copy.switch);

  const slider = layout.slider;
  const dx = slider.end.x - slider.start.x, dy = slider.end.y - slider.start.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 0) { svg.remove(); throw new Error('ui-world slider anchors must be distinct finite points.'); }
  const normal = { x: -dy / length, y: dx / length };
  const sliderGroup = s('g', world, { 'data-widget': 'slider' });
  const line = { x1: slider.start.x, y1: slider.start.y, x2: slider.end.x, y2: slider.end.y, 'stroke-linecap': 'round', 'stroke-width': 5 };
  s('line', sliderGroup, { ...line, stroke: style.control });
  const fill = s('line', sliderGroup, { ...line, x2: slider.start.x, y2: slider.start.y, stroke: style.accent, 'data-slider-fill': '' });
  const tickCount = Number.isInteger(slider.tickCount) && slider.tickCount > 1 ? slider.tickCount : 10;
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const fraction = index / (tickCount - 1), end = index === 0 || index === tickCount - 1;
    const x = slider.start.x + dx * fraction, y = slider.start.y + dy * fraction;
    return s('line', sliderGroup, {
      x1: x + normal.x * 30, y1: y + normal.y * 30,
      x2: x + normal.x * (end ? 42 : 38), y2: y + normal.y * (end ? 42 : 38),
      stroke: style.control, 'stroke-width': 2, 'stroke-linecap': 'round', 'data-tick': index,
    });
  });
  const sliderLabel = s('text', sliderGroup, {
    ...textStyle, x: (slider.start.x + slider.end.x) / 2 + normal.x * 80,
    y: (slider.start.y + slider.end.y) / 2 + normal.y * 80, 'data-label': 'slider',
  }, copy.slider);
  const fitLabel = (node, maxWidth, field) => {
    for (let size = 24; size >= 22; size--) {
      node.setAttribute('font-size', String(size));
      if (node.getComputedTextLength() <= maxWidth) return;
    }
    svg.remove();
    throw new Error(`labels.${field} cannot fit at the 22 world-unit font minimum; shorten the label.`);
  };
  fitLabel(switchLabel, Math.min(260, width / 4.1 * .88), 'switch');
  fitLabel(sliderLabel, length * .8, 'slider');

  // The widgets deliberately contain no knobs: the same single actor belongs
  // to the switch, flies through the world and then belongs to the slider.
  const actor = s('g', world, { 'data-actor': 'ball', 'data-owner': 'switch' });
  const ball = s('circle', actor, { cx: 0, cy: 0, r: sw.r ?? 22, fill: style.fg });
  const bubble = s('g', world, { opacity: 0, 'data-value-bubble': '' });
  const bubbleBody = s('rect', bubble, { x: -28, y: -22, width: 56, height: 39, rx: 10, fill: style.control });
  s('path', bubble, { d: 'M -7 15 L 0 23 L 7 15 Z', fill: style.control });
  const bubbleText = s('text', bubble, {
    'font-family': `"${style.font}", sans-serif`, 'font-size': 24, 'font-weight': 600,
    'text-anchor': 'middle', x: 0, y: 5, fill: style.fg, 'data-label': 'value',
  }, '0');
  bubbleText.style.fontVariantNumeric = 'tabular-nums';

  let lastState;
  function draw(state) {
    const { camera, actor: pose } = state;
    if (![camera.x, camera.y, camera.zoom, pose.x, pose.y, pose.scaleX, pose.scaleY,
      Number(state.switchValue), Number(state.sliderValue), Number(state.bubbleOpacity)].every(Number.isFinite) || camera.zoom <= 0) {
      throw new Error('ui-world draw requires finite camera and actor poses with positive zoom.');
    }
    lastState = state;
    const z = camera.zoom, x = width / 2 - camera.x * z, y = height / 2 - camera.y * z;
    set(world, { transform: `translate(${x} ${y}) scale(${z})` });
    // Only the grid's extent changes; its dots remain in the world's fixed
    // coordinates and are rasterized as vectors at every camera scale.
    set(grid, { x: camera.x - width / (2 * z) - 24, y: camera.y - height / (2 * z) - 24,
      width: width / z + 48, height: height / z + 48 });
    set(switchOn, { opacity: clamp(state.switchValue) });
    const progress = clamp(state.sliderValue / 100);
    const endpoint = pose.owner === 'slider' ? pose : {
      x: slider.start.x + dx * progress, y: slider.start.y + dy * progress,
    };
    set(fill, { x2: endpoint.x, y2: endpoint.y, opacity: progress > 0 ? 1 : 0 });
    ticks.forEach((tick, index) => set(tick, { stroke: progress > 0 && index / (tickCount - 1) <= progress + 1e-8 ? style.accent : style.control }));
    set(actor, { transform: `translate(${pose.x} ${pose.y}) scale(${pose.scaleX} ${pose.scaleY})`, 'data-owner': pose.owner });
    set(bubble, { transform: `translate(${pose.x - normal.x * 61} ${pose.y - normal.y * 61})`, opacity: clamp(state.bubbleOpacity) });
    bubbleText.textContent = String(Math.round(progress * 100));
    const bubbleWidth = Math.max(48, bubbleText.getComputedTextLength() + 20);
    set(bubbleBody, { x: -bubbleWidth / 2, width: bubbleWidth });
  }

  function bounds(node) {
    const b = node.getBBox(), m = node.getCTM();
    if (!m) return null;
    const points = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
      .map(([x, y]) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }));
    const left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y));
    const right = Math.max(...points.map(p => p.x)), bottom = Math.max(...points.map(p => p.y));
    return { x: left, y: top, width: right - left, height: bottom - top, matrix: m };
  }
  function textAudit(node, key, field, opacity, active) {
    const b = bounds(node);
    if (!b) return { key, field, active, text: node.textContent, visible: false, intentionalOffscreen: !active };
    const { matrix: m, ...box } = b;
    const inFrame = b.x + b.width > 0 && b.y + b.height > 0 && b.x < width && b.y < height;
    const outside = b.x < 0 || b.y < 0 || b.x + b.width > width || b.y + b.height > height;
    return { key, field, active, text: node.textContent, ...box,
      fontSize: Number(node.getAttribute('font-size')) * Math.hypot(m.c, m.d),
      opacity, visible: opacity > .01 && inFrame, intentionalOffscreen: outside && !active,
      intentionalClip: outside && !active ? 'The shared world camera intentionally reframes this inactive widget.' : undefined };
  }
  function audit(state = lastState) {
    if (!state) throw new Error('ui-world audit requires a drawn state.');
    const b = bounds(ball), { matrix, ...actorBox } = b;
    return {
      texts: [textAudit(switchLabel, 'switch-label', 'switch.label', 1, state.actor.owner === 'switch'),
        textAudit(sliderLabel, 'slider-label', 'slider.label', 1, state.actor.owner === 'slider'),
        textAudit(bubbleText, 'value', 'slider.value', clamp(state.bubbleOpacity), state.actor.owner === 'slider' && state.bubbleOpacity > .01)],
      actor: { owner: state.actor.owner, ...actorBox, centerX: matrix.e, centerY: matrix.f,
        radiusX: actorBox.width / 2, radiusY: actorBox.height / 2, screenRadius: Math.max(actorBox.width, actorBox.height) / 2 },
      camera: { ...state.camera, transform: world.getAttribute('transform') },
      stats: { svgCount: root.querySelectorAll('svg[data-ui-world]').length,
        ballCount: svg.querySelectorAll('[data-actor="ball"]').length, tickCount },
    };
  }
  return { draw, audit, dispose() { svg.remove(); } };
}

export default createView;
