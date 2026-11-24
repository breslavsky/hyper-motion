/** A local-time adaptation of Pure Kinetic's real Three.js phone scene. */
import * as THREE from '../vendor/three/three.module.min.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../vendor/three/RoundedBoxGeometry.js';

// Rendering and copying are synchronous. Instances share only the expensive GPU
// context and environment; their scene, camera, texture and output are private.
let gpu;
function renderer(width, height) {
  if (!gpu) {
    const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    gl.setPixelRatio(1);
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.NeutralToneMapping;
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    gpu = { gl, environment, width: 0, height: 0 };
  }
  if (gpu.width !== width || gpu.height !== height) {
    gpu.gl.setSize(width, height, false);
    gpu.width = width;
    gpu.height = height;
  }
  return gpu;
}

function roundedFace(width, height, radius) {
  const s = new THREE.Shape();
  const x = -width / 2, y = -height / 2;
  s.moveTo(x + radius, y);
  s.lineTo(x + width - radius, y);
  s.quadraticCurveTo(x + width, y, x + width, y + radius);
  s.lineTo(x + width, y + height - radius);
  s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  s.lineTo(x + radius, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - radius);
  s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y);
  const geometry = new THREE.ShapeGeometry(s, 16);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) geometry.attributes.uv.setXY(i, (position.getX(i) - x) / width, (position.getY(i) - y) / height);
  return geometry;
}

function spring(t) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * 1.4, damping = 0.62;
  const wd = w * Math.sqrt(1 - damping * damping);
  const value = 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + damping * w / wd * Math.sin(wd * t));
  return value > 1 ? 1 + (value - 1) * 0.5 : value;
}

