// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../../metadata.mjs';
export function create(K) {
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
return given=>definition_beatwords.build(given);
}
