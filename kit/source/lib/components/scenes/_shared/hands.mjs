// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export const DOUBLE = (w) => String(w ?? "").replace(/\*/g, "");

/** A painted ground: large soft washes of the palette that drift slowly, like a gouache backdrop
 *  behind the product. Built first so it sits behind everything in the scene. */
export const paintGround = (cam, K, palette, accent, bg) => {
	const { W, H, el, set, px, mixHex, lum } = K;
	const g = el("div", "", cam);
	set(g, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), overflow: "hidden", background: bg });
	const light = lum(bg) > 0.45;
	// A gouache needs colour: if the style's palette is mostly greys, fall back to soft pastels.
	const chroma = (h) => {
		const n = parseInt(String(h).replace("#", "").slice(0, 6), 16);
		if (Number.isNaN(n)) return 0;
		const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		return (Math.max(...c) - Math.min(...c)) / 255;
	};
	let cols = [palette.coral, palette.sky, palette.butter, palette.lilac].filter((c) => c && chroma(c) > 0.25);
	if (cols.length < 3) cols = ["#ffb199", "#9fd3ff", "#ffe08a", "#cdb8ff"];
	cols.push(accent);
	const blobs = [0, 1, 2, 3, 4].map((i) => {
		const b = el("div", "", g);
		const src = cols[i % cols.length];
		const c = mixHex(src, bg, src === accent ? (light ? 0.6 : 0.7) : light ? 0.15 : 0.45);
		const r = Math.max(W, H) * (0.55 + 0.12 * (i % 3));
		set(b, { position: "absolute", left: "0", top: "0", width: px(r), height: px(r), borderRadius: "50%", background: `radial-gradient(circle at 50% 50%, ${c} 0%, ${c} 22%, transparent 68%)`, willChange: "transform" });
		return { b, r, i };
	});
	const seeds = [
		[0.12, 0.2],
		[0.85, 0.15],
		[0.7, 0.9],
		[0.15, 0.85],
		[0.5, 0.5],
	];
	return (l) => {
		blobs.forEach(({ b, r, i }) => {
			const [sx, sy] = seeds[i];
			const x = sx * W + Math.sin(l * 0.35 + i * 1.7) * W * 0.05 - r / 2;
			const y = sy * H + Math.cos(l * 0.3 + i * 2.3) * H * 0.05 - r / 2;
			set(b, { transform: `translate(${px(x)}, ${px(y)}) scale(${(1 + Math.sin(l * 0.25 + i) * 0.05).toFixed(4)})` });
		});
	};
};

