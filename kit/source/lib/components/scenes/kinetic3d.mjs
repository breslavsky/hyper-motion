// Kinetic Text in real geometry: lines whose letters are solids under a
// camera. The letters are built from the outlines of one font, written out
// from the kit's own font files (fonts/geometry, kit/tools/font-geometry.py):
// a browser does not give a glyph's outline, so these scenes have one font
// of their own, as the sign of tubes has. Every frame is a pure function of
// the scene's clock.
import * as THREE from '../../vendor/three/three.module.min.js';
import metadata from '../metadata.mjs';
import font from '../../fonts/geometry/onest-600.mjs';
import {loops, shatter, lay, seeded, solids} from '../kinetic-burst.mjs';
import {renderer3d} from './three.mjs';

const sceneFactories = {};
// Every move speeds up and then slows down (scenes/text.mjs has the same three).
const inOut = k => k * k * (3 - 2 * k);
const firm = k => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const swift = k => 1 - (1 - k ** 1.4) ** 3;
const span = (t, from, to) => Math.min(1, Math.max(0, (t - from) / Math.max(1e-6, to - from)));
const mix = (a, b, k) => a + (b - a) * k;

// The colours a burst goes through when the film chose none: the reference's own run, blue to green.
const RUN = ['#0a84ff', '#3d5bff', '#8a3dff', '#35a7e8', '#a59af0', '#ff2fd2', '#1fb52a'];
// How deep a letter is, and how round its edges, in ems.
const DEPTH = 0.2, BEVEL = 0.018;
// The line as it arrives is this much larger than the line that stands.
const LARGE = 1.4;
const FOV = 30;

const solidGeometry = (solid, unit, middle) => {
  const ring = loop => loop.map(([x, y]) => new THREE.Vector2((x - middle[0]) * unit, (y - middle[1]) * unit));
  const shape = new THREE.Shape(ring(solid.outer));
  for (const hole of solid.holes) shape.holes.push(new THREE.Path(ring(hole)));
  const geometry = new THREE.ExtrudeGeometry(shape, {depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelOffset: -BEVEL, bevelSegments: 2, curveSegments: 1});
  geometry.translate(0, 0, -DEPTH / 2);
  return geometry;
};

/**
 * kinetic-burst-words: a line arrives large and glowing, its middle letters
 * growing up to its outer ones, its words draw apart for a breath, it snaps
 * together smaller and solid on a beat, and on a later beat its letters
 * break into pieces that fly at the camera until the frame is black.
 */
