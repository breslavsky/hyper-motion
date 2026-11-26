// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE} from '../_shared/hands.mjs';
// ---- pack: circles crowd round one word -------------------------------------------------------------------
// Circles of every size pop in from oversize and pack the frame round a word in the biggest one, the
// palette's colours with the ink; they breathe, then scatter outward. Seen in ab_works' "Pulse It".
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, textOn, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const word = DOUBLE(s.word || "Everything");
	const cols = [accent, palette.ink ?? "#111111", palette.sky, palette.butter, palette.coral, palette.lilac].filter(Boolean);
	// Greedy circle packing, seeded so the same scene always packs the same way.
	const R0 = Math.min(W, H) * (vertical ? 0.3 : 0.27);
	const circles = [{ x: W / 2, y: H / 2, r: R0, main: true }];
	let tries = 0;
	while (circles.length < 90 && tries < 4000) {
		tries++;
		const x = hash(tries * 1.31) * W;
		const y = hash(tries * 2.77) * H;
		let r = Math.min(W, H) * (0.02 + hash(tries * 3.9) * 0.12);
		for (const c of circles) {
			const d = Math.hypot(c.x - x, c.y - y) - c.r - 6 * S;
			if (d < r) r = d;
		}
		if (r > Math.min(W, H) * 0.018) circles.push({ x, y, r, main: false });
	}
	const nodes = circles.map((c, i) => {
		const n = el("div", "", cam);
		const col = c.main ? accent : cols[1 + Math.floor(hash(i * 5.3) * (cols.length - 1))];
		set(n, { position: "absolute", left: px(c.x - c.r), top: px(c.y - c.r), width: px(c.r * 2), height: px(c.r * 2), borderRadius: "50%", background: col, willChange: "transform", zIndex: c.main ? "5" : "1" });
		const dist = Math.hypot(c.x - W / 2, c.y - H / 2);
		return { n, c, dist };
	});
	const maxD = Math.hypot(W, H) / 2;
	const label = el("div", "display", cam, word);
	const fs = R0 * 0.42;
	set(label, { position: "absolute", left: px(W / 2 - R0), width: px(R0 * 2), top: px(H / 2 - fs * 0.55), textAlign: "center", color: textOn(accent), zIndex: "6", whiteSpace: "nowrap" });
	D.apply(label,"display");
	D.fitSize(label, R0 * 1.7, R0 * 1.3, "display", { align: "center" });
	const tOut = Math.max(1.6, d0 - 0.45);
	return (l) => {
		nodes.forEach(({ n, c, dist }, i) => {
			const at = c.main ? 0 : 0.12 + (dist / maxD) * 0.55 + hash(i) * 0.1;
			const a = E.softLand(prog(l, at, 0.4));
			const breathe = 1 + Math.sin(l * 2.4 + i) * 0.025 * clamp((l - at - 0.4) / 0.4);
			const out = c.main ? 0 : E.accelExit(prog(l, tOut + (1 - dist / maxD) * 0.1, 0.4));
			const dx = (c.x - W / 2) * out * 0.9;
			const dy = (c.y - H / 2) * out * 0.9;
			set(n, { opacity: clamp(a * 3).toFixed(3), transform: `translate(${px(dx)}, ${px(dy)}) scale(${((1.35 - 0.35 * a) * breathe).toFixed(4)})` });
		});
		const la = E.softLand(prog(l, 0.15, 0.45));
		set(label, { opacity: clamp(la * 2).toFixed(3), transform: `translateY(${px((1 - la) * 24 * S)})` });
	};
};

