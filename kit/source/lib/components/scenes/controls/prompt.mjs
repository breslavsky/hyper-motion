// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../../typing.mjs';
export function create(K) {
const { maths, dom, moves, ui } = K.helpers;
const D=K.design;
const { clamp, lerp, prog, smooth, cubicInOut, alpha, mixHex } = maths;
const { el, set, px } = dom;
const { blink } = moves;
const { makeCursor } = ui;
const { W, H, S, plan, spring } = K;
const ARROW_UP =
		'<svg viewBox="0 0 24 24" width="52%" height="52%"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PLUS =
		'<svg viewBox="0 0 24 24" width="50%" height="50%"><path d="M12 5v14M5 12h14" fill="none" stroke="#50525c" stroke-width="2.2" stroke-linecap="round"/></svg>';
return ({ p, cam, accent }) => {
			const s = p.scene;
			const vertical = H > W * 1.2;
			const bw = vertical ? W * 0.86 : Math.min(W * 0.82, 1180 * S);
			// In a tall frame the box is as wide as the frame allows, so its type is what grows.
			let bh = bw * (vertical ? 0.62 : 0.3);
			const chat = el("div", "chat", cam);
			const left = (W - bw) / 2;
			let top = (H - bh) / 2;
			const surface=D.box("card",{density:"compact"}),pad=surface.paddingX,button=D.control("button");
			set(chat, { left: px(left), top: px(top), width: px(bw), height: px(bh) });
			D.surface(chat,"card",{density:"compact"});
			const text = el("div", "chat-text", chat);
			set(text, { position: 'relative' });
			D.apply(text,"body");
			const typed = el("div", "", text);
			set(typed, { whiteSpace: 'pre-wrap' });
			const caret = el("span", "caret", typed);
			set(caret, { width: '.07em', height: '1.05em', marginLeft: '.06em' });
			const typing = createTyping(K, typed, { text: s.text, caret, id: 'prompt.text' });
			const hint = el("span", "", text, s.placeholder ?? "");
			set(hint, { color: "#9a9ca6", position: "absolute", left: '0', top: '0', width: '100%' });
			D.truncateLine(hint);hint.title=s.placeholder??"";
			D.fitSize(text,bw-pad*2,K.safe.h-pad*2-button.height-surface.gap,"body");
			bh=Math.max(bh,text.offsetHeight+pad*2+button.height+surface.gap);
			top=(H-bh)/2;
			set(chat,{top:px(top),height:px(bh)});
			typing.measure();
			const row = el("div", "chat-row", chat);
			D.surfaceGap(row,2);
			const tools = el("div", "chat-tools", row);
			set(tools,{minWidth:"0",maxWidth:px(bw-pad*2-button.height-D.space(2))});
			D.surfaceGap(tools,2);
			const plus = el("div", "chip", tools);
			plus.innerHTML = PLUS;
			set(plus, { width: px(button.height), height: px(button.height), borderRadius:px(button.radius), justifyContent: "center", flex:"none" });
			// The film's own name, and nothing when it has none: a kit writes no words of its own.
			const chip = el("div", "chip", tools);
			if (!plan.brand?.name) chip.style.display = "none";
			D.apply(chip,"button");
			set(chip, { padding: `0 ${px(button.paddingX)}`, height: px(button.height),borderRadius:px(button.radius),minWidth:"0" });
			const chipLabel=el("div","",chip,plan.brand?.name??"");
			D.truncateLine(chipLabel);chipLabel.title=plan.brand?.name??"";
			const send = el("div", "send", row);
			send.innerHTML = ARROW_UP;
			const sd = button.height;
			set(send, { width: px(sd), height: px(sd), flex:"none" });
			const sendX = left + bw - pad - sd / 2;
			const sendY = top + bh - pad - sd / 2;
			const cursor = makeCursor(cam, 70 * S);
			const clickAt = p.clickAt ?? p.dur * 0.74;
			const typeEnd = Math.max(0.5, clickAt - 0.5);
			const focusX = left + bw * 0.42;
			const focusY = top + bh * 0.45;
			return (l) => {
				// The opener is never an empty frame: the box is already rising at t = 0.
				const e = spring(l + 0.14, 2.4, 0.7);
				set(chat, { transform: `translateY(${px((1 - e) * 80 * S)}) scale(${(0.94 + 0.06 * e).toFixed(4)})`, opacity: clamp(0.35 + l / 0.1).toFixed(3) });
				const n = Math.round(clamp((l - 0.25) / (typeEnd - 0.25)) * s.text.length);
				typing.reveal(n);
				set(hint, { opacity: (1 - smooth((l - 0.25) / 0.08)).toFixed(3) });
				set(caret, { opacity: n < s.text.length ? "1" : blink(l - typeEnd).toFixed(3) });
				// The send button lights up and dips over a few frames instead of snapping.
				const lit = smooth((l - clickAt) / 0.1);
				const dip = Math.sin(Math.PI * prog(l, clickAt - 0.02, 0.22));
				set(send, { background: mixHex("#15161a", accent, lit), transform: `scale(${(1 - 0.12 * dip).toFixed(4)})` });
				cursor(l, {
					fx: sendX + 260 * S,
					fy: sendY + 300 * S,
					x: sendX,
					y: sendY,
					start: clickAt - 0.55,
					arrive: clickAt - 0.08,
					click: clickAt,
					ringColor: alpha(accent === "#ffffff" ? "#111111" : accent, 0.9),
				});
				// The camera crops in on the words as they type, then pulls to the send button.
				const z = lerp(1, vertical ? 1.08 : 1.42, cubicInOut(prog(l, 0.2, typeEnd)));
				const toSend = cubicInOut(prog(l, clickAt - 0.6, 0.5));
				const fx = lerp(focusX, sendX - bw * 0.15, toSend);
				const fy = lerp(focusY, sendY - bh * 0.15, toSend);
				// A tall frame has no room to the sides of the box: the camera only comes closer.
				const cx = vertical ? W / 2 : lerp(W / 2, fx, clamp((z - 1) * 3));
				const cy = lerp(H / 2, fy, clamp((z - 1) * 3));
				set(cam, { transform: `translate(${px(W / 2 - cx * z)}, ${px(H / 2 - cy * z)}) scale(${z.toFixed(4)})` });
			};
		};
}
