// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../typing.mjs';
const sceneFactories = {};

/** Monotone cubic interpolation through (t, v) keys: a smooth path with no overshoot and no
 *  stops between keys, so a camera following it glides instead of stepping. */
const glidePath = (keys) => {
	const n = keys.length;
	if (n === 1) return () => keys[0][1];
	const dx = [];
	const m = [];
	for (let i = 0; i < n - 1; i++) {
		const h = keys[i + 1][0] - keys[i][0] || 1e-6;
		dx.push(h);
		m.push((keys[i + 1][1] - keys[i][1]) / h);
	}
	const tan = [0];
	for (let i = 1; i < n - 1; i++) tan.push(m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]));
	tan.push(0);
	return (t) => {
		if (t <= keys[0][0]) return keys[0][1];
		if (t >= keys[n - 1][0]) return keys[n - 1][1];
		let i = 0;
		while (i < n - 2 && t > keys[i + 1][0]) i++;
		const h = dx[i];
		const u = (t - keys[i][0]) / h;
		const u2 = u * u;
		const u3 = u2 * u;
		return (2 * u3 - 3 * u2 + 1) * keys[i][1] + (u3 - 2 * u2 + u) * h * tan[i] + (-2 * u3 + 3 * u2) * keys[i + 1][1] + (u3 - u2) * h * tan[i + 1];
	};
};

/** An SVG blur filter the scene can drive per frame (directional motion blur). */
const blurFilter = (K, cam, id) => {
	const ns = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(ns, "svg");
	svg.setAttribute("width", "0");
	svg.setAttribute("height", "0");
	svg.style.position = "absolute";
	const f = document.createElementNS(ns, "filter");
	f.setAttribute("id", id);
	f.setAttribute("x", "-30%");
	f.setAttribute("y", "-30%");
	f.setAttribute("width", "160%");
	f.setAttribute("height", "160%");
	const gb = document.createElementNS(ns, "feGaussianBlur");
	gb.setAttribute("stdDeviation", "0 0");
	f.appendChild(gb);
	svg.appendChild(f);
	cam.appendChild(svg);
	return (x, y) => gb.setAttribute("stdDeviation", `${x.toFixed(2)} ${y.toFixed(2)}`);
};

/** Focus pull: blur (in em of the element's own size) that clears as k goes 0 -> 1. */
const focus = (k, amount = 0.22) => (k >= 0.999 ? "none" : `blur(${((1 - k) * amount).toFixed(4)}em)`);

