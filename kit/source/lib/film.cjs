// The film's helper, run in Node from source/:
//
//   node lib/film.cjs fit    after any change to film.json: says what is wrong with it,
//                            sets the page (index.html) to the film's length and size and
//                            writes the film's emoji as the kit draws them (assets/emoji.json)
//   node lib/film.cjs plan   the film's times as JSON: length, tempo, track and sound cues
//                            (what source/music.py reads)
//   node lib/film.cjs check  what is wrong (errors) and what would make it a better film
//                            (notes), with its length and size, as JSON (the template's checks)
//   node lib/film.cjs book   the storybook the user reads in the app, made from the film
//                            (for `harness storybook set --file`)
//   node lib/film.cjs palette <picture>
//                            what a picture gives a film: its two colours and the looks
//                            nearest to it (a reference for the look, a screenshot)
//   node lib/film.cjs brand "<name>" <brand.json>
//                            whether a brand card (`screenshot_page` with `brand: true`) is the
//                            card of the brand named, and what to write into the film from it
//   node lib/film.cjs change the change a panel asks for, applied to film.json with no agent:
//                            the look, the colours, the sound kit, sparks, the frame, the pace
//                            (JSON in HARNESS_CHANGE; the worker runs it, template.json "changes")
//
// Every time comes from the pure recipe compiler (lib/compiler/plan.cjs).
// fit emits native HyperFrames scene hosts; the browser never compiles or plays a film engine.
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const zlib = require("zlib");
const { buildProject, nativeClips, buildMark } = require("./build.cjs");
const { compile: compileRecipe, canonicalScene, looks, metalVariants, aspects, paces, transitions } = require("./compiler/plan.cjs");
const { materialProblems } = require("./compiler/material.cjs");
const CATALOG = require("./components/catalog.json");
const { surfaceForeground } = require("./components/brand-tokens.cjs");
// The fields of every scene type: Kinetic's (compiler/fields.cjs) and our component metadata.
const OWN = require("./compiler/definitions.cjs");
const WRITTEN = { ...require("./compiler/fields.cjs"), ...Object.fromEntries(Object.entries(OWN).map(([type, def]) => [type, def.fields])) };
// The longest text each field holds, measured (lib/limits.json, written by tools/audit.mjs
// --limits: nothing cut, outside the safe area, too small or over another text, with Russian
// words, in every frame). The written limits were taken by eye for lines in Latin letters, and
// Kinetic's own films, in English, fit them; Cyrillic is wider, letter for letter, and looks
// that set capitals wider still. So the measured limit holds a text with letters beyond Latin
// (`wide`), and a Latin one keeps the written limit.
const FIELDS = (() => {
	let measured = {};
	try {
		measured = JSON.parse(fs.readFileSync(path.join(__dirname, "limits.json"), "utf8")).limits ?? {};
	} catch {} // a project made before the file keeps the written limits
	const out = JSON.parse(JSON.stringify(WRITTEN));
	for (const [type, fields] of Object.entries(measured)) {
		for (const [at, most] of Object.entries(fields)) {
			// "items[]" or "messages[].text": down to the text's own spec.
			let spec = out[type];
			for (const step of at.match(/[^.[\]]+|\[\]/g) ?? []) spec = !spec ? null : step === "[]" ? spec.of : (spec.fields ?? spec)[step];
			if (spec?.kind === "string" && typeof most === "number" && most < (spec.max ?? Infinity)) spec.wide = Math.max(spec.min ?? 1, most);
		}
	}
	return out;
})();
const SOUNDS = require("./sounds.json");
/** The kit of sounds a film plays: the one it names, else its look's. */
const kitOf = (film) => film.music?.kit ?? SOUNDS.looks[film.style] ?? "soft";

const SOURCE = path.resolve(__dirname, "..");
const TRACKS = ["pulse", "bounce", "drive", "air", "space", "none"];
// `offset` is in the films projects were started with and does nothing: it stays allowed so they keep building.
const MUSIC_KEYS = ["track", "bpm", "kit", "volume", "file", "from", "offset"];

// A film on a track of its own: a file the user uploaded or a tool made (`music.file`). The film
// takes the track's tempo and starts on its first beat, both read from the track's map, which the
// worker makes when a sound arrives (`harness track-map <file>` for any other file). The writer
// names the file; nothing about the track is worked out by hand.
const TRACK_FILE = /^(inputs|assets|media|derived)\/[\w./-]+\.(mp3|wav|m4a|aac|flac|ogg|opus|mp4|mov|m4v|webm)$/i;
const WORKSPACE = path.resolve(SOURCE, "..");
const trackPath = (rel) => [path.join(WORKSPACE, rel), path.join(SOURCE, rel)].find((file) => fs.existsSync(file)) ?? null;
/** The name a file's map is kept by: an upload (inputs/<asset id>/original.<ext>) by its asset, any other by its own name. */
const mapName = (rel) => {
	const parts = rel.split("/"), stem = path.basename(rel, path.extname(rel));
	return parts.length === 3 && parts[0] === "inputs" && stem === "original" ? parts[1] : stem;
};
const trackMap = (rel) => {
	for (const root of [WORKSPACE, SOURCE]) {
		try {
			const map = JSON.parse(fs.readFileSync(path.join(root, "derived", "track", `${mapName(rel)}.json`), "utf8"));
			if (map && typeof map === "object" && (map.of === undefined || map.of === rel)) return map;
		} catch { /* no map there */ }
	}
	return null;
};
/** A track's tempo as a film's: the map's, doubled or halved into the tempos a film can have. */
const tempoOf = (map) => {
	let bpm = map?.grid?.bpm;
	if (!(typeof bpm === "number" && bpm > 0)) return null;
	while (bpm < 60) bpm *= 2;
	while (bpm > 180) bpm /= 2;
	return Math.round(bpm * 100) / 100;
};
/** What a film's own track gives it: {file, path, map, bpm, from, seconds}; null for a film on a kit track. */
const trackOf = (film) => {
	const file = film?.music?.file;
	if (typeof file !== "string" || !TRACK_FILE.test(file) || file.split("/").includes("..")) return null;
	const map = trackMap(file);
	const from = typeof film.music.from === "number" ? film.music.from : (map?.grid?.firstBeat ?? 0);
	return { file, path: trackPath(file), map, bpm: film.music.bpm ?? tempoOf(map), from: Math.max(0, Number(from.toFixed(3))), seconds: map?.seconds ?? null };
};
/** The film as the recipe compiler takes it: on its own track it plays no kit track, at that track's tempo. */
const compile = (film) => {
	const track = trackOf(film);
	if (!track) return compileRecipe(film);
	const { file: _file, from: _from, ...music } = film.music;
	return compileRecipe({ ...film, music: { ...music, track: "none", ...(track.bpm ? { bpm: track.bpm } : {}) } });
};
const trackName = (film, look) => (trackOf(film) ? "file" : film.music?.track ?? look.track);
const RESOLUTION = { "16:9": "landscape", "9:16": "portrait", "1:1": "square" };

const read = (file) => JSON.parse(fs.readFileSync(file === "-" ? 0 : file, "utf8"));

