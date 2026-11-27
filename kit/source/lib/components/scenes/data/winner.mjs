// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../../metadata.mjs';
import catalog from '../../catalog.mjs';
import {surfaceForeground} from '../../brand-tokens.mjs';
import {kit} from '../_shared/own-kit.mjs';
export function create(K) {
const { panel, orbs, figure, counted, spread, unit } = kit;
const definition_winner={...metadata["winner"],build({ p, cam, fg, accent, palette, bg, K }){
			fg=K.surfaceForeground=surfaceForeground(catalog.winner.surface,bg,palette,fg,{explicit:p.explicitForeground??(p.scene.fg!==undefined||K.plan.brand?.tokens?.foreground!==undefined)});
			const { W, el, set, px, clamp, quartOut, alpha, textOn, mixHex } = K;
			const S = unit(K);
			const s = p.scene;
			const light = orbs(K, cam, palette, accent, bg, p.index);
			const t = this.times(s, p.dur, p.beatLen);
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
				return { tile, badge, at: t.tiles[i], wins, decided: wins ? t.pick : t.lose[losers++] };
			});
			return (l) => {
				light(l);
				// The card comes in from the right, turned a little, and straightens as it stops.
				const e = quartOut(clamp((l - t.card) / 0.36));
				set(card, { opacity: clamp((l - t.card) / 0.12).toFixed(3), transform: `translateX(${px((1 - e) * 420 * S)}) rotate(${((1 - e) * 5).toFixed(3)}deg)` });
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
return given=>definition_winner.build(given);
}
