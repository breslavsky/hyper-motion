// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {SVG, svgEl, compact} from '../_shared/charts.mjs';
const fmt = (v, decimals = 0) => {
	const fixed = Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(decimals);
	return fixed;
};
export const factory = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, expoOut, prog, clamp, spring, alpha, hash } = K;
	const s = p.scene;
	const c = compact(s.value);
	const vertical = H > W * 1.2;
	const wrap = el("div", "center", cam);
	const label = el("div", "mono", wrap, s.label);
	set(label, { color: fg, opacity: "0.75", marginBottom: px(K.design.space(2)) }); K.design.apply(label, 'caption');
	set(label, { maxWidth: px(K.safe.w*.9) });K.design.truncateLine(label);label.title = s.label;
	const num = el("div", "display", wrap, `${s.prefix ?? ""}${fmt(c.n, c.d)}${c.s}${s.suffix ?? ""}`);
	set(num, { color: fg, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" });
	const size = K.design.fitLine(num, W * 0.8, H * 0.32, 'hero');
	const trend = s.trend ?? "up";
	let path = null;
	let area = null;
	let dot = null;
	let len = 0;
	const cw = vertical ? W * 0.84 : W * 0.6;
	const ch = H * 0.22;
	if (trend !== "none") {
		const svg = svgEl("svg", { width: cw, height: ch, viewBox: `0 0 ${cw} ${ch}` }, wrap);
		svg.style.marginTop = px(30 * S);
		svg.style.overflow = "visible";
		const pts = Array.from({ length: 24 }, (_, i) => {
			const x = (i / 23) * cw;
			const base = trend === "up" ? i / 23 : 1 - i / 23;
			const y = ch - (0.08 + 0.84 * (base * 0.85 + hash(i * 1.7) * 0.15)) * ch;
			return [x, y];
		});
		const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
		const defs = svgEl("defs", {}, svg);
		const gradientId = K.uid('stat-gradient');
		const grad = svgEl("linearGradient", { id: gradientId, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
		svgEl("stop", { offset: "0%", "stop-color": accent, "stop-opacity": 0.35 }, grad);
		svgEl("stop", { offset: "100%", "stop-color": accent, "stop-opacity": 0 }, grad);
		area = svgEl("path", { d: `${d} L${cw},${ch} L0,${ch} Z`, fill: `url(#${gradientId})` }, svg);
		path = svgEl("path", { d, fill: "none", stroke: accent, "stroke-width": 6 * S, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
		len = path.getTotalLength();
		path.setAttribute("stroke-dasharray", String(len));
		dot = svgEl("circle", { r: 10 * S, fill: accent }, svg);
	}
	// Rolling digits (fixed width, no per-frame swaps) between prefix and suffix.
	num.textContent = "";
	if (s.prefix) el("span", "", num, s.prefix);
	const roll = K.odometer(el("span", "", num), fmt(c.n, c.d));
	if (c.s || s.suffix) el("span", "", num, `${c.s}${s.suffix ?? ""}`);
	return (l) => {
		const k = expoOut(prog(l, 0.05, Math.min(1.3, p.dur * 0.65)));
		roll(c.n * k);
		const e = spring(l, 2.6, 0.6);
		set(num, { transform: `translateY(${px((1 - e) * 50 * S)})`, opacity: clamp(l / 0.08).toFixed(3) });
		set(label, { opacity: (0.75 * clamp(l / 0.15)).toFixed(3) });
		if (path) {
			const dk = expoOut(prog(l, 0.15, Math.min(1.2, p.dur * 0.6)));
			path.setAttribute("stroke-dashoffset", String(len * (1 - dk)));
			area.setAttribute("opacity", String(dk));
			const pt = path.getPointAtLength(len * dk);
			dot.setAttribute("cx", String(pt.x));
			dot.setAttribute("cy", String(pt.y));
			dot.setAttribute("r", String(10 * S * (1 + 0.25 * Math.sin(l * 9))));
		}
		void size;
		void alpha;
	};
};

