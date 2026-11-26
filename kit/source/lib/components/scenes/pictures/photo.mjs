// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {accents, media} from '../_shared/media.mjs';
// ---- photo: full-bleed picture, captions word by word --------------------------------------------
export const factory = ({ p, cam, root, fg, accent, palette, bg, K }) => {
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
