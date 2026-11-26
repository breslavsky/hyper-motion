// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
const sceneFactories = {};
const DOUBLE = (w) => String(w ?? "").replace(/\*/g, "");

// ---- dot: one ball carries the scene ------------------------------------------------------------
// "Reduce Motion": the lead word's letters tumble away, a ball drops in and bounces into place as
// the dot of the i (or a full stop), then rolls off, floods the frame, morphs through shapes and
// ends as a small dot with the product's words orbiting it in 3D.
sceneFactories.dot = ({ p, cam, fg, accent, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, smooth, hash, alpha, mixHex, lum, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const word = DOUBLE(s.word || "Launch");
	const lead = DOUBLE(s.lead || "");
	const dark = lum(bg) < 0.4;
	const ink = dark ? "#f4f1ea" : "#141414";
	const inkBg = dark ? "#f4f1ea" : "#121212";
	const onInk = dark ? "#121212" : "#f4f1ea";

	// Glyphs: lay out "lead word" and "word" alone in hidden rows to get every letter's place.
	const wordRole = /\s/.test(word) ? "display" : "hero";
	let textSpec = D.type(wordRole), fs = textSpec.size;
	const iAt = (() => {
		const low = word.toLowerCase();
		const k = Math.max(low.lastIndexOf("i"), low.lastIndexOf("j"));
		return k;
	})();
	const shown = [...word].map((c, k) => (k === iAt ? (c === "j" ? "ȷ" : c === "i" ? "ı" : c) : c)).join("");
	const probe = (parts) => {
		const row = el("div", "display", cam);
		set(row, { position: "absolute", left: "0", top: "0", whiteSpace: "nowrap", visibility: "hidden" });
		D.apply(row,wordRole,{step:textSpec.step});
		const spans = [];
		parts.forEach((pt, pi) => {
			if (pi) el("span", "", row, " ");
			for (const c of pt) spans.push(el("span", "", row, c));
		});
		const w = row.offsetWidth;
		const out = spans.map((sp) => ({ x: sp.offsetLeft, w: sp.offsetWidth }));
		row.remove();
		return { w, out };
	};
	let solo;
	for(const candidate of D.steps(wordRole)) {
		textSpec=candidate;fs=candidate.size;solo=probe([shown]);
		if(solo.w<=W*(vertical?.78:.6) && (!lead || probe([lead,shown]).w<=W*.88))break;
	}
	if(solo.w>W*.96 || (lead && probe([lead,shown]).w>W*.96))throw new Error("Dot display copy exceeds available width");
	solo = probe([shown]);
	const both = lead ? probe([lead, shown]) : null;
	const top = H / 2 - textSpec.lineHeight / 2;
	const wordGroup = el("div", "word", cam);
	set(wordGroup, { position: "absolute", inset: "0" });
	const glyphs = [];
	const mk = (c, isLead, k) => {
		const n = el("div", "glyph display", wordGroup, c);
		set(n, { position: "absolute", left: "0", top: px(top), color: ink, whiteSpace: "pre", willChange: "transform" });
		D.apply(n,wordRole,{step:textSpec.step});
		return { n, isLead, k };
	};
	if (lead) [...lead].forEach((c, k) => glyphs.push({ ...mk(c, true, k), from: both.out[k].x + (W - both.w) / 2 }));
	[...shown].forEach((c, k) => glyphs.push({ ...mk(c, false, k), from: lead ? both.out[lead.length + k].x + (W - both.w) / 2 : null, to: solo.out[k].x + (W - solo.w) / 2, w: solo.out[k].w }));
	const wordGlyphs = glyphs.filter((g) => !g.isLead);
	const last = wordGlyphs[wordGlyphs.length - 1];
	const r = fs * 0.085;
	const dotTarget = iAt >= 0 ? { x: wordGlyphs[iAt].to + wordGlyphs[iAt].w / 2, y: top + fs * 0.17 } : { x: last.to + last.w + r * 1.6, y: top + fs * 0.8 - r };

	const flood = el("div", "", cam);
	set(flood, { position: "absolute", left: "0", top: "0", width: px(2 * r), height: px(2 * r), borderRadius: "50%", background: accent, willChange: "transform" });
	const shape = el("div", "", cam);
	const sz = Math.min(W, H) * 0.3;
	set(shape, { position: "absolute", left: px(W / 2 - sz / 2), top: px(H / 2 - sz / 2), width: px(sz), height: px(sz), background: inkBg, opacity: "0", willChange: "transform" });
	const ringBox = el("div", "", cam);
	set(ringBox, { position: "absolute", left: px(W / 2), top: px(H / 2), width: "0", height: "0", perspective: px(1400 * S), opacity: "0" });
	const ringInner = el("div", "word", ringBox);
	set(ringInner, { position: "absolute", left: "0", top: "0", transformStyle: "preserve-3d" });
	const ringStr = `${(s.ring?.length ? s.ring : [word, "in one prompt"]).map(DOUBLE).join(" · ").toUpperCase()} · `;
	const ringFs = D.type("sceneTitle").size;
	const R = Math.min(W, H) * (vertical ? 0.38 : 0.36);
	const ringCh = [...ringStr];
	const ringNodes = ringCh.map((c) => {
		const n = el("div", "glyph display", ringInner, c);
		set(n, { position: "absolute", left: "0", top: "0", color: onInk, whiteSpace: "pre", backfaceVisibility: "visible", transformOrigin: "50% 50%" });
		return n;
	});
	for(const n of ringNodes)D.apply(n,"sceneTitle");
	const ringW = ringNodes.map((n) => n.offsetWidth);
	const totalW = ringW.reduce((a, b) => a + b, 0) || 1;
	// Long copy forms several readable bands on the same rotating cylinder.
	const bandCount = Math.max(1, Math.ceil(totalW / (2 * Math.PI * R * .9)));
	const capacity = totalW / bandCount;
	const ringAng = [], ringY = [];
	let bandWidth = 0, band = 0;
	for (const w of ringW) {
		if (bandWidth > 0 && bandWidth + w > capacity && band < bandCount - 1) { band++; bandWidth = 0; }
		ringAng.push(((bandWidth + w / 2) / capacity) * 360);
		ringY.push((band - (bandCount - 1) / 2) * D.type("sceneTitle").lineHeight * 1.5);
		bandWidth += w;
	}
	const ringR = Math.max(R * .8, capacity / (2 * Math.PI) * 1.02);
	const core = el("div", "", cam);
	const cr = Math.min(W, H) * 0.034;
	set(core, { position: "absolute", left: px(W / 2 - cr), top: px(H / 2 - cr), width: px(2 * cr), height: px(2 * cr), borderRadius: "50%", background: accent, opacity: "0" });

	// Timing, scaled to the scene's length.
	const tFall = 0.12;
	const tBall = lead ? 0.62 : 0.4;
	const g = 2 * (dotTarget.y + 2 * r) / 0.38 ** 2; // gravity so the drop takes 0.38 s
	const drop = dotTarget.y + 2 * r;
	const bounces = [
		[0.38, drop],
		[0.24, drop * 0.16],
		[0.12, drop * 0.04],
	];
	const ballY = (e) => {
		if (e < bounces[0][0]) return -2 * r + 0.5 * g * e * e;
		let t0 = bounces[0][0];
		for (let k = 1; k < bounces.length; k++) {
			const [len, h] = bounces[k];
			if (e < t0 + len) {
				const u = (e - t0) / len;
				return dotTarget.y - 4 * h * u * (1 - u);
			}
			t0 += len;
		}
		return dotTarget.y;
	};
	const landT = bounces.reduce((a, b) => a + b[0], 0);
	const impactAt = [bounces[0][0], bounces[0][0] + bounces[1][0], landT];
	const tMove = Math.max(tBall + landT + 0.55, d0 * 0.34);
	const tShapes = tMove + 0.85;
	const tRing = Math.max(tShapes + 1.1, d0 * 0.7);
	const hasShapes = tRing < d0 - 0.6;
	const shapes = [
		{ r: 0.5, rot: 0, w: 1, h: 1 },
		{ r: 0.3, rot: 90, w: 1, h: 1 },
		{ r: 0.14, rot: 135, w: 0.9, h: 0.9 },
		{ r: 0.5, rot: 180, w: 1.9, h: 0.62 },
	];
	const marks = shapes.map((_, k) => tShapes + 0.12 + ((tRing - 0.45 - tShapes) / shapes.length) * k);
	const cover = Math.hypot(W, H) / (2 * r) + 2;

	return (l) => {
		// 1. The lead word's letters tumble off, each a frame apart, accelerating.
		for (const gl of glyphs) {
			if (gl.isLead) {
				const e = l - tFall - gl.k * 0.035;
				const y = e > 0 ? 0.5 * 3200 * S * e * e : 0;
				const rot = e > 0 ? e * (180 + hash(gl.k * 3.1) * 260) * (hash(gl.k) > 0.5 ? 1 : -1) : 0;
				const x = e > 0 ? e * (hash(gl.k * 7.7) - 0.6) * 300 * S : 0;
				set(gl.n, { transform: `translate(${px(gl.from + x)}, ${px(y)}) rotate(${rot.toFixed(2)}deg)`, opacity: y > H ? "0" : "1" });
				continue;
			}
			let x = gl.to;
			let y = 0;
			let sc = 1;
			let op = 1;
			let blur = 0;
			if (lead) x = gl.from + (gl.to - gl.from) * E.softLand(prog(l, tFall + 0.18, 0.5));
			else {
				// No lead: the word arrives from oversize, landing decelerated.
				const k = E.snapSettle(prog(l, -0.05, 0.6));
				sc = 1 + (1 - k) * 0.9;
				blur = (1 - k) * 0.12;
				op = clamp((l + 0.05) / 0.08);
			}
			// 2. The word leaves upward, letter by letter, accelerating.
			const out = E.accelExit(prog(l, tMove + gl.k * 0.025, 0.3));
			y -= out * fs * 1.1;
			op *= 1 - clamp(out * 1.6 - 0.6);
			blur += out * 0.08;
			set(gl.n, { transform: `translate(${px(x)}, ${px(y)}) scale(${sc.toFixed(4)})`, transformOrigin: `${px(W / 2 - x)} 50%`, opacity: op.toFixed(3), filter: blur > 0.002 ? `blur(${(blur * fs).toFixed(2)}px)` : "none" });
		}
		// 3. The ball: drops, bounces into place, then rolls to the centre and floods the frame.
		const e = l - tBall;
		let bx = dotTarget.x + (1 - E.glide(clamp(e / 0.75))) * W * 0.12;
		let by = e < 0 ? -4 * r : ballY(e);
		let sx = 1;
		let sy = 1;
		for (const ia of impactAt) {
			const q = e - ia;
			if (q > -0.02 && q < 0.14) {
				const k = q < 0 ? 1 + q / 0.02 : Math.exp(-q * 30) * Math.cos(q * 40);
				sx += 0.3 * k;
				sy -= 0.28 * k;
			}
		}
		const mv = E.glide(prog(l, tMove, 0.38));
		bx += (W / 2 - bx) * mv;
		by += (H / 2 - by) * mv;
		const grow = E.whip(prog(l, tMove + 0.32, 0.5));
		const scale = 1 + (cover - 1) * grow;
		set(flood, { transform: `translate(${px(bx - r)}, ${px(by - r + (1 - sy) * r)}) scale(${(sx * scale).toFixed(4)}, ${(sy * scale).toFixed(4)})`, opacity: e < -0.02 ? "0" : "1" });

		// 4. A shape lands on the accent and morphs: circle, rounded square, diamond, pill.
		if (hasShapes) {
			const inK = E.snapSettle(prog(l, tShapes, 0.45));
			let cur = shapes[0];
			for (let k = 1; k < shapes.length; k++) {
				const m = E.softInOut(prog(l, marks[k], 0.34));
				if (m <= 0) break;
				const a = cur;
				const b = shapes[k];
				cur = { r: a.r + (b.r - a.r) * m, rot: a.rot + (b.rot - a.rot) * m, w: a.w + (b.w - a.w) * m, h: a.h + (b.h - a.h) * m };
			}
			// Then the pill fills the frame in ink (the next colour), ready for the ring.
			const fill = E.whip(prog(l, tRing - 0.45, 0.5));
			const big = Math.hypot(W, H) / sz + 0.5;
			const w = cur.w + (big - cur.w) * fill;
			const h = cur.h + (big - cur.h) * fill;
			const breathe = 1 + Math.sin(l * 3) * 0.015 * (1 - fill);
			set(shape, {
				opacity: l < tShapes ? "0" : "1",
				borderRadius: `${(cur.r * 100 * (1 - fill)).toFixed(2)}% / ${(cur.r * 100 * (1 - fill) * (cur.w / cur.h)).toFixed(2)}%`,
				width: px(sz * w),
				height: px(sz * h),
				left: px(W / 2 - (sz * w) / 2),
				top: px(H / 2 - (sz * h) / 2),
				transform: `rotate(${(cur.rot * (1 - fill)).toFixed(2)}deg) scale(${((1 + (1 - inK) * 0.7) * breathe).toFixed(4)})`,
			});
		}
		// 5. The ring of words orbits a small dot, in 3D (the back half seen mirrored, dimmer).
		const ringK = E.softLand(prog(l, tRing - (hasShapes ? 0.05 : 0.3), 0.6));
		// Hidden again before its moment: a frame is drawn for the time asked, whatever was drawn before it. Left as
		// it was, the ink plate of a later frame stayed over the word when an earlier frame was drawn after it, which
		// is what a render does (its workers take frames in no order).
		if (!hasShapes) set(shape, l > tRing - 0.5
			? { opacity: "1", borderRadius: "0", width: px(W * 1.2), height: px(H * 1.2), left: px(-W * 0.1), top: px(-H * 0.1), transform: `scale(${E.whip(prog(l, tRing - 0.5, 0.45)).toFixed(4)})` }
			: { opacity: "0" });
		set(ringBox, { opacity: ringK.toFixed(3), transform: `scale(${(1.6 - 0.6 * ringK).toFixed(4)})` });
		set(ringInner, { transform: `rotateX(-16deg) rotateZ(-6deg) rotateY(${(-l * 46).toFixed(2)}deg)` });
		for (let k = 0; k < ringNodes.length; k++) {
			const a = ringAng[k];
			const face = Math.cos(((a - l * 46) * Math.PI) / 180);
			set(ringNodes[k], { transform: `translate(-50%, -50%) translateY(${px(ringY[k])}) rotateY(${a.toFixed(2)}deg) translateZ(${px(ringR)})`, opacity: (0.42 + 0.58 * clamp(face * 0.5 + 0.5)).toFixed(3) });
		}
		const ck = E.snapSettle(prog(l, tRing, 0.4));
		set(core, { opacity: (l > tRing ? 1 : 0).toFixed(0), transform: `scale(${((1 + (1 - ck) * 2.2) * (1 + K.beatKick(l, 7) * 0.12)).toFixed(4)})` });
	};
};

// ---- flip: "Explore [card] history" ---------------------------------------------------------------
sceneFactories.flip = ({ p, cam, fg, accent, palette, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, alpha, mixHex, images, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const words = (s.words ?? []).map(DOUBLE).filter(Boolean).slice(0, 5);
	if (!words.length) words.push("everything");
	const icons = words.map((_, k) => s.icons?.[k] ?? ["✨", "\u{1F680}", "\u{1F3A8}", "⚡", "\u{1F3AC}"][k % 5]);
	// Card faces want colour: the style's tints, or a doodle set when the style has too few.
	let tints = [...new Set([palette.butter, palette.sky, palette.lilac, palette.peach, palette.sage, palette.coral].filter(Boolean))].filter((c) => Math.abs(K.lum(c) - K.lum(palette.paper ?? "#ffffff")) > 0.06 || c.toLowerCase() !== (palette.paper ?? "").toLowerCase());
	if (new Set(tints).size < 3 || tints.every((c) => K.lum(c) > 0.85)) tints = ["#ffd84d", "#8fd3ff", "#c9a7ff", "#ff9f80", "#9be3a5"];
	const fs = D.type("display",8).size;
	const ch = fs * 1.45;
	const cw = ch * 0.82;
	const gap = D.space(3);
	const line = (txt, align) => {
		const n = el("div", "display", cam, txt);
		set(n, { position: "absolute", top: px(H / 2 - fs * 0.55), color: fg, whiteSpace: "nowrap", ...(align === "r" ? { right: px(W / 2 + cw / 2 + gap) } : { left: px(W / 2 + cw / 2 + gap) }) });
		D.apply(n,"display",{step:8});
		return n;
	};
	const leadN = line(DOUBLE(s.lead || "Explore"), "r");
	const wordNs = words.map((w) => line(w, "l"));
	const stacked = leadN.scrollWidth + Math.max(...wordNs.map(n => n.scrollWidth)) + cw + gap * 2 > K.safe.w * 0.94;
	if (stacked) {
		const width = K.safe.w * 0.94;
		for (const node of [leadN, ...wordNs]) {
			set(node, { left: px((W - width) / 2), right: "auto", width: px(width), whiteSpace: "normal", overflowWrap: "anywhere", textAlign: "center" });
			D.fitSize(node, width, H * 0.16, "display", {wrap:"anywhere"});
			set(node, { top: px(node === leadN ? H / 2 - ch / 2 - gap - node.offsetHeight : H / 2 + ch / 2 + gap) });
		}
	}
	const face = (k, parent) => {
		const c = el("div", "", parent);
		const ic = icons[k];
		set(c, { position: "absolute", left: px(-cw / 2), top: px(-ch / 2), width: px(cw), height: px(ch), background: tints[k % tints.length] ?? accent, border: `${px(3.5 * S)} solid ${mixHex(fg, "#000000", 0.2)}`, boxShadow: `${px(5 * S)} ${px(6 * S)} 0 ${alpha(mixHex(fg, "#000000", 0.2), 0.9)}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", backfaceVisibility: "hidden" });
		D.surface(c, "card", { layout: "frame", purpose: "media" });
		D.forSurface(ch/(D.unit*48)).apply(c,"cardTitle");
		if (images?.[ic]) {
			const im = el("img", "", c);
			im.src = images[ic].src ?? ic;
			set(im, { width: "100%", height: "100%", objectFit: "cover" });
		} else c.textContent = ic;
		return c;
	};
	const holder = el("div", "", cam);
	holder.setAttribute("data-over", ""); // The icon cards intentionally overlap in the fan and pinwheel.
	set(holder, { position: "absolute", left: px(W / 2), top: px(H / 2), width: "0", height: "0", perspective: px(900 * S) });
	const cards = words.map((_, k) => {
		const w = el("div", "", holder);
		set(w, { position: "absolute", left: "0", top: "0", transformStyle: "preserve-3d" });
		face(k, w);
		return w;
	});
	// Doodles around the card: outline sparkles and dots that re-pop on every flip.
	const NS = "http://www.w3.org/2000/svg";
	const doodles = [0, 1, 2, 3, 4, 5].map((k) => {
		const a = (k / 6) * Math.PI * 2 + 0.4;
		const rr = ch * (0.78 + hash(k * 2.3) * 0.22);
		const svg = document.createElementNS(NS, "svg");
		const sz = (k % 2 ? 16 : 30) * S * (vertical ? 0.8 : 1);
		svg.setAttribute("viewBox", "-12 -12 24 24");
		svg.style.cssText = `position:absolute;left:${-sz / 2}px;top:${-sz / 2}px;width:${sz}px;height:${sz}px;overflow:visible`;
		const path = document.createElementNS(NS, k % 2 ? "circle" : "path");
		if (k % 2) {
			path.setAttribute("r", "8");
			path.setAttribute("fill", tints[(k + 2) % tints.length] ?? accent);
			path.setAttribute("stroke", mixHex(fg, "#000000", 0.2));
			path.setAttribute("stroke-width", "2");
		} else {
			path.setAttribute("d", "M0 -10 Q1.5 -1.5 10 0 Q1.5 1.5 0 10 Q-1.5 1.5 -10 0 Q-1.5 -1.5 0 -10Z");
			path.setAttribute("fill", "none");
			path.setAttribute("stroke", mixHex(fg, "#000000", 0.2));
			path.setAttribute("stroke-width", "1.8");
			path.setAttribute("stroke-linejoin", "round");
		}
		svg.appendChild(path);
		holder.appendChild(svg);
		return { svg, x: Math.cos(a) * rr * 1.25, y: Math.sin(a) * rr * 0.8, k };
	});
	const n = words.length;
	const gather = s.gather !== false && n >= 3;
	const step = Math.max(0.42, (p.dur * (gather ? 0.58 : 0.86)) / n);
	const swapAt = words.map((_, k) => 0.15 + k * step);
	const tFan = swapAt[n - 1] + Math.max(0.5, step * 0.9);
	const tGather = tFan + 0.7;
	const fanW = Math.min(W * 0.5, n * cw * 0.62);
	return (l, d) => {
		const fan = gather ? E.snapSettle(prog(l, tFan, 0.5)) : 0;
		const gath = gather ? E.softInOut(prog(l, tGather, 0.75)) : 0;
		const leave = gather ? E.accelExit(prog(l, tGather - 0.05, 0.4)) : 0;
		// The lead arrives sliding in, then makes room for the fan, then leaves.
		const inK = E.softLand(prog(l, -0.1, 0.45));
		set(leadN, { transform: `translateX(${px(-(1 - inK) * 60 * S - (stacked ? 0 : fan * fanW * 0.5) - leave * W * 0.4)})`, opacity: (clamp((l + 0.1) / 0.12) * (1 - leave)).toFixed(3), filter: leave > 0.01 ? `blur(${(leave * 14 * S).toFixed(2)}px)` : "none" });
		// The current word: the old one rolls up and out, accelerating; the new one lands from below.
		let cur = 0;
		for (let k = 0; k < n; k++) if (l >= swapAt[k]) cur = k;
		wordNs.forEach((wn, k) => {
			const enter = k === 0 ? E.softLand(prog(l, -0.05, 0.42)) : E.softLand(prog(l, swapAt[k] + 0.08, 0.36));
			const exit = k < n - 1 ? E.accelExit(prog(l, swapAt[k + 1] - 0.04, 0.15)) : 0;
			const on = k === 0 ? 1 : l >= swapAt[k] + 0.08 ? 1 : 0;
			const y = (1 - enter) * fs * 0.85 - exit * fs * 0.9;
			const blur = (1 - enter) * 0.07 + exit * 0.1;
			set(wn, { opacity: (on * clamp(enter * 3) * (1 - exit) * (1 - leave)).toFixed(3), transform: `translate(${px((stacked ? 0 : fan * fanW * 0.5) + leave * W * 0.4)}, ${px(y)})`, filter: blur > 0.003 ? `blur(${(blur * fs).toFixed(2)}px)` : "none" });
		});
		// Cards: one at a time in the gap, flipping on each change; then fanned; then a pinwheel.
		const spin = l * 24 * gath;
		cards.forEach((c, k) => {
			let rotY = 0;
			let vis = 0;
			let pop = 1;
			if (!fan) {
				if (k === cur) {
					const f = k === 0 ? 1 : prog(l, swapAt[k] - 0.04, 0.3);
					rotY = (1 - E.softLand(f)) * -180;
					vis = rotY > -90 ? 1 : 0;
					pop = 1 + Math.sin(f * Math.PI) * 0.08;
					if (k === 0) {
						const a = E.snapSettle(prog(l, 0, 0.5));
						pop = 1 + (1 - a) * 0.8;
						vis = l >= 0 ? 1 : 0;
					}
				} else if (k === cur - 1) {
					const f = prog(l, swapAt[cur] - 0.04, 0.3);
					rotY = E.softLand(f) * 180;
					vis = rotY < 90 ? 1 : 0;
					pop = 1 + Math.sin(f * Math.PI) * 0.08;
				}
				const tilt = (hash(k * 4.4) - 0.5) * 12 + Math.sin(l * 1.6 + k) * 2;
				set(c, { opacity: String(vis), transform: `rotateY(${rotY.toFixed(2)}deg) rotate(${tilt.toFixed(2)}deg) scale(${pop.toFixed(4)})` });
				return;
			}
			// Fan: spread out across the gap, each a frame apart, overlapping like a hand of cards.
			const fk = E.snapSettle(prog(l, tFan + k * 0.035, 0.5));
			const fx = (k - (n - 1) / 2) * (fanW / Math.max(1, n - 1)) * fk;
			const frot = (k - (n - 1) / 2) * 7 * fk + (hash(k * 4.4) - 0.5) * 12 * (1 - fk);
			const fy = Math.abs(k - (n - 1) / 2) * 10 * S * fk;
			// Gather: swing round the centre into a pinwheel mark.
			const pa = (k / n) * 360 + spin;
			const prad = cw * 0.3;
			const px_ = Math.cos(((pa - 90) * Math.PI) / 180) * prad;
			const py_ = Math.sin(((pa - 90) * Math.PI) / 180) * prad;
			const x = fx + (px_ - fx) * gath;
			const y = fy + (py_ - fy) * gath;
			const rot = frot + (pa + 20 - frot) * gath;
			const sc = 1 + gath * 0.35;
			set(c, { opacity: "1", transform: `translate(${px(x)}, ${px(y)}) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(4)})`, zIndex: String(k) });
		});
		for (const dd of doodles) {
			const since = l - swapAt[cur];
			const pk = E.snapSettle(clamp((since - dd.k * 0.03) / 0.35));
			const tw = 1 + Math.sin(l * 4 + dd.k * 2) * 0.08;
			const out = Math.max(fan, leave);
			set(dd.svg, { transform: `translate(${px(dd.x * (1 + out * 0.6))}, ${px(dd.y * (1 + out * 0.6))}) rotate(${(l * 30 + dd.k * 40).toFixed(1)}deg) scale(${((1 + (1 - pk) * 0.9) * tw * (1 - gath)).toFixed(4)})`, opacity: (clamp(pk * 2) * (1 - gath)).toFixed(3) });
		}
	};
};

// ---- pullback: giant typing that pulls back to reveal the product -------------------------------
sceneFactories.pullback = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, alpha, mixHex, lum, makeCursor, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const light = lum(bg) > 0.45;
	const cardBg = light ? "#ffffff" : mixHex(bg, "#ffffff", 0.09);
	const ink = light ? "#151515" : "#f3f3f3";
	const soft = alpha(ink, 0.45);
	const text = DOUBLE(s.text || "Make a launch video for my app");
	const chips = (s.chips ?? []).map(DOUBLE).slice(0, 3);
	const world = el("div", "", cam);
	set(world, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), transformOrigin: "0 0", willChange: "transform" });
	const cw = vertical ? W * 0.88 : W * 0.64;
	const card = el("div", "", world);
	const pad = D.box("card").paddingX;
	const fsz = D.type("body").size;
	set(card, { position: "absolute", left: px((W - cw) / 2), top: "0", width: px(cw), background: cardBg, boxShadow: `0 ${px(30 * S)} ${px(80 * S)} ${alpha("#000000", light ? 0.12 : 0.4)}, 0 0 0 ${px(1.5 * S)} ${alpha(ink, 0.08)}`, color: ink });
	D.surface(card, "card");
	set(card, { display: "flex", flexDirection: "column" });
	const chipRow = el("div", "", card);
	set(chipRow, { display: chips.length ? "flex" : "none", flexWrap:"wrap", minHeight: chips.length ? px(D.control("button").height) : "0" });
	D.surfaceGap(chipRow, 2);
	const dots = [palette.coral, palette.sky, palette.butter, accent].filter(Boolean);
	const chipNs = chips.map((c, k) => {
		const n = el("div", "bold", chipRow);
		set(n, { display: "flex", alignItems: "center", background: alpha(ink, 0.05), border: `${px(1.5 * S)} solid ${alpha(ink, 0.08)}`, color: ink });
		const chipBox = D.surface(n, "badge", { density: "compact" });
		D.apply(n,"label");
		const d = el("div", "", n);
		set(d, { width: px(18 * S), height: px(18 * S), borderRadius: px(5 * S), background: dots[k % dots.length], flex: "none" });
		const label = el("span", "", n, c);
		set(label, { display: "block", maxWidth: px(cw-pad*2-chipBox.paddingX*2-18*S-chipBox.gap-3*S) });
		D.truncateLine(label);label.title = c;
		return n;
	});
	const area = el("div", "", card);
	set(area, { position: "relative", minHeight: px(D.type("body").lineHeight*2) });
	D.apply(area,"body");
	const m = text.match(/@\S+(?:\s\p{Lu}\S*)*/u);
	const mStart = m ? m.index : -1;
	const mEnd = m ? m.index + m[0].length : -1;
	const spans = [...text].map((c, k) => {
		const sp = el("span", "", area, c);
		if (k >= mStart && k < mEnd) set(sp, { color: accent });
		return sp;
	});
	const pill = el("div", "", area);
	set(pill, { position: "absolute", borderRadius: px(D.radius(2)), background: alpha(accent, 0.12), zIndex: "-1", opacity: "0" });
	const caret = el("div", "", area);
	set(caret, { position: "absolute", width: px(3 * S), height: px(fsz * 1.15), background: accent, borderRadius: px(2 * S) });
	const drop = el("div", "", area);
	const opts = m ? [m[0].slice(1), ...(chips.length ? chips : ["Drive", "Docs"])].slice(0, 3) : [];
	set(drop, { position: "absolute", minWidth: px(D.space(9)), background: cardBg, boxShadow: `0 ${px(14 * S)} ${px(40 * S)} ${alpha("#000000", 0.16)}, 0 0 0 ${px(1.5 * S)} ${alpha(ink, 0.08)}`, opacity: "0", transformOrigin: "0 0", zIndex: "3" });
	const dropdownBox = D.surface(drop, "card", { density: "compact" });
	set(drop, { display: "flex", flexDirection: "column" });
	D.apply(drop,"controlLabel");
	const optNs = opts.map((o, k) => {
		const r = el("div", "", drop);
		set(r, { display: "flex", alignItems: "center" });
		const optionBox = D.surface(r, "field", { density: "compact" });
		D.nest(r, drop, { inset: dropdownBox.paddingX });
		const d = el("div", "", r);
		set(d, { width: px(22 * S), height: px(22 * S), borderRadius: "50%", background: k ? dots[k % dots.length] : accent, flex: "none" });
		const label = el("span", "", r, o);
		set(label, { display: "block", maxWidth: px(cw-pad*2-dropdownBox.paddingX*2-optionBox.paddingX*2-22*S-optionBox.gap) });
		D.truncateLine(label);label.title = o;
		return r;
	});
	const bar = el("div", "", card);
	set(bar, { display: "flex", alignItems: "center", gap: px(D.space(2)), color: soft });
	D.surfaceGap(bar, 2);
	D.apply(bar,"controlLabel");
	for (const g of ["+", "◎", "✦"]) {
		const b = el("div", "", bar, g);
		set(b, { width: px(D.control("button").height), height: px(D.control("button").height), borderRadius: "50%", border: `${px(1.5 * S)} solid ${alpha(ink, 0.12)}`, display: "flex", alignItems: "center", justifyContent: "center" });
	}
	el("div", "", bar).style.flex = "1";
	const send = el("div", "", bar, "↑");
	set(send, { width: px(D.control("button").height), height: px(D.control("button").height), borderRadius: "50%", background: accent, color: K.textOn(accent), display: "flex", alignItems: "center", justifyContent: "center" });
	D.apply(send,"button");
	// After send: a thin progress sweep along the bottom of the card.
	const sweep = el("div", "", card);
	set(sweep, { position: "absolute", left: px(pad), right: px(pad), bottom: px(12 * S), height: px(4 * S), borderRadius: px(2 * S), background: accent, transformOrigin: "0 50%", transform: "scaleX(0)" });
	// Measure: every character's place, the card's size.
	const ch = card.offsetHeight;
	const cardTop = (H - ch) / 2;
	set(card, { top: px(cardTop) });
	const cardLeft = (W - cw) / 2;
	const areaX = cardLeft + pad;
	const areaY = cardTop + area.offsetTop;
	const pos = spans.map((sp) => ({ x: areaX + sp.offsetLeft, y: areaY + sp.offsetTop, w: sp.offsetWidth }));
	const lastP = pos[pos.length - 1] ?? { x: areaX, y: areaY, w: 0 };
	const caretAt = (f) => {
		const n = Math.floor(f);
		if (n <= 0) return { x: pos[0]?.x ?? areaX, y: pos[0]?.y ?? areaY };
		if (n >= pos.length) return { x: lastP.x + lastP.w, y: lastP.y };
		const a = pos[n - 1];
		const b = pos[n];
		if (b.y !== a.y) return { x: a.x + a.w, y: a.y };
		const fr = f - n;
		return { x: a.x + a.w + 0 * fr, y: a.y };
	};
	if (m) {
		const a = pos[mStart];
		const b = pos[mEnd - 1];
		set(drop, { left: px(a.x - areaX), top: px(a.y - areaY + fsz * 1.45) });
		if (a.y === b.y) set(pill, { left: px(a.x - areaX - 6 * S), top: px(a.y - areaY - 2 * S), width: px(b.x + b.w - a.x + 12 * S), height: px(fsz * 1.35 + 4 * S) });
	}
	const cursor = makeCursor(cam, 64 * S);
	const Z0 = vertical ? 2.4 : 3.4;
	const t0 = 0.12;
	const typeDur = Math.min(p.dur * 0.5, text.length * 0.05 + (m ? 0.35 : 0));
	const charT = (k) => t0 + (k / text.length) * typeDur + (m && k > mStart ? 0.25 : 0) + (m && k >= mEnd ? 0.1 : 0);
	const tEnd = charT(text.length) + 0.1;
	const tPull = tEnd + 0.25;
	const pullDur = 0.95;
	const tClick = tPull + pullDur + 0.45;
	const sendPos = { x: cardLeft + cw - pad - 28 * S, y: cardTop + ch - pad - 28 * S };
	return (l, d) => {
		// How many characters are typed (continuous, so the camera glides with the caret).
		let typed = 0;
		for (let k = 0; k < text.length; k++) if (l >= charT(k)) typed = k + 1;
		const nextT = typed < text.length ? charT(typed) : Infinity;
		const prevT = typed > 0 ? charT(typed - 1) : t0;
		const frac = typed < text.length && l > t0 ? clamp((l - prevT) / Math.max(0.01, nextT - prevT)) : 0;
		spans.forEach((sp, k) => {
			const e = l - charT(k);
			set(sp, { opacity: e < 0 ? "0" : clamp(e / 0.05).toFixed(3) });
		});
		const c0 = caretAt(typed);
		const c1 = caretAt(Math.min(text.length, typed + 1));
		const cx = c0.y === c1.y ? c0.x + (c1.x - c0.x) * E.softInOut(frac) * 0.6 : c0.x;
		const cy = c0.y;
		set(caret, { left: px(cx - areaX + 2 * S), top: px(cy - areaY + fsz * 0.1), opacity: l < tEnd ? (l > t0 - 0.1 ? "1" : "0") : K.blink(l - tEnd).toFixed(3) });
		// Mention: a dropdown opens on "@", filters as letters arrive, then the name becomes a chip.
		if (m) {
			const open = E.snapSettle(prog(l, charT(mStart) + 0.04, 0.3));
			const close = E.accelExit(prog(l, charT(mEnd - 1) + 0.18, 0.18));
			set(drop, { opacity: (clamp(open * 2) * (1 - close)).toFixed(3), transform: `translateY(${px((1 - open) * 14 * S - close * 8 * S)}) scale(${(0.96 + open * 0.04).toFixed(4)})` });
			const typedM = clamp(typed - mStart - 1, 0, mEnd - mStart - 1);
			optNs.forEach((o, k) => {
				const keep = k === 0 || typedM < 2;
				const hi = k === 0 && typedM >= 1;
				set(o, { opacity: keep ? "1" : "0.25", background: hi ? alpha(accent, 0.12) : "transparent" });
			});
			const pk = E.snapSettle(prog(l, charT(mEnd - 1) + 0.2, 0.35));
			set(pill, { opacity: pk.toFixed(3), transform: `scale(${(1.15 - 0.15 * pk).toFixed(4)})` });
		}
		// Camera: close on the caret while typing, then pull back to the whole card.
		const pull = E.softInOut(prog(l, tPull, pullDur));
		const Zend = vertical ? 1.02 : 1.16;
		const Z = Z0 + (Zend - Z0) * pull;
		const startFx = (pos[0]?.x ?? areaX) + (W * 0.36) / Z0;
		const fxType = Math.max(startFx, cx - (W * 0.1) / Z0);
		const fx = fxType + (W / 2 - fxType) * pull;
		const fy = cy + fsz * 0.7 + (H / 2 - (cy + fsz * 0.7)) * pull;
		const drift = 1 + clamp((l - tPull - pullDur) / 3) * 0.04;
		set(world, { transform: `translate(${px(W / 2 - fx * Z * drift)}, ${px(H / 2 - fy * Z * drift)}) scale(${(Z * drift).toFixed(4)})` });
		// Chips land in the card as it is revealed, a frame apart, from below.
		chipNs.forEach((c, k) => {
			const ck = E.softLand(prog(l, tPull + 0.35 + k * 0.06, 0.4));
			set(c, { opacity: clamp(ck * 2).toFixed(3), transform: `translateY(${px((1 - ck) * 24 * S)})` });
		});
		// The cursor arrives from oversize and clicks send.
		const tx = W / 2 + (sendPos.x - W / 2) * Zend * drift;
		const ty = H / 2 + (sendPos.y - H / 2) * Zend * drift;
		set(sweep, { transform: `scaleX(${E.softInOut(prog(l, tClick + 0.12, 1.3)).toFixed(4)})`, opacity: l > tClick ? "1" : "0" });
		cursor(l, { fx: W * 0.92, fy: H * 1.05, x: tx, y: ty, start: tClick - 0.6, arrive: tClick - 0.05, click: tClick, ringColor: accent });
		const bp = l > tClick ? E.popOver(clamp((l - tClick) / 0.4)) : 1;
		set(send, { transform: `scale(${(l > tClick && l < tClick + 0.08 ? 0.82 : 0.82 + 0.18 * bp).toFixed(4)})` });
	};
};
export {sceneFactories};
export default sceneFactories;
