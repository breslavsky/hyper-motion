// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../../typing.mjs';
export function create(K) {
const { maths, dom } = K.helpers;
const D=K.design;
const { clamp, lerp, prog } = maths;
const { el, set, px, plain } = dom;
const { W, H, plan, glyphText, riseGlyphs, misreg } = K;
return ({ p, cam, fg, accent }) => {
			const s = p.scene;
			const ghost = el("div", "ghost", cam, plain(s.text));
			set(ghost, { color: fg, opacity: "0.05" });
			// The faint copy behind the title stays whole inside the frame: wider than the frame, a
			// short title read as a word cut off at the edge. It is kept only where it is well larger
			// than the title itself (below): next to a title of its own size it reads as a misprint.
			const ghostSize = D.fitSize(ghost, W * 0.96, H * 0.9, "hero");
			const wrap = el("div", "center", cam);
			let label = null, labelTyping = null;
			if (s.sub) {
				label = el("div", "mono", wrap, "");
				D.apply(label,"label");
				set(label, { color: fg, marginBottom: px(D.space(3)), opacity: "0.85" });
				labelTyping = createTyping(K, label, { text: s.sub, id: 'title.sub' });
				D.fitSize(label, W * .84, H * .16, 'label', { align: 'center' });
			}
			const line = el("div", "display", wrap);
			set(line, { color: fg });
			const { glyphs, words } = glyphText(line, s.text);
			for (const w of words)
				if (w.accent) {
					w.node.style.color = accent;
					if (plan.look?.display?.accent === "serif") w.node.classList.add("serif");
				}
			const size = D.fitSize(line, W * 0.86, H * (s.sub ? 0.52 : 0.64), "hero");
			if (ghostSize < size * 1.6) ghost.style.display = "none";
			const landed = 0.03 + Math.min(0.032, 0.55 / Math.max(1, glyphs.length)) * glyphs.length;
			labelTyping?.measure();
			return (l, d) => {
				riseGlyphs(glyphs, l, { at: 0.03 });
				misreg(line, l > landed - 0.05 ? 1 - prog(l, landed, 0.22) : 0);
				if (label) {
					const n = Math.floor(clamp(l / 0.5) * s.sub.length);
					labelTyping.reveal(n);
				}
				set(ghost, {
					transform: `translate(-50%,-50%) translateX(${px(lerp(0.06, -0.06, l / d) * W)})`,
				});
			};
		};
}
