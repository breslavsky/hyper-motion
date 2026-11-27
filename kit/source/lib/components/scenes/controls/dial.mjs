// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../../metadata.mjs';
import {kit} from '../_shared/own-kit.mjs';
export function create(K) {
const { panel, orbs, figure, counted, spread, unit } = kit;
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
				set(bubble, { transform: `translateX(${px(x * long - bubble.offsetWidth / 2)}) scale(${spring(l - t.bubble, 3, 0.55).toFixed(4)})` });
				set(label, { opacity: smooth((l - 0.15) / 0.3).toFixed(3) });
			};
		}};
return given=>definition_dial.build(given);
}