const HEX = /^#[0-9a-fA-F]{3,8}$/;
/** What every scene may carry besides its own fields, and what a film may carry. */
const SCENE_KEYS = ["type", "beats", "bg", "fg", "in", "look", "metalVariant", "plain", "id", "halftone", "sound", "timing"];
// The components' own four families, then the font library's (fonts/library.json, tools/font-library.mjs).
const BUNDLED_FONTS = ["Geist", "Archivo", "Geist Mono", "Instrument Serif", ...require("./fonts/library.json").families.map((family) => family.family)];
const SOUND_KINDS = [...new Set([...Object.values(SOUNDS.kits).flatMap(Object.keys), "hit", "whoosh", "riser"])];
const FILM_KEYS = ["aspect", "style", "material", "metalVariant", "pace", "palette", "brand", "app", "music", "scenes", "lang", "grain", "sparks", "seconds", "motion", "fps", "version"];
const BRAND_KEYS = ["name", "url", "colors", "logo", "font", "tokens"];
const BRAND_TOKENS = ["background", "foreground", "accent", "accent2"];
/** The product's own screen, for the scenes that draw one (lib/components/ui.mjs): every part is optional. */
const pair = (first, second) => ({ kind: "array", of: { kind: "string", min: 1, max: Math.max(first, second) }, min: 2, max: 2 });
const APP = {
	kind: { kind: "enum", values: ["dashboard", "inbox", "chat", "editor"], optional: true },
	nav: { kind: "array", of: { kind: "string", min: 1, max: 14 }, min: 1, max: 5, optional: true },
	title: { kind: "string", min: 1, max: 24, optional: true },
	stats: { kind: "array", of: pair(18, 8), min: 1, max: 3, optional: true },
	rows: { kind: "array", of: pair(26, 34), min: 1, max: 5, optional: true },
	status: { kind: "array", of: { kind: "string", min: 1, max: 10 }, min: 1, max: 4, optional: true },
	cta: { kind: "string", min: 1, max: 14, optional: true },
};
const PALETTE = ["paper", "ink", "lime", "sage", "peach", "electric", "coral", "sky", "lilac", "butter", "brand", "brand2"];

/** Why `value` is not what `spec` asks for, or nothing. */
const wrong = (value, spec, where) => {
	switch (spec.kind) {
		case "string": {
			if (typeof value !== "string") return [`${where} must be text`];
			const length = [...value.trim()].length;
			if (spec.min && length < spec.min) return [`${where} must not be empty`];
			// Letters beyond Latin (Cyrillic, Greek, Arabic, Thai...) are held to the measured limit.
			const most = spec.wide && /[^\u0000-\u024F\u2000-\u206F]/.test(value) ? Math.min(spec.max ?? Infinity, spec.wide) : spec.max;
			if (most && length > most) return [`${where} is ${length} characters, at most ${most} fit: shorten it`];
			return [];
		}
		case "number":
			if (typeof value !== "number" || !Number.isFinite(value)) return [`${where} must be a number`];
			if (spec.int && !Number.isInteger(value)) return [`${where} must be a whole number`];
			if (spec.min !== undefined && value < spec.min) return [`${where} must be at least ${spec.min}`];
			if (spec.max !== undefined && value > spec.max) return [`${where} must be at most ${spec.max}`];
			return [];
		case "bool": return typeof value === "boolean" ? [] : [`${where} must be true or false`];
		case "enum": return spec.values.includes(value) ? [] : [`${where} must be one of ${spec.values.join(", ")}`];
		case "colour": return PALETTE.includes(value) || HEX.test(value) ? [] : [`${where} must be a palette name (${PALETTE.join(", ")}) or a #hex colour`];
		case "rect": {
			const ok = value && ["x", "y", "w", "h"].every((k) => typeof value[k] === "number" && value[k] >= 0 && value[k] <= 1);
			return ok ? [] : [`${where} must be {x, y, w, h}, each a fraction of the picture from 0 to 1`];
		}
		case "array": {
			if (!Array.isArray(value)) return [`${where} must be a list`];
			if (spec.min !== undefined && value.length < spec.min) return [`${where} needs at least ${spec.min} (it has ${value.length})`];
			if (spec.max !== undefined && value.length > spec.max) return [`${where} takes at most ${spec.max} (it has ${value.length})`];
			return value.flatMap((item, i) => wrong(item, spec.of, `${where}[${i}]`));
		}
		case "tuple": {
			if (!Array.isArray(value) || value.length !== spec.of.length) return [`${where} must be a list of ${spec.of.length}`];
			return value.flatMap((item, i) => wrong(item, spec.of[i], `${where}[${i}]`));
		}
		case "object": {
			if (!value || typeof value !== "object" || Array.isArray(value)) return [`${where} must be an object`];
			return fieldProblems(value, spec.fields, where);
		}
		default: return [];
	}
};

/** The problems of an object's fields: one missing, one of the wrong kind or too long. */
const fieldProblems = (object, fields, where) => {
	const out = [];
	for (const [name, spec] of Object.entries(fields)) {
		const value = object[name];
		if (value === undefined || value === null) {
			if (!spec.optional) out.push(`${where} needs "${name}"`);
			continue;
		}
		out.push(...wrong(value, spec, `${where}.${name}`));
	}
	return out;
};

/** How long each scene usually is, in beats: [from, to] (written from the guide by tools/kinetic/guide.py). */
const USUAL = (() => {
	try {
		return JSON.parse(fs.readFileSync(path.join(__dirname, "beats.json"), "utf8"));
	} catch {
		return {}; // a project made before the file: nothing to hold its scenes to
	}
})();
/** How far past its usual length a scene may be held, in beats. */
const HELD = 2;

