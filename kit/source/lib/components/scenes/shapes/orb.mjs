// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE} from '../_shared/ground.mjs';
// ---- orb: a living gradient sphere and a few calm lines -------------------------------------------
// A glowing sphere of the brand's colours, the colours turning slowly inside it, breathing; it
// arrives soft and oversized, pulses as each short line takes its turn below it. Seen in
// Abdullah's ElevenLabs film: the product as a presence, not a screen.
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, lum, alpha, mixHex, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const lines = (s.lines?.length ? s.lines : [s.text || K.plan?.brand?.name || ""]).map(DOUBLE).slice(0, 3);
	const R = Math.min(W, H) * (vertical ? 0.3 : 0.24);
	const ocx = W / 2;
	const ocy = H * (vertical ? 0.42 : 0.42);
	// Sci-fi: not a soft gradient ball but a star, a hot core in the warm colours with a dark limb
	// and thin metal rings turning round it.
	const star = !!K.plan?.look?.deco?.hud;
	const cols = star
		? [palette.lime ?? accent, palette.peach ?? "#ff7a2f", palette.butter ?? "#ffd59a", palette.coral ?? "#ff5a2a", palette.lime ?? accent, "#fff3dc"]
		: [accent, palette.sky ?? "#7cc6ff", palette.lilac ?? "#c9b6ff", palette.butter ?? "#ffe27a", palette.coral ?? "#ff8a73", palette.lime ?? "#c6f36b"];
	const rings = star
		? [0, 1, 2].map((i) => {
				const r = el("div", "", cam);
				const rr = R * (1.55 + i * 0.32);
				set(r, { position: "absolute", left: px(ocx - rr), top: px(ocy - rr), width: px(rr * 2), height: px(rr * 2), borderRadius: "50%", boxSizing: "border-box", border: `${px((2.4 - i * 0.6) * S)} solid ${alpha("#d9dde3", 0.55 - i * 0.12)}`, boxShadow: `0 0 ${px(14 * S)} ${alpha(palette.lime ?? accent, 0.25)}`, willChange: "transform" });
				return { r, tilt: 68 + i * 6, spin: (i % 2 ? -1 : 1) * (14 + i * 6), base: i * 50 };
			})
		: [];
	const glow = el("div", "", cam);
	set(glow, { position: "absolute", left: px(ocx - R * 2), top: px(ocy - R * 2), width: px(R * 4), height: px(R * 4), borderRadius: "50%", background: `radial-gradient(circle, ${alpha(accent, 0.35)} 0%, ${alpha(cols[1], 0.18)} 35%, transparent 65%)` });
	const ball = el("div", "", cam);
	set(ball, { position: "absolute", left: px(ocx - R), top: px(ocy - R), width: px(R * 2), height: px(R * 2), borderRadius: "50%", overflow: "hidden", willChange: "transform", boxShadow: `0 ${px(R * 0.15)} ${px(R * 0.6)} ${alpha(accent, 0.35)}` });
	const swirlA = el("div", "", ball);
	set(swirlA, { position: "absolute", left: px(-R * 0.5), top: px(-R * 0.5), width: px(R * 3), height: px(R * 3), background: `conic-gradient(from 0deg at 46% 54%, ${cols[0]}, ${cols[1]}, ${cols[2]}, ${cols[3]}, ${cols[4]}, ${cols[0]})`, filter: `blur(${(R * 0.22).toFixed(1)}px)`, willChange: "transform" });
	const swirlB = el("div", "", ball);
	set(swirlB, { position: "absolute", left: px(-R * 0.5), top: px(-R * 0.5), width: px(R * 3), height: px(R * 3), background: `radial-gradient(circle at 30% 35%, ${alpha(cols[5], 0.85)} 0%, transparent 38%), radial-gradient(circle at 70% 70%, ${alpha(cols[2], 0.9)} 0%, transparent 42%)`, filter: `blur(${(R * 0.12).toFixed(1)}px)`, willChange: "transform" });
	const shade = el("div", "", ball);
	set(shade, { position: "absolute", inset: "0", borderRadius: "50%", background: star ? `radial-gradient(circle at 50% 50%, ${alpha("#fff6e0", 0.55)} 0%, transparent 32%), radial-gradient(circle at 50% 50%, transparent 52%, ${alpha("#2a0a00", 0.75)} 100%)` : `radial-gradient(circle at 34% 28%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.12) 22%, transparent 45%), radial-gradient(circle at 50% 50%, transparent 58%, ${alpha("#000000", 0.28)} 100%)` });
	if (star) set(glow, { background: `radial-gradient(circle, ${alpha(palette.lime ?? accent, 0.55)} 0%, ${alpha(palette.peach ?? accent, 0.22)} 30%, transparent 62%)` });
	const box = el("div","",cam);
	set(box,{position:"absolute",left:px(K.safe.x + K.safe.w * .02),width:px(K.safe.w * .96),top:px(ocy+R*1.35),textAlign:"center",overflow:"hidden"});
	const lineNs=lines.map(text=>{
		const node=el("div","",box,text);set(node,{position:"absolute",left:"0",right:"0",top:"0",color:fg});return node;
	});
	const lineSpec=D.fitGroup(lineNs,{role:"sceneTitle",w:K.safe.w*.96,h:H*.22,wrap:"normal"});
	set(box, { height: px(Math.max(...lineNs.map(n => n.offsetHeight))) });
	const step = Math.max(0.7, (d0 - 0.9) / lines.length);
	const at = lines.map((_, k) => 0.55 + k * step);
	return (l) => {
		const a = E.softLand(prog(l, 0, 0.9));
		let pulse = 0;
		at.forEach((t) => {
			if (l >= t) pulse = Math.max(pulse, Math.exp(-(l - t) * 6) * 0.06);
		});
		const breath = 1 + Math.sin(l * 2.1) * 0.015;
		const sc = (1.5 - 0.5 * a) * breath * (1 + pulse);
		set(ball, { transform: `scale(${sc.toFixed(4)})`, opacity: clamp(a * 2).toFixed(3) });
		set(glow, { transform: `scale(${(sc * (1 + pulse * 2)).toFixed(4)})`, opacity: (clamp(a * 2) * (0.8 + pulse * 3)).toFixed(3) });
		set(swirlA, { transform: `rotate(${(l * 40).toFixed(2)}deg)` });
		for (const g of rings) set(g.r, { opacity: clamp(a * 1.6).toFixed(3), transform: `rotateX(${g.tilt}deg) rotateZ(${(g.base + l * g.spin).toFixed(2)}deg) scale(${(sc * 0.98).toFixed(4)})` });
		set(swirlB, { transform: `rotate(${(-l * 65).toFixed(2)}deg) scale(${(1 + Math.sin(l * 1.3) * 0.08).toFixed(4)})` });
		lineNs.forEach((n, k) => {
			const enter = E.softLand(prog(l, at[k], 0.45));
			const exit = k < lines.length - 1 ? E.accelExit(prog(l, at[k + 1] - 0.05, 0.2)) : 0;
			// A line that has left is gone, not waiting above its window.
			set(n, { transform: `translateY(${((1 - enter) * 105 - exit * 105).toFixed(1)}%)`, opacity: l >= at[k] - 0.01 && exit < 1 ? "1" : "0" });
		});
	};
};
