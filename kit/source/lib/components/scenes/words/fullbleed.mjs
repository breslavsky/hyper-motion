// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function create(K) {
const { maths, dom } = K.helpers;
const D=K.design;
const { prog, expoOut, alpha } = maths;
const { el, set, px } = dom;
const { W, H, S, glyphText } = K;
return ({ p, cam, fg }) => {
			const s = p.scene;
			if (s.variant === "repeat") {
				const rows = [];
				const n = H > W ? 7 : 5;
				const box = el("div", "", cam);
				set(box, { position: "absolute", inset: "0", display: "flex", flexDirection: "column", justifyContent: "center" });
				for (let i = 0; i < n; i++) {
					const r = el("div", "display", box, `${s.text} ${s.text} ${s.text} ${s.text} ${s.text}`);
					set(r, { whiteSpace: "nowrap", color: fg });
					D.apply(r,"display");
					// Echo rows: the same word, faint. (Outline strokes show a variable font's
					// internal contours, so the echoes are tinted instead.)
					if (i !== Math.floor(n / 2)) r.style.color = alpha(fg, 0.17);
					rows.push(r);
				}
				// Repeated ribbons may extend past the sides; their vertical rhythm is token-owned.
				return (l) => {
					rows.forEach((r, i) => {
						const dir = i % 2 ? 1 : -1;
						const k = expoOut(prog(l, i * 0.04, 0.5));
						set(r, {
							transform: `translateX(${px(-W * 0.6 + dir * (l * 120 * S + (1 - k) * 300 * S))})`,
							opacity: k.toFixed(3),
						});
					});
				};
			}
			const wrap = el("div", "center", cam);
			const line = el("div", "display", wrap);
			set(line, { color: fg, overflow: "visible" });
			const { glyphs } = glyphText(line, s.text);
			D.fitLine(line, W * 0.92, H * 0.8, "hero");
			return (l, d) => {
				const st = Math.min(0.035, 0.32 / Math.max(1, glyphs.length));
				for (const g of glyphs) {
					const k = expoOut(prog(l, g.i * st, 0.42));
					set(g.node, { transform: `translateY(${((1 - k) * 1.05).toFixed(4)}em)` });
				}
				set(wrap, { transform: `scale(${(1 + 0.05 * (l / d)).toFixed(4)})` });
			};
		};
}
