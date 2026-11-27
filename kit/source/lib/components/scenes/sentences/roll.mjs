// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
// ---- roll: "You're still answering [tickets / emails / chats / DMs]" ------------------------------
// The last word rolls vertically like a slot machine, the words either side soft and faded, with
// blue selection handles round the one in focus. The line stays centred as the word's width changes.
export const factory = ({ p, cam, fg, accent, palette, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, spring, glyphText, riseGlyphs } = K;
	const D = K.design;
	const s = p.scene;
	const words = s.words;
	const n = words.length;
	const stacked = H > W || s.lead.length + Math.max(...words.map(w => w.length)) > 30;
	const blue = palette.electric ?? "#2f6bff";
	const line = el("div", "bold", cam);
	set(line, { position: "absolute", left: "50%", top: "50%", display: "flex", flexDirection: stacked ? "column" : "row", alignItems: "center", whiteSpace: "nowrap", color: fg,  });
	const lead = el("div", "", line);
	const lg = glyphText(lead, s.lead).glyphs;
	const gap = el("div", "", line);
	set(gap, { width: "0.3em", flex: "none" });
	const slot = el("div", "", line);
	set(slot, { position: "relative", height: "1.15em", flex: "none" });
	const longest = words.reduce((a, w) => (w.length > a.length ? w : a), "");
	// Fit with the longest word in place.
	const probe = el("span", "", slot, longest);
	if (stacked) {
		set(line, { width: px(K.safe.w * 0.9), gap: px(D.space(6)) });
		set(lead, { width: "100%", whiteSpace: "normal", textAlign: "center" });
		set(gap, { display: "none" });
	}
	D.fitSize(line, K.safe.w * 0.9, K.safe.h * 0.7, "display", { wrap: stacked ? "normal" : "nowrap" });
	const widths = words.map((w) => {
		probe.textContent = w;
		return probe.offsetWidth;
	});
	probe.remove();
	const items = words.map((w) => {
		const it = el("div", "", slot, w);
		set(it, { position: "absolute", left: "0", top: "0", whiteSpace: "nowrap", color: accent });
		return it;
	});
	// Selection handles: two thin bars with dots, like a text selection.
	const handle = (side) => {
		const h = el("div", "", slot);
		set(h, { position: "absolute", top: "0.06em", width: "0.035em", height: "1.02em", background: blue, borderRadius: "0.02em", [side]: "-0.08em" });
		const dot = el("div", "", h);
		set(dot, { position: "absolute", left: "50%", width: "0.14em", height: "0.14em", marginLeft: "-0.07em", borderRadius: "50%", background: blue, [side === "left" ? "top" : "bottom"]: "-0.1em" });
		return h;
	};
	const hl = handle("left");
	const hr = handle("right");
	// The wheel clicks to each next word on a beat (scene-moments.cjs); a turn begins a moment before.
	const turns = p.at.turns;
	return (l) => {
		riseGlyphs(lg, l, { at: 0.02, stagger: 0.03, rot: -4 });
		// Position along the list: eased steps from word to word.
		let pos = 0;
		for (const turn of turns) pos += K.cubicInOut(prog(l, turn - 0.2, 0.5));
		const cur = Math.round(pos);
		const lo = Math.floor(pos);
		const f = pos - lo;
		const w = widths[lo] + ((widths[Math.min(n - 1, lo + 1)] ?? widths[lo]) - widths[lo]) * f;
		set(slot, { width: px(w) });
		items.forEach((it, i) => {
			const d = i - pos;
			const a = Math.abs(d);
			set(it, {
				opacity: (clamp(1 - a * 0.62) * clamp((l - 0.15) / 0.3)).toFixed(3),
				transform: `translateY(${(d * 1.05).toFixed(4)}em) scale(${(1 - Math.min(0.25, a * 0.14)).toFixed(4)})`,
				filter: a > 0.04 ? `blur(${(Math.min(1, a) * 0.05).toFixed(4)}em)` : "none",
				color: a < 0.5 ? accent : fg,
			});
		});
		const settle = 1 - Math.min(1, Math.abs(pos - cur) * 4);
		for (const h of [hl, hr]) set(h, { opacity: (settle * clamp((l - 0.25) / 0.2)).toFixed(3) });
		const intro = spring(l, 2.4, 0.7);
		set(line, { transform: `translate(-50%,-50%) translateX(${px((1 - intro) * 40 * S)})` });
	};
};

