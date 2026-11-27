// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
// ---- swarm: a cloud of pictures in depth, then the line -----------------------------------------------------
// Dozens of pictures hang in 3D at every depth, turning slowly as the camera pushes through them;
// then they fly out past the lens and the line lands in the clearing. Seen in ab_works' "Pulse It".
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, mixHex, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const pics = (s.images ?? []).map((u) => K.images[u]).filter(Boolean);
	const text = String(s.text || "");
	const N = 40;
	const view = el("div", "", cam);
	set(view, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), perspective: px(900 * S), overflow: "hidden" });
	const world = el("div", "", view);
	set(world, { position: "absolute", left: px(W / 2), top: px(H / 2), width: "0", height: "0", transformStyle: "preserve-3d", willChange: "transform" });
	const cw = Math.min(W, H) * 0.3;
	const cols = [palette.coral, palette.sky, palette.butter, palette.lilac, palette.lime, accent].filter(Boolean);
	const cards = Array.from({ length: N }, (_, i) => {
		const c = el("div", "", world);
		const asp = 0.7 + hash(i * 2.2) * 0.6;
		set(c, { position: "absolute", left: px(-cw / 2), top: px((-cw * asp) / 2), width: px(cw), height: px(cw * asp), overflow: "hidden", boxShadow: `0 ${px(10 * S)} ${px(30 * S)} rgba(0,0,0,0.35)`, backfaceVisibility: "hidden" });
		D.surface(c, "card", { layout: "frame", purpose: "media" });
		const pic = pics.length ? pics[i % pics.length] : null;
		if (pic) {
			const im = el("img", "fill", c);
			im.src = pic.src;
			set(im, { width: "100%", height: "100%", objectFit: "cover" });
		} else {
			const a = cols[i % cols.length];
			set(c, { background: `linear-gradient(${hash(i) * 360}deg, ${mixHex(a, "#ffffff", 0.25)}, ${mixHex(a, "#000000", 0.35)})` });
		}
		return { c, x: (hash(i * 3.1) - 0.5) * W * 1.6, y: (hash(i * 4.7) - 0.5) * H * 1.5, z: -hash(i * 5.9) * 1700 * S, ry: (hash(i * 6.3) - 0.5) * 70, rz: (hash(i * 7.1) - 0.5) * 30 };
	});
	let cap = null;
	let capWords = [];
	if (text) {
		cap = el("div", "display", cam);
		set(cap, { position: "absolute", left: px(W * 0.08), width: px(W * 0.84), top: "50%", transform: "translateY(-50%)", textAlign: "center", color: fg });
		D.apply(cap,"display");
		capWords = text.split(/\s+/).filter(Boolean).map((w, j) => {
			if (j) cap.appendChild(document.createTextNode(" "));
			const em = /^\*.*\*[.,!?]?$/.test(w);
			const sp = el("span", "", cap, w.replace(/\*/g, ""));
			set(sp, { display: "inline-block", color: em ? accent : fg });
			if (em && K.plan?.look?.display?.accent === "serif") sp.style.fontStyle = "italic";
			return sp;
		});
	}
	if (cap) D.fitSize(cap, K.safe.w * 0.92, K.safe.h * 0.7, "display");
	const tOut = text ? p.at.out : d0 + 1;
	return (l) => {
		const push = E.cruise(l / d0) * 900 * S;
		const out = E.accelExit(prog(l, tOut, 0.55));
		set(world, { transform: `translateZ(${(push + out * 2400 * S).toFixed(1)}px) rotateY(${(Math.sin(l * 0.4) * 6).toFixed(2)}deg)` });
		cards.forEach((C, i) => {
			const a = E.softLand(prog(l, hash(i * 9.1) * 0.5, 0.6));
			const spin = l * (hash(i * 1.9) - 0.5) * 20;
			const spread = 1 + out * 0.8;
			set(C.c, { opacity: clamp(a * 2).toFixed(3), transform: `translate3d(${px(C.x * spread)}, ${px(C.y * spread)}, ${(C.z - (1 - a) * 600 * S).toFixed(1)}px) rotateY(${(C.ry + spin).toFixed(2)}deg) rotateZ(${C.rz.toFixed(2)}deg)` });
		});
		capWords.forEach((w, j) => {
			const k = E.softLand(prog(l, p.at.hit - 0.05 + j * 0.06, 0.5));
			set(w, { opacity: clamp(k * 2).toFixed(3), transform: `translateY(${px((1 - k) * 40 * S)}) scale(${(1.15 - 0.15 * k).toFixed(4)})` });
		});
	};
};

