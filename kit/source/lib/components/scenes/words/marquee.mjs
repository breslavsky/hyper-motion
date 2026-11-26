// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function create(K) {
const { maths, dom } = K.helpers;
const D=K.design;
const { prog, expoOut, lum, textOn } = maths;
const { el, set, px } = dom;
const { W, H, S } = K;
		/** Ticker bands across the frame, sliding in opposite directions, never stopping. */
return ({ p, cam, fg, accent, palette, bg }) => {
			const s = p.scene;
			const bands = [
				{ rot: -7, y: 0.18, dir: -1, bg: accent },
				{ rot: 4, y: 0.5, dir: 1, bg: fg },
				{ rot: -3, y: 0.82, dir: -1, bg: lum(bg) > 0.5 ? palette.ink : palette.paper },
			];
			const bh = H * 0.21;
			const items = bands.map((b, i) => {
				const band = el("div", "", cam);
				const text = Array.from({ length: 8 }, (_, j) => s.words[(j + i * 2) % s.words.length]).join("  ✳  ");
				set(band, { position: "absolute", left: px(-W * 0.3), width: px(W * 1.6), height: px(bh), top: px(b.y * H - bh / 2), background: b.bg, overflow: "hidden", display: "flex", alignItems: "center" });
				const t = el("div", "display", band, `${text}  ✳  ${text}`);
				D.apply(t,"display");
				set(t, { color: textOn(b.bg), whiteSpace: "nowrap" });
				return { band, t, b };
			});
			return (l) => {
				items.forEach(({ band, t, b }, i) => {
					const k = expoOut(prog(l, i * 0.07, 0.6));
					set(band, { transform: `rotate(${b.rot}deg) translateX(${px((1 - k) * b.dir * -W * 1.2)})` });
					set(t, { transform: `translateX(${px(-W * 0.4 + b.dir * l * 260 * S)})` });
				});
			};
		};
}
