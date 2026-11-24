import {Matrix4, Vector3} from '../../vendor/three/three.module.min.js';

// Copy only the optical footprint over the native text. The projected convex
// hull of the bevelled mesh includes both lips, even while the camera turns.
export function createLensOverlay(overlay, source, mesh) {
  const {width, height} = source;
  const context = overlay.getContext('2d');
  const vertices = mesh.geometry.getAttribute('position');
  const points = Array.from({length: vertices.count}, () => new Vector3());
  const projection = new Matrix4(), previous = new Matrix4();
  const hull = [];
  let path = null, lastVersion = -1, left = 0, top = 0, w = 0, h = 0;

  function append(point, start) {
    while (hull.length >= start + 2) {
      const a = hull[hull.length - 2], b = hull[hull.length - 1];
      const turn = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
      if (turn > 0) break;
      hull.pop();
    }
    hull.push(point);
  }

  function updatePath() {
    previous.copy(projection);
    lastVersion = vertices.version;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let i = 0; i < points.length; i++) {
      const point = points[i].fromBufferAttribute(vertices, i).applyMatrix4(projection);
      point.x = (1 + point.x) * width / 2;
      point.y = (1 - point.y) * height / 2;
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    }
    left = Math.max(0, Math.floor(minX) - 1);
    top = Math.max(0, Math.floor(minY) - 1);
    w = Math.min(width, Math.ceil(maxX) + 1) - left;
    h = Math.min(height, Math.ceil(maxY) + 1) - top;
    points.sort((a, b) => a.x - b.x || a.y - b.y);
    hull.length = 0;
    for (const point of points) append(point, 0);
    const upperStart = hull.length - 1;
    for (let i = points.length - 2; i >= 0; i--) append(points[i], upperStart);
    path = new Path2D();
    path.moveTo(hull[0].x, hull[0].y);
    for (let i = 1; i < hull.length; i++) path.lineTo(hull[i].x, hull[i].y);
    path.closePath();
  }

  return function update(camera, visible) {
    if (path) context.clearRect(left, top, w, h);
    if (!visible) { path = null; return; }
    projection.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse).multiply(mesh.matrixWorld);
    if (!path || !previous.equals(projection) || lastVersion !== vertices.version) updatePath();
    if (w <= 0 || h <= 0) return;
    context.save();
    context.clip(path);
    context.drawImage(source, left, top, w, h, left, top, w, h);
    context.restore();
  };
}
