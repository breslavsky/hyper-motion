// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
const sceneFactories = {};
const SVG = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => {
	const n = document.createElementNS(SVG, tag);
	for (const k in attrs) n.setAttribute(k, String(attrs[k]));
	if (parent) parent.appendChild(n);
	return n;
};
const fmt = (v, decimals = 0) => {
	const fixed = Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(decimals);
	return fixed;
};
/** 1200000 -> 1.2M style when the number is large, so it stays big on screen. */
const compact = (v) => {
	const a = Math.abs(v);
	if (a >= 1e9) return { n: v / 1e9, s: "B", d: 1 };
	if (a >= 1e6) return { n: v / 1e6, s: "M", d: 1 };
	if (a >= 1e4) return { n: v / 1e3, s: "K", d: 0 };
	return { n: v, s: "", d: String(v).split(".")[1]?.length ?? 0 };
};

sceneFactories.stat = ({ p, cam, fg, accent, K }) => {
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

sceneFactories.chart = ({ p, cam, fg, accent, palette, bg, K }) => {
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

sceneFactories.timeline = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, expoOut, prog, clamp, spring, alpha } = K;
	const s = p.scene;
	const n = s.items.length;
	const marks = p.marks ?? s.items.map((_, i) => 0.3 + i * p.beatLen);
	const wrap = el("div", "center", cam);
	if (s.title) {
		const t = el("div", "display", wrap, s.title);
		set(t, { color: fg, position: "absolute", top: px(H * 0.12) });
		K.design.fitSize(t, K.safe.w, K.design.steps('sceneTitle').at(-1).lineHeight*2, 'sceneTitle');
	}
	const vertical = H > W * 1.2;
	const baseLen = vertical ? H * 0.6 : W * 0.8;
    const labelW=vertical?K.safe.w*.65:Math.min(K.safe.w*.42,baseLen/Math.max(1,Math.ceil(n/2))-K.design.space(4));
    const labels=s.items.map((text,i)=>{
        const lab=el('div','bold',cam,text);
        lab.dataset.timelineLabel=String(i);
        lab.dataset.timelineAlign=vertical?'left':'center';
        set(lab,{position:'absolute',color:fg,width:vertical?px(labelW):'max-content'});
        K.design.fitSize(lab,labelW,K.design.steps('body').at(-1).lineHeight*3,'body',{align:vertical?'left':'center'});
        return lab;
    });
    // Reserve the real endpoint labels before positioning the track. This keeps
    // a label centred on its dot even when longer copy needs more edge space.
    const margin=W*.04;
    const startX=vertical?W*.3:Math.max((W-baseLen)/2,margin+labels[0].offsetWidth/2);
    const endX=vertical?startX:Math.min((W+baseLen)/2,W-margin-labels.at(-1).offsetWidth/2);
	const len = vertical ? baseLen : endX-startX;
	const track = el("div", "", cam);
	track.dataset.layoutFitAnchor="timeline-track";
    track.dataset.timelineOrientation=vertical?'vertical':'horizontal';
	const x0 = startX;
	const y0 = vertical ? (H - len) / 2 + H * 0.06 : H * 0.56;
	set(track, { position: "absolute", left: px(x0), top: px(y0), width: px(vertical ? 10 * S : len), height: px(vertical ? len : 10 * S), background: alpha(fg, 0.15), borderRadius: px(K.design.radius(1)), overflow: "hidden" });
	const fill = el("div", "", track);
	set(fill, { position: "absolute", left: "0", top: "0", background: accent, width: vertical ? "100%" : "0", height: vertical ? "0" : "100%" });
	const nodes = s.items.map((text, i) => {
		const f = n === 1 ? 0.5 : i / (n - 1);
		const cx = vertical ? x0 + 5 * S : x0 + f * len;
		const cy = vertical ? y0 + f * len : y0 + 5 * S;
		const dot = el("div", "", cam);
        dot.dataset.layoutFitAnchor="timeline-point";
        dot.dataset.timelineDot=String(i);
		set(dot, { position: "absolute", left: px(cx - 26 * S), top: px(cy - 26 * S), width: px(52 * S), height: px(52 * S), borderRadius: "50%", boxSizing: "border-box", border: `${px(8 * S)} solid ${accent}` });
		const lab = labels[i];
		const above = !vertical && i % 2 === 0;
		set(lab, vertical ? { left: px(cx + 64 * S), top: px(cy - 42 * S) } : { left: px(cx), top: px(above ? cy - 140 * S : cy + 64 * S) });
        if(above)set(lab,{top:px(cy-lab.offsetHeight-64*S)});
		const ox = vertical ? 0 : -lab.offsetWidth/2;
		return { dot, lab, f, above, ox };
	});
	return (l) => {
		// The fill travels continuously from dot to dot (reaching each on its beat) instead of
		// bursting forward and stopping between them; it eases out of the start and into the end.
		let v = 0;
		const at = (i) => marks[i] - 0.05;
		if (n === 1) v = nodes[0].f * K.smooth(prog(l, at(0) - 0.3, 0.3));
		else if (l <= at(0)) v = 0;
		else if (l >= at(n - 1)) v = 1;
		else {
			let i = 0;
			while (i < n - 2 && l >= at(i + 1)) i++;
			const u = prog(l, at(i), at(i + 1) - at(i));
			const e = i === 0 ? u * u * (2 - u) : i === n - 2 ? u * (1 + u - u * u) : u;
			v = nodes[i].f + (nodes[i + 1].f - nodes[i].f) * e;
		}
		set(fill, vertical ? { height: `${(v * 100).toFixed(2)}%` } : { width: `${(v * 100).toFixed(2)}%` });
		nodes.forEach(({ dot, lab, above, ox }, i) => {
			const k = spring(l - marks[i], 3, 0.55);
			const on = l >= marks[i];
			set(dot, { background: on ? alpha(accent, K.smooth((l - marks[i]) / 0.1)) : "transparent", transform: `scale(${(0.4 + 0.6 * k).toFixed(4)})`, opacity: clamp((l - marks[i] + 0.1) / 0.1).toFixed(3) });
			const t = vertical ? `translateX(${px((1 - k) * 40 * S)})` : `translateX(${px(ox)}) translateY(${px((1 - k) * (above ? 30 : -30) * S)})`;
			set(lab, { opacity: clamp((l - marks[i]) / 0.1).toFixed(3), transform: t });
		});
	};
};

