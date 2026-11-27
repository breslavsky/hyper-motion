// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {focus} from '../_shared/focus.mjs';
// ---- faces: real people floating at different depths around a short line ----------------------
export const factory = ({ p, cam, fg, accent, palette, K }) => {
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
		// A ring round the line, wider than tall, each at its own angle and distance. A face comes to
		// rest on its moment (`p.at`), 0.43 s after it starts in.
		const ang = (i / n) * Math.PI * 2 + (hash(i * 3.9) - 0.5) * 0.5 - Math.PI / 2;
		const rx = W * (vertical ? 0.34 : 0.36) * (0.85 + hash(i * 5.1) * 0.3);
		const ry = H * (vertical ? 0.3 : 0.34) * (0.85 + hash(i * 2.7) * 0.3);
		return { c, size, depth, x: W / 2 + Math.cos(ang) * rx, y: H / 2 + Math.sin(ang) * ry, at: p.at.first + i * p.at.every - 0.43, ph: hash(i * 9.1) * 6.28 };
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

