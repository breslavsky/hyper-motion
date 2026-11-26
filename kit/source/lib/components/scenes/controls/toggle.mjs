// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function create(K) {
const { maths, dom, ui } = K.helpers;
const D=K.design;
const { clamp, lerp, prog, expoOut, expoInOut, smooth, textOn, alpha } = maths;
const { el, set, px } = dom;
const { makeCursor } = ui;
const { W, H, S, glyphText, riseGlyphs, spring } = K;
return ({ p, cam, fg, accent }) => {
			const s = p.scene;
			const kind = s.kind ?? "switch";
			const vertical = H > W * 1.2;
			const wrap = el("div", "center", cam);
			set(wrap, { gap: px(D.space(5)) });
			const onAt = p.clickAt ?? p.dur * 0.42;
			const tw = Math.min(W * (vertical ? 0.62 : 0.34), H * 0.62);
			const holder = el("div", "", wrap);
			set(holder, { position: "relative", width: px(tw), height: px(kind === "checkbox" ? tw * 0.5 : tw * 0.5), display: "flex", alignItems: "center", justifyContent: "center" });
			const label = el("div", "bold", wrap);
			set(label, { color: fg });
			const labelG = glyphText(label, s.label).glyphs;
			D.fitSize(label, W * 0.8, H * 0.16, "sceneTitle");
			const off = alpha(fg, 0.16);
			const cursor = makeCursor(cam, 110 * S);
			let draw;
			let target = { x: W / 2, y: H / 2 };
			if (kind === "checkbox") {
				const b = tw * 0.42;
				const box = el("div", "", holder);
				set(box, { width: px(b), height: px(b), borderRadius: px(b * 0.24), boxSizing: "border-box", border: `${px(b * 0.08)} solid ${fg}` });
				box.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="${textOn(accent)}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="24" stroke-dashoffset="24"/></svg>`;
				const path = box.querySelector("path");
				draw = (l) => {
					const k = expoOut(prog(l, onAt, 0.35));
					const fk = smooth((l - onAt) / 0.1);
					set(box, { background: fk > 0 ? alpha(accent, fk) : "transparent", borderColor: fk > 0.5 ? accent : fg, transform: `scale(${(1 + 0.12 * Math.sin(prog(l, onAt, 0.3) * Math.PI)).toFixed(4)})` });
					path.setAttribute("stroke-dashoffset", String((1 - k) * 24));
				};
			} else if (kind === "slider") {
				const track = el("div", "", holder);
				const th = tw * 0.07;
				set(track, { position: "absolute", left: "0", right: "0", height: px(th), borderRadius: px(th), background: off });
				const fill = el("div", "", track);
				set(fill, { position: "absolute", left: "0", top: "0", bottom: "0", borderRadius: px(th), background: accent });
				const knob = el("div", "", holder);
				const kd = tw * 0.17;
				set(knob, { position: "absolute", width: px(kd), height: px(kd), borderRadius: "50%", background: "#fff", boxShadow: `0 ${px(8 * S)} ${px(20 * S)} rgba(0,0,0,0.25)`, top: px(tw * 0.25 - kd / 2) });
				draw = (l) => {
					const k = expoInOut(prog(l, onAt, 0.6));
					const x = lerp(0.12, 0.86, k);
					set(knob, { left: px(x * tw - kd / 2) });
					set(fill, { width: px(x * tw) });
				};
			} else {
				const th = tw * 0.5;
				const track = el("div", "", holder);
				set(track, { position: "absolute", inset: "0", borderRadius: px(th), background: off });
				const knob = el("div", "", holder);
				const kd = th * 0.82;
				set(knob, { position: "absolute", top: px((th - kd) / 2), width: px(kd), height: px(kd), borderRadius: px(kd), background: "#fff", boxShadow: `0 ${px(10 * S)} ${px(24 * S)} rgba(0,0,0,0.22)` });
				draw = (l) => {
					const k = spring(l - onAt, 2.6, 0.55);
					const move = Math.sin(clamp(prog(l, onAt, 0.25)) * Math.PI);
					const x = lerp((th - kd) / 2, tw - kd - (th - kd) / 2, k);
					set(knob, { left: px(x), width: px(kd * (1 + 0.28 * move)) });
					set(track, { background: l >= onAt + 0.04 ? accent : off });
				};
			}
			return (l) => {
				const e = spring(l, 2.4, 0.6);
				set(holder, { transform: `scale(${(0.7 + 0.3 * e).toFixed(4)})`, opacity: clamp(l / 0.08).toFixed(3) });
				riseGlyphs(labelG, l, { at: 0.1, stagger: 0.025, rot: -5 });
				draw(l);
				if (!target.set)
					target = { set: true, x: wrap.offsetLeft + holder.offsetLeft + holder.offsetWidth * (kind === "switch" ? 0.28 : 0.5), y: wrap.offsetTop + holder.offsetTop + holder.offsetHeight * 0.55 };
				cursor(l, { fx: target.x + 220 * S, fy: target.y + 260 * S, x: target.x, y: target.y, start: onAt - 0.5, arrive: onAt - 0.05, click: onAt, ringColor: alpha(fg, 0.6) });
			};
		};
}
