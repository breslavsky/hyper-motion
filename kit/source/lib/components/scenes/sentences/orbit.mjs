// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {wordsOf} from '../_shared/media.mjs';
// ---- orbit: a sentence inside line-art orbits ---------------------------------------------------
export const factory = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, quartOut, alpha, hash } = K;
	const D = K.design;
	const s = p.scene;
	const NS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("width", String(W));
	svg.setAttribute("height", String(H));
	svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
	set(svg, { position: "absolute", left: "0", top: "0", overflow: "visible" });
	cam.appendChild(svg);
	const R = Math.min(W, H);
	const rings = [0, 1, 2].map((i) => {
		const e = document.createElementNS(NS, "ellipse");
		e.setAttribute("fill", "none");
		e.setAttribute("stroke", alpha(fg, 0.32 - i * 0.06));
		e.setAttribute("stroke-width", String(1.6 * S));
		e.setAttribute("pathLength", "1");
		e.setAttribute("stroke-dasharray", "1");
		svg.appendChild(e);
		const dots = [0, 1].map((j) => {
			const c = document.createElementNS(NS, "circle");
			c.setAttribute("r", String((j ? 3.5 : 5.5) * S));
			c.setAttribute("fill", j ? alpha(fg, 0.75) : accent);
			svg.appendChild(c);
			return { c, ph: hash(i * 3 + j * 7 + p.index) * 6.28, sp: (0.35 + hash(i + j * 2) * 0.35) * (j ? -1 : 1) };
		});
		return { e, dots, rx: R * (0.52 + i * 0.2) * (W > H ? 1.05 : 0.8), tilt: -18 + i * 28, ph: i * 1.9 + p.index, sp: 0.22 + i * 0.07 };
	});
	const wrap = el("div", "center", cam);
	const line = el("div", "display", wrap);
	set(line, { color: fg });
	const { words } = wordsOf(K, line, s.text, accent);
	D.fitSize(line, W * (H > W * 1.2 ? 0.84 : 0.62), H * .36, "display");
	const step = Math.min(p.beatLen * 0.5, (p.dur * 0.5) / Math.max(1, words.length));
	return (l) => {
		for (const [i, r] of rings.entries()) {
			const draw = quartOut(clamp((l + 0.15 - i * 0.1) / 1.1));
			const squash = 0.16 + 0.42 * Math.abs(Math.sin(l * r.sp + r.ph));
			const ry = r.rx * squash;
			const ang = r.tilt + l * 4 * (i % 2 ? -1 : 1);
			r.e.setAttribute("cx", String(W / 2));
			r.e.setAttribute("cy", String(H / 2));
			r.e.setAttribute("rx", r.rx.toFixed(1));
			r.e.setAttribute("ry", ry.toFixed(1));
			r.e.setAttribute("transform", `rotate(${ang.toFixed(3)} ${W / 2} ${H / 2})`);
			r.e.setAttribute("stroke-dashoffset", (1 - draw).toFixed(4));
			const a = (ang * Math.PI) / 180;
			for (const dt of r.dots) {
				const th = dt.ph + l * dt.sp * 2;
				const x0 = Math.cos(th) * r.rx;
				const y0 = Math.sin(th) * ry;
				dt.c.setAttribute("cx", (W / 2 + x0 * Math.cos(a) - y0 * Math.sin(a)).toFixed(1));
				dt.c.setAttribute("cy", (H / 2 + x0 * Math.sin(a) + y0 * Math.cos(a)).toFixed(1));
				dt.c.setAttribute("opacity", (draw * (0.55 + 0.45 * Math.sin(th) ** 2)).toFixed(3));
			}
		}
		words.forEach((w, i) => {
			const t0 = 0.04 + i * step;
			const k = expoOut(prog(l, t0, 0.7));
			set(w.node, { display: "inline-block", opacity: k.toFixed(3), transform: `translateY(${((1 - k) * 0.25).toFixed(4)}em)`, filter: k < 0.99 ? `blur(${((1 - k) * 0.12).toFixed(4)}em)` : "none" });
		});
	};
};

