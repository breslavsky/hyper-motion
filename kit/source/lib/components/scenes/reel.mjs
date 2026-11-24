// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../typing.mjs';
const sceneFactories = {};
const ARROW =
	'<svg viewBox="0 0 24 24" width="55%" height="55%"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" width="78%" height="78%"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>';

/** Colourful accents of the palette that aren't the background. */
const accents = (palette, bg) => [palette.electric, palette.coral, palette.lime, palette.lilac, palette.butter, palette.peach].filter((c) => c && String(c).toLowerCase() !== String(bg).toLowerCase());

/** A picture for a card: the user's image, or a made-up product thumbnail (a gradient with a tiny
 *  app card on it, or a short item word/emoji) so the scene still reads without screenshots. */
const media = (K, parent, img, seed, palette, bg, item) => {
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
const wordsOf = (K, parent, text, accent) => {
	const g = K.glyphText(parent, text);
	for (const w of g.words)
		if (w.accent) {
			w.node.style.color = accent;
			if (K.plan.look?.display?.accent === "serif") w.node.style.fontStyle = "italic";
		}
	return g;
};

// ---- inline: "Inspiration [pictures] everywhere?" --------------------------------------------
sceneFactories.inline = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, riseGlyphs, spring, clamp, prog, expoOut, hash, images } = K;
	const D = K.design;
	const s = p.scene;
	const m = /^(.*?)\[([^\]]*)\](.*)$/.exec(s.text) ?? [null, s.text, "", ""];
	const before = m[1].trim();
	const after = m[3].trim();
	const vertical = H > W * 1.2;
	const stacked = vertical || before.length + after.length > 32;
	const pics = (s.images ?? []).map((u) => images[u]).filter(Boolean);
	const items = s.items ?? (m[2].trim() ? [m[2].trim()] : []);
	const n = Math.max(1, Math.min(6, pics.length || items.length || 4));
	const line = el("div", "bold", cam);
	set(line, { position: "absolute", left: "50%", top: "50%", display: "flex", flexDirection: stacked ? "column" : "row", alignItems: "center", justifyContent: "center", color: fg, whiteSpace: "nowrap", transform: "translate(-50%,-50%)" });
	const a = before ? el("div", "", line) : null;
	const slot = el("div", "", line);
	const b = after ? el("div", "", line) : null;
	const ga = a ? wordsOf(K, a, before, accent) : { glyphs: [] };
	const gb = b ? wordsOf(K, b, after, accent) : { glyphs: [] };
	// Cards are portrait unless the pictures are wide.
	const asp = pics.length ? Math.min(1.45, Math.max(0.72, pics[0].w / pics[0].h)) : 0.8;
	const ch = stacked ? 2.4 : 1.6;
	const cw = ch * asp;
	const open = cw + 0.75;
	const openV = ch + 0.35;
	set(slot, { position: "relative", flex: "none", height: `${stacked ? openV : ch}em`, width: `${stacked ? cw + 0.3 : open}em`, margin: stacked ? "0.12em 0" : "0 0.06em" });
	if (stacked) {
		set(line, { width: px(K.safe.w * 0.94) });
		for (const node of [a, b].filter(Boolean)) set(node, { width: "100%", whiteSpace: "normal", textAlign: "center", flex: "none" });
	}
	D.fitSize(line, K.safe.w * 0.94, K.safe.h * 0.8, "display", { wrap: stacked ? "normal" : "nowrap" });
	const cards = Array.from({ length: n }, (_, i) => {
		const c = el("div", "card", slot);
		c.dataset.designViewport = "moving-media";
		set(c, { position: "absolute", left: "50%", top: "50%", width: `${cw}em`, height: `${ch}em`, marginLeft: `${-cw / 2}em`, marginTop: `${-ch / 2}em`, overflow: "hidden", zIndex: String(i + 1), boxShadow: `0 0.06em 0.22em rgba(0,0,0,0.28)`, border: "0.025em solid rgba(255,255,255,0.9)", });
		D.surface(c, "card", { layout: "frame", purpose: "media" });
		// Media sizes its own details in em of the card's height.
		const inner = el("div", "", c);
		set(inner, { position: "absolute", inset: "0", fontSize: `${ch}em` });
		media(K, inner, pics.length ? pics[i % pics.length] : null, i + p.index * 5, palette, bg, pics.length ? null : items[i % Math.max(1, items.length)]);
		return { c, side: i % 2 ? 1 : -1, r: (hash(i * 4.1 + p.index) - 0.5) * 8 };
	});
	const tOpen = 0.18;
	// With real pictures the scene ends by zooming into the top one until it fills the frame.
	const zoomOut = pics.length > 0;
	const tZ = zoomOut ? p.dur * 0.74 : p.dur;
	const gap = Math.max(0.14, (tZ - 0.45 - tOpen) / n);
	return (l, d) => {
		riseGlyphs(ga.glyphs, l, { at: 0.02, stagger: 0.022, rot: -4 });
		const ko = spring(l - tOpen, 2.2, 0.72);
		if (stacked) set(slot, { height: `${(clamp(ko, 0, 1.08) * openV).toFixed(4)}em`, marginTop: `${(0.04 + 0.12 * clamp(ko)).toFixed(3)}em`, marginBottom: `${(0.04 + 0.12 * clamp(ko)).toFixed(3)}em` });
		else set(slot, { width: `${(clamp(ko, 0, 1.08) * open).toFixed(4)}em`, marginLeft: `${(0.06 + 0.2 * clamp(ko)).toFixed(3)}em`, marginRight: `${(0.06 + 0.2 * clamp(ko)).toFixed(3)}em` });
		riseGlyphs(gb.glyphs, l, { at: tOpen + 0.12, stagger: 0.022, rot: -4 });
		let top = -1;
		cards.forEach((k, i) => {
			const t0 = tOpen + 0.08 + i * gap;
			if (l >= t0) top = i;
		});
		const zk = zoomOut ? K.cubicInOut(prog(l, tZ, d - tZ)) : 0;
		let dx = 0;
		let dy = 0;
		let big = 1;
		if (zk > 0) {
			const fsPx = Number.parseFloat(line.style.fontSize) || 100;
			const cardW = cw * fsPx;
			const cardH = ch * fsPx;
			big = Math.max(W / cardW, H / cardH) * 1.04;
			dx = W / 2 - (W / 2 - line.offsetWidth / 2 + slot.offsetLeft + slot.offsetWidth / 2);
			dy = H / 2 - (H / 2 - line.offsetHeight / 2 + slot.offsetTop + slot.offsetHeight / 2);
		}
		cards.forEach((k, i) => {
			const t0 = tOpen + 0.08 + i * gap;
			const e = l - t0;
			D.surfaceRadius(k.c, { from: "rounded", to: "square", progress: zk > 0 && i === top ? zk : 0 });
			if (zk > 0 && i === top) {
				set(k.c, { opacity: "1", borderWidth: `${(0.025 * (1 - zk)).toFixed(4)}em`, transform: `translate(${px(dx * zk)}, ${px(dy * zk)}) rotate(${(k.r * (1 - zk)).toFixed(3)}deg) scale(${(1 + (big - 1) * zk).toFixed(4)})` });
				return;
			}
			if (e < 0) {
				set(k.c, { opacity: "0", transform: "none", borderWidth: "0.025em" });
				return;
			}
			const sp = spring(e, 2.6, 0.62);
			// Cards above this one, counted smoothly: each new card pushes the fan open as it
			// lands, instead of every card below snapping 5 degrees in one frame.
			let depth = 0;
			for (let j = i + 1; j < cards.length; j++) depth += K.smooth(prog(l, tOpen + 0.08 + j * gap, 0.3));
			const fan = clamp(depth, 0, 3);
			const rot = k.r + (1 - sp) * 14 * k.side + fan * 5 * k.side;
			const x = fan * 0.09 * k.side;
			const sc = (1 + (1 - sp) * 0.28) * (1 - fan * 0.05);
			set(k.c, {
				opacity: (clamp(e / 0.08) * (1 - clamp(depth - 3)) * (1 - zk)).toFixed(3),
				borderWidth: "0.025em",
				transform: `translate(${x.toFixed(4)}em, ${((1 - sp) * -0.35).toFixed(4)}em) rotate(${rot.toFixed(3)}deg) scale(${sc.toFixed(4)})`,
			});
		});
		const settle = expoOut(prog(l, 0, tZ));
		set(line, { transform: `translate(-50%,-50%) scale(${(0.97 + settle * 0.05).toFixed(4)})` });
		for (const g of [a, b]) if (g) set(g, { opacity: (1 - zk).toFixed(3) });
	};
};

