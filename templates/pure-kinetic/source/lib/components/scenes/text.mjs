// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {typewriterTiming} from '../typewriter-timing.mjs';
import {createTyping} from '../typing.mjs';
import metadata from '../metadata.mjs';
const sceneFactories = {};

/** Digits in a string roll like an odometer; everything else stays put. */
const rollingNumber = (K, parent, text, size) => {
	const { el, set } = K;
	const box = el("span", "", parent);
	box.setAttribute("data-roll", "");
	set(box, { display: "inline-flex", overflow: "hidden", height: "1lh", verticalAlign: "bottom", fontVariantNumeric: "tabular-nums", whiteSpace: "pre" });
	const cols = [];
	for (const ch of String(text)) {
		if (/\d/.test(ch)) {
			const col = el("span", "", box);
			set(col, { display: "inline-flex", flexDirection: "column", lineHeight: "inherit" });
			for (let d = 0; d <= 9; d++) el("span", "", col, String(d));
			cols.push({ col, digit: Number(ch) });
		} else el("span", "", box, ch);
	}
	/** k: 0 -> 1 progress; digits spin through extra turns, leftmost slowest. */
	return (k, live = 0) => {
		cols.forEach(({ col, digit }, i) => {
			const turns = Math.max(0, cols.length - i - 1);
			const v = (digit + turns * 10) * k + (i === cols.length - 1 ? live : 0);
			const pos = v % 10;
			set(col, { transform: `translateY(calc(${(-pos).toFixed(4)} * 1lh))` });
		});
	};
};

