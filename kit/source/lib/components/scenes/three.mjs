// Real 3D scenes (three.js, vendored in ../vendor so the app works offline): glossy slabs that
// cascade in like a 3D explainer, a glassy app-icon hero with orbiting shapes, and a phone that
// swings round to show the screen. One shared WebGL renderer draws whichever 3D scene is on
// screen and copies the frame into that scene's own canvas, so any number of 3D scenes use one
// GPU context. Like everything else, every frame is a pure function of the scene clock.
import * as THREE from "../../vendor/three/three.module.min.js";
import { RoomEnvironment } from "../../vendor/three/RoomEnvironment.js";
import { RoundedBoxGeometry } from "../../vendor/three/RoundedBoxGeometry.js";
import { laptop3d } from "./laptop3d.mjs";
import { synth3d } from "./synth3d.mjs";

const sceneFactories = {};

// Raster textures use the same semantic ladder in a 360-unit local surface.
// The canvas receipt makes painted typography inspectable by the native audit.
function canvasType(K,g,copy,role,w,h,{surfaceWidth=360,truncate=false}={}) {
  const D=K.design.forSurface(g.canvas.width/(surfaceWidth*K.design.unit));
  const family=K.plan.look.display.family;
  for(const spec of truncate?[D.type(role)]:D.steps(role)) {
    const step=spec.step;
    g.font=`${spec.weight} ${spec.size}px ${family}`;
    if('letterSpacing' in g)g.letterSpacing=`${Number.parseFloat(spec.tracking)*spec.size}px`;
    const painted=truncate?D.truncateCanvasLine(g,copy,w):null;
    const metrics=painted??g.measureText(copy);
    if(metrics.width<=w+1&&spec.lineHeight<=h+1){
      const rows=JSON.parse(g.canvas.dataset.designRaster??'[]');
      rows.push({text:copy,role,step,unit:D.unit,size:spec.size,lineHeight:spec.lineHeight,tracking:spec.tracking,weight:spec.weight,width:metrics.width,
        ...(painted?{paintedText:painted.text,truncated:painted.truncated,overflowPolicy:'ellipsis',maxWidth:w}:{})});
      g.canvas.dataset.designRaster=JSON.stringify(rows);
      (K.rasterTypography??=[]).push(rows.at(-1));
      return {...spec,...(painted?{paintedText:painted.text}:{})};
    }
  }
  throw new Error(`Texture text cannot fit ${role}: ${copy}`);
}

// UI printed on a texture uses the same box metrics as DOM UI. The receipt is
// attached immediately before the actual path so the native gate sees painted geometry.
function rasterSurface(g, D, kind, rect, content, options = {}) {
  const {density = "normal", shape = "rounded", ...details} = options;
  const box = D.box(kind, {density, shape});
  g.canvas.dataset.designSurface = JSON.stringify({kind, density, shape, unit:D.unit, rect, content, ...details});
  g.beginPath();
  g.roundRect(rect.x, rect.y, rect.w, rect.h, box.radius);
  g.fill();
  delete g.canvas.dataset.designSurface;
  return box;
}

let R = null;
const shared = (W, H) => {
	if (!R) {
		const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
		r.setPixelRatio(1);
		r.outputColorSpace = THREE.SRGBColorSpace;
		// Neutral keeps brand colours true (ACES washes saturated colours toward pastel).
		r.toneMapping = THREE.NeutralToneMapping;
		r.toneMappingExposure = 1;
		const pm = new THREE.PMREMGenerator(r);
		const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
		R = { r, env, w: 0, h: 0 };
	}
	if (R.w !== W || R.h !== H) {
		R.r.setSize(W, H, false);
		R.w = W;
		R.h = H;
	}
	return R;
};

/** The scene's own 2D canvas; paint() renders a three scene into it. With `halftone` (a colour),
 *  the render is printed as a dot screen in that one colour instead: bright, solid parts get big dots,
 *  shadows small ones, like a duotone print of a 3D object (Higgsfield's "rastr" film). */