/** What stops a film from being played, in words the writer can act on. */
const problems = (film) => {
	const out = [];
	if (!film || typeof film !== "object" || Array.isArray(film)) return ["film.json must be an object"];
	for (const key of Object.keys(film)) if (!FILM_KEYS.includes(key)) out.push(`film.json has no field "${key}".${key === "bg" || key === "background" ? ' Set brand.tokens.background for the whole film or bg on each scene; preserve the requested colour.' : ` Its fields: ${FILM_KEYS.join(", ")}.`}`);
	if (!Object.hasOwn(aspects, film.aspect)) out.push(`"aspect" must be one of ${Object.keys(aspects).join(", ")}`);
	if (!Object.hasOwn(looks, film.style)) out.push(`"style" must be one of ${Object.keys(looks).join(", ")}`);
	out.push(...materialProblems(film));
	if (film.metalVariant !== undefined) {
		if (!metalVariants.includes(film.metalVariant)) out.push(`"metalVariant" must be one of ${metalVariants.join(', ')}`);
		if (film.style !== 'metal') out.push('"metalVariant" needs "style": "metal"; a single Metal scene can set its own metalVariant');
	}
	if (film.palette !== undefined && !["look", "brand"].includes(film.palette)) out.push('"palette" must be "look" (the look\'s own colours) or "brand" (the look in the colours of "brand.colors")');
	if (film.sparks !== undefined && typeof film.sparks !== "boolean") out.push('"sparks" must be true or false: whether dots fly out where a word lands hard');
	if (film.palette === "brand" && !film.brand?.colors?.length) out.push('"palette": "brand" needs "brand.colors": one or two #hex colours of the brand');
	if (film.pace !== undefined && !Object.hasOwn(paces, film.pace)) out.push(`"pace" must be one of ${Object.keys(paces).join(", ")}`);
	if (!film.brand || typeof film.brand.name !== "string" || !film.brand.name.trim()) out.push('"brand.name" must be the product\'s name');
	if (film.brand && typeof film.brand === "object" && !Array.isArray(film.brand)) {
		for (const key of Object.keys(film.brand)) if (!BRAND_KEYS.includes(key)) out.push(`"brand" has no field "${key}": use ${BRAND_KEYS.join(", ")}`);
		if (film.brand.tokens !== undefined) {
			const tokens = film.brand.tokens;
			if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) out.push('"brand.tokens" must be an object with background, foreground, accent or accent2 #hex colours');
			else for (const [key, value] of Object.entries(tokens)) {
				if (!BRAND_TOKENS.includes(key)) out.push(`"brand.tokens" has no role "${key}": use ${BRAND_TOKENS.join(", ")}`);
				else if (typeof value !== "string" || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) out.push(`"brand.tokens.${key}" must be an opaque #RGB or #RRGGBB colour`);
			}
		}
	}
	if (film.app !== undefined) {
		if (!film.app || typeof film.app !== "object" || Array.isArray(film.app)) out.push('"app" must be an object: the words of the product\'s own screen');
		else {
			out.push(...fieldProblems(film.app, APP, '"app"'));
			for (const key of Object.keys(film.app)) if (!(key in APP)) out.push(`"app" has no "${key}": its parts are ${Object.keys(APP).join(", ")}`);
		}
	}
	if (film.lang !== undefined && !/^[a-z]{2}$/.test(film.lang)) out.push('"lang" must be the two letters of the texts\' language, such as "en"');
	if (film.brand?.colors !== undefined && !(Array.isArray(film.brand.colors) && film.brand.colors.every((c) => HEX.test(c)))) out.push('"brand.colors" must be a list of #hex colours');
	if (film.brand?.font !== undefined) {
		const font = film.brand.font;
		if (typeof font === "string") {
			if (!BUNDLED_FONTS.includes(font)) out.push(`"brand.font" must name a bundled family (${BUNDLED_FONTS.join(", ")}) or {family, src, weight?}`);
		} else if (!font || typeof font !== "object" || Array.isArray(font)) out.push('"brand.font" must be a font family or {family, src, weight?}');
		else {
			if (typeof font.family !== "string" || !/^[\p{L}\p{N} _-]{1,80}$/u.test(font.family)) out.push('"brand.font.family" must be a plain font family name');
			if (typeof font.src !== "string" || !/^(assets|media|derived)\/[\w./-]+\.(woff2?|ttf|otf)$/i.test(font.src) || font.src.split("/").includes("..")) out.push('"brand.font.src" must be a local font in assets/, media/ or derived/');
			if (font.weight !== undefined && !(Number.isInteger(font.weight) && font.weight >= 100 && font.weight <= 900)) out.push('"brand.font.weight" must be a whole number from 100 to 900');
			for (const key of Object.keys(font)) if (!["family", "src", "weight"].includes(key)) out.push(`"brand.font" has no field "${key}"`);
		}
	}
	const bpm = film.music?.bpm;
	const pace = paces[film.pace ?? "normal"] ?? paces.normal;
	if (bpm !== undefined && !(typeof bpm === "number" && bpm >= 60 && bpm <= 180)) out.push('"music.bpm" must be a number from 60 to 180');
	if (film.music?.track !== undefined && !TRACKS.includes(film.music.track)) out.push(`"music.track" must be one of ${TRACKS.join(", ")}`);
	if (film.music?.kit !== undefined && !Object.hasOwn(SOUNDS.kits, film.music.kit)) out.push(`"music.kit" must be one of ${Object.keys(SOUNDS.kits).join(", ")}`);
	if (film.music !== undefined && (!film.music || typeof film.music !== "object" || Array.isArray(film.music))) out.push('"music" must be an object');
	else for (const key of Object.keys(film.music ?? {})) if (!MUSIC_KEYS.includes(key)) out.push(`"music" has no field "${key}": it takes ${MUSIC_KEYS.filter((name) => name !== "offset").join(", ")}`);
	const own = film.music?.file;
	if (own !== undefined) {
		if (typeof own !== "string" || !TRACK_FILE.test(own) || own.split("/").includes("..")) out.push('"music.file" must be a sound or a video of the project by its path: inputs/..., derived/..., assets/... or media/...');
		else if (!trackPath(own)) out.push(`"music.file": there is no ${own} in the project`);
		else {
			const track = trackOf(film);
			if (!track.map) out.push(`"music.file": ${own} is not mapped yet. Run: harness track-map ${own}`);
			else if (!track.bpm) out.push(`"music.file": ${own} has no steady tempo to stand the scenes on; give "music.bpm" (60-180) yourself`);
		}
		if (film.music.track !== undefined) out.push('"music" names a file and a track: "file" for the user\'s or a generated track, or "track" for one of the kit\'s');
	}
	const from = film.music?.from;
	if (from !== undefined && own === undefined) out.push('"music.from" is where a film starts in its own track: it needs "music.file"');
	else if (from !== undefined && !(typeof from === "number" && from >= 0 && from <= 3600)) out.push('"music.from" must be seconds from the start of the track, 0 or more');
	if (!Array.isArray(film.scenes) || !film.scenes.length) return [...out, '"scenes" must list at least one scene'];
	film.scenes.forEach((input, i) => {
		const scene = canonicalScene(input);
		const where = `scenes[${i}]`;
		if (!scene || typeof scene !== "object" || typeof scene.type !== "string") return out.push(`${where} needs a "type"`);
		const fields = Object.hasOwn(FIELDS, scene.type) ? FIELDS[scene.type] : null;
		if (!fields) return out.push(`${where}: there is no scene type "${scene.type}"`);
		const retime = OWN[scene.type]?.retime;
		const authoredTiming = OWN[scene.type]?.hasAuthoredTiming?.(scene);
		for (const key of Object.keys(scene)) if (!SCENE_KEYS.includes(key) && !Object.hasOwn(fields, key)) out.push(`${where} (${scene.type}) has no field "${key}". Its fields: ${Object.keys(fields).join(", ")}.`);
		if (!(typeof scene.beats === "number" && scene.beats >= 1 && scene.beats <= 32)) out.push(`${where} (${scene.type}): "beats" must be a number from 1 to 32`);
		// A scene held far past its usual length is a slow film: a longer film has more scenes.
		else if (USUAL[scene.type] && scene.beats > USUAL[scene.type][1] + HELD && !authoredTiming && !(scene.type === "dial" && scene.timing?.slide)) out.push(`${where} (${scene.type}): ${scene.beats} beats is too long for it, its usual length is ${USUAL[scene.type][0]}-${USUAL[scene.type][1]}: give it at most ${USUAL[scene.type][1] + HELD} and add scenes for the rest of the time`);
		if (scene.in !== undefined && !Object.hasOwn(transitions, scene.in)) out.push(`${where}: "in" must be one of ${Object.keys(transitions).join(", ")}`);
		if (scene.look !== undefined && !Object.hasOwn(looks, scene.look)) out.push(`${where}: "look" must be one of the styles`);
		if (scene.metalVariant !== undefined) {
			if (!metalVariants.includes(scene.metalVariant)) out.push(`${where}.metalVariant must be one of ${metalVariants.join(', ')}`);
			if ((scene.look ?? film.style) !== 'metal') out.push(`${where}.metalVariant needs the Metal look`);
		}
		for (const key of ["bg", "fg"]) if (scene[key] !== undefined) out.push(...wrong(scene[key], { kind: "colour" }, `${where}.${key}`));
		if (scene.timing !== undefined && !retime) {
			const timing = scene.timing;
			if (!timing || typeof timing !== "object" || Array.isArray(timing)) out.push(`${where}.timing must be an object`);
			else {
				for (const key of Object.keys(timing)) if (scene.type !== "dial" || key !== "slide") out.push(`${where}.timing.${key} is not an action supported by ${scene.type}`);
				if (scene.type === "dial" && timing.slide !== undefined) {
					const slide = timing.slide, beats = Math.max(1, Math.round(scene.beats * pace.beats));
					if (!slide || typeof slide !== "object" || Array.isArray(slide) || !Number.isFinite(slide.startBeat) || !Number.isFinite(slide.endBeat) || slide.startBeat < 0 || slide.endBeat <= slide.startBeat || slide.endBeat > beats) out.push(`${where}.timing.slide needs 0 <= startBeat < endBeat <= ${beats} (the scene's actual beats)`);
					else for (const key of Object.keys(slide)) if (!["startBeat", "endBeat"].includes(key)) out.push(`${where}.timing.slide has no field "${key}"`);
				}
			}
		}
		if (scene.sound !== undefined) {
			const sound = scene.sound;
			if (!sound || typeof sound !== "object" || Array.isArray(sound)) out.push(`${where}.sound must be an object`);
			else {
				for (const key of Object.keys(sound)) if (!["mute", "gain", "kit", "mapping"].includes(key)) out.push(`${where}.sound has no field "${key}"`);
				if (sound.mute !== undefined && typeof sound.mute !== "boolean") out.push(`${where}.sound.mute must be true or false`);
				if (sound.gain !== undefined && !(Number.isFinite(sound.gain) && sound.gain >= 0 && sound.gain <= 2)) out.push(`${where}.sound.gain must be from 0 to 2`);
				if (sound.kit !== undefined && !Object.hasOwn(SOUNDS.kits, sound.kit)) out.push(`${where}.sound.kit must name a sound kit`);
				if (sound.mapping !== undefined) {
					if (!sound.mapping || typeof sound.mapping !== "object" || Array.isArray(sound.mapping)) out.push(`${where}.sound.mapping must map sound kinds to other kinds, or false`);
					else for (const [from, to] of Object.entries(sound.mapping)) if (!SOUND_KINDS.includes(from) || (to !== false && !SOUND_KINDS.includes(to))) out.push(`${where}.sound.mapping has an unknown sound kind: ${from} -> ${to}`);
				}
			}
		}
		const fieldErrors = fieldProblems(scene, fields, `${where} (${scene.type})`);
		out.push(...fieldErrors);
		// Component-owned relationships between otherwise valid fields (for
		// example, an item referring to a category that the scene actually has).
		if (!fieldErrors.length && OWN[scene.type]?.validate) {
			out.push(...OWN[scene.type].validate(scene).map(message => `${where} (${scene.type}): ${message}`));
		}
		if (!fieldErrors.length && retime && (scene.timing !== undefined || scene.speed !== undefined)) {
			const beat = 60 / (bpm ?? 120) * pace.speed;
			const beats = Math.max(1, Math.round(scene.beats * pace.beats));
			try { retime(scene, beats * beat, beat); }
			catch (error) { out.push(`${where} (${scene.type}): ${error.message}`); }
		}
	});
	// A component can constrain a material after palette/brand resolution too:
	// a valid palette name may still point at a value its painter cannot use.
	if (!out.length && film.scenes.some(scene => OWN[scene.type]?.validateResolved)) {
		const plan = compile(film);
		for (const [i, ps] of plan.scenes.entries()) {
			const validate = OWN[ps.scene.type]?.validateResolved;
			if (validate) out.push(...validate(ps.scene, {palette:ps.palette ?? plan.palette, accent:ps.accent})
				.map(message => `scenes[${i}] (${ps.scene.type}): ${message}`));
		}
	}
	// Whole musical beats quantize duration. Accept the nearest half-beat,
	// not a percentage that lets a long film drift several seconds off brief.
	if (film.seconds !== undefined) {
		if (!(typeof film.seconds === "number" && film.seconds >= 5 && film.seconds <= 120)) out.push('"seconds" must be a number from 5 to 120: the length the user asked for');
		else if (!out.length) {
			const plan = compile(film);
			const off = film.seconds - plan.duration;
			if (Math.abs(off) > plan.beat * 0.5 + 0.001) {
				const beats = Math.max(1, Math.round(Math.abs(off) / plan.beat));
				out.push(`the film runs ${plan.duration.toFixed(2)} s and "seconds" asks for ${film.seconds}: ${off > 0 ? "add" : "remove"} about ${beats} actual beats across the requested actions, within each scene's limits; a beat is ${plan.beat.toFixed(3)} s at ${plan.bpm} BPM. Use normal pace for exact beat counts. Add a scene only for a new meaningful action; never repeat the ending to fill time.`);
			}
		}
	}
	return out;
};