/** "Your rival just hit [$100,412] in MRR." Chips are pills; digits inside them roll. */
sceneFactories.caption = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, clamp, expoOut, spring, prog, alpha, textOn, images } = K;
	const s = p.scene;
	const img = s.image ? images[s.image] : null;
	const vertical = H > W * 1.2;
	const wrap = el("div", "center", cam);
	set(wrap, { justifyContent: img ? "flex-start" : "center", paddingTop: img ? px(H * 0.08) : "0", boxSizing: "border-box" });
	const line = el("div", "bold", wrap);
	set(line, { color: fg, textAlign: "center", maxWidth: px(W * 0.86) });
	const parts = [];
	const tokens = String(s.text).split(/(\[[^\]]+\])/).filter(Boolean);
	for (const [ti, tok0] of tokens.entries()) {
		let tok = tok0;
		// Punctuation right after a chip stays glued to it instead of wrapping onto its own line.
		const lead = ti > 0 && /^\[/.test(tokens[ti - 1]) ? /^[.,!?;:…]+/.exec(tok) : null;
		if (lead) tok = tok.slice(lead[0].length);
		if (!tok) continue;
		const chip = /^\[(.+)\]$/.exec(tok);
		if (chip) {
			const tail = /^[.,!?;:…]+/.exec(tokens[ti + 1] ?? "")?.[0];
			const holder = tail ? el("span", "", line) : line;
			if (tail) set(holder, { display: "inline-block", whiteSpace: "nowrap" });
			const c = el("span", "pill", holder);
			set(c, { background: alpha(fg, 0.08), border: `${px(2 * S)} solid ${alpha(fg, 0.14)}`, margin: "0 0.12em", verticalAlign: "0.06em", lineHeight: "inherit", display: "inline-flex", alignItems: "center" });
			K.design.surface(c,'badge',{density:'compact',shape:'pill'});
			const dot = el("span", "", c);
			set(dot, { width: "0.5em", height: "0.5em", borderRadius: "50%", background: accent, flex: "none" });
			const hasDigits = /\d/.test(chip[1]);
			const roll = hasDigits ? rollingNumber(K, c, chip[1]) : null;
			if (!hasDigits) el("span", "", c, chip[1]);
			if (tail) el("span", "", holder, tail);
			parts.push({ node: tail ? holder : c, chip: true, roll });
		} else
			for (const w of tok.split(/(\s+)/)) {
				if (!w) continue;
				if (/^\s+$/.test(w)) {
					line.appendChild(document.createTextNode(" "));
					continue;
				}
				parts.push({ node: el("span", "word", line, w) });
			}
	}
	K.design.fitSize(line, W * 0.86, img ? H * 0.16 : H * 0.42, 'display');
	let sub = null;
	if (s.sub) {
		sub = el("div", "bold", wrap, s.sub);
		set(sub, { color: fg, opacity: "0.6", marginTop: px(K.design.space(1)) }); K.design.apply(sub, 'caption');
	}
	let card = null;
	if (img) {
		const aspect = img.w / img.h;
		let cw = W * (vertical ? 0.86 : 0.56);
		let ch = cw / aspect;
		const maxH = H * 0.62;
		if (ch > maxH) {
			ch = maxH;
			cw = ch * aspect;
		}
		card = el("div", "card", cam);
		set(card, { left: px((W - cw) / 2), top: px(H - ch - H * 0.07), width: px(cw), height: px(ch), boxShadow: `0 ${px(40 * S)} ${px(90 * S)} rgba(0,0,0,0.25)` });
		K.design.surface(card,'card',{layout:'frame',purpose:'media'});
		const im = el("img", "fill", card);
		im.src = img.src;
	}
	const step = Math.min(0.09, 0.7 / Math.max(1, parts.length));
	return (l) => {
		parts.forEach((pt, i) => {
			const t0 = 0.03 + i * step;
			const k = spring(l - t0, pt.chip ? 2.8 : 3.4, pt.chip ? 0.5 : 0.7);
			set(pt.node, {
				opacity: clamp((l - t0) / 0.08).toFixed(3),
				transform: pt.chip ? `scale(${(0.6 + 0.4 * k).toFixed(4)})` : `translateY(${((1 - k) * 0.4).toFixed(4)}em)`,
				filter: `blur(${px((1 - clamp(k)) * 8 * S)})`,
			});
			// The number lands on exactly what was written and stays there.
			if (pt.roll) pt.roll(expoOut(prog(l, t0, 0.9)));
		});
		// The line drifts and grows slowly once it has landed, so a long caption never freezes.
		set(line, { transform: `translateY(${(Math.sin(l * 1.1) * 0.04).toFixed(4)}em) scale(${(1 + 0.04 * clamp(l / Math.max(1, p.dur))).toFixed(4)})` });
		if (sub) {
			const k = expoOut(prog(l, 0.35 + parts.length * step, 0.5));
			set(sub, { opacity: (0.6 * k).toFixed(3), transform: `translateY(${px((1 - k) * 18 * S)})` });
		}
		if (card) {
			const k = expoOut(prog(l, 0.25, 0.8));
			set(card, { opacity: clamp(l / 0.15).toFixed(3), transform: `translateY(${px((1 - k) * H * 0.4)}) rotateX(${((1 - k) * 18).toFixed(2)}deg)` });
		}
	};
};

