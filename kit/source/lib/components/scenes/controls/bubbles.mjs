// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../../typing.mjs';
const ARROW =
	'<svg viewBox="0 0 24 24" width="55%" height="55%"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// ---- bubbles: the same questions, over and over ------------------------------------------------
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, spring, clamp, prog, expoOut, expoIn, hash, lum, alpha, textOn } = K;
	const D = K.design;
	const s = p.scene;
	const dark = lum(bg) < 0.25;
	const vertical = H > W * 1.2;
	const world = el("div", "", cam);
	set(world, { position: "absolute", inset: "0", perspective: px(1300 * S), perspectiveOrigin: "50% 50%", transformStyle: "preserve-3d" });
	const qs = s.questions;

	const columns = H >= W ? 2 : 3;
	const cellWidth=(K.safe.w-D.space(3)*(columns-1))/columns;
	const pill = (parent, text, role, btnBg) => {
		const n = el("div", "", parent);
		const width=role==="controlLabel"?cellWidth:K.safe.w*.8;
		set(n, { width:px(width),position: "absolute", left: "0", top: "0", display: "flex", alignItems: "center", whiteSpace: "nowrap", color: dark ? "#f2f3f7" : "#15171c", background: dark ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.86)", border: `${px(1.5 * S)} solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.95)"}`, boxShadow: dark ? "none" : `0 ${px(14 * S)} ${px(40 * S)} ${alpha("#1a2340", 0.12)}`, backdropFilter: "blur(10px)" });
		const fieldBox = D.surface(n, "field", { density: "compact", shape: "pill" });
		D.apply(n, role);
		const t = el("span", "", n, text);
		set(t,{flex:"1",minWidth:"0",whiteSpace:"normal"});
		if (role === "controlLabel") D.fitSize(t, width - fieldBox.paddingX * 2 - fieldBox.gap - D.type(role).size * 1.2 - 3 * S, D.type(role).lineHeight * 4, role);
		const btn = el("span", "", n);
		btn.innerHTML = ARROW;
		set(btn, { flex: "none", width: "1.2em", height: "1.2em", borderRadius: "50%", display: "grid", placeItems: "center", background: btnBg, color: textOn(btnBg) });
		return { n, t, btn };
	};
	const measures = qs.map(text => pill(world, text, "controlLabel", accent));
	const rowCapacity = Math.max(1, Math.floor(K.safe.h / (Math.max(...measures.map(p => p.n.offsetHeight)) + D.space(4))));
	for (const p of measures) p.n.remove();
	const N = Math.max(qs.length, Math.min(14, qs.length * 3, rowCapacity * columns));
	// Grid cells in a shuffled order, so pills arrive all over the frame.
	const visibleSlots = Math.max(columns, Math.min(N, rowCapacity * columns));
	// How far apart the questions pop, and when the answer lands, is typed and sent: on the film's
	// beats (`p.at`).
	const stagger = p.at.every;
	const SLOTS = Array.from({ length: visibleSlots }, (_, i) => i).sort((a, b) => hash(a * 3.7 + p.index) - hash(b * 3.7 + p.index));
	const P = Array.from({ length: N }, (_, i) => {
		const h = (k) => hash(i * 9.13 + k * 2.71 + p.index * 31.7);
		// Spread over the frame, leaving the middle a little emptier so an answer can land there.
		// A jittered grid, so pills spread over the frame instead of piling up.
		const gc = columns;
		const gr = Math.ceil(visibleSlots / gc);
		const cell = SLOTS[i % visibleSlots];
		let x=K.safe.x+(cell%gc+.5)*(K.safe.w/gc)-W/2;
		let y=K.safe.y+(Math.floor(cell/gc)+.5)*(K.safe.h/gr)-H/2;
		const node = pill(world, qs[i % qs.length], "controlLabel", dark ? "#ffffff" : "#15171c");
		return { ...node, x, y, replacedAt: i + visibleSlots < N ? (i + visibleSlots) * stagger : Infinity, z: -h(3) * 40 * S - 120 * S, ph: h(4) * 6.28, w: node.n.offsetWidth, hh: node.n.offsetHeight };
	});
	const tA = s.answer ? p.at.answer : 1e9;
	let ans = null;
	if (s.answer) {
		ans = pill(cam, "", "caption", accent);
		set(ans.n, { left: "50%", top: "50%", zIndex: "50", boxShadow: `0 ${px(30 * S)} ${px(80 * S)} ${alpha(accent, 0.35)}`, background: dark ? "#ffffff" : "rgba(255,255,255,0.97)", color: "#111318" });
		ans.full = s.answer;
		const caret = el("span", "", ans.t);
		set(caret, { display: "inline-block", width: "0", height: "1em", verticalAlign: "-0.12em", borderLeft: "0.06em solid " + accent, marginLeft: "0" });
		ans.caret = caret;
		ans.typing = createTyping(K, ans.t, { text: s.answer, caret, id: "bubbles-answer" });
		ans.typing.measure();
	}
	return (l, d) => {
		const away = s.answer ? expoIn(prog(l, p.at.away, 0.55)) : 0;
		for (const [i, q] of P.entries()) {
			const t0 = i * stagger;
			const e = l - t0;
			const k = spring(e, 2.4, 0.6);
			const z = q.z + Math.min(l*12*S,60*S) + away*600*S;
			const fly = 1 + away * 0.9;
			const y = q.y + Math.sin(l * 0.9 + q.ph) * 10 * S;
			set(q.n, {
				opacity: (clamp(e / 0.12) * (1 - expoIn(prog(l, q.replacedAt - .12, .12))) * (1 - away) * clamp(1 + z / (1400 * S))).toFixed(3),
				zIndex: String(Math.round(z / 10) + 200),
				transform: `translate3d(${px(W / 2 + q.x * fly - q.w / 2)}, ${px(H / 2 + y * fly - q.hh / 2)}, ${px(z)}) scale(${(0.7 + 0.3 * k).toFixed(4)})`,
			});
		}
		if (ans) {
			const e = l - tA;
			const k = spring(e, 2.5, 0.6);
			const n = Math.floor(clamp((l - p.at.type) / (p.at.typed - p.at.type)) * ans.full.length);
			ans.typing.reveal(n);
			const typing = l > p.at.type && n < ans.full.length;
			set(ans.caret, { opacity: typing ? "1" : K.blink(l).toFixed(3) });
			const sent = expoOut(prog(l, p.at.sent, 0.3));
			set(ans.btn, { transform: `scale(${(1 + 0.25 * Math.sin(sent * Math.PI)).toFixed(3)})` });
			// Once it is alone on screen it floats and keeps pushing in, so the hold never freezes.
			const push = 1 + 0.14 * clamp((l - tA) / Math.max(0.5, d - tA));
			const fl = clamp(e / 0.6);
			set(ans.n, { opacity: clamp(e / 0.12).toFixed(3), transform: `translate(-50%,-50%) translateY(${px(Math.sin(l * 1.5) * 9 * S * fl)}) rotate(${(Math.sin(l * 1.1) * 0.8 * fl).toFixed(3)}deg) scale(${((0.6 + 0.4 * k) * push).toFixed(4)})` });
		}
	};
};

