import * as THREE from '../vendor/three/build/three.module.min.js';
import {clamp, lerp, ease} from './model.mjs';

// r8's procedural reflection studio: bright softboxes, a crisp horizon and dark floor.
// PMREM supplies roughness-aware raster reflections; no image/HTTP or path tracer.
export function makeEnvironment(renderer, config = {}) {
  const width = config.width ?? 1024, height = width / 2;
  const data = new Float32Array(width * height * 4);
  const boxes = config.boxes ?? [[Math.PI / 2, 0.42, 1.1, 0.05, 2.2],
    [Math.PI / 2 + 0.9, 0.16, 0.22, 0.2, 1.6], [Math.PI / 2 - 1.1, 0.7, 0.35, 0.1, 2],
    [-Math.PI / 2, 0.3, 0.5, 0.06, 2.5], [0.2, 0.05, 0.12, 0.35, 2.5], [Math.PI - 0.2, 0.55, 0.2, 0.15, 3]];
  const tint = config.tint ?? [0.96, 0.985, 1.03];
  const soft = (d, half, feather) => 1 - ease(clamp((Math.abs(d) - half) / feather + 0.5));
  for (let y = 0; y < height; y++) {
    const elevation = ((y + 0.5) / height - 0.5) * Math.PI;
    for (let x = 0; x < width; x++) {
      const azimuth = ((x + 0.5) / width - 0.5) * 2 * Math.PI;
      let c = elevation > 0 ? lerp(0.8, 0.16, (elevation / (Math.PI / 2)) ** 0.55) : 0.035 + 0.12 * Math.exp(elevation * 22);
      if (elevation < 0 && elevation > -0.03) c += 0.5;
      for (const [az, el, wa, we, intensity] of boxes) {
        const delta = Math.atan2(Math.sin(azimuth - az), Math.cos(azimuth - az));
        c += intensity * soft(delta, wa, 0.04) * soft(elevation - el, we, 0.02);
      }
      const i = (y * width + x) * 4;
      for (let k = 0; k < 3; k++) data[i + k] = c * tint[k] * (config.intensity ?? 1);
      data[i + 3] = 1;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.magFilter = texture.minFilter = THREE.LinearFilter; texture.needsUpdate = true;
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromEquirectangular(texture);
  generator.dispose(); texture.dispose();
  return target;
}

// Preserve r8's slight face-normal bulge so front faces sample a band of the environment.
export function chrome({color = '#dfe2e7', roughness = 0.1, metalness = 1, pillow = 0, lift = 0, env = 1, flat = false} = {}) {
  const material = new THREE.MeshStandardMaterial({color, metalness, roughness, envMapIntensity: env, flatShading: flat});
  if (pillow) {
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>\nif(abs(objectNormal.z)>0.9) objectNormal=normalize(vec3(objectNormal.x,${Number(pillow).toFixed(5)}*(position.y+${Number(lift).toFixed(5)}),objectNormal.z));`);
    };
    material.customProgramCacheKey = () => `spatial-pillow:${pillow}/${lift}`;
  }
  return material;
}

export function flareTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const radial = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [at, alpha] of [[0, 1], [0.03, 0.85], [0.1, 0.12], [0.4, 0.02], [1, 0]]) radial.addColorStop(at, `rgba(255,255,255,${alpha})`);
  ctx.fillStyle = radial; ctx.fillRect(0, 0, 256, 256);
  for (const vertical of [false, true]) {
    const gradient = ctx.createLinearGradient(0, 0, vertical ? 0 : 256, vertical ? 256 : 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)'); gradient.addColorStop(0.5, `rgba(255,255,255,${vertical ? 0.35 : 0.85})`); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    if (vertical) ctx.fillRect(127, 40, 2, 176); else ctx.fillRect(0, 126, 256, 4);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.NoColorSpace;
  return texture;
}