/** Typed on a blank page with a human rhythm; can erase the end and type something else. */
sceneFactories.typewriter = ({ p, cam, fg, accent, K }) => {
	const { W, H, el, set, px } = K;
	const s = p.scene;
	const schedule = typewriterTiming(s, p.dur);
	const { then, finalText, textUnits, times, typedEnd, eraseStart, eraseEnd, thenTimes, total, scale } = schedule;
	const wrap = el("div", "center", cam);
	const line = el("div", "bold", wrap);
	line.setAttribute("data-typewriter-line", "");
	set(line, { color: fg, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", width: px(W * 0.8), textAlign: "center" });
	// Both complete variants participate in sizing, in the same grid cell. Their
	// text nodes never change during a seek: neither wrapping nor kerning depends
	// on where the current key falls. Paint alone reveals the reserved glyphs.
	const build = (reference, phase) => {
		const layer = el("span", "", line);
		layer.dataset.typewriterLayout = phase;
		set(layer, { gridArea: "1 / 1", position: "relative", minWidth: "0", whiteSpace: "pre-wrap", alignSelf: "start" });
		const caret = el("span", "caret", layer);
		caret.dataset.typewriterPart = "caret";
		set(caret, { width: "0.06em", height: "1em", background: accent, marginLeft: "0.04em" });
		const typing = createTyping(K, layer, { text: reference, caret, unit: 'codepoint', id: `typewriter-${phase}` });
		for (const part of typing.parts) part.node.dataset.typewriterUnit = String(part.start);
		return { layer, typing, caret };
	};
	const layouts = s.erase ? [build(s.text, "original"), build(finalText, "final")] : [build(finalText, "final")];
	K.design.fitSize(line, W * 0.8, H * 0.3, 'display');
	for (const layout of layouts) layout.typing.measure();
	return (l) => {
		const lt = l / scale;
		const n = times.filter(x => x <= lt).length;
		let count = n;
		if (s.erase && lt > eraseStart) count = Math.max(0, textUnits.length - Math.min(s.erase, Math.floor((lt - eraseStart) / 0.03)));
		let lastAt = n > 0 ? times[n - 1] : 0;
		if (then && lt > eraseEnd) {
			const m = thenTimes.filter(x => x <= lt).length;
			count += m;
			if (m > 0) lastAt = thenTimes[m - 1];
		}
		const erasing = s.erase && lt > eraseStart && lt <= eraseEnd + 0.15;
		const k = erasing ? 1 : K.clamp((lt - lastAt) / 0.05);
		const phase = s.erase && lt <= eraseEnd ? "original" : "final";
		line.dataset.typewriterReference = phase;
		for (const layout of layouts) {
			const active = layout.layer.dataset.typewriterLayout === phase;
			set(layout.layer, { opacity: active ? "1" : "0" });
			layout.typing.reveal(count, { fresh: k });
			const idle = lt > total || (lt > typedEnd && lt < eraseStart);
			set(layout.caret, { opacity: active ? (idle ? K.blink(lt > total ? lt - total : lt - typedEnd).toFixed(3) : "1") : "0" });
		}
	};
};

/** A sentence landing word by word, big, each word in its own colour. */
sceneFactories.sentence = ({ p, cam, fg, palette, bg, K }) => {
	const { W, H, S, el, set, spring, clamp, lum, glyphText } = K;
	const s = p.scene;
	const wrap = el("div", "center", cam);
	const line = el("div", "display", wrap);
	set(line, { color: fg });
	const { words } = glyphText(line, s.text, { glyphs: false });
	const light = lum(bg) > 0.4;
	const pool = [palette.electric, palette.coral, palette.peach, palette.sage, palette.lilac, palette.lime, palette.butter].filter((c) => Math.abs(lum(c) - lum(bg)) > 0.3);
	words.forEach((w, i) => {
		if (i % 2 === 1 && pool.length) w.node.style.color = pool[i % pool.length];
	});
	K.design.fitSize(line, W * 0.86, H * 0.66, 'display');
	const step = Math.min(p.beatLen / 2, (p.dur * 0.6) / Math.max(1, words.length));
	return (l) => {
		words.forEach((w, i) => {
			const t0 = 0.02 + i * step;
			const k = spring(l - t0, 3.6, 0.55);
			set(w.node, { opacity: K.smooth((l - t0) / 0.09).toFixed(3), transform: `translateY(${((1 - k) * 0.55).toFixed(4)}em) scale(${(0.85 + 0.15 * k).toFixed(4)})` });
		});
		void light;
	};
};

/** "Zero" stays; the word after it rolls through a mask line on every beat. */
sceneFactories.append = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, expoOut, expoIn, prog, clamp } = K;
	const s = p.scene;
	const marks = p.marks ?? s.words.map((_, i) => 0.5 + i * p.beatLen);
	const vertical = H >= W;
	const wrap = el("div", "center", cam);
	const row = el("div", "display", wrap);
	set(row, { color: fg, display: "flex", flexDirection: vertical ? "column" : "row", alignItems: vertical ? "center" : "baseline", gap: "0.22em", whiteSpace: "nowrap" });
	const baseEl = el("span", "", row, s.base);
	set(baseEl, {flex: "none"});
	const slot = el("span", "", row);
	// A display face may reserve more than one em for its ascenders/descenders.
	// Let the loaded font establish the mask's line box instead of cropping it
	// with the tight display line-height; the sizer also determines its width.
	set(slot, { position: "relative", display: "inline-block", flex: "none", overflow: "hidden", lineHeight: "inherit", padding: "0.08em 0" });
	const longest = s.words.reduce((a, b) => (b.length > a.length ? b : a), "");
	const sizer = el("span", "", slot, longest);
	set(sizer, { visibility: "hidden", display: "block" });
	const items = s.words.map((w) => {
		const n = el("span", "", slot, w);
		set(n, { position: "absolute", left: vertical ? "50%" : "0", top: "0.08em", color: accent, whiteSpace: "nowrap" });
		return n;
	});
	// Size the slot by the widest word as set, not the one with the most letters.
	sizer.textContent = items.reduce((a, n) => (n.offsetWidth > a.offsetWidth ? n : a), items[0]).textContent;
	// K.safe already reserves the shared camera's maximum expansion. Measure
	// every replacement against that width before the scene fitter samples it.
	K.design.fitLine(row, K.safe.w, H * (vertical ? 0.5 : 0.4), 'hero');
	const baseK = (l) => expoOut(prog(l, 0.02, 0.5));
	return (l) => {
		const bk = baseK(l);
		// A slow sway under the word swaps, so the holds between them keep moving.
		set(row, { transform: `translateY(${(Math.sin(l * 1.3) * 0.03).toFixed(4)}em) rotate(${(Math.sin(l * 0.8) * 0.5).toFixed(3)}deg)` });
		set(baseEl, { transform: `translateY(${((1 - bk) * 0.6).toFixed(4)}em)`, opacity: clamp(l / 0.08).toFixed(3) });
		items.forEach((n, i) => {
			const inK = expoOut(prog(l, marks[i], 0.35));
			const outAt = i + 1 < items.length ? marks[i + 1] : 1e9;
			const outK = expoIn(prog(l, outAt - 0.06, 0.2));
			const x = vertical ? "translateX(-50%) " : "";
			set(n, { transform: `${x}translateY(${((1 - inK) * 1.1 - outK * 1.1).toFixed(4)}em)`, opacity: l >= marks[i] - 0.01 && outK < 1 ? "1" : "0" });
		});
		void px;
	};
};