// ---- bubbles: the same questions, over and over ------------------------------------------------
sceneFactories.bubbles = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, spring, clamp, prog, expoOut, expoIn, hash, lum, alpha, textOn } = K;
	const D = K.design;
	const s = p.scene;
	const dark = lum(bg) < 0.25;
	const vertical = H > W * 1.2;
	const world = el("div", "", cam);
	set(world, { position: "absolute", inset: "0", perspective: px(1300 * S), perspectiveOrigin: "50% 50%", transformStyle: "preserve-3d" });
	const qs = s.questions;

	const columns = H >= W ? 2 : 3;
	const cellWidth=(K.safe.w-D.space(3)*(columns-1))/columns;
	const pill = (parent, text, role, btnBg) => {
		const n = el("div", "", parent);
		const width=role==="controlLabel"?cellWidth:K.safe.w*.8;
		set(n, { width:px(width),position: "absolute", left: "0", top: "0", display: "flex", alignItems: "center", whiteSpace: "nowrap", color: dark ? "#f2f3f7" : "#15171c", background: dark ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.86)", border: `${px(1.5 * S)} solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.95)"}`, boxShadow: dark ? "none" : `0 ${px(14 * S)} ${px(40 * S)} ${alpha("#1a2340", 0.12)}`, backdropFilter: "blur(10px)" });
		const fieldBox = D.surface(n, "field", { density: "compact", shape: "pill" });
		D.apply(n, role);
		const t = el("span", "", n, text);
		set(t,{flex:"1",minWidth:"0",whiteSpace:"normal"});
		if (role === "controlLabel") D.fitSize(t, width - fieldBox.paddingX * 2 - fieldBox.gap - D.type(role).size * 1.2 - 3 * S, D.type(role).lineHeight * 4, role);
		const btn = el("span", "", n);
		btn.innerHTML = ARROW;
		set(btn, { flex: "none", width: "1.2em", height: "1.2em", borderRadius: "50%", display: "grid", placeItems: "center", background: btnBg, color: textOn(btnBg) });
		return { n, t, btn };
	};
	const measures = qs.map(text => pill(world, text, "controlLabel", accent));
	const rowCapacity = Math.max(1, Math.floor(K.safe.h / (Math.max(...measures.map(p => p.n.offsetHeight)) + D.space(4))));
	for (const p of measures) p.n.remove();
	const N = Math.max(qs.length, Math.min(14, qs.length * 3, rowCapacity * columns));
	// Grid cells in a shuffled order, so pills arrive all over the frame.
	const visibleSlots = Math.max(columns, Math.min(N, rowCapacity * columns));
	const stagger = Math.min(0.16, (p.dur * (s.answer ? 0.34 : 0.5)) / N);
	const SLOTS = Array.from({ length: visibleSlots }, (_, i) => i).sort((a, b) => hash(a * 3.7 + p.index) - hash(b * 3.7 + p.index));
	const P = Array.from({ length: N }, (_, i) => {
		const h = (k) => hash(i * 9.13 + k * 2.71 + p.index * 31.7);
		// Spread over the frame, leaving the middle a little emptier so an answer can land there.
		// A jittered grid, so pills spread over the frame instead of piling up.
		const gc = columns;
		const gr = Math.ceil(visibleSlots / gc);
		const cell = SLOTS[i % visibleSlots];
		let x=K.safe.x+(cell%gc+.5)*(K.safe.w/gc)-W/2;
		let y=K.safe.y+(Math.floor(cell/gc)+.5)*(K.safe.h/gr)-H/2;
		const node = pill(world, qs[i % qs.length], "controlLabel", dark ? "#ffffff" : "#15171c");
		return { ...node, x, y, replacedAt: i + visibleSlots < N ? .05 + (i + visibleSlots) * stagger : Infinity, z: -h(3) * 40 * S - 120 * S, ph: h(4) * 6.28, w: node.n.offsetWidth, hh: node.n.offsetHeight };
	});
	const tA = s.answer ? p.dur * 0.58 : 1e9;
	let ans = null;
	if (s.answer) {
		ans = pill(cam, "", "caption", accent);
		set(ans.n, { left: "50%", top: "50%", zIndex: "50", boxShadow: `0 ${px(30 * S)} ${px(80 * S)} ${alpha(accent, 0.35)}`, background: dark ? "#ffffff" : "rgba(255,255,255,0.97)", color: "#111318" });
		ans.full = s.answer;
		const caret = el("span", "", ans.t);
		set(caret, { display: "inline-block", width: "0", height: "1em", verticalAlign: "-0.12em", borderLeft: "0.06em solid " + accent, marginLeft: "0" });
		ans.caret = caret;
		ans.typing = createTyping(K, ans.t, { text: s.answer, caret, id: "bubbles-answer" });
		ans.typing.measure();
	}
	return (l, d) => {
		const away = s.answer ? expoIn(prog(l, tA - 0.1, 0.55)) : 0;
		for (const [i, q] of P.entries()) {
			const t0 = 0.05 + i * stagger;
			const e = l - t0;
			const k = spring(e, 2.4, 0.6);
			const z = q.z + Math.min(l*12*S,60*S) + away*600*S;
			const fly = 1 + away * 0.9;
			const y = q.y + Math.sin(l * 0.9 + q.ph) * 10 * S;
			set(q.n, {
				opacity: (clamp(e / 0.12) * (1 - expoIn(prog(l, q.replacedAt - .12, .12))) * (1 - away) * clamp(1 + z / (1400 * S))).toFixed(3),
				zIndex: String(Math.round(z / 10) + 200),
				transform: `translate3d(${px(W / 2 + q.x * fly - q.w / 2)}, ${px(H / 2 + y * fly - q.hh / 2)}, ${px(z)}) scale(${(0.7 + 0.3 * k).toFixed(4)})`,
			});
		}
		if (ans) {
			const e = l - tA;
			const k = spring(e, 2.5, 0.6);
			const n = Math.floor(clamp((e - 0.2) / 0.7) * ans.full.length);
			ans.typing.reveal(n);
			const typing = e > 0.2 && n < ans.full.length;
			set(ans.caret, { opacity: typing ? "1" : K.blink(l).toFixed(3) });
			const sent = expoOut(prog(l, tA + 1.05, 0.3));
			set(ans.btn, { transform: `scale(${(1 + 0.25 * Math.sin(sent * Math.PI)).toFixed(3)})` });
			// Once it is alone on screen it floats and keeps pushing in, so the hold never freezes.
			const push = 1 + 0.14 * clamp((l - tA) / Math.max(0.5, d - tA));
			const fl = clamp(e / 0.6);
			set(ans.n, { opacity: clamp(e / 0.12).toFixed(3), transform: `translate(-50%,-50%) translateY(${px(Math.sin(l * 1.5) * 9 * S * fl)}) rotate(${(Math.sin(l * 1.1) * 0.8 * fl).toFixed(3)}deg) scale(${((0.6 + 0.4 * k) * push).toFixed(4)})` });
		}
	};
};

// ---- retype: a value selected and typed over ---------------------------------------------------
sceneFactories.retype = ({ p, cam, fg, accent, palette, K }) => {
	const { W, H, S, el, set, px, spring, clamp, prog, expoOut, alpha } = K;
	const D = K.design;
	const s = p.scene;
	const seq = [s.from, ...s.to];
	const blue = palette.electric ?? "#2f6bff";
	const wrap = el("div", "center", cam);
	let label = null;
	if (s.label) {
		label = el("div", "mono", wrap, s.label);
		set(label, { color: fg, opacity: "0.8", marginBottom: px(D.space(3)), maxWidth: px(K.safe.w * .9) });
		D.apply(label, "label");
		D.truncateLine(label);label.title = s.label;
	}
	const big = el("div", "", wrap);
	set(big, { color: fg, fontFeatureSettings: '"tnum" 1', whiteSpace: "nowrap", position: "relative", display: "grid", paddingRight: "0.12em" });
	const values = seq.map((text, i) => {
		const layer = el("div", "", big);
		set(layer, { gridArea: "1 / 1", whiteSpace: "pre", opacity: "0", textAlign: "left" });
		return createTyping(K, layer, { text, id: `retype-value-${i}` });
	});
	D.fitLine(big, W * (H > W * 1.2 ? 0.74 : 0.7), H * (s.label ? 0.3 : 0.38), "hero");
	// All complete variants share one measured grid footprint. The widest
	// rendered value determines the field, independently of character count.
	set(big, { width: px(big.offsetWidth), height: px(big.offsetHeight), boxSizing: "border-box", textAlign: "left" });
	for (const value of values) {
		value.measure();
		for (const part of value.parts) set(part.node, { position: "relative" });
	}
	// Selection and caret are drawn over the text, so both can move continuously.
	const sel = el("div", "", big);
	set(sel, { position: "absolute", top: "0.08em", height: "0.96em", background: alpha(blue, 0.28), borderRadius: "0.04em", pointerEvents: "none" });
	// The selected word, kept for a few frames after the first new key so it fades out with its
	// highlight instead of vanishing in one frame.
	const ghost = el("div", "", big);
	set(ghost, { position: "absolute", left: "0", top: "0", whiteSpace: "pre", pointerEvents: "none", transformOrigin: "0 50%" });
	const ghostSel = el("div", "", ghost);
	set(ghostSel, { position: "absolute", left: "0", right: "0", top: "0.08em", height: "0.96em", background: alpha(blue, 0.28), borderRadius: "0.04em" });
	const ghostTxt = el("span", "", ghost);
	const caret = el("div", "", big);
	set(caret, { position: "absolute", top: "0.14em", width: "0.04em", height: "0.8em", background: blue, borderRadius: "0.02em" });
	const fsPx = Number.parseFloat(big.style.fontSize) || 100;
	const CH = 0.06;
	// Plan the edits: type the first value, then for each next value select it all and type over.
	const steps = [];
	let t = 0.08;
	steps.push({ kind: "type", text: seq[0], index: 0, at: t, dur: seq[0].length * CH });
	t += seq[0].length * CH;
	const room = Math.max(0.6, p.dur * 0.96 - t);
	const per = room / Math.max(1, s.to.length);
	for (let i = 1; i < seq.length; i++) {
		const at = t + per * 0.12;
		steps.push({ kind: "select", from: seq[i - 1], index: i - 1, at, dur: 0.28 });
		steps.push({ kind: "type", text: seq[i], index: i, at: at + 0.42, dur: seq[i].length * CH, n: i, prev: seq[i - 1] });
		t += per;
	}
	const txt = (n, v) => {
		if (n.textContent !== v) n.textContent = v;
	};
	return (l, d) => {
		let valueIndex = 0;
		let completed = 0;
		let partK = 0;
		let selN = 0;
		let typing = false;
		let pop = 0;
		let gone = null;
		let goneK = 1;
		let idleFrom = 0;
		for (const st of steps) {
			if (l < st.at) break;
			valueIndex = st.index;
			const k = clamp((l - st.at) / st.dur);
			if (st.kind === "type") {
				const n = k * st.text.length;
				completed = Math.floor(n);
				partK = n - Math.floor(n);
				selN = 0;
				typing = k < 1;
				idleFrom = st.at + st.dur;
				if (st.prev) {
					gone = st.prev;
					goneK = clamp((l - st.at) / 0.1);
				}
				if (k >= 1 && st.n) pop = Math.max(pop, 1 - expoOut(prog(l, st.at + st.dur, 0.5)));
			} else {
				completed = st.from.length;
				partK = 0;
				// Shift-selects from the end back to the start, sweeping smoothly.
				selN = expoOut(k);
				typing = false;
				gone = null;
			}
		}
		const value = values[valueIndex];
		const hasFresh = typing && partK > 0;
		const shownCount = completed + (hasFresh ? 1 : 0);
		for (const [i, candidate] of values.entries()) {
			set(candidate.host, { opacity: i === valueIndex ? "1" : "0" });
			candidate.reveal(i === valueIndex ? shownCount : 0, { fresh: hasFresh ? clamp(partK * 1.6) : 1 });
			for (const part of candidate.parts) set(part.node, { top: "0" });
		}
		if (hasFresh) {
			const part = value.parts.find(part => part.end === shownCount);
			if (part) set(part.node, { top: `${((1 - partK) * 0.12).toFixed(4)}em` });
		}
		const textW = value.caretAt(completed).x;
		const nextX = value.caretAt(shownCount).x;
		const grow = hasFresh ? K.cubicInOut(clamp(partK * 1.4)) : 1;
		const end = textW + (nextX - textW) * grow;
		if (selN > 0) set(sel, { display: "block", left: px(textW * (1 - selN)), width: px(textW * selN) });
		else set(sel, { display: "none" });
		const caretX = selN > 0 ? textW * (1 - selN) : end;
		set(caret, { left: px(caretX + fsPx * 0.05), opacity: typing || selN > 0 ? "1" : K.blink(l - idleFrom).toFixed(3) });
		if (gone && goneK < 1) {
			txt(ghostTxt, gone);
			set(ghost, { display: "block", opacity: (1 - goneK).toFixed(3), transform: `translateY(${(-0.08 * goneK).toFixed(4)}em) scale(${(1 - 0.04 * goneK).toFixed(4)})` });
		} else set(ghost, { display: "none" });
		const intro = spring(l, 2.6, 0.7);
		// A slow, constant grow and sway under the edits, so the pauses between them never freeze.
		set(big, { transform: `translate(${(Math.sin(l * 0.9) * 0.03).toFixed(4)}em, ${(Math.sin(l * 1.6) * 0.035).toFixed(4)}em) rotate(${(Math.sin(l * 0.7) * 0.6).toFixed(3)}deg) scale(${((1 + pop * 0.06) * (0.94 + 0.14 * (l / d))).toFixed(4)})` });
		if (label) set(label, { opacity: (0.8 * clamp(l / 0.25)).toFixed(3), transform: `translateY(${px((1 - intro) * 14 * S)})` });
	};
};

// ---- orbit: a sentence inside line-art orbits ---------------------------------------------------
sceneFactories.orbit = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, quartOut, alpha, hash } = K;
	const D = K.design;
	const s = p.scene;
	const NS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("width", String(W));
	svg.setAttribute("height", String(H));
	svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
	set(svg, { position: "absolute", left: "0", top: "0", overflow: "visible" });
	cam.appendChild(svg);
	const R = Math.min(W, H);
	const rings = [0, 1, 2].map((i) => {
		const e = document.createElementNS(NS, "ellipse");
		e.setAttribute("fill", "none");
		e.setAttribute("stroke", alpha(fg, 0.32 - i * 0.06));
		e.setAttribute("stroke-width", String(1.6 * S));
		e.setAttribute("pathLength", "1");
		e.setAttribute("stroke-dasharray", "1");
		svg.appendChild(e);
		const dots = [0, 1].map((j) => {
			const c = document.createElementNS(NS, "circle");
			c.setAttribute("r", String((j ? 3.5 : 5.5) * S));
			c.setAttribute("fill", j ? alpha(fg, 0.75) : accent);
			svg.appendChild(c);
			return { c, ph: hash(i * 3 + j * 7 + p.index) * 6.28, sp: (0.35 + hash(i + j * 2) * 0.35) * (j ? -1 : 1) };
		});
		return { e, dots, rx: R * (0.52 + i * 0.2) * (W > H ? 1.05 : 0.8), tilt: -18 + i * 28, ph: i * 1.9 + p.index, sp: 0.22 + i * 0.07 };
	});
	const wrap = el("div", "center", cam);
	const line = el("div", "display", wrap);
	set(line, { color: fg });
	const { words } = wordsOf(K, line, s.text, accent);
	D.fitSize(line, W * (H > W * 1.2 ? 0.84 : 0.62), H * .36, "display");
	const step = Math.min(p.beatLen * 0.5, (p.dur * 0.5) / Math.max(1, words.length));
	return (l) => {
		for (const [i, r] of rings.entries()) {
			const draw = quartOut(clamp((l + 0.15 - i * 0.1) / 1.1));
			const squash = 0.16 + 0.42 * Math.abs(Math.sin(l * r.sp + r.ph));
			const ry = r.rx * squash;
			const ang = r.tilt + l * 4 * (i % 2 ? -1 : 1);
			r.e.setAttribute("cx", String(W / 2));
			r.e.setAttribute("cy", String(H / 2));
			r.e.setAttribute("rx", r.rx.toFixed(1));
			r.e.setAttribute("ry", ry.toFixed(1));
			r.e.setAttribute("transform", `rotate(${ang.toFixed(3)} ${W / 2} ${H / 2})`);
			r.e.setAttribute("stroke-dashoffset", (1 - draw).toFixed(4));
			const a = (ang * Math.PI) / 180;
			for (const dt of r.dots) {
				const th = dt.ph + l * dt.sp * 2;
				const x0 = Math.cos(th) * r.rx;
				const y0 = Math.sin(th) * ry;
				dt.c.setAttribute("cx", (W / 2 + x0 * Math.cos(a) - y0 * Math.sin(a)).toFixed(1));
				dt.c.setAttribute("cy", (H / 2 + x0 * Math.sin(a) + y0 * Math.cos(a)).toFixed(1));
				dt.c.setAttribute("opacity", (draw * (0.55 + 0.45 * Math.sin(th) ** 2)).toFixed(3));
			}
		}
		words.forEach((w, i) => {
			const t0 = 0.04 + i * step;
			const k = expoOut(prog(l, t0, 0.7));
			set(w.node, { display: "inline-block", opacity: k.toFixed(3), transform: `translateY(${((1 - k) * 0.25).toFixed(4)}em)`, filter: k < 0.99 ? `blur(${((1 - k) * 0.12).toFixed(4)}em)` : "none" });
		});
	};
};

// ---- checklist: the cursor ticks each item -------------------------------------------------------
sceneFactories.checklist = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, spring, alpha, textOn, makeCursor, lerp } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const n = s.items.length;
	const column = W * 0.86;
	const probe = el("div", "", cam);
	set(probe, {position:"absolute",visibility:"hidden",whiteSpace:"nowrap"});
	const widthAt = (text, spec) => {
		D.apply(probe,spec.role,{step:spec.step});probe.textContent=text;
		return probe.offsetWidth;
	};
	const itemSpec = D.steps("caption").find(spec => Math.max(...s.items.map(t=>widthAt(t,spec)+spec.size*1.05*1.45)) <= column);
	let titleHeight = 0;
	const titleSpec = D.steps("sceneTitle").find(spec => {
		D.apply(probe, "sceneTitle", { step: spec.step });
		set(probe, { width: px(column), whiteSpace: "normal" });
		probe.textContent = s.title || "";
		titleHeight = probe.offsetHeight;
		return titleHeight <= H * 0.24;
	});
	set(probe, { width: "auto", whiteSpace: "nowrap" });
	if(!itemSpec || !titleSpec)throw new Error("Checklist copy exceeds semantic column capacity");
	const fs=itemSpec.size,titleFs=titleSpec.size;
	const rowH = fs * 2.1;
	let widest = Math.max(...s.items.map((t) => widthAt(t, itemSpec) + fs * 1.05 * 1.45), s.title ? Math.min(column, widthAt(s.title, titleSpec)) : 0);
	probe.remove();
	const blockH = (s.title ? titleHeight + D.space(4) : 0) + n * rowH;
	const top = (H - blockH) / 2;
	const left = Math.max(W * 0.06, (W - widest) / 2);
	let title = null, titleTyping = null;
	if (s.title) {
		title = el("div", "bold", cam);
		set(title, { position: "absolute", left: px(left), top: px(top), width: px(column), color: fg, whiteSpace: "normal" });
		D.apply(title,"sceneTitle",{step:titleSpec.step});
		titleTyping = createTyping(K, title, { text: s.title, id: "checklist-title" });
		titleTyping.measure();
	}
	const y0 = top + (s.title ? titleHeight + D.space(4) : 0);
	const box = fs * 1.05;
	const rows = s.items.map((text, i) => {
		const y = y0 + i * rowH;
		const b = el("div", "", cam);
		set(b, { position: "absolute", left: px(left), top: px(y + (rowH - box) / 2 - rowH * 0.15), width: px(box), height: px(box), boxSizing: "border-box", borderRadius: px(D.radius(2)), border: `${px(3 * S)} solid ${alpha(fg, 0.45)}`, display: "grid", placeItems: "center", color: textOn(accent) });
		b.innerHTML = CHECK;
		const path = b.querySelector("path");
		const t = el("div", "", cam);
		set(t, { position: "absolute", left: px(left + box * 1.45), top: px(y + (rowH - fs * 1.2) / 2 - rowH * 0.15), color: fg, whiteSpace: "nowrap" });
		D.apply(t,"caption",{step:itemSpec.step});
		const tx = el("span", "", t);
		const strike = el("div", "", t);
		set(strike, { position: "absolute", left: "0", top: "54%", height: px(3.5 * S), background: fg, transformOrigin: "0 50%", width: "100%" });
		tx.textContent = text;
		const tw = t.offsetWidth;
		set(tx, { display: "inline-block" });
		const typing = createTyping(K, tx, { text, id: `checklist-item-${i}` });
		typing.measure();
		return { b, path, t, typing, strike, text, tw, cx: left + box / 2, cy: y + rowH / 2 - rowH * 0.15 };
	});
	const cur = makeCursor(cam, 78 * S);
	const tick0 = Math.max(0.7, p.dur * 0.24);
	const tickGap = Math.max(0.3, (p.dur * 0.97 - tick0) / n);
	const ticks = rows.map((_, i) => tick0 + i * tickGap);
	return (l) => {
		if (title) {
			const k = Math.floor(clamp((l + 0.08) / 0.45) * s.title.length);
			titleTyping.reveal(k);
		}
		rows.forEach((r, i) => {
			const ta = 0.02 + i * 0.09;
			const k = expoOut(prog(l, ta, 0.5));
			const shownN = Math.floor(clamp((l - ta) / (0.018 * r.text.length + 0.1)) * r.text.length);
			r.typing.reveal(shownN);
			// The tick fills over a few frames and the box dips and springs back, rather than
			// switching colour and size in one frame.
			const fill = clamp((l - ticks[i]) / 0.08);
			const dip = Math.sin(Math.PI * clamp((l - ticks[i]) / 0.26));
			const intro = 0.7 + 0.3 * spring(l - ta, 3, 0.55);
			set(r.b, { opacity: k.toFixed(3), background: fill > 0 ? alpha(accent, fill) : "transparent", borderColor: fill > 0.5 ? accent : alpha(fg, 0.45), transform: `scale(${(intro * (1 - 0.16 * dip)).toFixed(4)})` });
			r.path.setAttribute("stroke-dashoffset", (1 - expoOut(prog(l, ticks[i] + 0.04, 0.35))).toFixed(4));
			const sk = expoOut(prog(l, ticks[i] + 0.1, 0.45));
			set(r.strike, { transform: `scaleX(${sk.toFixed(4)})`, opacity: (0.55 * clamp(sk * 6)).toFixed(3) });
			set(r.t, { opacity: (1 - 0.5 * sk).toFixed(3) });
		});
		// The list floats a little, so the gaps between ticks are never frozen.
		const fy = Math.sin(l * 1.7) * 7 * S;
		for (const r of rows) {
			r.b.style.translate = `0 ${px(fy)}`;
			r.t.style.translate = `0 ${px(fy)}`;
		}
		if (title) title.style.translate = `0 ${px(fy)}`;
		// Cursor hops from box to box.
		let k = ticks.findIndex((t) => l < t + 0.05);
		if (k < 0) k = n - 1;
		const target = rows[k];
		const prev = k > 0 ? rows[k - 1] : { cx: W * 0.85, cy: H * 0.9 };
		cur(l, { fx: prev.cx, fy: prev.cy, x: target.cx, y: target.cy, start: k > 0 ? ticks[k - 1] + 0.12 : tick0 - 0.75, arrive: ticks[k] - 0.08, click: ticks[k], ringColor: accent });
	};
};

// ---- tiles: letters on cards tumbling into a word ----------------------------------------------
sceneFactories.tiles = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, spring, clamp, hash, mixHex, textOn, beatKick } = K;
	const D = K.design;
	const s = p.scene;
	const chars = [...s.text];
	const n = chars.length;
	const vertical = H > W * 1.2;
	const tileColumns = H >= W && n > 8 ? Math.ceil(n / 2) : n;
	const tileRows = Math.ceil(n / tileColumns);
	const size = Math.min((W * (vertical ? 0.92 : 0.84)) / (tileColumns * 1.04), H * 0.3);
	const row = el("div", "", cam);
	set(row, { position: "absolute", inset: "0", perspective: px(1600 * S) });
	const total = tileColumns * size * 1.04;
	const totalHeight = tileRows * size + (tileRows - 1) * D.space(2);
	const cols = [accent, accent, mixHex(accent, "#ffffff", 0.12), mixHex(accent, "#000000", 0.06)];
	const tiles = chars.map((ch, i) => {
		const t = el("div", "", row);
		const c = cols[Math.floor(hash(i * 5.3 + p.index) * cols.length)];
		set(t, { position: "absolute", left: px(W / 2 - total / 2 + (i % tileColumns) * size * 1.04), top: px((H - totalHeight) / 2 + Math.floor(i / tileColumns) * (size + D.space(2))), width: px(size), height: px(size), borderRadius: px(size * 0.12), background: c, color: textOn(accent), display: ch.trim() ? "grid" : "none", placeItems: "center", boxShadow: `0 ${px(size * 0.05)} 0 ${mixHex(c, "#000000", 0.28)}, 0 ${px(size * 0.16)} ${px(size * 0.3)} rgba(0,0,0,0.22)` });
		D.forSurface(size / (D.unit * 48)).apply(t,"cardTitle");
		t.textContent = ch;
		return { t, r: (hash(i * 2.9 + p.index) - 0.5) * 10, y0: -(0.75 + hash(i * 3.3) * 0.4) * H, spin: (hash(i * 7.1) - 0.5) * 120, flip: 40 + hash(i * 1.1) * 60, at: -0.12 + i * Math.min(0.08, 0.6 / n) + hash(i * 8.8) * 0.06 };
	});
	const start = p.start ?? 0;
	return (l) => {
		const landed = tiles[tiles.length - 1].at + 0.6;
		const kick = l > landed ? (beatKick ? beatKick(start + l) : 0) : 0;
		tiles.forEach((k, i) => {
			const e = l - k.at;
			const sp = spring(e, 2.2, 0.48);
			const hop = kick * (i % 2 ? 0.09 : 0.05) * size;
			// Once down they keep a gentle wave, like tiles on a moving table.
			const live = clamp((e - 0.5) / 0.6);
			const wave = Math.sin(l * 2.6 - i * 0.7) * live;
			set(k.t, {
				opacity: e > 0 ? "1" : "0",
				transform: `translateY(${px((1 - sp) * k.y0 - hop + wave * size * 0.08)}) rotateX(${((1 - sp) * k.flip).toFixed(3)}deg) rotate(${(k.r + (1 - sp) * k.spin + wave * 4.5).toFixed(3)}deg)`,
			});
		});
	};
};

// ---- mosaic: a grid of panels with crosshairs and one word over it ------------------------------
sceneFactories.mosaic = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, spring, hash, images, mockUI, alpha } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const cols = vertical ? 2 : 3;
	const rowsN = vertical ? 3 : 2;
	const g = 6 * S;
	const pw = (W - g * (cols + 1)) / cols;
	const ph = (H - g * (rowsN + 1)) / rowsN;
	const pics = (s.images ?? []).map((u) => images[u]).filter(Boolean);
	const panels = [];
	const order = [4, 0, 2, 5, 1, 3];
	for (let r = 0; r < rowsN; r++)
		for (let c = 0; c < cols; c++) {
			const i = r * cols + c;
			const pn = el("div", "", cam);
			set(pn, { position: "absolute", left: px(g + c * (pw + g)), top: px(g + r * (ph + g)), width: px(pw), height: px(ph), overflow: "hidden", fontSize: px(Math.min(pw, ph)) });
			D.surface(pn, "card", { density: "compact", layout: "frame", purpose: "media" });
			const inner = el("div", "", pn);
			set(inner, { position: "absolute", inset: "0", fontSize: px(Math.min(pw, ph)) });
			if (pics.length) media(K, inner, pics[i % pics.length], i, palette, bg);
			else if (i % 2 === 1) {
				// The product itself in every other panel.
				media(K, inner, null, i + p.index * 3, palette, bg, null);
				inner.innerHTML = "";
				const box = el("div", "", inner);
				set(box, { position: "absolute", left: "9%", top: "12%", width: "92%", height: "96%", overflow: "hidden", boxShadow: `0 ${px(20 * S)} ${px(50 * S)} rgba(0,0,0,0.25)`, background: "#fff" });
				D.surface(box, "card", { layout: "frame", purpose: "window" });
				mockUI(box, palette, accent, i, ["dashboard", "inbox", "chat"][i % 3]);
			} else media(K, inner, null, i + p.index * 3, palette, bg, null);
			panels.push({ pn, inner, at: 0.04 + order.indexOf(i % 6) * 0.07, dir: i % 4 });
		}
	const shade = el("div", "", cam);
	set(shade, { position: "absolute", inset: "0", background: "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(0,0,0,0.38), transparent 75%)" });
	const plus = [];
	for (let r = 1; r < rowsN; r++)
		for (let c = 1; c < cols; c++) {
			const x = c * (pw + g) + g / 2;
			const y = r * (ph + g) + g / 2;
			const pl = el("div", "", cam);
			const a = 22 * S;
			set(pl, { position: "absolute", left: px(x - a), top: px(y - a), width: px(a * 2), height: px(a * 2), background: `linear-gradient(#fff,#fff) center/100% ${px(2.5 * S)} no-repeat, linear-gradient(#fff,#fff) center/${px(2.5 * S)} 100% no-repeat` });
			plus.push(pl);
		}
	const wrap = el("div", "center", cam);
	const word = el("div", "", wrap, s.text.replace(/\*/g, ""));
	set(word, { color: "#ffffff", textShadow: `0 ${px(6 * S)} ${px(50 * S)} rgba(0,0,0,0.45)`, whiteSpace: "nowrap" });
	D.fitSize(word, K.safe.w * 0.9, H * 0.34, "hero", { align: "center" });
	word.textContent = "";
	const { glyphs } = K.glyphText(word, s.text.replace(/\*/g, ""));
	// A measured backing protects white headline ink over arbitrary screenshots.
	// It is outside the text layout, so fitting and the original anchor stay exact.
	const captionPlate = el("div", "", wrap);
	const scrimBox = D.box("badge", { density: "comfortable" });
	captionPlate.dataset.designMaterial = "headline-scrim";
	set(captionPlate, { position: "absolute", left: px(word.offsetLeft - scrimBox.paddingX), top: px(word.offsetTop - scrimBox.paddingY), width: px(word.offsetWidth + scrimBox.paddingX * 2), height: px(word.offsetHeight + scrimBox.paddingY * 2), background: "rgba(0,0,0,0.74)", opacity: "0", pointerEvents: "none", zIndex: "1" });
	D.surface(captionPlate, "badge", { density: "comfortable", layout: "absolute" });
	D.surfaceContent(captionPlate, word);
	set(word, { position: "relative", zIndex: "2" });
	// Labels occupy two reserved bands around the headline, never its line box.
	const noteBands = [0, 1].map((i) => {
		const band = el("div", "", cam);
		set(band, { position: "absolute", left: px(K.safe.x), width: px(K.safe.w), ...(i ? { bottom: px(H - K.safe.y - K.safe.h + D.space(4)) } : { top: px(K.safe.y + D.space(4)) }), display: "flex", flexWrap: "wrap", justifyContent: "center", gap: px(D.space(2)), zIndex: "3" });
		return band;
	});
	const notes = (s.notes ?? []).map((t, i) => {
		const nd = el("div", "", noteBands[i % noteBands.length]);
		set(nd, { maxWidth: px(K.safe.w), background: "rgba(255,255,255,0.88)", color: "#111318", whiteSpace: "normal", boxShadow: `0 ${px(14 * S)} ${px(40 * S)} rgba(0,0,0,0.22)`, display: "flex", alignItems: "center" });
		const noteBox = D.surface(nd, "badge", { shape: "pill" });
		D.apply(nd,"label");
		const dot = el("span", "", nd);
		set(dot, { width: px(12 * S), height: px(12 * S), borderRadius: "50%", background: accent, flex: "none" });
		const label = el("span", "", nd, t);
		set(label, { display: "block", maxWidth: px(K.safe.w - noteBox.paddingX * 2 - 12 * S - noteBox.gap) });
		D.truncateLine(label);label.title = t;
		return nd;
	});
	const noteAreas = [
		{ top: K.safe.y, bottom: word.offsetTop - D.space(3) },
		{ top: word.offsetTop + word.offsetHeight + D.space(3), bottom: K.safe.y + K.safe.h },
	];
	for (const [i, band] of noteBands.entries()) {
		const area = noteAreas[i];
		if (band.offsetHeight > area.bottom - area.top) {
			for (const note of band.children) D.surface(note, "badge", { density: "compact", shape: "pill" });
		}
		if (band.offsetHeight > area.bottom - area.top) throw new Error("Mosaic notes exceed their reserved headline bands");
		set(band, { top: px(clamp(band.offsetTop, area.top, area.bottom - band.offsetHeight)), bottom: "auto" });
	}
	return (l, d) => {
		for (const k of panels) {
			const e = expoOut(prog(l, k.at, 0.6));
			const ins = ((1 - e) * 100).toFixed(2);
			const clip = [`inset(0 0 ${ins}% 0)`, `inset(0 ${ins}% 0 0)`, `inset(${ins}% 0 0 0)`, `inset(0 0 0 ${ins}%)`][k.dir];
			set(k.pn, { clipPath: clip });
			set(k.inner, { transform: `scale(${(1.25 - 0.17 * e - 0.04 * (l / d)).toFixed(4)})` });
		}
		const pk = expoOut(prog(l, 0.45, 0.5));
		for (const pl of plus) set(pl, { opacity: pk.toFixed(3), transform: `scale(${pk.toFixed(4)}) rotate(${((1 - pk) * 90).toFixed(2)}deg)` });
		set(shade, { opacity: expoOut(prog(l, 0.4, 0.6)).toFixed(3) });
		set(captionPlate, { opacity: expoOut(prog(l, .5, .3)).toFixed(3) });
		glyphs.forEach((gl, i) => {
			const k = expoOut(prog(l, 0.55 + i * 0.035, 0.7));
			set(gl.node, { display: "inline-block", opacity: k.toFixed(3), transform: `translateY(${((1 - k) * 0.2).toFixed(4)}em)`, filter: k < 0.99 ? `blur(${((1 - k) * 0.1).toFixed(4)}em)` : "none" });
		});
		notes.forEach((nd, i) => {
			const k = spring(l - (0.8 + i * 0.25), 2.6, 0.6);
			set(nd, { opacity: clamp((l - 0.8 - i * 0.25) / 0.1).toFixed(3), transform: `translateY(${px((1 - k) * 30 * S)}) scale(${(0.8 + 0.2 * k).toFixed(4)})` });
		});
	};
};