// What makes a film read as made rather than assembled (Kinetic's own review of a script).
/** Scenes that open a film with something that moves or asks. */
const OPENERS = new Set(["prompt", "title", "slam", "caption", "typewriter", "sentence", "chaos", "chat", "browser", "append", "countdown", "fullbleed", "notify", "compare", "bubbles", "inline", "retype", "tiles", "orbit", "pullback", "dot", "knockout", "scatter", "between", "assemble", "orb", "faces", "journey", "trail", "dock", "flip", "drag", "arc", "stream", "roll"]);
/** Scenes a viewer remembers: two or three a film, never more. */
const SIGNATURE = new Set(["dot", "knockout", "assemble", "pullback", "hive", "orb", "field", "flip", "between", "drag", "journey", "icon3d", "phone3d", "cards3d", "scatter", "arc", "particles", "wave", "agent", "palette", "picker", "montage", "web", "split", "pack", "swarm"]);
/** Scenes that are only type on a colour. */
const TYPE_ONLY = new Set(["title", "highlight", "fullbleed", "grid", "slam", "sentence", "append", "typewriter", "swap", "marquee", "countdown", "caption", "retype", "shuffle", "assemble"]);
// The scenes of ours say which of these they are (components/metadata.cjs).
for (const [type, def] of Object.entries(OWN)) {
	if (def.opener) OPENERS.add(type);
	if (def.signature) SIGNATURE.add(type);
	if (def.typeOnly) TYPE_ONLY.add(type);
}
const BUZZWORD = /\b(revolutionary|seamless(ly)?|leverage|unlock|supercharge|game[- ]?changer|cutting[- ]edge|next[- ]level|synerg\w*|empower\w*|world[- ]class|best[- ]in[- ]class|robust)\b/i;
const NOT_WORDS = /^(type|bg|fg|in|look|place|metalVariant|image|images|video|videos|path|tiles|mark|pill|kind|variant|shapes|axis|id|ease|sel|html|css)$/;