// ---- journey: the camera travels along one sentence; the last word is a wheel of options ------
sceneFactories.journey = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, smooth, lerp } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const words = String(s.text).trim().split(/\s+/).filter(Boolean);
	const opts = (s.wheel ?? []).filter(Boolean).slice(0, 8);
	const line = el("div", "bold", cam);
	const fs = D.type("display").size;
	set(line, { position: "absolute", left: "0", top: "0", display: "flex", alignItems: "center", gap: px(D.space(3)), whiteSpace: "nowrap", color: fg, transformOrigin: "0 0" });
	D.apply(line, "display");
	const nodes = words.map((w) => {
		const n = el("span", "", line, w.replace(/\*/g, ""));
		if (/^\*.*\*$/.test(w)) n.style.color = accent;
		set(n, { display: "inline-block" });
		return n;
	});
	let wheel = null;
	if (opts.length) {
		wheel = el("span", "", line);
		set(wheel, { position: "relative", display: "inline-block", height: px(D.type("display").lineHeight), verticalAlign: "middle" });
		const items = opts.map((o) => {
			const n = el("span", "", wheel, o);
			set(n, { position: "absolute", left: "0", top: "0", whiteSpace: "nowrap", color: accent });
			return n;
		});
		const widths = items.map((n) => n.offsetWidth);
		const dots = [0, 1, 2, 3].map(() => {
			const d = el("span", "", wheel);
			set(d, { position: "absolute", width: "0.11em", height: "0.11em", borderRadius: "50%", background: accent });
			return d;
		});
		wheel.__parts = { items, widths, dots };
		set(wheel, { width: px(widths[0]) });
	}
	const lineW = line.offsetWidth;
	const lineH = line.offsetHeight;
	const centers = nodes.map((n) => n.offsetLeft + n.offsetWidth / 2);
	const wheelC = () => (wheel ? wheel.offsetLeft : 0);
	// Timing: words arrive one by one, the wheel rolls after them, then the camera pulls back.
	const step = Math.min(0.3, (p.dur * 0.42) / Math.max(1, words.length));
	// The first word is already arriving on frame 0, so the scene never opens on an empty frame.
	const at = words.map((_, i) => -0.12 + i * step);
	const wheelAt = at[at.length - 1] + 0.3;
	const per = opts.length > 1 ? clamp((p.dur * 0.88 - wheelAt - 0.5) / (opts.length - 1), 0.32, 0.75) : 0;
	const changes = opts.map((_, j) => wheelAt + 0.25 + (j - 1) * per).slice(1);
	const wheelEnd = changes.length ? changes[changes.length - 1] + 0.35 : wheelAt + 0.3;
	const pullAt = Math.min(p.dur - 0.5, wheelEnd + 0.15);
	const fitZ = Math.min(1, (W * 0.88) / lineW);
	// Camera keys: the newest word sits just right of centre; the wheel lands centred.
	const lead = W * 0.12;
	const keys = at.map((t, i) => [t + 0.12, centers[i] - lead]);
	if (wheel) keys.push([wheelAt + 0.2, wheelC() + (wheel.__parts.widths.at(-1) ?? 0) / 2 - lead * 0.4]);
	const camX = glidePath(keys);
	const blurId = K.uid('journey-blur');
	const blur = blurFilter(K, cam, blurId);
	line.style.filter = `url(#${blurId})`;
	const pos = (t) => changes.reduce((a, c) => a + K.expoInOut(prog(t, c - 0.12, 0.42)), 0);
	const frame = (l) => {
		const pull = smooth(prog(l, pullAt, Math.max(0.3, p.dur - pullAt - 0.05)));
		const z = lerp(1, fitZ, pull) * (1 + 0.04 * clamp(l / p.dur));
		const cx = lerp(camX(l), lineW / 2, pull);
		return { z, x: W / 2 - cx * z, y: H / 2 - (lineH / 2) * z };
	};
	return (l) => {
		const f = frame(l);
		const f0 = frame(Math.max(0, l - 1 / 60));
		set(line, { transform: `translate(${px(f.x)}, ${px(f.y)}) scale(${f.z.toFixed(4)})` });
		// Motion blur from the camera's own speed (px per frame at 60 fps).
		const v = Math.abs(f.x - f0.x);
		blur(Math.min(28 * S, v * 0.45) / Math.max(0.3, f.z), 0);
		nodes.forEach((n, i) => {
			const k = expoOut(prog(l, at[i], 0.5));
			set(n, { opacity: smooth((l - at[i]) / 0.18).toFixed(3), filter: focus(k, 0.3), transform: `translateY(${((1 - k) * 0.3).toFixed(4)}em) scale(${(1 + (1 - k) * 0.12).toFixed(4)})` });
		});
		if (wheel) {
			const { items, widths, dots } = wheel.__parts;
			const q = pos(l);
			const qv = Math.abs(q - pos(Math.max(0, l - 1 / 60))) * 60;
			const shown = smooth((l - wheelAt) / 0.25);
			const i0 = Math.floor(q);
			const fr = q - i0;
			const w = lerp(widths[Math.min(i0, widths.length - 1)], widths[Math.min(i0 + 1, widths.length - 1)], fr);
			set(wheel, { width: px(w) });
			items.forEach((n, j) => {
				const dj = j - q;
				const a = Math.abs(dj);
				const vis = a > 1.6 ? 0 : (1 - Math.min(1, a) * 0.78) * (a > 1 ? 1 - (a - 1) / 0.6 : 1);
				set(n, {
					opacity: (vis * shown).toFixed(3),
					transform: `translateY(${(dj * 1.02).toFixed(4)}em) scale(${(1 - Math.min(1, a) * 0.22).toFixed(4)})`,
					transformOrigin: "0 50%",
					color: a < 0.5 ? accent : fg,
					filter: a < 0.02 && qv < 0.05 ? "none" : `blur(${(Math.min(1, a) * 0.05 + Math.min(0.08, qv * 0.012)).toFixed(4)}em)`,
				});
			});
			// Selection dots at the corners of the current word, kicking on each change.
			const kick = changes.reduce((a, c) => Math.max(a, Math.exp(-Math.max(0, l - c - 0.2) * 7) * (l > c + 0.2 ? 1 : 0)), 0);
			const pad = 0.12 + 0.05 * kick;
			const corners = [[-pad, 0.05], [1, 0.05], [-pad, 0.95], [1, 0.95]];
			dots.forEach((d, j) => {
				const [cx, cy] = corners[j];
				set(d, { left: cx < 0 ? `${cx}em` : `calc(100% + ${pad - 0.11}em)`, top: `${(cy * 1.1 - 0.055).toFixed(3)}em`, opacity: shown.toFixed(3) });
			});
		}
	};
};

