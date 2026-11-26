// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE} from '../_shared/ground.mjs';
// ---- split: one word on a panel, a grid of what it means --------------------------------------------------
// A coloured panel holds one big word that swaps ("Posters." "Covers." "Merch."), and beside it a
// grid of tiles reshuffles with every word, a tile at a time. Seen in Higgsfield's "rastr" film.
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, alpha, mixHex, textOn, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const words = (s.words?.length ? s.words : ["Posters.", "Covers.", "Merch.", "Motion."]).map(DOUBLE).slice(0, 5);
	const pics = (s.images ?? []).map((u) => K.images[u]).filter(Boolean);
	const items = (s.items ?? []).slice(0, 12);
	const panelW = vertical ? W : W * 0.36;
	const panelH = vertical ? H * 0.34 : H;
	const panel = el("div", "", cam);
	set(panel, { position: "absolute", left: "0", top: "0", width: px(panelW), height: px(panelH), background: accent, overflow: "hidden", willChange: "transform" });
	const wordNs = words.map((w) => {
		const n = el("div", "display", panel, w);
		set(n, { position: "absolute", left: px(vertical ? W * 0.07 : panelW * 0.12), bottom: px(panelH * (vertical ? 0.16 : 0.12)), color: textOn(accent), whiteSpace: "nowrap", willChange: "transform" });
		D.apply(n,"display");
		return n;
	});
	const wordType = D.fitGroup(wordNs, { role: "display", w: panelW * (vertical ? 0.86 : 0.8), h: panelH * 0.5, wrap: "normal" });
	const fs = wordType.size;
	// The grid.
	const gx = vertical ? W * 0.05 : panelW + W * 0.03;
	const gy = vertical ? panelH + H * 0.03 : H * 0.06;
	const gw = vertical ? W * 0.9 : W - panelW - W * 0.06;
	const gh = vertical ? H - panelH - H * 0.06 : H * 0.88;
	const wordTiles = items.some(item => String(item).length > 2 && !/\p{Extended_Pictographic}/u.test(String(item)));
	const cols = wordTiles ? 2 : vertical ? 3 : 4;
	const rows = vertical ? 3 : 3;
	const gap = D.space(2);
	const tw = (gw - gap * (cols - 1)) / cols;
	const th = (gh - gap * (rows - 1)) / rows;
	const cols2 = [palette.coral, palette.sky, palette.butter, palette.lilac, palette.lime, accent].filter(Boolean);
	const light = lum(bg) > 0.45;
	const tiles = [];
	for (let r = 0; r < rows; r++)
		for (let c = 0; c < cols; c++) {
			const i = r * cols + c;
			const t = el("div", "", cam);
			set(t, { position: "absolute", left: px(gx + c * (tw + gap)), top: px(gy + r * (th + gap)), width: px(tw), height: px(th), overflow: "hidden", willChange: "transform" });
			D.surface(t, "card", { layout: "frame", purpose: "media" });
			// One face per word, swapped in turn.
			const faces = words.map((_, k) => {
				const f = el("div", "", t);
				set(f, { position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center" });
				const pic = pics.length ? pics[(i + k * 3) % pics.length] : null;
				if (pic) {
					const im = el("img", "fill", f);
					im.src = pic.src;
					set(im, { width: "100%", height: "100%", objectFit: "cover" });
				} else {
					const c1 = cols2[(i + k) % cols2.length];
					const dark = hash(i * 3.1 + k) > 0.55;
					set(f, { background: dark ? (light ? "#151515" : "#0b0b0d") : mixHex(c1, light ? "#ffffff" : "#000000", 0.25), color: dark ? c1 : textOn(c1) });
					const glyph = items.length ? items[(i + k * 2) % items.length] : ["◆", "●", "▲", "✦", "■", "◐"][(i + k) % 6];
					f.textContent = glyph;
					if ([...String(glyph)].length <= 2 || /^\p{Extended_Pictographic}/u.test(glyph)) D.forSurface(Math.min(tw, th) / (D.unit * 48)).apply(f, "cardTitle");
					else {
						set(f, { padding: px(D.space(2)), boxSizing: "border-box", textAlign: "center", whiteSpace: "normal" });
						D.fitSize(f, tw, th, "caption");
					}
				}
				return f;
			});
			tiles.push({ t, faces, i, delay: hash(i * 7.7) * 0.22 });
		}
	// When each word arrives is the plan's, on the film's beats (components/scene-moments.cjs).
	const swapAt = p.at.swaps;
	return (l) => {
		const pa = E.softLand(prog(l, 0, 0.5));
		set(panel, { transform: vertical ? `translateY(${px(-(1 - pa) * panelH)})` : `translateX(${px(-(1 - pa) * panelW)})` });
		wordNs.forEach((n, k) => {
			const enter = E.softLand(prog(l, swapAt[k], 0.4));
			const exit = k < words.length - 1 ? E.accelExit(prog(l, swapAt[k + 1] - 0.06, 0.18)) : 0;
			set(n, { opacity: l >= swapAt[k] && exit < 1 ? (Math.min(enter, 1 - exit) ** 8).toFixed(3) : "0", transform: `translateY(${px((1 - enter) * fs * 0.9 - exit * fs * 0.9)})` });
		});
		tiles.forEach((T) => {
			const a = E.softLand(prog(l, 0.1 + T.delay, 0.45));
			set(T.t, { opacity: clamp(a * 3).toFixed(3), transform: `scale(${(1.1 - 0.1 * a).toFixed(4)})` });
			// Each tile flips to the next word's face a moment after the word changes.
			T.faces.forEach((f, k) => {
				const at = swapAt[k] + T.delay * 0.8;
				const nextAt = k < words.length - 1 ? swapAt[k + 1] + T.delay * 0.8 : 1e9;
				const inK = k === 0 ? 1 : E.softLand(prog(l, at, 0.3));
				const outK = E.accelExit(prog(l, nextAt, 0.2));
				const on = (k === 0 || l >= at) && outK < 1;
				set(f, { opacity: on ? (Math.min(inK, 1 - outK) ** 8).toFixed(3) : "0", transform: `translateY(${((1 - inK) * 100 - outK * 100).toFixed(2)}%)` });
			});
		});
	};
};
