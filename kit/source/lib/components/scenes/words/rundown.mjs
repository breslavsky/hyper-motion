// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../../metadata.mjs';
export function create(K) {
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
return given=>definition_rundown.build(given);
}
