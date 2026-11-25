// synth3d: a pocket beat machine of our own, built here from boxes and
// cylinders (no model file, no texture file): a body of brushed space-grey
// aluminium, eight square pads of glass in two rows, a wide screen, a speaker
// grille, a dial and two round buttons. It stands still under a camera at
// rest, a little above it. Two real hands play three of its pads: one take,
// kept as frames of a picture and laid over the machine where it was shot,
// its time bent so the three touches fall on the beats the film names. A word
// of the film comes with each hit. Every hit is one list (metadata) the
// picture, the words and the scene's sounds are cut to.
import * as THREE from "../../vendor/three/three.module.min.js";
import { RoundedBoxGeometry } from "../../vendor/three/RoundedBoxGeometry.js";
import metadata from "../metadata.mjs";
import { renderer3d, output3d, lights3d } from "./three.mjs";
import { GROUND } from "./laptop3d.mjs";

// The body, in its own units: x across, z towards the viewer, y up.
const BODY = {w: 3.4, d: 2.2, h: .34, r: .15};
const EDGE = .17;
const PAD = {size: .5, gap: .085, h: .1, out: .05, travel: .032};
// The half dark the machine stands in: how much of the room's reflections and of the lamps is left, and of the hands' own colour.
const DUSK = {room: .2, lamps: .22, hands: .11};
// How much of the frame's half-width and half-height the machine takes.
const FILL = [.8, .7];
// The pads' paints, left to right, back row first: `a` is the film's accent.
const PAINT = ['l', 'l', 'd', 'l', 'd', 'l', 'l', 'a'];
// Brushed metal, drawn here: fine strokes of a seeded generator on a grey that is the metal's
// roughness, used as the roughness and as the relief. `round` turns the strokes into rings (a lathe's work).
function brushing(round) {
  const size = 512, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  let state = round ? 0x51f15e : 0x9e3779b9;
  const random = () => { state = (state + 0x6d2b79f5) | 0; let n = Math.imul(state ^ (state >>> 15), 1 | state); n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n; return ((n ^ (n >>> 14)) >>> 0) / 4294967296; };
  g.fillStyle = 'rgb(98,98,98)'; g.fillRect(0, 0, size, size);
  g.lineCap = 'round';
  for (let i = 0; i < 5200; i++) {
    const light = random() < .5, shade = light ? 150 + random() * 70 : 30 + random() * 40;
    g.strokeStyle = `rgba(${shade},${shade},${shade},${.05 + random() * .2})`; g.lineWidth = .5 + random() * 1.1;
    g.beginPath();
    if (round) { const from = random() * Math.PI * 2; g.arc(size / 2, size / 2, random() * size * .5, from, from + .4 + random() * 2.4); }
    else { const y = random() * size, x = random() * size * 1.2 - size * .2; g.moveTo(x, y); g.lineTo(x + size * (.15 + random() * .7), y); }
    g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 8;
  return texture;
}
// The body is aluminium in the laptop's space grey, brushed along its length; the dial the same metal turned on a lathe; the base black plastic.
const metal = (strokes, tone = .17) => new THREE.MeshPhysicalMaterial({color: new THREE.Color().setRGB(tone, tone, tone * 1.05), metalness: 1, roughness: 1, roughnessMap: strokes, bumpMap: strokes, bumpScale: .6, envMapIntensity: 1.3});
const BLACK = () => new THREE.MeshPhysicalMaterial({color: 0x000000, roughness: .5});
// A pad of glass: clear, smoked or tinted with the accent; the light under it shows through.
const glass = (tint, depth) => new THREE.MeshPhysicalMaterial({color: 0xffffff, transmission: 1, thickness: .3, ior: 1.5, roughness: .07, metalness: 0,
  attenuationColor: new THREE.Color(tint), attenuationDistance: depth, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.3});

const span = (t, at, d) => Math.min(1, Math.max(0, (t - at) / d));
const plastic = (colour, extra = {}) => new THREE.MeshPhysicalMaterial({color: new THREE.Color(colour), roughness: .52, metalness: .02, clearcoat: .35, clearcoatRoughness: .45, ...extra});

// A soft shadow under the machine.
function shadow() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 384;
  const g = canvas.getContext('2d');
  const w = 512 / 1.5, h = w * BODY.d / BODY.w;
  g.filter = 'blur(24px)'; g.fillStyle = 'rgba(0,0,0,.6)';
  g.beginPath(); g.roundRect((512 - w) / 2, (384 - h) / 2, w, h, 26); g.fill();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BODY.w * 1.5, BODY.w * 1.5 * 384 / 512),
    new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false}));
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = .002;
  return mesh;
}

