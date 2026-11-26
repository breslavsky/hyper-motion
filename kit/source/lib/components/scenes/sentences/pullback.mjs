// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE} from '../_shared/studio.mjs';
// ---- pullback: giant typing that pulls back to reveal the product -------------------------------
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
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

