// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../../metadata.mjs';
export function create(K) {
const stepped = (table, f) => {
		if (f <= 0) return table[0];
		if (f >= table.length - 1) return table[table.length - 1];
		const i = Math.floor(f);
		return table[i] + (table[i + 1] - table[i]) * (f - i);
	};
const definition_impact={...metadata["impact"],build({ p, cam, fg, accent, K }){
			const { W, H, S, el, set, px, hash, clamp, expoOut, prog } = K;
			const s = p.scene;
			const wrap = el("div", "center", cam);
			const word = el("div", "display", wrap, s.text);
			set(word, { color: fg, whiteSpace: "nowrap", transformOrigin: "50% 55%" });
			K.design.fitSize(word, K.safe.w * 0.9, K.safe.h * 0.42, 'hero');
			let lead = null;
			if (s.lead) {
				lead = el("div", "bold", wrap, s.lead);
				set(lead, { position: "absolute", color: fg, whiteSpace: "nowrap" });
				K.design.fitSize(lead, K.safe.w * 0.8, K.design.type('sceneTitle').lineHeight*2, 'sceneTitle');
			}
			// The ring, round the middle of the safe area, where the word is.
			const [cx, cy] = [K.safe.x + K.safe.w / 2, K.safe.y + K.safe.h / 2];
			const unit = Math.min(W, H);
			const ring = el("div", "deco", cam);
			set(ring, { left: px(cx), top: px(cy), width: "0", height: "0", inset: "auto" });
			set(ring, { left: px(cx), top: px(cy) });
			const lines = Array.from({ length: 46 }, (_, i) => {
				const spoke = el("div", "", ring);
				set(spoke, { position: "absolute", left: "0", top: "0", width: "0", height: "0", transform: `rotate(${((i / 46) * 360 + (hash(i * 3.3) - 0.5) * 6).toFixed(2)}deg)` });
				const line = el("div", "", spoke);
				const thick = Math.max(2, 3.5 * S);
				set(line, { position: "absolute", left: "0", top: px(-thick / 2), height: px(thick), width: px((0.035 + hash(i * 5.1 + 1) * 0.05) * unit), borderRadius: px(thick), background: hash(i * 7.9 + 2) < 0.25 ? accent : fg, willChange: "transform" });
				return { line, r: (0.21 + hash(i * 2.7 + 3) * 0.23) * unit };
			});
			// One value a frame at 30 a second, as the technique gives them.
			const FLY = [1, 1.5, 1.95, 2.35, 2.7, 3, 3];
			const FADE = [1, 1, 1, 1, 0.4, 0.2, 0];
			const SLAM = [2, 1.16, 1.06, 0.93, 0.88, 0.88, 0.92, 0.97, 1.005, 1.024, 1.027, 1.02, 1.008, 1];
			const at = this.times(s, p.dur, p.beatLen);
			return (l) => {
				const f = (l - at.drop) * 30;
				for (const { line, r } of lines) set(line, { opacity: f < 0 ? "0" : stepped(FADE, f).toFixed(3), transform: `translateX(${px(r * stepped(FLY, f))})` });
				// The word comes a frame after the lines, and drifts a little larger once it rests.
				const rest = 1 + 0.03 * clamp((l - at.drop - 0.5) / Math.max(0.5, p.dur));
				set(word, { opacity: f < 1 ? "0" : f < 2 ? "0.6" : "1", transform: `scale(${(stepped(SLAM, f - 1) * rest).toFixed(4)})` });
				if (lead) {
					const k = expoOut(prog(l, 0, 0.35));
					set(lead, { opacity: f >= 0 ? "0" : k.toFixed(3), transform: `translateY(${px((1 - k) * 24 * S)})` });
				}
			};
		}};
return given=>definition_impact.build(given);
}