sceneFactories.pricing = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, expoOut, prog, clamp, spring, alpha, textOn, makeCursor } = K;
	const s = p.scene;
	const vertical = H >= W;
	const featureWidth = Math.max(...s.features.map(copy=>{
        const probe=el('span','',cam,copy);K.design.apply(probe,'body');
        set(probe,{position:'absolute',whiteSpace:'nowrap'});
        const width=probe.scrollWidth;probe.remove();return width;
    }));
    const minimumWidth=featureWidth+K.design.space(4)*2+48*S+K.design.space(2)+K.design.space(1);
    const cw = Math.min(K.safe.w,Math.max(vertical?W*.84:Math.min(W*.42,860*S),minimumWidth));
	const card = el("div", "card", cam);
	const cardBg = textOn(fg) === "#111111" ? "#ffffff" : "#111111";
	const ink = textOn(cardBg);
	set(card, { width: px(cw), left: px((W - cw) / 2), background: cardBg, color: ink, boxShadow: `0 ${px(50 * S)} ${px(110 * S)} rgba(0,0,0,0.25)`, display: "flex", flexDirection: "column" });
	const cardBox=K.design.surface(card,'card',{density:s.features.length>=5?'compact':'normal'});
    const name = el("div", "mono", card, s.name);
	set(name, { opacity: "0.7" }); K.design.apply(name, 'label');
	K.design.truncateLine(name);name.title = s.name;
	const priceRow = el("div", "", card);
	set(priceRow, { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: px(K.design.space(1)) });
	const price = el("div", "display", priceRow, `$${s.price}`);
	// Rolling digits after the "$" (sized and fitted as the final price first).
	const rollPriceAfterFit = () => {
		price.textContent = "$";
		return K.odometer(el("span", "", price), String(s.price));
	};
	set(price, { color: ink, whiteSpace: "nowrap", flex: "none", fontVariantNumeric: "tabular-nums" }); K.design.fitLine(price,cw-K.design.space(4)*2,K.safe.h*.15,'display');
	const per = el("div", "bold", priceRow, s.period ?? "");
	set(per, { opacity: "0.6" }); K.design.apply(per, 'caption');
	set(per, { maxWidth: px(cw-cardBox.paddingX*2) });K.design.truncateLine(per);per.title = s.period ?? "";
	const featureH=(K.safe.h-cardBox.paddingY*2-name.offsetHeight-priceRow.offsetHeight-K.design.control('button').height-cardBox.gap*(s.features.length+2)-K.design.space(1))/s.features.length;
	const feats = s.features.map((f) => {
		const r = el("div", "", card);
		set(r, { display: "flex", alignItems: "center", gap: px(K.design.space(2)) }); K.design.apply(r, 'body');
		const ck = el("div", "", r);
		set(ck, { width: px(48 * S), height: px(48 * S), borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" });
		ck.innerHTML = `<svg viewBox="0 0 24 24" width="62%" height="62%"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="${textOn(accent)}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
		const label=el("div", "", r, f);
        K.design.fitSize(label,cw-K.design.space(4)*2-48*S-K.design.space(2),Math.min(K.design.type('body').lineHeight*2,featureH),'body');
		return r;
	});
	const btn = el("div", "", card);
	set(btn, { marginTop: px(K.design.space(1)), height: px(110 * S), borderRadius: px(K.design.radius(6)), background: accent, color: textOn(accent), display: "flex", alignItems: "center", justifyContent: "center" }); K.design.apply(btn, 'button');
			btn.dataset.designControl='button';btn.dataset.designControlLayout='stretch';
			const control = K.design.control('button');
			set(btn, {height: px(control.height), minHeight: px(control.height), boxSizing: 'border-box', padding: `${px(control.paddingY)} ${px(control.paddingX)}`, borderRadius: px(control.radius), flex: 'none'});
	const buttonLabel = el("div", "", btn, s.cta ?? "→");
	set(buttonLabel, { maxWidth: "100%", textAlign: "center" });
	K.design.truncateLine(buttonLabel);buttonLabel.title = s.cta ?? "→";
	const cursor = makeCursor(cam, 80 * S);
	const chH = card.offsetHeight;
	const top = (H - chH) / 2;
	const clickAt = p.dur * 0.78;
	let rollPrice = null;
	return (l) => {
		const e = spring(l, 2.4, 0.65);
		// Once landed the card floats a little, so it never sits frozen.
		const fl = clamp((l - 0.8) / 0.6);
		set(card, { top: px(top), transform: `translateY(${px((1 - e) * H * 0.5 + Math.sin(l * 1.4) * 6 * S * fl)}) rotate(${((1 - e) * -6 + Math.sin(l * 0.9) * 0.6 * fl).toFixed(3)}deg)`, opacity: clamp(l / 0.1).toFixed(3) });
		const pk = expoOut(prog(l, 0.15, 0.9));
		rollPrice ??= rollPriceAfterFit();
		rollPrice(s.price * pk);
		feats.forEach((r, i) => {
			const k = spring(l - 0.45 - i * 0.12, 3, 0.6);
			set(r, { opacity: clamp((l - 0.45 - i * 0.12) / 0.08).toFixed(3), transform: `translateX(${px((1 - k) * 40 * S)})` });
		});
		// A press that dips and springs back over a few frames rather than snapping.
		const press = Math.sin(Math.PI * prog(l, clickAt - 0.03, 0.22));
		set(btn, { transform: `scale(${(1 - 0.05 * press).toFixed(4)})`, filter: press > 0.01 ? `brightness(${(1 - 0.08 * press).toFixed(3)})` : "none" });
		const bx = W / 2;
		const by = top + chH - 56 * S - 55 * S;
		cursor(l, { fx: bx + 300 * S, fy: by + 260 * S, x: bx + 60 * S, y: by, start: clickAt - 0.55, arrive: clickAt - 0.05, click: clickAt, ringColor: alpha(accent, 0.9) });
	};
};

/** A dotted globe turning, with arcs drawing between points. */
sceneFactories.globe = ({ p, cam, fg, accent, K }) => {
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
export {sceneFactories};
export default sceneFactories;
