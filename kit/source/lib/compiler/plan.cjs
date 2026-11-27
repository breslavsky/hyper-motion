// Pure build-time recipe compiler. HyperFrames owns playback; this module only
// resolves layouts, brand/look tokens, durations, transitions and sound events.
// Kept against the original Kinetic plan fixtures; see SOURCE.json.
const ALL_LOOKS = {...require('./looks.cjs'), ...require('./looks-own.cjs')};
// Keep related material directions adjacent in the catalogue and its controls.
const LOOKS = Object.fromEntries(Object.entries(ALL_LOOKS).flatMap(([id, look]) =>
  id === 'metal' ? [] : id === 'glass' ? [[id, look], ['metal', ALL_LOOKS.metal]] : [[id, look]]));
const {METAL_VARIANTS,resolveMetalLook}=require('./metal.cjs');
const {MATERIALS,materialProblems,resolveMaterialLook}=require('./material.cjs');
const ours = () => require('./definitions.cjs');
const sceneAliases = new Map(Object.entries(require('../components/scene-aliases.json')));
// Normalize saved recipes at the input boundary. Authored data remains untouched.
function canonicalScene(scene) {
  const type = sceneAliases.get(scene?.type);
  return type ? {...scene, type} : scene;
}
const {typewriterTiming}=require('../components/typewriter-timing.cjs');
const {sceneMoments}=require('../components/scene-moments.cjs');
const {applyBrandPalette,resolveBrandStyle}=require('../components/brand-tokens.cjs');

	const ASPECTS = {
		"16:9": { width: 1920, height: 1080 },
		"9:16": { width: 1080, height: 1920 },
		"1:1": { width: 1080, height: 1080 },
	};
	/**
	 * The safe area of each frame: the shares of its width and height kept clear at each side.
	 * What a viewer reads stays inside it. A vertical video is watched under an app's own
	 * interface: the caption and the buttons of TikTok, Reels and Shorts lie over its foot, the
	 * header over its top. The engine lays scenes out inside it (engine.js, `.center` and
	 * `K.safe`), and tools/audit.mjs measures that they stay there.
	 */
	/**
	 * The looks that throw sparks on a hit (a slam, an end card landing): the ones whose sound kit is
	 * punch, play or tech (lib/sounds.json; a test holds the two to one another). A calm look
	 * lands its words without them. `"sparks"` of a film says otherwise.
	 */
	const SPARKS = new Set(["editorial", "poster", "loud", "swiss", "onetake", "sting", "toy", "chrome", "grape", "ember", "lava", "noir", "terminal", "neon", "glitch", "halftone", "riso", "collage", "sketch", "play", "candy", "clay", "sand"]);
	/**
	 * The sizes of type a scene sets, by the part the text plays, in pixels of a frame 1080 on
	 * its short side: five steps about 1.4 apart. A scene names the part, never a number of its
	 * own: surveyed, the scenes set type under 130 px in 77 different sizes, an item of a list
	 * 54 px in one scene and 111 in another (HISTORY 335). Words fitted to the frame's width
	 * (a title, a slam) are as large as the width lets them and are not on the scale.
	 *   label  a number, a tag, a note        body   a line under a title, a button
	 *   lead   an item of a list, the main line      title  a scene's title
	 *   big    a figure, a word that carries the scene
	 * A tall frame, read on a phone held upright, sets them a tenth larger.
	 */
	const TYPE = { label: 36, body: 52, lead: 72, title: 102, big: 144 };
	const typeOf = (width, height) => {
		const k = (Math.min(width, height) / 1080) * (height > width * 1.2 ? 1.1 : 1);
		return Object.fromEntries(Object.entries(TYPE).map(([part, size]) => [part, Math.round(size * k * 10) / 10]));
	};
	const SAFE = {
		"16:9": { top: 0.05, bottom: 0.05, left: 0.04, right: 0.04 },
		"9:16": { top: 0.08, bottom: 0.16, left: 0.05, right: 0.05 },
		"1:1": { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
	};
	/** Seconds each transition takes, before the look's and the film's own stretch. */
	const TRANSITIONS = {
		cut: 0, whip: 0.34, circle: 0.5, zoom: 0.42, wipe: 0.46, push: 0.4, glide: 0.55, scan: 0.5, iris: 0.56,
		flood: 0.6, halftone: 0.52, glitch: 0.4, shutter: 0.55, flip: 0.6, flash: 0.5, dots: 0.62, pixels: 0.5, open: 0.55,
	};
	/** A pace stretches the beats a scene asked for and plays what is inside it faster. */
	const PACES = {
		chill: { beats: 1.2, speed: 1 },
		normal: { beats: 1, speed: 1.25 },
		hyper: { beats: 0.75, speed: 1.6 },
	};
	/** Palette names tried in turn for a scene's accent. */
	const ACCENTS = ["lime", "coral", "electric", "peach", "butter", "sage", "lilac", "ink", "paper"];
	/** The sound of a scene's marks when it is not a tick. */
	const MARK_SOUND = { morph: "click", ticket: "stamp" };

	const lookOf = (id) => LOOKS[id ?? "editorial"] ?? LOOKS.editorial;

	const hsl = (hex) => {
		const raw = hex.replace("#", "");
		const six = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw.slice(0, 6);
		const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(six.slice(i, i + 2), 16) / 255);
		const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
		if (!d) return [0, 0, l];
		const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
		return [h * 60, d / (1 - Math.abs(2 * l - 1)), l];
	};
	const hex = ([h, s, l]) => {
		const k = (n) => (n + (((h % 360) + 360) % 360) / 30) % 12;
		const a = s * Math.min(l, 1 - l);
		return `#${[0, 8, 4].map((n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))).toString(16).padStart(2, "0")).join("")}`;
	};
	/**
	 * A look's palette in the brand's own colours (`"palette": "brand"` of a film): every accent
	 * and tinted ground keeps how light and how strong it is, so the look's contrast holds, and
	 * takes the hue of the brand's first colour or its second (a third of a turn away from the
	 * first when there is one colour only, for the warm accents). The brand's colours themselves
	 * stand in the accents nearest to them in lightness. Paper and ink stay the look's.
	 */
	const SECOND = ["coral", "peach", "butter"];
	const brandPalette = (palette, colors) => {
		const [first, second] = colors;
		const [h1, s1] = hsl(first);
		const [h2, s2] = second ? hsl(second) : [h1 + 32, s1];
		const out = { ...palette };
		for (const name of ["lime", "sage", "peach", "electric", "coral", "lilac", "butter", "sky"]) {
			const [, s, l] = hsl(palette[name]);
			if (palette[name] === palette.paper || palette[name] === palette.ink || s < 0.08) continue;
			const warm = SECOND.includes(name);
			// A brand of greys keeps the film grey; a turn of 14 degrees keeps two accents of one hue apart.
			const turn = name === "lime" || name === "butter" ? 14 : name === "lilac" ? -14 : 0;
			out[name] = hex([(warm ? h2 : h1) + turn, Math.min(s, Math.max(0.12, (warm ? s2 : s1) * 1.1)), l]);
		}
		// The brand's colours as they are, each in the accent that is as light as it is: a look's
		// grounds and the type on them were chosen by how light each accent is, and a brand colour put
		// where a darker one stood left type that could not be read.
		const free = ["electric", "coral", "lime", "peach", "lilac", "butter"].filter((name) => hsl(palette[name])[1] >= 0.08);
		for (const colour of [first, second]) {
			if (!colour || !free.length) continue;
			const light = hsl(colour)[2];
			const [name] = free.sort((a, b) => Math.abs(hsl(palette[a])[2] - light) - Math.abs(hsl(palette[b])[2] - light));
			out[name] = colour;
			free.splice(0, 1);
		}
		return out;
	};

	/** The look's palette with the brand's own two colours. */
	const paletteOf = (style, brand, own, metalVariant) => {
		const [first, second] = brand?.colors ?? [];
		const look = resolveMetalLook(lookOf(style), metalVariant);
		const palette = own && first ? brandPalette(look.palette, brand.colors) : look.palette;
		return { ...palette, brand: first ?? palette.electric, brand2: second ?? first ?? palette.coral };
	};

	/** A colour given as a palette name or a #hex; undefined for anything else. */
	const colour = (value, palette) => {
		if (value) return palette[value] ?? (/^#[0-9a-fA-F]{3,8}$/.test(value) ? value : undefined);
	};

	/** Relative luminance of a #hex (WCAG). */
	const luminance = (hex) => {
		const raw = hex.replace("#", "");
		const six = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw.slice(0, 6);
		const [r, g, b] = [0, 2, 4].map((i) => {
			const v = Number.parseInt(six.slice(i, i + 2), 16) / 255;
			return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const contrast = (a, b) => {
		const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
		return (hi + 0.05) / (lo + 0.05);
	};

	/** The text colour on a background: the palette's ink or paper, whichever reads better. */
	const inkOn = (bg, palette) => {
		if (bg === "sky") return "#ffffff";
		const light = palette.paper && luminance(palette.paper) > 0.5 ? palette.paper : "#ffffff";
		const dark = luminance(palette.ink) < 0.2 ? palette.ink : "#111111";
		return contrast(dark, bg) >= contrast(light, bg) ? dark : light;
	};

	/** The first palette colour that stands out on a background and is not taken already. */
	const accentOn = (bg, palette, taken) => {
		let best = palette.ink;
		let bestContrast = -1;
		for (const name of ACCENTS) {
			const c = palette[name];
			if (taken.includes(c) || c === bg) continue;
			const k = contrast(c, bg);
			if (k >= 1.6) return c;
			if (k > bestContrast) {
				bestContrast = k;
				best = c;
			}
		}
		return best;
	};

	const count = (scene, field) => (Array.isArray(scene[field]) ? scene[field].length : 0);

	/**
	 * The sounds inside a scene, by its type: (scene, len, cue, at), where `len` is the scene's length
	 * in its own clock, cue(at, kind, strength) puts a sound `at` seconds into that clock, and `at`
	 * is the scene's named moments (components/scene-moments.cjs) when it has them: a sound of a
	 * moment the picture also reads takes it from there, never from a number written twice.
	 */
	const SOUNDS = {
		tiles(s, len, cue, at) {
			const n = [...s.text].length;
			for (let i = 0; i < n; i++) cue(at.first + i * at.every, "pop", 0.6);
		},
		inline(s, len, cue, at) {
			for (const pop of at.pops) cue(pop, "pop", 0.8);
			if (count(s, "images") > 0) cue(at.zoom, "whoosh", 1.2);
		},
		bubbles(s, len, cue, at) {
			for (let i = 0; i < at.count; i++) cue(i * at.every, "pop", 0.45);
			if (!s.answer) return;
			cue(at.away, "whoosh", 0.8);
			const chars = s.answer.length;
			for (let c = 0; c < chars; c += 2) cue(at.type + (c / chars) * (at.typed - at.type), "type", 0.8);
			cue(at.sent, "ping", 0.8);
		},
		retype(s, len, cue, at) {
			const texts = [s.from, ...s.to];
			for (let c = 0; c < texts[0].length; c++) cue(at.start + c * at.key, "type");
			at.selects.forEach((select, i) => {
				cue(select, "click", 0.7);
				for (let c = 0; c < texts[i + 1].length; c++) cue(at.types[i] + c * at.key, "type");
			});
		},
		checklist(s, len, cue) {
			const n = s.items.length;
			const first = Math.max(0.7, len * 0.24);
			const step = Math.max(0.3, (len * 0.97 - first) / n);
			for (let i = 0; i < n; i++) cue(first + i * step, "click");
			cue(first + (n - 1) * step + 0.12, "chime", 0.7);
		},
		cards3d(s, len, cue, at) {
			for (const land of at.lands) cue(land, "whoosh", 0.6);
		},
		icon3d(s, len, cue, at) {
			cue(at.land, "hit", 0.8);
			cue(at.sparkle, "sparkle");
		},
		roll(s, len, cue, at) {
			for (const turn of at.turns) cue(turn, "tick", 0.85);
		},
		journey(s, len, cue, at) {
			for (const word of at.words) cue(word, "type", 0.35);
			for (const turn of at.turns) cue(turn, "tick", 0.8);
			cue(0.1, "whoosh", 0.5);
		},
		faces(s, len, cue, at) {
			for (let i = 0; i < 6; i++) cue(at.first + i * at.every, "pop", 0.3);
		},
		shuffle(s, len, cue, at) {
			cue(at.move + 0.2, "whoosh", 0.8);
			cue(at.land, "hit", 0.5);
		},
		dot(s, len, cue, at) {
			if (s.lead) cue(at.fall, "whoosh", 0.5);
			cue(at.hits[0], "pop", 0.9);
			cue(at.hits[1], "pop", 0.4);
			cue(at.hits[2], "tick", 0.3);
			cue(at.grow, "whoosh", 0.9);
			cue(at.hit, "hit", 0.6);
			for (const morph of at.morphs ?? []) cue(morph, "tick", 0.6);
			cue(at.ring, "sparkle", 0.8);
		},
		flip(s, len, cue, at) {
			for (const swap of at.swaps.slice(1)) cue(swap, "tick", 0.8);
			if (at.mark === undefined) return;
			cue(at.fan, "whoosh", 0.6);
			cue(at.mark, "sparkle", 0.8);
		},
		pullback(s, len, cue, at) {
			const chars = at.keys.length - 1, heard = Math.min(14, chars);
			for (let c = 0; c < heard; c++) cue(at.keys[Math.floor((c * chars) / heard)], "type", 0.35);
			cue(at.pull, "whoosh", 0.7);
			cue(at.click, "click", 0.9);
		},
		pack(s, len, cue, at) {
			cue(0.02, "pop", 0.8);
			for (let i = 1; i < 6; i++) cue(at.first + (i - 1) * (at.spread / 4), "pop", 0.35);
			cue(at.out, "whoosh", 0.7);
		},
		swarm(s, len, cue, at) {
			cue(0.05, "riser", 0.5);
			if (!s.text) return;
			cue(at.out, "whoosh", 0.9);
			cue(at.hit, "hit", 0.6);
		},
		split(s, len, cue, at) {
			cue(0.02, "whoosh", 0.5);
			for (const swap of at.swaps.slice(1)) cue(swap, "tick", 0.7);
		},
		montage(s, len, cue) {
			const n = s.lines.length * 3;
			const total = s.lines.length * 4.2;
			let t = 0;
			for (let i = 0; i < n; i++) {
				const third = i % 3 === 2;
				cue(t, third ? "tick" : "hit", third ? 0.4 : 0.5);
				t += ((third ? 2.2 : 1) / total) * len;
			}
		},
		web(s, len, cue, at) {
			cue(0.02, "pop", 0.6);
			for (const key of at.keys) cue(key, "tick", 0.7);
		},
		picker(s, len, cue, at) {
			for (const hop of at.hops) cue(hop, "tick", 0.5);
			cue(at.land, "pop", 0.9);
		},
		palette(s, len, cue, at) {
			// A sound on each letter as it appears, on twelve of them in a longer query.
			const chars = Math.round((at.typed - at.type) / at.every), heard = Math.min(chars, 12);
			for (let c = 1; c <= heard; c++) cue(at.type + Math.round((c * chars) / heard) * at.every, "type", 0.35);
			cue(at.enter, "click", 0.9);
			cue(at.open, "whoosh", 0.5);
		},
		agent(s, len, cue, at) {
			for (const done of at.done) cue(done, "tick", 0.6);
			cue(at.all, "chime", 0.8);
		},
		particles(s, len, cue, at) {
			cue(at.gather, "riser", 0.6);
			cue(at.solid, "sparkle", 0.8);
		},
		wave(s, len, cue, at) {
			cue(0.05, "pop", 0.5);
			cue(at.talk, "click", 0.5);
		},
		arc(s, len, cue, at) {
			cue(at.rise, "whoosh", 0.5);
			for (const swap of at.swaps.slice(1)) cue(swap, "tick", 0.6);
		},
		orb(s, len, cue, at) {
			cue(0.02, "riser", 0.5);
			for (const line of at.lines) cue(line, "chime", 0.5);
		},
		scatter(s, len, cue, at) {
			const words = s.text.split(/\s+/).filter(Boolean).length;
			for (let i = 0; i < words; i++) cue(at.first + i * at.every, "tick", 0.35);
			cue(at.gather, "whoosh", 0.8);
			cue(at.hit, "hit", 0.6);
		},
		knockout(s, len, cue, at) {
			cue(0.02, "hit", 0.6);
			cue(at.zoom, "riser", 0.7);
			cue(at.land, "whoosh", 0.9);
		},
		assemble(s, len, cue, at) {
			const n = [...s.word].length;
			for (let i = 0; i < Math.min(n, 8); i++) cue(at.first + i * at.every * (n / Math.min(n, 8)), "stamp", 0.4);
			cue(at.resolve, "whoosh", 0.6);
			cue(at.clean, "chime", 0.7);
		},
		hive(s, len, cue, at) {
			const n = Math.min(12, s.icons?.length || 8);
			for (let i = 0; i < n; i++) cue(at.icons + i * at.stagger + at.land, "tick", 0.45);
			cue(at.pull, "whoosh", 0.8);
			cue(at.pop, "pop", 0.9);
		},
		between(s, len, cue, at) {
			cue(0.05, "whoosh", 0.6);
			for (const tap of at.taps) cue(tap, "click", 0.6);
			cue(at.confirm, "click", 0.9);
			cue(at.burst, "sparkle", 0.8);
			cue(at.exit, "whoosh", 0.7);
		},
		drag(s, len, cue, at) {
			at.drops.forEach((drop, i) => {
				cue(at.grabs[i], "click", 0.5);
				cue(drop, "pop", 0.6);
				cue(at.checks[i], "tick", 0.5);
			});
			cue(at.click, "click", 0.9);
		},
		field(s, len, cue) {
			cue(0.1, "riser", 0.6);
			cue(len * 0.62, "whoosh", 0.6);
		},
		trail(s, len, cue) {
			cue(0, "whoosh", 1);
			cue(0.35, "type", 0.5);
		},
		overlay(s, len, cue, at) {
			at.cards.forEach((card, i) => {
				cue(card, "pop", 0.6);
				cue(at.settle[i], "tick", 0.5);
			});
		},
		props3d(s, len, cue) {
			for (let i = 0; i < 6; i++) cue(0.12 + i * 0.07, "pop", 0.5);
			cue(0.25, "sparkle", 0.8);
		},
		phone3d(s, len, cue) {
			cue(0.1, "whoosh", 0.9);
		},
		mosaic(s, len, cue, at) {
			for (let i = 0; i < 6; i++) cue(at.first + i * at.every, "pop", 0.35);
		},
	};

	/** The sound of a transition into a scene that starts at `start` and takes `trDur`. */
	const transitionCue = (transition, start, trDur) => {
		switch (transition) {
			case "whip": case "zoom": case "push": case "glide":
				return { t: Math.max(0, start - trDur * 0.5), kind: "whoosh", strength: transition === "zoom" ? 1.2 : transition === "glide" ? 0.7 : 1 };
			case "circle": case "wipe": case "scan": case "shutter":
				return { t: Math.max(0, start - 0.08), kind: "whoosh", strength: 0.6 };
			case "flip": return { t: Math.max(0, start - trDur * 0.5), kind: "whoosh", strength: 0.8 };
			case "glitch": return { t: Math.max(0, start - trDur * 0.3), kind: "tick", strength: 1 };
			case "dots": return { t: Math.max(0, start - trDur * 0.4), kind: "sparkle", strength: 0.8 };
			case "pixels": return { t: Math.max(0, start - trDur * 0.5), kind: "glitch", strength: 0.5 };
			case "open": return { t: Math.max(0, start - trDur * 0.6), kind: "whoosh", strength: 0.6 };
			case "flash": return { t: Math.max(0, start - 0.05), kind: "hit", strength: 0.7 };
			default: return undefined;
		}
	};

	/** The plan of a film; `aspect` overrides the film's own ("16:9", "9:16", "1:1"). */
	const compile = (film, aspect) => {
		const materialErrors = materialProblems(film);
		if (materialErrors.length) throw new Error(materialErrors.join('\n'));
		const { width, height } = ASPECTS[aspect ?? film.aspect];
		const baseLook = resolveMetalLook(lookOf(film.style), film.metalVariant);
		const look = resolveMaterialLook(baseLook, film.material);
		const bpm = film.music?.bpm ?? 120;
		const beat = 60 / bpm;
		const basePalette = paletteOf(film.style, film.brand, film.palette === "brand", film.metalVariant);
		const tokens = film.brand?.tokens;
		const palette = tokens ? applyBrandPalette(basePalette, tokens) : basePalette;
		const pace = PACES[film.pace ?? "normal"] ?? PACES.normal;
		const speed = pace.speed;
		const scenes = [];
		const cues = [];
		const audioEvents = [];
		let start = 0;
		let lastBg = "";

		film.scenes.forEach((input, index) => {
			const scene = canonicalScene(input);
			const cueFrom = cues.length;
			// A scene may wear another look than the film's.
			const sceneLook = scene.look ?? look.id;
			const variant = scene.metalVariant ?? (baseLook.id === 'metal' ? baseLook.material.variant : undefined);
			const ownLook = sceneLook !== baseLook.id || (sceneLook === 'metal' && variant !== baseLook.material?.variant)
				? resolveMetalLook(lookOf(sceneLook), variant) : undefined;
			const own = ownLook ? resolveMaterialLook(ownLook, film.material) : undefined;
			const worn = own ?? look;
			const colours = ownLook ? paletteOf(ownLook.id, film.brand, film.palette === "brand", ownLook.material?.variant) : basePalette;
			const dur = Math.max(1, Math.round(scene.beats * pace.beats)) * beat;
			const len = dur * speed; // the scene's length in its own, faster clock

			let ground = scene.bg;
			if (!ground) {
				if (index === 0) ground = worn.opener;
				else if (scene.type === "endcard") ground = worn.closer;
				else if (scene.type === "morph") ground = "paper";
				else {
					// The look's rhythm of grounds, never the same colour twice running.
					let i = (index * 3) % worn.rhythm.length;
					for (let n = 0; n < worn.rhythm.length && colour(worn.rhythm[i], colours) === lastBg; n++) i = (i + 1) % worn.rhythm.length;
					ground = worn.rhythm[i];
				}
			}
			const bg = ground === "sky" && worn.id === "editorial" ? "sky" : (colour(ground, colours) ?? colours.paper);
			const bgHex = bg === "sky" ? colours.sky : bg;
			const fg = colour(scene.fg, colours) ?? inkOn(bg, colours);
			const transition = index === 0 ? "cut" : (scene.in ?? worn.transitions[index % worn.transitions.length]);
			const trDur = Math.min(TRANSITIONS[transition] * worn.feel.trLength * (film.motion?.trLength ?? 1), dur * 0.6);
			const named = scene.type === "highlight" ? scene.mark : scene.type === "swap" ? scene.pill : undefined;
			const accent = colour(named, colours) ?? accentOn(bgHex, colours, [fg]);

			const planned = {
				...(own ? { look: own, palette: colours } : {}),
				index, scene, start, dur, speed, ldur: len, bg, fg, accent, transition, trDur,
				...(tokens ? {brandBase:{palette:colours,bg,fg,accent},...resolveBrandStyle({palette:colours,bg,fg,accent},tokens,scene)} : {}),
				// When its parts land, its cursor presses and its named moments happen (components/scene-moments.cjs).
				...sceneMoments(scene, len, beat * speed),
			};
			if (planned.clickAt === undefined) delete planned.clickAt;
			else cues.push({ t: start + planned.clickAt / speed, kind: "click" });

			const markSound = MARK_SOUND[scene.type] ?? "tick";
			const landed = planned.marks ?? [];
			landed.forEach((mark, i) => {
				const t = start + mark / speed;
				if (scene.type === "slam") cues.push({ t, kind: i === landed.length - 1 ? "hit" : "tick", strength: 1 });
				else cues.push({ t, kind: markSound, strength: 0.8 });
			});

			const into = index > 0 ? transitionCue(transition, start, trDur) : undefined;
			if (into) cues.push(into);

			const put = (at, kind, strength) => {
				const cue = { t: start + Math.max(0, at) / speed, kind };
				if (strength !== undefined) cue.strength = strength;
				cues.push(cue);
			};
			SOUNDS[scene.type]?.(scene, len, put, planned.at);
			// A scene of ours: (scene, its length and its beat in its own clock, how fast that clock runs).
			ours()[scene.type]?.sounds?.(scene, len, put, beat * speed, speed);

			if (scene.type === "fullbleed" || scene.type === "logo3d" || scene.type === "endcard") cues.push({ t: start, kind: "hit" });
			else if (scene.type !== "slam") cues.push({ t: start, kind: "tick", strength: 0.5 });
			if (scene.type === "endcard") cues.push({ t: Math.max(0, start - beat * 2), kind: "riser" });

			// Keep visual impulses unchanged when sound is muted or remapped. Events
			// retain their owning component even when a transition starts before it.
			const sound = scene.sound ?? {};
			if (!sound.mute && sound.gain !== 0) {
				const localAudio=cues.slice(cueFrom);
				// Typewriter keys share the picture's deterministic schedule. They are
				// audio events only: adding keys must not change film-level hit effects.
				if(scene.type==='typewriter')for(const event of typewriterTiming(scene,len).events)localAudio.push({t:start+event.at/speed,kind:'type',strength:.35});
				for (const cue of localAudio) {
					const kind = sound.mapping?.[cue.kind] ?? cue.kind;
					if (kind === false) continue;
					audioEvents.push({ ...cue, kind, scene: index, ...(sound.kit ? { kit: sound.kit } : {}), ...(sound.gain !== undefined ? { gain: sound.gain } : {}) });
				}
			}

			scenes.push(planned);
			lastBg = bgHex;
			start += dur;
		});

		return {
			width, height,
			fps: film.fps ?? 30,
			bpm, beat, speed,
			duration: start + beat * 0.5,
			safe: SAFE[aspect ?? film.aspect],
			type: typeOf(width, height),
			style: look.id,
			look: film.motion?.text ? { ...look, text: film.motion.text } : look,
			motion: film.motion,
			app: film.app,
			palette,
			brand: film.brand,
			grain: film.grain !== false && look.deco.grain > 0,
			sparks: film.sparks ?? SPARKS.has(look.id),
			scenes,
			cues: cues.sort((a, b) => a.t - b.t),
			audioEvents: audioEvents.sort((a, b) => a.t - b.t),
		};
	};

module.exports = { compile, canonicalScene, looks: LOOKS, materials: MATERIALS, metalVariants: METAL_VARIANTS, aspects: ASPECTS, safe: SAFE, type: TYPE, typeOf, paces: PACES, transitions: TRANSITIONS };