export function synth3d({p, cam, fg, accent, palette, bg, K}) {
  const definition = metadata.synth3d;
  const s = p.scene, {W, H} = K, len = p.ldur ?? p.dur, beat = p.beatLen ?? .5;
  const hits = definition.hits(s, len, beat);
  const scene = new THREE.Scene();
  lights3d(scene, palette, renderer3d(W, H).env);
  // Half dark: the room's light is low, so what shines is the pads, their light on the screen, and little else.
  scene.environmentIntensity = DUSK.room;
  scene.traverse(node => { if (node.isLight) node.intensity *= DUSK.lamps; });
  const camera = new THREE.PerspectiveCamera(30, W / H, .1, 200);
  const tan = Math.tan(THREE.MathUtils.degToRad(15));

  const machine = new THREE.Group();
  scene.add(machine); scene.add(shadow());
  const surface = BODY.h;
  const along = brushing(false), turned = brushing(true);
  along.repeat.set(1, 1.6);
  const body = new THREE.Mesh(new RoundedBoxGeometry(BODY.w, BODY.h, BODY.d, 6, BODY.r), metal(along));
  body.position.y = BODY.h / 2; machine.add(body);
  const foot = new THREE.Mesh(new RoundedBoxGeometry(BODY.w - .12, .05, BODY.d - .12, 4, .12), BLACK());
  foot.position.y = .005; machine.add(foot);

  // The pads: two rows of four at the front left.
  const left = -BODY.w / 2 + EDGE, front = BODY.d / 2 - EDGE, step = PAD.size + PAD.gap;
  // Every pad has a light of its own colour: the accent's hue, a step round the wheel from pad to pad, neighbours far apart.
  const glows = PAINT.map((_, i) => { const hsl = {}; new THREE.Color(accent).getHSL(hsl); return new THREE.Color().setHSL((hsl.h + (i * 3 % 8) / 8) % 1, Math.max(.8, hsl.s), .56); });
  const inks = glows.map(colour => `#${colour.getHexString()}`);
  const halo = (() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d'), fade = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    fade.addColorStop(0, 'rgba(255,255,255,1)'); fade.addColorStop(.32, 'rgba(255,255,255,.55)'); fade.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = fade; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  })();
  const pads = PAINT.map((paint, i) => {
    const material = paint === 'l' ? glass('#eef3f6', 2.4) : paint === 'd' ? glass('#3a4046', .16) : glass(accent, .3);
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(PAD.size, PAD.h, PAD.size, 4, .045), material);
    const col = i % 4, row = Math.floor(i / 4);
    mesh.position.set(left + PAD.size / 2 + col * step, 0, front - PAD.size / 2 - (1 - row) * step);
    machine.add(mesh);
    // The well a pad sits in: a dark sheet a little larger than the pad, and in it the pad's lamp.
    const well = new THREE.Mesh(new THREE.PlaneGeometry(PAD.size + .05, PAD.size + .05), new THREE.MeshBasicMaterial({color: 0x050506}));
    well.rotation.x = -Math.PI / 2; well.position.set(mesh.position.x, surface + .002, mesh.position.z); machine.add(well);
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(PAD.size - .1, PAD.size - .1), new THREE.MeshBasicMaterial({color: 0x000000, toneMapped: false}));
    lamp.rotation.x = -Math.PI / 2; lamp.position.set(mesh.position.x, surface + .004, mesh.position.z); machine.add(lamp);
    // The light that spills out of a lit pad: a soft bloom over it, added to the picture.
    const bloom = new THREE.Mesh(new THREE.PlaneGeometry(PAD.size * 2.1, PAD.size * 2.1), new THREE.MeshBasicMaterial({map: halo, color: glows[i], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}));
    bloom.rotation.x = -Math.PI / 2; bloom.position.set(mesh.position.x, surface + PAD.out + .012, mesh.position.z); bloom.renderOrder = 5; machine.add(bloom);
    material.emissive = glows[i].clone(); material.emissiveIntensity = 0;
    return {mesh, material, paint, lamp, bloom};
  });
  const padsRight = left + 4 * PAD.size + 3 * PAD.gap, padsBack = front - 2 * PAD.size - PAD.gap;

  // The back strip: the screen and the grille.
  const back = -BODY.d / 2 + EDGE, stripDepth = padsBack - .16 - back;
  const screenWidth = 1.86, screenCanvas = document.createElement('canvas');
  screenCanvas.width = 744; screenCanvas.height = Math.round(744 * stripDepth / screenWidth);
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(screenWidth, .05, stripDepth, 3, .045), new THREE.MeshPhysicalMaterial({color: 0x000000, roughness: .04, clearcoat: 1}));
  bezel.position.set(left + screenWidth / 2, surface + .012, back + stripDepth / 2); machine.add(bezel);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(screenWidth - .1, stripDepth - .1), new THREE.MeshBasicMaterial({map: screenTexture, toneMapped: false}));
  display.rotation.x = -Math.PI / 2; display.position.set(bezel.position.x, surface + .039, bezel.position.z); machine.add(display);
  const grilleLeft = left + screenWidth + .2, grilleWidth = BODY.w / 2 - EDGE - grilleLeft, cols = 8, rows = 4;
  const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(.034, 16), new THREE.MeshBasicMaterial({color: 0x020202}), cols * rows);
  const place = new THREE.Object3D(); place.rotation.x = -Math.PI / 2;
  for (let i = 0; i < cols * rows; i++) {
    place.position.set(grilleLeft + (i % cols + .5) * grilleWidth / cols, surface + .002, back + (Math.floor(i / cols) + .5) * stripDepth / rows);
    place.updateMatrix(); holes.setMatrixAt(i, place.matrix);
  }
  machine.add(holes);

  // The dial and the two round buttons, right of the pads.
  const rightMid = (padsRight + BODY.w / 2 - EDGE) / 2 + .04;
  const dial = new THREE.Group();
  dial.position.set(rightMid, surface, padsBack + .4); machine.add(dial);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, .03, 48), BLACK());
  collar.position.y = .015; dial.add(collar);
  // The knob: its wall, and a top with a dimple for a fingertip instead of a pointer.
  const KNOB = {r: .32, h: .1, dimple: .085, deep: .034, off: .175};
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(KNOB.r, .34, KNOB.h, 48, 1, true), metal(along, .2));
  knob.position.y = .03 + KNOB.h / 2; dial.add(knob);
  const face = new THREE.Shape(); face.absarc(0, 0, KNOB.r, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, KNOB.off, KNOB.dimple, 0, Math.PI * 2, true); face.holes.push(hole);
  const faceGeometry = new THREE.ShapeGeometry(face, 48);
  { const at = faceGeometry.attributes.position, uv = faceGeometry.attributes.uv; for (let n = 0; n < at.count; n++) uv.setXY(n, at.getX(n) / (2 * KNOB.r) + .5, at.getY(n) / (2 * KNOB.r) + .5); }
  const lathe = metal(turned, .24);
  const cap = new THREE.Mesh(faceGeometry, lathe);
  cap.rotation.x = -Math.PI / 2; cap.position.y = .03 + KNOB.h; dial.add(cap);
  // The dimple is the bottom of a sphere, seen from inside.
  const ball = (KNOB.dimple ** 2 + KNOB.deep ** 2) / (2 * KNOB.deep), open = Math.asin(KNOB.dimple / ball);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(ball, 32, 12, 0, Math.PI * 2, Math.PI - open, open),
    new THREE.MeshPhysicalMaterial({color: lathe.color, metalness: 1, roughness: .3, side: THREE.DoubleSide, envMapIntensity: 1.3}));
  bowl.position.set(0, .03 + KNOB.h - KNOB.deep + ball, -KNOB.off); dial.add(bowl);
  const buttons = [[-.2, metal(turned, .2)], [.2, plastic(accent)]].map(([x, material]) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.115, .115, .06, 32), material);
    mesh.position.set(rightMid + x, surface + .01, front - .13); machine.add(mesh);
    return mesh;
  });

  // The camera stands still, a little above the machine, which is in the frame from the first moment.
  // Where it stands depends on the frame's shape; the hands were cut from the 16:9 frame, so that one is known too.
  const ELEVATION = THREE.MathUtils.degToRad(52);
  const stand = (lens, shape, gap) => {
    const look = new THREE.Vector3(0, BODY.h / 2, 0); let distance = 9;
    const put = () => { lens.position.set(look.x, look.y + distance * Math.sin(ELEVATION), look.z + distance * Math.cos(ELEVATION)); lens.lookAt(look); lens.updateMatrixWorld(true); };
    const hx = BODY.w / 2, hz = BODY.d / 2, corners = [];
    for (const x of [-hx, hx]) for (const y of [0, BODY.h + .34]) for (const z of [-hz, hz]) corners.push(new THREE.Vector3(x, y, z));
    const seen = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
    for (let pass = 0; pass < 6; pass++) {
      put();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const corner of corners) { seen.copy(corner).project(lens); x0 = Math.min(x0, seen.x); x1 = Math.max(x1, seen.x); y0 = Math.min(y0, seen.y); y1 = Math.max(y1, seen.y); }
      right.setFromMatrixColumn(lens.matrixWorld, 0); up.setFromMatrixColumn(lens.matrixWorld, 1);
      look.addScaledVector(right, (x0 + x1) / 2 * tan * shape * distance).addScaledVector(up, (y0 + y1) / 2 * tan * distance);
      distance *= Math.max((x1 - x0) / 2 / FILL[0], (y1 - y0) / 2 / FILL[1]);
      lens.userData.below = (1 + y0) * tan * distance;
    }
    // In a taller frame the machine goes down until as much room is left under it as the 16:9 frame leaves:
    // the hands were shot there and reach its lower edge.
    if (gap !== undefined && lens.userData.below > gap + 1e-3) { put(); up.setFromMatrixColumn(lens.matrixWorld, 1); look.addScaledVector(up, lens.userData.below - gap); lens.userData.below = gap; }
    put();
    return lens;
  };
  const WIDE = 16 / 9, shot = stand(new THREE.PerspectiveCamera(30, WIDE, .1, 200), WIDE);
  stand(camera, W / H, W / H < WIDE - .01 ? shot.userData.below : undefined);

  // The hands: one take of two hands playing three pads, kept as frames in a grid (colour in one picture,
  // matte in another) and shown on a sheet that faces the camera where the frames were cut from the 16:9 shot.
  // The take's own time is bent so its three touches fall on the scene's three hits.
  const play = definition.play;
  const hands = s.hands !== false && hits.length === play.hits.length ? {sheet: null} : null;
  if (hands) {
    const [fw, fh] = play.plate, [cx, cy, cw, ch] = play.crop;
    const middle = new THREE.Vector3(0, BODY.h, 0), forward = new THREE.Vector3(); shot.getWorldDirection(forward);
    const unit = 2 * middle.clone().sub(shot.position).dot(forward) * tan / fh;
    const seen = middle.clone().project(shot), px = (seen.x + 1) / 2 * fw, py = (1 - seen.y) / 2 * fh;
    const right = new THREE.Vector3().setFromMatrixColumn(shot.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(shot.matrixWorld, 1);
    hands.place = middle.clone().addScaledVector(right, (cx + cw / 2 - px) * unit).addScaledVector(up, -(cy + ch / 2 - py) * unit);
    // The arms go on below the sheet, out of any frame: the sheet's last rows drawn long.
    const w = cw * unit, h = ch * unit, arm = 9, rows = [[h / 2, 1], [-h / 2 + h * .012, .012], [-h / 2 - arm, 0]];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(rows.flatMap(([y]) => [-w / 2, y, 0, w / 2, y, 0]), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(rows.flatMap(([, v]) => [0, v, 1, v]), 2));
    geometry.setIndex([0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5]);
    // The take's time for a moment of the scene: from its first frame to its first touch as fast as the scene
    // leaves room for, from touch to touch as the hits ask, and out at its own pace.
    const first = play.times[0], last = play.times.at(-1);
    const take = [first, ...play.hits, last], here = [Math.max(.02, hits[0].at - (play.hits[0] - first)), ...hits.map(hit => hit.at), hits.at(-1).at + last - play.hits.at(-1)];
    hands.frame = l => {
      if (l < here[0] || l > here.at(-1)) return -1;
      let k = 0; while (k < here.length - 2 && l > here[k + 1]) k++;
      const time = take[k] + (take[k + 1] - take[k]) * span(l, here[k], here[k + 1] - here[k]);
      let lo = 0, hi = play.times.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (play.times[mid] <= time + 1e-6) lo = mid; else hi = mid - 1; }
      return lo;
    };
    const picture = file => new Promise((resolve, reject) => {
      const image = new Image(); image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image); image.onerror = () => reject(new Error(`synth3d: the hands' picture did not load (${file})`));
      image.src = `${definition.public}/${file}`;
    });
    K.defer(Promise.all([picture(play.colour), picture(play.matte)]).then(images => {
      const [colour, matte] = images.map(image => { const texture = new THREE.Texture(image); texture.repeat.set(1 / play.cols, 1 / play.rows); texture.needsUpdate = true; return texture; });
      colour.colorSpace = THREE.SRGBColorSpace;
      hands.sheet = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({map: colour, alphaMap: matte, color: new THREE.Color().setScalar(DUSK.hands), transparent: true, toneMapped: false, depthTest: false, depthWrite: false}));
      hands.sheet.position.copy(hands.place); hands.sheet.quaternion.copy(shot.quaternion);
      hands.sheet.renderOrder = 999; hands.sheet.frustumCulled = false; hands.sheet.visible = false;
      scene.add(hands.sheet);
    }));
  }

  // The screen: eight cells for the pads and a level that falls after each hit.
  const g = screenCanvas.getContext('2d'), sw = screenCanvas.width, sh = screenCanvas.height;
  const cell = (sw - 40 * 2 - 7 * 14) / 8;
  const drawScreen = (l, power) => {
    g.fillStyle = '#07080c'; g.fillRect(0, 0, sw, sh);
    for (let i = 0; i < 8; i++) {
      const lit = power[i];
      g.fillStyle = lit > .02 ? inks[i] : '#22242c'; g.globalAlpha = lit > .02 ? .25 + .75 * lit : 1;
      g.beginPath(); g.roundRect(40 + i * (cell + 14), sh - 40 - cell * .5, cell, cell * .5, 8); g.fill();
      g.globalAlpha = 1;
    }
    const bars = 28, total = Math.max(...power), base = sh - 40 - cell * .5 - 26, room = base - 36;
    for (let i = 0; i < bars; i++) {
      const wave = .5 + .5 * Math.sin(i * .9 + l * 7) * Math.sin(i * .37 + l * 3.1), height = 6 + room * (.12 + .88 * total) * (.25 + .75 * wave);
      g.fillStyle = fg; g.globalAlpha = .35 + .65 * total;
      g.beginPath(); g.roundRect(40 + i * (sw - 80) / bars, base - height, (sw - 80) / bars - 6, height, 3); g.fill();
    }
    g.globalAlpha = 1;
    screenTexture.needsUpdate = true;
  };

  const stage = K.el('div', '', cam);
  stage.dataset.synth3d = String(hits.length);
  if (hands) stage.dataset.synth3dHands = String(play.times.length);
  // The same dark ground the laptop stands on, whatever the film's look: the lit pads need the dark around them.
  const ground = K.el('div', '', stage);
  K.set(ground, {position: 'absolute', left: '0', top: '0', width: K.px(W), height: K.px(H), background: GROUND});
  const paint = output3d(K, stage);
  // The film's words, one a hit: large over the machine in a wide frame, above it where a square or tall one leaves the room.
  const words = (Array.isArray(s.words) ? s.words : []).slice(0, hits.length).map((word, i) => {
    const node = K.el('div', 'display', stage);
    const above = W / H < 1.2, top = new THREE.Vector3(0, BODY.h, -BODY.d / 2).project(camera), middle = new THREE.Vector3(0, BODY.h, 0).project(camera);
    const y = above ? (1 - top.y) / 2 * H * .5 : (1 - middle.y) / 2 * H;
    K.set(node, {position: 'absolute', left: '0', right: '0', top: K.px(y), textAlign: 'center', color: '#eef0ff', margin: '0 auto', whiteSpace: 'nowrap', opacity: '0', willChange: 'opacity, filter, transform'});
    node.textContent = word;
    K.design.fitSize(node, W * .84, K.design.type('display').lineHeight * 1.05, 'display');
    return {node, at: hits[i].at, until: hits[i + 1]?.at ?? hits[i].at + beat * 1.5};
  });
  const power = new Array(8).fill(0);
  return l => {
    // Every pad by the hits so far: pressed for a moment, glowing a little longer.
    power.fill(0);
    let turns = 0;
    const press = new Array(8).fill(0);
    for (const hit of hits) {
      const since = l - hit.at;
      if (since < 0) break;
      turns += 1;
      press[hit.pad] = Math.max(press[hit.pad], since < .05 ? since / .05 : 1 - span(since, .05, .14));
      power[hit.pad] = Math.max(power[hit.pad], Math.exp(-since * 4.2));
    }
    pads.forEach((pad, i) => {
      pad.mesh.position.y = surface + PAD.out - PAD.h / 2 - PAD.travel * press[i];
      pad.lamp.material.color.copy(glows[i]).multiplyScalar(.015 + 5 * power[i]);
      pad.material.emissiveIntensity = 2.6 * power[i];
      pad.bloom.material.opacity = Math.min(1, 1.25 * power[i]);
    });
    // The dial goes a step with every hit; the accent button is held on every fourth.
    const last = hits[turns - 1], eased = last ? 1 - Math.exp(-(l - last.at) * 14) : 0;
    dial.rotation.y = -(Math.max(0, turns - 1) + eased) * .22;
    buttons[1].position.y = surface + .01 - .018 * (turns % 4 === 0 && last ? 1 - span(l - last.at, 0, .2) : 0);
    drawScreen(l, power);
    if (hands?.sheet) {
      const frame = hands.frame(l);
      hands.sheet.visible = frame >= 0;
      if (frame >= 0) {
        const x = (frame % play.cols) / play.cols, y = 1 - (Math.floor(frame / play.cols) + 1) / play.rows;
        hands.sheet.material.map.offset.set(x, y); hands.sheet.material.alphaMap.offset.set(x, y);
      }
    }
    // A word comes sharp out of a blur with its hit and dissolves into one when the next hit comes.
    for (const word of words) {
      const come = span(l, word.at - .03, .13), go = span(l, word.until - .06, .34), shown = come * (1 - go);
      word.node.style.opacity = String(shown);
      word.node.style.filter = shown > 0 && shown < 1 ? `blur(${((1 - come) * 16 + go * 22).toFixed(2)}px)` : 'none';
      word.node.style.transform = `translateY(-50%) scale(${(1.14 - .14 * (1 - (1 - come) ** 3) + .05 * go).toFixed(4)})`;
    }
    paint(scene, camera);
  };
}
