// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function create(K) {
const { maths, dom } = K.helpers;
const D=K.design;
const { prog, expoOut, lum } = maths;
const { el, set, px } = dom;
const { W, H, S, images, glyphText, riseGlyphs, mockUI, spring } = K;
		/** Three phones fan out from a stack, each showing a screen. */
return ({ p, cam, fg, palette }) => {
			const s = p.scene;
			const imgs = (s.images ?? []).map((u) => images[u]).filter(Boolean);
			const vertical = H > W * 1.2;
			let capG = [], captionBottom = K.safe.y;
			if (s.caption) {
				const cap = el("div", "display", cam);
				set(cap, { position: "absolute", left: "0", right: "0", top: px(K.safe.y), textAlign: "center", color: fg, margin: "0 auto" });
				capG = glyphText(cap, s.caption).glyphs;
				D.fitSize(cap, K.safe.w, K.safe.h * 0.3, "sceneTitle");
				captionBottom += cap.offsetHeight + D.space(5);
			}
			const ph = Math.min(H * (vertical ? 0.5 : s.caption ? 0.66 : 0.78), K.safe.y + K.safe.h - captionBottom);
			const pw = ph / 2.05;
			const top = s.caption ? captionBottom : (H - ph) / 2;
			const phones = [0, 1, 2].map((i) => {
				const ph0 = el("div", "phone", cam);
				set(ph0, { width: px(pw), height: px(ph), left: px(W / 2 - pw / 2), top: px(top), zIndex: i === 1 ? "3" : "2", boxShadow: `0 ${px(40 * S)} ${px(80 * S)} rgba(0,0,0,0.3)` });
				const device=D.forSurface(pw*.01/D.unit);
				device.surface(ph0,"card",{layout:"frame",purpose:"device"});
				const scr = el("div", "screen", ph0);
				const inset = pw * 0.035;
				set(scr, { left: px(inset), top: px(inset), right: px(inset), bottom: px(inset) });
				device.surface(scr,"card",{layout:"frame",purpose:"media"});
				device.nest(scr,ph0,{inset});
				const img = imgs.length ? imgs[(i + 1) % imgs.length] : null;
				if (img) {
					const im = el("img", "fill", scr);
					im.src = img.src;
				} else {
					// The product's own screens, phone-sized: a list, the dashboard and a chat.
					set(scr, { overflow: "hidden", background: lum(palette.paper) < 0.2 ? "#0d0f15" : "#ffffff" });
					const inner = el("div", "", scr);
					set(inner, { position: "absolute", left:"0",right:"0",top:px(pw*.12),bottom:"0" });
					mockUI(inner, palette, palette.electric, i, ["inbox", "dashboard", "chat"][i]);
				}
				const island = el("div", "", ph0);
				set(island, { position: "absolute", top: px(pw * 0.06), left: px(pw * 0.36), width: px(pw * 0.28), height: px(pw * 0.08), borderRadius: px(99), background: "#0b0b0d" });
				return ph0;
			});
			const spread = [-1, 0, 1];
			return (l, d) => {
				if (capG.length) riseGlyphs(capG, l, { at: 0.02, stagger: 0.022, rot: -6 });
				phones.forEach((ph0, i) => {
					const k = spring(l - 0.15 - Math.abs(spread[i]) * 0.08, 2.2, 0.7);
					const rise = expoOut(prog(l, 0, 0.6));
					const float = Math.sin((l / d) * Math.PI * 2 + i) * 8 * S;
					set(ph0, {
						transform: `translate(${px(spread[i] * k * pw * 1.08)}, ${px((1 - rise) * H * 0.6 + Math.abs(spread[i]) * k * ph * 0.05 + float)}) rotate(${(spread[i] * k * 8).toFixed(3)}deg)`,
					});
				});
			};
		};
}
