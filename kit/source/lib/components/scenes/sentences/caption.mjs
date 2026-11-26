// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
/** Digits in a string roll like an odometer; everything else stays put. */
const rollingNumber = (K, parent, text, size) => {
	const { el, set } = K;
	const box = el("span", "", parent);
	box.setAttribute("data-roll", "");
	set(box, { display: "inline-flex", overflow: "hidden", height: "1lh", verticalAlign: "bottom", fontVariantNumeric: "tabular-nums", whiteSpace: "pre" });
	const cols = [];
	for (const ch of String(text)) {
		if (/\d/.test(ch)) {
			const col = el("span", "", box);
			set(col, { display: "inline-flex", flexDirection: "column", lineHeight: "inherit" });
			for (let d = 0; d <= 9; d++) el("span", "", col, String(d));
			cols.push({ col, digit: Number(ch) });
		} else el("span", "", box, ch);
	}
	/** k: 0 -> 1 progress; digits spin through extra turns, leftmost slowest. */
	return (k, live = 0) => {
		cols.forEach(({ col, digit }, i) => {
			const turns = Math.max(0, cols.length - i - 1);
			const v = (digit + turns * 10) * k + (i === cols.length - 1 ? live : 0);
			const pos = v % 10;
			set(col, { transform: `translateY(calc(${(-pos).toFixed(4)} * 1lh))` });
		});
	};
};

/** "Your rival just hit [$100,412] in MRR." Chips are pills; digits inside them roll. */
export const factory = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, clamp, expoOut, spring, prog, alpha, textOn, images } = K;
	const s = p.scene;
	const img = s.image ? images[s.image] : null;
	const vertical = H > W * 1.2;
	const wrap = el("div", "center", cam);
	set(wrap, { justifyContent: img ? "flex-start" : "center", paddingTop: img ? px(H * 0.08) : "0", boxSizing: "border-box" });
	const line = el("div", "bold", wrap);
	set(line, { color: fg, textAlign: "center", maxWidth: px(W * 0.86) });
	const parts = [];
	const tokens = String(s.text).split(/(\[[^\]]+\])/).filter(Boolean);
	for (const [ti, tok0] of tokens.entries()) {
		let tok = tok0;
		// Punctuation right after a chip stays glued to it instead of wrapping onto its own line.
		const lead = ti > 0 && /^\[/.test(tokens[ti - 1]) ? /^[.,!?;:…]+/.exec(tok) : null;
		if (lead) tok = tok.slice(lead[0].length);
		if (!tok) continue;
		const chip = /^\[(.+)\]$/.exec(tok);
		if (chip) {
			const tail = /^[.,!?;:…]+/.exec(tokens[ti + 1] ?? "")?.[0];
			const holder = tail ? el("span", "", line) : line;
			if (tail) set(holder, { display: "inline-block", whiteSpace: "nowrap" });
			const c = el("span", "pill", holder);
			set(c, { background: alpha(fg, 0.08), border: `${px(2 * S)} solid ${alpha(fg, 0.14)}`, margin: "0 0.12em", verticalAlign: "0.06em", lineHeight: "inherit", display: "inline-flex", alignItems: "center" });
			K.design.surface(c,'badge',{density:'compact',shape:'pill'});
			const dot = el("span", "", c);
			set(dot, { width: "0.5em", height: "0.5em", borderRadius: "50%", background: accent, flex: "none" });
			const hasDigits = /\d/.test(chip[1]);
			const roll = hasDigits ? rollingNumber(K, c, chip[1]) : null;
			if (!hasDigits) el("span", "", c, chip[1]);
			if (tail) el("span", "", holder, tail);
			parts.push({ node: tail ? holder : c, chip: true, roll });
		} else
			for (const w of tok.split(/(\s+)/)) {
				if (!w) continue;
				if (/^\s+$/.test(w)) {
					line.appendChild(document.createTextNode(" "));
					continue;
				}
				parts.push({ node: el("span", "word", line, w) });
			}
	}
	K.design.fitSize(line, W * 0.86, img ? H * 0.16 : H * 0.42, 'display');
	let sub = null;
	if (s.sub) {
		sub = el("div", "bold", wrap, s.sub);
		set(sub, { color: fg, opacity: "0.6", marginTop: px(K.design.space(1)) }); K.design.apply(sub, 'caption');
	}
	let card = null;
	if (img) {
		const aspect = img.w / img.h;
		let cw = W * (vertical ? 0.86 : 0.56);
		let ch = cw / aspect;
		const maxH = H * 0.62;
		if (ch > maxH) {
			ch = maxH;
			cw = ch * aspect;
		}
		card = el("div", "card", cam);
		set(card, { left: px((W - cw) / 2), top: px(H - ch - H * 0.07), width: px(cw), height: px(ch), boxShadow: `0 ${px(40 * S)} ${px(90 * S)} rgba(0,0,0,0.25)` });
		K.design.surface(card,'card',{layout:'frame',purpose:'media'});
		const im = el("img", "fill", card);
		im.src = img.src;
	}
	const step = Math.min(0.09, 0.7 / Math.max(1, parts.length));
	return (l) => {
		parts.forEach((pt, i) => {
			const t0 = 0.03 + i * step;
			const k = spring(l - t0, pt.chip ? 2.8 : 3.4, pt.chip ? 0.5 : 0.7);
			set(pt.node, {
				opacity: clamp((l - t0) / 0.08).toFixed(3),
				transform: pt.chip ? `scale(${(0.6 + 0.4 * k).toFixed(4)})` : `translateY(${((1 - k) * 0.4).toFixed(4)}em)`,
				filter: `blur(${px((1 - clamp(k)) * 8 * S)})`,
			});
			// The number lands on exactly what was written and stays there.
			if (pt.roll) pt.roll(expoOut(prog(l, t0, 0.9)));
		});
		// The line drifts and grows slowly once it has landed, so a long caption never freezes.
		set(line, { transform: `translateY(${(Math.sin(l * 1.1) * 0.04).toFixed(4)}em) scale(${(1 + 0.04 * clamp(l / Math.max(1, p.dur))).toFixed(4)})` });
		if (sub) {
			const k = expoOut(prog(l, 0.35 + parts.length * step, 0.5));
			set(sub, { opacity: (0.6 * k).toFixed(3), transform: `translateY(${px((1 - k) * 18 * S)})` });
		}
		if (card) {
			const k = expoOut(prog(l, 0.25, 0.8));
			set(card, { opacity: clamp(l / 0.15).toFixed(3), transform: `translateY(${px((1 - k) * H * 0.4)}) rotateX(${((1 - k) * 18).toFixed(2)}deg)` });
		}
	};
};

