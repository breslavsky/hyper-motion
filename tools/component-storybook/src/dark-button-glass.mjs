import {createContext} from './lib/components/context.mjs';
import {createGlassWorld} from './lib/components/glass/world.mjs';
import {createIslandIcon} from './lib/components/island-icon.mjs';
import * as THREE from './lib/vendor/three/three.module.min.js';

const viewport = document.querySelector('#viewport');
const stage = document.querySelector('#stage');
const stripedOption = document.querySelector('input[value="stripes"]');
const phaseInput = document.querySelector('#stripe-phase');
if (new URLSearchParams(location.search).get('backdrop') === 'stripes') stripedOption.checked = true;
export let world;
let context, side, stripes;

function drawBackdrop() {
  phaseInput.parentElement.hidden = !stripedOption.checked;
  if (!world) return;
  stripes.visible = stripedOption.checked;
  stripes.material.uniforms.uPhase.value = Number(phaseInput.value) / 100;
  world.render(0);
}
document.querySelector('.option-group').addEventListener('change', drawBackdrop);
phaseInput.addEventListener('input', drawBackdrop);

function draw(size) {
  context?.dispose();
  stage.replaceChildren();
  side = size;
  const unit = size / 700;
  stage.style.width = stage.style.height = size + 'px';
  stage.style.setProperty('--u', unit + 'px');
  const plan = {width: size, height: size, look: {material: {type: 'dark-glass', branded: true}}, palette: {}};
  context = createContext({stage, plan});
  const {K} = context;
  world = createGlassWorld({K, parent: stage, mode: 'material-sample', bg: '#000000',
    fg: '#dddddd', accent: '#000000', palette: {}, referencePalette: false});
  // This flat image lives behind both meshes. Their production optical shaders
  // receive the same straight stripes, including when the visitor shifts them.
  const source = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false, uniforms: {uPhase: {value: 0}},
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `varying vec2 vUv;
      uniform float uPhase;
      void main(){
        float p = 10.0 * (vUv.x + 0.68 * vUv.y) + uPhase;
        float distanceToStripe = abs(fract(p) - 0.5);
        float aa = 0.5 * fwidth(p);
        float band = 1.0 - smoothstep(0.10 - aa, 0.10 + aa, distanceToStripe);
        gl_FragColor = vec4(vec3(mix(0.005, 0.72, band)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const plane = new THREE.PlaneGeometry(2, 2);
  stripes = new THREE.Mesh(plane, source);
  stripes.name = 'sample-stripes';
  stripes.renderOrder = 1;
  world.backdropScene.add(stripes);
  K.onDispose(() => {
    plane.dispose(); source.dispose();
  });

  // The layout uses the 700-unit square of the reference. Depth, curvature,
  // glass-on-glass sampling and text projection all come from the component kit.
  function addPlate(name, x, y, w, h, radius, depth, bevel, z, element, finish) {
    const card = world.addCard({width: w * unit, height: h * unit, element, ...finish});
    card.group.name = name;
    const u = unit * world.U;
    card.geometry.update(w * u, h * u, radius * u, depth * u, bevel * u);
    card.group.position.set((x + w / 2 - 350) * u, (350 - y - h / 2) * u, z * u);
  }
  const choices = K.el('div', 'copy choices', stage);
  K.el('div', '', choices, '5.6 Sol');
  K.el('div', '', choices, '5.5');
  addPlate('sample-panel', 123, 123, 605, 452, 64, 6, 2.1, -3, choices, {backdropOnly: true});

  const selected = K.el('div', 'copy selection', stage);
  createIslandIcon(K, selected, 'check', 55 * unit);
  K.el('span', '', selected, '6.0 Astra');
  addPlate('sample-selection', 150, 150, 545, 130, 35, 5, 1.8, 2.5, selected, {insetControl: true});
  drawBackdrop();
}

function fit() {
  // Bound the GPU allocation at the largest displayed size. Resizing the
  // viewport then needs only a CSS transform; the sample has no running clock.
  const size = Math.round(900 * Math.min(window.devicePixelRatio || 1, 2));
  if (size !== side) draw(size);
  stage.style.transform = 'scale(' + viewport.clientWidth / side + ')';
}

const observer = new ResizeObserver(fit);
function start() {
  observer.observe(viewport);
  window.addEventListener('resize', fit);
  fit();
}
window.addEventListener('pageshow', start);
window.addEventListener('pagehide', () => {
  observer.disconnect();
  window.removeEventListener('resize', fit);
  context?.dispose();
  context = world = stripes = undefined;
  side = undefined;
});
start();