const output = (K, cam, halftone) => {
	const { W, H, S, el, set, px } = K;
	const out = el("canvas", "", cam);
	out.width = W;
	out.dataset.designRaster=JSON.stringify(K.rasterTypography??[]);
	out.height = H;
	set(out, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H) });
	const g = out.getContext("2d");
	const cell = Math.max(5, Math.round(12 * S));
	const cols = Math.ceil(W / cell);
	const rows = Math.ceil(H / cell);
	const small = halftone ? document.createElement("canvas") : null;
	if (small) {
		small.width = cols;
		small.height = rows;
	}
	const sg = small?.getContext("2d", { willReadFrequently: true });
	const ownedScenes = new Set();
	K.onDispose?.(() => {
		const resources = new Set();
		for (const scene of ownedScenes) scene.traverse(node => {
			if (node.geometry) resources.add(node.geometry);
			for (const material of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) {
				resources.add(material);
				for (const value of Object.values(material)) if (value?.isTexture && value !== R?.env) resources.add(value);
			}
		});
		for (const resource of resources) resource.dispose();
		ownedScenes.clear();
	});
	return (scene, camera) => {
		ownedScenes.add(scene);
		const { r } = shared(W, H);
		r.setClearColor(0x000000, 0);
		r.render(scene, camera);
		g.clearRect(0, 0, W, H);
		if (!halftone) {
			g.drawImage(r.domElement, 0, 0, W, H);
			return;
		}
		sg.clearRect(0, 0, cols, rows);
		sg.drawImage(r.domElement, 0, 0, cols, rows);
		const d = sg.getImageData(0, 0, cols, rows).data;
		g.fillStyle = halftone;
		g.beginPath();
		for (let y = 0; y < rows; y++)
			for (let x = 0; x < cols; x++) {
				const i = (y * cols + x) * 4;
				const a = d[i + 3] / 255;
				if (a < 0.05) continue;
				const lumi = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
				const rr = cell * 0.6 * Math.sqrt(a * (0.06 + 0.94 * lumi * lumi));
				if (rr < 0.4) continue;
				const cx = (x + 0.5) * cell + (y % 2 ? cell * 0.5 : 0);
				const cy = (y + 0.5) * cell;
				g.moveTo(cx + rr, cy);
				g.arc(cx, cy, rr, 0, Math.PI * 2);
			}
		g.fill();
	};
};

/** A camera far enough back that `halfW` world units fit across half the frame. */
const lens = (W, H, halfW, halfH) => {
	const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);
	const t = Math.tan((15 * Math.PI) / 180);
	const dist = Math.max(halfH / t, halfW / (t * (W / H)));
	camera.position.set(0, 0, dist);
	return { camera, dist };
};

const loadImg = (K, src) =>
	new Promise((res) => {
		const img = new Image();
		img.onload = () => res(img);
		img.onerror = () => res(null);
		img.src = src;
	});

/** A texture filled once its image arrives; the engine waits for it before the first frame. */
const imageTexture = (K, pic, faceAsp) => {
	const t = new THREE.Texture();
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	// Cover-crop the picture onto the face.
	const ia = pic.w / pic.h;
	if (ia > faceAsp) {
		t.repeat.set(faceAsp / ia, 1);
		t.offset.set((1 - faceAsp / ia) / 2, 0);
	} else {
		t.repeat.set(1, ia / faceAsp);
		t.offset.set(0, (1 - ia / faceAsp) / 2);
	}
	K.defer(
		loadImg(K, pic.src).then((img) => {
			if (img) {
				t.image = img;
				t.needsUpdate = true;
			}
		}),
	);
	return t;
};

const canvasTexture = (draw, w = 1024, h = 640) => {
	const cv = document.createElement("canvas");
	cv.width = w;
	cv.height = h;
	draw(cv.getContext("2d"), w, h);
	const t = new THREE.CanvasTexture(cv);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	return t;
};

/** A flat rounded rectangle whose UVs run 0..1 across it (for a slab's printed face). */
const roundedFace = (w, h, rad) => {
	const s = new THREE.Shape();
	const x = -w / 2;
	const y = -h / 2;
	s.moveTo(x + rad, y);
	s.lineTo(x + w - rad, y);
	s.quadraticCurveTo(x + w, y, x + w, y + rad);
	s.lineTo(x + w, y + h - rad);
	s.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
	s.lineTo(x + rad, y + h);
	s.quadraticCurveTo(x, y + h, x, y + h - rad);
	s.lineTo(x, y + rad);
	s.quadraticCurveTo(x, y, x + rad, y);
	const geo = new THREE.ShapeGeometry(s, 16);
	const pos = geo.attributes.position;
	const uv = geo.attributes.uv;
	for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
	return geo;
};

const glossy = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color), metalness: 0.05, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, ...extra });

