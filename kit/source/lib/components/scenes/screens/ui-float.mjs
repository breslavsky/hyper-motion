// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function create(K) {
const { maths, dom, ui } = K.helpers;
const D=K.design;
const { clamp, lerp, prog, expoOut, alpha } = maths;
const { el, set, px } = dom;
const { W, H, S, images, glyphText, riseGlyphs, mockUI } = K;
return ({ p, cam, root, fg, accent, palette }) => {
			const s = p.scene;
			const img = s.image ? images[s.image] : null;
			const vertical = H > W * 1.2;
			if (img) {
				const back = el("img", "fill", root);
				back.src = img.src;
				set(back, { position: "absolute", inset: "0", width: "100%", height: "100%", filter: `blur(${px(46 * S)}) saturate(1.2)`, opacity: "0.5", transform: "scale(1.25)" });
				// Behind the life layer and camera (cam sits inside the life layer, not directly in root).
				let front = cam;
				while (front.parentNode && front.parentNode !== root) front = front.parentNode;
				root.insertBefore(back, front.parentNode === root ? front : root.firstChild);
			}
			const persp = el("div", "", cam);
			set(persp, { position: "absolute", inset: "0", perspective: px(2200 * S) });
			let cap = null;
			let capG = [];
			const capH = s.caption ? H * (vertical ? 0.2 : 0.17) : 0;
			if (s.caption) {
				cap = el("div", "display", cam);
				set(cap, { position: "absolute", left: "0", right: "0", top: px(H * (vertical ? 0.1 : 0.07)), textAlign: "center", color: fg, margin: "0 auto" });
				capG = glyphText(cap, s.caption).glyphs;
				D.fitSize(cap, W * 0.86, capH, "sceneTitle");
			}
			const aspect = img ? img.w / img.h : 16 / 10;
			const availH = H - capH - H * (s.caption ? 0.2 : 0.14);
			let cw = W * (vertical ? 0.88 : 0.7);
			let ch = cw / aspect;
			if (ch > availH) {
				ch = availH;
				cw = ch * aspect;
			}
			const card = el("div", "card", persp);
			const top = s.caption ? H * (vertical ? 0.1 : 0.07) + capH + H * 0.05 : (H - ch) / 2;
			set(card, {
				left: px((W - cw) / 2),
				top: px(top),
				width: px(cw),
				height: px(ch),
				boxShadow: `0 ${px(50 * S)} ${px(120 * S)} rgba(0,0,0,0.32), 0 0 0 ${px(1.5 * S)} ${alpha(fg, 0.1)}`,
				transformOrigin: "50% 100%",
			});
			D.surface(card,"card",{layout:"frame",purpose:img?"media":"window"});
			if (img) {
				const im = el("img", "fill", card);
				im.src = img.src;
			} else mockUI(card, palette, accent, p.index);
			return (l, d) => {
				if (capG.length) riseGlyphs(capG, l, { at: 0.02, stagger: 0.022, rot: -6 });
				const e = expoOut(prog(l, 0.05, 0.85));
				const drift = Math.sin((l / d) * Math.PI) * 2;
				set(card, {
					opacity: clamp(l / 0.1).toFixed(3),
					transform: `translateY(${px((1 - e) * H * 0.35)}) rotateX(${lerp(28, 4, e).toFixed(3)}deg) rotateY(${(lerp(-18, -4, e) + drift).toFixed(3)}deg) scale(${lerp(0.9, 1, e).toFixed(4)})`,
				});
			};
		};
}
