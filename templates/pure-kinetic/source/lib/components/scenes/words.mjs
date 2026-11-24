// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../metadata.mjs';
export function createFamily(K) {
const sceneFactories={};
const definition_stack={...metadata["stack"],build({ p, cam, fg, accent, K }){
			const { W, H, S, el, set, px, prog, clamp, expoOut, alpha } = K;
			const s = p.scene;
			const wrap = el("div", "center", cam);
			set(wrap, { gap: px(K.design.space(1)) });
			K.design.surfaceGap(wrap,1);
			const n = s.words.length;
			const lines = s.words.map((word) => {
				const node = el("div", "display", wrap, word);
				set(node, { color: fg, transformOrigin: "50% 56%", whiteSpace: "nowrap" });
				return node;
			});
			// One size for all, the largest at which the widest word and the whole stack fit.
			K.design.fitGroup(lines, {role: 'hero', w: K.safe.w * 0.94, h: (K.safe.h * 0.86) / n, wrap: 'nowrap'});
			const times = this.times(s, p.dur, p.beatLen);
			return (l) => {
				lines.forEach((node, i) => {
					const k = expoOut(prog(l, times[i], 0.3));
					const next = times[i + 1];
					const dim = next !== undefined && l >= next;
					set(node, { opacity: l < times[i] ? "0" : clamp((l - times[i]) / 0.05).toFixed(3), transform: `scale(${(1.15 - 0.15 * k).toFixed(4)})`, color: dim ? alpha(fg, 0.26) : i === n - 1 && l >= times[i] ? accent : fg });
				});
			};
		}};
sceneFactories["stack"]=given=>definition_stack.build(given);
const definition_beatwords={...metadata["beatwords"],build({ p, cam, fg, accent, bg, K }){
			const { W, H, S, el, set, px, prog, expoOut, quartOut } = K;
			const s = p.scene;
			const n = s.words.length;
			const step = p.dur / n;
			// Four entrances in turn: tracking that closes, a drop from above and larger, a stretch from the baseline, a slide.
			const enter = [
				(k, tracking) => ({ letterSpacing: `${(tracking + 0.5 * (1 - k)).toFixed(4)}em`, transform: "none" }),
				(k) => ({ transform: `translateY(${px((1 - k) * 320 * S)}) scale(${(1.25 - 0.25 * k).toFixed(4)})` }),
				(k) => ({ transform: `scaleY(${(2.6 - 1.6 * k).toFixed(4)})`, transformOrigin: "50% 78%" }),
				(k) => ({ transform: `translateX(${px((1 - k) * -W * 0.44)})` }),
			];
			const layers = s.words.map((word, i) => {
				const flip = i % 2 === 1;
				const last = i === n - 1;
				const layer = el("div", "center", cam);
				set(layer, { background: last ? accent : flip ? fg : bg });
				const node = el("div", "display", layer, word);
				set(node, { color: last ? K.textOn(accent) : flip ? bg : fg, whiteSpace: "nowrap" });
				K.design.fitLine(node, K.safe.w * 0.94, K.safe.h * 0.7, 'hero');
				return { layer, node, at: i * step, move: enter[i % enter.length], tracking: Number.parseFloat(node.style.letterSpacing) || 0 };
			});
			return (l) => {
				for (const [i, w] of layers.entries()) {
					const on = l >= w.at && (i === n - 1 || l < w.at + step);
					set(w.layer, { visibility: on ? "visible" : "hidden" });
					// Keep hidden poses time-derived so a backward seek restores every word.
					set(w.node, w.move(i % 4 === 0 ? expoOut(prog(l, w.at, 0.2)) : quartOut(prog(l, w.at, 0.16)), w.tracking));
				}
			};
		}};
sceneFactories["beatwords"]=given=>definition_beatwords.build(given);
const definition_underline={...metadata["underline"],build({ p, cam, fg, accent, K }){
			const { W, H, S, el, set, px, prog, expoOut, cubicInOut, smooth, alpha } = K;
			const s = p.scene;
			const wrap = el("div", "center", cam);
			const box = el("div", "", wrap);
			set(box, { position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start" });
			const tag = s.tag ? el("div", "mono", box, `[ ${s.tag} ]`) : null;
			if (tag) {
				set(tag, { color: alpha(fg, 0.7), marginBottom: px(K.design.space(2)), maxWidth: px(K.safe.w*.92) });
				K.design.apply(tag, 'label');K.design.truncateLine(tag);tag.title = tag.textContent;
			}
			const clip = el("div", "display", box);
			set(clip, { overflow: "hidden", color: fg, whiteSpace: "nowrap", padding: "0.1em 0 0.12em" });
			const letters = [...s.text].map((ch) => {
				const node = el("span", "", clip, ch);
				set(node, { display: "inline-block" });
				return node;
			});
			K.design.fitLine(clip, K.safe.w * 0.92, K.safe.h * 0.5, 'hero');
			const rule = el("div", "", box);
			set(rule, { height: px(Math.max(8, 14 * S)), background: accent, width: "100%", transformOrigin: "0 50%", marginTop: px(K.design.space(1)), borderRadius: px(K.design.radius(1)) });
			const cubicOut = (t) => 1 - (1 - t) ** 3;
			return (l) => {
				letters.forEach((node, i) => set(node, { transform: `translateY(${((1 - cubicOut(prog(l, 0.04 + i * 0.035, 0.24))) * 110).toFixed(3)}%)` }));
				set(rule, { transform: `scaleX(${expoOut(prog(l, 0.16 + letters.length * 0.035, 0.5)).toFixed(4)})` });
				if (tag) set(tag, { opacity: smooth((l - 0.1) / 0.25).toFixed(3) });
			};
		}};
sceneFactories["underline"]=given=>definition_underline.build(given);
const definition_rundown={...metadata["rundown"],build({ p, cam, fg, accent, K }){
			const { S, el, set, px, prog, clamp, expoOut, alpha } = K;
			const s = p.scene;
			const wrap = el("div", "center", cam);
			set(wrap, { gap: px(K.design.space(4)) });
			K.design.surfaceGap(wrap,4);
			const list = el("div", "", wrap);
			set(list, { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: px(K.design.space(1)) });
			K.design.surfaceGap(list,1);
			const lines = s.items.map((item) => {
				const node = el("div", "bold", list, item);
				set(node, { color: fg, whiteSpace: "nowrap" });
				return node;
			});
			// Supporting steps share one body size; the concluding phrase owns the hero role.
			K.design.fitGroup(lines, {role: 'body', w: K.safe.w * 0.9, h: K.design.type('body').lineHeight * 2, wrap: 'normal'});
			const punch = el("div", "display", wrap, s.punch);
			set(punch, { color: accent, whiteSpace: "nowrap", transformOrigin: "50% 60%" });
			K.design.fitSize(punch, K.safe.w * 0.94, K.safe.h * 0.28, 'hero');
			const at = this.times(s, p.dur, p.beatLen);
			return (l) => {
				const landed = l >= at.punch;
				lines.forEach((node, i) => {
					const k = expoOut(prog(l, at.lines[i], 0.3));
					const next = at.lines[i + 1] ?? at.punch;
					// The newest line is lit; the one before steps back as the next arrives, and all of them as the punch line lands.
					const tone = landed ? 0.22 : l >= next ? 0.4 : 1;
					set(node, { opacity: clamp((l - at.lines[i]) / 0.08).toFixed(3), transform: `translateX(${px(-(1 - k) * 70 * S)})`, color: alpha(fg, tone) });
				});
				const k = expoOut(prog(l, at.punch, 0.3));
				set(punch, { opacity: clamp((l - at.punch) / 0.05).toFixed(3), transform: `scale(${(1.2 - 0.2 * k).toFixed(4)})` });
			};
		}};
sceneFactories["rundown"]=given=>definition_rundown.build(given);

return {sceneFactories};
}
