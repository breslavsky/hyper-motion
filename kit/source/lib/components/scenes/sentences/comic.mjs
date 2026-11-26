// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../../metadata.mjs';
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
export const factory = ({ p, cam, fg, K }) => {
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