const accentsOf = (palette, bg) => [palette.electric, palette.coral, palette.peach, palette.lilac, palette.lime, palette.butter].filter((c) => c && String(c).toLowerCase() !== String(bg).toLowerCase());

const lights = (scene, palette, env) => {
	scene.environment = env;
	scene.environmentIntensity = 0.55;
	const key = new THREE.DirectionalLight(0xffffff, 1.6);
	key.position.set(3, 5, 6);
	scene.add(key);
	const rim = new THREE.PointLight(new THREE.Color(palette.electric ?? "#4f6bff"), 40, 0, 1.6);
	rim.position.set(-4, -2, 3);
	scene.add(rim);
	const warm = new THREE.PointLight(new THREE.Color(palette.coral ?? "#ff5c7a"), 30, 0, 1.6);
	warm.position.set(4, 3, -1);
	scene.add(warm);
	scene.add(new THREE.AmbientLight(0xffffff, 0.25));
};

const spring = (K, t, f, d) => K.spring(t, f, d);

// ---- cards3d: thick glossy slabs cascading in ------------------------------------------------------
sceneFactories.cards3d = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, images, textOn, mixHex, clamp, hash, prog, expoOut } = K;
	const s = p.scene;
	const pics = (s.images ?? []).map((u) => images[u]).filter(Boolean);
	const titles = s.titles ?? [];
	const n = Math.max(2, Math.min(5, pics.length || titles.length || 3));
	const scene = new THREE.Scene();
	lights(scene, palette, shared(W, H).env);
	const portrait = W < H;
	const { camera, dist } = lens(W, H, portrait ? 2.05 : 2.9, 1.9);
	const cols = accentsOf(palette, bg);
	const cw = 2.4;
	const ch = 1.5;
	const depth = 0.16;
	const stack = new THREE.Group();
	scene.add(stack);
	const cards = Array.from({ length: n }, (_, i) => {
		const c1 = cols[i % cols.length] ?? accent;
		const grp = new THREE.Group();
		const body = new THREE.Mesh(new RoundedBoxGeometry(cw, ch, depth, 5, 0.15), glossy(mixHex(c1, "#000000", 0.18)));
		grp.add(body);
		const tex = pics.length
			? imageTexture(K, pics[i % pics.length], cw / ch)
			: canvasTexture((g, w, h) => {
					const D = K.design.forSurface(w / (360 * K.design.unit));
					const cardBox = D.box("card", { density: "comfortable" });
					const tileBox = D.box("card", { density: "compact" });
					const tile = D.space(7), tileGap = D.space(3);
					const actionY = h - cardBox.paddingY - tile;
					const gr = g.createLinearGradient(0, 0, w, h);
					gr.addColorStop(0, mixHex(c1, "#ffffff", 0.18));
					gr.addColorStop(1, mixHex(c1, "#000000", 0.12));
					g.fillStyle = gr;
					rasterSurface(g, D, "card", { x:0, y:0, w, h }, { x:cardBox.paddingX, y:cardBox.paddingY, w:w-cardBox.paddingX*2, h:h-cardBox.paddingY*2 }, { density:"comfortable" });
					const sh = g.createRadialGradient(w * 0.2, 0, 0, w * 0.2, 0, w * 0.75);
					sh.addColorStop(0, "rgba(255,255,255,0.35)");
					sh.addColorStop(1, "rgba(255,255,255,0)");
					g.fillStyle = sh;
					g.fillRect(0, 0, w, h);
					const ink = textOn(c1);
					g.fillStyle = ink;
					const title = titles[i % Math.max(1, titles.length)] ?? "";
					const typography=canvasType(K,g,title,'cardTitle',w-cardBox.paddingX*2,h*.32,{truncate:true});
					g.textBaseline = "top";
					g.fillText(typography.paintedText, cardBox.paddingX, cardBox.paddingY);
					// A row of little app tiles, like a real card's quick actions.
					for (let k = 0; k < 3; k++) {
						const x = cardBox.paddingX + k * (tile + tileGap);
						const y = actionY;
						g.fillStyle = ink === "#ffffff" ? "rgba(255,255,255,0.88)" : "rgba(17,17,17,0.85)";
						rasterSurface(g, D, "card", {x, y, w:tile, h:tile}, { x:x+tileBox.paddingX, y:y+tileBox.paddingY, w:tile-tileBox.paddingX*2, h:tile-tileBox.paddingY*2 }, { density:"compact" });
						g.fillStyle = cols[(i + k + 1) % cols.length] ?? accent;
						g.beginPath();
						// This inset is a coloured action glyph; concentric corners follow its containing tile.
						g.roundRect(x + tileBox.paddingX, y + tileBox.paddingY, tile - tileBox.paddingX * 2, tile - tileBox.paddingY * 2, Math.max(0, tileBox.radius - tileBox.paddingX));
						g.fill();
					}
				});
		const face = new THREE.Mesh(roundedFace(cw - 0.02, ch - 0.02, 0.14), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.12 }));
		face.position.z = depth / 2 + 0.003;
		grp.add(face);
		stack.add(grp);
		const holder = new THREE.Group();
		holder.position.set(cw * 0.36, -ch * 0.05, depth / 2 + 0.42);
		grp.add(holder);
		const k = i - (n - 1) / 2;
		return {
			grp,
			holder,
			home: new THREE.Vector3(k * (portrait ? 0.42 : 0.82), -k * (portrait ? 0.62 : 0.5), i * 0.3),
			// It begins to fall 0.15 s before the moment it lands on.
			at: p.at.lands[i] - 0.15,
			spin: (hash(i * 3.1 + p.index) - 0.5) * 0.6,
		};
	});
	stack.rotation.set(-0.32, 0.5, 0.1);
	const paint = output(K, cam, p.scene.halftone ? accent : null);
	return (l, d) => {
		for (const c of cards) {
			const e = l - c.at;
			const k = spring(K, e, 1.9, 0.62);
			const fall = 1 - k;
			// Grows in from nothing over ~9 frames as it starts to fall, instead of appearing whole.
			c.grp.visible = e > -0.05;
			c.grp.scale.setScalar(Math.max(0.001, clamp((e + 0.05) / 0.16) ** 0.7));
			c.grp.position.set(c.home.x + fall * 3.2, c.home.y + fall * 4.2 + Math.sin(l * 1.1 + c.at * 9) * 0.04, c.home.z - fall * 2.5);
			c.grp.rotation.set(fall * 0.9, fall * -0.8 + Math.sin(l * 0.7 + c.at * 5) * 0.03, fall * (1.4 + c.spin));
			// The prop pops a little after its card lands, then keeps turning.
			const pk = spring(K, e - 0.18, 2.4, 0.5);
			c.holder.scale.setScalar(Math.max(0.001, pk));
			c.holder.rotation.set(0.25 + Math.sin(l * 0.8 + c.at) * 0.15, l * 0.9 + c.at * 4, Math.sin(l * 0.6) * 0.1);
		}
		stack.position.set(-0.15 + (l / d) * 0.3, 0.1 - (l / d) * 0.2, 0);
		// Never still: the stack keeps turning and drifting like a camera orbiting it.
		stack.rotation.y = 0.5 + Math.sin(l * 0.55) * 0.2;
		stack.rotation.x = -0.32 + Math.sin(l * 0.4 + 1) * 0.06;
		camera.position.z = dist * (1.04 - 0.06 * expoOut(prog(l, 0, d)));
		paint(scene, camera);
	};
};