sceneFactories['kinetic-burst-words'] = ({p, cam, palette, accent, K}) => {
  const {W, H, el, set, px} = K;
  const s = p.scene, def = metadata['kinetic-burst-words'];
  const errors = def.validate(s);
  if (errors.length) throw new Error(`kinetic-burst-words: ${errors.join('; ')}`);
  const len = p.ldur ?? p.dur, t = def.times(s, len, p.beatLen);
  const em = font.unitsPerEm, unit = 1 / em;
  const line = lay(font, s.text);
  if (!line.units.length) throw new Error('kinetic-burst-words: the line has nothing to draw');

  // The frame in ems: the standing line takes at most half the safe width, its capitals a seventh of the height.
  const cap = font.capHeight * unit, wide = line.width * unit;
  const emPx = Math.min(K.safe.w * 0.5 / wide, K.safe.h * (W > H * 1.2 ? 0.15 : 0.085) / cap);
  const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2)), distance = H / emPx / (2 * tan);
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.02, distance * 4);
  camera.position.set(0, 0, distance);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-0.5, 0.9, 1.6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.7);
  fill.position.set(0.9, -0.4, 0.8);
  scene.add(fill);

  // The family's own ground carries the sign's lights; a palette without them is one the film chose.
  const chosen = palette && !palette.signTaken;
  const run = (chosen ? [...new Set([accent, ...Object.values(palette).filter(value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value))])].slice(0, 6) : RUN).map(colour => new THREE.Color(colour));
  const white = new THREE.Color('#f5f5f7');
  // One material for the whole line: a colour that glows by itself, with enough light on it to show its sides.
  const material = new THREE.MeshStandardMaterial({color: run[0], emissive: run[0], emissiveIntensity: 0.55, roughness: 0.5, metalness: 0});
  const tint = new THREE.Color();

  // The letters whole, for the line that stands, and their pieces, for the burst.
  const random = seeded(Array.from(String(s.text)).reduce((sum, ch) => (sum * 31 + ch.codePointAt(0)) >>> 0, 7));
  const letters = [], pieces = [];
  for (const u of line.units) {
    const shape = loops(u.path), middle = [u.advance / 2, font.capHeight / 2];
    const whole = new THREE.Group();
    for (const solid of solids(shape, em * em * 2e-5)) whole.add(new THREE.Mesh(solidGeometry(solid, unit, middle), material));
    scene.add(whole);
    // Where the letter stands in the settled line, the line's middle at the origin.
    const x = (u.x + u.advance / 2) * unit - wide / 2;
    letters.push({...u, whole, x, edge: line.units.length > 1 ? Math.abs(u.index / (line.units.length - 1) * 2 - 1) : 1});
    for (const part of shatter(shape, random, em)) {
      const mesh = new THREE.Mesh(solidGeometry(part, unit, part.middle), material);
      mesh.visible = false;
      scene.add(mesh);
      const home = new THREE.Vector3(x + (part.middle[0] - middle[0]) * unit, (part.middle[1] - middle[1]) * unit, 0);
      // Out from the middle of the line and at the camera, each its own way; some pass the camera, one ends on it.
      const out = new THREE.Vector2(home.x / Math.max(0.5, wide / 2), home.y / Math.max(0.2, cap)).add(new THREE.Vector2(random() - 0.5, random() - 0.5).multiplyScalar(0.9));
      const reach = distance * mix(1.25, 2, random());
      pieces.push({mesh, home,
        kick: new THREE.Vector3((random() - 0.5) * 0.3, (random() - 0.5) * 0.3, random() * 0.25),
        away: new THREE.Vector3(out.x * distance * tan * (W / H) * 0.75, out.y * distance * tan * 0.75, reach),
        axis: new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
        turn: mix(1.4, 3.2, random()) * (random() < 0.5 ? -1 : 1), late: random() * 0.12});
    }
  }
  // The piece nearest the middle is the one that ends on the camera and closes the frame.
  const closer = pieces.reduce((a, b) => (a.home.length() <= b.home.length() ? a : b));
  closer.away.set(0, 0, distance * 1.12); closer.late = 0.16; closer.turn *= 0.25;

  const stage = el('div', '', cam);
  stage.dataset.kineticBurst = String(pieces.length);
  const canvas = (blur) => {
    const node = el('canvas', '', stage);
    node.width = W; node.height = H;
    set(node, {position: 'absolute', left: '0', top: '0', width: px(W), height: px(H), ...(blur ? {filter: `blur(${px(emPx * 0.09)})`} : {})});
    return node;
  };
  // The same picture twice: blurred underneath, which is the light around the letters, and sharp over it.
  const halo = canvas(true), sharp = canvas(false);
  sharp.dataset.designRaster = JSON.stringify(K.rasterTypography ?? []);
  const hg = halo.getContext('2d'), g = sharp.getContext('2d');
  K.onDispose?.(() => {
    scene.traverse(node => node.geometry?.dispose());
    material.dispose();
  });

  const gaps = Math.max(0, line.words - 1), space = (font.glyphs[' ']?.[0] ?? em * 0.28) * unit;
  const turned = new THREE.Quaternion();
  const pose = l => {
    const flying = l >= t.burst;
    for (const letter of letters) letter.whole.visible = !flying && l >= t.start;
    // Past the camera a piece is gone, and after the flight so are all of them: the scene ends on black.
    for (const piece of pieces) piece.mesh.visible = flying && l < t.gone;
    if (!flying) {
      // The middle letters grow up to the outer ones; the words stand closed, draw apart, and come back.
      const grown = firm(span(l, t.start, t.grown));
      const breath = inOut(span(l, t.grown - (t.grown - t.start) * 0.4, t.apart)) * (1 - firm(span(l, t.apart, t.settle)));
      const closed = 1 - inOut(span(l, t.start, t.grown));
      const gap = space * (1 - closed + 1.9 * breath);
      const large = mix(LARGE, 1, swift(span(l, mix(t.apart, t.settle, 0.35), t.settle)));
      let x = 0;
      const placed = letters.map(letter => {
        const size = mix(mix(0.32, 1, letter.edge ** 1.6), 1, grown), w = letter.advance * unit * size;
        const at = x + w / 2; x += w;
        return {letter, size, at};
      });
      // Words apart: every gap between words is `gap` wide, whatever the letters' sizes.
      let shift = 0, word = 0;
      for (const item of placed) {
        if (item.letter.word !== word) { shift += gap * (item.letter.word - word); word = item.letter.word; }
        item.at += shift;
      }
      const total = x + gap * gaps;
      for (const {letter, size, at} of placed) {
        letter.whole.position.set((at - total / 2) * large, 0, 0);
        letter.whole.scale.setScalar(size * large);
      }
      return;
    }
    const u = span(l, t.burst, t.burst + t.fly);
    for (const piece of pieces) {
      // The break is at once: a short kick out of place; then the way to the camera and past it, where it slows unseen.
      const own = span(u, piece.late * 0.5, 1);
      const kicked = swift(span(u, 0, 0.22)), gone = inOut(own);
      piece.mesh.position.copy(piece.home).addScaledVector(piece.kick, kicked).addScaledVector(piece.away, gone);
      turned.setFromAxisAngle(piece.axis, piece.turn * (0.18 * kicked + 0.82 * inOut(own)));
      piece.mesh.quaternion.copy(turned);
    }
  };
  const colour = l => {
    if (l < t.burst) {
      // White with light around it while it arrives; its own colour, with none, once it stands.
      const own = firm(span(l, t.grown, t.settle));
      tint.copy(white).lerp(run[0], own);
      return {glow: (1 - 0.85 * own) * inOut(span(l, t.start, t.start + (t.grown - t.start) * 0.5)), lit: mix(0.9, 0.55, own)};
    }
    // The pieces change colour as they come, a step at a time.
    const u = span(l, t.burst, t.burst + t.fly);
    tint.copy(run[Math.min(run.length - 1, Math.floor(u * run.length))]);
    return {glow: 0.55, lit: 0.6};
  };

  // While the pieces fly a frame is several moments of the flight laid over one another, as a shutter leaves them.
  const SHUTTER = 0.009 * (p.speed ?? 1), SAMPLES = 16;
  return l => {
    const {r} = renderer3d(W, H);
    r.setClearColor(0x000000, 0);
    const look = colour(l);
    material.color.copy(tint); material.emissive.copy(tint); material.emissiveIntensity = look.lit;
    g.clearRect(0, 0, W, H);
    const blurred = l > t.burst && l < t.gone;
    const samples = blurred ? SAMPLES : 1;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 1 / samples;
    for (let i = 0; i < samples; i++) {
      pose(blurred ? Math.max(t.burst, l - SHUTTER * (1 - (i + 0.5) / samples)) : l);
      r.render(scene, camera);
      g.drawImage(r.domElement, 0, 0, W, H);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    hg.clearRect(0, 0, W, H);
    if (look.glow > 0.01) { hg.globalAlpha = Math.min(1, look.glow); hg.drawImage(sharp, 0, 0); }
  };
};

export {sceneFactories};
export default sceneFactories;
