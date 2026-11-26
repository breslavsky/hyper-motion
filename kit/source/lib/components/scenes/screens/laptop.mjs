// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export const factory = ({ p, cam, fg, accent, palette, K }) => {
	const { W, H, S, el, set, px, spring, clamp, expoInOut, prog, images, mockUI, lerp } = K;
	const s = p.scene;
	const D=K.design;
	const img = s.image ? images[s.image] : null;
	const vertical = H > W * 1.2;
	const sw = vertical ? W * 0.84 : W * (s.caption ? 0.48 : 0.56);
	const sh = sw * 0.625;
	let top = H * (s.caption ? (vertical ? 0.3 : 0.27) : 0.18);
	const lid = el("div", "", cam);
	set(lid, { position: "absolute", left: px((W - sw) / 2 - sw * 0.03), top: px(top), width: px(sw * 1.06), height: px(sh * 1.08), borderRadius: px(sw * 0.03), background: "#1b1c1f", boxShadow: `0 0 0 ${px(2 * S)} #3a3b40 inset` });
	// Hardware proportions define a local design unit; the product UI keeps its own.
	const device=D.forSurface(sw*.03/(16*D.unit));
	device.surface(lid,"card",{layout:"frame",purpose:"device"});
	const screen = el("div", "card", lid);
	set(screen, { left: px(sw * 0.03), top: px(sh * 0.04), width: px(sw), height: px(sh) });
	D.forSurface(sw*.008/(12*D.unit)).surface(screen,"card",{density:"compact",layout:"frame",purpose:"media"});
	if (img) {
		const im = el("img", "fill", screen);
		im.src = img.src;
	} else mockUI(screen, palette, accent, p.index);
	const baseW = sw * 1.32;
	const baseEl = el("div", "", cam);
	set(baseEl, { position: "absolute", left: px((W - baseW) / 2), top: px(top + sh * 1.08), width: px(baseW), height: px(sw * 0.035), background: "linear-gradient(#c9cbd1, #9a9ca3)", borderRadius: `0 0 ${px(sw * 0.04)} ${px(sw * 0.04)}`, boxShadow: `0 ${px(30 * S)} ${px(60 * S)} rgba(0,0,0,0.25)` });
	let cap = null;
	if (s.caption) {
		cap = el("div", "display", cam, s.caption);
		set(cap, { position: "absolute", left: "0", right: "0", top: px(K.safe.y+D.space(3)), textAlign: "center", color: fg, margin: "0 auto" });
		D.fitSize(cap, W * 0.84, K.safe.h*.4, "sceneTitle");
		top=Math.max(top,K.safe.y+D.space(3)+cap.offsetHeight+D.space(4));
		set(lid,{top:px(top)});set(baseEl,{top:px(top+sh*1.08)});
	}
	const scx = W / 2;
	const scy = top + sh * 0.04 + sh / 2;
	const zMax = Math.min(W / sw, H / sh) * 1.02;
	return (l) => {
		const e = spring(l, 2, 0.75);
		const dive = expoInOut(prog(l, p.dur * 0.5, p.dur * 0.45));
		// A slow constant push under the settle and the dive, so the wait between them moves.
		const z = lerp(0.8 + 0.2 * e, zMax, dive) * (1 + 0.05 * clamp(l / p.dur) * (1 - dive));
		const cx = lerp(W / 2, scx, dive);
		const cy = lerp(H / 2, scy, dive);
		set(cam, { transform: `translate(${px(W / 2 - cx * z)}, ${px(H / 2 - cy * z)}) scale(${z.toFixed(4)})` });
		set(lid, { opacity: clamp(l / 0.1).toFixed(3) });
		if (cap) set(cap, { opacity: (clamp(l / 0.2) * (1 - dive)).toFixed(3) });
	};
};

