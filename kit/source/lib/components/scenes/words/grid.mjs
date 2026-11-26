// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function create(K) {
const { maths, dom } = K.helpers;
const D=K.design;
const { clamp, prog, expoOut, textOn } = maths;
const { el, set, px } = dom;
const { W, H, S, spring } = K;
return ({ p, cam, fg, accent, palette }) => {
			const s = p.scene;
			const n = s.words.length;
			const vertical = H > W * 1.2;
			const square = !vertical && W < H * 1.3;
			let cols;
			if (vertical) cols = n <= 3 ? 1 : 2;
			else if (square) cols = 2;
			else cols = n <= 3 ? n : n === 4 ? 2 : 3;
			if (square && n === 3) cols = 1;
			const rows = Math.ceil(n / cols);
			const pad = D.space(5);
			const gap = D.space(2);
			const tw = (W - pad * 2 - gap * (cols - 1)) / cols;
			const th = (H - pad * 2 - gap * (rows - 1)) / rows;
			const ink = palette.ink;
			const paper = palette.paper;
			const fills = [ink, paper, accent, paper, ink, accent];
			const tiles = s.words.map((word, i) => {
				const c = i % cols;
				const r = Math.floor(i / cols);
				const t = el("div", "tile", cam);
				const bg = fills[(i + (r % 2)) % fills.length];
				set(t, {
					left: px(pad + c * (tw + gap)),
					top: px(pad + r * (th + gap)),
					width: px(tw),
					height: px(th),
					background: bg,
					color: textOn(bg),
				});
				const tile=D.surface(t,"card",{layout:"absolute"});
				const w = el("div", "display", t, word);
				D.surfaceContent(t,w);
				D.fitSize(w, Math.min(tw*.82,tw-tile.paddingX*2), Math.min(th*.62,th-tile.paddingY*2), "display",{align:"center"});
				return { t, w };
			});
			cam.parentNode.style.perspective = px(2400 * S);
			const st = Math.min(p.beatLen / 2, (p.dur * 0.55) / n);
			return (l) => {
				tiles.forEach(({ t, w }, i) => {
					const t0 = i * st;
					const k = spring(l - t0, 2.8, 0.6);
					set(t, {
						opacity: clamp((l - t0) / 0.05).toFixed(3),
						transform: `rotateX(${((1 - k) * -75).toFixed(3)}deg) scale(${(0.86 + 0.14 * k).toFixed(4)})`,
					});
					const wk = expoOut(prog(l, t0 + 0.06, 0.4));
					set(w, { transform: `translateY(${((1 - wk) * 0.6).toFixed(4)}em)` });
				});
			};
		};
}
