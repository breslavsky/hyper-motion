// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function createType({ maths, dom }) {
const { clamp, expoOut, quartOut, smooth, spring, hash, alpha, EASE } = maths;
	const { set, px } = dom;

	/** Letters a decoding word flickers through before it settles. */
	const SCRAMBLE = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+/<>";

	/**
	 * The ways a letter arrives, by the look's `text`: (glyph, since, c) sets the letter's styles
	 * `since` seconds after its moment. `c` is the call: the letters' count `n`, the scene's clock
	 * `l`, the film's `feel` and scale `S`, the options `rise` and `rot`, and what `wave` and
	 * `gather` place a letter by.
	 */
	const ARRIVE = {
		// Letters rise through the word's bottom edge (the word is the mask).
		mask(g, since) {
			const k = expoOut(clamp(since / 0.6));
			set(g.node, { opacity: since > 0 ? "1" : "0", transform: `translateY(${((1 - k) * 1.1).toFixed(4)}em)` });
		},
		// Slams down from oversize with a short smear on impact.
		slam(g, since, c) {
			const k = spring(since, 4.4, 0.55, c.feel);
			const smear = since > 0 && since < 0.1 ? 1 - since / 0.1 : 0;
			set(g.node, {
				opacity: smooth(since / 0.05).toFixed(3),
				transform: `translateY(${((1 - k) * -0.3).toFixed(4)}em) scale(${(1 + (1 - k) * 0.75).toFixed(4)})`,
				filter: smear ? `blur(${(smear * 7 * c.S).toFixed(2)}px)` : "none",
			});
		},
		// Flickers through other characters, 24 a second, then is itself.
		scramble(g, since, c) {
			const ch = since >= 0.3 || /\s/.test(g.ch ?? "") ? g.ch : SCRAMBLE[Math.floor(hash(g.i * 13.1 + Math.floor(c.l * 24)) * SCRAMBLE.length)];
			if (g.ch && g.node.textContent !== ch) g.node.textContent = ch;
			set(g.node, { opacity: clamp((since + 0.1) / 0.05).toFixed(3) });
		},
		// A focus pull: each letter sharpens out of a soft, slightly oversized haze.
		blur(g, since) {
			const k = expoOut(clamp(since / 0.75));
			set(g.node, {
				opacity: clamp(since / 0.35).toFixed(3),
				transform: `translateY(${((1 - k) * 0.12).toFixed(4)}em) scale(${(1 + (1 - k) * 0.14).toFixed(4)})`,
				filter: k < 0.995 ? `blur(${((1 - k) * 0.16).toFixed(4)}em)` : "none",
			});
		},
		// From the centre outward with an elastic overshoot, squashing as it lands.
		wave(g, since, c) {
			const mid = (c.n - 1) / 2;
			const from = c.wordAt ? c.moment(g) : c.at + Math.abs(g.i - mid) * c.step * 1.4;
			const e = c.l - from;
			const s = spring(e, 2.6, 0.32, c.feel);
			const squash = 1 + (s - 1) * 0.6;
			set(g.node, {
				opacity: smooth(e / 0.09).toFixed(3),
				transform: `translateY(${((1 - s) * 1.15).toFixed(4)}em) scale(${(2 - squash).toFixed(4)}, ${squash.toFixed(4)})`,
			});
		},
		// Each letter flips up out of the floor on its own hinge.
		flip(g, since, c) {
			const s = spring(since, 2.9, 0.48, c.feel);
			set(g.node, {
				opacity: smooth(since / 0.11).toFixed(3),
				transformOrigin: "50% 100%",
				transform: `perspective(6em) rotateX(${((1 - s) * -95).toFixed(3)}deg)`,
			});
		},
		// Words start spread wide apart and glide together into the line, sharpening as they go.
		gather(g, since, c) {
			const mid = (c.words - 1) / 2;
			const from = c.wordAt ? c.wordAt[g.word] : c.at + g.word * 0.06;
			const e = c.l - from;
			const k = expoOut(clamp(e / 0.9));
			set(g.node, {
				opacity: clamp(e / 0.25).toFixed(3),
				transform: `translateX(${((g.word - mid) * 0.9 * (1 - k)).toFixed(4)}em)`,
				filter: k < 0.98 ? `blur(${((1 - k) * 0.06).toFixed(4)}em)` : "none",
			});
		},
		// Written on: the outline traces left to right, then the fill floods in.
		draw(g, since) {
			const w = quartOut(clamp(since / 0.55));
			const fill = clamp((since - 0.4) / 0.35);
			set(g.node, {
				opacity: since > 0 ? "1" : "0",
				clipPath: w < 1 ? `inset(-0.2em ${((1 - w) * 100).toFixed(2)}% -0.2em -0.1em)` : "none",
				webkitTextStroke: fill < 1 ? `${(0.018 * (1 - fill)).toFixed(4)}em currentColor` : "0",
				webkitTextFillColor: fill < 1 ? `color-mix(in srgb, currentColor ${(fill * 100).toFixed(1)}%, transparent)` : "",
			});
		},
	};

	/**
	 * The look's default: a letter arrives by moving, not fading. A short rise that lands slowing
	 * down (softLand, about 0.4 s) with a slight late lean, a focus pull in its first frames, and
	 * opacity only as a 0.1 s assist.
	 */
	const land = (g, since, c) => {
		const k = EASE.softLand(clamp(since / (0.42 / c.feel.snap)));
		const lean = c.feel.bounce > 0.5 ? Math.sin(clamp((since - 0.12) / 0.4) * Math.PI) * 0.04 * Math.min(1.5, c.feel.bounce) : 0;
		set(g.node, {
			opacity: clamp(since / 0.1).toFixed(3),
			transform: `translateY(${((1 - k) * c.rise * 0.55 - lean * c.rise).toFixed(4)}em) rotate(${((1 - k) * c.rot * 0.4).toFixed(3)}deg)`,
			filter: k < 0.97 && since > 0 ? `blur(${((1 - k) * 0.07).toFixed(4)}em)` : "none",
		});
	};

	/**
	 * The letters of a line at the scene's time `l`: one after another from `at`, `stagger` apart
	 * (closer for a long line, so the whole line lands within about half a second), or each word
	 * from its own time in `wordAt`. `mode` is how they arrive; `film` is { feel, S }.
	 */
	const riseGlyphs = (glyphs, l, { at = 0.04, stagger = 0.032, rise = 0.85, rot = -12, wordAt, mode } = {}, film) => {
		const n = glyphs.length;
		const step = Math.min(stagger, 0.55 / Math.max(1, n));
		const moment = (g) => (wordAt ? wordAt[g.word] + (g.i - (g.first ?? 0)) * step : at + g.i * step);
		const call = { n, l, at, step, rise, rot, wordAt, moment, words: (glyphs[n - 1]?.word ?? 0) + 1, feel: film.feel, S: film.S };
		const arrive = ARRIVE[mode] ?? land;
		for (const g of glyphs) arrive(g, l - moment(g), call);
	};

	/**
	 * Print misregistration on impact frames: the type splits into two echoes in the look's coral
	 * and lime, `amount` from 0 to 1. Only in a look that prints (`deco.misreg`).
	 */
	const misreg = (node, amount, { look, palette, S }) => {
		if (!look?.deco?.misreg || amount <= 0.002) {
			if (node.style.textShadow) node.style.textShadow = "";
			return;
		}
		const d = 12 * S * amount;
		node.style.textShadow = `${px(-d)} ${px(d * 0.3)} 0 ${alpha(palette.coral, 0.85 * amount)}, ${px(d)} ${px(-d * 0.3)} 0 ${alpha(palette.lime, 0.85 * amount)}`;
	};


return { riseGlyphs, misreg, modes: [...Object.keys(ARRIVE), "spring"] };
}