/** Every text of a scene a viewer reads. */
const wordsOf = (scene) => {
	const out = [];
	const walk = (value, key = "") => {
		if (key === "sound" || key === "timing" || key === "background") return;
		if (typeof value === "string") {
			if (!NOT_WORDS.test(key) && !/^(shot\d+|stock:|https?:|data:|media\/|derived\/)/.test(value)) out.push(value);
		} else if (Array.isArray(value)) value.forEach((v) => walk(v, key));
		else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, k);
	};
	// Component-owned visible copy excludes semantic controls such as orb state
	// and tint from the storybook, resolved brief and language detection.
	const copyFields = OWN[scene.type]?.copyFields;
	if (copyFields) for (const key of copyFields) walk(scene[key], key);
	else walk(scene);
	return out;
};

/** Notes on a film that plays but could be better; none stops it. */
const notes = (film) => {
	const scenes = film.scenes.map(canonicalScene);
	const types = scenes.map((s) => s.type);
	const out = [];
	if (!OPENERS.has(types[0])) out.push(`Scene 1 (${types[0]}) is a weak opener: open with a hook that moves or asks in the first second (pullback, dot, knockout, caption, chat, typewriter, slam, scatter, between).`);
	if (types[types.length - 1] !== "endcard") out.push("The film should end on an endcard.");
	// A film longer than what is left of its own track ends in silence.
	const own = trackOf(film);
	if (own?.seconds) {
		const length = compile(film).duration, left = own.seconds - own.from;
		if (length > left + 0.05) out.push(`The track is ${own.seconds.toFixed(1)} s long and the film starts ${own.from.toFixed(1)} s into it: its last ${(length - left).toFixed(1)} s play with no music. Shorten the film, or start earlier with "music.from".`);
	}
	// What a scene's own definition has to say of how it was written (a ride given too few beats).
	scenes.forEach((scene, i) => { const hint = OWN[scene.type]?.note?.(scene); if (hint) out.push(`Scene ${i + 1} (${scene.type}): ${hint}.`); });
	for (let i = 1; i < types.length; i++) if (types[i] === types[i - 1]) out.push(`Scenes ${i} and ${i + 1} are both "${types[i]}": never the same scene twice in a row.`);
	const used = new Map();
	for (const type of types) used.set(type, (used.get(type) ?? 0) + 1);
	for (const [type, n] of used) if (n > 2 && type !== "fullbleed") out.push(`"${type}" is used ${n} times: at most twice each.`);
	const signature = types.filter((t) => SIGNATURE.has(t));
	if (signature.length > 3) out.push(`Too many signature moments (${signature.join(", ")}): keep the strongest two or three.`);
	if (!signature.length && scenes.length >= 6) out.push("There is no signature moment: give the film one scene a viewer remembers (pullback, dot, knockout, hive, orb, between, drag, field, flip, assemble).");
	const typeOnly = types.filter((t) => TYPE_ONLY.has(t)).length;
	if (scenes.length >= 6 && typeOnly / scenes.length > 0.6) out.push(`${typeOnly} of ${scenes.length} scenes are only type on a colour, so it reads as slides: swap some for scenes with an object or a product view (between, drag, hive, arc, phones, laptop, callouts, field).`);
	scenes.forEach((scene, i) => {
		if (TYPE_ONLY.has(scene.type) && scene.beats > 8) out.push(`Scene ${i + 1} (${scene.type}) holds type for ${scene.beats} beats: type scenes are 2-6 beats.`);
		for (const text of wordsOf(scene)) {
			const buzz = BUZZWORD.exec(text);
			if (buzz) out.push(`Scene ${i + 1}: "${text}" uses a buzzword (${buzz[0]}): say what the product does in plain words.`);
			const words = text.replace(/\*/g, "").trim().split(/\s+/).length;
			if (TYPE_ONLY.has(scene.type) && words > 9) out.push(`Scene ${i + 1}: "${text}" is ${words} words: display lines are 6 words or fewer.`);
		}
	});
	return [...new Set(out)].slice(0, 12);
};

/** Resolved facts the writer can compare with the brief, including on a
 * text-only model. This is not an aesthetic score or a visual inspection. */
const review = (film, plan) => ({
	duration: Number(plan.duration.toFixed(3)),
	requestedSeconds: film.seconds ?? null,
	bpm: plan.bpm,
	font: film.brand?.font ?? "look default",
	scenes: plan.scenes.map(p => {
		const palette = p.palette ?? plan.palette;
		const explicit = p.scene.fg !== undefined || film.brand?.tokens?.foreground !== undefined;
		const foreground = surfaceForeground("sky", p.bg, palette, p.fg, { explicit });
		const surface = CATALOG[p.scene.type]?.surface ?? (p.bg === "sky" ? "sky" : null);
		return {
			type: p.scene.type, start: Number(p.start.toFixed(3)), seconds: Number(p.dur.toFixed(3)),
			background: p.bg === "sky" ? palette.sky : p.bg,
			...(p.scene.background ? { backgroundMedia: p.scene.background } : {}),
			foreground: p.fg, accent: p.accent,
			...(surface ? { surfaceForeground: surfaceForeground(surface, p.bg, palette, foreground, { explicit }) } : {}),
			words: wordsOf(p.scene),
			...(p.scene.type === "endcard" ? { settledHoldSeconds: Number(Math.max(0, p.dur - 1.25 / p.speed).toFixed(3)) } : {}),
			...(p.scene.timing ? { timing: p.scene.timing } : {}),
			...(p.scene.speed !== undefined ? { speed: p.scene.speed } : {}),
		};
	}),
	notes: notes(film),
});

/** The pictures a film names, as paths from source/. */
const pictures = (film) => {
	const out = [];
	if (typeof film.brand?.logo === "string") out.push(["brand.logo", film.brand.logo]);
	film.scenes.forEach((scene, i) => {
		if (typeof scene.image === "string") out.push([`scenes[${i}].image`, scene.image]);
		(Array.isArray(scene.images) ? scene.images : []).forEach((image, k) => typeof image === "string" && out.push([`scenes[${i}].images[${k}]`, image]));
		if (typeof scene.background?.image === "string") out.push([`scenes[${i}].background.image`, scene.background.image]);
	});
	return out;
};

const videos = (film) => film.scenes.flatMap((scene, i) => [
	...(typeof scene.background?.video === "string" ? [[`scenes[${i}].background.video`, scene.background.video]] : []),
	...(typeof scene.video === "string" ? [[`scenes[${i}].video`, scene.video]] : []),
	...(Array.isArray(scene.videos) ? scene.videos : []).flatMap((video, k) => typeof video === "string" ? [[`scenes[${i}].videos[${k}]`, video]] : []),
]);

/**
 * A scene plays files of its own beside the film's: a wall (lens-wall) the component's example videos
 * in the places the film's files leave, a laptop (laptop3d) the clip of the hand that lifts its lid.
 * The plan's scene gets them, by their public address, after its own videos. film.json is never changed.
 */
const wallExamples = (plan) => {
	const definitions = require("./components/metadata.cjs");
	const aspect = ["16:9", "9:16", "1:1"].find((name) => { const [w, h] = name.split(":").map(Number); return Math.abs(plan.width / plan.height - w / h) < .01; });
	for (const ps of plan.scenes) if (typeof definitions[ps.scene.type]?.filled === "function") ps.scene = definitions[ps.scene.type].filled(ps.scene, aspect);
	return plan;
};

/** The plan of a film that has no problems; throws the list of them otherwise. */
const planOf = (film) => {
	const found = problems(film);
	if (found.length) throw new Error(found.join("\n"));
	return compile(film);
};

