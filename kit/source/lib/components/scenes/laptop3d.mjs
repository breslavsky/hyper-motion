// A real laptop from a model file: it lies closed under a camera that looks
// down at it, a hand lifts its lid, and the camera pulls back and down to show
// the screen and the keyboard. The screen plays the film's picture or video.
// The model and the hand's clip are loaded from our public address (metadata
// `public`, SOURCE.json). The hand is a clip with its matte beside it, laid
// over the picture while the camera rests; the lid stands at the angle read
// from that clip for the frame. Every frame is a pure function of the scene's
// clock (metadata `times`, `lift`).
import * as THREE from '../../vendor/three/three.module.min.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import metadata from '../metadata.mjs';
import {renderer3d, output3d, lights3d, imageTexture} from './three.mjs';

// The model's own measures: the node that is the lid, how far it opens
// (the author's `open` pose), and the node that carries the screen.
const LID = 'lid', SCREEN = 'screen', LABEL = 'Macbook_Pro_4';
const OPEN = 103;
const WIDTH = 3.2, SCREEN_ASPECT = 16 / 10;
// The scene's own ground: near black with a blue light from the right and a warm one low on the left.
export const GROUND = 'radial-gradient(70% 90% at 82% 38%, rgba(91,91,255,.2), rgba(91,91,255,0) 70%), radial-gradient(55% 70% at 14% 78%, rgba(255,111,181,.12), rgba(255,111,181,0) 70%), #050509';
// How much of the frame's half-width and half-height the open laptop takes at the second rest.
const FILL = [.84, .8];

const inOut = x => (x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const out = x => 1 - (1 - x) ** 3;
const span = (t, at, d) => Math.min(1, Math.max(0, (t - at) / d));

// One model for every laptop on a page: parsed once, cloned per scene.
const models = new Map();
const modelAt = url => {
  if (!models.has(url)) models.set(url, new GLTFLoader().loadAsync(url).then(gltf => gltf.scene, error => {
    models.delete(url);
    throw new Error(`laptop3d: unable to load the model ${url}: ${error?.message ?? error}`);
  }));
  return models.get(url);
};

// The screen's own rectangle gets texture coordinates that run 0..1 across it.
function screenFace(mesh) {
  const geometry = mesh.geometry.clone();
  geometry.computeBoundingBox();
  const {min, max} = geometry.boundingBox, size = max.clone().sub(min);
  const axes = ['x', 'y', 'z'].sort((a, b) => size[b] - size[a]).slice(0, 2);
  const across = axes.includes('x') ? 'x' : axes[0], up = axes.find(axis => axis !== across);
  const position = geometry.attributes.position, uv = new Float32Array(position.count * 2);
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    uv[i * 2] = (point[across] - min[across]) / size[across];
    uv[i * 2 + 1] = 1 - (point[up] - min[up]) / size[up];
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  mesh.geometry = geometry;
}

// A wallpaper where the film gave no picture: the look's colours in soft light.
function wallpaper(colours, bg) {
  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 800;
  const g = canvas.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 1280, 800);
  g.globalCompositeOperation = 'screen';
  [[.2, .25, .75], [.82, .3, .6], [.55, .95, .8]].forEach(([x, y, r], i) => {
    const glow = g.createRadialGradient(x * 1280, y * 800, 0, x * 1280, y * 800, r * 1280);
    glow.addColorStop(0, colours[i % colours.length]); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 1280, 800);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The laptop's contact shadow: its footprint, blurred, a little larger than it.
function shadow(depth) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 384;
  const g = canvas.getContext('2d');
  const w = 512 / 1.5, h = w * depth / WIDTH;
  g.filter = 'blur(26px)'; g.fillStyle = 'rgba(0,0,0,.95)';
  g.beginPath(); g.roundRect((512 - w) / 2, (384 - h) / 2, w, h, 18); g.fill();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH * 1.5, WIDTH * 1.5 * 384 / 512),
    new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false}));
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = .002;
  return mesh;
}

