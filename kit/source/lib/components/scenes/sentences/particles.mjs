// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
// ---- particles: a constellation that becomes the line ---------------------------------------------
// Dots drift across the frame joined by faint lines, then fly in and settle into the words; the dots
// tighten into solid type. Seen in Benji Taylor's launch films for Grok.
export const factory = ({ p, cam, fg, accent, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, alpha, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const text = String(s.text || "Frontier-level intelligence");
	const plainText = text.replace(/\*/g, "");
	// The solid line, laid out first so the dots know where to land.
	const line = el("div", "display", cam);
	const fs0 = D.type("display").size;
	set(line, { position: "absolute", left: px(W * 0.07), width: px(W * 0.86), top: "0", textAlign: "center", color: fg, opacity: "0" });
	const words = [];
	text.split(/\s+/).filter(Boolean).forEach((w, i) => {
		if (i) line.appendChild(document.createTextNode(" "));
		const em = /^\*.*\*[.,!?]?$/.test(w);
		const n = el("span", "", line, w.replace(/\*/g, ""));
		if (em) {
			set(n, { color: accent });
			if (K.plan?.look?.display?.accent === "serif") n.style.fontStyle = "italic";
		}
		words.push(n);
	});
	D.fitSize(line,W*.86,H*.5,"display");
	const lh = line.offsetHeight;
	const top = (H - lh) / 2;
	set(line, { top: px(top) });
	// Sample the line into dots: draw each word's box with the same font on a canvas.
	const cs = getComputedStyle(line);
	const fsz = parseFloat(cs.fontSize);
	const cv = document.createElement("canvas");
	const sc = 0.5;
	cv.width = Math.ceil(W * sc);
	cv.height = Math.ceil(H * sc);
	const g = cv.getContext("2d");
	g.fillStyle = "#000";
	g.textBaseline = "alphabetic";
	// Layout offsets, not screen rects: the stage may be scaled on screen while it builds.
	const rasterSpec = D.type("display", Number(line.dataset.designStep));
	cv.dataset.designRaster = JSON.stringify(words.map(nd => ({ ...rasterSpec, unit: rasterSpec.unit * sc, size: fsz * sc, lineHeight: rasterSpec.lineHeight * sc, text: nd.textContent })));
	words.forEach((nd) => {
		const ws = getComputedStyle(nd);
		g.font = `${ws.fontStyle} ${ws.fontWeight} ${ws.fontStretch && ws.fontStretch !== "100%" ? ws.fontStretch + " " : ""}${fsz * sc}px ${ws.fontFamily}`;
		g.letterSpacing = `${(parseFloat(ws.letterSpacing) || 0) * sc}px`;
		const lineH = nd.offsetHeight;
		g.fillText(nd.textContent, (line.offsetLeft + nd.offsetLeft) * sc, (top + nd.offsetTop + lineH * 0.5 + fsz * 0.34) * sc);
	});
	const data = g.getImageData(0, 0, cv.width, cv.height).data;
	const pts = [];
	const step = Math.max(2, Math.round((vertical ? 3 : 3.4) * (cv.width / 960)));
	for (let y = 0; y < cv.height; y += step)
		for (let x = 0; x < cv.width; x += step) if (data[(y * cv.width + x) * 4 + 3] > 140) pts.push({ x: x / sc, y: y / sc });
	// Cap the count; keep an even spread.
	const MAX = 2600;
	const keep = pts.length > MAX ? pts.filter((_, i) => hash(i * 1.37) < MAX / pts.length) : pts;
	const parts = keep.map((t, i) => {
		const a = hash(i * 3.17) * Math.PI * 2;
		const rr = Math.sqrt(hash(i * 7.31)) * Math.max(W, H) * 0.62;
		return { tx: t.x, ty: t.y, sx: W / 2 + Math.cos(a) * rr, sy: H / 2 + Math.sin(a) * rr * 0.75, ph: hash(i * 9.1) * 6.28, delay: hash(i * 5.5) * 0.45 + (t.x / W) * 0.25, acc: false };
	});
	// Drawn at the size the picture is watched at (K.previewScale: the live
	// preview's stream), laid over the frame at its own size.
	const q = K.previewScale ?? 1;
	const canvas = el("canvas", "", cam);
	canvas.width = Math.round(W * q);
	canvas.height = Math.round(H * q);
	set(canvas, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H) });
	const ctx = canvas.getContext("2d");
	ctx.setTransform(q, 0, 0, q, 0, 0);
	const r0 = Math.max(1.2, 2.3 * S);
	const tGather = Math.min(0.7, d0 * 0.18);
	const gDur = 1.1;
	const tSolid = tGather + gDur + 0.5;
	const lineN = Math.min(160, parts.length);
	return (l) => {
		ctx.clearRect(0, 0, W, H);
		const solid = E.softInOut(prog(l, tSolid, 0.45));
		const pos = parts.map((q) => {
			const k = E.softInOut(prog(l, tGather + q.delay, gDur));
			const drift = (1 - k) * 18 * S;
			return { x: q.sx + (q.tx - q.sx) * k + Math.cos(l * 0.8 + q.ph) * drift, y: q.sy + (q.ty - q.sy) * k + Math.sin(l * 0.7 + q.ph) * drift, k };
		});
		// Faint constellation lines while the dots are loose.
		const looseA = 1 - E.softInOut(prog(l, tGather, 0.6));
		if (looseA > 0.01) {
			ctx.strokeStyle = alpha(fg, 0.16 * looseA);
			ctx.lineWidth = Math.max(1, 1.2 * S);
			ctx.beginPath();
			const lim = (W * 0.11) ** 2;
			for (let i = 0; i < lineN; i++)
				for (let j = i + 1; j < lineN; j++) {
					const dx = pos[i].x - pos[j].x;
					const dy = pos[i].y - pos[j].y;
					if (dx * dx + dy * dy < lim) {
						ctx.moveTo(pos[i].x, pos[i].y);
						ctx.lineTo(pos[j].x, pos[j].y);
					}
				}
			ctx.stroke();
		}
		ctx.fillStyle = fg;
		const fade = 1 - solid;
		if (fade > 0.01) {
			ctx.globalAlpha = clamp(l / 0.3) * fade;
			for (let i = 0; i < pos.length; i++) {
				const q = pos[i];
				const rr = r0 * (1.6 - 0.6 * q.k) * (0.6 + 0.4 * fade);
				ctx.fillRect(q.x - rr / 2, q.y - rr / 2, rr, rr);
			}
			ctx.globalAlpha = 1;
		}
		set(line, { opacity: solid.toFixed(3), transform: `scale(${(1.03 - 0.03 * solid).toFixed(4)})` });
	};
};

