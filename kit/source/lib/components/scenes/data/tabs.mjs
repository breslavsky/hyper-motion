// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../../metadata.mjs';
import catalog from '../../catalog.mjs';
import {surfaceForeground} from '../../brand-tokens.mjs';
import {kit} from '../_shared/own-kit.mjs';
export function create(K) {
const { panel, orbs, figure, counted, spread, unit } = kit;
const definition_tabs={...metadata["tabs"],build({ p, cam, fg, accent, palette, bg, K }){
			fg=K.surfaceForeground=surfaceForeground(catalog.tabs.surface,bg,palette,fg,{explicit:p.explicitForeground??(p.scene.fg!==undefined||K.plan.brand?.tokens?.foreground!==undefined)});
			const { el, set, px, clamp, cubicInOut, quartOut, smooth, alpha, hash } = K;
			const S = unit(K);
			const s = p.scene;
			const light = orbs(K, cam, palette, accent, bg, p.index);
			const t = this.times(s, p.dur, p.beatLen);
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
return given=>definition_tabs.build(given);
}
