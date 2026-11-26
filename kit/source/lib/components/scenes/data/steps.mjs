// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function create(K) {
const { maths, dom, moves } = K.helpers;
const D=K.design;
const { clamp, smooth, textOn, alpha } = maths;
const { el, set, px } = dom;
const { odometer } = moves;
const { W, H, S, plan, glyphText, riseGlyphs, spring } = K;
		/** How it works: a ring fills in steps while numbered chips land on the beat. */
return ({ p, cam, fg, accent }) => {
			const s = p.scene;
			const n = s.steps.length;
			const marks = p.marks; // when each part lands: components/scene-moments.cjs
			const vertical = H > W * 1.2;
			const square = !vertical && W < H * 1.4;
			const wrap = el("div", "center", cam);
			let titleG = [];
			let titleHeight = 0;
			if (s.title) {
				const title = el("div", "display", wrap);
				set(title, { color: fg, marginBottom: px(D.space(square ? 3 : 5)) });
				titleG = glyphText(title, s.title).glyphs;
				D.fitSize(title, W * 0.8, Math.max(H * 0.14, D.type("sceneTitle",5).lineHeight * 2), "sceneTitle");
				titleHeight = title.offsetHeight + D.space(square ? 3 : 5);
			}
			const T = {label:D.type("label").size,body:D.type("body").size,title:D.type("metric").size};
			// One column in a tall frame: the title, the ring and the list share its width.
			const column = Math.min(W * 0.84, K.safe.w);
			const rowGap = D.space(square ? 3 : 5);
			const row = el("div", "", wrap);
			set(row, { display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: px(rowGap), width: px(vertical ? column : K.safe.w) });
			const d = Math.min(W, H) * (vertical ? 0.42 : square ? 0.25 : 0.44);
			const ringBox = el("div", "", row);
			set(ringBox, { position: "relative", width: px(d), height: px(d), flex: "none" });
			const r = 44;
			const C = 2 * Math.PI * r;
			ringBox.innerHTML = `<svg viewBox="0 0 100 100" width="100%" height="100%" style="transform:rotate(-90deg)"><circle cx="50" cy="50" r="${r}" fill="none" stroke="${alpha(fg, 0.14)}" stroke-width="7"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}"/></svg>`;
			const arc = ringBox.querySelectorAll("circle")[1];
			const pct = el("div", "display", ringBox, "0%");
			set(pct, { position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", color: fg, fontVariantNumeric: "tabular-nums" });
			D.apply(pct,"metric");
			pct.textContent = "";
			const rollPct = odometer(el("span", "", pct), "100");
			el("span", "", pct, "%");
			const list = el("div", "", row);
			const listWidth = vertical ? column : K.safe.w - d - rowGap;
			set(list, { display: "flex", flexDirection: "column", gap: px(D.space(square ? 1 : 2)), width: px(listWidth), flex: "none" });
			const chips = s.steps.map((text, i) => {
				const c = el("div", "", list);
				set(c, { display: "flex", alignItems: "center", background: alpha(fg, 0.07), color: fg });
				D.surface(c,"badge",{density:square?"normal":"comfortable",shape:"pill"});
				const num = el("div", "mono", c, String(i + 1).padStart(2, "0"));
				// The number is a label, the step the main line: each a step of the scale (plan.js TYPE).
				set(num, { width: px(T.label * 2), height: px(T.label * 2), borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `${px(2.5 * S)} solid ${alpha(fg, 0.3)}`, flex: "none", boxSizing: "border-box" });
				D.apply(num,"label");
				const t = el("div", "bold", c, text);
				D.apply(t,"body");
				set(t, { whiteSpace: "normal", minWidth: "0" });
				return { c, num, t };
			});
			// Keep badge labels at the type floor: reflow the prose before the scene
			// fitter would have to shrink the entire ring and list to fit the frame.
			const listHeight = K.safe.h - titleHeight - (vertical ? d + rowGap : 0);
			for (const step of [3,2]) {
				if (Math.max(...chips.map(({ c }) => c.scrollWidth)) <= listWidth + 1 && list.offsetHeight <= listHeight + 1) break;
				for (const { t } of chips) D.apply(t,"body",{step});
			}
			return (l) => {
				if (titleG.length) riseGlyphs(titleG, l, { at: 0.02, stagger: 0.025, rot: -5 });
				let v = 0;
				for (let i = 0; i < n; i++) v += (1 / n) * spring(l - marks[i], 2.6, 0.75);
				arc.setAttribute("stroke-dashoffset", (C * (1 - clamp(v))).toFixed(2));
				rollPct(clamp(v) * 100);
				const e = spring(l, 2.4, 0.7);
				set(ringBox, { transform: `scale(${(0.7 + 0.3 * e).toFixed(4)}) rotate(${((1 - e) * -40).toFixed(2)}deg)`, opacity: clamp(l / 0.1).toFixed(3) });
				chips.forEach(({ c, num }, i) => {
					const k = spring(l - marks[i] + 0.12, 3, 0.62);
					set(c, { opacity: clamp((l - marks[i] + 0.12) / 0.08).toFixed(3), transform: `translateX(${px((1 - k) * 90 * S)}) scale(${(0.92 + 0.08 * k).toFixed(4)})` });
					// The badge fills over a few frames rather than switching colour in one.
					const fk = smooth((l - marks[i]) / 0.1);
					set(num, { background: fk > 0 ? alpha(accent, fk) : "transparent", color: fk > 0.5 ? textOn(accent) : fg, borderColor: fk > 0.5 ? accent : alpha(fg, 0.3) });
				});
			};
		};
}
