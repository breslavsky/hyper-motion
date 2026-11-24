import * as THREE from '../../vendor/three/three.module.min.js';
import {createSendWave} from './send-wave.mjs';
import {createSendWaveButtonMask} from './send-wave-button-mask.mjs';

// Paint the upstream shader's transparent pixels over the live, projected DOM.
// Only the optical band replaces the real lettering with its refracted image.
// ink is the surface's lettering: a finished canvas, or a function that draws
// it in logical pixels when it changes from frame to frame. The card's send
// button is left out of the picture the wave bends.
export function createSendWaveSurface({card, unit, renderer, source, ink, previewScale, renderW, renderH, tune}) {
  const {width, height, element, geometry} = card;
  const document = element.ownerDocument;
  const radius = geometry.radius / unit;
  const engine = createSendWave({document, width, height, radius, source, tune});
  const eraseButton = createSendWaveButtonMask(card, unit);
  const composite = document.createElement('canvas');
  composite.width = Math.max(1, Math.round(width));
  composite.height = Math.max(1, Math.round(height));
  const input = composite.getContext('2d', {alpha: false});
  const overlay = document.createElement('canvas');
  overlay.className = 'pk-send-wave';
  overlay.width = composite.width;
  overlay.height = composite.height;
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  Object.assign(overlay.style, {position: 'absolute', inset: '0', width: '100%', height: '100%',
    borderRadius: radius + 'px', pointerEvents: 'none', zIndex: '1'});
  element.append(overlay);
  const output = overlay.getContext('2d');
  output.setTransform(overlay.width / width, 0, 0, overlay.height / height, 0, 0);

  // Read the finished 3D material at its own resolution. Composite the font
  // at native size AFTER this step, including in half-resolution previews.
  const sampleW = Math.max(1, Math.min(renderW, Math.round(width * previewScale)));
  const sampleH = Math.max(1, Math.min(renderH, Math.round(height * previewScale)));
  const frame = new THREE.FramebufferTexture(renderW, renderH);
  frame.minFilter = frame.magFilter = THREE.LinearFilter;
  const toClip = new THREE.Matrix4();
  const offset = new THREE.Matrix4().makeTranslation(0, 0, card.contentZ);
  const sampling = new THREE.ShaderMaterial({
    uniforms: {frame: {value: frame}, cardToClip: {value: toClip},
      size: {value: new THREE.Vector2(width * unit, height * unit)}},
    depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: `uniform mat4 cardToClip;
      uniform vec2 size;
      varying vec4 sourceClip;
      void main() {
        sourceClip = cardToClip * vec4(position.xy * size, 0., 1.);
        gl_Position = vec4(position.xy * 2., 0., 1.);
      }`,
    fragmentShader: `uniform sampler2D frame;
      varying vec4 sourceClip;
      void main() { gl_FragColor = texture2D(frame, sourceClip.xy / sourceClip.w * .5 + .5); }`,
  });
  const quad = new THREE.PlaneGeometry(1, 1);
  const captureScene = new THREE.Scene();
  captureScene.add(new THREE.Mesh(quad, sampling));
  const captureCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let progress = 0;

  function captureScreen(scene, camera) {
    const button = card.sendButton.group;
    const visible = button.visible;
    button.visible = false;
    try {
      renderer.render(scene, camera);
      renderer.copyFramebufferToTexture(frame);
    } finally {
      button.visible = visible;
    }
    toClip.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse).multiply(card.group.matrixWorld).multiply(offset);
    renderer.setViewport(0, 0, sampleW, sampleH);
    try {
      renderer.render(captureScene, captureCamera);
      input.drawImage(renderer.domElement, 0, renderH - sampleH, sampleW, sampleH, 0, 0, composite.width, composite.height);
    } finally {
      renderer.setViewport(0, 0, renderW, renderH);
    }
    if (typeof ink === 'function') {
      input.save();
      input.scale(composite.width / width, composite.height / height);
      ink(input);
      input.restore();
    } else input.drawImage(ink, 0, 0, composite.width, composite.height);
    return composite;
  }

  return {
    enabled: true,
    setProgress(value, from) { progress = value; if (from) engine.setSource(from); },
    get active() { return this.enabled && progress > 0 && progress < 1 && engine.available; },
    render(scene, camera) {
      if (!this.active) {
        if (!overlay.hidden) {
          output.clearRect(0, 0, width, height);
          overlay.hidden = true;
        }
        return;
      }
      const wave = engine.draw(progress, () => captureScreen(scene, camera));
      overlay.hidden = !wave;
      if (wave) {
        output.globalCompositeOperation = 'copy';
        output.drawImage(wave, 0, 0, width, height);
        eraseButton(output, camera);
      }
    },
    dispose() {
      overlay.remove();
      engine.dispose();
      frame.dispose(); sampling.dispose(); quad.dispose();
    },
  };
}
