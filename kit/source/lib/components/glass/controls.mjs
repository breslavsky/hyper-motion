import * as THREE from '../../vendor/three/three.module.min.js';
import {createGlassGeometry} from './geometry.mjs';
import {arrowDownBold, arrowUpBold} from '../upstream/phosphor-icons/arrow-up-bold.mjs';
import {arrowElbowDownLeftBold, checkBold, circleNotchBold} from '../upstream/phosphor-icons/search-icons.mjs';

// Both switch positions use the same 52 × 26 glass housing.
export const switchSize = {width: 52, height: 26};
export const sliderSize = {diameter: 24, railHeight: 6};
const housingDepth = 0.14, thumbDepth = 0.24;

function capsule(w, h, depth, bevel) {
  const shape = createGlassGeometry();
  shape.update(w, h, h / 2, depth, bevel);
  return shape.geometry;
}

function roundLens(diameter, depth) {
  const geometry = new THREE.SphereGeometry(1, 48, 24);
  geometry.rotateX(Math.PI / 2);
  geometry.scale(diameter / 2, diameter / 2, depth / 2);
  return geometry;
}

function createRailMaterial(onColor, progress, railWidth, hasRemainder) {
  const material = new THREE.MeshBasicMaterial({color: '#989898', toneMapped: false});
  material.onBeforeCompile = shader => {
    shader.uniforms.uRailAccent = {value: new THREE.Color(onColor)};
    shader.uniforms.uRailFill = progress;
    shader.uniforms.uRailWidth = {value: railWidth};
    shader.uniforms.uHasRemainder = {value: hasRemainder};
    shader.vertexShader = 'varying float vRailX; uniform float uRailWidth;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vRailX = position.x / uRailWidth + 0.5;`);
    shader.fragmentShader = 'varying float vRailX; uniform vec3 uRailAccent; uniform float uRailFill; uniform bool uHasRemainder;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float aa = max(fwidth(vRailX), 0.0001);
      float boundary = mix(-aa, 1.0 + aa, uRailFill);
      if (uHasRemainder) {
        diffuseColor.rgb = mix(uRailAccent, diffuseColor.rgb, smoothstep(boundary - aa, boundary + aa, vRailX));
      } else {
        // Leave the clear portion out of both the colour and transmission buffers.
        if (vRailX > boundary) discard;
        diffuseColor.rgb = uRailAccent;
      }`);
  };
  return material;
}

function createShape({width, housingHeight, railWidth, railHeight, thumbDiameter, backingColor}) {
  const housingGeometry = capsule(width, housingHeight, housingDepth, 0.065);
  const railGeometry = capsule(railWidth, railHeight, 0.035, 0.015);
  const thumbGeometry = roundLens(thumbDiameter, thumbDepth);
  const backingDiameter = thumbDiameter * 0.60;
  const backingGeometry = new THREE.CircleGeometry(backingDiameter / 2, 48);
  const backingMaterial = new THREE.MeshBasicMaterial({color: backingColor, toneMapped: false});
  return {
    width, housingHeight, railWidth, thumbDiameter, housingGeometry, railGeometry, thumbGeometry, backingGeometry, backingMaterial,
    dispose() {
      housingGeometry.dispose();
      railGeometry.dispose();
      thumbGeometry.dispose();
      backingGeometry.dispose();
      backingMaterial.dispose();
    },
  };
}

// The glyph of an action, in white on nothing: the button gives it its ink.
function buttonFaceTexture(doc, icon, glyphFraction) {
  const source = doc.createElement('canvas');
  source.width = source.height = 256;
  const ctx = source.getContext('2d');
  const svg = new DOMParser().parseFromString(icon, 'image/svg+xml').documentElement;
  const box = svg.viewBox.baseVal;
  const iconScale = source.width * glyphFraction / box.width;
  ctx.translate(source.width / 2, source.height / 2);
  ctx.scale(iconScale, iconScale);
  ctx.translate(-box.x - box.width / 2, -box.y - box.height / 2);
  ctx.fillStyle = '#fff';
  ctx.fill(new Path2D(svg.querySelector('path').getAttribute('d')));
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The action of a field or a prompt: a glyph printed on the pane in the colour
// ink, at the opacity rest until the pointer is over it or it is pressed, and a
// circle of the same colour under it then, at the opacity backing. icon: 'send'
// an arrow up, 'down' an arrow down for an action whose answer opens below it,
// 'search' Enter, which turns into a spinner and a checkmark.
export function attachActionButton(card, sceneUnit, {slot, ink, icon = 'send', glyphSize, rest = 0.68, backing: backingOpacity = 0.2}) {
  const size = slot.offsetWidth * sceneUnit;
  const search = icon === 'search', name = search ? 'search' : 'ask-send';
  const group = new THREE.Group();
  group.name = name + '-button';
  group.visible = false;
  const glyphFraction = glyphSize === undefined ? 18 / 32 : glyphSize / slot.offsetWidth;
  const makeFace = svg => buttonFaceTexture(slot.ownerDocument, svg, glyphFraction);
  const texture = makeFace(search ? arrowElbowDownLeftBold : icon === 'down' ? arrowDownBold : arrowUpBold);
  const loadingTexture = search ? makeFace(circleNotchBold) : null;
  const checkedTexture = search ? makeFace(checkBold) : null;
  loadingTexture?.center.set(0.5, 0.5);
  const faceMaterial = new THREE.MeshBasicMaterial({map: texture, color: ink, toneMapped: false, transparent: true, depthWrite: false});
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.5, 64), faceMaterial);
  face.name = name + '-face';
  // The hit area is always the same size. Its backing is on screen only when
  // the scene asks for it.
  const backing = new THREE.Mesh(face.geometry,
    new THREE.MeshBasicMaterial({color: ink, toneMapped: false, transparent: true, depthWrite: false}));
  backing.name = name + '-backing';
  backing.visible = false;
  face.renderOrder = backing.renderOrder + 1;
  group.add(face, backing);
  card.group.add(group);

  let x = slot.offsetWidth / 2, y = slot.offsetHeight / 2;
  for (let node = slot; node && node !== card.element; node = node.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return {
    group,
    // loading: seconds the spinner has turned, or null for the resting glyph.
    // fill: how far the glyph has come up from its resting opacity, 0 to 1.
    // shift moves the button along the surface from its slot, in logical
    // pixels. disc is how much of the backing shows, when not fill.
    draw(scale, {loading: loadingSeconds = null, checked = false, fill = 0, shift = 0, disc = fill} = {}) {
      backing.visible = disc > 0;
      backing.material.opacity = disc * backingOpacity;
      faceMaterial.opacity = rest + (1 - rest) * fill;
      if (loadingTexture) {
        faceMaterial.map = checked ? checkedTexture : loadingSeconds === null ? texture : loadingTexture;
        // Rotate the printed mark in UV space while the button stays fixed.
        if (loadingSeconds !== null) loadingTexture.rotation = -2 * Math.PI * loadingSeconds / 0.9;
      }
      group.visible = scale > 0.001;
      group.scale.setScalar(size * scale);
      group.position.set((x + shift - card.width / 2) * sceneUnit, (card.height / 2 - y) * sceneUnit, card.geometry.depth / 2 + 0.012);
    },
    dispose() {
      group.removeFromParent();
      face.geometry.dispose();
      faceMaterial.dispose();
      backing.material.dispose();
      texture.dispose();
      loadingTexture?.dispose();
      checkedTexture?.dispose();
    },
  };
}

// Every row uses the same optical assembly. Geometry can be shared, while
// fill and transmission belong to each control and its local timeline.
function attachControl(card, slot, sceneUnit, shape, name, onColor, createFinish, trace) {
  const {width, housingHeight, railWidth, thumbDiameter, housingGeometry, railGeometry, thumbGeometry} = shape;
  const group = new THREE.Group();
  group.name = 'liquid-' + name;
  group.visible = false;
  card.group.add(group);
  const progress = {value: 0};
  const size = (slot.offsetHeight || parseFloat(slot.style.height)) * sceneUnit;
  const housingFinish = createFinish({insetControl: true, localUnit: size});
  housingFinish.setDimensions(width, housingHeight, housingHeight / 2, housingDepth);
  const thumbFinish = createFinish({insetControl: true, localUnit: size});
  thumbFinish.setDimensions(thumbDiameter, thumbDiameter, thumbDiameter / 2, thumbDepth);
  const hasRemainder = name === 'slider';
  const glass = thumbFinish.kind !== 'metal';
  const clearGlass = thumbFinish.kind === 'glass';
  const railMaterial = createRailMaterial(onColor, progress, railWidth, hasRemainder);
  const housing = new THREE.Mesh(housingGeometry, housingFinish.meshMaterial);
  const rail = new THREE.Mesh(railGeometry, railMaterial);
  const thumb = new THREE.Mesh(thumbGeometry, thumbFinish.meshMaterial);
  const backing = new THREE.Mesh(shape.backingGeometry, shape.backingMaterial);
  housing.name = name + '-housing'; rail.name = name + '-rail'; thumb.name = name + '-thumb';
  housing.position.z = housingDepth / 2;
  rail.position.z = housingDepth + 0.025;
  thumb.position.z = rail.position.z + 0.02 + thumbDepth / 2;
  housing.renderOrder = 1;
  thumb.renderOrder = 2;
  backing.name = name + '-thumb-backing';
  // The glass lens samples the disc above the rail. On metal the insert sits
  // just above the dome so it remains visible at every camera distance.
  backing.position.z = glass ? -(thumbDepth / 2 + 0.001) : thumbDepth / 2 + 0.012;
  backing.renderOrder = glass ? rail.renderOrder + 1 : thumb.renderOrder + 1;
  thumb.add(backing);
  group.add(housing, rail, thumb);
  // Glass, clear or smoked, traces the casing and the thumb as the panes are traced
  // (liquid.mjs): the casing a thin clear slab over the pane, the thumb a deep
  // lens over the rail and its disc. Their polygons stay as the parts' measure
  // and place, undrawn.
  let traced = null;
  if (trace && glass) {
    const unit = trace.pixel / size;
    const casing = trace.slab({lens: false, unit, finish: housingFinish}), lens = trace.slab({lens: true, unit, finish: thumbFinish});
    casing.mesh.name = name + '-housing-slab'; lens.mesh.name = name + '-thumb-slab';
    casing.mesh.renderOrder = 1; lens.mesh.renderOrder = 2;
    housing.add(casing.mesh); thumb.add(lens.mesh);
    // What the thumb looks at: the pane with the casing, the rail and the disc.
    trace.behind(rail, backing, casing.mesh);
    trace.each(() => {
      casing.update(width, housingHeight, housingHeight / 2, {deep: housingDepth / 2, bevel: 0.065, behind: housingDepth / 2 + 0.02});
      lens.update(thumbDiameter, thumbDiameter, thumbDiameter / 2, {deep: thumbDepth / 2, behind: thumbDepth / 2 + 0.03});
    });
    traced = {casing, lens};
  }

  // The semantic slot and meshes use the same card-local CSS pixel grid.
  // Measure once before the card receives its perspective transform.
  const x = (slot.offsetLeft + slot.offsetWidth / 2 - card.width / 2) * sceneUnit;
  const y = (card.height / 2 - slot.offsetTop - slot.offsetHeight / 2) * sceneUnit;
  return {
    draw(thumbX, fill, sliderClarity) {
      group.visible = card.opacity > 0;
      group.position.set(x, y, card.geometry.depth / 2 + 0.012);
      group.scale.setScalar(size * card.opacity);
      progress.value = fill;
      rail.visible = hasRemainder || fill > 0;
      thumb.position.x = thumbX;
      if (!hasRemainder) {
        // The off indicator contracts as the switch travels.
        backing.visible = fill < 1;
        backing.scale.setScalar(1 - fill);
      }
      if (clearGlass && hasRemainder) {
        // At rest the slider clouds over a little; it clears as it moves.
        traced?.casing.veil(1.2 * (1 - sliderClarity));
        traced?.lens.veil(1.2 * (1 - sliderClarity));
      }
    },
    dispose() {
      group.removeFromParent();
      thumbFinish.dispose(); railMaterial.dispose(); housingFinish.dispose();
    },
  };
}

// trace: the world's way to trace clear glass parts, or null for polygons.
export function attachGlassControls(card, sceneUnit, {switchSlots, sliderSlot, accent}, createFinish, trace = null) {
  const width = switchSize.width / switchSize.height;
  const switchShape = createShape({width, housingHeight: 1, railWidth: width * 0.72, railHeight: 0.45,
    thumbDiameter: 0.78, backingColor: 0xffffff});
  const switches = switchSlots.map(slot => attachControl(card, slot, sceneUnit, switchShape, 'switch', accent, createFinish, trace));
  let sliderShape, slider;
  if (sliderSlot) {
    const w = sliderSlot.offsetWidth / sliderSlot.offsetHeight;
    const railHeight = sliderSize.railHeight / sliderSize.diameter;
    // The transparent casing leaves an equal inset at the ends and sides.
    const housingHeight = 0.5;
    sliderShape = createShape({width: w, housingHeight, railWidth: w - (housingHeight - railHeight), railHeight,
      thumbDiameter: 1, backingColor: accent});
    slider = attachControl(card, sliderSlot, sceneUnit, sliderShape, 'slider', accent, createFinish, trace);
  }
  return {
    updateSwitch(index, travel) {
      const x = (2 * travel - 1) * (width / 2 - 0.10 - switchShape.thumbDiameter / 2);
      switches[index].draw(x, travel);
    },
    updateSlider(value, movement) {
      const x = (value - 0.5) * (sliderShape.width - sliderShape.thumbDiameter);
      slider.draw(x, 0.5 + x / sliderShape.railWidth, 0.90 + 0.10 * movement);
    },
    dispose() {
      for (const model of switches) model.dispose();
      switchShape.dispose();
      slider?.dispose(); sliderShape?.dispose();
    },
  };
}
