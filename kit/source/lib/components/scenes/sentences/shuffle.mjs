// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {focus} from '../_shared/focus.mjs';
// ---- shuffle: a sentence breaks apart and its words fly to form the next one -------------------
export const factory = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, smooth, hash, alpha } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const A = String(s.from).trim().split(/\s+/);
	const B = String(s.to).trim().split(/\s+/);
	// Line-art orbits behind the words.
	const orbits = [0, 1, 2].map((i) => {
		const o = el("div", "", cam);
		const w = W * (0.5 + i * 0.16);
		const h = H * (0.32 + i * 0.12);
		set(o, { position: "absolute", left: px((W - w) / 2), top: px((H - h) / 2), width: px(w), height: px(h), borderRadius: "50%", border: `${px(1.6 * S)} solid ${alpha(fg, 0.16 - i * 0.03)}` });
		return o;
	});
	// Lay both sentences out (hidden) at one size to find every word's place.
	const textSpec = D.type("display", 8), fsz = textSpec.size;
	const probe = (words) => {
		const box = el("div", "bold", cam);
		set(box, { position: "absolute", left: px(W * 0.07), top: "0", width: px(W * 0.86), display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `0 ${px(D.space(3))}`, visibility: "hidden" });
		D.apply(box, "display", {step:textSpec.step});
		const spans = words.map((w) => el("span", "", box, w.replace(/\*/g, "")));
		const h = box.offsetHeight;
		const out = spans.map((sp) => ({ x: sp.offsetLeft + W * 0.07, y: sp.offsetTop + (H - h) / 2, w: sp.offsetWidth }));
		box.remove();
		return out;
	};
	const pa = probe(A);
	const pb = probe(B);
	const used = new Set();
	const pieces = [];
	A.forEach((w, i) => {
		const key = w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
		const j = B.findIndex((v, jj) => !used.has(jj) && v.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase() === key);
		if (j >= 0) used.add(j);
		pieces.push({ text: w, from: pa[i], to: j >= 0 ? pb[j] : null, toText: j >= 0 ? B[j] : null, i });
	});
	B.forEach((w, j) => {
		if (!used.has(j)) pieces.push({ text: w, from: null, to: pb[j], toText: w, i: A.length + j });
	});
	const nodes = pieces.map((q) => {
		const n = el("div", "bold", cam, (q.from ? q.text : q.toText).replace(/\*/g, ""));
		set(n, { position: "absolute", left: "0", top: "0", whiteSpace: "nowrap", color: /\*/.test(q.toText ?? q.text) ? accent : fg });
		D.apply(n, "display", {step:textSpec.step});
		return n;
	});
	const tS = Math.max(0.9, p.dur * 0.42);
	return (l, d) => {
		const u = clamp(l / d);
		orbits.forEach((o, i) => set(o, { transform: `rotate(${(l * (8 + i * 5) * (i % 2 ? -1 : 1)).toFixed(3)}deg) scale(${(0.9 + 0.1 * smooth(l / 0.8) + u * 0.04).toFixed(4)})`, opacity: smooth(l / 0.6).toFixed(3) }));
		pieces.forEach((q, k) => {
			const n = nodes[k];
			const inK = expoOut(prog(l, -0.2 + q.i * 0.06, 0.55));
			const mv = K.expoInOut(prog(l, tS + k * 0.045, 0.85));
			if (q.from && q.to) {
				const shown = (mv < 0.5 ? q.text : q.toText).replace(/\*/g, "");
				if (n.textContent !== shown) n.textContent = shown;
				// Fly along an arc from the old place to the new one, tilting as it goes.
				const lift = Math.sin(mv * Math.PI) * (70 + hash(k * 3.3) * 90) * S * (hash(k * 1.9) > 0.5 ? 1 : -1);
				const x = q.from.x + (q.to.x - q.from.x) * mv;
				const y = q.from.y + (q.to.y - q.from.y) * mv + lift;
				set(n, { opacity: smooth((l + 0.2 - q.i * 0.06) / 0.2).toFixed(3), filter: focus(inK * (1 - Math.sin(mv * Math.PI) * 0.5), 0.25), transform: `translate(${px(x)}, ${px(y + (1 - inK) * 0.3 * fsz)}) rotate(${(Math.sin(mv * Math.PI) * (hash(k) - 0.5) * 24).toFixed(3)}deg)` });
			} else if (q.from) {
				// Words that aren't in the new line blur away and drop.
				set(n, { opacity: (smooth((l + 0.2 - q.i * 0.06) / 0.2) * (1 - mv)).toFixed(3), filter: focus(inK * (1 - mv), 0.35), transform: `translate(${px(q.from.x)}, ${px(q.from.y + mv * 60 * S + (1 - inK) * 0.3 * fsz)}) scale(${(1 - mv * 0.2).toFixed(4)})` });
			} else {
				// New words arrive out of focus where they belong.
				set(n, { opacity: mv.toFixed(3), filter: focus(mv, 0.35), transform: `translate(${px(q.to.x)}, ${px(q.to.y - (1 - mv) * 50 * S)}) scale(${(1.15 - mv * 0.15).toFixed(4)})` });
			}
		});
	};
};