// ---- icon3d: a glassy app icon with orbiting shapes ------------------------------------------------
sceneFactories.icon3d = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, images, textOn, mixHex, plan, glyphText, riseGlyphs, hash, beatKick } = K;
	const s = p.scene;
	const scene = new THREE.Scene();
	lights(scene, palette, shared(W, H).env);
	const portrait = W < H;
	const { camera } = lens(W, H, portrait ? 1.7 : 2.6, 2.3);
	const brandC = palette.brand ?? accent;
	const size = 1.6;
	const tile = new THREE.Group();
	scene.add(tile);
	const body = new THREE.Mesh(new RoundedBoxGeometry(size, size, 0.42, 6, 0.36), glossy(brandC, { roughness: 0.18 }));
	tile.add(body);
	const logo = plan.brand?.logo ? images[plan.brand.logo] : null;
	const letter = (plan.brand?.name ?? "K").trim().charAt(0).toUpperCase();
	const faceTex = canvasTexture(
		(g, w, h) => {
			const gr = g.createLinearGradient(0, 0, w, h);
			gr.addColorStop(0, mixHex(brandC, "#ffffff", 0.22));
			gr.addColorStop(1, mixHex(brandC, "#000000", 0.1));
			g.fillStyle = gr;
			g.fillRect(0, 0, w, h);
			if (!logo) {
				g.fillStyle = textOn(brandC);
				canvasType(K,g,letter,'hero',w*.75,h*.75,{surfaceWidth:180});
				const ink = g.measureText(letter);
				g.textAlign = "left";
				g.textBaseline = "alphabetic";
				g.fillText(letter, (w + ink.actualBoundingBoxLeft - ink.actualBoundingBoxRight) / 2,
					(h + ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2);
			}
		},
		1024,
		1024,
	);
	if (logo)
		K.defer(
			loadImg(K, logo.src).then((img) => {
				if (!img) return;
				const g = faceTex.image.getContext("2d");
				const k = Math.min(1, 1) * 0.92;
				const a = img.naturalWidth / img.naturalHeight;
				const w = a >= 1 ? 1024 * k : 1024 * k * a;
				const h = a >= 1 ? (1024 * k) / a : 1024 * k;
				g.drawImage(img, (1024 - w) / 2, (1024 - h) / 2, w, h);
				faceTex.needsUpdate = true;
			}),
		);
	const face = new THREE.Mesh(roundedFace(size - 0.02, size - 0.02, 0.35), new THREE.MeshPhysicalMaterial({ map: faceTex, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }));
	face.position.z = 0.213;
	tile.add(face);
	// Orbiting glossy shapes in the palette: balls, rings and a star-ish octahedron.
	const cols = accentsOf(palette, bg);
	const geos = [new THREE.SphereGeometry(0.16, 32, 16), new THREE.TorusGeometry(0.15, 0.06, 16, 40), new THREE.OctahedronGeometry(0.17), new THREE.SphereGeometry(0.1, 24, 12)];
	const orbs = Array.from({ length: 7 }, (_, i) => {
		const m = new THREE.Mesh(geos[i % geos.length], glossy(cols[i % cols.length] ?? accent, { roughness: 0.15 }));
		scene.add(m);
		return { m, a: (i / 7) * Math.PI * 2 + hash(i + p.index) * 0.6, r: 1.45 + hash(i * 3.3) * 0.5, tilt: (hash(i * 5.1) - 0.5) * 0.9, sp: 0.35 + hash(i * 2.7) * 0.3, at: p.at.land + i * p.at.every };
	});
	const paint = output(K, cam, p.scene.halftone ? accent : null);
	// The name under the icon, in the style's display type.
	const name = (s.text ?? plan.brand?.name ?? "").trim();
	let glyphs = [];
	if (name) {
		const t = el("div", "display", cam);
		set(t, { position: "absolute", left: "0", right: "0", top: px(H * (portrait ? 0.66 : 0.74)), textAlign: "center", color: fg, margin: "0 auto", whiteSpace: "nowrap" });
		glyphs = glyphText(t, name).glyphs;
		K.design.fitSize(t, W * 0.8, K.design.type('display').lineHeight * 2, 'display');
	}
	const lift = portrait ? 0.35 : 0.42;
	return (l) => {
		// The icon flies in for 0.3 s and lands on its moment.
		const k = spring(K, l - (p.at.land - 0.3), 1.5, 0.55);
		const kick = beatKick(p.start + l) * 0.025 * K.clamp((l - 0.8) / 0.3);
		tile.position.set(0, lift + (1 - k) * -0.6 + Math.sin(l * 1.4) * 0.05, (1 - k) * -7);
		tile.rotation.set(0.12 + Math.sin(l * 0.9) * 0.06, (1 - k) * -Math.PI * 3 - 0.32 + Math.sin(l * 0.6) * 0.18, (1 - k) * 0.4);
		tile.scale.setScalar((0.4 + 0.6 * K.clamp(k, 0, 1.2)) * (1 + kick));
		for (const o of orbs) {
			const e = spring(K, l - o.at, 2.4, 0.5);
			const a = o.a + l * o.sp;
			o.m.position.set(Math.cos(a) * o.r, lift + Math.sin(a) * o.r * 0.35 + Math.sin(a) * o.tilt, Math.sin(a) * 0.9);
			o.m.rotation.set(l * 1.3 + o.a, l * 0.9, 0);
			o.m.scale.setScalar(Math.max(0.001, e));
		}
		if (glyphs.length) riseGlyphs(glyphs, l, { at: 0.55, stagger: 0.03 });
		paint(scene, camera);
	};
};

