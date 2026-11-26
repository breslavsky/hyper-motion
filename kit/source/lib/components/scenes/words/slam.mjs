// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function create(K) {
const { maths, dom } = K.helpers;
const D=K.design;
const { prog, expoOut, alpha } = maths;
const { el, set, px } = dom;
const { H, S, glyphText, riseGlyphs, misreg } = K;
		/** Stacked poster lines, each slamming in on its beat; the last one echoes. Crumbs decode around it. */
return ({ p, cam, fg, accent }) => {
			const s = p.scene;
			const marks = p.marks ?? s.lines.map((_, i) => i * p.beatLen);
			const wrap = el("div", "center", cam);
			const n = s.lines.length;
			const lines = s.lines.map((text, i) => {
				const node = el("div", "display", wrap);
				set(node, { color: i === n - 1 && n > 1 ? accent : fg, whiteSpace: "nowrap", position: "relative" });
				const g = glyphText(node, text).glyphs;
				set(node,{maxWidth:px(K.safe.w*.96),whiteSpace:"normal",textAlign:"center"});
				D.apply(node,"hero");
				return { node, g };
			});
			// Echoes of the last line, tinted, that slide apart once it lands.
			const last = lines[n - 1];
			const echoes = [1, 2].map((dir) => {
				const e = el("div", "display", last.node, s.lines[n - 1]);
				e.setAttribute("data-deco", ""); // an echo of the line, not a line to read
				set(e, { position: "absolute", left: "0", top: "0", width: "100%", color: alpha(fg, dir === 1 ? 0.18 : 0.08), pointerEvents: "none", zIndex: "-1" });
				return { e, dir };
			});
			const crumbGap = D.space(2);
			const crumbWidth = (K.safe.w - crumbGap * 2) / 3;
			const crumbs = (s.crumbs ?? []).slice(0, 6).map((text, i) => {
				const c = el("div", "mono", cam);
				set(c, { position: "absolute", left: px(K.safe.x + (i % 3) * (crumbWidth + crumbGap)), top: px(i < 3 ? K.safe.y : K.safe.y + K.safe.h - D.type("label").lineHeight * 2), width: px(crumbWidth), textAlign: "center", color: alpha(fg, 0.8), whiteSpace: "normal" });
				D.apply(c,"label");
				const { glyphs: g, words } = glyphText(c, text);
				// Words remain atomic; wrapping happens between words, not between glyphs.
				return { node:c,g, at: 0.2 + i * Math.min(0.3, (p.dur * 0.7) / Math.max(1, s.crumbs.length)) };
			});
			const topH=Math.max(0,...crumbs.slice(0,3).map(c=>c.node.offsetHeight)),bottomH=Math.max(0,...crumbs.slice(3).map(c=>c.node.offsetHeight));
			const topGap=topH?D.space(3):0,bottomGap=bottomH?D.space(3):0;
			for(const c of crumbs.slice(3))c.node.style.top=px(K.safe.y+K.safe.h-bottomH);
			set(wrap,{paddingTop:px(K.safe.y+topH+topGap),paddingBottom:px(H-K.safe.y-K.safe.h+bottomH+bottomGap)});
			const lineBudget=K.safe.h-topH-bottomH-topGap-bottomGap;
			for(const spec of D.steps("hero")){
				for(const {node}of lines)D.apply(node,"hero",{step:spec.step});
				if(lines.every(({node})=>node.scrollWidth<=K.safe.w*.96+1)&&lines.reduce((h,{node})=>h+node.offsetHeight,0)<=lineBudget)break;
			}
			const lineHeights=lines.map(({node})=>node.offsetHeight);
			const densePoster=lineHeights.reduce((a,b)=>a+b,0)>lineBudget;
			if(lines.some(({node},i)=>node.scrollWidth>K.safe.w*.96+1||lineHeights[i]>lineBudget))throw new Error("Poster copy exceeds the readable line capacity");
			// Dense posters keep the latest complete lines visible at the same
			// semantic size; each line still enters on its authored beat.
			return (l) => {
				let newest=0;
				for(let i=0;i<marks.length;i++)if(l>=marks[i])newest=i;
				let first=newest,height=lineHeights[newest];
				while(first>0&&height+lineHeights[first-1]<=lineBudget){height+=lineHeights[--first];}
				for(let i=0;i<lines.length;i++)lines[i].node.style.display=!densePoster||(i>=first&&i<=newest)?"block":"none";
				let punch = 0;
				let pan = 0;
				lines.forEach(({ node, g }, i) => {
					riseGlyphs(g, l, { at: marks[i], stagger: 0.022, mode: "slam" });
					misreg(node, l > marks[i] ? 1 - prog(l, marks[i] + 0.06, 0.18) : 0);
					if (l > marks[i]) {
						const k = Math.exp(-(l - marks[i]) * 7);
						punch += 0.04 * k;
						pan += (i % 2 ? 1 : -1) * 26 * S * k;
					}
				});
				const lastAt = marks[n - 1] + 0.12;
				for (const { e, dir } of echoes) {
					const k = expoOut(prog(l, lastAt, 0.5));
					set(e, { opacity: k.toFixed(3), transform: `translateY(${(dir * k * 0.92).toFixed(4)}em)` });
				}
				for (const c of crumbs) riseGlyphs(c.g, l, { at: c.at, stagger: 0.02, mode: "scramble" });
				set(wrap, { transform: `translateX(${px(pan)}) scale(${(1 + punch).toFixed(4)})` });
			};
		};
}
