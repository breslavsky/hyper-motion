// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {SVG, svgEl} from '../_shared/charts.mjs';
/** A dotted globe turning, with arcs drawing between points. */
export const factory = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, expoOut, prog, clamp, spring, alpha, hash } = K;
	const s = p.scene;
	let label = null;
	if (s.label) {
		label = el("div", "display", cam, s.label);
		set(label, {position: 'absolute', left: px(K.safe.x), top: px(K.safe.y), width: px(K.safe.w), textAlign: 'center', color: fg});
		K.design.fitSize(label, K.safe.w, K.design.type('sceneTitle').lineHeight * 2, 'sceneTitle');
	}
	const plotTop = K.safe.y + (label ? label.offsetHeight + K.design.space(4) : 0);
	const plotHeight = K.safe.y + K.safe.h - plotTop;
	const r = Math.min(K.safe.w * 0.42, plotHeight * 0.42);
	const cx = W / 2;
	const cy = plotTop + plotHeight / 2;
	const svg = svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
	cam.appendChild(svg);
	set(svg, { position: "absolute", left: "0", top: "0" });
	svgEl("circle", { cx, cy, r, fill: alpha(fg, 0.04), stroke: alpha(fg, 0.18), "stroke-width": 2 * S }, svg);
	const N = 420;
	const pts = [];
	const golden = Math.PI * (3 - Math.sqrt(5));
	for (let i = 0; i < N; i++) {
		const y = 1 - (i / (N - 1)) * 2;
		const rad = Math.sqrt(1 - y * y);
		const th = golden * i;
		// Keep roughly 60% as "land" so it reads as a world, not a ball.
		if (hash(i * 1.3) < 0.4) continue;
		pts.push({ x: Math.cos(th) * rad, y, z: Math.sin(th) * rad, c: svgEl("circle", { r: 3.2 * S, fill: fg }, svg) });
	}
	const arcs = Array.from({ length: 6 }, (_, i) => {
		const a = pts[Math.floor(hash(i * 7.1) * pts.length)];
		const b = pts[Math.floor(hash(i * 3.3 + 2) * pts.length)];
		const path = svgEl("path", { fill: "none", stroke: accent, "stroke-width": 4 * S, "stroke-linecap": "round" }, svg);
		return { a, b, path, at: 0.4 + i * 0.18 };
	});
	const project = (q, rot) => {
		const x = q.x * Math.cos(rot) - q.z * Math.sin(rot);
		const z = q.x * Math.sin(rot) + q.z * Math.cos(rot);
		const tilt = 0.35;
		const y = q.y * Math.cos(tilt) - z * Math.sin(tilt);
		const z2 = q.y * Math.sin(tilt) + z * Math.cos(tilt);
		return { x: cx + x * r, y: cy - y * r, z: z2 };
	};
	return (l) => {
		const rot = l * 0.6;
		const e = spring(l, 2.2, 0.7);
		set(svg, { transform: `scale(${(0.7 + 0.3 * e).toFixed(4)})`, transformOrigin: `${cx}px ${cy}px`, opacity: clamp(l / 0.15).toFixed(3) });
		for (const q of pts) {
			const pr = project(q, rot);
			q.c.setAttribute("cx", pr.x.toFixed(1));
			q.c.setAttribute("cy", pr.y.toFixed(1));
			q.c.setAttribute("opacity", pr.z > 0 ? "0.9" : "0.15");
		}
		for (const a of arcs) {
			const p1 = project(a.a, rot);
			const p2 = project(a.b, rot);
			const mx = (p1.x + p2.x) / 2;
			const my = (p1.y + p2.y) / 2 - r * 0.45;
			a.path.setAttribute("d", `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`);
			const len = a.path.getTotalLength() || 1;
			const k = expoOut(prog(l, a.at, 0.7));
			a.path.setAttribute("stroke-dasharray", `${len}`);
			a.path.setAttribute("stroke-dashoffset", `${len * (1 - k)}`);
			a.path.setAttribute("opacity", p1.z > -0.2 && p2.z > -0.2 ? "1" : "0.25");
		}
		if (label) set(label, { opacity: clamp(l / 0.2).toFixed(3), transform: `translateY(${px((1 - e) * 30 * S)})` });
	};
};