/**
 * What a soundtrack is made from, as a short mark: the film's length, tempo, track and cues. The
 * music script writes it beside the track (assets/music.json), and a film whose mark differs has
 * a soundtrack made for another film. (File times do not say it: a checkout sets them anew.)
 */
/** What of a film's own track a soundtrack was made from: the file as it is now, and where the film starts in it. */
const trackMark = (film) => {
	const track = trackOf(film);
	if (!track) return {};
	let size = null;
	try { size = fs.statSync(track.path).size; } catch { /* a missing file is refused before anything is made */ }
	return { file: track.file, size, from: track.from };
};

const soundMark = (film, plan) => {
	const events = plan.audioEvents ?? plan.cues;
	const end = plan.scenes.filter(scene => scene.scene.type === "endcard").at(-1);
	const kits = [...new Set([kitOf(film), ...events.map(event => event.kit).filter(Boolean), end?.scene.sound?.kit].filter(Boolean))];
	const made = {
		mixVersion: 2, duration: Number(plan.duration.toFixed(3)), bpm: plan.bpm,
		kit: kitOf(film), sounds: Object.fromEntries(kits.map(kit => [kit, SOUNDS.kits[kit]])),
		track: trackName(film, plan.look), volume: film.music?.volume ?? 0.9,
		...trackMark(film),
		cues: events.map(c => [Number(c.t.toFixed(6)), c.kind, c.strength ?? 1, c.gain ?? 1, c.kit ?? kitOf(film), c.scene ?? null]),
		endcard: end ? { start: end.start, sound: end.scene.sound ?? {} } : null,
	};
	return crypto.createHash("sha1").update(JSON.stringify(made)).digest("hex").slice(0, 16);
};

/** What the music script needs of a plan. */
const summary = (film, plan) => ({
	mark: soundMark(film, plan),
	duration: Number(plan.duration.toFixed(3)),
	width: plan.width,
	height: plan.height,
	bpm: plan.bpm,
	beat: plan.beat,
	track: trackName(film, plan.look),
	// A film on its own track: where the file is, and the moment of it the film starts on.
	...(trackOf(film) ? { file: trackOf(film).path, from: trackOf(film).from } : {}),
	kit: kitOf(film),
	volume: film.music?.volume ?? 0.9,
	scenes: plan.scenes.map((s) => ({ type: s.scene.type, start: s.start, dur: s.dur, ...(s.scene.sound ? { sound: s.scene.sound } : {}) })),
	cues: plan.audioEvents ?? plan.cues,
});

const cut = (text, max) => {
	const clean = String(text).replace(/\*/g, "").replace(/\s+/g, " ").trim();
	return [...clean].length <= max ? clean : `${[...clean].slice(0, max - 1).join("").trimEnd()}…`;
};

/** The language a film with no `lang` is written in, by its letters. */
const written = (text) => (/[\u0400-\u04ff]/.test(text) ? "ru" : /[\u0600-\u06ff]/.test(text) ? "ar" : /[\u0e00-\u0e7f]/.test(text) ? "th" : "en");

/**
 * The storybook of a film (core/storybook: what the user reads in the app's Storybook tab): its
 * name, frame and length, the look with its colours, every scene in order with its words and
 * seconds, and the track. Made from the film, so it is never out of step with it.
 */
const book = (film, plan) => {
	const look = plan.look;
	const six = (hex) => (/^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null);
	const colours = [...(film.brand.colors ?? []), look.palette.paper, look.palette.ink, ...plan.scenes.map((s) => (s.bg === "sky" ? look.palette.sky : s.bg)), ...plan.scenes.map((s) => s.accent)];
	const palette = [...new Set(colours.map(six).filter(Boolean))].slice(0, 8).map((hex) => ({ hex }));
	// The storybook takes no text that reads as a file, a path or a command (a code scene's
	// "app.ts"): such a line is left out, and a scene with no other is named by its kind.
	const readable = (text) => text.trim() && !/`|\bharness |(^|\s)(source|derived|inputs|outputs)\//i.test(text)
		&& !/\b[\w-]+\.(py|m?js|ts|json|html|css|md|sh|glb|blend|mp4|mov|webm|wav|mp3|m4a|png|jpe?g|svg)\b/i.test(text);
	const kind = (type) => type[0].toUpperCase() + type.slice(1).replace(/-/g, " ");
	const shots = plan.scenes.map((planned, i) => {
		const [first, ...rest] = wordsOf(planned.scene).filter(readable);
		const shot = { id: `s${i + 1}`, title: cut(first ?? kind(planned.scene.type), 80), durationSeconds: Number(planned.dur.toFixed(2)), status: "made" };
		if (rest.length) shot.text = cut(rest.join(" · "), 600);
		return shot;
	});
	const track = trackName(film, look);
	const out = {
		schema: "motionfab.storybook/1",
		lang: film.lang ?? written(plan.scenes.flatMap((s) => wordsOf(s.scene)).join(" ")),
		about: { title: cut(readable(film.brand.name) ? film.brand.name : "Film", 80), format: film.aspect, durationSeconds: Number(plan.duration.toFixed(1)) },
		// The look by its name alone: its description is English, and the book is read in the film's language.
		look: { text: cut(look.name, 600), palette },
		episodes: [{ id: "film", title: cut(readable(film.brand.name) ? film.brand.name : "Film", 80), shots }],
	};
	if (track !== "none") out.sound = [{ id: "music", title: track === "file" ? "Track" : track[0].toUpperCase() + track.slice(1), kind: "music", text: `${plan.bpm} bpm`, status: "made" }];
	return out;
};

/**
 * The emoji a film uses, as the kit draws them: { size, emoji: { "✅": "<svg body>" } }, taken
 * out of the kit's whole set (lib/emoji.json.gz: Fluent Emoji, tools/emoji.py). The page draws a
 * film's emoji with these and never with the machine's emoji font.
 */
const emojiOf = (film) => {
	const packed = path.join(__dirname, "emoji.json.gz");
	if (!fs.existsSync(packed)) return { size: 32, emoji: {} };
	const all = JSON.parse(zlib.gunzipSync(fs.readFileSync(packed)).toString("utf8"));
	const used = {};
	const walk = (value) => {
		if (typeof value === "string") {
			for (const found of value.matchAll(/\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}]|\u200D\p{Extended_Pictographic}\uFE0F?)*/gu)) {
				for (const key of [found[0].replaceAll("\uFE0F", ""), [...found[0]][0]]) if (all.emoji[key]) used[key] = all.emoji[key];
			}
		} else if (value && typeof value === "object") Object.values(value).forEach(walk);
	};
	walk(film);
	return { size: all.size, emoji: Object.fromEntries(Object.entries(used).sort()) };
};

/** The native scene hosts and index, rebuilt from the authoritative film recipe. */
const fitted = (_html, film, plan) => buildProject(SOURCE, film, plan).html;

/** A package HyperFrames brought with it, from pnpm's store beside the film (sharp reads pictures). */
const brought = (name) => {
	for (const root of [path.join(SOURCE, ".."), SOURCE, process.cwd()]) {
		const store = path.join(root, "node_modules", ".pnpm");
		const dir = fs.existsSync(store) ? fs.readdirSync(store).filter((d) => d.startsWith(`${name}@`)).sort().pop() : null;
		if (dir) return require(path.join(store, dir, "node_modules", name));
	}
	throw new Error(`${name} is not installed here`);
};

const rgbOf = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const hueOf = ([r, g, b]) => {
	const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
	if (!d) return { h: 0, s: 0, l: (max + min) / 510 };
	const l = (max + min) / 510;
	const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	return { h: h * 60, s: d / 255 / (1 - Math.abs(2 * l - 1)), l };
};
const apart = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/**
 * What a picture gives a film (a reference for the look, a screenshot, a photo): its two
 * colours that carry it (the commonest strong ones, a sixth of the wheel apart), whether it is
 * dark or light, and the looks nearest to it, nearest first. From small pixels: `pixels` is RGB
 * triplets in a row.
 */
const paletteOf = (pixels) => {
	const bins = new Map();
	let light = 0;
	for (let i = 0; i < pixels.length; i += 3) {
		const key = ((pixels[i] >> 4) << 8) | ((pixels[i + 1] >> 4) << 4) | (pixels[i + 2] >> 4);
		const bin = bins.get(key) ?? bins.set(key, { n: 0, r: 0, g: 0, b: 0 }).get(key);
		bin.n++;
		bin.r += pixels[i];
		bin.g += pixels[i + 1];
		bin.b += pixels[i + 2];
		light += (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) / 255;
	}
	const total = pixels.length / 3;
	const found = [...bins.values()].map((bin) => {
		const rgb = [bin.r, bin.g, bin.b].map((v) => Math.round(v / bin.n));
		const tone = hueOf(rgb);
		// A colour carries a picture when there is much of it and it is neither grey nor near black or white.
		return { rgb, ...tone, weight: (bin.n / total) * tone.s * (1 - Math.abs(2 * tone.l - 1)) };
	}).filter((c) => c.s > 0.18 && c.l > 0.2 && c.l < 0.9).sort((a, b) => b.weight - a.weight);
	// Colours of one hue are one colour: the strongest of each sixth of the wheel.
	const picked = [];
	for (const c of found) if (picked.every((p) => apart(p.h, c.h) >= 40)) picked.push(c);
	const colors = picked.slice(0, 2).map((c) => `#${c.rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`);
	const dark = light / total < 0.42;
	const near = Object.values(looks).filter(look => look.paletteMatch !== false).map((look) => {
		const ground = hueOf(rgbOf(look.palette[look.rhythm[0]] ?? look.palette.paper));
		const accents = ["electric", "coral", "lime", "lilac"].map((name) => hueOf(rgbOf(look.palette[name]))).filter((c) => c.s > 0.18);
		const far = picked.slice(0, 2).reduce((sum, c) => sum + Math.min(180, ...accents.map((a) => apart(a.h, c.h))), 0);
		return { id: look.id, score: far + (ground.l < 0.42 === dark ? 0 : 200) };
	}).sort((a, b) => a.score - b.score);
	return { colors, ground: dark ? "dark" : "light", looks: near.slice(0, 4).map((l) => l.id) };
};

