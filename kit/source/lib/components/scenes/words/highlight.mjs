// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function create(K) {
const { maths, dom } = K.helpers;
const D=K.design;
const { clamp, lerp, prog, expoOut, textOn } = maths;
const { el, set, px, plain } = dom;
const { W, H, S, glyphText, spring } = K;
return ({ p, cam, fg, accent }) => {
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
}
