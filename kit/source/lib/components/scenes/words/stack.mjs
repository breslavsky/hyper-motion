// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../../metadata.mjs';
export function create(K) {
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
return given=>definition_stack.build(given);
}
