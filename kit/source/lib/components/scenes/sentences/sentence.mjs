// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
/** A sentence landing word by word, big, each word in its own colour. */
export const factory = ({ p, cam, fg, palette, bg, K }) => {
	const { W, H, S, el, set, spring, clamp, lum, glyphText } = K;
	const s = p.scene;
	const wrap = el("div", "center", cam);
	const line = el("div", "display", wrap);
	set(line, { color: fg });
	const { words } = glyphText(line, s.text, { glyphs: false });
	const light = lum(bg) > 0.4;
	const pool = [palette.electric, palette.coral, palette.peach, palette.sage, palette.lilac, palette.lime, palette.butter].filter((c) => Math.abs(lum(c) - lum(bg)) > 0.3);
	words.forEach((w, i) => {
		if (i % 2 === 1 && pool.length) w.node.style.color = pool[i % pool.length];
	});
	K.design.fitSize(line, W * 0.86, H * 0.66, 'display');
	const step = Math.min(p.beatLen / 2, (p.dur * 0.6) / Math.max(1, words.length));
	return (l) => {
		words.forEach((w, i) => {
			const t0 = 0.02 + i * step;
			const k = spring(l - t0, 3.6, 0.55);
			set(w.node, { opacity: K.smooth((l - t0) / 0.09).toFixed(3), transform: `translateY(${((1 - k) * 0.55).toFixed(4)}em) scale(${(0.85 + 0.15 * k).toFixed(4)})` });
		});
		void light;
	};
};

