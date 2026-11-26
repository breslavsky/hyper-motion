// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
// ---- tab chaos ------------------------------------------------------------------------------
export const factory = ({ p, cam, fg, palette, K }) => {
	const { W, H, S, el, set, px, spring, clamp, hash, images, alpha, expoOut, prog } = K;
	const s = p.scene;
	const D=K.design;
	const imgs = (s.images ?? []).map((u) => images[u]).filter(Boolean);
	const n = 14;
	const cols = [palette.electric, palette.coral, palette.lime, palette.peach, palette.sage, palette.butter];
	const wins = Array.from({ length: n }, (_, i) => {
		const w = (0.16 + hash(i * 2.1) * 0.1) * W;
		const h = w * 0.66;
		const local=D.forSurface(w/(320*D.unit));
		const ang = (i / n) * Math.PI * 2 + hash(i) * 0.6;
		const rad = 0.3 + hash(i * 4.4) * 0.16;
		const x = W / 2 + Math.cos(ang) * W * rad - w / 2;
		const y = H / 2 + Math.sin(ang) * H * (rad + 0.08) - h / 2;
		const c = el("div", "card", cam);
		set(c, { left: px(x), top: px(y), width: px(w), height: px(h), boxShadow: `0 ${px(20 * S)} ${px(50 * S)} rgba(0,0,0,0.18)`, background: "#fff" });
		local.surface(c,"card",{density:"compact",layout:"frame",purpose:"window"});
		const bar = el("div", "", c);
		set(bar, { height: px(h * 0.12), background: "#eceae6", display: "flex", alignItems: "center", gap: px(local.space(1)), padding: `0 ${px(local.space(2))}` });
		for (const d of ["#ff5f57", "#febc2e", "#28c840"]) {
			const dd = el("div", "", bar);
			set(dd, { width: px(8 * S), height: px(8 * S), borderRadius: "50%", background: d });
		}
		const img = imgs.length ? imgs[i % imgs.length] : null;
		if (img) {
			const im = el("img", "fill", c);
			im.src = img.src;
			set(im, { height: "88%" });
		} else {
			const body = el("div", "", c);
			set(body, { display: "grid", gridTemplateColumns: "1fr 1fr" });
			local.surface(body,"card",{density:"compact",shape:"square"});
			for (let j = 0; j < 4; j++) {
				const b = el("div", "", body);
				set(b, { height: px(h * 0.28), borderRadius: px(local.radius(3)), background: j === 0 ? cols[i % cols.length] : alpha("#000000", 0.07) });
			}
		}
		return { c,x,y,w,h, at: 0.1 + (i / n) * p.dur * 0.6, rot: (hash(i * 9.9) - 0.5) * 24, dx: Math.cos(ang), dy: Math.sin(ang) };
	});
	const text = el("div", "bold", cam, s.text);
	set(text, { position: "absolute", left: "0", right: "0", textAlign: "center", color: fg, zIndex: "5", margin: "0 auto" });
	D.fitSize(text, K.safe.w*.92, K.safe.h*.4, "sceneTitle");
	const th = text.offsetHeight;
	// White windows must not sit behind the headline's white ink. Reserve its
	// measured central band, including the windows' rotated corner extents.
	const bandTop=H/2-th/2-D.space(3),bandBottom=H/2+th/2+D.space(3);
	for(const win of wins){
		const angle=Math.abs(win.rot)*Math.PI/180;
		const halfHeight=(win.h*Math.cos(angle)+win.w*Math.sin(angle))/2;
		const center=win.y+win.h/2;
		if(center+halfHeight>bandTop&&center-halfHeight<bandBottom){
			const target=center<H/2?bandTop-halfHeight:bandBottom+halfHeight;
			set(win.c,{top:px(target-win.h/2)});
		}
	}
	return (l) => {
		for (const w of wins) {
			const k = spring(l - w.at, 2.6, 0.6);
			const on = l >= w.at;
			set(w.c, { opacity: on ? clamp((l - w.at) / 0.06).toFixed(3) : "0", transform: `translate(${px((1 - k) * w.dx * W * 0.5)}, ${px((1 - k) * w.dy * H * 0.5)}) rotate(${(w.rot * (0.4 + 0.6 * k)).toFixed(2)}deg) scale(${(0.6 + 0.4 * k).toFixed(4)})` });
		}
		const tk = expoOut(prog(l, 0.02, 0.5));
		set(text, { top: px(H / 2 - th / 2), opacity: tk.toFixed(3), transform: `scale(${(0.9 + 0.1 * tk).toFixed(4)})` });
	};
};