// ---- faces: real people floating at different depths around a short line ----------------------
sceneFactories.faces = ({ p, cam, fg, accent, palette, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, smooth, hash, images, glyphText, alpha, textOn } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const pics = (s.images ?? []).map((u) => images[u]).filter(Boolean);
	const n = Math.max(5, Math.min(9, pics.length || 6));
	const wrap = el("div", "center", cam);
	const line = el("div", "bold", wrap);
	set(line, { color: fg, textAlign: "center", position: "relative", zIndex: "40", maxWidth: px(W * (vertical ? 0.5 : 0.5)) });
	const { words } = glyphText(line, s.text, { glyphs: false });
	D.fitSize(line, W * 0.5, H * 0.42, "display");
	const base = Math.min(W, H) * .18;
	const hues = [palette.electric, palette.coral, palette.lime, palette.lilac, palette.peach, palette.sage].filter(Boolean);
	const people = Array.from({ length: n }, (_, i) => {
		const depth = hash(i * 7.3 + p.index);
		const size = base * (0.62 + depth * 0.62);
		const c = el("div", "", cam);
		set(c, { position: "absolute", left: "0", top: "0", width: px(size), height: px(size), overflow: "hidden", boxShadow: `0 ${px(size * 0.1)} ${px(size * 0.3)} rgba(0,0,0,0.18)`, zIndex: String(Math.round(depth * 30)) });
		D.surface(c, "card", { layout: "frame", purpose: "media" });
		if (pics.length) {
			const im = el("img", "fill", c);
			im.src = pics[i % pics.length].src;
			set(im, { objectFit: "cover", width: "100%", height: "100%" });
		} else {
			const bgc = hues[i % hues.length] ?? accent;
			set(c, { background: bgc, display: "grid", placeItems: "center", color: textOn(bgc) });
			D.forSurface(size / (D.unit * 40)).apply(c, "initials");
			c.textContent = String.fromCharCode(65 + ((i * 7) % 26));
		}
		// A ring round the line, wider than tall, each at its own angle and distance.
		const ang = (i / n) * Math.PI * 2 + (hash(i * 3.9) - 0.5) * 0.5 - Math.PI / 2;
		const rx = W * (vertical ? 0.34 : 0.36) * (0.85 + hash(i * 5.1) * 0.3);
		const ry = H * (vertical ? 0.3 : 0.34) * (0.85 + hash(i * 2.7) * 0.3);
		return { c, size, depth, x: W / 2 + Math.cos(ang) * rx, y: H / 2 + Math.sin(ang) * ry, at: -0.25 + i * 0.07, ph: hash(i * 9.1) * 6.28 };
	});
	const outAt = p.dur - 0.45;
	return (l, d) => {
		const out = smooth(prog(l, outAt, 0.42));
		const u = clamp(l / d);
		for (const q of people) {
			const k = expoOut(prog(l, q.at, 0.7));
			// Near and far faces sit out of focus; the middle layer is sharp.
			const dof = Math.abs(q.depth - 0.5) * 2;
			const b = (1 - k) * 18 + dof * 3.5 + out * 14;
			const drift = 10 + 26 * q.depth;
			const push = 1 + u * 0.1 * (0.4 + q.depth);
			const x = W / 2 + (q.x - W / 2) * push + Math.sin(l * 0.5 + q.ph) * drift * S;
			const y = H / 2 + (q.y - H / 2) * push + Math.cos(l * 0.43 + q.ph) * drift * 0.7 * S + (1 - k) * 50 * S;
			set(q.c, {
				opacity: (smooth((l - q.at) / 0.25) * (1 - out)).toFixed(3),
				transform: `translate(${px(x - q.size / 2)}, ${px(y - q.size / 2)}) scale(${((0.6 + 0.4 * k) * push).toFixed(4)}) rotate(${(Math.sin(l * 0.6 + q.ph) * 3).toFixed(3)}deg)`,
				filter: b < 0.3 ? "none" : `blur(${(b * S).toFixed(2)}px)`,
			});
		}
		words.forEach((w, i) => {
			const t0 = 0.05 + i * 0.07;
			const k = expoOut(prog(l, t0, 0.6));
			set(w.node, { display: "inline-block", opacity: (smooth((l - t0) / 0.2) * (1 - out)).toFixed(3), filter: focus(Math.min(k, 1 - out), 0.25), transform: `translateY(${((1 - k) * 0.35).toFixed(4)}em)` });
		});
		set(line, { transform: `scale(${(1 + 0.05 * u).toFixed(4)})` });
		void alpha;
	};
};

