// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function create(K) {
const { maths, dom } = K.helpers;
const D=K.design;
const { clamp, lerp, prog, expoInOut, hash, textOn, EASE } = maths;
const { el, set, px } = dom;
const { W, H, S, plan, images } = K;
return ({ p, cam, palette }) => {
			const s = p.scene;
			const imgs = (s.images ?? []).map((u) => images[u]).filter(Boolean);
			const brand = plan.brand?.name ?? "";
			const words = s.words?.length ? s.words : [brand, "LAUNCH", "MOTION", "NOW", "FAST", "EASE", "BOLD", "HELLO"];
			const vertical = H > W * 1.2;
			const cols = vertical ? 5 : 7;
			const rows = vertical ? 7 : 5;
			// Cards share a readable heading role. Widen their common geometry for
			// the longest supplied word instead of shrinking labels off the scale.
			const measure=el("span","",cam);D.apply(measure,"cardTitle");
			set(measure,{position:"absolute",whiteSpace:"nowrap",visibility:"hidden"});
			const wordWidth=Math.max(...[brand,...words].map(word=>{measure.textContent=word;return measure.getBoundingClientRect().width;}));
			measure.remove();
			const cardSurface=D.box("card");
			const cw = Math.max(vertical ? W * 0.46 : W * 0.25, wordWidth/.8,wordWidth+cardSurface.paddingX*2);
			const ch = cw * 0.64;
			const gap = D.space(3);
			const persp = el("div", "", cam);
			set(persp, { position: "absolute", inset: "0", perspective: px(1800 * S) });
			const plane = el("div", "plane", persp);
			const colors = [palette.lime, palette.ink, palette.peach, palette.electric, palette.paper, palette.sage, palette.coral, palette.butter, palette.lilac];
			const cards = [];
			const cx = (cols - 1) / 2;
			const cy = (rows - 1) / 2;
			for (let r = 0; r < rows; r++)
				for (let c = 0; c < cols; c++) {
					const i = r * cols + c;
					const hero = c === Math.round(cx) && r === Math.round(cy);
					const card = el("div", "card", plane);
					set(card, {
						left: px((c - cx) * (cw + gap) - cw / 2),
						top: px((r - cy) * (ch + gap) - ch / 2),
						width: px(cw),
						height: px(ch),
						boxShadow: `0 ${px(cw * 0.03)} ${px(cw * 0.08)} rgba(0,0,0,0.18)`,
					});
					const useImg = imgs.length && (hero || hash(i * 5.1) < 0.55);
					D.surface(card,"card",{layout:useImg?"frame":"absolute",...(useImg?{purpose:"media"}:{})});
					if (useImg) {
						const im = el("img", "fill", card);
						im.src = (hero ? imgs[0] : imgs[i % imgs.length]).src;
					} else {
						const bg = colors[Math.floor(hash(i * 2.3) * colors.length)];
						card.style.background = bg;
						const w = el("div", "", card);
						const word = el("span", "display", w, hero ? brand : words[i % words.length]);
						set(w, { position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", color: textOn(bg) });
						D.surfaceContent(card,word);
						D.fitLine(word, Math.min(cw*.8,cw-cardSurface.paddingX*2), ch * 0.5, "cardTitle");
						w.style.width = px(cw);
						w.style.height = px(ch);
					}
					cards.push({ card, hero, phase: hash(i) });
				}
			const startScale = Math.min(W / cw, H / ch) * 0.92;
			return (l, d) => {
				const k = expoInOut(prog(l, 0.08, Math.min(1.1, d * 0.5)));
				const scale = lerp(startScale, vertical ? 0.95 : 1.05, k);
				const rx = lerp(0, 26, k);
				const rz = lerp(0, -11, k);
				const drift = l * 60 * S;
				set(plane, {
					transform: `translate(${px(W / 2 - drift)}, ${px(H / 2 + drift * 0.3)}) rotateX(${rx.toFixed(3)}deg) rotateZ(${rz.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
				});
				for (const c of cards) {
					if (c.hero) continue;
					const a = clamp((k - 0.05 - c.phase * 0.4) / 0.3);
					set(c.card, { opacity: a.toFixed(3) });
				}
			};
		};
}
