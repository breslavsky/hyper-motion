// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {SVG, svgEl} from '../_shared/charts.mjs';
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, expoOut, prog, clamp, spring, alpha, lum } = K;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const wrap = el("div", "center", cam);
	let titleH=0;
	if (s.title) {
		const t = el("div", "display", wrap, s.title);
		set(t, { color: fg, marginBottom: px(K.design.space(3)) });
		K.design.fitSize(t, K.safe.w, K.design.type('sceneTitle').lineHeight*3, 'sceneTitle');
        titleH=t.offsetHeight+K.design.space(3);
	}
	const cw = K.safe.w * (vertical ? 1 : .82);
	const ch = Math.min(H*.66,K.safe.h-titleH);
	const max = Math.max(...s.values, 1e-9);
	const n = s.values.length;
	const cols = [accent, palette.electric, palette.coral, palette.lime, palette.peach, palette.sage, palette.lilac, palette.butter].filter((c, i, a) => a.indexOf(c) === i);
	const box = el("div", "", wrap);
	set(box, { position: "relative", width: px(cw), height: px(ch) });
	let draw = () => {};
	if (s.kind === "bar") {
		const gap = cw * 0.03;
		const bw = (cw - gap * (n - 1)) / n;
		const bars = s.values.map((v, i) => {
			const b = el("div", "", box);
			set(b, { position: "absolute", left: px(i * (bw + gap)), bottom: px(44 * S), width: px(bw), borderRadius: `${px(bw * 0.12)} ${px(bw * 0.12)} 0 0`, background: s.values[i] === Math.max(...s.values) ? accent : alpha(fg, 0.85), transformOrigin: "50% 100%" });
			const val = el("div", "mono", box, `${v}${s.unit ?? ""}`);
			set(val, { position: "absolute", left: px(i * (bw + gap)), width: px(bw), textAlign: "center", color: fg }); K.design.apply(val, 'value');
			const lab = el("div", "mono", box, s.labels?.[i] ?? "");
			set(lab, { position: "absolute", left: px(i * (bw + gap)), width: px(bw), bottom: "0", textAlign: "center", color: alpha(fg, 0.6) }); K.design.apply(lab, 'label');
			K.design.truncateLine(lab);lab.title = s.labels?.[i] ?? "";
			return { b, val, h: (v / max) * (ch - 110 * S) };
		});
		const st = Math.min(p.beatLen / 2, (p.dur * 0.5) / n);
		draw = (l) => {
			bars.forEach(({ b, val, h }, i) => {
				// Once grown, each bar breathes a little, like live data, so the hold never freezes.
				const live = clamp((l - 0.9 - i * st) / 0.6);
				const k = spring(l - 0.1 - i * st, 2.6, 0.62) * (1 + 0.025 * live * Math.sin(l * 2.2 + i * 1.3));
				set(b, { height: px(Math.max(0, h * k)) });
				set(val, { bottom: px(44 * S + h * k + 8 * S), opacity: clamp((l - 0.2 - i * st) / 0.1).toFixed(3) });
			});
		};
	} else if (s.kind === "line") {
		const svg = svgEl("svg", { width: cw, height: ch, viewBox: `0 0 ${cw} ${ch}` }, box);
		svg.style.overflow = "visible";
		// Equal label slots leave the same gap at both ends as in the middle.
		const labelWidth = cw / n - K.design.space(1), plotInset = s.labels?.length ? labelWidth / 2 : 0;
		for (let g = 0; g <= 4; g++) svgEl("line", { x1: plotInset, x2: cw - plotInset, y1: (g / 4) * (ch - 50 * S), y2: (g / 4) * (ch - 50 * S), stroke: alpha(fg, 0.1), "stroke-width": 1.5 * S }, svg);
		const pts = s.values.map((v, i) => [plotInset + (i / (n - 1)) * (cw - 2 * plotInset), (ch - 50 * S) * (1 - v / max) + 6 * S]);
		const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
		const path = svgEl("path", { d, fill: "none", stroke: accent, "stroke-width": 7 * S, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
		const len = path.getTotalLength();
		path.setAttribute("stroke-dasharray", String(len));
		const dots = pts.map(([x, y]) => svgEl("circle", { cx: x, cy: y, r: 0, fill: accent }, svg));
		const labs = (s.labels ?? []).map((t, i) => {
			const lb = el("div", "mono", box, t);
			set(lb, { position: "absolute", bottom: "0", left: px(pts[i]?.[0] ?? 0), maxWidth: px(labelWidth), transform: "translateX(-50%)", color: alpha(fg, 0.6) }); K.design.apply(lb, 'label');
			K.design.truncateLine(lb);lb.title = t;
			return lb;
		});
		draw = (l) => {
			const k = expoOut(prog(l, 0.1, Math.min(1.4, p.dur * 0.7)));
			path.setAttribute("stroke-dashoffset", String(len * (1 - k)));
			// Each dot grows in as the line reaches it, then pulses gently.
			dots.forEach((c, i) => c.setAttribute("r", String(9 * S * K.smooth((k - i / (n - 1) + 0.001) * (n - 1) * 3) * (1 + 0.12 * Math.sin(l * 3 + i)))));
			labs.forEach((lb) => set(lb, { opacity: clamp(l / 0.3).toFixed(3) }));
		};
	} else {
		// Pie / ring: slices sweep in, the biggest one pops out.
		// The legend is a row under the disc, each name beside its colour: names set round the
		// disc ran into the title above it and into one another.
		const named = (s.labels ?? []).slice(0, n).some(Boolean);
		const rowH = named ? 78 * S : 0;
		let d = Math.min(cw, ch - rowH);
		const total = s.values.reduce((a, b) => a + b, 0) || 1;
		const disc = el("div", "", box);
		set(disc, { position: "absolute", left: px((cw - d) / 2), top: "0", width: px(d), height: px(d), borderRadius: "50%" });
		let hole = null;
		if (s.kind === "ring") {
			hole = el("div", "", box);
			set(hole, { position: "absolute", left: px((cw - d * 0.6) / 2), top: px(d * 0.2), width: px(d * 0.6), height: px(d * 0.6), borderRadius: "50%", background: bg ?? "#fff", display: "flex", alignItems: "center", justifyContent: "center" });
			const pct = el("div", "display", hole, `${Math.round((s.values[0] / total) * 100)}%`);
			set(pct, { color: fg }); K.design.apply(pct, 'metric');
		}
		const row = el("div", "", box);
		set(row, { position: "absolute", left: "0", width: px(cw), top: px(d + 26 * S), display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `${px(K.design.space(1))} ${px(K.design.space(3))}` });
		const legend = (s.labels ?? []).slice(0, n).map((t, i) => {
			const lg = el("div", "mono", row);
			set(lg, { display: "flex", alignItems: "center", gap: px(K.design.space(1)), color: fg, whiteSpace: "nowrap" }); K.design.apply(lg, 'label');
			const dot = el("span", "", lg);
			set(dot, { width: "0.6em", height: "0.6em", borderRadius: "50%", background: cols[i % cols.length], flex: "none" });
			const label = el("span", "", lg, t ?? "");
			set(label, { display: "block", maxWidth: px(cw/Math.min(3,n)-K.design.space(3)-K.design.space(1)-K.design.type('label').size*.6) });
			K.design.truncateLine(label);label.title = t ?? "";
			return lg;
		});
        d=Math.min(cw,ch-row.offsetHeight-K.design.space(3));
        set(disc,{left:px((cw-d)/2),width:px(d),height:px(d)});
        if(hole)set(hole,{left:px((cw-d*.6)/2),top:px(d*.2),width:px(d*.6),height:px(d*.6)});
        set(row,{top:px(d+K.design.space(3))});
		draw = (l) => {
			const k = expoOut(prog(l, 0.08, Math.min(1.2, p.dur * 0.6)));
			let acc = 0;
			const stops = s.values.map((v, i) => {
				const a0 = (acc / total) * 360 * k;
				acc += v;
				const a1 = (acc / total) * 360 * k;
				return `${cols[i % cols.length]} ${a0.toFixed(2)}deg ${a1.toFixed(2)}deg`;
			});
			set(disc, { background: `conic-gradient(${stops.join(", ")}, ${alpha(fg, 0.08)} ${(360 * k).toFixed(2)}deg 360deg)`, transform: `rotate(${((1 - k) * -90).toFixed(2)}deg) scale(${(0.8 + 0.2 * spring(l, 2.4, 0.7)).toFixed(4)})` });
			legend.forEach((lg, i) => set(lg, { opacity: clamp((l - 0.6 - i * 0.08) / 0.15).toFixed(3) }));
			if (hole) set(hole, { opacity: clamp(l / 0.2).toFixed(3) });
		};
	}
	return (l) => {
		draw(l);
		void lum;
	};
};