// ---- phone3d: a phone swinging round to face you ---------------------------------------------------
sceneFactories.phone3d = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, images, mixHex, glyphText, riseGlyphs, hash } = K;
	const s = p.scene;
	const pics = (s.images ?? (s.image ? [s.image] : [])).map((u) => images[u]).filter(Boolean);
	const n = Math.max(1, Math.min(3, pics.length || 1));
	const scene = new THREE.Scene();
	lights(scene, palette, shared(W, H).env);
	const portrait = W < H;
	const { camera } = lens(W, H, n > 1 ? (portrait ? 2.05 : 2.3) : portrait ? 1.2 : 1.7, s.caption ? 1.75 : 1.5);
	const pw = 1.0;
	const ph = 2.06;
	const cols = accentsOf(palette, bg);
	const phones = Array.from({ length: n }, (_, i) => {
		const grp = new THREE.Group();
		const body = new THREE.Mesh(new RoundedBoxGeometry(pw, ph, 0.1, 6, 0.15), new THREE.MeshPhysicalMaterial({ color: 0x1a1b1f, metalness: 0.75, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.1 }));
		grp.add(body);
		const c1 = cols[i % cols.length] ?? accent;
		const tex = pics.length
			? imageTexture(K, pics[i % pics.length], (pw - 0.07) / (ph - 0.07))
			: canvasTexture(
					(g, w, h) => {
						// A plausible app screen: header, full-bleed hero media, and padded list cards.
						const D = K.design.forSurface(w / (360 * K.design.unit));
						const box = D.box("card"), gutter = D.space(5), rowGap = D.space(3);
						const cardW = w - gutter * 2, heroY = D.space(9) + D.space(5), heroH = h * .3;
						g.fillStyle = "#f6f7fb";
						g.fillRect(0, 0, w, h);
						const gr = g.createLinearGradient(0, 0, w, h * .4);
						gr.addColorStop(0, mixHex(c1, "#ffffff", .15));
						gr.addColorStop(1, mixHex(c1, "#000000", .1));
						g.fillStyle = gr;
						rasterSurface(g, D, "card", { x:gutter, y:heroY, w:cardW, h:heroH }, null, {layout:"frame", purpose:"media"});
						g.fillStyle = "#0d0f14";
						const typography=canvasType(K,g,K.plan.brand?.name??'', 'cardTitle',cardW,D.space(9),{truncate:true});
						g.fillText(typography.paintedText, gutter, heroY - rowGap);
						const avatar = D.space(7), rowH = avatar + box.paddingY * 2;
						for (let k = 0; k < 5; k++) {
							const y = heroY + heroH + rowGap + k * (rowH + rowGap);
							const x = gutter + box.paddingX, cy = y + rowH / 2;
							const textX = x + avatar + box.gap, textW = cardW - box.paddingX * 2 - avatar - box.gap;
							g.fillStyle = "#ffffff";
							rasterSurface(g, D, "card", {x:gutter, y, w:cardW, h:rowH}, {x, y:y+box.paddingY, w:cardW-box.paddingX*2, h:avatar}, {gap:box.gap});
							g.fillStyle = cols[(k + i) % cols.length] ?? accent;
							g.beginPath(); g.arc(x + avatar / 2, cy, avatar / 2, 0, Math.PI * 2); g.fill();
							g.fillStyle = "rgba(13,15,20,.75)";
							g.fillRect(textX, cy - D.space(3), textW * (.7 + hash(k+i) * .3), D.space(3));
							g.fillStyle = "rgba(13,15,20,.25)";
							g.fillRect(textX, cy + D.space(2), textW * (.5 + hash(k*3+i) * .25), D.space(2));
						}
					},
					600,
					1240,
				);
		const screen = new THREE.Mesh(roundedFace(pw - 0.07, ph - 0.07, 0.12), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
		screen.position.z = 0.0505;
		grp.add(screen);
		// Glass over the screen: catches the light as the phone turns.
		const glass = new THREE.Mesh(roundedFace(pw - 0.07, ph - 0.07, 0.12), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0, clearcoat: 1 }));
		glass.position.z = 0.053;
		grp.add(glass);
		// A flat capsule (a rounded box this thin can't take the corner radius).
		const island = new THREE.Mesh(roundedFace(0.24, 0.07, 0.035), new THREE.MeshBasicMaterial({ color: 0x050505 }));
		island.position.set(0, ph / 2 - 0.1, 0.056);
		grp.add(island);
		scene.add(grp);
		const k = i - (n - 1) / 2;
		return { grp, x: k * 1.25, ry: -k * 0.32, z: -Math.abs(k) * 0.4, at: 0.05 + Math.abs(k) * 0.12 };
	});
	let glyphs = [];
	if (s.caption) {
		const t = el("div", "display", cam);
		set(t, { position: "absolute", left: "0", right: "0", top: px(H * 0.06), textAlign: "center", color: fg, margin: "0 auto" });
		glyphs = glyphText(t, s.caption).glyphs;
		K.design.fitSize(t, W * 0.86, K.design.type('sceneTitle').lineHeight * 3, 'sceneTitle');
	}
	const drop = s.caption ? -0.3 : 0;
	const paint = output(K, cam, p.scene.halftone ? accent : null);
	return (l) => {
		for (const ph0 of phones) {
			const k = spring(K, l - ph0.at, 1.4, 0.62);
			ph0.grp.position.set(ph0.x * K.clamp(k, 0, 1.1), drop + (1 - k) * -2.6 + Math.sin(l * 1.3 + ph0.x * 2) * 0.07, ph0.z);
			ph0.grp.rotation.set(0.05 + (1 - k) * 0.4 + Math.sin(l * 0.8 + ph0.x) * 0.05, ph0.ry + (1 - k) * -1.5 + Math.sin(l * 0.7 + ph0.x * 0.8) * 0.3, (1 - k) * 0.12 + Math.sin(l * 0.6 + ph0.x) * 0.03);
		}
		if (glyphs.length) riseGlyphs(glyphs, l, { at: 0.02, stagger: 0.022, rot: -6 });
		paint(scene, camera);
	};
};