/** 3, 2, 1, LIVE: each number slams on its beat. */
sceneFactories.countdown = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, spring, clamp, expoIn, prog, misreg } = K;
	const s = p.scene;
	const n = s.from;
	const marks = p.marks ?? Array.from({ length: n + 1 }, (_, i) => i * p.beatLen);
	const labels = [...Array.from({ length: n }, (_, i) => String(n - i)), s.label ?? "GO"];
	const wrap = el("div", "center", cam);
	const nodes = labels.map((txt, i) => {
		const d = el("div", "display", wrap, txt);
		set(d, { position: "absolute", color: i === labels.length - 1 ? accent : fg, fontVariantNumeric: "tabular-nums" });
		K.design.fitLine(d, W * 0.86, H * 0.72, 'hero');
		return d;
	});
	return (l) => {
		nodes.forEach((d, i) => {
			const at = marks[i];
			const next = i + 1 < nodes.length ? marks[i + 1] : 1e9;
			const k = spring(l - at, 3.8, 0.5);
			const out = K.smooth(prog(l, next - 0.1, 0.16));
			const on = l >= at && l < next + 0.06;
			set(d, { opacity: on ? (K.smooth((l - at) / 0.06) * (1 - out)).toFixed(3) : "0", transform: `scale(${(1.6 - 0.6 * k + out * 0.4).toFixed(4)})` });
			misreg(d, on ? 1 - prog(l, at + 0.04, 0.18) : 0);
		});
	};
};
/**
 * Comic Glitch Text: a paragraph that glitches in word by word through comic
 * panels, torn colour slices and print misregistration. Ported from Pixel UI's
 * component (ikislay/pixel-ui, components/ui/comic-glitch-text.tsx, copyright
 * (c) 2026 Kislay, used with the author's permission; SOURCE.json). Its
 * frames, sequences, shapes and colours are kept. What changed for this
 * engine: the frame comes from the scene's time and not from a timer, and
 * every random number from the word and the frame, so a seek draws the same
 * picture; there is no exit or loop, a scene ends instead.
 */
