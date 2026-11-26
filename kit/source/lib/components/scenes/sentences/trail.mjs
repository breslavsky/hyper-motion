// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../../typing.mjs';
// ---- trail: neon light streaks sweeping round a pill on black, the pill typing a line -----------
export const factory = ({ p, cam, accent, palette, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, smooth, hash, mixHex } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const back = el("div", "", cam);
	set(back, { position: "absolute", inset: "0", background: "radial-gradient(ellipse at 50% 50%, #15110c 0%, #050505 70%)" });
	// The streaks are drawn at the size the picture is watched at (K.previewScale:
	// the live preview's stream), and laid over the frame at its own size.
	const q = K.previewScale ?? 1;
	const cv = el("canvas", "", cam);
	cv.width = Math.round(W * q);
	cv.height = Math.round(H * q);
	set(cv, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H) });
	const g = cv.getContext("2d");
	const pill = el("div", "bold", cam);
	const pw = K.safe.w * .9;
	const ph = D.control("button").height + D.space(2);
	set(pill, { position: "absolute", left: px((W - pw) / 2), top: px((H - ph) / 2), width: px(pw), height: px(ph), border: `${px(2.5 * S)} solid rgba(255,255,255,0.75)`, background: "rgba(255,255,255,0.06)", boxShadow: `0 0 ${px(40 * S)} rgba(255,255,255,0.12), inset 0 0 ${px(30 * S)} rgba(255,255,255,0.08)`, display: "flex", alignItems: "center", color: "#ffffff",  overflow: "hidden", whiteSpace: "nowrap" });
	const fieldBox = D.surface(pill, "field", { density: "compact", shape: "pill" });
	const knob = el("div", "", pill);
	set(knob, { flex: "none", width: px(ph * 0.62), height: px(ph * 0.62), borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #ffffff, #c9c9c9 60%, #8a8a8a)" });
	D.apply(pill, "controlLabel");
	const typed = el("span", "", pill);
	const caret = el("span", "", pill);
	set(caret, { width: px(3 * S), height: px(ph * 0.5), background: "#ffffff", marginLeft: px(2 * S) });
	const text = String(s.text ?? "");
	set(typed, { flex: "1", minWidth: "0" });
	const typing = createTyping(K, typed, { text, caret, id: "trail-line" });
	D.fitSize(typed, pw - fieldBox.paddingX * 2 - ph * .62 - fieldBox.gap * 2 - 6 * S, ph - fieldBox.paddingY * 2, "controlLabel");
	typing.measure();
	// Warm streak colours by default (gold, orange, red), or the accent when the style is cool.
	const cols = [s.warm === false ? accent : "#ffd25a", s.warm === false ? mixHex(accent, "#ffffff", 0.4) : "#ff8a1f", s.warm === false ? (palette.lilac ?? accent) : "#ff3b2f"];
	const streaks = [0, 1, 2, 3, 4].map((i) => ({ rx: pw * (0.62 + i * 0.07), ry: ph * (2.2 + i * 0.55), tilt: (hash(i * 3.3) - 0.5) * 0.7 + (i % 2 ? 0.35 : -0.35), speed: (1.6 + hash(i * 5.1) * 1.1) * (i % 2 ? -1 : 1), ph: hash(i * 7.7) * 6.28, len: 2.2 + hash(i * 2.2) * 1.4, col: cols[i % cols.length], w: (5 + hash(i * 9.9) * 6) * S }));
	const typeAt = 0.35;
	const typeDur = Math.min(1.2, p.dur * 0.4);
	return (l, d) => {
		const u = clamp(l / d);
		const intro = expoOut(prog(l, 0, 0.6));
		g.setTransform(q, 0, 0, q, 0, 0);
		g.clearRect(0, 0, W, H);
		g.globalCompositeOperation = "lighter";
		const cx = W / 2;
		const cy = H / 2;
		for (const k of streaks) {
			const head = k.ph + l * k.speed;
			// Every piece of a streak casts its own glow, which is what the scene
			// costs: at the preview's size a streak is cut into fewer, longer pieces.
			const segs = q < 1 ? Math.max(16, Math.round(46 * q * q)) : 46;
			g.save();
			g.translate(cx, cy);
			g.rotate(k.tilt);
			g.scale(1 + 0.05 * u, 1 + 0.05 * u);
			for (let j = 0; j < segs; j++) {
				const f = j / segs;
				const a0 = head - Math.sign(k.speed) * f * k.len;
				const a1 = head - Math.sign(k.speed) * (f + 1 / segs) * k.len;
				const fade = (1 - f) ** 1.6 * intro;
				// Depth: the half of the ring behind the pill is dimmer and thinner.
				const behind = Math.sin(a0) < 0 ? 0.45 : 1;
				g.strokeStyle = k.col;
				g.globalAlpha = fade * behind;
				g.lineWidth = k.w * (1 - f * 0.7) * (0.7 + 0.3 * behind);
				g.shadowColor = k.col;
				g.shadowBlur = 30 * S * fade * q;
				g.beginPath();
				g.ellipse(0, 0, k.rx * intro, k.ry * intro, 0, a1, a0, k.speed > 0 ? false : true);
				g.stroke();
			}
			g.restore();
		}
		g.globalAlpha = 1;
		g.globalCompositeOperation = "source-over";
		const n = Math.round(clamp((l - typeAt) / typeDur) * text.length);
		typing.reveal(n);
		set(caret, { opacity: n < text.length ? "1" : K.blink(l - typeAt - typeDur).toFixed(3) });
		const pk = K.spring(l, 2.6, 0.6);
		set(pill, { transform: `scale(${((0.8 + 0.2 * pk) * (1 + 0.04 * u)).toFixed(4)})`, opacity: smooth(l / 0.15).toFixed(3) });
		set(knob, { transform: `translateX(${px(Math.sin(l * 2) * 2 * S)})` });
	};
};

