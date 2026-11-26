// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {accents, media} from '../_shared/reel.mjs';
// ---- stream: pictures pouring past one word along a diagonal ------------------------------------
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
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