const COMIC_PANELS = [
	{ fill: "#22e04a", ink: "#000" },
	{ fill: "#d61cf0", ink: "#fff" },
	{ fill: "#3b1cf5", ink: "#fff" },
	{ fill: "#f5b700", ink: "#000" },
];
const COMIC_GHOSTS = ["#ff2bd6", "#19e3ff", "#ffe14d", "#22e04a"];
/** Numbers in [0, 1) that depend on the seed alone (mulberry32). */
const comicRandom = (seed) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};
/** What a word shows at a frame of its life: the upstream enter sequence, then rest. */
export const comicEnter = (word) => {
	const next = comicRandom(0x9e3779b1 ^ Math.imul(word + 1, 0x85ebca6b));
	const glitch = () => (next() < 0.5 ? "panel" : "slice");
	return [glitch(), glitch(), "chroma", glitch(), "chroma", "chroma", ...Array(10).fill("bold"), "rest"];
};
/** The word that glitches again while the paragraph rests, from frame `at` (a multiple of 19), or -1. */
export const comicIdle = (at, count) => {
	const next = comicRandom(0xc2b2ae35 ^ Math.imul(at + 1, 0x27d4eb2f));
	return next() < 0.7 ? Math.floor(next() * count) : -1;
};
export const comicFx = (word, frame, t) => {
	const age = frame - t.enter[word];
	if (age < 0) return "hide";
	if (age < 17) return comicEnter(word)[age];
	const at = frame - (frame % 19);
	if (at > t.entered && frame - at < 6 && comicIdle(at, t.enter.length) === word) {
		const next = comicRandom(0x165667b1 ^ Math.imul(at + 1, 0x9e3779b1));
		const glitch = () => (next() < 0.5 ? "panel" : "slice");
		return [glitch(), "chroma", glitch(), "bold", "bold", "rest"][frame - at];
	}
	return "rest";
};
sceneFactories.comic = ({ p, cam, fg, K }) => {
	const { el, set, px, glyphText } = K;
	const s = p.scene;
	const t = metadata.comic.times(s, p.ldur ?? p.dur, p.beatLen);
	const wrap = el("div", "center", cam);
	const line = el("div", "bold", wrap);
	set(line, { color: fg, textAlign: "left", position: "relative", maxWidth: px(K.safe.w * 0.9) });
	const { words } = glyphText(line, s.text, { glyphs: false });
	const NS = "http://www.w3.org/2000/svg";
	const hatch = K.uid("comic-hatch");
	const defs = document.createElementNS(NS, "svg");
	defs.setAttribute("aria-hidden", "true");
	set(defs, { position: "absolute", width: "0", height: "0" });
	defs.innerHTML = `<pattern id="${hatch}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(70)"><rect width="1.6" height="6" fill="#0004"/></pattern>`;
	line.append(defs);
	const parts = words.map((word) => {
		const node = word.node, copy = node.textContent;
		node.textContent = "";
		set(node, { position: "relative", display: "inline-block", opacity: "0" });
		const svg = document.createElementNS(NS, "svg");
		svg.setAttribute("viewBox", "0 0 100 100");
		svg.setAttribute("preserveAspectRatio", "none");
		svg.setAttribute("aria-hidden", "true");
		set(svg, { pointerEvents: "none", position: "absolute", top: "-0.22em", left: "-0.3em", height: "calc(100% + 0.44em)", width: "calc(100% + 0.6em)", overflow: "visible", display: "none" });
		node.append(svg);
		const text = el("span", "", node, copy);
		set(text, { position: "relative" });
		const dots = el("span", "", node);
		set(dots, { pointerEvents: "none", position: "absolute", width: "0.85em", height: "0.85em", backgroundImage: "radial-gradient(#e8112d 45%, transparent 50%)", backgroundSize: "0.22em 0.22em", display: "none" });
		const ghosts = [0, 1, 2].map(() => {
			const ghost = el("span", "", node, copy);
			ghost.setAttribute("aria-hidden", "true");
			set(ghost, { pointerEvents: "none", position: "absolute", top: "0", left: "0", display: "none" });
			return ghost;
		});
		return { node, svg, text, dots, ghosts, shown: "" };
	});
	// Fitted as it is drawn: each word a block of its own, as upstream sets them.
	K.design.fitSize(line, K.safe.w * 0.9, K.safe.h * 0.72, "sceneTitle");
	// Upstream outlines its panels 2 and 2.5 px at an 18 px paragraph: the same share of the type here.
	const em = parseFloat(getComputedStyle(line).fontSize) || 18;
	const outline = [em * 2 / 18, em * 2.5 / 18].map((width) => width.toFixed(2));
	const poly = (points) => points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
	const paint = (part, index, frame, fx) => {
		const next = comicRandom(Math.imul(index + 1, 0x01000193) ^ Math.imul(frame + 1, 0x811c9dc5));
		const rand = (a, b) => a + next() * (b - a);
		const pick = (list) => list[Math.floor(next() * list.length)];
		const { node, svg, text, dots, ghosts } = part;
		set(node, { opacity: fx === "hide" ? "0" : "1", rotate: fx === "panel" ? `${rand(-7, 7).toFixed(2)}deg` : "none", color: fg });
		set(text, {
			translate: fx === "slice" ? `${rand(-0.08, 0.08).toFixed(3)}em ${rand(-0.05, 0.05).toFixed(3)}em` : "none",
			webkitTextStroke: fx === "bold" ? "0.03em currentColor" : fx === "chroma" ? "0.035em currentColor" : "0",
			textShadow: fx === "bold" ? "-0.04em 0 #ff2bd655, 0.04em 0.02em #19e3ff55"
				: fx === "chroma" ? "-0.08em 0 #ff2bd6, 0.08em 0.03em #19e3ff, 0.03em -0.05em #ffe14d" : "none",
		});
		svg.style.display = fx === "panel" ? "block" : "none";
		if (fx === "panel") {
			const panel = pick(COMIC_PANELS);
			const second = pick(COMIC_PANELS.filter((other) => other !== panel));
			const j = () => rand(-7, 7);
			const body = [[j(), j()], [rand(35, 75), rand(-14, 6)], [100 + j(), j()], [100 + j(), 100 + j()], [j(), 100 + j()]];
			const cx = next() < 0.5 ? rand(-6, 12) : rand(88, 106);
			const cy = next() < 0.5 ? rand(-18, 0) : rand(100, 118);
			const shard = [[cx, cy], [cx + rand(-38, 38), rand(30, 70)], [cx + rand(-24, 24), rand(20, 80)]];
			set(node, { color: panel.ink });
			svg.innerHTML =
				`<polygon points="${poly(shard)}" fill="${second.fill}" stroke="#000" stroke-width="${outline[0]}" vector-effect="non-scaling-stroke"/>` +
				`<polygon points="${poly(body)}" fill="${panel.fill}" stroke="#000" stroke-width="${outline[1]}" vector-effect="non-scaling-stroke"/>` +
				(next() < 0.5 ? `<polygon points="${poly(body)}" fill="url(#${hatch})"/>` : "");
		}
		const busy = fx === "panel" || fx === "slice";
		dots.style.display = busy ? "block" : "none";
		for (const ghost of ghosts) ghost.style.display = fx === "slice" ? "block" : "none";
		if (busy) {
			set(dots, { left: `${rand(-15, 90).toFixed(1)}%`, top: `${rand(-50, 80).toFixed(1)}%` });
			for (const ghost of ghosts) {
				const top = rand(0, 70);
				set(ghost, { color: pick(COMIC_GHOSTS), clipPath: `inset(${top.toFixed(1)}% 0 ${Math.max(0, 100 - top - rand(15, 45)).toFixed(1)}% 0)`,
					translate: `${rand(-0.3, 0.3).toFixed(3)}em ${rand(-0.12, 0.12).toFixed(3)}em` });
			}
		}
	};
	return (l) => {
		const frame = Math.floor((l + 1e-6) / t.tick);
		parts.forEach((part, index) => {
			const fx = comicFx(index, frame, t);
			// A word at rest, or one not yet in, looks the same on every frame.
			const key = fx === "hide" || fx === "rest" || fx === "bold" || fx === "chroma" ? fx : `${fx}:${frame}`;
			if (part.shown === key) return;
			part.shown = key;
			paint(part, index, frame, fx);
		});
	};
};
export {sceneFactories};
export default sceneFactories;
