// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function create(K) {
const { maths, dom } = K.helpers;
const D=K.design;
const { clamp, lerp, prog, expoIn, textOn } = maths;
const { el, set, px } = dom;
const { W, H, S, glyphText, riseGlyphs, spring } = K;
return ({ p, cam, fg, accent }) => {
			const s = p.scene;
			const vertical = H > W * 1.2;
			const wrap = el("div", "center", cam);
			const row = el("div", "bold", wrap);
			// Both states share one display role; measure the widest state before animation.
			set(row, {
				display: "flex",
				flexDirection: vertical ? "column" : "row",
				alignItems: "center",
				gap: px(D.space(3)),
				color: fg,
				whiteSpace: "nowrap",
			});
			const lead = el("span", "", row);
			const leadG = glyphText(lead, s.lead).glyphs;
			const slot = el("span", "", row);
			set(slot, { position: "relative", display: "grid" });
			const from = el("span", "", slot, s.from);
			set(from, { gridArea:"1 / 1", alignSelf:"center", whiteSpace: "nowrap" });
			const pill = el("span", "pill", slot, s.to);
			set(pill, {
				position: "relative",
				gridArea:"1 / 1",
				background: accent,
				color: textOn(accent),
				boxSizing: "border-box",
				transformOrigin: "30% 60%",
			});
			D.surface(pill,"badge");
			D.surfaceGap(row,3);
			const role=D.fitGroup([lead,from,pill],{role:"display",w:vertical?W*.84:(W*.88-D.space(3))/2,h:H*.32});
			D.apply(row,"display",{step:role.step});
			row.style.maxWidth=px(W*.88);
			const fromW=from.offsetWidth,pillW=pill.offsetWidth,slotH=slot.offsetHeight;
			set(slot,{display:"inline-block",width:px(fromW),height:px(slotH)});
			set(from,{position:"absolute",left:"0",top:px((slotH-from.offsetHeight)/2),width:px(fromW)});
			set(pill,{position:"absolute",left:"0",top:"0",width:px(pillW)});
			const swapAt = Math.max(0.55, p.dur * 0.42);
			return (l) => {
				riseGlyphs(leadG, l, { at: 0.02, stagger: 0.025, rot: -6 });
				const fIn = spring(l - 0.12, 3, 0.6);
				const fOut = expoIn(prog(l, swapAt - 0.05, 0.22));
				set(from, {
					opacity: (clamp((l - 0.12) / 0.08) * (1 - fOut)).toFixed(3),
					transform: `translateY(${((1 - fIn) * 0.5 - fOut * 0.9).toFixed(4)}em)`,
					filter: `blur(${px(fOut * 12 * S)})`,
				});
				const pk = spring(l - swapAt, 3.4, 0.45);
				set(pill, {
					opacity: l >= swapAt ? "1" : "0",
					transform: `translateY(${((1 - clamp(pk)) * 0.5).toFixed(4)}em) scale(${(0.5 + 0.5 * pk).toFixed(4)}) rotate(${((1 - pk) * -8).toFixed(3)}deg)`,
				});
				const w = lerp(fromW, pillW, clamp(spring(l - swapAt, 2.6, 0.7)));
				set(slot, { width: px(w) });
			};
		};
}
