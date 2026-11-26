// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../../typing.mjs';
// Without a screenshot or a target the scene is the prompt scene.
import {create as promptScene} from '../controls/prompt.mjs';
export function create(K) {
const { maths, dom, moves, ui } = K.helpers;
const D=K.design;
const { clamp, lerp, prog, expoInOut, smooth, alpha } = maths;
const { el, set, px } = dom;
const { makeCursor } = ui;
const { W, H, S, plan, images, mockUI } = K;
const prompt = promptScene(K);
return (ctx) => {
			const { p, cam, accent, palette, fg } = ctx;
			const s = p.scene;
			const img = s.image ? images[s.image] : null;
			if (!img && !s.target) {
				// No screenshot: the prompt box plays the typing beat instead.
				return prompt({ ...ctx, p: { ...p, scene: { ...s, text: s.typeText ?? plan.brand?.name ?? "" } } });
			}
			const vertical = H > W * 1.2;
			const aspect = img ? img.w / img.h : 16 / 10;
			let cw = W * (vertical ? 0.9 : 0.8);
			let ch = cw / aspect;
			if (ch > H * 0.82) {
				ch = H * 0.82;
				cw = ch * aspect;
			}
			const left = (W - cw) / 2;
			const top = (H - ch) / 2;
			const card = el("div", "card", cam);
			set(card, {
				left: px(left),
				top: px(top),
				width: px(cw),
				height: px(ch),
				boxShadow: `0 ${px(40 * S)} ${px(100 * S)} rgba(0,0,0,0.28), 0 0 0 ${px(1.5 * S)} ${alpha(fg, 0.12)}`,
			});
			D.surface(card,"card",{layout:"frame",purpose:img?"media":"window"});
			if (img) {
				const im = el("img", "fill", card);
				im.src = img.src;
			} else mockUI(card, palette, accent, p.index);
			const tg = s.target ?? { x: 0.3, y: 0.42, w: 0.4, h: 0.09 };
			const tx = left + tg.x * cw;
			const ty = top + tg.y * ch;
			const tw = tg.w * cw;
			const th = tg.h * ch;
			let field = null;
			let typing = null,typingViewport=null,typingFlow=null,typingCaret=null,typingWidth=0;
			if (s.typeText) {
				field = el("div", "", cam);
				const fieldDesign=D.forSurface(th/D.control("button").height);
				set(field, {
					position: "absolute",
					left: px(tx),
					top: px(ty),
					width: px(tw),
					height: px(th),
					background: "#ffffff",
					boxShadow: `0 0 0 ${px(2 * S)} ${alpha(accent, 0.9)}`,
					display: "flex",
					alignItems: "center",
					boxSizing: "border-box",
					overflow: "hidden",
					color: "#15161a",
					whiteSpace: "nowrap",
				});
				fieldDesign.surface(field,"field",{density:"compact"});
				fieldDesign.apply(field,"button");
				typingViewport=el("div","",field);
				typingViewport.dataset.typingViewport='ui-macro.typeText';
				typingViewport.dataset.layoutFitAnchor='ui-macro-input-viewport';
				set(typingViewport,{position:'relative',flex:'1',minWidth:'0',height:px(fieldDesign.type('button').lineHeight),overflow:'hidden'});
				typingFlow=el("div","",typingViewport);
				typingFlow.dataset.typingScroll='ui-macro.typeText';
				set(typingFlow,{position:'relative',width:'max-content',whiteSpace:'pre'});
				typingCaret=el("span","caret",typingFlow);
				set(typingCaret,{width:px(th*.04),height:px(th*.5),marginLeft:px(th*.05)});
				typing=createTyping(K,typingFlow,{text:s.typeText,caret:typingCaret,id:'ui-macro.typeText'});
				typing.measure();
				typingWidth=typingFlow.offsetWidth+typingCaret.offsetWidth+th*.05;
			}
			const flash = el("div", "", cam);
			set(flash, { position: "absolute", left: px(tx), top: px(ty), width: px(tw), height: px(th), borderRadius: px(10 * S), background: accent, mixBlendMode: "multiply" });
			const zoom = clamp((W * (vertical ? 0.8 : 0.55)) / tw, 1.4, 3.6);
			const clickX = tx + tw * (s.typeText ? 0.92 : 0.5);
			const clickY = ty + th * 0.5;
			const cursor = makeCursor(cam, 40 * S);
			const clickAt = p.clickAt ?? p.dur * 0.74;
			const typeEnd = Math.max(0.6, clickAt - 0.45);
			return (l, d) => {
				const e = expoInOut(prog(l, 0.12, 0.7));
				const z = lerp(1, zoom, e);
				const cx = lerp(W / 2, tx + tw / 2, e);
				const cy = lerp(H / 2, ty + th / 2, e);
				const after = expoInOut(prog(l, clickAt + 0.15, d - clickAt));
				// A slow constant push under the moves, so the hold before the click never freezes.
				const z2 = z * (1 + after * 0.12) * (1 + 0.07 * clamp(l / d));
				set(cam, { transform: `translate(${px(W / 2 - cx * z2)}, ${px(H / 2 - cy * z2)}) scale(${z2.toFixed(4)})` });
				if (field) {
					const n = Math.round(clamp((l - 0.55) / (typeEnd - 0.55)) * s.typeText.length);
					typing.reveal(n);
					const insertion=typing.caretAt(n),end=insertion.x+typingCaret.offsetWidth+th*.05;
					const scroll=Math.max(0,Math.min(typingWidth-typingViewport.clientWidth,end-typingViewport.clientWidth));
					set(typingFlow,{transform:`translateX(${px(-scroll)})`});
					set(field, { opacity: clamp((l - 0.45) / 0.1).toFixed(3) });
				}
				set(flash, { opacity: (smooth((l - clickAt) / 0.05) * (1 - smooth(prog(l, clickAt + 0.05, 0.4))) * 0.35).toFixed(3) });
				if (s.click !== false)
					cursor(l, {
						fx: clickX + 140 * S,
						fy: clickY + 170 * S,
						x: clickX,
						y: clickY,
						start: clickAt - 0.5,
						arrive: clickAt - 0.06,
						click: clickAt,
						ringColor: alpha(accent, 0.95),
					});
			};
		};
}
