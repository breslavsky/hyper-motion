// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {focus} from '../_shared/focus.mjs';
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

// ---- journey: the camera travels along one sentence; the last word is a wheel of options ------
export const factory = ({ p, cam, fg, accent, K }) => {
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
	// When each word is there and when the wheel turns is the scene's moments (scene-moments.cjs).
	// A word begins to arrive a moment before it is there, so the first is already arriving on frame 0
	// and the scene never opens on an empty frame.
	const at = p.at.words.map((t) => t - 0.12);
	const wheelAt = p.at.wheel;
	const changes = p.at.turns;
	const wheelEnd = changes.length ? changes[changes.length - 1] + 0.15 : wheelAt + 0.3;
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
	const pos = (t) => changes.reduce((a, c) => a + K.expoInOut(prog(t, c - 0.32, 0.42)), 0);
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
			const kick = changes.reduce((a, c) => Math.max(a, Math.exp(-Math.max(0, l - c) * 7) * (l > c ? 1 : 0)), 0);
			const pad = 0.12 + 0.05 * kick;
			const corners = [[-pad, 0.05], [1, 0.05], [-pad, 0.95], [1, 0.95]];
			dots.forEach((d, j) => {
				const [cx, cy] = corners[j];
				set(d, { left: cx < 0 ? `${cx}em` : `calc(100% + ${pad - 0.11}em)`, top: `${(cy * 1.1 - 0.055).toFixed(3)}em`, opacity: shown.toFixed(3) });
			});
		}
	};
};

