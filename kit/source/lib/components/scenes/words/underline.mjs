// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../../metadata.mjs';
export function create(K) {
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
			const at = this.times(s, p.dur, p.beatLen);
			return (l) => {
				letters.forEach((node, i) => set(node, { transform: `translateY(${((1 - cubicOut(prog(l, at.rise + i * at.step, 0.24))) * 110).toFixed(3)}%)` }));
				set(rule, { transform: `scaleX(${expoOut(prog(l, at.rule, 0.5)).toFixed(4)})` });
				if (tag) set(tag, { opacity: smooth((l - 0.1) / 0.25).toFixed(3) });
			};
		}};
return given=>definition_underline.build(given);
}