// ---- shuffle: a sentence breaks apart and its words fly to form the next one -------------------
sceneFactories.shuffle = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, smooth, hash, alpha } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const A = String(s.from).trim().split(/\s+/);
	const B = String(s.to).trim().split(/\s+/);
	// Line-art orbits behind the words.
	const orbits = [0, 1, 2].map((i) => {
		const o = el("div", "", cam);
		const w = W * (0.5 + i * 0.16);
		const h = H * (0.32 + i * 0.12);
		set(o, { position: "absolute", left: px((W - w) / 2), top: px((H - h) / 2), width: px(w), height: px(h), borderRadius: "50%", border: `${px(1.6 * S)} solid ${alpha(fg, 0.16 - i * 0.03)}` });
		return o;
	});
	// Lay both sentences out (hidden) at one size to find every word's place.
	const textSpec = D.type("display", 8), fsz = textSpec.size;
	const probe = (words) => {
		const box = el("div", "bold", cam);
		set(box, { position: "absolute", left: px(W * 0.07), top: "0", width: px(W * 0.86), display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `0 ${px(D.space(3))}`, visibility: "hidden" });
		D.apply(box, "display", {step:textSpec.step});
		const spans = words.map((w) => el("span", "", box, w.replace(/\*/g, "")));
		const h = box.offsetHeight;
		const out = spans.map((sp) => ({ x: sp.offsetLeft + W * 0.07, y: sp.offsetTop + (H - h) / 2, w: sp.offsetWidth }));
		box.remove();
		return out;
	};
	const pa = probe(A);
	const pb = probe(B);
	const used = new Set();
	const pieces = [];
	A.forEach((w, i) => {
		const key = w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
		const j = B.findIndex((v, jj) => !used.has(jj) && v.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase() === key);
		if (j >= 0) used.add(j);
		pieces.push({ text: w, from: pa[i], to: j >= 0 ? pb[j] : null, toText: j >= 0 ? B[j] : null, i });
	});
	B.forEach((w, j) => {
		if (!used.has(j)) pieces.push({ text: w, from: null, to: pb[j], toText: w, i: A.length + j });
	});
	const nodes = pieces.map((q) => {
		const n = el("div", "bold", cam, (q.from ? q.text : q.toText).replace(/\*/g, ""));
		set(n, { position: "absolute", left: "0", top: "0", whiteSpace: "nowrap", color: /\*/.test(q.toText ?? q.text) ? accent : fg });
		D.apply(n, "display", {step:textSpec.step});
		return n;
	});
	const tS = Math.max(0.9, p.dur * 0.42);
	return (l, d) => {
		const u = clamp(l / d);
		orbits.forEach((o, i) => set(o, { transform: `rotate(${(l * (8 + i * 5) * (i % 2 ? -1 : 1)).toFixed(3)}deg) scale(${(0.9 + 0.1 * smooth(l / 0.8) + u * 0.04).toFixed(4)})`, opacity: smooth(l / 0.6).toFixed(3) }));
		pieces.forEach((q, k) => {
			const n = nodes[k];
			const inK = expoOut(prog(l, -0.2 + q.i * 0.06, 0.55));
			const mv = K.expoInOut(prog(l, tS + k * 0.045, 0.85));
			if (q.from && q.to) {
				const shown = (mv < 0.5 ? q.text : q.toText).replace(/\*/g, "");
				if (n.textContent !== shown) n.textContent = shown;
				// Fly along an arc from the old place to the new one, tilting as it goes.
				const lift = Math.sin(mv * Math.PI) * (70 + hash(k * 3.3) * 90) * S * (hash(k * 1.9) > 0.5 ? 1 : -1);
				const x = q.from.x + (q.to.x - q.from.x) * mv;
				const y = q.from.y + (q.to.y - q.from.y) * mv + lift;
				set(n, { opacity: smooth((l + 0.2 - q.i * 0.06) / 0.2).toFixed(3), filter: focus(inK * (1 - Math.sin(mv * Math.PI) * 0.5), 0.25), transform: `translate(${px(x)}, ${px(y + (1 - inK) * 0.3 * fsz)}) rotate(${(Math.sin(mv * Math.PI) * (hash(k) - 0.5) * 24).toFixed(3)}deg)` });
			} else if (q.from) {
				// Words that aren't in the new line blur away and drop.
				set(n, { opacity: (smooth((l + 0.2 - q.i * 0.06) / 0.2) * (1 - mv)).toFixed(3), filter: focus(inK * (1 - mv), 0.35), transform: `translate(${px(q.from.x)}, ${px(q.from.y + mv * 60 * S + (1 - inK) * 0.3 * fsz)}) scale(${(1 - mv * 0.2).toFixed(4)})` });
			} else {
				// New words arrive out of focus where they belong.
				set(n, { opacity: mv.toFixed(3), filter: focus(mv, 0.35), transform: `translate(${px(q.to.x)}, ${px(q.to.y - (1 - mv) * 50 * S)}) scale(${(1.15 - mv * 0.15).toFixed(4)})` });
			}
		});
	};
};

