// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
// ---- montage: footage and small lines, cut on the beat --------------------------------------------------
// Full-bleed photographs cut fast with a slow push on each, and between them a line of small type on
// a plain card, a few words at a time. A brand film's rhythm. Seen in theProcessXCII's "Finality".
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, alpha, mixHex, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const pics = (s.images ?? []).map((u) => K.images[u]).filter(Boolean);
	const lines = (s.lines?.length ? s.lines : ["Everyone has a plan.", "Few ship it."]).slice(0, 5);
	// Sci-fi keeps its dark scope between shots, the line set in the style's wide display face.
	const scope = !!K.plan?.look?.deco?.hud;
	const cardBg = scope || lum(bg) > 0.5 ? bg : "#f4f2ee";
	const cardInk = lum(cardBg) > 0.5 ? "#141414" : "#f4f2ee";
	// The cut list: two shots, then a line; repeat.
	const segs = [];
	lines.forEach((ln, i) => {
		segs.push({ kind: "shot", i: i * 2 });
		segs.push({ kind: "shot", i: i * 2 + 1 });
		segs.push({ kind: "line", text: ln });
	});
	const weights = segs.map((g) => (g.kind === "line" ? 2.2 : 1));
	const wsum = weights.reduce((a, b) => a + b, 0);
	let acc = 0;
	const starts = weights.map((w) => {
		const t = acc;
		acc += (w / wsum) * d0;
		return t;
	});
	const durs = weights.map((w) => (w / wsum) * d0);
	const layers = segs.map((g, k) => {
		const box = el("div", "", cam);
		set(box, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), overflow: "hidden", opacity: "0" });
		if (g.kind === "shot") {
			const pic = pics.length ? pics[g.i % pics.length] : null;
			const inner = el(pic ? "img" : "div", "fill", box);
			if (pic) {
				inner.src = pic.src;
				set(inner, { width: "100%", height: "100%", objectFit: "cover", willChange: "transform" });
			} else {
				// No photos: a graded colour plate with a soft light, never a grey box.
				const c = [palette.coral, palette.sky, palette.butter, palette.lilac, accent].filter(Boolean)[g.i % 5] ?? accent;
				set(inner, { position: "absolute", inset: "0", background: `radial-gradient(circle at ${30 + hash(k) * 40}% ${30 + hash(k * 2) * 40}%, ${mixHex(c, "#ffffff", 0.3)} 0%, ${mixHex(c, "#000000", 0.55)} 70%)` });
			}
			// A film grade: a little darker at the edges.
			const vig = el("div", "", box);
			set(vig, { position: "absolute", inset: "0", background: `radial-gradient(ellipse at 50% 50%, transparent 55%, ${alpha("#000000", 0.38)} 100%)` });
			return { box, inner, kind: "shot", dir: hash(k * 5.3) > 0.5 ? 1 : -1 };
		}
		set(box, { background: cardBg });
		const tx = el("div", scope ? "display" : "", box);
		const fs = (scope ? 50 : 62) * S;
		set(tx, { position: "absolute", left: px(W * 0.1), width: px(W * 0.8), top: "50%", transform: "translateY(-50%)", textAlign: "center", color: cardInk, ...(scope ? {} : { }) });
		D.apply(tx,"display");
		const words = String(g.text).split(/\s+/).filter(Boolean).map((w, j) => {
			if (j) tx.appendChild(document.createTextNode(" "));
			const em = /^\*.*\*[.,!?]?$/.test(w);
			const sp = el("span", "", tx, w.replace(/\*/g, ""));
			// The accent word must read on the card: fall back to the ink with italic emphasis.
			const [hi, lo] = [lum(accent), lum(cardBg)].sort((a, b) => b - a);
			const readable = (hi + 0.05) / (lo + 0.05) >= 3;
			set(sp, { display: "inline-block", color: em && readable ? accent : cardInk });
			if (em && (!readable || K.plan?.look?.display?.accent === "serif")) sp.style.fontStyle = "italic";
			return sp;
		});
		return { box, words, kind: "line" };
	});
	return (l) => {
		layers.forEach((L, k) => {
			const t0 = starts[k];
			const on = l >= t0 && (k === layers.length - 1 || l < starts[k + 1]);
			set(L.box, { opacity: on ? "1" : "0" });
			// Hidden shots and lines also reset from time, so a reverse seek
			// cannot retain transforms from a later montage segment.
			const u = clamp((l - t0) / durs[k]);
			if (L.kind === "shot") {
				// A slow push and drift on every shot, so no frame is ever still.
				const sc = 1.12 - 0.08 * E.cruise(u);
				set(L.inner, { transform: `scale(${sc.toFixed(4)}) translateX(${(L.dir * (u - 0.5) * 2.4).toFixed(3)}%)` });
			} else {
				L.words.forEach((w, j) => {
					const a = E.softLand(prog(l - t0, 0.04 + j * 0.07, 0.35));
					set(w, { opacity: clamp(a * 2).toFixed(3), transform: `translateY(${px((1 - a) * 18 * S)})` });
				});
			}
		});
	};
};