/** A page that is no brand's page: a bot check, a login, a domain for sale. */
const WALLS = /verify (that )?you('| a)re (a )?human|are you a robot|captcha|access denied|enable javascript|unusual traffic|checking your browser|just a moment|attention required|sign in to continue|log in to continue|domain (is )?for sale|buy this domain|this domain is parked|page not found|\b40[34]\b/i;
/** Letters and digits of a text, lower case, accents folded: what two writings of one name share. */
const bare = (text) => String(text ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
/**
 * Whether a brand card is the card of the brand named, when the address was taken from the
 * brand's name and not from the user: { ok, why } or { ok, use } with what to write into the
 * film. The page is the brand's when its address carries the name (adidas.com for "Adidas") and
 * the page says the name itself (its title, its site name, its headlines), and it is a page: not
 * a bot check, a login or a domain for sale. Anything else is somebody else's page, and its
 * colours and screen in the film would be worse than none.
 */
const brandOf = (card, name) => {
	const want = bare(name);
	if (want.length < 2) return { ok: false, why: "give the brand's name as the user wrote it" };
	if (!card || typeof card !== "object" || !card.url) return { ok: false, why: "this is not a brand card (the json of `screenshot_page` with `brand: true`)" };
	let host = "";
	try {
		host = new URL(card.url).hostname.replace(/^www\./, "");
	} catch {
		return { ok: false, why: "the card has no address" };
	}
	const said = [card.name, card.title, card.description, ...(card.headlines ?? [])].filter(Boolean).join(" ");
	if (WALLS.test([card.title, ...(card.headlines ?? []).slice(0, 3)].filter(Boolean).join(" "))) return { ok: false, why: "the page is a bot check, a login or an empty address, not the brand's page" };
	if (!bare(host.split(".").slice(0, -1).join("")).includes(want)) return { ok: false, why: `the address ${host} is not ${name}'s` };
	if (!bare(said).includes(want)) return { ok: false, why: `the page at ${host} does not say "${name}"` };
	const hex = (c) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null);
	const colours = card.colors ?? {};
	// The accent, and one more colour of the brand's own: a button's fill, then a surface.
	const more = [...(colours.buttons ?? []).map((b) => b?.fill), ...(colours.surfaces ?? [])].map(hex).filter((c) => c && c !== hex(colours.accent) && !["#ffffff", "#000000"].includes(c));
	const picked = [hex(colours.accent), more[0]].filter(Boolean);
	const use = { brand: { name: String(name), url: host, ...(picked.length ? { colors: picked } : {}) }, ...(picked.length ? { palette: "brand" } : {}) };
	return { ok: true, use, picture: card.files?.screenshot ? `../${card.files.screenshot}` : null, words: (card.headlines ?? []).filter((line) => line.length <= 80 && !/cookie|privacy|consent/i.test(line)).slice(0, 6) };
};

/**
 * A panel's change applied to a film: { film, said } or { error }. Only what a panel offers,
 * each value one of the kit's own: a change comes from a client, not from the agent, so
 * nothing in it is trusted, and a key or a value that is not here is refused.
 *   style    a look             palette  "look" | "brand"     colors  one or two #hex (the brand's)
 *   kit      a sound kit        sparks   true | false         aspect, pace
 * The words, the scenes and their order stay. A film with a length asked for (`seconds`) keeps
 * its tempo when the look changes, so it stays that long.
 */
const changed = (film, change) => {
	if (!change || typeof change !== "object" || Array.isArray(change) || !Object.keys(change).length) return { error: "the change must name what to set: style, metalVariant, palette, colors, kit, sparks, aspect or pace" };
	const next = JSON.parse(JSON.stringify(film));
	const said = [];
	const hex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
	for (const [key, value] of Object.entries(change)) {
		if (key === "style") {
			if (typeof value !== "string" || !looks[value]) return { error: `there is no look "${String(value).slice(0, 40)}"` };
			if (next.seconds !== undefined && next.music?.bpm === undefined) next.music = { ...next.music, bpm: compile(film).bpm };
			// A track that was only the old look's own goes with the look.
			if (next.music?.track && next.music.track === looks[film.style]?.track) delete next.music.track;
			next.style = value;
			if (value !== 'metal') {
				delete next.metalVariant;
				for (const scene of next.scenes) if (!scene.look) delete scene.metalVariant;
			}
			said.push(`look ${looks[value].name ?? value}`);
		} else if (key === 'metalVariant') {
			if (!metalVariants.includes(value)) return { error: `metalVariant is one of ${metalVariants.join(', ')}` };
			next.metalVariant = value;
			said.push(`${value} metal`);
		} else if (key === "palette") {
			if (!["look", "brand"].includes(value)) return { error: 'palette is "look" or "brand"' };
			if (value === "look") {
				delete next.palette;
				delete next.brand.tokens;
			}
			else next.palette = "brand";
			said.push(value === "brand" ? "the brand's colours" : "the look's own colours");
		} else if (key === "colors") {
			if (!Array.isArray(value) || value.length < 1 || value.length > 2 || !value.every(hex)) return { error: "colors are one or two #hex colours" };
			next.brand = { ...next.brand, colors: value.map((c) => c.toLowerCase()) };
			if (next.brand.tokens) {
				next.brand.tokens = { ...next.brand.tokens, accent: next.brand.colors[0] };
				if (next.brand.colors[1]) next.brand.tokens.accent2 = next.brand.colors[1];
				else delete next.brand.tokens.accent2;
			}
		} else if (key === "kit") {
			if (typeof value !== "string" || !SOUNDS.kits[value]) return { error: `there is no sound kit "${String(value).slice(0, 40)}"` };
			next.music = { ...next.music, kit: value };
			said.push(`${value} sounds`);
		} else if (key === "sparks") {
			if (typeof value !== "boolean") return { error: "sparks is true or false" };
			next.sparks = value;
			said.push(value ? "with sparks" : "without sparks");
		} else if (key === "aspect") {
			if (typeof value !== "string" || !aspects[value]) return { error: `aspect is one of ${Object.keys(aspects).join(", ")}` };
			next.aspect = value;
			said.push(`${value} frame`);
		} else if (key === "pace") {
			if (typeof value !== "string" || !paces[value]) return { error: `pace is one of ${Object.keys(paces).join(", ")}` };
			next.pace = value;
			said.push(`${value} pace`);
		} else return { error: `a panel cannot change "${String(key).slice(0, 40)}"` };
	}
	const wrong = problems(next);
	if (wrong.length) return { error: wrong[0] };
	return { film: next, said: said.length ? said.join(", ") : "the brand's colours" };
};

module.exports = { BUNDLED_FONTS, problems, notes, review, pictures, videos, planOf, summary, soundMark, fitted, book, paletteOf, brandOf, changed, emojiOf, TRACKS };

if (require.main === module) {
	const [command = "fit", file = path.join(SOURCE, "film.json")] = process.argv.slice(2);
	if (command === "palette") {
		const picture = path.resolve(process.argv[3] ?? "");
		if (!process.argv[3] || !fs.existsSync(picture)) {
			console.error("usage: node lib/film.cjs palette <picture>: the picture's path, as seen from where you run it");
			process.exit(2);
		}
		brought("sharp")(picture).resize(96, 96, { fit: "inside" }).removeAlpha().raw().toBuffer().then((pixels) => {
			const found = paletteOf(pixels);
			if (!found.colors.length) return console.log(JSON.stringify({ ...found, note: "The picture has no colour of its own: keep the look's colours (no \"palette\")." }));
			console.log(JSON.stringify({ ...found, use: { style: found.looks[0], palette: "brand", "brand.colors": found.colors } }));
		}).catch((err) => {
			console.error(`could not read the picture: ${err.message}`);
			process.exit(1);
		});
		return;
	}
	if (command === "change") {
		let change = null;
		try {
			change = JSON.parse(process.env.HARNESS_CHANGE ?? "");
		} catch {}
		let film;
		try {
			film = read(file);
		} catch (err) {
			console.error(`film.json is not valid JSON: ${err.message}`);
			process.exit(1);
		}
		const made = changed(film, change);
		if (made.error) {
			console.error(made.error);
			process.exit(1);
		}
		fs.writeFileSync(file, `${JSON.stringify(made.film, null, 2)}\n`);
		// What the revision is called in the user's history (the worker's publish reads it).
		const note = path.resolve(path.dirname(path.resolve(file)), "..", "derived", "internal", "change.txt");
		fs.mkdirSync(path.dirname(note), { recursive: true });
		const text = `From the panel: ${made.said}`;
		fs.writeFileSync(note, `${text}\n`);
		console.log(text);
		return;
	}
	if (command === "brand") {
		const [name, json] = process.argv.slice(3);
		if (!name || !json || !fs.existsSync(path.resolve(json))) {
			console.error('usage: node lib/film.cjs brand "<the brand\'s name>" <brand.json>: the json path of the brand card, as seen from where you run it');
			process.exit(2);
		}
		let card = null;
		try {
			card = JSON.parse(fs.readFileSync(path.resolve(json), "utf8"));
		} catch {}
		const found = brandOf(card, name);
		console.log(JSON.stringify(found.ok ? { ...found, note: "This is the brand's own page: write `use` into the film, take words from `words` and from the card, and `picture` is the page's picture for a scene that shows the product (as seen from source/)." } : { ...found, note: "Not the brand's page. Go on with the user's words alone and the look's own colours: do not try another address, and put nothing of this page into the film." }));
		return;
	}
	let film;
	try {
		film = read(file);
	} catch (err) {
		console.error(`film.json is not valid JSON: ${err.message}`);
		process.exit(1);
	}
	if (command === "check") {
		const errors = problems(film);
		const result = { errors, notes: [], pictures: [], videos: [] };
		if (!errors.length) {
			const plan = compile(film);
			Object.assign(result, { emoji: Object.keys(emojiOf(film).emoji), notes: notes(film), pictures: pictures(film), videos: videos(film), sound: soundMark(film, plan), duration: Number(plan.duration.toFixed(3)), width: plan.width, height: plan.height, scenes: plan.scenes.length, nativeClips: nativeClips(plan), buildMark: buildMark(film,plan) });
		}
		process.stdout.write(JSON.stringify(result));
		process.exit(0);
	}
	let plan;
	try {
		plan = planOf(film);
	} catch (err) {
		console.error(err.message);
		process.exit(1);
	}
	if (command === "plan") {
		process.stdout.write(JSON.stringify(summary(film, plan)));
	} else if (command === "review") {
		process.stdout.write(JSON.stringify(review(film, plan), null, 2));
	} else if (command === "book") {
		process.stdout.write(JSON.stringify(book(film, plan), null, 2));
	} else if (command === "fit") {
		const page = path.join(SOURCE, "index.html");
		wallExamples(plan);
		buildProject(SOURCE, film, plan);
		const emoji = `${JSON.stringify(emojiOf(film))}\n`;
		const drawn = path.join(SOURCE, "assets", "emoji.json");
		fs.mkdirSync(path.dirname(drawn), { recursive: true });
		if (!fs.existsSync(drawn) || fs.readFileSync(drawn, "utf8") !== emoji) fs.writeFileSync(drawn, emoji);
		console.log(`${plan.scenes.length} scenes, ${plan.duration.toFixed(2)} s, ${plan.width}x${plan.height}, look ${plan.style}, track ${trackOf(film) ? `${trackOf(film).file} from ${trackOf(film).from} s` : film.music?.track ?? plan.look.track} at ${plan.bpm} bpm`);
		console.log(`Review against the request (resolved recipe, not a visual inspection):\n${JSON.stringify(review(film, plan))}`);
	} else {
		console.error("usage: node lib/film.cjs fit | plan | check | review | book [film.json], or palette <picture>");
		process.exit(2);
	}
}
