// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
/** Colourful accents of the palette that aren't the background. */
export const accents = (palette, bg) => [palette.electric, palette.coral, palette.lime, palette.lilac, palette.butter, palette.peach].filter((c) => c && String(c).toLowerCase() !== String(bg).toLowerCase());

/** A picture for a card: the user's image, or a made-up product thumbnail (a gradient with a tiny
 *  app card on it, or a short item word/emoji) so the scene still reads without screenshots. */
export const media = (K, parent, img, seed, palette, bg, item) => {
	const { el, set, hash, mixHex, alpha, textOn } = K;
	const D = K.design.forSurface(Math.max(1, Math.min(parent.clientHeight, parent.clientWidth)) / (K.design.unit * (!item ? 360 : !/\p{Extended_Pictographic}/u.test(item) ? 64 : 48)));
	if (img) {
		const im = el("img", "fill", parent);
		im.src = img.src;
		set(im, { objectFit: "cover" });
		return;
	}
	const cols = accents(palette, bg);
	const c1 = cols[Math.floor(hash(seed * 3.1) * cols.length)] ?? "#7a6cff";
	const c2 = cols[Math.floor(hash(seed * 7.7 + 1) * cols.length)] ?? "#ff7eb6";
	set(parent, { background: `radial-gradient(120% 90% at ${(20 + hash(seed) * 60).toFixed(0)}% 0%, ${mixHex(c1, "#ffffff", 0.25)} 0%, ${c1} 45%, ${mixHex(c2, "#000000", 0.08)} 100%)` });
	if (item) {
		const t = el("div", "", parent, item);
		const emoji = /\p{Extended_Pictographic}/u.test(item);
		set(t, { position: "absolute", inset: "0", display: "grid", placeItems: "center", textAlign: "center", whiteSpace: "normal", overflowWrap: "anywhere", boxSizing: "border-box", color: textOn(c1), padding: `0 ${D.space(1)}px` });
		D.apply(t, emoji ? "cardTitle" : "label");
		return;
	}
	// A small floating app card: avatar, two lines, a pill.
	const card = el("div", "", parent);
	set(card, { position: "absolute", left: "14%", right: "14%", top: "30%", background: "rgba(255,255,255,0.92)", boxShadow: `0 0.04em 0.1em ${alpha("#000000", 0.18)}`, display: "flex", flexDirection: "column", });
	D.surface(card, "card", { density: "compact" });
	const row = el("div", "", card);
	set(row, { display: "flex", alignItems: "center", gap: `${D.space(1)}px` });
	D.surfaceGap(row, 1);
	const av = el("div", "", row);
	set(av, { width: "0.11em", height: "0.11em", borderRadius: "50%", background: c2, flex: "none" });
	const l1 = el("div", "", row);
	set(l1, { height: "0.03em", borderRadius: "1em", background: "rgba(10,12,20,0.75)", width: `${(40 + hash(seed * 2.3) * 40).toFixed(0)}%` });
	for (let i = 0; i < 2; i++) {
		const ln = el("div", "", card);
		set(ln, { height: "0.026em", borderRadius: "1em", background: "rgba(10,12,20,0.16)", width: `${(60 + hash(seed * 5 + i) * 35).toFixed(0)}%` });
	}
	const pill = el("div", "", card);
	set(pill, { height: "0.06em", width: "45%", borderRadius: "1em", background: c1 });
};

/** Words of a line with *accent* words coloured (or italic when the style requests contrasting emphasis). */
export const wordsOf = (K, parent, text, accent) => {
	const g = K.glyphText(parent, text);
	for (const w of g.words)
		if (w.accent) {
			w.node.style.color = accent;
			if (K.plan.look?.display?.accent === "serif") w.node.style.fontStyle = "italic";
		}
	return g;
};

