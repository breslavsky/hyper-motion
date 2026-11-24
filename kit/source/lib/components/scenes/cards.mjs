// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../metadata.mjs';
import catalog from '../catalog.mjs';
import {surfaceForeground} from '../brand-tokens.mjs';
import {createOwnKit} from '../own-kit.mjs';
export function createFamily(K) {
const kit=createOwnKit();
const sceneFactories={};
const { panel, orbs, figure, counted, spread, unit } = kit;
const definition_winner={...metadata["winner"],build({ p, cam, fg, accent, palette, bg, K }){
			fg=K.surfaceForeground=surfaceForeground(catalog.winner.surface,bg,palette,fg,{explicit:p.explicitForeground??(p.scene.fg!==undefined||K.plan.brand?.tokens?.foreground!==undefined)});
			const { W, el, set, px, clamp, quartOut, alpha, textOn, mixHex } = K;
			const S = unit(K);
			const s = p.scene;
			const light = orbs(K, cam, palette, accent, bg, p.index);
			const t = this.times(s, p.dur);
			const pick = (s.pick ?? 3) - 1;
			const quadOut = (u) => 1 - (1 - clamp(u)) ** 2;
			const quadInOut = (u) => ((u = clamp(u)) < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
			/** A pop that overshoots by `over` and settles (0 before it starts). */
			const backOut = (u, over) => ((u = clamp(u)), 1 + (over + 1) * (u - 1) ** 3 + over * (u - 1) ** 2);
			const wrap = el("div", "center", cam);
			set(wrap, { gap: px(K.design.space(3)) });
			// Reserve the selected tile’s scale, outline and attached corner mark.
            const cw = Math.min(K.safe.w / 1.16, 980 * S);
			const card = panel(K, wrap, { ground: bg, radius: 6 });
			set(card, { width: px(cw), display: "flex", flexDirection: "column", textAlign: "left" });
			K.design.surface(card,'card',{density:'compact'});
            const head = el("div", "mono", card, s.title);
			set(head, { color: alpha(fg, 0.62), overflowWrap: "anywhere" }); K.design.apply(head, 'label');
			K.design.truncateLine(head);head.title = s.title;
			const value = el("div", "bold", card, s.value);
			set(value, { color: fg, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" });
			K.design.fitSize(value, cw * 0.7, 200 * S, 'display');
			const f = figure(s.value);
			// A curve that climbs: the same shape every time, drawn by the stroke's dash, the ground
			// under it uncovered as it goes, a dot popping on its end.
			const points = [0.78, 0.7, 0.74, 0.55, 0.6, 0.42, 0.46, 0.25, 0.2, 0.08].map((y, i, all) => [(i / (all.length - 1)) * 600, y * 120]);
			const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
			const chart = el("div", "", card);
			set(chart, { position: "relative", height: px(150 * S), marginTop: px(K.design.space(1)) });
			const id = K.uid('winner');
			chart.innerHTML = `<svg viewBox="0 0 600 120" width="100%" height="100%" preserveAspectRatio="none"><defs><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.26"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient><clipPath id="${id}c"><rect x="0" y="0" width="0" height="120"/></clipPath></defs><g clip-path="url(#${id}c)"><path d="${d} L600 120 L0 120 Z" fill="url(#${id}f)"/></g><path class="line" d="${d}" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
			const curve = chart.querySelector(".line");
			const shown = chart.querySelector("rect");
			const long = curve.getTotalLength();
			curve.setAttribute("stroke-dasharray", String(long));
			const dot = el("div", "", chart);
			const dd = 20 * S;
			set(dot, { position: "absolute", left: `calc(100% - ${px(dd / 2)})`, top: `calc(${((points.at(-1)[1] / 120) * 100).toFixed(2)}% - ${px(dd / 2)})`, width: px(dd), height: px(dd), boxSizing: "border-box", borderRadius: "50%", background: "#fff", border: `${px(4 * S)} solid ${accent}` });
			const row = el("div", "", wrap);
			set(row, { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: px(K.design.space(2)), width: px(cw) });
            const muted = mixHex(fg, bg, 0.45);
			let losers = 0;
			const tiles = s.options.map((name, i) => {
				const wins = i === pick;
				const tile = panel(K, row, { ground: bg, radius: 5 });
                tile.dataset.layoutFitAnchor='winner-option';
				set(tile, { minWidth: "0", textAlign: "center" });
				K.design.surface(tile,'card',{density:'compact'});
                const label = el("div", "bold", tile, name);
				// Percentage width follows the real content box, including its rim.
				set(label, { color: fg, width: "100%" });
				K.design.apply(label, 'caption');
				K.design.truncateLine(label);label.title = name;
				// A badge on the corner: a tick on the one picked, a cross on each that lost.
				const badge = el("div", "", tile);
                badge.dataset.layoutFitAnchor='winner-corner-mark';
				const bd = 44 * S;
				const ink = wins ? accent : muted;
				set(badge, { position: "absolute", right: px(-bd * 0.3), top: px(-bd * 0.3), width: px(bd), height: px(bd), borderRadius: "50%", background: ink, display: "flex", alignItems: "center", justifyContent: "center" });
				badge.innerHTML = `<svg viewBox="0 0 24 24" width="62%" height="62%"><path d="${wins ? "M5 12.5l4.5 4.5L19 7.5" : "M7.5 7.5l9 9M16.5 7.5l-9 9"}" fill="none" stroke="${wins ? textOn(accent) : bg}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
				return { tile, badge, at: t.tiles + i * 0.065, wins, decided: wins ? t.pick : t.lose[losers++] };
			});
			return (l) => {
				light(l);
				// The card comes in from the right, turned a little, and straightens as it stops.
				const e = quartOut(clamp((l - 0.05) / 0.36));
				set(card, { opacity: clamp((l - 0.05) / 0.12).toFixed(3), transform: `translateX(${px((1 - e) * 420 * S)}) rotate(${((1 - e) * 5).toFixed(3)}deg)` });
				if (f) value.textContent = counted(f, quadOut((l - 0.12) / 0.55));
				const drawn = quadInOut((l - 0.3) / 0.42);
				curve.setAttribute("stroke-dashoffset", ((1 - drawn) * long).toFixed(2));
				shown.setAttribute("width", (drawn * 600).toFixed(1));
				set(dot, { transform: `scale(${backOut((l - 0.74) / 0.16, 2.2).toFixed(4)})` });
				for (const tile of tiles) {
					const up = quadOut((l - tile.at) / 0.2);
					const since = l - tile.decided;
					const seen = clamp((l - tile.at) / 0.1);
					if (tile.wins) {
						// The one picked: larger, lifted, ringed and glowing; its tick pops a moment later.
						const chosen = backOut(since / 0.2, 1.8);
						set(tile.tile, {
							opacity: seen.toFixed(3),
							transform: `translateY(${px((1 - up) * 30 * S - chosen * 13 * S)}) scale(${(1 + 0.1 * chosen).toFixed(4)})`,
							filter: since > 0 ? `drop-shadow(0 ${px(14 * S)} ${px(34 * S)} ${alpha(accent, 0.35 * clamp(since / 0.2))})` : "none",
							outline: since >= 0 ? `${px(5 * S)} solid ${accent}` : "none",
						});
						set(tile.badge, { transform: `scale(${backOut((since - 0.04) / 0.18, 2.2).toFixed(4)})` });
					} else {
						// One that lost: ringed, greyed and stepped back, a cross popping on its corner.
						const lost = clamp(since / 0.12);
						set(tile.tile, {
							opacity: (seen * (1 - 0.45 * lost)).toFixed(3),
							transform: `translateY(${px((1 - up) * 30 * S)}) scale(${(1 - 0.04 * lost).toFixed(4)})`,
							filter: lost > 0 ? `grayscale(${(0.6 * lost).toFixed(3)})` : "none",
							outline: since >= 0 ? `${px(4 * S)} solid ${alpha(fg, 0.4 * clamp(since / 0.08))}` : "none",
						});
						set(tile.badge, { transform: `scale(${backOut((since - 0.02) / 0.16, 2.2).toFixed(4)})` });
					}
				}
			};
		}};
sceneFactories["winner"]=given=>definition_winner.build(given);
const definition_connect={...metadata["connect"],build({ p, cam, fg, accent, palette, bg, K }){
			const { W, H, el, set, px, spring, clamp, alpha, textOn } = K;
			const S = unit(K);
			const s = p.scene;
			const light = orbs(K, cam, palette, accent, bg, p.index);
			const t = this.times(s, p.dur);
			const cubicOut = (u) => 1 - (1 - clamp(u)) ** 3;
			const quadOut = (u) => 1 - (1 - clamp(u)) ** 2;
			const quadInOut = (u) => ((u = clamp(u)) < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
			const vertical = H >= W;
			const n = s.sources.length;
			// Where things stand: the sources in a column (a row on top in a tall frame), the target opposite.
			const sourceGrid = vertical && n === 4;
			const from = s.sources.map((_, i) => (sourceGrid ? { x: W * (i % 2 ? 0.72 : 0.28), y: H * (i < 2 ? 0.2 : 0.36) } : vertical ? { x: W * (0.5 + (i - (n - 1) / 2) * Math.min(0.3, 0.84 / n)), y: H * 0.26 } : { x: W * 0.22, y: H * (0.5 + (i - (n - 1) / 2) * Math.min(0.2, 0.7 / n)) }));
			const to = vertical ? { x: W * 0.5, y: H * 0.7 } : { x: W * 0.76, y: H * 0.5 };
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
			svg.setAttribute("class", "deco");
			svg.setAttribute("data-layout-allow-overlap", "");
			set(svg, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H) });
			cam.appendChild(svg);
			const lines = from.map((a) => {
				const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
				const bend = vertical ? `M${a.x} ${a.y} C ${a.x} ${(a.y + to.y) / 2}, ${to.x} ${(a.y + to.y) / 2}, ${to.x} ${to.y}` : `M${a.x} ${a.y} C ${(a.x + to.x) / 2} ${a.y}, ${(a.x + to.x) / 2} ${to.y}, ${to.x} ${to.y}`;
				path.setAttribute("d", bend);
				path.setAttribute("fill", "none");
				path.setAttribute("stroke", alpha(fg, 0.5));
				path.setAttribute("stroke-width", String(4.5 * S));
				path.setAttribute("stroke-linecap", "round");
				svg.appendChild(path);
				const length = path.getTotalLength();
				const dot = el("div", "", cam);
				const dd = 18 * S;
				set(dot, { position: "absolute", left: px(-dd / 2), top: px(-dd / 2), width: px(dd), height: px(dd), borderRadius: "50%", background: accent, boxShadow: `0 0 ${px(18 * S)} ${px(6 * S)} ${alpha(accent, 0.55)}` });
				return { path, length, dot };
			});
			const pw = Math.min(W * (sourceGrid ? 0.4 : vertical ? Math.min(0.3, 0.84 / n) : 0.3), 420 * S);
			const pills = s.sources.map((name, i) => {
				const pill = panel(K, cam, { ground: bg, radius: 'full' });
				pill.dataset.connectSource = String(i);
				set(pill, { position: "absolute", width: px(pw), left: px(from[i].x - pw / 2), textAlign: "center" });
				K.design.surface(pill,'badge',{density:'compact',shape:'pill'});
                const label = el("div", "bold", pill, name);
				set(label, { color: fg, width: "100%" });
				K.design.apply(label, 'controlLabel');
				K.design.truncateLine(label);label.title = name;
				set(pill, { top: px(from[i].y - pill.offsetHeight / 2) });
				return pill;
			});
			const td = Math.min(W * (vertical ? 0.5 : 0.24), 420 * S);
			const tile = el("div", "", cam);
			set(tile, { position: "absolute", left: px(to.x - td / 2), top: px(to.y - td / 2), width: px(td), height: px(td), borderRadius: px(td * 0.24), background: accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${px(30 * S)} ${px(80 * S)} ${alpha(accent, 0.45)}` });
			const name = el("div", "bold", tile, s.target);
			name.dataset.connectTarget = '';
			set(name, { color: textOn(accent), whiteSpace: "normal", overflowWrap: "anywhere", textAlign: "center" });
			K.design.fitSize(name, td * 0.82, td * 0.8, 'cardTitle');
			return (l) => {
				light(l);
				pills.forEach((pill, i) => {
					// A pill comes into focus as it rises a little.
					const e = cubicOut((l - t[i].pill) / 0.18);
					set(pill, { opacity: e.toFixed(3), transform: `translateY(${px((1 - e) * 14 * S)})`, filter: e < 1 ? `blur(${px((1 - e) * 10 * S)})` : "none" });
				});
				const land = spring(l - 0.2, 2.2, 0.6);
				// The target swells a little each time a light reaches it.
				const hit = t.reduce((sum, at) => sum + Math.sin(clamp((l - at.lands) / 0.4) * Math.PI), 0);
				set(tile, { opacity: clamp((l - 0.2) / 0.12).toFixed(3), transform: `scale(${(0.7 + 0.3 * land + 0.04 * Math.min(1, hit)).toFixed(4)})` });
				lines.forEach((line, i) => {
					// A dotted line that draws itself: dots a fixed distance apart, shown up to the drawn length.
					const drawn = quadOut((l - t[i].line) / 0.32) * line.length;
					const gap = 13 * S;
					const dots = Math.floor(drawn / gap);
					line.path.setAttribute("stroke-dasharray", dots > 0 ? `${Array.from({ length: dots }, () => `0.1 ${gap - 0.1}`).join(" ")} 0 ${line.length}` : `0 ${line.length}`);
					// A line not begun shows nothing: a dash of no length with a round cap is still a dot.
					line.path.style.visibility = dots > 0 ? "visible" : "hidden";
					// A light runs the curve, then runs it again.
					const span = 0.55, again = Math.max(0.65, (p.dur - t[i].run) / 2);
					const since = l - t[i].run;
					const lap = since < 0 ? -1 : since % again;
					const k = lap < 0 || lap > span ? -1 : quadInOut(lap / span);
					if (k < 0) set(line.dot, { opacity: "0", transform: "none" });
					else {
						const at = line.path.getPointAtLength(k * line.length);
						set(line.dot, { opacity: clamp(lap / 0.08).toFixed(3), transform: `translate(${px(at.x)}, ${px(at.y)})` });
					}
				});
			};
		}};
sceneFactories["connect"]=given=>definition_connect.build(given);
const definition_chips={...metadata["chips"],build({ p, cam, fg, accent, palette, bg, K }){
			const { W, H, el, set, px, glyphText, riseGlyphs, clamp, prog, smooth, hash, alpha } = K;
			const S = unit(K);
			const s = p.scene;
			const light = orbs(K, cam, palette, accent, bg, p.index);
			const n = s.chips.length;
			// The chips leave in the scene's last third of a second: a fly-through, not a drift away.
			const leave = Math.max(p.dur - 0.3, p.dur * 0.6);
			const step = Math.min(0.07, (p.dur * 0.4) / n);
			// The chips stand in a box with depth, its vanishing point the middle of the frame: a chip
			// pushed toward the viewer runs along its line from the centre and grows past the camera.
			const space = el("div", "", cam);
			set(space, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), perspective: px(1000 * S), perspectiveOrigin: "50% 50%" });
			const cubicOut = (u) => 1 - (1 - clamp(u)) ** 3;
			// Places on two arcs, over and under the line (never beside it, where the line runs), every
			// other one further out, each a little off its angle.
			const over = Math.ceil(n / 2);
			const chips = s.chips.map((name, i) => {
				const top = i % 2 === 0;
				const slot = Math.floor(i / 2), slots = top ? over : n - over;
				const a = (top ? Math.PI : 0) + (Math.PI * (slot + 0.5)) / slots + (hash(i * 3.7 + 1) - 0.5) * 0.18;
				const far = slot % 2 ? 0.45 : 0.39;
				const depth = hash(i * 5.3 + 2);
				const node = panel(K, space, { ground: bg, radius: 'full', blur: 14, tint: i % 3 === 0 ? accent : undefined });
				const label = el("div", "bold", node, name);
				set(label, { color: fg, whiteSpace: "nowrap" }); const chipDesign=K.design.forSurface(0.8 + depth * 0.2); chipDesign.apply(label, 'controlLabel');
				set(node, { position: "absolute", left: "0", top: "0" });
				const chipBox=chipDesign.surface(node,'badge',{shape:'pill'});
				set(label, { maxWidth: px(K.safe.w*.4-chipBox.paddingX*2) });
				chipDesign.truncateLine(label);label.title = name;
                return { node, x: K.safe.x + K.safe.w / 2 + Math.cos(a) * K.safe.w * far, y: K.safe.y + K.safe.h / 2 + Math.sin(a) * K.safe.h * (far - 0.05), a, depth, roll: (hash(i * 7.1) - 0.5) * 10, at: 0.15 + i * step,
					// A small tilt at rest; a hard one as it goes, a moment after the others or before.
					tilt: [(hash(i * 2.9 + 4) - 0.5) * 12, (hash(i * 4.3 + 5) - 0.5) * 16], hard: [(hash(i * 6.7 + 6) - 0.5) * 120, (hash(i * 8.9 + 7) - 0.5) * 130],
					goes: leave + hash(i * 9.7 + 8) * 0.04, z: (860 + hash(i * 1.9 + 9) * 100) * S };
			});
			const wrap = el("div", "center", cam);
			const line = el("div", "display", wrap);
			set(line, { color: fg });
			const { glyphs, words } = glyphText(line, s.text);
			for (const w of words) if (w.accent) set(w.node, { color: accent });
			K.design.fitSize(line, K.safe.w * 0.78, Math.min(K.safe.h*.28,K.design.steps('display').at(-1).lineHeight*2), 'display');
			// A chip never stands on the line: at least the line's half height and its own away from the middle.
			const clear = line.offsetHeight / 2 + K.design.space(3);
			const middle = K.safe.y + K.safe.h / 2;
			for (const c of chips) if (Math.abs(c.y - middle) < clear) c.y = middle + (c.y < middle ? -clear : clear);
            if(n>6){
                for(const side of [0,1]){
                    const group=chips.filter((_,i)=>i%2===side),rows=Math.ceil(group.length/2);
                    const bandH=K.safe.h/2-clear;
                    group.forEach((chip,i)=>{
                        chip.x=K.safe.x+K.safe.w*(i%2?.75:.25);
                        chip.y=(side?middle+clear:K.safe.y)+bandH*(Math.floor(i/2)+.5)/rows;
                    });
                }
            }
			return (l) => {
				light(l);
				riseGlyphs(glyphs, l, { at: 0.05, stagger: 0.03 });
				for (const c of chips) {
					const k = cubicOut((l - c.at) / 0.22);
					const drift = Math.sin(l * 0.9 + c.a * 3) * 6 * S;
					// At rest a chip stays whole inside the frame.
					const half = c.node.offsetWidth / 2, edge = 10 * S;
					const rest = Math.min(K.safe.x + K.safe.w - half - edge, Math.max(K.safe.x + half + edge, c.x));
					const x = rest - half;
					const y = c.y - c.node.offsetHeight / 2 + drift;
					const soft = c.depth < 0.35 ? 3 * S : 0;
					// Leaving, a chip tilts hard (0.14 s) and flies at the camera (0.22 s, gathering speed),
					// blurring into a streak; it is gone before it would fill the frame.
					const turn = cubicOut((l - c.goes) / 0.14);
					const fly = clamp((l - c.goes) / 0.22) ** 2;
					const [rx, ry] = [0, 1].map((j) => c.tilt[j] + (c.hard[j] - c.tilt[j]) * turn);
					set(c.node, { opacity: (k * (1 - clamp((l - c.goes - 0.17) / 0.06))).toFixed(3), transform: `translate3d(${px(x)}, ${px(y)}, ${px(c.z * fly)}) rotate(${c.roll.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) scale(${(0.94 + 0.06 * k).toFixed(4)})`, filter: `blur(${px((1 - k) * 6 * S + soft + fly * 10 * S)})` });
				}
			};
		}};
sceneFactories["chips"]=given=>definition_chips.build(given);
const definition_tabs={...metadata["tabs"],build({ p, cam, fg, accent, palette, bg, K }){
			fg=K.surfaceForeground=surfaceForeground(catalog.tabs.surface,bg,palette,fg,{explicit:p.explicitForeground??(p.scene.fg!==undefined||K.plan.brand?.tokens?.foreground!==undefined)});
			const { el, set, px, clamp, cubicInOut, quartOut, smooth, alpha, hash } = K;
			const S = unit(K);
			const s = p.scene;
			const light = orbs(K, cam, palette, accent, bg, p.index);
			const t = this.times(s, p.dur);
			const wrap = el("div", "center", cam);
			// The card stands in depth: it comes up tipped back and out of focus, and rests a little tipped.
			set(wrap, { perspective: px(2200 * S) });
			const cw = Math.min(K.safe.w, 1040 * S);
			const card = panel(K, wrap, { ground: bg, radius: 6 });
			set(card, { width: px(cw), display: "flex", flexDirection: "column" });
			const cardBox=K.design.surface(card,'card',{density:'compact'});
            const fieldBox=K.design.box('field',{density:'compact'});
            const row = el("div", "", card);
			set(row, { position: "relative", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: px(K.design.space(1)) });
			const gap = K.design.space(1), pad = fieldBox.paddingX;
            const innerW = cw - cardBox.paddingX * 2;
            const metricWidths = s.items.map(item => {
                const probe = el('span', '', card, item.value);
                K.design.apply(probe, 'metric', {step: 6});
                set(probe, {position: 'absolute', whiteSpace: 'nowrap'});
                const width = probe.getBoundingClientRect().width / (K.presentationScale || 1);
                probe.remove();
                return width;
            });
            const stacked = Math.max(...metricWidths) > (innerW - gap * 2) / 3 - pad * 2;
            const tw = stacked ? innerW : (innerW - gap * 2) / 3;
            if(stacked) set(row, {gridTemplateColumns: '1fr'});
			const lit = el("div", "", row);
			set(lit, { position: "absolute", left: "0", top: "0", bottom: stacked ? "auto" : "0", width: px(tw), borderRadius: px(fieldBox.radius), background: alpha(fg, 0.1) });
			const tabs = s.items.map((item) => {
				const tab = el("div", "", row);
				set(tab, { position: "relative", textAlign: "left" });
				K.design.surface(tab,'field',{density:'compact'});
                set(tab,{display:'flex',flexDirection:stacked?'row':'column'});
                const label = el("div", "mono", tab, item.label);
				set(label, { color: alpha(fg, 0.62), maxWidth: px(tw-pad*2) }); K.design.apply(label, 'controlLabel');
				K.design.truncateLine(label);label.title = item.label;
				const value = el("div", "bold", tab, item.value);
				set(value, { color: fg, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", marginTop: "0" });
				K.design.fitLine(value, tw - pad * 2, K.design.type('metric').lineHeight, 'metric');
                if(stacked) set(tab, {display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: px(fieldBox.gap)});
                if(stacked) {set(value, {flex: 'none', marginTop: '0'});set(label, {minWidth: '0', maxWidth: px(tw - value.offsetWidth - pad * 2 - fieldBox.gap)});}
				return { tab, label, value, f: figure(item.value) };
			});
			if(!stacked){const labelH=Math.max(...tabs.map(t=>t.label.offsetHeight));for(const t of tabs)set(t.label,{minHeight:px(labelH)});}
            const tabPitch = stacked ? Math.max(...tabs.map(t => t.tab.offsetHeight)) + gap : tw + gap;
            if(stacked) {for(const t of tabs) set(t.tab, {minHeight: px(tabPitch-gap), boxSizing: 'border-box'});set(lit, {height: px(tabPitch-gap)});}
            // A colour a tab: the scene's accent, then the look's own others (the accent again where it has none).
			const own = [accent, palette.electric, palette.coral, palette.lilac].filter((c, i, all) => c && c !== bg && all.indexOf(c) === i);
			const colours = [0, 1, 2].map((i) => own[i] ?? accent);
			const parts = (hex) => {
				const h = hex.replace("#", "");
				const n = Number.parseInt(h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6), 16);
				return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
			};
			const rgb = colours.map(parts);
			/** The colour at `k` of the way through the three tabs (0-2), as #hex. */
			const colourAt = (k) => {
				const a = Math.min(1, Math.floor(k)), mix = k - a;
				return `#${rgb[a].map((v, i) => Math.round(v + (rgb[a + 1][i] - v) * mix).toString(16).padStart(2, "0")).join("")}`;
			};
			// Three shapes of one curve, each a walk that climbs, from the engine's own noise, so a film
			// always draws the same; 1 is the top of the chart.
			const N = 60;
			const series = [0, 1, 2].map((k) => {
				const walk = [];
				let v = 0.25;
				for (let i = 0; i < N; i++) {
					v = clamp((v + (hash(i * 3.3 + k * 11.7 + 1) - 0.43) * 0.11) * 0.97 + (0.18 + (0.62 * i) / (N - 1)) * 0.03, 0.05, 0.95);
					walk.push(v);
				}
				const [lo, hi] = [Math.min(...walk), Math.max(...walk)];
				return walk.map((x) => (x - lo) / (hi - lo || 1));
			});
			const chart = el("div", "", card);
			set(chart, { position: "relative", height: px(190 * S) });
			const id = K.uid('tabs');
			chart.innerHTML = `<svg viewBox="0 0 600 190" width="100%" height="100%" preserveAspectRatio="none" style="overflow:visible"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-opacity="0.34"/><stop offset="1" stop-opacity="0"/></linearGradient></defs><path class="area" fill="url(#${id})"/><path class="line" fill="none" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
			const [area, line, stops] = [chart.querySelector(".area"), chart.querySelector(".line"), [...chart.querySelectorAll("stop")]];
			// The head of the line: a white dot that rides its end as it draws and as it bends.
			const dot = el("div", "", chart);
			const dd = 16 * S;
			set(dot, { position: "absolute", width: px(dd), height: px(dd), marginLeft: px(-dd / 2), marginTop: px(-dd / 2), borderRadius: "50%", background: "#fff" });
			const COUNT = [0.87, 0.59, 0.59];
			return (l) => {
				light(l);
				const e = quartOut(clamp(l / 0.45));
				set(card, { opacity: clamp(l / 0.15).toFixed(3), filter: e < 1 ? `blur(${px((1 - e) * 16 * S)})` : "none", transform: `translateY(${px((1 - e) * 90 * S)}) rotateX(${(16 - 12 * e).toFixed(3)}deg)` });
				// Where the lit panel stands: it hops in two or three frames.
				const at = t.reduce((x, time, i) => (i ? x + cubicInOut(clamp((l - time) / 0.08)) : x), 0);
				const c = colourAt(clamp(at, 0, 2));
				set(lit, { transform: `translate${stacked ? 'Y' : 'X'}(${px(at * tabPitch)})`, opacity: smooth((l - t[0]) / 0.15).toFixed(3), boxShadow: `inset 0 ${px(-5 * S)} 0 ${c}, 0 ${px(10 * S)} ${px(18 * S)} ${px(-10 * S)} ${alpha(c, 0.9)}` });
				tabs.forEach((tab, i) => {
					const on = l >= t[i] && (i === 2 || l < t[i + 1]);
					set(tab.tab, { opacity: (l < t[i] ? 0.38 : on ? 1 : 0.55).toFixed(2) });
					if (tab.f) tab.value.textContent = counted(tab.f, quartOut(clamp((l - t[i]) / COUNT[i])));
				});
				// The curve bends from one series to the next as the panel hops and takes the tab's colour;
				// the first time it draws in from the left.
				const k = clamp(at, 0, 2), a = Math.floor(Math.min(1, k)), mix = k - a;
				const y = (i) => (0.88 - 0.55 * (series[a][i] + (series[a + 1][i] - series[a][i]) * mix)) * 190;
				const upto = clamp((l - t[0]) / 0.55) * (N - 1);
				const whole = Math.floor(upto), part = upto - whole;
				const points = Array.from({ length: whole + 1 }, (_, i) => [(i / (N - 1)) * 600, y(i)]);
				if (part > 0 && whole < N - 1) points.push([((whole + part) / (N - 1)) * 600, y(whole) + (y(whole + 1) - y(whole)) * part]);
				const d = points.map(([px0, py0], i) => `${i ? "L" : "M"}${px0.toFixed(1)} ${py0.toFixed(1)}`).join(" ");
				const [hx, hy] = points.at(-1);
				const seen = l >= t[0];
				line.setAttribute("d", seen ? d : "");
				line.setAttribute("stroke", c);
				line.style.filter = `drop-shadow(0 0 ${px(8 * S)} ${alpha(c, 0.9)})`;
				area.setAttribute("d", seen && points.length > 1 ? `${d} L${hx.toFixed(1)} 190 L0 190 Z` : "");
				for (const stop of stops) stop.setAttribute("stop-color", c);
				set(dot, { opacity: seen ? "1" : "0", left: `${((hx / 600) * 100).toFixed(3)}%`, top: `${((hy / 190) * 100).toFixed(3)}%` });
			};
		}};
sceneFactories["tabs"]=given=>definition_tabs.build(given);
const definition_dial={...metadata["dial"],build({ p, cam, fg, accent, palette, bg, K }){
			const { W, H, el, set, px, spring, clamp, prog, quartOut, smooth, alpha, textOn } = K;
			const S = unit(K);
			const s = p.scene;
			const light = orbs(K, cam, palette, accent, bg, p.index);
			const t = this.times(s, p.dur, p.beatLen);
			const wrap = el("div", "center", cam);
			const cw = Math.min(W * 0.86, 1000 * S);
			const card = panel(K, wrap, { ground: bg, radius: 6 });
			set(card, { width: px(cw), display: "flex", flexDirection: "column", textAlign: "left" });
			const cardBox=K.design.surface(card,'card',{density:'comfortable'});
            const track = el("div", "", card);
			const th = 20 * S, long = cw - cardBox.paddingX*2;
			set(track, { position: "relative", marginTop:px(170*S-cardBox.paddingY), height: px(th), borderRadius: px(th), background: alpha(fg, 0.16) });
			const fill = el("div", "", track);
			set(fill, { position: "absolute", left: "0", top: "0", bottom: "0", borderRadius: px(th), background: accent });
			const ticks = Array.from({ length: 11 }, (_, i) => {
				const tick = el("div", "", track);
				set(tick, { position: "absolute", left: px((long * i) / 10 - 2 * S), top: px(th + 14 * S), width: px(4 * S), height: px(16 * S), borderRadius: px(K.design.radius(1)) });
				return tick;
			});
			const knob = el("div", "", track);
			const kd = 64 * S;
			set(knob, { position: "absolute", top: px((th - kd) / 2), left: px(-kd / 2), width: px(kd), height: px(kd), borderRadius: "50%", background: "#fff", boxShadow: `0 ${px(8 * S)} ${px(22 * S)} rgba(0,0,0,0.3)` });
			const bubble = el("div", "bold", track);
			set(bubble, { position: "absolute", bottom: px(th + 34 * S), left: "0", background: accent, color: textOn(accent), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", transformOrigin: "50% 100%", display: "flex", alignItems: "center" }); K.design.apply(bubble, 'metric'); K.design.surface(bubble,'badge');
			// The figure: a slot a digit, hundreds first. When a digit changes the new one slides in from
			// below and the old one leaves upward, over two frames of sixty, so a fast count ticks softly
			// instead of flickering. One figure to a viewer (`data-roll`: the audit measures its box).
			const figureBox = el("span", "", bubble);
			figureBox.setAttribute("data-roll", "");
			set(figureBox, { display: "flex" });
			const slots = [2, 1, 0].map((place) => {
				const slot = el("span", "", figureBox);
				set(slot, { position: "relative", display: "block", width: "0.62em", height: "1.2em" });
				const [old, now] = [el("span", "", slot), el("span", "", slot)];
				for (const node of [old, now]) set(node, { position: "absolute", left: "0", right: "0", top: "0", textAlign: "center" });
				return { slot, old, now, div: 10 ** place, place };
			});
			if (s.unit) el("span", "", bubble, s.unit);
			/** Where the knob is at the moment `m`, 0-1 of the track: off fast and slowing into its value. */
			const knobAt = (m) => (quartOut(clamp(prog(m, t.from, t.to - t.from))) * s.value) / 100;
			const valueAt = (m) => Math.floor(knobAt(m) * 100 + 1e-6);
			const ROLL = 2 / 60, STEP = 1 / 240;
			const label = el("div", "bold", card, s.label);
			set(label, { color: fg, marginTop: px(K.design.space(2)) });
			set(label, { width: "100%" });
			K.design.apply(label, 'caption');
			K.design.truncateLine(label);label.title = s.label;
			return (l) => {
				light(l);
				const e = spring(l - 0.04, 2.4, 0.64);
				set(card, { opacity: clamp(l / 0.12).toFixed(3), transform: `translateY(${px((1 - e) * 50 * S)}) scale(${(0.92 + 0.08 * e).toFixed(4)})` });
				// One value drives it all: where the knob is.
				const x = knobAt(l);
				set(knob, { transform: `translateX(${px(x * long)}) scale(${(1 + 0.12 * Math.sin(clamp(prog(l, t.from - 0.1, 0.25)) * Math.PI)).toFixed(4)})` });
				set(fill, { width: px(x * long) });
				ticks.forEach((tick, i) => set(tick, { background: i / 10 <= x + 1e-6 ? accent : alpha(fg, 0.25) }));
				const v = valueAt(l);
				for (const { slot, old, now, div, place } of slots) {
					const shown = place === 0 || v >= div;
					set(slot, { display: shown ? "block" : "none" });
					// Keep hidden leading places canonical when seeking back from
					// a larger value; display:none already hides their glyphs.
					const lead = Math.floor(v / div);
					// How long ago this digit changed, looked for a step at a time over the roll's length.
					let e = 1, before = lead;
					for (let k = 1; k * STEP <= ROLL; k++) {
						before = Math.floor(valueAt(l - k * STEP) / div);
						if (before !== lead) {
							e = ((k - 0.5) * STEP) / ROLL;
							break;
						}
					}
					now.textContent = String(lead % 10);
					set(now, { opacity: e.toFixed(3), transform: `translateY(${(0.26 * (1 - e)).toFixed(4)}em)` });
					// A place the number has just grown into had no digit before it.
					const had = e < 1 && (place === 0 || before > 0);
					old.textContent = had ? String(before % 10) : "";
					set(old, { opacity: (1 - e).toFixed(3), transform: `translateY(${(-0.26 * e).toFixed(4)}em)` });
				}
				set(bubble, { transform: `translateX(${px(x * long - bubble.offsetWidth / 2)}) scale(${spring(l - 0.3, 3, 0.55).toFixed(4)})` });
				set(label, { opacity: smooth((l - 0.15) / 0.3).toFixed(3) });
			};
		}};
sceneFactories["dial"]=given=>definition_dial.build(given);

return {sceneFactories};
}
