// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export const factory = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, expoOut, prog, clamp, spring, alpha } = K;
	const s = p.scene;
	const n = s.items.length;
	const marks = p.marks; // when each part lands: components/scene-moments.cjs
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