// ---- overlay: glass cards with rolling numbers over a photo ------------------------------------
sceneFactories.overlay = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, smooth, images, alpha } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const img = s.image ? images[s.image] : null;
	const back = el("div", "", cam);
	set(back, { position: "absolute", inset: "0", overflow: "hidden", background: `linear-gradient(135deg, ${accent}, ${alpha(accent, 0.5)})` });
	let photo = null;
	if (img) {
		photo = el("img", "fill", back);
		photo.src = img.src;
		set(photo, { objectFit: "cover", width: "100%", height: "100%", transformOrigin: "60% 40%" });
	}
	const shade = el("div", "", back);
	set(shade, { position: "absolute", inset: "0", background: "linear-gradient(180deg, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.45) 100%)" });
	let cap = null;
	if (s.text) {
		cap = el("div", "bold", cam, s.text.replace(/\*/g, ""));
		// The caption stands in the foot of the safe area, not of the frame.
		set(cap, { position: "absolute", left: px(Math.max(W * 0.06, K.safe.x)), bottom: px(H - K.safe.y - K.safe.h + H * 0.02), color: "#ffffff", whiteSpace: "nowrap", textShadow: "0 2px 30px rgba(0,0,0,0.35)" });
		D.fitSize(cap, K.safe.w * 0.9, H * 0.2, "caption");
	}
	const cardsIn = (s.cards ?? []).slice(0, 3);
	const spots = vertical ? [[0.06, 0.12], [0.38, 0.34], [0.08, 0.56]] : [[0.06, 0.1], [0.62, 0.28], [0.26, 0.5]];
	const cards = cardsIn.map((c, i) => {
		const box = el("div", "", cam);
		box.dataset.designMaterial = "dark-glass";
		let cw = vertical ? W * 0.56 : W * 0.3;
		set(box, { position: "absolute", left: px(W * spots[i][0]), top: px(H * spots[i][1]), width: px(cw), background: "rgba(9,16,24,0.78)", border: `${px(1.5 * S)} solid rgba(255,255,255,0.18)`, backdropFilter: "blur(18px) saturate(1.5)", boxShadow: `0 ${px(24 * S)} ${px(60 * S)} rgba(0,0,0,0.25)`, color: "#ffffff" });
		const surface = D.surface(box, "card", { density: "compact" });
		set(box, { display: "flex", flexDirection: "column" });
		const lab = el("div", "", box, c.label ?? "");
		set(lab, { opacity: "0.9", marginBottom: "0" });
		D.apply(lab, "label");
		const val = el("div", "display", box);
		set(val, { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" });
		const v = Number(c.value) || 0;
		const dec = (String(c.value).split(".")[1] ?? "").length;
		const tmpl = Math.abs(v) >= 1000 ? Math.round(Math.abs(v)).toLocaleString("en-US") : Math.abs(v).toFixed(dec);
		// Reserve the complete odometer footprint, including its edge-mask
		// padding, at the smallest metric token before choosing a card width.
		// The first update caches digit advances, so fit before calling roll.
		D.apply(val, "metric", { step: D.steps("metric").at(-1).step });
		if (c.prefix) el("span", "", val, c.prefix);
		const roll = K.odometer(el("span", "", val), tmpl);
		if (c.suffix) el("span", "", val, c.suffix);
		set(val, { display: "inline-block" });
		const inset = 2 * surface.paddingX + 3 * S;
		cw = Math.min(K.safe.w, Math.max(cw, Math.ceil(val.scrollWidth + inset + 1)));
		set(box, { width: px(cw), left: px(clamp(W * spots[i][0], K.safe.x, K.safe.x + K.safe.w - cw)) });
		set(val, { display: "block" });
		set(lab, { display: "block", maxWidth: px(cw-inset) });
		D.fitLine(val, cw - inset, D.type("metric").lineHeight, "metric");
		D.truncateLine(lab);lab.title = c.label ?? "";
		return { box, lab, val, roll, v, at: 0.35 + i * 0.4, side: i % 2 ? 1 : -1 };
	});
	// Keep measured glass surfaces clear of each other and of the full caption.
	// A long caption can rise above the old fixed third-card position.
	const gap = D.space(3), ceiling = K.safe.y;
	let floor = cap ? cap.offsetTop - gap : K.safe.y + K.safe.h;
	let heights = cards.map(c => c.box.offsetHeight);
	if (heights.reduce((sum, h) => sum + h, 0) + Math.max(0, cards.length - 1) * gap > floor - ceiling) {
		// Dense copy gets one full-width column and the compact token recipe.
		const innerWidth = K.safe.w - 2 * D.box("card", { density: "compact" }).paddingX - 3 * S;
		for (const c of cards) {
			// Keep the compact card padding intact. Wide rows place the label and
			// value side by side instead of squeezing their vertical breathing room.
			set(c.box, { left: px(K.safe.x), width: px(K.safe.w), flexDirection: "row", alignItems: "center" });
			D.apply(c.val, "metric", { step: D.steps("metric").at(-1).step });
			set(c.val, { flex: "none", width: "max-content", maxWidth: "none" });
			// Measure the odometer after its final font is chosen, including mask edges.
			c.roll(c.v);
			const valueWidth = Math.ceil(c.val.scrollWidth);
			set(c.val, { width: px(valueWidth) });
			const labelWidth = innerWidth - valueWidth - D.box("card", { density: "compact" }).gap;
			set(c.lab, { flex: "1", minWidth: "0", width: px(labelWidth) });
			set(c.lab, { maxWidth: px(labelWidth) });
		}
		heights = cards.map(c => c.box.offsetHeight);
		if (cap) {
			D.apply(cap, "caption", { step: D.steps("caption").at(-1).step });
			floor = cap.offsetTop - gap;
		}
	}
	if (heights.reduce((sum, h) => sum + h, 0) + Math.max(0, cards.length - 1) * gap > floor - ceiling) {
		throw new Error("Overlay cards exceed the available area above the caption");
	}
	const tops = [];
	for (let i = 0; i < cards.length; i++) tops[i] = Math.max(ceiling, H * spots[i][1], i ? tops[i - 1] + heights[i - 1] + gap : ceiling);
	let bottom = floor;
	for (let i = cards.length - 1; i >= 0; i--) {
		tops[i] = Math.min(tops[i], bottom - heights[i]);
		set(cards[i].box, { top: px(tops[i]) });
		bottom = tops[i] - gap;
	}
	return (l, d) => {
		const u = clamp(l / d);
		if (photo) set(photo, { transform: `scale(${(1.08 + 0.1 * u).toFixed(4)}) translate(${px(-u * 30 * S)}, ${px(u * 12 * S)})` });
		for (const c of cards) {
			const k = expoOut(prog(l, c.at, 0.8));
			const bob = Math.sin(l * 1.3 + c.at * 5) * 6 * S;
			set(c.box, { opacity: smooth((l - c.at) / 0.25).toFixed(3), filter: k > 0.995 ? "none" : `blur(${((1 - k) * 14 * S).toFixed(2)}px)`, transform: `perspective(${px(1600 * S)}) translateY(${px((1 - k) * 60 * S + bob)}) rotateY(${(c.side * (8 - 5 * k)).toFixed(3)}deg) scale(${(0.9 + 0.1 * k).toFixed(4)})` });
			c.roll(c.v * expoOut(prog(l, c.at + 0.15, 1.2)));
		}
		if (cap) {
			const k = expoOut(prog(l, 0.15, 0.7));
			set(cap, { opacity: smooth(l / 0.3).toFixed(3), filter: focus(k, 0.25), transform: `translateY(${((1 - k) * 0.4).toFixed(4)}em)` });
		}
	};
};
// ---- trail: neon light streaks sweeping round a pill on black, the pill typing a line -----------
sceneFactories.trail = ({ p, cam, accent, palette, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, smooth, hash, mixHex } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const back = el("div", "", cam);
	set(back, { position: "absolute", inset: "0", background: "radial-gradient(ellipse at 50% 50%, #15110c 0%, #050505 70%)" });
	// The streaks are drawn at the size the picture is watched at (K.previewScale:
	// the live preview's stream), and laid over the frame at its own size.
	const q = K.previewScale ?? 1;
	const cv = el("canvas", "", cam);
	cv.width = Math.round(W * q);
	cv.height = Math.round(H * q);
	set(cv, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H) });
	const g = cv.getContext("2d");
	const pill = el("div", "bold", cam);
	const pw = K.safe.w * .9;
	const ph = D.control("button").height + D.space(2);
	set(pill, { position: "absolute", left: px((W - pw) / 2), top: px((H - ph) / 2), width: px(pw), height: px(ph), border: `${px(2.5 * S)} solid rgba(255,255,255,0.75)`, background: "rgba(255,255,255,0.06)", boxShadow: `0 0 ${px(40 * S)} rgba(255,255,255,0.12), inset 0 0 ${px(30 * S)} rgba(255,255,255,0.08)`, display: "flex", alignItems: "center", color: "#ffffff",  overflow: "hidden", whiteSpace: "nowrap" });
	const fieldBox = D.surface(pill, "field", { density: "compact", shape: "pill" });
	const knob = el("div", "", pill);
	set(knob, { flex: "none", width: px(ph * 0.62), height: px(ph * 0.62), borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #ffffff, #c9c9c9 60%, #8a8a8a)" });
	D.apply(pill, "controlLabel");
	const typed = el("span", "", pill);
	const caret = el("span", "", pill);
	set(caret, { width: px(3 * S), height: px(ph * 0.5), background: "#ffffff", marginLeft: px(2 * S) });
	const text = String(s.text ?? "");
	set(typed, { flex: "1", minWidth: "0" });
	const typing = createTyping(K, typed, { text, caret, id: "trail-line" });
	D.fitSize(typed, pw - fieldBox.paddingX * 2 - ph * .62 - fieldBox.gap * 2 - 6 * S, ph - fieldBox.paddingY * 2, "controlLabel");
	typing.measure();
	// Warm streak colours by default (gold, orange, red), or the accent when the style is cool.
	const cols = [s.warm === false ? accent : "#ffd25a", s.warm === false ? mixHex(accent, "#ffffff", 0.4) : "#ff8a1f", s.warm === false ? (palette.lilac ?? accent) : "#ff3b2f"];
	const streaks = [0, 1, 2, 3, 4].map((i) => ({ rx: pw * (0.62 + i * 0.07), ry: ph * (2.2 + i * 0.55), tilt: (hash(i * 3.3) - 0.5) * 0.7 + (i % 2 ? 0.35 : -0.35), speed: (1.6 + hash(i * 5.1) * 1.1) * (i % 2 ? -1 : 1), ph: hash(i * 7.7) * 6.28, len: 2.2 + hash(i * 2.2) * 1.4, col: cols[i % cols.length], w: (5 + hash(i * 9.9) * 6) * S }));
	const typeAt = 0.35;
	const typeDur = Math.min(1.2, p.dur * 0.4);
	return (l, d) => {
		const u = clamp(l / d);
		const intro = expoOut(prog(l, 0, 0.6));
		g.setTransform(q, 0, 0, q, 0, 0);
		g.clearRect(0, 0, W, H);
		g.globalCompositeOperation = "lighter";
		const cx = W / 2;
		const cy = H / 2;
		for (const k of streaks) {
			const head = k.ph + l * k.speed;
			// Every piece of a streak casts its own glow, which is what the scene
			// costs: at the preview's size a streak is cut into fewer, longer pieces.
			const segs = q < 1 ? Math.max(16, Math.round(46 * q * q)) : 46;
			g.save();
			g.translate(cx, cy);
			g.rotate(k.tilt);
			g.scale(1 + 0.05 * u, 1 + 0.05 * u);
			for (let j = 0; j < segs; j++) {
				const f = j / segs;
				const a0 = head - Math.sign(k.speed) * f * k.len;
				const a1 = head - Math.sign(k.speed) * (f + 1 / segs) * k.len;
				const fade = (1 - f) ** 1.6 * intro;
				// Depth: the half of the ring behind the pill is dimmer and thinner.
				const behind = Math.sin(a0) < 0 ? 0.45 : 1;
				g.strokeStyle = k.col;
				g.globalAlpha = fade * behind;
				g.lineWidth = k.w * (1 - f * 0.7) * (0.7 + 0.3 * behind);
				g.shadowColor = k.col;
				g.shadowBlur = 30 * S * fade * q;
				g.beginPath();
				g.ellipse(0, 0, k.rx * intro, k.ry * intro, 0, a1, a0, k.speed > 0 ? false : true);
				g.stroke();
			}
			g.restore();
		}
		g.globalAlpha = 1;
		g.globalCompositeOperation = "source-over";
		const n = Math.round(clamp((l - typeAt) / typeDur) * text.length);
		typing.reveal(n);
		set(caret, { opacity: n < text.length ? "1" : K.blink(l - typeAt - typeDur).toFixed(3) });
		const pk = K.spring(l, 2.6, 0.6);
		set(pill, { transform: `scale(${((0.8 + 0.2 * pk) * (1 + 0.04 * u)).toFixed(4)})`, opacity: smooth(l / 0.15).toFixed(3) });
		set(knob, { transform: `translateX(${px(Math.sin(l * 2) * 2 * S)})` });
	};
};
export {sceneFactories};
export default sceneFactories;
