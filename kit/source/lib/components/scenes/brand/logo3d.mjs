// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {logoNodeFor} from '../../builtin.mjs';
export function create(K) {
const { maths, dom } = K.helpers;
const D=K.design;
const { lerp, prog, expoOut, expoInOut, smooth, textOn } = maths;
const { el, set, px } = dom;
const { W, H, plan, glyphText, riseGlyphs, spring } = K;
const logoNode = logoNodeFor(K);
return ({ p, cam, fg, accent, palette }) => {
			const s = p.scene;
			const vertical = H > W * 1.2;
			const size = Math.min(W, H) * 0.32;
			const wrap = el("div", "center", cam);
			set(wrap, { flexDirection: vertical ? "column" : "row", gap: px(D.space(6)) });
			const scene3d = el("div", "", wrap);
			set(scene3d, { width: px(size), height: px(size), perspective: px(size * 4), flex: "none" });
			const cube = el("div", "", scene3d);
			set(cube, { position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d" });
			const brand = palette.brand;
			const faceColors = [brand, palette.brand2, palette.lime, palette.ink, accent, palette.peach];
			const rots = ["", "rotateY(90deg)", "rotateY(180deg)", "rotateY(-90deg)", "rotateX(90deg)", "rotateX(-90deg)"];
			const faces = rots.map((r, i) => {
				const f = el("div", "face", cube);
				set(f, { transform: `${r} translateZ(${px(size / 2)})`, background: faceColors[i], borderRadius: px(size * 0.06) });
				if (i === 0) {
					f.style.background = "transparent";
					const ln = logoNode(f, size, brand);
					ln.querySelector('[data-design-role="initials"]')?.setAttribute("data-design-glyph-art","logo-face");
					set(ln, { borderRadius: px(size * 0.06) });
					f.__logo = ln;
				} else {
					const t = el("div", "display", f, (plan.brand?.name ?? "K").charAt(0).toUpperCase());
					D.forSurface(size/(D.unit*32)).apply(t,"initials");
					t.dataset.designGlyphArt="logo-face";
					set(t, { color: textOn(faceColors[i]) });
				}
				return f;
			});
			const name = el("div", "display", wrap);
			set(name, { color: fg });
			const nameG = glyphText(name, s.text ?? plan.brand?.name ?? "").glyphs;
			D.fitSize(name, vertical ? W * 0.85 : W * 0.5, vertical ? H * 0.2 : H * 0.36, "display");
			const spinEnd = Math.min(1.3, p.dur * 0.6);
			// The cube spins alone at the centre, then slides over as the name lands beside it.
			const gapPx = D.space(6);
			const shift = ((vertical ? name.offsetHeight : name.offsetWidth) + gapPx) / 2;
			return (l) => {
				const slide = 1 - expoInOut(prog(l, spinEnd - 0.3, 0.55));
				set(wrap, { transform: vertical ? `translateY(${px(shift * slide)})` : `translateX(${px(shift * slide)})` });
				const k = expoOut(prog(l, 0, spinEnd));
				const e = spring(l, 2, 0.6);
				// After the spin it keeps a slow sway, so the logo never freezes on screen.
				const live = smooth((l - spinEnd) / 0.8);
				const ry = (1 - k) * 450 - 25 * (1 - k) + Math.sin((l - spinEnd) * 0.9) * 9 * live;
				const rx = (1 - k) * -160 + Math.sin((l - spinEnd) * 0.7) * 5 * live;
				set(cube, { transform: `translateZ(${px(-size / 2)}) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) scale(${(0.4 + 0.6 * e).toFixed(4)})` });
				const flat = expoOut(prog(l, spinEnd - 0.1, 0.4));
				faces.forEach((f, i) => {
					if (i === 0) {
						set(f.__logo, { borderRadius: px(size * lerp(0.06, 0.24, flat)) });
						return;
					}
					set(f, { opacity: (1 - flat).toFixed(3) });
				});
				riseGlyphs(nameG, l, { at: spinEnd - 0.25, stagger: 0.03 });
			};
		};
}
