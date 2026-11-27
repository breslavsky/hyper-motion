// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {accents, media, wordsOf} from '../_shared/media.mjs';
// ---- inline: "Inspiration [pictures] everywhere?" --------------------------------------------
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
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
	const tZ = zoomOut ? p.at.zoom : p.dur;
	// When each picture lands in the gap.
	const pops = p.at.pops;
	return (l, d) => {
		riseGlyphs(ga.glyphs, l, { at: 0.02, stagger: 0.022, rot: -4 });
		const ko = spring(l - tOpen, 2.2, 0.72);
		if (stacked) set(slot, { height: `${(clamp(ko, 0, 1.08) * openV).toFixed(4)}em`, marginTop: `${(0.04 + 0.12 * clamp(ko)).toFixed(3)}em`, marginBottom: `${(0.04 + 0.12 * clamp(ko)).toFixed(3)}em` });
		else set(slot, { width: `${(clamp(ko, 0, 1.08) * open).toFixed(4)}em`, marginLeft: `${(0.06 + 0.2 * clamp(ko)).toFixed(3)}em`, marginRight: `${(0.06 + 0.2 * clamp(ko)).toFixed(3)}em` });
		riseGlyphs(gb.glyphs, l, { at: tOpen + 0.12, stagger: 0.022, rot: -4 });
		let top = -1;
		cards.forEach((k, i) => {
			const t0 = pops[i];
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
			const t0 = pops[i];
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
			for (let j = i + 1; j < cards.length; j++) depth += K.smooth(prog(l, pops[j], 0.3));
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

