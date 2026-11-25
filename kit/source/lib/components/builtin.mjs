// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import catalog from './catalog.mjs';
import {surfaceForeground} from './brand-tokens.mjs';
import {createTyping} from './typing.mjs';
export function createBuiltin(K) {
const {maths,dom,moves,ui}=K.helpers;
const D=K.design;
const { clamp, lerp, prog, expoOut, expoIn, expoInOut, smooth, cubicInOut, quartOut, hash, lum, textOn, alpha, mixHex, EASE } = maths;
const { el, set, px, plain } = dom;
const { pulse, odometer, blink } = moves;
const { makeCursor, CURSOR_SVG } = ui;
const ARROW_UP =
		'<svg viewBox="0 0 24 24" width="52%" height="52%"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PLUS =
		'<svg viewBox="0 0 24 24" width="50%" height="50%"><path d="M12 5v14M5 12h14" fill="none" stroke="#50525c" stroke-width="2.2" stroke-linecap="round"/></svg>';

		const { W, H, S, plan, images, glyphText, riseGlyphs, misreg, mockUI, beatKick, spring } = K;

		const SCENES = {};

		SCENES.title = ({ p, cam, fg, accent }) => {
			const s = p.scene;
			const ghost = el("div", "ghost", cam, plain(s.text));
			set(ghost, { color: fg, opacity: "0.05" });
			// The faint copy behind the title stays whole inside the frame: wider than the frame, a
			// short title read as a word cut off at the edge. It is kept only where it is well larger
			// than the title itself (below): next to a title of its own size it reads as a misprint.
			const ghostSize = D.fitSize(ghost, W * 0.96, H * 0.9, "hero");
			const wrap = el("div", "center", cam);
			let label = null, labelTyping = null;
			if (s.sub) {
				label = el("div", "mono", wrap, "");
				D.apply(label,"label");
				set(label, { color: fg, marginBottom: px(D.space(3)), opacity: "0.85" });
				labelTyping = createTyping(K, label, { text: s.sub, id: 'title.sub' });
				D.fitSize(label, W * .84, H * .16, 'label', { align: 'center' });
			}
			const line = el("div", "display", wrap);
			set(line, { color: fg });
			const { glyphs, words } = glyphText(line, s.text);
			for (const w of words)
				if (w.accent) {
					w.node.style.color = accent;
					if (plan.look?.display?.accent === "serif") w.node.classList.add("serif");
				}
			const size = D.fitSize(line, W * 0.86, H * (s.sub ? 0.52 : 0.64), "hero");
			if (ghostSize < size * 1.6) ghost.style.display = "none";
			const landed = 0.03 + Math.min(0.032, 0.55 / Math.max(1, glyphs.length)) * glyphs.length;
			labelTyping?.measure();
			return (l, d) => {
				riseGlyphs(glyphs, l, { at: 0.03 });
				misreg(line, l > landed - 0.05 ? 1 - prog(l, landed, 0.22) : 0);
				if (label) {
					const n = Math.floor(clamp(l / 0.5) * s.sub.length);
					labelTyping.reveal(n);
				}
				set(ghost, {
					transform: `translate(-50%,-50%) translateX(${px(lerp(0.06, -0.06, l / d) * W)})`,
				});
			};
		};

		SCENES.highlight = ({ p, cam, fg, accent }) => {
			const s = p.scene;
			const wrap = el("div", "center", cam);
			const line = el("div", "bold", wrap);
			set(line, { color: fg });
			const { words } = glyphText(line, s.text, { glyphs: false });
			const markText = textOn(accent);
			const marks = [];
			for (const w of words) {
				if (!w.accent) continue;
				const text = w.node.textContent;
				w.node.textContent = "";
				// The swipe first, the word over it in a layer of its own: no negative z-index, which
				// HyperFrames' lint warns of on every publish.
				const mw = el("span", "markword", w.node);
				const m = el("span", "mark", mw);
				el("span", "marktext", mw, text);
				m.style.background = accent;
				marks.push({ w, mw, m });
			}
			if (!marks.length && words.length) {
				// No marked word: mark the longest one.
				const w = [...words].sort((a, b) => b.text.length - a.text.length)[0];
				const text = w.node.textContent;
				w.node.textContent = "";
				// The swipe first, the word over it in a layer of its own: no negative z-index, which
				// HyperFrames' lint warns of on every publish.
				const mw = el("span", "markword", w.node);
				const m = el("span", "mark", mw);
				el("span", "marktext", mw, text);
				m.style.background = accent;
				marks.push({ w, mw, m });
			}
			let sub = null;
			if (s.sub) {
				sub = el("div", "bold", wrap, s.sub);
				set(sub, { color: fg, marginTop: px(D.space(3)) });
			}
			const size = D.fitSize(line, W * 0.84, H * (s.sub ? 0.5 : 0.62), "display");
			if (sub) D.fitSize(sub,W*.84,H*.16,"body");
			const ghostWord = plain(marks[0]?.w.text ?? "");
			const ghost = el("div", "ghost", cam, ghostWord);
			cam.insertBefore(ghost, cam.firstChild);
			set(ghost, { color: fg, opacity: "0.06" });
			// Whole inside the frame, as the title's (above).
			D.fitSize(ghost, W * 0.96, H * 0.9, "hero");
			const step = Math.min(0.11, 0.6 / Math.max(1, words.length));
			const markAt = 0.12 + words.length * step + 0.05;
			return (l, d) => {
				for (const w of words) {
					const t0 = 0.04 + w.index * step;
					const k = spring(l - t0, 3, 0.55);
					set(w.node, {
						opacity: clamp((l - t0) / 0.08).toFixed(3),
						transform: `translateY(${((1 - k) * 0.45).toFixed(4)}em)`,
						filter: `blur(${px((1 - clamp(k)) * 10 * S)})`,
					});
				}
				marks.forEach(({ m, mw }, i) => {
					const k = expoOut(prog(l, markAt + i * 0.12, 0.42));
					set(m, { transform: `scaleX(${k.toFixed(4)}) rotate(-1.2deg)` });
					set(mw, { color: k > 0.45 ? markText : fg });
				});
				if (sub) {
					const k = expoOut(prog(l, markAt + 0.18, 0.4));
					set(sub, { opacity: k.toFixed(3), transform: `translateY(${px((1 - k) * 30 * S)})` });
				}
				set(ghost, { transform: `translate(-50%,-50%) translateX(${px(lerp(-0.05, 0.05, l / d) * W)})` });
			};
		};

		SCENES.swap = ({ p, cam, fg, accent }) => {
			const s = p.scene;
			const vertical = H > W * 1.2;
			const wrap = el("div", "center", cam);
			const row = el("div", "bold", wrap);
			// Both states share one display role; measure the widest state before animation.
			set(row, {
				display: "flex",
				flexDirection: vertical ? "column" : "row",
				alignItems: "center",
				gap: px(D.space(3)),
				color: fg,
				whiteSpace: "nowrap",
			});
			const lead = el("span", "", row);
			const leadG = glyphText(lead, s.lead).glyphs;
			const slot = el("span", "", row);
			set(slot, { position: "relative", display: "grid" });
			const from = el("span", "", slot, s.from);
			set(from, { gridArea:"1 / 1", alignSelf:"center", whiteSpace: "nowrap" });
			const pill = el("span", "pill", slot, s.to);
			set(pill, {
				position: "relative",
				gridArea:"1 / 1",
				background: accent,
				color: textOn(accent),
				boxSizing: "border-box",
				transformOrigin: "30% 60%",
			});
			D.surface(pill,"badge");
			D.surfaceGap(row,3);
			const role=D.fitGroup([lead,from,pill],{role:"display",w:vertical?W*.84:(W*.88-D.space(3))/2,h:H*.32});
			D.apply(row,"display",{step:role.step});
			row.style.maxWidth=px(W*.88);
			const fromW=from.offsetWidth,pillW=pill.offsetWidth,slotH=slot.offsetHeight;
			set(slot,{display:"inline-block",width:px(fromW),height:px(slotH)});
			set(from,{position:"absolute",left:"0",top:px((slotH-from.offsetHeight)/2),width:px(fromW)});
			set(pill,{position:"absolute",left:"0",top:"0",width:px(pillW)});
			const swapAt = Math.max(0.55, p.dur * 0.42);
			return (l) => {
				riseGlyphs(leadG, l, { at: 0.02, stagger: 0.025, rot: -6 });
				const fIn = spring(l - 0.12, 3, 0.6);
				const fOut = expoIn(prog(l, swapAt - 0.05, 0.22));
				set(from, {
					opacity: (clamp((l - 0.12) / 0.08) * (1 - fOut)).toFixed(3),
					transform: `translateY(${((1 - fIn) * 0.5 - fOut * 0.9).toFixed(4)}em)`,
					filter: `blur(${px(fOut * 12 * S)})`,
				});
				const pk = spring(l - swapAt, 3.4, 0.45);
				set(pill, {
					opacity: l >= swapAt ? "1" : "0",
					transform: `translateY(${((1 - clamp(pk)) * 0.5).toFixed(4)}em) scale(${(0.5 + 0.5 * pk).toFixed(4)}) rotate(${((1 - pk) * -8).toFixed(3)}deg)`,
				});
				const w = lerp(fromW, pillW, clamp(spring(l - swapAt, 2.6, 0.7)));
				set(slot, { width: px(w) });
			};
		};

		SCENES.fullbleed = ({ p, cam, fg }) => {
			const s = p.scene;
			if (s.variant === "repeat") {
				const rows = [];
				const n = H > W ? 7 : 5;
				const box = el("div", "", cam);
				set(box, { position: "absolute", inset: "0", display: "flex", flexDirection: "column", justifyContent: "center" });
				for (let i = 0; i < n; i++) {
					const r = el("div", "display", box, `${s.text} ${s.text} ${s.text} ${s.text} ${s.text}`);
					set(r, { whiteSpace: "nowrap", color: fg });
					D.apply(r,"display");
					// Echo rows: the same word, faint. (Outline strokes show a variable font's
					// internal contours, so the echoes are tinted instead.)
					if (i !== Math.floor(n / 2)) r.style.color = alpha(fg, 0.17);
					rows.push(r);
				}
				// Repeated ribbons may extend past the sides; their vertical rhythm is token-owned.
				return (l) => {
					rows.forEach((r, i) => {
						const dir = i % 2 ? 1 : -1;
						const k = expoOut(prog(l, i * 0.04, 0.5));
						set(r, {
							transform: `translateX(${px(-W * 0.6 + dir * (l * 120 * S + (1 - k) * 300 * S))})`,
							opacity: k.toFixed(3),
						});
					});
				};
			}
			const wrap = el("div", "center", cam);
			const line = el("div", "display", wrap);
			set(line, { color: fg, overflow: "visible" });
			const { glyphs } = glyphText(line, s.text);
			D.fitLine(line, W * 0.92, H * 0.8, "hero");
			return (l, d) => {
				const st = Math.min(0.035, 0.32 / Math.max(1, glyphs.length));
				for (const g of glyphs) {
					const k = expoOut(prog(l, g.i * st, 0.42));
					set(g.node, { transform: `translateY(${((1 - k) * 1.05).toFixed(4)}em)` });
				}
				set(wrap, { transform: `scale(${(1 + 0.05 * (l / d)).toFixed(4)})` });
			};
		};

		SCENES.grid = ({ p, cam, fg, accent, palette }) => {
			const s = p.scene;
			const n = s.words.length;
			const vertical = H > W * 1.2;
			const square = !vertical && W < H * 1.3;
			let cols;
			if (vertical) cols = n <= 3 ? 1 : 2;
			else if (square) cols = 2;
			else cols = n <= 3 ? n : n === 4 ? 2 : 3;
			if (square && n === 3) cols = 1;
			const rows = Math.ceil(n / cols);
			const pad = D.space(5);
			const gap = D.space(2);
			const tw = (W - pad * 2 - gap * (cols - 1)) / cols;
			const th = (H - pad * 2 - gap * (rows - 1)) / rows;
			const ink = palette.ink;
			const paper = palette.paper;
			const fills = [ink, paper, accent, paper, ink, accent];
			const tiles = s.words.map((word, i) => {
				const c = i % cols;
				const r = Math.floor(i / cols);
				const t = el("div", "tile", cam);
				const bg = fills[(i + (r % 2)) % fills.length];
				set(t, {
					left: px(pad + c * (tw + gap)),
					top: px(pad + r * (th + gap)),
					width: px(tw),
					height: px(th),
					background: bg,
					color: textOn(bg),
				});
				const tile=D.surface(t,"card",{layout:"absolute"});
				const w = el("div", "display", t, word);
				D.surfaceContent(t,w);
				D.fitSize(w, Math.min(tw*.82,tw-tile.paddingX*2), Math.min(th*.62,th-tile.paddingY*2), "display",{align:"center"});
				return { t, w };
			});
			cam.parentNode.style.perspective = px(2400 * S);
			const st = Math.min(p.beatLen / 2, (p.dur * 0.55) / n);
			return (l) => {
				tiles.forEach(({ t, w }, i) => {
					const t0 = i * st;
					const k = spring(l - t0, 2.8, 0.6);
					set(t, {
						opacity: clamp((l - t0) / 0.05).toFixed(3),
						transform: `rotateX(${((1 - k) * -75).toFixed(3)}deg) scale(${(0.86 + 0.14 * k).toFixed(4)})`,
					});
					const wk = expoOut(prog(l, t0 + 0.06, 0.4));
					set(w, { transform: `translateY(${((1 - wk) * 0.6).toFixed(4)}em)` });
				});
			};
		};

		SCENES.wall = ({ p, cam, palette }) => {
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

		SCENES.prompt = ({ p, cam, accent }) => {
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

		SCENES["ui-macro"] = (ctx) => {
			const { p, cam, accent, palette, fg } = ctx;
			const s = p.scene;
			const img = s.image ? images[s.image] : null;
			if (!img && !s.target) {
				// No screenshot: the prompt box plays the typing beat instead.
				return SCENES.prompt({ ...ctx, p: { ...p, scene: { ...s, text: s.typeText ?? plan.brand?.name ?? "" } } });
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

		SCENES["ui-float"] = ({ p, cam, root, fg, accent, palette }) => {
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

		SCENES.counter = ({ p, cam, fg, accent }) => {
			const s = p.scene;
			const wrap = el("div", "center", cam);
			const num = el("div", "display", wrap);
			set(num, { color: fg, fontVariantNumeric: "tabular-nums" });
			const decimals = (String(s.value).split(".")[1] ?? "").length;
			const final = `${s.prefix ?? ""}${s.value.toFixed(decimals)}${s.suffix ?? ""}`;
			num.textContent = final;
			const size = D.fitLine(num, W * 0.8, H * 0.5, "hero");
			const label = el("div", "bold", wrap, s.label);
			D.fitSize(label,W*.8,H*.16,"caption");
			set(label, { color: fg, marginTop: px(D.space(4)), position: "relative" });
			const bar = el("div", "", label);
			set(bar, { position: "absolute", left: "0", right: "0", bottom: "-0.28em", height: "0.16em", background: accent, transformOrigin: "0 50%", borderRadius: "0.08em" });
			const countDur = Math.min(1.2, p.dur * 0.7);
			// Rolling digits between the prefix and suffix, sized for the widest value it passes.
			num.textContent = "";
			if (s.prefix) el("span", "", num, s.prefix);
			const roll = odometer(el("span", "", num), (s.value === 0 ? 99 : Math.abs(s.value)).toFixed(decimals));
			if (s.suffix) el("span", "", num, s.suffix);
			return (l) => {
				const k = expoOut(prog(l, 0.04, countDur));
				roll(s.value === 0 ? lerp(99, 0, k) : lerp(0, s.value, k));
				const e = spring(l, 2.6, 0.55);
				set(num, { transform: `translateY(${px((1 - e) * 60 * S)}) scale(${(0.9 + 0.1 * e).toFixed(4)})`, opacity: clamp(l / 0.08).toFixed(3) });
				const lk = expoOut(prog(l, 0.25, 0.5));
				set(label, { opacity: lk.toFixed(3), transform: `translateY(${px((1 - lk) * 24 * S)})` });
				set(bar, { transform: `scaleX(${expoOut(prog(l, 0.45, 0.5)).toFixed(4)})` });
			};
		};

		SCENES.toggle = ({ p, cam, fg, accent }) => {
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

		const logoNode = (parent, size, bg) => {
			const logo = plan.brand?.logo ? images[plan.brand.logo] : null;
			const n = el("div", "", parent);
			set(n, { width: px(size), height: px(size), borderRadius: px(size * 0.24), background: bg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flex: "none" });
			if (logo) {
				const im = el("img", "", n);
				im.src = logo.src;
				set(im, { width: "78%", height: "78%", objectFit: "contain" });
			} else {
				const t = el("div", "display", n, (plan.brand?.name ?? "K").trim().charAt(0).toUpperCase());
				D.forSurface(size/(D.unit*32)).apply(t,"initials");
				set(t, { color: textOn(bg) });
			}
			return n;
		};

		SCENES.logo3d = ({ p, cam, fg, accent, palette }) => {
			const s = p.scene;
			const vertical = H > W * 1.2;
			const size = Math.min(W, H) * 0.32;
			const wrap = el("div", "center", cam);
			set(wrap, { flexDirection: vertical ? "column" : "row", gap: px(D.space(6)) });
			const scene3d = el("div", "", wrap);
			set(scene3d, { width: px(size), height: px(size), perspective: px(size * 4), flex: "none" });
			const cube = el("div", "", scene3d);
			set(cube, { position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d" });
			const brand = palette.brand;
			const faceColors = [brand, palette.brand2, palette.lime, palette.ink, accent, palette.peach];
			const rots = ["", "rotateY(90deg)", "rotateY(180deg)", "rotateY(-90deg)", "rotateX(90deg)", "rotateX(-90deg)"];
			const faces = rots.map((r, i) => {
				const f = el("div", "face", cube);
				set(f, { transform: `${r} translateZ(${px(size / 2)})`, background: faceColors[i], borderRadius: px(size * 0.06) });
				if (i === 0) {
					f.style.background = "transparent";
					const ln = logoNode(f, size, brand);
					ln.querySelector('[data-design-role="initials"]')?.setAttribute("data-design-glyph-art","logo-face");
					set(ln, { borderRadius: px(size * 0.06) });
					f.__logo = ln;
				} else {
					const t = el("div", "display", f, (plan.brand?.name ?? "K").charAt(0).toUpperCase());
					D.forSurface(size/(D.unit*32)).apply(t,"initials");
					t.dataset.designGlyphArt="logo-face";
					set(t, { color: textOn(faceColors[i]) });
				}
				return f;
			});
			const name = el("div", "display", wrap);
			set(name, { color: fg });
			const nameG = glyphText(name, s.text ?? plan.brand?.name ?? "").glyphs;
			D.fitSize(name, vertical ? W * 0.85 : W * 0.5, vertical ? H * 0.2 : H * 0.36, "display");
			const spinEnd = Math.min(1.3, p.dur * 0.6);
			// The cube spins alone at the centre, then slides over as the name lands beside it.
			const gapPx = D.space(6);
			const shift = ((vertical ? name.offsetHeight : name.offsetWidth) + gapPx) / 2;
			return (l) => {
				const slide = 1 - expoInOut(prog(l, spinEnd - 0.3, 0.55));
				set(wrap, { transform: vertical ? `translateY(${px(shift * slide)})` : `translateX(${px(shift * slide)})` });
				const k = expoOut(prog(l, 0, spinEnd));
				const e = spring(l, 2, 0.6);
				// After the spin it keeps a slow sway, so the logo never freezes on screen.
				const live = smooth((l - spinEnd) / 0.8);
				const ry = (1 - k) * 450 - 25 * (1 - k) + Math.sin((l - spinEnd) * 0.9) * 9 * live;
				const rx = (1 - k) * -160 + Math.sin((l - spinEnd) * 0.7) * 5 * live;
				set(cube, { transform: `translateZ(${px(-size / 2)}) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) scale(${(0.4 + 0.6 * e).toFixed(4)})` });
				const flat = expoOut(prog(l, spinEnd - 0.1, 0.4));
				faces.forEach((f, i) => {
					if (i === 0) {
						set(f.__logo, { borderRadius: px(size * lerp(0.06, 0.24, flat)) });
						return;
					}
					set(f, { opacity: (1 - flat).toFixed(3) });
				});
				riseGlyphs(nameG, l, { at: spinEnd - 0.25, stagger: 0.03 });
			};
		};

		SCENES.endcard = ({ p, cam, fg, accent }) => {
			fg=K.surfaceForeground=surfaceForeground(catalog.endcard.surface,p.bg,plan.palette,fg,{explicit:p.explicitForeground??(p.scene.fg!==undefined||K.plan.brand?.tokens?.foreground!==undefined)});
			const s = p.scene;
			const wrap = el("div", "center", cam);
			const size = Math.min(W, H) * 0.17;
			const logo = logoNode(wrap, size, plan.palette.brand);
			set(logo, { marginBottom: px(D.space(5)), boxShadow: `0 ${px(20 * S)} ${px(50 * S)} rgba(0,0,0,0.18)` });
			const name = el("div", "display", wrap);
			set(name, { color: fg });
			const g = glyphText(name, plan.brand?.name ?? "").glyphs;
			D.fitSize(name, W * 0.82, H * 0.3, "display");
			let tag = null;
			if (s.tagline) {
				tag = el("div", "bold", wrap, s.tagline);
				set(tag, { color: fg, marginTop: px(D.space(3)), opacity: "0.8", whiteSpace: "normal", textAlign: "center" });
				// Long brand copy wraps at a readable size instead of shrinking below
				// the shared label floor. Leave room for the camera's final push.
				D.fitSize(tag, K.safe.w * 0.88, H * 0.14, "body");
			}
			const pill = el("div", "pill mono", wrap, s.cta);
			pill.dataset.designControl="button";pill.dataset.designControlLayout="flow";
			const shine = textOn(accent) === "#ffffff" ? 0.2 : 0.45;
			const button = D.control("button");
			D.apply(pill,"button");
			set(pill, { background: accent, color: textOn(accent), padding: `${px(button.paddingY)} ${px(button.paddingX)}`, borderRadius:px(button.radius), marginTop: px(D.space(4)), maxWidth:px(K.safe.w*.82), whiteSpace: "normal", textAlign: "center", boxSizing: "border-box" });
			const seeds = g.map((x) => ({ dx: hash(x.i * 3.3) * 2 - 1, dy: hash(x.i * 7.7) * 2 - 1, r: hash(x.i * 1.9) * 2 - 1, at: hash(x.i * 4.4) * 0.35 }));
			return (l) => {
				const le = spring(l, 2.4, 0.5);
				// Once landed it keeps living: the logo floats, the pill kicks on the beat and a light
				// sweeps across it, so the last frames of a film never freeze.
				const alive = clamp((l - 1) / 0.6);
				// The whole card keeps a slow push, so a long end card never sits frozen.
				set(wrap, { transform: `scale(${(1 + 0.05 * clamp(l / Math.max(1, p.dur))).toFixed(4)})` });
				set(logo, { transform: `translateY(${px(Math.sin(l * 2.2) * 10 * S * alive)}) scale(${le.toFixed(4)}) rotate(${((1 - le) * -30 + Math.sin(l * 1.6) * 3 * alive).toFixed(3)}deg)` });
				g.forEach((x, i) => {
					const sd = seeds[i];
					const k = spring(l - 0.12 - sd.at, 2.6, 0.62);
					set(x.node, {
						opacity: clamp((l - 0.12 - sd.at) / 0.08).toFixed(3),
						transform: `translate(${((1 - k) * sd.dx * 1.6).toFixed(4)}em, ${((1 - k) * sd.dy * 1.2).toFixed(4)}em) rotate(${((1 - k) * sd.r * 70).toFixed(3)}deg) scale(${(0.5 + 0.5 * k).toFixed(4)})`,
					});
				});
				if (tag) {
					const k = expoOut(prog(l, 0.6, 0.5));
					set(tag, { opacity: (k * 0.8).toFixed(3), transform: `translateY(${px((1 - k) * 20 * S)})` });
				}
				const pk = spring(l - 0.75, 2.6, 0.55);
				const kickP = beatKick(p.start + l) * 0.035 * alive;
				const sweep = ((l * 0.55) % 1.3) - 0.15;
				set(pill, {
					opacity: clamp((l - 0.75) / 0.08).toFixed(3),
					transform: `translateY(${px((1 - pk) * 40 * S)}) scale(${(0.8 + 0.2 * pk + kickP).toFixed(4)})`,
					backgroundImage: alive > 0 ? `linear-gradient(105deg, transparent ${((sweep - 0.12) * 100).toFixed(1)}%, rgba(255,255,255,${shine}) ${(sweep * 100).toFixed(1)}%, transparent ${((sweep + 0.12) * 100).toFixed(1)}%)` : "none",
				});
			};
		};

		/** Stacked poster lines, each slamming in on its beat; the last one echoes. Crumbs decode around it. */
		SCENES.slam = ({ p, cam, fg, accent }) => {
			const s = p.scene;
			const marks = p.marks ?? s.lines.map((_, i) => i * p.beatLen);
			const wrap = el("div", "center", cam);
			const n = s.lines.length;
			const lines = s.lines.map((text, i) => {
				const node = el("div", "display", wrap);
				set(node, { color: i === n - 1 && n > 1 ? accent : fg, whiteSpace: "nowrap", position: "relative" });
				const g = glyphText(node, text).glyphs;
				set(node,{maxWidth:px(K.safe.w*.96),whiteSpace:"normal",textAlign:"center"});
				D.apply(node,"hero");
				return { node, g };
			});
			// Echoes of the last line, tinted, that slide apart once it lands.
			const last = lines[n - 1];
			const echoes = [1, 2].map((dir) => {
				const e = el("div", "display", last.node, s.lines[n - 1]);
				e.setAttribute("data-deco", ""); // an echo of the line, not a line to read
				set(e, { position: "absolute", left: "0", top: "0", width: "100%", color: alpha(fg, dir === 1 ? 0.18 : 0.08), pointerEvents: "none", zIndex: "-1" });
				return { e, dir };
			});
			const crumbGap = D.space(2);
			const crumbWidth = (K.safe.w - crumbGap * 2) / 3;
			const crumbs = (s.crumbs ?? []).slice(0, 6).map((text, i) => {
				const c = el("div", "mono", cam);
				set(c, { position: "absolute", left: px(K.safe.x + (i % 3) * (crumbWidth + crumbGap)), top: px(i < 3 ? K.safe.y : K.safe.y + K.safe.h - D.type("label").lineHeight * 2), width: px(crumbWidth), textAlign: "center", color: alpha(fg, 0.8), whiteSpace: "normal" });
				D.apply(c,"label");
				const { glyphs: g, words } = glyphText(c, text);
				// Words remain atomic; wrapping happens between words, not between glyphs.
				return { node:c,g, at: 0.2 + i * Math.min(0.3, (p.dur * 0.7) / Math.max(1, s.crumbs.length)) };
			});
			const topH=Math.max(0,...crumbs.slice(0,3).map(c=>c.node.offsetHeight)),bottomH=Math.max(0,...crumbs.slice(3).map(c=>c.node.offsetHeight));
			const topGap=topH?D.space(3):0,bottomGap=bottomH?D.space(3):0;
			for(const c of crumbs.slice(3))c.node.style.top=px(K.safe.y+K.safe.h-bottomH);
			set(wrap,{paddingTop:px(K.safe.y+topH+topGap),paddingBottom:px(H-K.safe.y-K.safe.h+bottomH+bottomGap)});
			const lineBudget=K.safe.h-topH-bottomH-topGap-bottomGap;
			for(const spec of D.steps("hero")){
				for(const {node}of lines)D.apply(node,"hero",{step:spec.step});
				if(lines.every(({node})=>node.scrollWidth<=K.safe.w*.96+1)&&lines.reduce((h,{node})=>h+node.offsetHeight,0)<=lineBudget)break;
			}
			const lineHeights=lines.map(({node})=>node.offsetHeight);
			const densePoster=lineHeights.reduce((a,b)=>a+b,0)>lineBudget;
			if(lines.some(({node},i)=>node.scrollWidth>K.safe.w*.96+1||lineHeights[i]>lineBudget))throw new Error("Poster copy exceeds the readable line capacity");
			// Dense posters keep the latest complete lines visible at the same
			// semantic size; each line still enters on its authored beat.
			return (l) => {
				let newest=0;
				for(let i=0;i<marks.length;i++)if(l>=marks[i])newest=i;
				let first=newest,height=lineHeights[newest];
				while(first>0&&height+lineHeights[first-1]<=lineBudget){height+=lineHeights[--first];}
				for(let i=0;i<lines.length;i++)lines[i].node.style.display=!densePoster||(i>=first&&i<=newest)?"block":"none";
				let punch = 0;
				let pan = 0;
				lines.forEach(({ node, g }, i) => {
					riseGlyphs(g, l, { at: marks[i], stagger: 0.022, mode: "slam" });
					misreg(node, l > marks[i] ? 1 - prog(l, marks[i] + 0.06, 0.18) : 0);
					if (l > marks[i]) {
						const k = Math.exp(-(l - marks[i]) * 7);
						punch += 0.04 * k;
						pan += (i % 2 ? 1 : -1) * 26 * S * k;
					}
				});
				const lastAt = marks[n - 1] + 0.12;
				for (const { e, dir } of echoes) {
					const k = expoOut(prog(l, lastAt, 0.5));
					set(e, { opacity: k.toFixed(3), transform: `translateY(${(dir * k * 0.92).toFixed(4)}em)` });
				}
				for (const c of crumbs) riseGlyphs(c.g, l, { at: c.at, stagger: 0.02, mode: "scramble" });
				set(wrap, { transform: `translateX(${px(pan)}) scale(${(1 + punch).toFixed(4)})` });
			};
		};

		/** One shape, never cut: a UI element morphing state to state on the beat, driven by the cursor. */
		const MORPH_SHAPES = {
			button: { w: 520, h: 150, r: 75 },
			loader: { w: 150, h: 150, r: 75 },
			check: { w: 150, h: 150, r: 75 },
			toggle: { w: 300, h: 160, r: 80 },
			slider: { w: 780, h: 70, r: 35 },
			player: { w: 780, h: 210, r: 48 },
			tabs: { w: 780, h: 124, r: 62 },
			search: { w: 840, h: 134, r: 34 },
			toast: { w: 660, h: 134, r: 67 },
		};
		SCENES.morph = ({ p, cam, accent, bg }) => {
			const s = p.scene;
			const states = s.states;
			const marks = p.marks ?? states.map((_, i) => (i * p.dur) / states.length);
			const k = S * (W > H ? 1.25 : 1.05);
			const controls=D.forSurface((3*k)/D.unit),button=controls.control("button");
			const labelMeasure=el("span","",cam,s.label??"→");
			controls.apply(labelMeasure,"button");
			set(labelMeasure,{position:"absolute",whiteSpace:"nowrap",visibility:"hidden"});
			const MORPH=Object.fromEntries(Object.entries(MORPH_SHAPES).map(([state,geometry])=>[state,{...geometry}]));
			Object.assign(MORPH,{button:{w:Math.min(K.safe.w,labelMeasure.getBoundingClientRect().width+button.paddingX*2)/k,h:button.height/k,r:button.radius/k}});
			labelMeasure.remove();
			const ink = lum(bg) > 0.4 ? "#111111" : "#f4f4f4";
			const onInk = textOn(ink);
			const solid = (st) => (st === "check" || st === "toggle" ? accent : st === "search" ? "#ffffff" : st === "slider" ? mixHex(bg, ink, 0.14) : ink);
			const shape = el("div", "", cam);
			set(shape, { position: "absolute", overflow: "hidden", boxShadow: `0 ${px(24 * S)} ${px(60 * S)} rgba(0,0,0,0.16)` });
			const layer = (st, index) => {
				const c = el("div", "", shape);
				set(c, { position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", gap: px(controls.space(2)), color: onInk, whiteSpace: "nowrap" });
				const d = MORPH[st];
				const ctl = { c, st };
				if (st === "button") {
					controls.apply(c,"button");
					const label=el("div","",c,s.label??"→");
					set(label,{maxWidth:`calc(100% - ${px(button.paddingX*2)})`});
					controls.truncateLine(label);label.title=s.label??"→";
				} else if (st === "loader") {
					c.innerHTML = `<svg viewBox="0 0 50 50" width="${(80 * k).toFixed(0)}" height="${(80 * k).toFixed(0)}"><circle cx="25" cy="25" r="19" fill="none" stroke="${alpha(onInk, 0.25)}" stroke-width="5"/><circle cx="25" cy="25" r="19" fill="none" stroke="${onInk}" stroke-width="5" stroke-linecap="round" stroke-dasharray="40 200"/></svg>`;
					ctl.spin = c.querySelector("svg");
				} else if (st === "check") {
					c.innerHTML = `<svg viewBox="0 0 24 24" width="${(84 * k).toFixed(0)}" height="${(84 * k).toFixed(0)}"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="${textOn(accent)}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="24" stroke-dashoffset="24"/></svg>`;
					ctl.path = c.querySelector("path");
				} else if (st === "toggle") {
					const knob = el("div", "", c);
					set(knob, { position: "absolute", top: px(14 * k), width: px(132 * k), height: px(132 * k), borderRadius: "50%", background: "#fff", boxShadow: `0 ${px(6 * k)} ${px(14 * k)} rgba(0,0,0,0.2)` });
					ctl.knob = knob;
				} else if (st === "slider") {
					const fill = el("div", "", c);
					set(fill, { position: "absolute", left: "0", top: "0", bottom: "0", background: accent, borderRadius: px(35 * k) });
					const knob = el("div", "", shape);
					set(knob, { position: "absolute", top: px(-13 * k), width: px(96 * k), height: px(96 * k), borderRadius: "50%", background: "#fff", boxShadow: `0 ${px(8 * k)} ${px(20 * k)} rgba(0,0,0,0.25)` });
					ctl.fill = fill;
					ctl.knob = knob;
				} else if (st === "player") {
					set(c, { justifyContent: "flex-start" });
					controls.surface(c,"card",{density:"compact"});
					MORPH.player.r=controls.box("card",{density:"compact"}).radius/k;
					const btn = el("div", "", c);
					set(btn, { width: px(110 * k), height: px(110 * k), borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" });
					btn.innerHTML = `<svg viewBox="0 0 24 24" width="46%" height="46%"><path d="M7 5l12 7-12 7z" fill="${textOn(accent)}"/></svg>`;
					const col = el("div", "", c);
					set(col, { flex: "1", minWidth:"0", display: "flex", flexDirection: "column", gap: px(controls.space(2)) });
					const t = el("div", "", col, plan.brand?.name ?? "Launch film");
					controls.apply(t,"controlLabel");
					controls.truncateLine(t);t.title=plan.brand?.name??"Launch film";
					const bar = el("div", "", col);
					set(bar, { height: px(10 * k), borderRadius: px(5 * k), background: alpha(onInk, 0.2), position: "relative", overflow: "hidden" });
					const fillBar = el("div", "", bar);
					set(fillBar, { position: "absolute", left: "0", top: "0", bottom: "0", background: onInk, borderRadius: px(5 * k) });
					ctl.prog = fillBar;
				} else if (st === "tabs") {
					const ind = el("div", "", c);
					set(ind, { position: "absolute", top: px(14 * k), height: px(96 * k), borderRadius: px(48 * k), background: accent });
					const tabW = (d.w * k - 28 * k) / 3;
					["Write", "Edit", "Export"].forEach((name, i) => {
						const t = el("div", "", c, name);
						set(t, { position: "absolute", left: px(14 * k + i * tabW), width: px(tabW), textAlign: "center", zIndex: "1" });
						controls.apply(t,"button");
						controls.truncateLine(t);t.title=name;
					});
					ctl.ind = ind;
					ctl.tabW = tabW;
				} else if (st === "search") {
					set(c, { justifyContent: "flex-start", color: "#15161a" });
					const field=controls.surface(c,"field");
					MORPH.search.r=field.radius/k;
					const kbd = el("div", "mono", c, "⌘K");
					controls.apply(kbd,"code");
					set(kbd, { background: "#efeff2", color: "#50525c" });
					controls.surface(kbd,"badge",{density:"compact"});
					const q = el("div", "", c);
					controls.apply(q,"body");
					const query = s.text ?? plan.brand?.name ?? "";
					const qw = d.w * k - field.paddingX * 2 - kbd.offsetWidth - field.gap;
					set(q, { width: px(qw), minWidth: '0', flex: 'none' });
					ctl.typing = createTyping(K, q, { text: query, id: `morph.search.${index}` });
					// Keep the public maximum query readable inside the same surface.
					// Its full reserved layout may use two lines; keys only reveal ink.
					controls.fitSize(q, qw, MORPH_SHAPES.search.h * k, 'body');
					d.h=Math.max(d.h,(q.offsetHeight+field.paddingY*2)/k);
					ctl.typing.measure();
				} else if (st === "toast") {
					controls.surface(c,"badge",{density:"comfortable",shape:"pill"});
					const dot = el("div", "", c);
					set(dot, { width: px(76 * k), height: px(76 * k), borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" });
					dot.innerHTML = `<svg viewBox="0 0 24 24" width="60%" height="60%"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="${textOn(accent)}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
					const t = el("div", "", c, s.text ?? "");
					controls.apply(t,"body");
					set(t,{flex:"1"});controls.truncateLine(t);t.title=s.text??"";
				}
				return ctl;
			};
			const layers = states.map(layer);
			const cursor = makeCursor(cam, 84 * S);
			// Springs summed per target change keep every property a pure function of time.
			const chain = (get) => (l) => {
				let v = get(states[0]);
				for (let i = 1; i < states.length; i++) v += (get(states[i]) - get(states[i - 1])) * spring(l - marks[i], 3.1, 0.62);
				return v;
			};
			const wOf = chain((st) => MORPH[st].w * k);
			const hOf = chain((st) => MORPH[st].h * k);
			const rOf = chain((st) => MORPH[st].r * k);
			const cx = W / 2;
			const cy = H / 2;
			/** Where the cursor acts in a state, in stage coordinates (the shape is centred). */
			const actionPoint = (st) => {
				const d = MORPH[st];
				if (st === "toggle") return { x: cx - d.w * k * 0.22, y: cy };
				if (st === "slider") return { x: cx - d.w * k * 0.38, y: cy };
				if (st === "player") return { x: cx - d.w * k * 0.5 + 99 * k, y: cy };
				if (st === "tabs") return { x: cx + (d.w * k) / 3, y: cy };
				return { x: cx, y: cy };
			};
			const sliderValue = (l, i) => {
				const span = (i + 1 < states.length ? marks[i + 1] : p.dur) - marks[i];
				return lerp(0.12, 0.88, cubicInOut(prog(l - marks[i], span * 0.18, span * 0.55)));
			};
			return (l) => {
				const w = wOf(l);
				const h = hOf(l);
				const z = clamp(Math.min((W * 0.62) / Math.max(1, w), (H * 0.5) / Math.max(1, h)), 1, 1.9) * (1 + 0.06 * (l / p.dur));
				set(cam, { transform: `translate(${px((W * (1 - z)) / 2)}, ${px((H * (1 - z)) / 2)}) scale(${z.toFixed(4)})` });
				let cur = 0;
				for (let i = 0; i < states.length; i++) if (l >= marks[i]) cur = i;
				const col = cur === 0 ? solid(states[0]) : mixHex(solid(states[cur - 1]), solid(states[cur]), clamp((l - marks[cur]) / 0.18));
				set(shape, {
					left: px(cx - w / 2),
					top: px(cy - h / 2),
					width: px(Math.max(10, w)),
					height: px(Math.max(10, h)),
					borderRadius: px(Math.max(0, rOf(l))),
					background: col,
					overflow: states[cur] === "slider" ? "visible" : "hidden",
				});
				layers.forEach((ctl, i) => {
					const start = marks[i];
					const end = i + 1 < states.length ? marks[i + 1] : Infinity;
					const a = clamp((l - start - 0.08) / 0.12) * (1 - clamp((l - end + 0.02) / 0.08));
					set(ctl.c, { opacity: a.toFixed(3), filter: a < 0.99 ? `blur(${((1 - a) * 10 * S).toFixed(2)}px)` : "none", visibility: a > 0 ? "visible" : "hidden" });
					if (ctl.knob && ctl.st === "slider") set(ctl.knob, { visibility: a > 0 ? "visible" : "hidden", opacity: a.toFixed(3) });
					// Hidden states still receive their canonical time-derived values.
					// Otherwise reverse seeking retains a later spinner/knob/text state.
					const local = l - start;
					const span = (end === Infinity ? p.dur : end) - start;
					if (ctl.spin) ctl.spin.style.transform = `rotate(${(local * 540).toFixed(1)}deg)`;
					if (ctl.path) ctl.path.setAttribute("stroke-dashoffset", String((1 - expoOut(prog(local, 0.08, 0.3))) * 24));
					if (ctl.st === "toggle") set(ctl.knob, { left: px(lerp(14 * k, MORPH.toggle.w * k - 146 * k, spring(local - span * 0.35, 3, 0.6))) });
					if (ctl.st === "slider") {
						const v = sliderValue(l, i);
						set(ctl.fill, { width: px(v * MORPH.slider.w * k) });
						set(ctl.knob, { left: px(v * MORPH.slider.w * k - 48 * k) });
					}
					if (ctl.prog) set(ctl.prog, { width: `${(prog(local, 0.1, span) * 100).toFixed(2)}%` });
					if (ctl.ind) set(ctl.ind, { left: px(14 * k + ctl.tabW * lerp(0, 2, spring(local - span * 0.25, 2.6, 0.7))), width: px(ctl.tabW) });
					if (ctl.typing) {
						const q = s.text ?? plan.brand?.name ?? "";
						ctl.typing.reveal(Math.round(clamp((local - 0.1) / Math.max(0.2, span * 0.6)) * q.length));
					}
				});
				// The cursor acts on the current state, then clicks into the next one on its beat.
				const next = cur + 1 < states.length ? cur + 1 : -1;
				const st = states[cur];
				const ap = actionPoint(st);
				if (st === "slider") {
					const x = cx - (MORPH.slider.w * k) / 2 + sliderValue(l, cur) * MORPH.slider.w * k;
					cursor(l, { fx: x, fy: cy, x, y: cy, start: marks[cur], arrive: marks[cur] + 0.01, click: marks[cur] + 0.15, ringColor: alpha(accent, 0.9) });
				} else if (next >= 0) {
					const from = cur > 0 ? actionPoint(states[cur - 1]) : { x: cx + 300 * S, y: cy + 260 * S };
					cursor(l, { fx: from.x, fy: from.y, x: ap.x, y: ap.y, start: marks[cur] + 0.05, arrive: marks[next] - 0.08, click: marks[next], ringColor: alpha(accent, 0.9) });
				} else cursor(l, { fx: ap.x, fy: ap.y, x: ap.x + 260 * S, y: ap.y + 240 * S, start: marks[cur] + 0.2, arrive: marks[cur] + 0.9, click: 1e9 });
			};
		};

		/** How it works: a ring fills in steps while numbered chips land on the beat. */
		SCENES.steps = ({ p, cam, fg, accent }) => {
			const s = p.scene;
			const n = s.steps.length;
			const marks = p.marks ?? s.steps.map((_, i) => 0.4 + i * p.beatLen);
			const vertical = H > W * 1.2;
			const square = !vertical && W < H * 1.4;
			const wrap = el("div", "center", cam);
			let titleG = [];
			let titleHeight = 0;
			if (s.title) {
				const title = el("div", "display", wrap);
				set(title, { color: fg, marginBottom: px(D.space(square ? 3 : 5)) });
				titleG = glyphText(title, s.title).glyphs;
				D.fitSize(title, W * 0.8, Math.max(H * 0.14, D.type("sceneTitle",5).lineHeight * 2), "sceneTitle");
				titleHeight = title.offsetHeight + D.space(square ? 3 : 5);
			}
			const T = {label:D.type("label").size,body:D.type("body").size,title:D.type("metric").size};
			// One column in a tall frame: the title, the ring and the list share its width.
			const column = Math.min(W * 0.84, K.safe.w);
			const rowGap = D.space(square ? 3 : 5);
			const row = el("div", "", wrap);
			set(row, { display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: px(rowGap), width: px(vertical ? column : K.safe.w) });
			const d = Math.min(W, H) * (vertical ? 0.42 : square ? 0.25 : 0.44);
			const ringBox = el("div", "", row);
			set(ringBox, { position: "relative", width: px(d), height: px(d), flex: "none" });
			const r = 44;
			const C = 2 * Math.PI * r;
			ringBox.innerHTML = `<svg viewBox="0 0 100 100" width="100%" height="100%" style="transform:rotate(-90deg)"><circle cx="50" cy="50" r="${r}" fill="none" stroke="${alpha(fg, 0.14)}" stroke-width="7"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}"/></svg>`;
			const arc = ringBox.querySelectorAll("circle")[1];
			const pct = el("div", "display", ringBox, "0%");
			set(pct, { position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", color: fg, fontVariantNumeric: "tabular-nums" });
			D.apply(pct,"metric");
			pct.textContent = "";
			const rollPct = odometer(el("span", "", pct), "100");
			el("span", "", pct, "%");
			const list = el("div", "", row);
			const listWidth = vertical ? column : K.safe.w - d - rowGap;
			set(list, { display: "flex", flexDirection: "column", gap: px(D.space(square ? 1 : 2)), width: px(listWidth), flex: "none" });
			const chips = s.steps.map((text, i) => {
				const c = el("div", "", list);
				set(c, { display: "flex", alignItems: "center", background: alpha(fg, 0.07), color: fg });
				D.surface(c,"badge",{density:square?"normal":"comfortable",shape:"pill"});
				const num = el("div", "mono", c, String(i + 1).padStart(2, "0"));
				// The number is a label, the step the main line: each a step of the scale (plan.js TYPE).
				set(num, { width: px(T.label * 2), height: px(T.label * 2), borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `${px(2.5 * S)} solid ${alpha(fg, 0.3)}`, flex: "none", boxSizing: "border-box" });
				D.apply(num,"label");
				const t = el("div", "bold", c, text);
				D.apply(t,"body");
				set(t, { whiteSpace: "normal", minWidth: "0" });
				return { c, num, t };
			});
			// Keep badge labels at the type floor: reflow the prose before the scene
			// fitter would have to shrink the entire ring and list to fit the frame.
			const listHeight = K.safe.h - titleHeight - (vertical ? d + rowGap : 0);
			for (const step of [3,2]) {
				if (Math.max(...chips.map(({ c }) => c.scrollWidth)) <= listWidth + 1 && list.offsetHeight <= listHeight + 1) break;
				for (const { t } of chips) D.apply(t,"body",{step});
			}
			return (l) => {
				if (titleG.length) riseGlyphs(titleG, l, { at: 0.02, stagger: 0.025, rot: -5 });
				let v = 0;
				for (let i = 0; i < n; i++) v += (1 / n) * spring(l - marks[i], 2.6, 0.75);
				arc.setAttribute("stroke-dashoffset", (C * (1 - clamp(v))).toFixed(2));
				rollPct(clamp(v) * 100);
				const e = spring(l, 2.4, 0.7);
				set(ringBox, { transform: `scale(${(0.7 + 0.3 * e).toFixed(4)}) rotate(${((1 - e) * -40).toFixed(2)}deg)`, opacity: clamp(l / 0.1).toFixed(3) });
				chips.forEach(({ c, num }, i) => {
					const k = spring(l - marks[i] + 0.12, 3, 0.62);
					set(c, { opacity: clamp((l - marks[i] + 0.12) / 0.08).toFixed(3), transform: `translateX(${px((1 - k) * 90 * S)}) scale(${(0.92 + 0.08 * k).toFixed(4)})` });
					// The badge fills over a few frames rather than switching colour in one.
					const fk = smooth((l - marks[i]) / 0.1);
					set(num, { background: fk > 0 ? alpha(accent, fk) : "transparent", color: fk > 0.5 ? textOn(accent) : fg, borderColor: fk > 0.5 ? accent : alpha(fg, 0.3) });
				});
			};
		};

		/** A ticket card types its rows, then a stamp presses down on the beat. */
		SCENES.ticket = ({ p, cam, accent, bg }) => {
			const s = p.scene;
			const at = p.marks?.[0] ?? p.dur * 0.66;
			const vertical = H > W * 1.2;
			const square = !vertical && W < H * 1.3;
			// Let the panel's padding sit outside the text-safe region. A square
			// receipt keeps useful column width even for a monospaced brand font.
			const panelWidth=square?K.safe.w*.96+D.space(3)*2:K.safe.w;
			const tw = vertical ? W * 0.84 : Math.min(panelWidth, 1000 * S);
			const card = el("div", "ticket", cam);
			const ink = textOn(accent),pad=D.box("card").paddingX;
			set(card, { width: px(tw), left: px((W - tw) / 2), background: accent, color: ink, boxShadow: `0 ${px(40 * S)} ${px(90 * S)} rgba(0,0,0,0.22)` });
			D.surface(card,"card");
			const head = el("div", "display", card, s.title);
			set(head, { color: ink });
			D.fitSize(head, tw-pad*2, D.type("cardTitle",5).lineHeight*2, "cardTitle");
			const rule = el("div", "", card);
			set(rule, { borderTop: `${px(3 * S)} dashed ${alpha(ink, 0.45)}` });
			const list=el("div","",card);
			set(list,{display:"flex",flexDirection:"column",gap:px(D.space(2))});
			const rows = s.rows.map(([key, value], index) => {
				const row = el("div", "", list);
				set(row, { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: px(D.space(3)) });
				const label = el("div", "mono", row, key);
				D.apply(label,"label");
				set(label, { opacity: "0.7",maxWidth:"42%",flex:"none" });
				D.truncateLine(label);label.title=key;
				const val = el("div", "bold", row, value);
				D.apply(val,"body");
				set(val, { whiteSpace: "normal",minWidth:"0",textAlign:"right" });
				const typing = createTyping(K, val, { text: value, id: `ticket.rows.${index}` });
				return {row,label,val,text:value,typing};
			});
			// Perforation stays at the divider while the receipt grows with copy.
			const notches=["left", "right"].map(side=>{
				const notch=el("div","",card);
				set(notch,{position:"absolute",[side]:px(-26*S),width:px(52*S),height:px(52*S),borderRadius:"50%",background:bg});
				return notch;
			});
			const stampCol = lum(accent) > 0.4 ? "#111111" : "#ffffff";
			const stamp = el("div", "stamp", cam);
			set(stamp, { color: stampCol, border: `${px(D.unit*2)} solid ${stampCol}`,maxWidth:px(tw-pad*2) });
			D.surface(stamp,"badge");
			D.apply(stamp,"caption");
			const stampLabel=el("div","",stamp,s.stamp);
			D.truncateLine(stampLabel);stampLabel.title=s.stamp;
			const stampSlot=el("div","",card);
			let sw=stamp.offsetWidth,sh=stamp.offsetHeight;
			const angle=11*Math.PI/180;
			set(stampSlot,{height:px(sh*Math.cos(angle)+sw*Math.sin(angle)),flex:"none"});
			if(card.offsetHeight>K.safe.h){
				D.apply(head,"cardTitle",{step:5});
				D.surface(card,"card",{density:"compact"});
				set(list,{gap:px(D.space(1))});
				for(const {val}of rows)D.apply(val,"body",{step:2});
			}
			if(card.offsetHeight>K.safe.h){
				D.surfaceGap(card,1);
				set(list,{display:"grid",gridTemplateColumns:"1fr 1fr",gap:px(D.space(2))});
				for(const {row,label,val}of rows){
					set(row,{flexDirection:"column",alignItems:"stretch",gap:"0px"});
					set(label,{maxWidth:"100%"});set(val,{textAlign:"left"});
				}
				D.apply(stamp,"caption",{step:2});
				sw=stamp.offsetWidth;sh=stamp.offsetHeight;
				set(stampSlot,{height:px(sh*Math.cos(angle)+sw*Math.sin(angle))});
			}
			if(card.offsetHeight>K.safe.h)throw new Error("Receipt copy exceeds the readable card capacity");
			const ch=card.offsetHeight,stampCenter=stampSlot.offsetTop+stampSlot.offsetHeight/2;
			for(const notch of notches)set(notch,{top:px(rule.offsetTop-26*S)});
			for(const {typing}of rows)typing.measure();
			return (l) => {
				const top = (H - ch) / 2;
				const e = spring(l, 2.2, 0.62);
				const jolt = l >= at ? pulse(l - at, 12) : 0;
				set(card, { top: px(top), transform: `translateY(${px((1 - e) * -H * 0.9)}) rotate(${((1 - e) * 8 - 1.5 + jolt * 1.2).toFixed(3)}deg) scale(${(1 - 0.025 * jolt).toFixed(4)})` });
				const span = Math.max(0.3, at - 0.55);
				rows.forEach((r, i) => {
					const from = 0.45 + (i * span) / rows.length;
					const nChars = Math.round(clamp((l - from) / Math.max(0.1, span / rows.length - 0.05)) * r.text.length);
					r.typing.reveal(nChars);
				});
				const sk = expoOut(prog(l, at - 0.07, 0.1));
				set(stamp, {
					left: px(W / 2-sw/2),top:px(top+stampCenter-sh/2),
					opacity: (0.92 * smooth((l - at + 0.07) / 0.05)).toFixed(3),
					transform: `rotate(-11deg) scale(${lerp(2.4, 1, sk).toFixed(4)})`,
				});
			};
		};

		/** Ticker bands across the frame, sliding in opposite directions, never stopping. */
		SCENES.marquee = ({ p, cam, fg, accent, palette, bg }) => {
			const s = p.scene;
			const bands = [
				{ rot: -7, y: 0.18, dir: -1, bg: accent },
				{ rot: 4, y: 0.5, dir: 1, bg: fg },
				{ rot: -3, y: 0.82, dir: -1, bg: lum(bg) > 0.5 ? palette.ink : palette.paper },
			];
			const bh = H * 0.21;
			const items = bands.map((b, i) => {
				const band = el("div", "", cam);
				const text = Array.from({ length: 8 }, (_, j) => s.words[(j + i * 2) % s.words.length]).join("  ✳  ");
				set(band, { position: "absolute", left: px(-W * 0.3), width: px(W * 1.6), height: px(bh), top: px(b.y * H - bh / 2), background: b.bg, overflow: "hidden", display: "flex", alignItems: "center" });
				const t = el("div", "display", band, `${text}  ✳  ${text}`);
				D.apply(t,"display");
				set(t, { color: textOn(b.bg), whiteSpace: "nowrap" });
				return { band, t, b };
			});
			return (l) => {
				items.forEach(({ band, t, b }, i) => {
					const k = expoOut(prog(l, i * 0.07, 0.6));
					set(band, { transform: `rotate(${b.rot}deg) translateX(${px((1 - k) * b.dir * -W * 1.2)})` });
					set(t, { transform: `translateX(${px(-W * 0.4 + b.dir * l * 260 * S)})` });
				});
			};
		};

		/** Three phones fan out from a stack, each showing a screen. */
		SCENES.phones = ({ p, cam, fg, palette }) => {
			const s = p.scene;
			const imgs = (s.images ?? []).map((u) => images[u]).filter(Boolean);
			const vertical = H > W * 1.2;
			let capG = [], captionBottom = K.safe.y;
			if (s.caption) {
				const cap = el("div", "display", cam);
				set(cap, { position: "absolute", left: "0", right: "0", top: px(K.safe.y), textAlign: "center", color: fg, margin: "0 auto" });
				capG = glyphText(cap, s.caption).glyphs;
				D.fitSize(cap, K.safe.w, K.safe.h * 0.3, "sceneTitle");
				captionBottom += cap.offsetHeight + D.space(5);
			}
			const ph = Math.min(H * (vertical ? 0.5 : s.caption ? 0.66 : 0.78), K.safe.y + K.safe.h - captionBottom);
			const pw = ph / 2.05;
			const top = s.caption ? captionBottom : (H - ph) / 2;
			const phones = [0, 1, 2].map((i) => {
				const ph0 = el("div", "phone", cam);
				set(ph0, { width: px(pw), height: px(ph), left: px(W / 2 - pw / 2), top: px(top), zIndex: i === 1 ? "3" : "2", boxShadow: `0 ${px(40 * S)} ${px(80 * S)} rgba(0,0,0,0.3)` });
				const device=D.forSurface(pw*.01/D.unit);
				device.surface(ph0,"card",{layout:"frame",purpose:"device"});
				const scr = el("div", "screen", ph0);
				const inset = pw * 0.035;
				set(scr, { left: px(inset), top: px(inset), right: px(inset), bottom: px(inset) });
				device.surface(scr,"card",{layout:"frame",purpose:"media"});
				device.nest(scr,ph0,{inset});
				const img = imgs.length ? imgs[(i + 1) % imgs.length] : null;
				if (img) {
					const im = el("img", "fill", scr);
					im.src = img.src;
				} else {
					// The product's own screens, phone-sized: a list, the dashboard and a chat.
					set(scr, { overflow: "hidden", background: lum(palette.paper) < 0.2 ? "#0d0f15" : "#ffffff" });
					const inner = el("div", "", scr);
					set(inner, { position: "absolute", left:"0",right:"0",top:px(pw*.12),bottom:"0" });
					mockUI(inner, palette, palette.electric, i, ["inbox", "dashboard", "chat"][i]);
				}
				const island = el("div", "", ph0);
				set(island, { position: "absolute", top: px(pw * 0.06), left: px(pw * 0.36), width: px(pw * 0.28), height: px(pw * 0.08), borderRadius: px(99), background: "#0b0b0d" });
				return ph0;
			});
			const spread = [-1, 0, 1];
			return (l, d) => {
				if (capG.length) riseGlyphs(capG, l, { at: 0.02, stagger: 0.022, rot: -6 });
				phones.forEach((ph0, i) => {
					const k = spring(l - 0.15 - Math.abs(spread[i]) * 0.08, 2.2, 0.7);
					const rise = expoOut(prog(l, 0, 0.6));
					const float = Math.sin((l / d) * Math.PI * 2 + i) * 8 * S;
					set(ph0, {
						transform: `translate(${px(spread[i] * k * pw * 1.08)}, ${px((1 - rise) * H * 0.6 + Math.abs(spread[i]) * k * ph * 0.05 + float)}) rotate(${(spread[i] * k * 8).toFixed(3)}deg)`,
					});
				});
			};
		};

		/** Scenes that drive their own camera. */
		const SELF_CAMERA = new Set(["prompt", "ui-macro", "morph", "laptop", "browser", "dock", "ride", "lens-wall", "laptop3d", "synth3d"]);

		return { SCENES, SELF_CAMERA, logoNode };

}