function mix(a, b, amount) {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), amount).getHexString()}`;
}

function roundRect(g, x, y, width, height, radius, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, width, height, radius);
  g.fill();
}

function wrapText(g, value, width, breakWords) {
  const lines = [];
  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (g.measureText(word).width > width) {
        if (!breakWords) return null;
        // Break a long token only at a Unicode code point, never clip its tail.
        if (line) { lines.push(line); line = ''; }
        for (const char of Array.from(word)) {
          if (line && g.measureText(line + char).width > width) { lines.push(line); line = ''; }
          line += char;
        }
      } else if (line && g.measureText(`${line} ${word}`).width > width) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export default async function create(ctx, data) {
  if (data.image != null) throw new Error('phone3d.image is not supported by this pilot: use appName; image text needs a separate semantic annotation contract.');
  const appName = String(data.appName ?? '').trim();
  if (!appName) throw new Error('phone3d.appName must contain visible text.');
  const caption = String(data.caption ?? '').trim();
  const { root, width, height, safe, style, duration } = ctx;
  // Square and landscape use the phone's full height so screen text does not
  // become a miniature UI below a caption. Tall frames stack the two regions.
  const wide = width >= height;
  const gap = 32 * ctx.scale;
  const captionBox = wide
    ? { x: safe.x, y: safe.y + safe.h * 0.18, w: safe.w * 0.47, h: safe.h * 0.64 }
    : { x: safe.x, y: safe.y, w: safe.w, h: safe.h * (width < height ? 0.21 : 0.23) };
  const phoneBox = wide
    ? { x: safe.x + safe.w * (caption ? 0.51 : 0.15), y: safe.y, w: safe.w * (caption ? 0.49 : 0.7), h: safe.h }
    : { x: safe.x, y: safe.y + (caption ? captionBox.h + gap : 0), w: safe.w, h: safe.h - (caption ? captionBox.h + gap : 0) };
  const output = ctx.el('canvas', root, {
    position: 'absolute', left: `${phoneBox.x}px`, top: `${phoneBox.y}px`, width: `${phoneBox.w}px`, height: `${phoneBox.h}px`,
  });
  output.setAttribute('aria-label', 'Animated three-dimensional phone');
  output.width = Math.ceil(phoneBox.w);
  output.height = Math.ceil(phoneBox.h);
  const out = output.getContext('2d');
  let captionNode;
  if (caption) {
    captionNode = ctx.text(root, caption, 'title', {
      position: 'absolute', left: `${captionBox.x}px`, top: `${captionBox.y}px`, width: `${captionBox.w}px`,
      textAlign: wide ? 'left' : 'center', lineHeight: '1.05', margin: '0', transformOrigin: 'center',
    });
    ctx.fit(captionNode, captionBox.w, captionBox.h - 2, { max: ctx.type.title, min: ctx.type.label, wrap: true });
    // Center the fitted caption in its allocated region without constraining its
    // content box: DOM measurements still see every actual line.
    captionNode.style.top = `${captionBox.y + (captionBox.h - captionNode.getBoundingClientRect().height) / 2}px`;
  }

  const scene = new THREE.Scene();
  const phone = new THREE.Group();
  scene.add(phone);
  const camera = new THREE.PerspectiveCamera(30, phoneBox.w / phoneBox.h, 0.1, 200);
  camera.position.z = Math.max(1.15 / Math.tan(Math.PI / 12), 0.57 / (Math.tan(Math.PI / 12) * camera.aspect));
  camera.updateMatrixWorld();
  const palette = Array.isArray(style.palette) ? style.palette : Object.values(style.palette ?? {});
  const colors = palette.filter(c => typeof c === 'string' && c !== style.bg);
  if (!colors.length) colors.push(style.accent);
  const { environment } = renderer(output.width, output.height);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 6);
  const rim = new THREE.PointLight(new THREE.Color(colors[0]), 40, 0, 1.6);
  rim.position.set(-4, -2, 3);
  const warm = new THREE.PointLight(new THREE.Color(colors[1] ?? style.accent), 30, 0, 1.6);
  warm.position.set(4, 3, -1);
  scene.add(key, rim, warm, new THREE.AmbientLight(0xffffff, 0.25));

  const sw = 0.93, sh = 1.99, textureWidth = 600, textureHeight = 1240;
  const body = new THREE.Mesh(new RoundedBoxGeometry(1, 2.06, 0.1, 6, 0.15), new THREE.MeshPhysicalMaterial({
    color: 0x1a1b1f, metalness: 0.75, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.1,
  }));
  phone.add(body);
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = textureWidth;
  textureCanvas.height = textureHeight;
  const g = textureCanvas.getContext('2d');
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const screen = new THREE.Mesh(roundedFace(sw, sh, 0.12), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  screen.position.z = 0.0505;
  const glass = new THREE.Mesh(roundedFace(sw, sh, 0.12), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0, clearcoat: 1 }));
  glass.position.z = 0.053;
  const island = new THREE.Mesh(roundedFace(0.24, 0.07, 0.035), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  island.position.set(0, 0.93, 0.056);
  phone.add(screen, glass, island);

  function pose(t) {
    const k = spring(t - 0.05);
    phone.position.set(0, (1 - k) * -2.6 + Math.sin(t * 1.3) * 0.07, 0);
    phone.rotation.set(0.05 + (1 - k) * 0.4 + Math.sin(t * 0.8) * 0.05, (1 - k) * -1.5 + Math.sin(t * 0.7) * 0.3, (1 - k) * 0.12 + Math.sin(t * 0.6) * 0.03);
    scene.updateMatrixWorld(true);
  }
  function project(x, y) {
    const p = new THREE.Vector3((x / textureWidth - 0.5) * sw, (0.5 - y / textureHeight) * sh, screen.position.z);
    p.applyMatrix4(phone.matrixWorld).project(camera);
    return { x: phoneBox.x + (p.x + 1) * phoneBox.w / 2, y: phoneBox.y + (1 - p.y) * phoneBox.h / 2 };
  }

  // Choose the canvas type size from its worst projected size during the read
  // phase, not from its unprojected texture pixels. The 4% reserve covers the
  // extrema between the finite geometry samples and later individual lines.
  let minScale = Infinity;
  for (let t = 1; t <= 4.001; t += 0.025) {
    pose(t);
    for (const x of [48, 300, 552]) for (const y of [105, 260, 415]) {
      const a = project(x, y), b = project(x, y + 1);
      minScale = Math.min(minScale, Math.hypot(b.x - a.x, b.y - a.y));
    }
  }
  const minimum = Math.ceil(ctx.type.label / minScale * 1.04);
  const maximum = Math.max(minimum, 100);
  let fontSize, lines;
  // Keep whole words whenever they fit above the projected minimum. Only an
  // otherwise impossible single token may use character wrapping.
  for (const breakWords of [false, true]) {
    for (let size = maximum; size >= minimum; size--) {
      g.font = `${style.weight ?? 700} ${size}px "${style.font}", sans-serif`;
      if ('letterSpacing' in g) g.letterSpacing = `${(style.tracking ?? 0) * size}px`;
      const candidate = wrapText(g, appName, 504, breakWords);
      if (candidate && candidate.length <= 3 && candidate.length * size * 1.12 <= 330) {
        fontSize = size;
        lines = candidate;
        break;
      }
    }
    if (lines) break;
  }
  function dispose() {
    for (const mesh of [body, screen, glass, island]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    texture.dispose();
    output.remove();
    captionNode?.remove();
  }
  if (!lines) {
    dispose();
    throw new Error(`phone3d.appName does not fit in three lines at the required projected ${ctx.type.label.toFixed(1)} px minimum. Shorten the app name.`);
  }

  // The original screen's hero, avatar circles and list remain vector artwork;
  // grey bars intentionally carry no invented UI text.
  const headerTop = 105, lineHeight = fontSize * 1.12;
  const headerBottom = headerTop + lines.length * lineHeight;
  g.fillStyle = style.bg;
  g.fillRect(0, 0, textureWidth, textureHeight);
  const heroTop = headerBottom + 26;
  const gradient = g.createLinearGradient(0, heroTop, 600, heroTop + 240);
  gradient.addColorStop(0, mix(style.accent, style.fg, 0.15));
  gradient.addColorStop(1, mix(style.accent, style.bg, 0.1));
  roundRect(g, 40, heroTop, 520, 236, 40, gradient);
  g.fillStyle = style.fg;
  g.textBaseline = 'top';
  g.font = `${style.weight ?? 700} ${fontSize}px "${style.font}", sans-serif`;
  const semanticLines = lines.map((text, i) => {
    const x = 48, y = headerTop + i * lineHeight;
    g.fillText(text, x, y);
    const metrics = g.measureText(text);
    return { text, x: x - metrics.actualBoundingBoxLeft, y: y - metrics.actualBoundingBoxAscent,
      width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
      height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
      fontSize, baselineX: x, baselineY: y };
  });
  const listTop = heroTop + 260;
  const count = Math.max(2, Math.min(5, Math.floor((1200 - listTop) / 150)));
  const hash = n => { const v = Math.sin((n + Number(ctx.seed || 0)) * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < count; i++) {
    const y = listTop + i * 150;
    roundRect(g, 40, y, 520, 124, 28, mix(style.bg, style.fg, 0.07));
    g.fillStyle = colors[i % colors.length];
    g.beginPath(); g.arc(110, y + 62, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = mix(style.bg, style.fg, 0.75);
    g.fillRect(170, y + 38, 240 + hash(i) * 110, 20);
    g.fillStyle = mix(style.bg, style.fg, 0.25);
    g.fillRect(170, y + 72, 180 + hash(i + 3) * 120, 16);
  }
  texture.needsUpdate = true;

  let localTime = 0;
  function draw(localSeconds) {
    localTime = Math.max(0, Math.min(duration, localSeconds));
    const t = localTime / duration * 4;
    pose(t);
    if (captionNode) {
      const p = Math.min(1, Math.max(0, t / 0.6));
      const ease = 1 - (1 - p) ** 3;
      captionNode.style.opacity = String(ease);
      // Release the transformed text layer at rest. Retaining an identity
      // transform can preserve a raster from an earlier rotated entrance when
      // HyperFrames hides and restores an overlapping composition.
      captionNode.style.transform = p === 1 ? 'none' : `translateY(${(1 - ease) * 40 * ctx.scale}px) rotate(${(1 - ease) * -6}deg)`;
    }
    const { gl } = renderer(output.width, output.height);
    gl.setClearColor(0x000000, 0);
    gl.render(scene, camera);
    out.clearRect(0, 0, output.width, output.height);
    out.drawImage(gl.domElement, 0, 0, output.width, output.height);
  }
  function audit() {
    return semanticLines.map((line, i) => {
      const points = [[line.x, line.y], [line.x + line.width, line.y], [line.x, line.y + line.height], [line.x + line.width, line.y + line.height]].map(([x, y]) => project(x, y));
      const left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y));
      const right = Math.max(...points.map(p => p.x)), bottom = Math.max(...points.map(p => p.y));
      const a = project(line.baselineX, line.baselineY), b = project(line.baselineX, line.baselineY + line.fontSize);
      return { key: `appName:${i}`, text: line.text, x: left, y: top, width: right - left, height: bottom - top,
        fontSize: Math.hypot(b.x - a.x, b.y - a.y), visible: localTime >= duration * 0.25,
        intentionalClip: localTime < duration * 0.25 ? 'Phone enters before its reading phase.' : undefined };
    });
  }
  draw(0);
  return { draw, audit, dispose, events: [{ time: duration * 0.22, kind: 'hit', target: 'phone' }],
    layout: { mode: wide ? 'caption-left-phone-right' : 'caption-top-phone-bottom', phone: phoneBox, caption: captionBox } };
}
