// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
/** "Zero" stays; the word after it rolls through a mask line on every beat. */
export const factory = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, expoOut, expoIn, prog, clamp } = K;
	const s = p.scene;
	const marks = p.marks ?? s.words.map((_, i) => 0.5 + i * p.beatLen);
	const vertical = H >= W;
	const wrap = el("div", "center", cam);
	const row = el("div", "display", wrap);
	set(row, { color: fg, display: "flex", flexDirection: vertical ? "column" : "row", alignItems: vertical ? "center" : "baseline", gap: "0.22em", whiteSpace: "nowrap" });
	const baseEl = el("span", "", row, s.base);
	set(baseEl, {flex: "none"});
	const slot = el("span", "", row);
	// A display face may reserve more than one em for its ascenders/descenders.
	// Let the loaded font establish the mask's line box instead of cropping it
	// with the tight display line-height; the sizer also determines its width.
	set(slot, { position: "relative", display: "inline-block", flex: "none", overflow: "hidden", lineHeight: "inherit", padding: "0.08em 0" });
	const longest = s.words.reduce((a, b) => (b.length > a.length ? b : a), "");
	const sizer = el("span", "", slot, longest);
	set(sizer, { visibility: "hidden", display: "block" });
	const items = s.words.map((w) => {
		const n = el("span", "", slot, w);
		set(n, { position: "absolute", left: vertical ? "50%" : "0", top: "0.08em", color: accent, whiteSpace: "nowrap" });
		return n;
	});
	// Size the slot by the widest word as set, not the one with the most letters.
	sizer.textContent = items.reduce((a, n) => (n.offsetWidth > a.offsetWidth ? n : a), items[0]).textContent;
	// K.safe already reserves the shared camera's maximum expansion. Measure
	// every replacement against that width before the scene fitter samples it.
	K.design.fitLine(row, K.safe.w, H * (vertical ? 0.5 : 0.4), 'hero');
	const baseK = (l) => expoOut(prog(l, 0.02, 0.5));
	return (l) => {
		const bk = baseK(l);
		// A slow sway under the word swaps, so the holds between them keep moving.
		set(row, { transform: `translateY(${(Math.sin(l * 1.3) * 0.03).toFixed(4)}em) rotate(${(Math.sin(l * 0.8) * 0.5).toFixed(3)}deg)` });
		set(baseEl, { transform: `translateY(${((1 - bk) * 0.6).toFixed(4)}em)`, opacity: clamp(l / 0.08).toFixed(3) });
		items.forEach((n, i) => {
			const inK = expoOut(prog(l, marks[i], 0.35));
			const outAt = i + 1 < items.length ? marks[i + 1] : 1e9;
			const outK = expoIn(prog(l, outAt - 0.06, 0.2));
			const x = vertical ? "translateX(-50%) " : "";
			set(n, { transform: `${x}translateY(${((1 - inK) * 1.1 - outK * 1.1).toFixed(4)}em)`, opacity: l >= marks[i] - 0.01 && outK < 1 ? "1" : "0" });
		});
		void px;
	};
};