// A scene of the `three` family: scenes/three.mjs lists it among its own.
export function laptop3d({p, cam, fg, accent, palette, bg, K}) {
  const definition = metadata.laptop3d;
  {
    const s = p.scene, errors = definition.validate(s);
    if (errors.length) throw new Error(`laptop3d: ${errors.join('; ')}`);
    const {W, H} = K, len = p.ldur ?? p.dur;
    // The scene's clock may outrun the film's; the hand's clip plays by the film's.
    const speed = p.speed ?? 1, t = definition.times(s, len, speed);
    const scene = new THREE.Scene();
    lights3d(scene, palette, renderer3d(W, H).env);
    scene.environmentIntensity = .9;
    const camera = new THREE.PerspectiveCamera(30, W / H, .1, 200);
    scene.add(camera);
    const tan = Math.tan(THREE.MathUtils.degToRad(15)), fit = (halfW, halfH) => Math.max(halfH / tan, halfW / (tan * (W / H)));
    // The camera's two rests. From above, where the hand's clip was made: the
    // clip lies over the picture, so this rest is the clip's own camera to the
    // number. And lower in front, with room for the screen.
    const above = fit(WIDTH * .9, WIDTH * .62), elevated = THREE.MathUtils.degToRad(72);
    const from = {at: new THREE.Vector3(0, above * Math.sin(elevated), above * Math.cos(elevated) + .15), look: new THREE.Vector3(0, .25, -.1)};
    const to = {look: new THREE.Vector3(0, WIDTH * .2, -WIDTH * .04), distance: fit(WIDTH * .66, WIDTH * .56), elevation: THREE.MathUtils.degToRad(16), yaw: -.26};
    const reach = from.at.clone().sub(from.look);
    from.distance = reach.length(); from.elevation = Math.asin(reach.y / from.distance); from.yaw = Math.atan2(reach.x, reach.z);
    const {fps, angles, held} = definition.lift;
    const aspect = ['16:9', '9:16', '1:1'].find(name => { const [w, h] = name.split(':').map(Number); return Math.abs(W / H - w / h) < .01; });
    const hand = definition.handFor(s, aspect);

    let lid = null, face = null;
    const colours = [...new Set([accent, ...Object.values(palette ?? {}).filter(value => typeof value === 'string')])].filter(colour => colour !== bg);
    const picture = s.image ? K.images[s.image] : null;
    const texture = picture ? imageTexture(K, picture, SCREEN_ASPECT) : s.video ? null : wallpaper(colours.length ? colours : [fg], bg);
    // The screen's own coordinates run from its top, as a picture's rows do.
    if (texture) texture.flipY = false;
    const lit = new THREE.MeshBasicMaterial({map: texture, toneMapped: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
    if (s.video) K.defer(K.videoSource(0, 1280, 800).then(video => {
      lit.map = new THREE.CanvasTexture(video.element);
      lit.map.colorSpace = THREE.SRGBColorSpace;
      lit.map.flipY = false;
      lit.needsUpdate = true;
    }));
    const url = `${definition.public}/${definition.model}`;
    // The hand: a plane that rides the camera and fills the clip's place in the
    // frame, its colour from the clip's left half and its matte from the right.
    let glove = null;
    if (hand) {
      const [fw, fh] = hand.frame, [x, y, w, h] = hand.crop, unit = 2 * tan / fh;
      K.defer(K.videoSource(`${definition.public}/${hand.file}`, w * 2, h).then(video => {
        const half = offset => { const texture = new THREE.CanvasTexture(video.element); texture.repeat.set(.5, 1); texture.offset.set(offset, 0); return texture; };
        const colour = half(0), matte = half(.5);
        colour.colorSpace = THREE.SRGBColorSpace;
        glove = new THREE.Mesh(new THREE.PlaneGeometry(w * unit, h * unit),
          new THREE.MeshBasicMaterial({map: colour, alphaMap: matte, transparent: true, toneMapped: false, depthTest: false, depthWrite: false}));
        glove.position.set((x + w / 2 - fw / 2) * unit, (fh / 2 - y - h / 2) * unit, -1);
        glove.renderOrder = 999;
        camera.add(glove);
      }));
    }
    K.defer(modelAt(url).then(source => {
      const model = source.clone(true);
      // The file holds the model as its page showed it: turned and scaled. Here
      // it stands at the origin, its front to +z, WIDTH units wide, on the floor.
      const root = model.getObjectByName('macbook') ?? model;
      root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.setScalar(1);
      lid = model.getObjectByName(LID);
      // The name printed under the screen is a node of its own, placed for the open lid.
      const label = model.getObjectByName(LABEL);
      if (lid && label) { lid.quaternion.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), THREE.MathUtils.degToRad(OPEN)); model.updateMatrixWorld(true); lid.attach(label); lid.quaternion.identity(); }
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
      const holder = new THREE.Group();
      holder.scale.setScalar(WIDTH / size.x);
      model.position.set(-centre.x, -box.min.y, -centre.z);
      holder.add(model); scene.add(holder);
      scene.add(shadow(size.z * WIDTH / size.x));
      // The glass sheet over the screen lies in the screen's own plane: the picture is drawn without it.
      model.traverse(node => { if (node.isMesh && /^Glass/.test(node.material?.name ?? '')) node.visible = false; });
      face = model.getObjectByName(SCREEN);
      const mesh = face?.isMesh ? face : face?.getObjectByProperty('isMesh', true);
      if (!lid || !mesh) throw new Error('laptop3d: the model has no lid or no screen');
      screenFace(mesh);
      mesh.material = lit;
      // The second rest frames the open laptop itself: its corners, seen from the
      // rest's side, are put in the middle of the frame with a margin around them.
      lid.quaternion.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), THREE.MathUtils.degToRad(OPEN));
      holder.updateMatrixWorld(true);
      const open = new THREE.Box3().setFromObject(holder), corners = [];
      for (const x of [open.min.x, open.max.x]) for (const y of [open.min.y, open.max.y]) for (const z of [open.min.z, open.max.z]) corners.push(new THREE.Vector3(x, y, z));
      lid.quaternion.identity();
      open.getCenter(to.look);
      const seen = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
      for (let pass = 0; pass < 6; pass++) {
        camera.position.set(to.look.x + to.distance * Math.sin(to.yaw) * Math.cos(to.elevation), to.look.y + to.distance * Math.sin(to.elevation), to.look.z + to.distance * Math.cos(to.yaw) * Math.cos(to.elevation));
        camera.lookAt(to.look); camera.updateMatrixWorld(true);
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const corner of corners) { seen.copy(corner).project(camera); x0 = Math.min(x0, seen.x); x1 = Math.max(x1, seen.x); y0 = Math.min(y0, seen.y); y1 = Math.max(y1, seen.y); }
        right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
        to.look.addScaledVector(right, (x0 + x1) / 2 * tan * (W / H) * to.distance).addScaledVector(up, (y0 + y1) / 2 * tan * to.distance);
        to.distance *= Math.max((x1 - x0) / 2 / FILL[0], (y1 - y0) / 2 / FILL[1]);
      }
    }));

    const stage = K.el('div', '', cam);
    stage.dataset.laptop3d = s.video ? 'video' : s.image ? 'image' : 'wallpaper';
    if (hand) stage.dataset.laptop3dHand = hand.file;
    // The laptop stands on a dark ground of its own, whatever the film's look:
    // the hand was cut out for it and the lit screen needs the dark around it.
    const ground = K.el('div', '', stage);
    K.set(ground, {position: 'absolute', left: '0', top: '0', width: K.px(W), height: K.px(H), background: GROUND});
    const paint = output3d(K, stage);
    const target = new THREE.Vector3();
    const axis = new THREE.Vector3(-1, 0, 0);
    return l => {
      if (!lid) return;
      // The lid: the clip's own angles while it runs, then the rest of the way by itself.
      const frame = Math.min(angles.length - 1, l / speed * fps), i = Math.floor(frame), k = frame - i;
      const lifted = angles[i] + ((angles[Math.min(angles.length - 1, i + 1)] ?? held) - angles[i]) * k;
      const degrees = lifted + (OPEN - held) * inOut(span(l, t.release, t.finish - t.release));
      lid.quaternion.setFromAxisAngle(axis, THREE.MathUtils.degToRad(degrees));
      // The screen wakes once there is room to see it.
      lit.color.setScalar(out(span(l, t.wake, .5)));
      if (lit.map?.isCanvasTexture && s.video) lit.map.needsUpdate = true;
      if (glove) {
        glove.visible = l < t.clip;
        glove.material.map.needsUpdate = glove.material.alphaMap.needsUpdate = true;
      }
      // The camera rests while the hand is in the picture, then goes back and down.
      // A quick move: it gathers speed and slows into its rest.
      const x = span(l, t.leave, t.travel), back = x < .5 ? 2 * x * x : 1 - (2 - 2 * x) ** 2 / 2, rest = Math.max(0, l - t.settle);
      const mix = (a, b) => a + (b - a) * back;
      const elevation = mix(from.elevation, to.elevation), yaw = mix(from.yaw, to.yaw) + .05 * Math.sin(rest * .5) * back;
      // The camera's aim and its distance run ahead of its turn, so the laptop comes
      // down into the frame as soon as the hand is off and the rising screen is not cut.
      const lead = 1 - (1 - back) ** 2.4;
      const distance = (from.distance + (to.distance - from.distance) * lead) * (1 - .035 * (1 - Math.exp(-rest * .4)));
      target.lerpVectors(from.look, to.look, lead);
      camera.position.set(target.x + distance * Math.sin(yaw) * Math.cos(elevation), target.y + distance * Math.sin(elevation), target.z + distance * Math.cos(yaw) * Math.cos(elevation));
      camera.lookAt(target);
      paint(scene, camera);
    };
  }
}
