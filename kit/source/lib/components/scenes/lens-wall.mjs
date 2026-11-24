// An endless wall of the film's pictures and videos under a lens, crossed by a
// camera on one of a few paths; the videos play in their tiles. The wall
// itself is the shared Lens Wall component (../lens-wall/wall.mjs, ours, a
// byte copy of components/lens-wall): this file gives it
// the film's files and colours.
import metadata from '../metadata.mjs';
import {plan, createPainter} from '../lens-wall/wall.mjs';

const ABSTRACT = 9;

// A picture where the film gave none: a sky, a sun and a hill in the look's colours.
function artwork(index, colours, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  const pick = k => colours[(index + k) % colours.length];
  const sky = context.createLinearGradient(0, 0, width * .3, height);
  sky.addColorStop(0, pick(0)); sky.addColorStop(1, pick(1));
  context.fillStyle = sky; context.fillRect(0, 0, width, height);
  context.fillStyle = pick(2);
  context.beginPath();
  context.arc(width * (.28 + .44 * ((index * 5) % 3) / 2), height * (.26 + .1 * (index % 2)), width * .13, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = pick(3);
  context.beginPath();
  context.moveTo(0, height);
  context.lineTo(0, height * (.66 + .08 * (index % 3)));
  context.quadraticCurveTo(width * .35, height * (.5 + .06 * (index % 2)), width * .62, height * .7);
  context.quadraticCurveTo(width * .82, height * .8, width, height * (.62 + .05 * (index % 4)));
  context.lineTo(width, height);
  context.fill();
  return canvas;
}

// Any CSS colour as #rrggbb, by the canvas's own reading of it.
function hex(colour) {
  const context = document.createElement('canvas').getContext('2d');
  context.fillStyle = '#000000'; context.fillStyle = colour;
  const value = context.fillStyle;
  if (/^#[\da-f]{6}$/i.test(value)) return value;
  const [r, g, b] = value.match(/[\d.]+/g).map(Number);
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

const load = src => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`lens-wall: unable to load ${src}`));
  image.src = src;
});

export function createFamily(K) {
  const definition = {...metadata['lens-wall'], build({p, cam, fg, accent, palette, bg}) {
    const s = p.scene, errors = this.validate(s);
    if (errors.length) throw new Error(`lens-wall: ${errors.join('; ')}`);
    const {W, H, el, set, px} = K;
    const len = p.ldur ?? p.dur;
    const images = s.images ?? [], videos = s.videos ?? [];
    // Pictures and videos share the wall, a video after every few pictures.
    const files = [];
    const every = videos.length ? Math.max(1, Math.round(images.length / videos.length)) : 0;
    let nextVideo = 0;
    images.forEach((path, i) => {
      files.push({path});
      if (every && (i + 1) % every === 0 && nextVideo < videos.length) files.push({video: nextVideo++});
    });
    while (nextVideo < videos.length) files.push({video: nextVideo++});
    const count = files.length || ABSTRACT;
    const short = Math.min(W, H);
    const aspect = {portrait: '2:3', square: '1:1', landscape: '3:2'}[s.tiles ?? 'portrait'];
    const planned = plan({id: 'scene', width: W, height: H, duration: len,
      media: Array.from({length: count}, (_, i) => `picture-${i + 1}.png`),
      tile: {width: Math.round(short * (aspect === '2:3' ? .105 : .14)), aspect},
      path: s.path ?? 'drift',
      // A camera that goes round in a small figure moves faster to be seen moving.
      drift: {drift: [.3, -.11], orbit: [.75, 0], wave: [.42, -.12], eight: [.8, 0], zigzag: [.42, -.12]}[s.path ?? 'drift'],
      background: hex(bg)});
    if (planned.errors) throw new Error(`lens-wall: ${planned.errors.join('; ')}`);
    const {spec} = planned;

    const stage = el('div', '', cam);
    stage.dataset.lensWallScene = spec.path;
    set(stage, {position: 'absolute', left: '0', top: '0', width: px(W), height: px(H), overflow: 'hidden', background: spec.background});
    const canvas = el('canvas', '', stage);
    canvas.setAttribute('aria-hidden', 'true');
    set(canvas, {position: 'absolute', left: '0', top: '0', width: px(W), height: px(H), display: 'block'});

    const colours = [...new Set([accent, ...Object.values(palette ?? {}).filter(value => typeof value === 'string'), fg].map(hex))]
      .filter(colour => colour !== spec.background);
    while (colours.length < 4) colours.push(colours[colours.length % 2] ?? hex(fg));
    // A video is painted into a canvas of the tile's shape at the size of the
    // tile under the lens, by the film's own clock (K.videoSource).
    const big = [spec.tile.width * spec.lens.magnify, spec.tile.height * spec.lens.magnify];
    const sources = files.length
      ? files.map(file => (file.path ? load(K.images[file.path]?.src ?? file.path) : K.videoSource(file.video, big[0], big[1]).then(video => video.element)))
      : Array.from({length: count}, (_, i) => artwork(i, colours, 600, 900));
    let painter = null, last = 0;
    K.defer(Promise.all(sources).then(loaded => {
      painter = createPainter({canvas, spec, sources: loaded, live: files.map(file => file.video !== undefined)});
      painter(last);
    }));
    return l => { last = l; painter?.(l); };
  }};
  return {sceneFactories: {'lens-wall': given => definition.build(given)}};
}