// ---- photo: full-bleed picture, captions word by word --------------------------------------------
sceneFactories.photo = ({ p, cam, root, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, spring, expoOut, images, hash } = K;
	const D = K.design;
	const s = p.scene;
	const img = s.image ? images[s.image] : null;
	const vertical = H > W * 1.2;
	const frame = el("div", "", cam);
	set(frame, { position: "absolute", inset: "0", overflow: "hidden", fontSize: px(Math.min(W, H)) });
	const pic = el("div", "", frame);
	set(pic, { position: "absolute", inset: "0" });
	media(K, pic, img, p.index * 2 + 1, palette, bg, null);
	if (!img) pic.innerHTML = "";
	const shade = el("div", "", frame);
	set(shade, { position: "absolute", inset: "0", background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.42) 100%)" });
	// Chunks of up to three words, breaking after punctuation, shown one after another.
	const tokens = [];
	let acc = false;
	for (const raw of String(s.text).split(/(\*)/)) {
		if (raw === "*") {
			acc = !acc;
			continue;
		}
		for (const w of raw.split(/\s+/)) if (w) tokens.push({ w, acc });
	}
	const chunks = [];
	let cur = [];
	for (const t of tokens) {
		cur.push(t);
		if (cur.length >= 3 || /[.,!?;:…]$/.test(t.w)) {
			chunks.push(cur);
			cur = [];
		}
	}
	if (cur.length) chunks.push(cur);
	const fs = (vertical ? 70 : 66) * S;
	const nodes = chunks.map((ch) => {
		const c = el("div", "", cam);
		set(c, { position: "absolute", left: px(K.safe.x + K.safe.w * 0.05), width: px(K.safe.w * 0.9), top: px(H * (vertical ? 0.6 : 0.64)), textAlign: "center", color: "#ffffff", textShadow: `0 ${px(3 * S)} ${px(18 * S)} rgba(0,0,0,0.55)`, whiteSpace: "normal" });
		D.apply(c,"sceneTitle");
		const ws = ch.map((t, i) => {
			if (i) c.appendChild(document.createTextNode(" "));
			const w = el("span", "", c, t.w);
			set(w, { display: "inline-block", ...(t.acc ? { fontStyle: "italic", color: "#ffffff" } : {}) });
			return w;
		});
		return { c, ws };
	});
	D.fitGroup(nodes.map(n => n.c), { role: "sceneTitle", w: K.safe.w * 0.9, h: H * 0.24 });
	const per = (p.dur * 0.94) / Math.max(1, chunks.length);
	const drift = (hash(p.index * 3.3) - 0.5) * 0.06;
	return (l, d) => {
		const u = l / d;
		set(pic, { transform: `scale(${(1.14 - 0.1 * u).toFixed(4)}) translateX(${(drift * u * 100).toFixed(3)}%)` });
		nodes.forEach((nd, i) => {
			const t0 = 0.08 + i * per;
			const on = l >= t0 && (l < t0 + per || i === nodes.length - 1);
			set(nd.c, { opacity: on ? "1" : "0" });
			nd.ws.forEach((w, j) => {
				const k = spring(l - t0 - j * 0.07, 3.6, 0.55);
				set(w, { opacity: clamp((l - t0 - j * 0.07) / 0.05).toFixed(3), transform: `scale(${(0.82 + 0.18 * k).toFixed(4)})` });
			});
		});
	};
};
// ---- stream: pictures pouring past one word along a diagonal ------------------------------------
sceneFactories.stream = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, hash, images } = K;
	const D = K.design;
	const s = p.scene;
	const pics = (s.images ?? []).map((u) => images[u]).filter(Boolean);
	const items = s.items ?? [];
	const vertical = H > W * 1.2;
	const N = 18;
	const base = Math.min(W, H) * (vertical ? 0.2 : 0.17);
	const cards = Array.from({ length: N }, (_, i) => {
		const c = el("div", "card", cam);
		c.dataset.designViewport = "moving-media";
		const asp = pics.length ? Math.min(1.3, Math.max(0.7, pics[i % pics.length].w / pics[i % pics.length].h)) : 0.8 + hash(i * 1.7) * 0.25;
		const h = base * (0.75 + hash(i * 3.3 + p.index) * 0.5);
		const w = h * asp;
		set(c, { position: "absolute", left: "0", top: "0", width: px(w), height: px(h), overflow: "hidden", boxShadow: `0 ${px(14 * S)} ${px(34 * S)} rgba(0,0,0,0.18)`, border: `${px(3 * S)} solid #fff`, willChange: "transform" });
		D.surface(c, "card", { layout: "frame", purpose: "media" });
		const inner = el("div", "", c);
		set(inner, { position: "absolute", inset: "0", fontSize: px(h) });
		media(K, inner, pics.length ? pics[i % pics.length] : null, i + p.index * 7, palette, bg, pics.length ? null : items[i % Math.max(1, items.length)]);
		// Each card rides its own lane either side of the diagonal, at its own phase.
		return { c, w, h, lane: (hash(i * 5.9 + p.index) - 0.5) * 2, ph: i / N + hash(i * 2.2) * 0.04, rot: (hash(i * 8.1) - 0.5) * 16 };
	});
	const wrap = el("div", "center", cam);
	const word = el("div", "bold", wrap, s.text.replace(/\*/g, ""));
	set(word, { color: "#111318", position: "relative", zIndex: "30", background: "rgba(255,255,255,0.9)", boxShadow: `0 ${px(18 * S)} ${px(50 * S)} rgba(0,0,0,0.18)`, backdropFilter: "blur(12px)" });
	D.surface(word, "badge", { density: "comfortable", shape: "pill" });
	D.fitSize(word, K.safe.w * .8, H * .24, "cardTitle", { align: "center" });
	// The path: from beyond the bottom-left corner to beyond the top-right, with a gentle S.
	const path = (u, lane) => {
		const x = -0.25 * W + u * 1.5 * W;
		const y = (vertical ? 1.15 : 1.2) * H - u * (vertical ? 1.3 : 1.4) * H + Math.sin(u * Math.PI * 2) * H * 0.08;
		// Lanes spread perpendicular to the travel direction, widest in the middle.
		const spread = (0.18 + 0.12 * Math.sin(u * Math.PI)) * Math.min(W, H);
		return { x: x + lane * spread * 0.6, y: y + lane * spread * 0.8 };
	};
	const speed = 0.16;
	return (l, d) => {
		const intro = expoOut(prog(l, 0, 0.8));
		for (const k of cards) {
			const u = (k.ph + l * speed) % 1;
			const q = path(u, k.lane);
			const mid = 1 - Math.abs(u - 0.5) * 2;
			const sc = (0.75 + 0.45 * mid) * (0.6 + 0.4 * intro);
			// Fast past the middle: a little directional blur on the cards (not the scene root).
			const blur = (1 - mid) * 1.6 * S;
			set(k.c, { zIndex: String(Math.round(mid * 10)), opacity: clamp(Math.min(u, 1 - u) * 12).toFixed(3), filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : "none", transform: `translate(${px(q.x - k.w / 2)}, ${px(q.y - k.h / 2)}) rotate(${(k.rot * (1 - mid * 0.6)).toFixed(2)}deg) scale(${sc.toFixed(4)})` });
		}
		const wk = expoOut(prog(l, 0.15, 0.6));
		set(word, { opacity: wk.toFixed(3), transform: `translateY(${((1 - wk) * 0.3).toFixed(3)}em)` });
	};
};

// ---- roll: "You're still answering [tickets / emails / chats / DMs]" ------------------------------
// The last word rolls vertically like a slot machine, the words either side soft and faded, with
// blue selection handles round the one in focus. The line stays centred as the word's width changes.
sceneFactories.roll = ({ p, cam, fg, accent, palette, K }) => {
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
	const t0 = 0.45;
	const per = Math.max(0.3, (p.dur * 0.9 - t0) / Math.max(1, n - 1));
	return (l) => {
		riseGlyphs(lg, l, { at: 0.02, stagger: 0.03, rot: -4 });
		// Position along the list: eased steps from word to word.
		let pos = 0;
		for (let i = 1; i < n; i++) pos += K.cubicInOut(clamp((l - t0 - (i - 1) * per) / (per * 0.55)));
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
		for (const h of [hl, hr]) set(h, { opacity: (settle * clamp((l - t0 + 0.2) / 0.2)).toFixed(3) });
		const intro = spring(l, 2.4, 0.7);
		set(line, { transform: `translate(-50%,-50%) translateX(${px((1 - intro) * 40 * S)})` });
	};
};
export {sceneFactories};
export default sceneFactories;
