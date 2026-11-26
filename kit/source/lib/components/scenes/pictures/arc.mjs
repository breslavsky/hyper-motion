// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE} from '../_shared/hands.mjs';
// ---- arc: photos on a curve under a small line -----------------------------------------------------
// A short line sits high and small; below it a strip of photos rides an arc, the middle one biggest,
// drifting sideways the whole time, while the line's *word* rolls through options. Seen in Enobase.
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, alpha, mixHex, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const pics = (s.images ?? []).map((u) => K.images[u]).filter(Boolean);
	const text = String(s.text || "Your business is *different*");
	const alts = (s.words ?? []).map(DOUBLE).slice(0, 3);
	const n = vertical ? 7 : 11;
	const cw = vertical ? W * 0.3 : W * 0.15;
	const chh = cw * 1.3;
	const cy = H * (vertical ? 0.6 : 0.62);
	const strip = el("div", "", cam);
	set(strip, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), perspective: px(1600 * S) });
	const cols = [palette.coral, palette.sky, palette.butter, palette.lilac, palette.lime, accent].filter(Boolean);
	const cards = Array.from({ length: n + 2 }, (_, i) => {
		const c = el("div", "", strip);
		set(c, { position: "absolute", left: "0", top: "0", width: px(cw), height: px(chh), overflow: "hidden", boxShadow: `0 ${px(18 * S)} ${px(40 * S)} ${alpha("#000000", 0.22)}`, willChange: "transform" });
		D.surface(c, "card", { layout: "frame", purpose: "media" });
		const pic = pics.length ? pics[i % pics.length] : null;
		if (pic) {
			const im = el("img", "fill", c);
			im.src = pic.src;
			set(im, { width: "100%", height: "100%", objectFit: "cover" });
		} else {
			// No photos: soft colour studies, two tones and a horizon, never grey boxes.
			const a = cols[i % cols.length];
			const b = cols[(i + 2) % cols.length];
			set(c, { background: `linear-gradient(${160 + hash(i) * 40}deg, ${mixHex(a, "#ffffff", 0.25)} 0%, ${mixHex(b, "#000000", 0.15)} 100%)` });
			const sun = el("div", "", c);
			set(sun, { position: "absolute", left: `${20 + hash(i * 3) * 50}%`, top: `${15 + hash(i * 5) * 30}%`, width: px(cw * 0.26), height: px(cw * 0.26), borderRadius: "50%", background: alpha("#ffffff", 0.7) });
		}
		return c;
	});
	// The line, small and high, with the rolling word.
	const line = el("div", "display", cam);
	const fs = D.type("sceneTitle").size;
	const lineWidth = K.safe.w * 0.94;
	set(line, { position: "absolute", left: px((W - lineWidth) / 2), width: px(lineWidth), top: px(H * (vertical ? 0.22 : 0.17)), textAlign: "center", color: fg, whiteSpace: "normal" });
	D.apply(line,"sceneTitle");
	const parts = text.split(/(\*[^*]+\*)/).filter(Boolean);
	const pieces = [];
	let roller = null;
	const options = [];
	parts.forEach((pt) => {
		if (/^\*.*\*$/.test(pt)) {
			const box = el("span", "", line);
			set(box, { display: "inline-block", position: "relative", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.14em", marginBottom: "-0.14em" });
			const all = [pt.slice(1, -1), ...alts];
			all.forEach((w, k) => {
				const o = el("span", "", box, w);
				set(o, { display: "inline-block", color: accent, position: k ? "absolute" : "relative", left: "0", top: "0", whiteSpace: "pre" });
				if (K.plan?.look?.display?.accent === "serif") o.style.fontStyle = "italic";
				options.push(o);
			});
			roller = box;
		} else
			pt.split(/(\s+)/).forEach((w) => {
				if (!w) return;
				if (/^\s+$/.test(w)) return void line.appendChild(document.createTextNode(" "));
				const clip = el("span", "", line);
				set(clip, { display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.14em", marginBottom: "-0.14em" });
				const inner = el("span", "", clip, w);
				set(inner, { display: "inline-block" });
				pieces.push(inner);
			});
	});
	// Fit the longest rolling option in a wrapping headline. The shared label
	// floor stays intact even when a valid sentence needs more than one line.
	{
		const first = options[0]?.textContent;
		if (options.length) options[0].textContent = options.reduce((a, b) => a.scrollWidth > b.scrollWidth ? a : b).textContent;
		D.fitSize(line,lineWidth,H*(vertical?.3:.32),"sceneTitle");
		if (options.length) options[0].textContent = first;
	}
	// The roller keeps the width of whichever option is showing, so the line stays centred.
	const optW = options.map((o) => o.offsetWidth);
	const swapAt = options.map((_, k) => 0.7 + k * Math.max(0.6, (d0 * 0.6) / Math.max(1, options.length)));
	const spacing = cw * 1.12;
	const speed = cw * 0.55;
	return (l) => {
		const off = l * speed + E.accelExit(prog(l, d0 - 0.45, 0.45)) * W * 0.4;
		cards.forEach((c, i) => {
			let x = i * spacing - off;
			const span = spacing * cards.length;
			x = ((((x + spacing) % span) + span) % span) - spacing;
			const rel = (x + cw / 2 - W / 2) / (W / 2);
			const ar = clamp(Math.abs(rel), 0, 1.4);
			const rise = E.softLand(prog(l, 0.05 + clamp((rel + 1) / 2) * 0.35, 0.6));
			const sc = 1.18 - 0.5 * ar * ar;
			const y = cy - chh / 2 + ar * ar * H * 0.15 + (1 - rise) * H * 0.5;
			set(c, { transform: `translate(${px(x)}, ${px(y)}) rotateY(${(-rel * 30).toFixed(2)}deg) rotateZ(${(rel * 7).toFixed(2)}deg) scale(${sc.toFixed(4)})`, zIndex: String(100 - Math.round(ar * 50)), opacity: clamp(1.5 - ar).toFixed(3) });
		});
		pieces.forEach((w, i) => {
			const k = E.softLand(prog(l, 0.15 + i * 0.05, 0.5));
			set(w, { transform: `translateY(${((1 - k) * 105).toFixed(1)}%)` });
		});
		let cur = 0;
		options.forEach((o, k) => {
			if (l >= swapAt[k] && k > 0) cur = k;
		});
		options.forEach((o, k) => {
			const enter = k === 0 ? E.softLand(prog(l, 0.15 + pieces.length * 0.05, 0.5)) : E.softLand(prog(l, swapAt[k], 0.4));
			const exit = k < options.length - 1 ? E.accelExit(prog(l, swapAt[k + 1] - 0.05, 0.2)) : 0;
			set(o, { transform: `translateY(${((1 - enter) * 135 - exit * 135).toFixed(1)}%)`, opacity: (k === 0 || l >= swapAt[k]) && exit < 1 ? "1" : "0" });
		});
		if (roller && options.length > 1) {
			const prev = optW[Math.max(0, cur - 1)];
			const w = prev + (optW[cur] - prev) * E.softInOut(prog(l, swapAt[cur], 0.35));
			set(roller, { width: px(cur ? w : optW[0]) });
		}
	};
};