// ---- field: a world made of tiles --------------------------------------------------------------
// A floor of rounded tiles seen from low down, like keys on a keyboard that runs to the horizon. A
// glowing bar sweeps across it; the tiles ripple as it passes and a row of them rises into bars in
// the accent colour (the numbers). The camera skims along with the bar, then cranes up to look down
// on the whole field. A short line sits in the lower left. One continuous world, no cuts.
sceneFactories.field = ({ p, cam, fg, accent, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, mixHex, lum, hash, ease: E } = K;
	const s = p.scene;
	const paint = output(K, cam, p.scene.halftone ? accent : null);
	const R0 = shared(W, H);
	R0.r.shadowMap.enabled = true;
	R0.r.shadowMap.type = THREE.PCFSoftShadowMap;
	const scene = new THREE.Scene();
	scene.environment = R0.env;
	const light = lum(bg) > 0.45;
	const tileHex = light ? mixHex(bg, "#ffffff", 0.55) : mixHex(bg, "#ffffff", 0.1);
	scene.fog = new THREE.Fog(new THREE.Color(bg), 16, 40);
	scene.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(bg), light ? 0.9 : 0.5));
	const sun = new THREE.DirectionalLight(0xffffff, light ? 1.7 : 1.3);
	sun.position.set(-9, 16, 7);
	sun.castShadow = true;
	sun.shadow.mapSize.set(2048, 2048);
	Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 18, bottom: -18, near: 1, far: 60 });
	sun.shadow.radius = 5;
	sun.shadow.bias = -0.0008;
	scene.add(sun);
	const cols = 36;
	const rows = 22;
	const pitch = 1.1;
	const geo = new RoundedBoxGeometry(1, 1, 1, 3, 0.17);
	geo.translate(0, 0.5, 0);
	const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
	const mesh = new THREE.InstancedMesh(geo, mat, cols * rows);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	scene.add(mesh);
	const values = (s.values?.length ? s.values : [3, 5, 2, 6, 4, 7, 5, 9]).slice(0, 12);
	const vmax = Math.max(...values, 1);
	const barRow = Math.floor(rows / 2) + 2;
	const barCol0 = Math.floor((cols - values.length * 2) / 2);
	const cBase = new THREE.Color(tileHex);
	const cAcc = new THREE.Color(accent);
	const cSoft = new THREE.Color(mixHex(accent, tileHex, 0.65));
	const tiles = [];
	for (let r = 0; r < rows; r++)
		for (let c = 0; c < cols; c++) {
			const j = (c - barCol0) / 2;
			const bar = r === barRow && j >= 0 && j < values.length && Number.isInteger(j) ? values[j] : 0;
			tiles.push({ x: (c - (cols - 1) / 2) * pitch, z: (r - (rows - 1) / 2) * pitch, bar, nz: hash(r * 31.7 + c * 7.3) });
		}
	const beam = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.5, rows * pitch * 0.92, 3, 0.12), new THREE.MeshStandardMaterial({ color: cAcc, roughness: 0.35, emissive: cAcc, emissiveIntensity: 0.25 }));
	beam.castShadow = true;
	scene.add(beam);
	const camera = new THREE.PerspectiveCamera(W > H ? 34 : 46, W / H, 0.1, 120);
	const m4 = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const v = new THREE.Vector3();
	const sc = new THREE.Vector3();
	const col = new THREE.Color();
	// The line, lower left, arriving word by word.
	const words = String(s.text ?? "").trim().split(/\s+/).filter(Boolean);
	const cap = el("div", "display", cam);
	const vertical = H > W * 1.2;
	set(cap, { position: "absolute", left: px(W * 0.07), bottom: px(H * (vertical ? 0.16 : 0.12)), maxWidth: px(W * (vertical ? 0.86 : 0.5)), color: fg, display: "flex", flexWrap: "wrap", gap: "0 0.24em" }); K.design.apply(cap, 'sceneTitle');
	const wn = words.map((w) => {
		const n = el("span", "", cap, w.replace(/\*/g, ""));
		if (/\*/.test(w)) {
			set(n, { color: accent });
			if (K.plan?.look?.display?.accent === "serif") n.classList.add("serif");
		}
		set(n, { display: "inline-block" });
		return n;
	});
	const span = (cols / 2) * pitch;
	return (l, d) => {
		const u = clamp(l / d);
		// The bar sweeps the field; S-curve so it starts and ends gently.
		const front = -span + 2 * span * E.softInOut(prog(l, 0.1, d * 0.72));
		let i = 0;
		for (const t of tiles) {
			const dx = t.x - front;
			const ripple = Math.exp(-(dx * dx) / 3.2) * 0.5;
			const idle = Math.sin(l * 1.7 + t.x * 0.35 + t.z * 0.27) * 0.05 + t.nz * 0.06;
			let h = 0.32 + ripple + idle;
			let k = 0;
			if (t.bar) {
				k = E.snapSettle(clamp((front - t.x + 0.4) / 2.2));
				h += (t.bar / vmax) * 4.2 * k;
			}
			v.set(t.x, 0, t.z);
			sc.set(0.9, h, 0.9);
			m4.compose(v, q, sc);
			mesh.setMatrixAt(i, m4);
			col.copy(cBase);
			if (t.bar) col.lerp(cAcc, k);
			else if (ripple > 0.05) col.lerp(cSoft, ripple * 0.7);
			mesh.setColorAt(i, col);
			i++;
		}
		mesh.instanceMatrix.needsUpdate = true;
		mesh.instanceColor.needsUpdate = true;
		beam.position.set(front, 1.1 + Math.sin(l * 3) * 0.05, 0);
		// Camera: skims low beside the bar, then cranes up over the whole field.
		const crane = E.softInOut(prog(l, d * 0.62, d * 0.38));
		const fx = front * 0.85;
		const low = new THREE.Vector3(fx - 10, 5.6, 14);
		const high = new THREE.Vector3(0, 25, 14);
		camera.position.copy(low.lerp(high, crane));
		const look = new THREE.Vector3(fx + 1.5 - (fx + 1.5) * crane, 1.2 - crane * 1.2, 0.5);
		camera.lookAt(look);
		camera.rotateZ(-0.04 * (1 - crane));
		paint(scene, camera);
		wn.forEach((n, k) => {
			const e = E.softLand(prog(l, 0.35 + k * 0.09, 0.42));
			set(n, { opacity: clamp(e * 3).toFixed(3), transform: `translateY(${px((1 - e) * 40 * S)})`, filter: e < 0.97 ? `blur(${((1 - e) * 8 * S).toFixed(2)}px)` : "none" });
		});
		void u;
	};
};

// A laptop from a model file has a file of its own (./laptop3d.mjs), which
// draws with the helpers exported below.
sceneFactories.laptop3d = (given) => laptop3d(given);
sceneFactories.synth3d = (given) => synth3d(given);

export {sceneFactories};
// What a scene of another file needs to draw in the same WebGL context
// (scenes/laptop3d.mjs): the shared renderer, a scene's own canvas, the lights.
export {shared as renderer3d, output as output3d, lights as lights3d, imageTexture};
export default sceneFactories;
