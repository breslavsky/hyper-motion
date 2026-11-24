// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function createDom({ document = globalThis.document, emoji = null }) {
const getComputedStyle = document.defaultView.getComputedStyle.bind(document.defaultView);
const NodeFilter = document.defaultView.NodeFilter;
const ALLOWED = ["data-layout-allow-overlap", "data-layout-allow-occlusion", "data-layout-allow-overflow"];

	/** A new element with a class, inside `parent`, holding `text`. */
	// An emoji as it is written: one picture, with what may follow it (the selector that asks for
	// the picture form, a skin tone, pictures joined into one).
	const EMOJI = /\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}]|\u200D\p{Extended_Pictographic}\uFE0F?)*/gu;
	/** A text as its letters, an emoji whole. */
	const letters = (text) => {
		const out = [];
		let from = 0;
		for (const found of String(text).matchAll(EMOJI)) {
			out.push(...String(text).slice(from, found.index), found[0]);
			from = found.index + found[0].length;
		}
		return [...out, ...String(text).slice(from)];
	};
	/**
	 * The film's emoji are drawn by the kit's own set (emoji: { size, emoji: { "✅": svg } },
	 * which the stage loads), never by the machine's emoji font: the same film is the same picture
	 * on every worker. An emoji the set has not got stays a letter.
	 */
	const write = (node, text, before = null, semantic = false) => {
		const set = emoji?.emoji;
		const value = String(text);
		if (!set || !/\p{Extended_Pictographic}/u.test(value)) {
			if (!before) node.textContent = value;
			return false;
		}
		const put = (child) => node.insertBefore(child, before);
		let from = 0;
		for (const found of value.matchAll(EMOJI)) {
			const drawn = set[found[0].replaceAll("\uFE0F", "")] ?? set[[...found[0]][0]];
			if (!drawn) continue;
			if (found.index > from) put(document.createTextNode(value.slice(from, found.index)));
			const picture = document.createElement("span");
			picture.className = "emoji";
			if (semantic) picture.dataset.emoji = found[0];
			for (const allow of ALLOWED) picture.setAttribute(allow, "");
			picture.style.cssText = "display:inline-block;width:1em;height:1em;vertical-align:-0.14em;line-height:1";
			picture.innerHTML = `<svg viewBox="0 0 ${emoji.size} ${emoji.size}" width="100%" height="100%" style="display:block">${drawn}</svg>`;
			put(picture);
			from = found.index + found[0].length;
		}
		if (!from) {
			if (!before) node.textContent = value;
			return false;
		}
		if (from < value.length) put(document.createTextNode(value.slice(from)));
		return true;
	};

	/**
	 * Every emoji written anywhere under `stage` drawn by the kit's set: the scenes that put
	 * their text in themselves, not through `el`. Run once a film is built.
	 */
	const emojify = (stage, { semantic = false } = {}) => {
		if (!emoji?.emoji) return;
		const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
		const found = [];
		// Typing owns its immutable runs, including its explicit raw-code emoji
		// policy. The final scene-wide pass must not replace measured text nodes.
		while (walker.nextNode()) if (/\p{Extended_Pictographic}/u.test(walker.currentNode.nodeValue) && !walker.currentNode.parentNode.closest("svg, .emoji, [data-typing-host]")) found.push(walker.currentNode);
		for (const text of found) if (write(text.parentNode, text.nodeValue, text, semantic)) text.remove();
	};

	const el = (tag, cls, parent, text) => {
		const node = document.createElement(tag);
		for (const allow of ALLOWED) node.setAttribute(allow, "");
		if (cls) node.className = cls;
		if (text != null) write(node, text);
		if (parent) parent.appendChild(node);
		return node;
	};

	/** Styles of a node, written only when a value differs from the one written last: a frame
	 *  that repeats the frame before touches nothing. */
	const set = (node, styles) => {
		for (const key in styles) {
			const value = styles[key];
			if (node.__s?.[key] === value) continue;
			(node.__s ??= {})[key] = value;
			node.style[key] = value;
		}
	};

	const px = (v) => `${v.toFixed(2)}px`;

	// Scripts whose letters join (Arabic, Hebrew, the Indic ones): split into letters they lose
	// their shaping, so such a word moves whole; and right-to-left text runs right to left.
	const JOINED = /[֐-ࣿऀ-෿יִ-﷿ﹰ-﻿]/;
	const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

	/**
	 * "The *fastest* way" as word spans of letter spans inside `parent`; *stars* mark the accent.
	 * Returns { glyphs, words }: every letter with its word, every word with its letters.
	 * `glyphs: false` keeps words whole; `mask` lets letters rise through their word's bottom
	 * edge; `serif` sets an accent word in the look's serif italic.
	 */
	const glyphText = (parent, text, { glyphs: split = true, mask = false, serif = false } = {}) => {
		const glyphs = [];
		const words = [];
		if (RTL.test(String(text))) parent.setAttribute("dir", "rtl");
		let accent = false;
		for (const raw of String(text).split(/(\*)/)) {
			if (raw === "*") {
				accent = !accent;
				continue;
			}
			for (const part of raw.split(/(\s+)/)) {
				if (!part) continue;
				if (/^\s+$/.test(part)) {
					parent.appendChild(document.createTextNode(" "));
					continue;
				}
				const node = el("span", "word", parent);
				if (split && mask) {
					node.style.overflow = "hidden";
					node.style.verticalAlign = "top";
					node.style.paddingBottom = "0.14em";
					node.style.marginBottom = "-0.14em";
				}
				if (accent && serif) node.classList.add("serif");
				const word = { node, accent, glyphs: [], index: words.length, text: part };
				words.push(word);
				if (!split) {
					node.textContent = part;
					continue;
				}
				for (const ch of JOINED.test(part) ? [part] : letters(part)) {
					const glyph = { node: el("span", "glyph", node, ch), word: word.index, i: glyphs.length, ch };
					glyphs.push(glyph);
					word.glyphs.push(glyph);
				}
			}
		}
		return { glyphs, words };
	};

	/** A text without the stars that mark its accent. */
	const plain = (text) => String(text).replace(/\*/g, "");

	/**
	 * Every text a viewer sees under `stage` now: { text, x, y, w, h, line, opacity, seen, glyph,
	 * mock, roll, shaped, size, fitted }, in the page's pixels. `size` is the size it is set in, in
	 * the stage's own pixels (before any zoom), `fitted` whether it is display type, which is as
	 * large as the frame's width lets it and so on no scale. `line` is the height of one line of it, `seen`
	 * the share of its box its own containers let through, `shaped` whether a clip or a mask cuts
	 * it on purpose, `mock` whether it is inside a drawn interface, `over` whether it is meant to lie over
	 * other things (`data-over`: a stamp), `roll` a figure of rolling
	 * digits (its box, once). Decoration that says so is left out: `.deco`, `.ghost`,
	 * `[data-deco]`, anything in an <svg>. The engine fits a scene by these (engine.js) and
	 * tools/audit.mjs measures the same.
	 */
	const textBoxes = (stage) => {
		const out = [];
		const rolls = new Set();
		const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
		while (walker.nextNode()) {
			const node = walker.currentNode;
			const text = node.nodeValue.replace(/\s+/g, " ").trim();
			const parent = node.parentElement;
			if (!parent || parent.closest(".deco, .ghost, svg, [data-deco], #grain")) continue;
			// An explicitly illustrated emoji inside a moving tile is artwork, not
			// a label that should reframe the whole camera. Mixed text stays measured.
			const art=parent.closest('[data-design-glyph-art="icon"]');
			if(art&&/^\p{Extended_Pictographic}[\p{Emoji_Modifier}\uFE0F\u200D\p{Extended_Pictographic}]*$/u.test(art.textContent.trim()))continue;
			const roll = parent.closest("[data-roll]");
			if (roll) {
				if (rolls.has(roll)) continue;
				rolls.add(roll);
			}
			if (!text) continue;
			let opacity = 1, hidden = false, clip = null, shaped = false;
			for (let up = parent; up && up !== stage; up = up.parentElement) {
				const style = getComputedStyle(up);
				if (style.visibility === "hidden" || style.display === "none") {
					hidden = true;
					break;
				}
				opacity *= Number(style.opacity);
				if (style.clipPath !== "none" || style.maskImage !== "none") shaped = true;
				if (style.overflow !== "visible") {
					const r = up.getBoundingClientRect();
					clip = clip ? { l: Math.max(clip.l, r.left), t: Math.max(clip.t, r.top), r: Math.min(clip.r, r.right), b: Math.min(clip.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom };
				}
			}
			if (hidden || opacity < 0.4) continue;
			const range = document.createRange();
			range.selectNodeContents(roll ?? node);
			const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
			if (!rects.length) continue;
			// A rolling figure is as large as its window: the digits waiting above and below it are not seen.
			const box = roll ? roll.getBoundingClientRect() : range.getBoundingClientRect();
			const seen = clip ? (Math.max(0, Math.min(box.right, clip.r) - Math.max(box.left, clip.l)) * Math.max(0, Math.min(box.bottom, clip.b) - Math.max(box.top, clip.t))) / (box.width * box.height) : 1;
			// A URL is a real scrolling input: fit the visible window, not letters
			// deliberately scrolled out of it. Keep original ink/seen for audits.
			const flow = parent.closest('[data-typing-id]'), viewport = flow?.closest('[data-typing-viewport]');
			const input = ['browser-url','ui-macro.typeText'].includes(flow?.dataset.typingId) && viewport?.dataset.typingViewport===flow.dataset.typingId ? viewport : null;
			let fitBox = input && clip ? { x: Math.max(box.left, clip.l), y: Math.max(box.top, clip.t),
				w: Math.max(0, Math.min(box.right, clip.r) - Math.max(box.left, clip.l)),
				h: Math.max(0, Math.min(box.bottom, clip.b) - Math.max(box.top, clip.t)) } : undefined;
			const label = parent.closest('[data-design-overflow="ellipsis"]');
			if (!fitBox && label) {
				const style = getComputedStyle(label), lineHeight = parseFloat(style.lineHeight);
				const paddingY = (parseFloat(style.paddingTop)||0) + (parseFloat(style.paddingBottom)||0);
				const oneLine = lineHeight > 0 && Math.abs(label.clientHeight-paddingY-lineHeight) <= 1 && label.scrollHeight <= label.clientHeight+1;
				const textBox = ["block","inline-block","flow-root"].includes(style.display);
				if (textBox && style.whiteSpace === "nowrap" && style.textOverflow === "ellipsis" && ["hidden","clip"].includes(style.overflowX) && oneLine && label.clientWidth > 0) {
					// The label, including its painted ellipsis, is the fit boundary.
					// Keep its whole rect: clipping it to ancestors could hide an
					// off-frame label. Original text bounds/seen still expose clipping.
					const r = label.getBoundingClientRect();
					fitBox = { x:r.left, y:r.top, w:r.width, h:r.height };
				}
			}
			out.push({ text: roll ? "0" : text, over: Boolean(parent.closest("[data-over]")), mock: Boolean(parent.closest(".mock, .phone .screen")), size: Number.parseFloat(getComputedStyle(parent).fontSize), fitted: Boolean(parent.closest(".display, [data-size]")), roll: Boolean(roll), shaped, x: box.left, y: box.top, w: box.width, h: box.height, line: Math.min(...rects.map((r) => r.height)), opacity, seen, glyph: parent.classList.contains("glyph"), ...(fitBox?{fitBox}:{}) });
		}
		return out;
	};


return { el, set, px, glyphText, plain, emojify, textBoxes };
}
