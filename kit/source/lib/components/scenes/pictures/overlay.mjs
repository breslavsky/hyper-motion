// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {focus} from '../_shared/focus.mjs';
// ---- overlay: glass cards with rolling numbers over a photo ------------------------------------
export const factory = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, smooth, images, alpha } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const img = s.image ? images[s.image] : null;
	const back = el("div", "", cam);
	set(back, { position: "absolute", inset: "0", overflow: "hidden", background: `linear-gradient(135deg, ${accent}, ${alpha(accent, 0.5)})` });
	let photo = null;
	if (img) {
		photo = el("img", "fill", back);
		photo.src = img.src;
		set(photo, { objectFit: "cover", width: "100%", height: "100%", transformOrigin: "60% 40%" });
	}
	const shade = el("div", "", back);
	set(shade, { position: "absolute", inset: "0", background: "linear-gradient(180deg, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.45) 100%)" });
	let cap = null;
	if (s.text) {
		cap = el("div", "bold", cam, s.text.replace(/\*/g, ""));
		// The caption stands in the foot of the safe area, not of the frame.
		set(cap, { position: "absolute", left: px(Math.max(W * 0.06, K.safe.x)), bottom: px(H - K.safe.y - K.safe.h + H * 0.02), color: "#ffffff", whiteSpace: "nowrap", textShadow: "0 2px 30px rgba(0,0,0,0.35)" });
		D.fitSize(cap, K.safe.w * 0.9, H * 0.2, "caption");
	}
	const cardsIn = (s.cards ?? []).slice(0, 3);
	const spots = vertical ? [[0.06, 0.12], [0.38, 0.34], [0.08, 0.56]] : [[0.06, 0.1], [0.62, 0.28], [0.26, 0.5]];
	const cards = cardsIn.map((c, i) => {
		const box = el("div", "", cam);
		box.dataset.designMaterial = "dark-glass";
		let cw = vertical ? W * 0.56 : W * 0.3;
		set(box, { position: "absolute", left: px(W * spots[i][0]), top: px(H * spots[i][1]), width: px(cw), background: "rgba(9,16,24,0.78)", border: `${px(1.5 * S)} solid rgba(255,255,255,0.18)`, backdropFilter: "blur(18px) saturate(1.5)", boxShadow: `0 ${px(24 * S)} ${px(60 * S)} rgba(0,0,0,0.25)`, color: "#ffffff" });
		const surface = D.surface(box, "card", { density: "compact" });
		set(box, { display: "flex", flexDirection: "column" });
		const lab = el("div", "", box, c.label ?? "");
		set(lab, { opacity: "0.9", marginBottom: "0" });
		D.apply(lab, "label");
		const val = el("div", "display", box);
		set(val, { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" });
		const v = Number(c.value) || 0;
		const dec = (String(c.value).split(".")[1] ?? "").length;
		const tmpl = Math.abs(v) >= 1000 ? Math.round(Math.abs(v)).toLocaleString("en-US") : Math.abs(v).toFixed(dec);
		// Reserve the complete odometer footprint, including its edge-mask
		// padding, at the smallest metric token before choosing a card width.
		// The first update caches digit advances, so fit before calling roll.
		D.apply(val, "metric", { step: D.steps("metric").at(-1).step });
		if (c.prefix) el("span", "", val, c.prefix);
		const roll = K.odometer(el("span", "", val), tmpl);
		if (c.suffix) el("span", "", val, c.suffix);
		set(val, { display: "inline-block" });
		const inset = 2 * surface.paddingX + 3 * S;
		cw = Math.min(K.safe.w, Math.max(cw, Math.ceil(val.scrollWidth + inset + 1)));
		set(box, { width: px(cw), left: px(clamp(W * spots[i][0], K.safe.x, K.safe.x + K.safe.w - cw)) });
		set(val, { display: "block" });
		set(lab, { display: "block", maxWidth: px(cw-inset) });
		D.fitLine(val, cw - inset, D.type("metric").lineHeight, "metric");
		D.truncateLine(lab);lab.title = c.label ?? "";
		return { box, lab, val, roll, v, at: p.at.cards[i], settle: p.at.settle[i], side: i % 2 ? 1 : -1 };
	});
	// Keep measured glass surfaces clear of each other and of the full caption.
	// A long caption can rise above the old fixed third-card position.
	const gap = D.space(3), ceiling = K.safe.y;
	let floor = cap ? cap.offsetTop - gap : K.safe.y + K.safe.h;
	let heights = cards.map(c => c.box.offsetHeight);
	if (heights.reduce((sum, h) => sum + h, 0) + Math.max(0, cards.length - 1) * gap > floor - ceiling) {
		// Dense copy gets one full-width column and the compact token recipe.
		const innerWidth = K.safe.w - 2 * D.box("card", { density: "compact" }).paddingX - 3 * S;
		for (const c of cards) {
			// Keep the compact card padding intact. Wide rows place the label and
			// value side by side instead of squeezing their vertical breathing room.
			set(c.box, { left: px(K.safe.x), width: px(K.safe.w), flexDirection: "row", alignItems: "center" });
			D.apply(c.val, "metric", { step: D.steps("metric").at(-1).step });
			set(c.val, { flex: "none", width: "max-content", maxWidth: "none" });
			// Measure the odometer after its final font is chosen, including mask edges.
			c.roll(c.v);
			const valueWidth = Math.ceil(c.val.scrollWidth);
			set(c.val, { width: px(valueWidth) });
			const labelWidth = innerWidth - valueWidth - D.box("card", { density: "compact" }).gap;
			set(c.lab, { flex: "1", minWidth: "0", width: px(labelWidth) });
			set(c.lab, { maxWidth: px(labelWidth) });
		}
		heights = cards.map(c => c.box.offsetHeight);
		if (cap) {
			D.apply(cap, "caption", { step: D.steps("caption").at(-1).step });
			floor = cap.offsetTop - gap;
		}
	}
	if (heights.reduce((sum, h) => sum + h, 0) + Math.max(0, cards.length - 1) * gap > floor - ceiling) {
		throw new Error("Overlay cards exceed the available area above the caption");
	}
	const tops = [];
	for (let i = 0; i < cards.length; i++) tops[i] = Math.max(ceiling, H * spots[i][1], i ? tops[i - 1] + heights[i - 1] + gap : ceiling);
	let bottom = floor;
	for (let i = cards.length - 1; i >= 0; i--) {
		tops[i] = Math.min(tops[i], bottom - heights[i]);
		set(cards[i].box, { top: px(tops[i]) });
		bottom = tops[i] - gap;
	}
	return (l, d) => {
		const u = clamp(l / d);
		if (photo) set(photo, { transform: `scale(${(1.08 + 0.1 * u).toFixed(4)}) translate(${px(-u * 30 * S)}, ${px(u * 12 * S)})` });
		for (const c of cards) {
			const k = expoOut(prog(l, c.at, 0.8));
			const bob = Math.sin(l * 1.3 + c.at * 5) * 6 * S;
			set(c.box, { opacity: smooth((l - c.at) / 0.25).toFixed(3), filter: k > 0.995 ? "none" : `blur(${((1 - k) * 14 * S).toFixed(2)}px)`, transform: `perspective(${px(1600 * S)}) translateY(${px((1 - k) * 60 * S + bob)}) rotateY(${(c.side * (8 - 5 * k)).toFixed(3)}deg) scale(${(0.9 + 0.1 * k).toFixed(4)})` });
			// The number has all but come to rest on its moment, 1.05 s into its roll.
			c.roll(c.v * expoOut(prog(l, c.settle - 1.05, 1.2)));
		}
		if (cap) {
			const k = expoOut(prog(l, 0.15, 0.7));
			set(cap, { opacity: smooth(l / 0.3).toFixed(3), filter: focus(k, 0.25), transform: `translateY(${((1 - k) * 0.4).toFixed(4)}em)` });
		}
	};
};
