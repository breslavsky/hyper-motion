import * as THREE from '../vendor/three/build/three.module.min.js';
import {TextGeometry} from '../vendor/three/examples/jsm/geometries/TextGeometry.js';
import {chrome} from './materials.mjs';
import {seeded, lerp} from './model.mjs';

export function buildWord(font, specification, materials = {}) {
  const {text, geometry: options} = specification;
  const cap = new TextGeometry('H', {font, size: 1, depth: 0.01, curveSegments: 2, bevelEnabled: false});
  cap.computeBoundingBox();
  const size = 1 / (cap.boundingBox.max.y - cap.boundingBox.min.y); cap.dispose();
  const faceOptions = {color: '#e4e7ec', roughness: 0.08, pillow: 0.55, ...materials.face, ...specification.materials?.face};
  const sideOptions = {color: '#8d939c', roughness: 0.22, ...materials.side, ...specification.materials?.side};
  const face = chrome(faceOptions), side = chrome(sideOptions);
  const group = new THREE.Group(), letters = [], pieces = [];
  let cursor = 0;
  for (const ch of text) {
    const glyph = font.data.glyphs[ch];
    if (!glyph) throw new Error(`Font ${font.data.familyName} lacks ${JSON.stringify(ch)}; supply another local font geometry`);
    const advance = glyph.ha * size / font.data.resolution;
    if (!glyph.o?.trim()) { cursor += advance + options.tracking; continue; }
    const geometry = new TextGeometry(ch, {font, size, depth: options.depth, curveSegments: options.curveSegments,
      bevelEnabled: options.bevel > 0, bevelThickness: options.bevel, bevelSize: options.bevel * 0.75, bevelSegments: options.bevelSegments});
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox.clone(), cx = (bounds.min.x + bounds.max.x) / 2;
    geometry.translate(-cx, -0.5, -options.depth / 2 - options.bevel / 2);
    const holder = new THREE.Group(); holder.position.x = cursor + cx; group.add(holder);
    const mesh = new THREE.Mesh(geometry, [face, side]); holder.add(mesh);
    letters.push({ch, holder, mesh, geometry, x: cursor + cx, width: bounds.max.x - bounds.min.x});
    cursor += advance + options.tracking;
  }
  if (!letters.length) throw new Error('Text has no drawable glyphs');
  const min = Math.min(...letters.map(l => l.x - l.width / 2)), max = Math.max(...letters.map(l => l.x + l.width / 2));
  for (const l of letters) { l.x -= (min + max) / 2; l.holder.position.x = l.x; }
  const random = seeded(specification.fracture?.seed ?? 77);
  const cuts = specification.slices ?? [];
  if (cuts.length) for (const letter of letters) {
    const planes = cuts.map(c => new THREE.Plane(new THREE.Vector3(...c.normal).normalize(), -c.offset));
    const regions = planes.length === 1 ? [[1], [-1]] : [[1, 0], [-1, 1], [-1, -1]];
    letter.holder.remove(letter.mesh);
    for (const [index, signs] of regions.entries()) {
      const local = signs.flatMap((sign, i) => sign ? [sign < 0 ? planes[i].clone().negate() : planes[i].clone()] : []);
      const front = chrome(faceOptions), edge = chrome(sideOptions);
      front.clippingPlanes = local.map(p => p.clone()); edge.clippingPlanes = local.map(p => p.clone());
      front.side = edge.side = THREE.DoubleSide;
      const mesh = new THREE.Mesh(letter.geometry, [front, edge]);
      const pivot = new THREE.Group(); pivot.add(mesh); letter.holder.add(pivot);
      const direction = index % 2 === 0 ? 1 : -1, normal = planes[0].normal;
      const fracture = specification.fracture ?? {};
      const shear = (fracture.shear ?? 0.18) * lerp(0.6, 1.2, random()) * direction;
      const separation = (fracture.separation ?? 0.06) * direction;
      pieces.push({mesh, pivot, local, face: front, side: edge,
        offset: [-normal.y * shear + normal.x * separation, normal.x * shear + normal.y * separation,
          (random() - 0.5) * 2 * (fracture.depth ?? 0.12)],
        rotation: (random() - 0.5) * 2 * (fracture.rotation ?? 0.05)});
    }
  }
  return {group, letters, pieces, width: max - min, face, side};
}

export function updateClipping(word) {
  for (const piece of word.pieces) for (let i = 0; i < piece.local.length; i++) {
    piece.face.clippingPlanes[i].copy(piece.local[i]).applyMatrix4(piece.mesh.matrixWorld);
    piece.side.clippingPlanes[i].copy(piece.face.clippingPlanes[i]);
  }
}
