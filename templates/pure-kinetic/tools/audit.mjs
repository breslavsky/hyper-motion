// The native HyperFrames picture audit: every scene drawn and measured, with no eye and no reference to compare
// with. What a viewer reads must be whole inside the frame's safe area, large enough to read,
// not laid over other text, and it must be the film's own words.
// Measure calibrated glyph ink, not empty font-metric space. Explicit one-line
// ellipsis uses the shared strict viewport contract; the full source copy and
// original font measurements remain subject to the same checks.
//
//   node templates/pure-kinetic/tools/audit.mjs [--scenes title,agent] [--looks editorial,sting]
//        [--aspects 9:16,16:9,1:1] [--json out.json] [--known] [--write-known] [--texts] [--twice] [--long] [--limits] [--survey] [--scale] [--leak]
//
// --twice also draws one moment of each case twice, with other moments between, and compares the
// pictures (the fault `unstable`); AUDIT_KEEP=<folder> keeps the two pictures of a case that differ.
// --long gives every text of a sample the longest its field allows, in Russian: what a real film
// asks of a scene. Its known faults are kept apart (audit.known.long.json).
// --texts prints every text of each case at its two settled moments: where it is, how large and
// how much of it is seen. What to read before a scene is changed.
//
// --known holds the scenes to tools/audit.known.json: the faults each scene is known to have
// (the debt taken with Kinetic's scenes, paid scene by scene). A fault that is not there fails;
// one that is there is only counted. --write-known writes the file from this run: run it over
// every scene, look and frame, and only to take a fault OUT.
//
// A case is one scene alone (its sample: Kinetic's templates and samples.json for its scenes,
// the scene's own for ours) in a look and a frame. It is measured at three moments after it has
// settled (0.6 and 0.8 of its length) for where its texts are, earlier for a text that holds still
// from one of the eight moments to the next (a line shown and gone in the first half), and at eight moments across its
// whole length for what words it shows. Every text on screen is found in the page itself: the
// letters a viewer sees, where they are, how large and how opaque. Not measured: decoration that
// says so (the classes `deco` and `ghost`, anything inside an <svg>); a figure whose digits roll
// behind a mask (`data-roll`: its box is measured, not its hidden digits); where the type of a
// drawn interface (`.mock`) is and how large, which is an interface's inside its device; and
// the edges of a scene whose words are meant to run off the frame (BLEED) or whose camera
// follows what is typed (FOLLOWS). A fault of where a
// text is counts when the same text has it at two of those moments, and a word that is not the
// film's when it is seen at two moments: what is on its way in, out or being scrambled into
// place is no fault.
//
// Faults:
//   cut      a text crosses the frame's edge or is clipped by its own box
//   unsafe   a text is whole but outside the safe area (below), where an app's own buttons and
//            captions lie over a vertical video, or too near the edge of any frame
//   small    a text is smaller than a viewer reads on a phone
//   overlap  two texts lie over one another
//   unstable (with --twice) the same moment drawn twice, with other moments between, is not the
//            same picture: the scene keeps something from frame to frame or reads a clock
//   scale    (with --scale) a text that is not fitted to the frame's width is set in a size that
//            is no step of the scale (compiler/plan.cjs TYPE): its known faults are in audit.known.scale.json
//   foreign  a text is not in the film: a word the kit wrote itself, in English, whatever the
//            film's language is
//   invented the same inside a drawn interface: names, menus and figures the kit made up for a
//            product that is somebody's real one
// Exit: 0 no fault (with --known: no new one), 1 faults (listed by scene), 2 could not run.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createNativeBrowser, sharp } from "./migration-browser.mjs";
import { measureRenderedText } from "./quality-layout.mjs";
import { pictureTextBoxes, pictureBounds, pictureTextOverlap, pictureLines as lines } from "./picture-audit-text.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.resolve(HERE, "..");
const SOURCE = path.join(TEMPLATE, "source");
const require = createRequire(import.meta.url);

/** The safe area of each frame: the engine's own (lib/compiler/plan.cjs). */
export const SAFE = require(path.join(SOURCE, "lib", "compiler", "plan.cjs")).safe;
/** The smallest text a viewer reads, as a share of the frame's short side (about 24 px of 1080). */
export const SMALLEST = 0.022;
/** Scenes whose words are meant to cross the frame's edge: a ticker, a wall of words. */
const BLEED = new Set(["marquee", "wall", "fullbleed"]);
/** Scenes whose camera follows what is typed or travels along a line: the frame crops the rest on purpose. */
const FOLLOWS = new Set(["prompt", "ui-macro", "pullback", "journey"]);

const args = process.argv.slice(2);
const SCALE = args.includes("--scale");
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const brand = () => ({ name: "Nook", url: "nook.app", ...(option("font", null) ? { font: option("font") } : {}) });

async function readTexts(tab) {
	const {found, measured} = await tab.evaluate(source => ({
		found: window.texts(),
		measured: Object.values(window.__pkScenes ?? {}).flatMap(instance =>
			(0, eval)(`(${source})`)(instance.sceneRoot, {minimumOpacity: .4})),
	}), measureRenderedText.toString());
	return pictureTextBoxes(found, measured);
}

/** One scene of every type a film may use, with the words a viewer should find on screen. */
const samples = () => {
	const fields = Object.keys(require(path.join(SOURCE, "lib", "compiler", "fields.cjs")));
	const out = new Map();
	const fill = (scene) => JSON.parse(JSON.stringify(scene).replaceAll("{name}", "Nook").replaceAll("{NAME}", "NOOK").replaceAll("{url}", "nook.app").replaceAll("{tagline}", "Bookings that run themselves"));
	for (const t of JSON.parse(fs.readFileSync(path.join(HERE, "kinetic", "templates.json"), "utf8"))) {
		for (const scene of t.scenes) {
			if (out.has(scene.type) || !fields.includes(scene.type)) continue;
			const { image, images, ...rest } = scene;
			out.set(scene.type, fill(rest));
		}
	}
	for (const scene of JSON.parse(fs.readFileSync(path.join(HERE, "kinetic", "samples.json"), "utf8"))) if (!out.has(scene.type) && fields.includes(scene.type)) out.set(scene.type, scene);
	for (const [type, def] of Object.entries(require(path.join(SOURCE, "lib", "compiler", "definitions.cjs")))) out.set(type, def.sample);
	return out;
};

/**
 * A sample with every text as long as its field allows, in Russian (--long): the samples say
 * "Meet Nook." where a real film says "Она носит кислород." in a look that sets capitals, and a
 * scene that fits the one need not fit the other. The words are wide Cyrillic ones; a text keeps
 * its accent stars, and one with a chip in brackets or an emoji in front is left as it is.
 */
const LONG = "Свежие зёрна каждые две недели обжарены в день отправки бесплатная доставка по всей стране попробуйте уже сегодня".split(" ");
const stretched = (value, spec, salt = 0) => {
	if (!spec || value === undefined) return value;
	if (spec.kind === "string" && typeof value === "string" && spec.max && !/[\[\]{}<>/=;]|\p{Extended_Pictographic}|^[\d\s$€%.,:x+-]+$/u.test(value)) {
		let out = "";
		for (let i = 0; out.length < spec.max; i++) {
			const word = LONG[(i + salt) % LONG.length];
			if ((out ? out.length + 1 : 0) + word.length > spec.max) break;
			out += (out ? " " : "") + word;
		}
		out ||= LONG[salt % LONG.length].slice(0, spec.max);
		return value.includes("*") ? out.replace(/^(\S+)/, "*$1*").slice(0, Math.max(spec.max, out.length)) : out;
	}
	if (spec.kind === "array" && Array.isArray(value)) return value.map((v, i) => stretched(v, spec.of, salt + i * 3));
	if (spec.kind === "object" && value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v], i) => [k, stretched(v, spec.fields?.[k], salt + i)]));
	return value;
};
const long = (scene) => {
	// As long as a film may be: the written limit, or the measured one where there is one
	// (lib/limits.json), since the film's check refuses a Cyrillic text longer than that.
	const specs = JSON.parse(JSON.stringify({ ...require(path.join(SOURCE, "lib", "compiler", "fields.cjs")), ...Object.fromEntries(Object.entries(require(path.join(SOURCE, "lib", "compiler", "definitions.cjs"))).map(([type, def]) => [type, def.fields])) }[scene.type] ?? {}));
	let measured = {};
	try {
		measured = JSON.parse(fs.readFileSync(path.join(SOURCE, "lib", "limits.json"), "utf8")).limits?.[scene.type] ?? {};
	} catch {}
	for (const [at, most] of Object.entries(measured)) {
		let spec = specs;
		for (const step of at.match(/[^.[\]]+|\[\]/g) ?? []) spec = !spec ? null : step === "[]" ? spec.of : (spec.fields ?? spec)[step];
		if (spec?.kind === "string") spec.max = Math.min(spec.max, most);
	}
	return Object.fromEntries(Object.entries(scene).map(([k, v], i) => [k, stretched(v, specs[k], i)]));
};

/** Letters and digits of a text, lower case: what two writings of the same words share. */
const bare = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

const faultsOf = (found, film, frame, settledScene, still = new Set()) => {
	const safe = SAFE[film.aspect];
	const [W, H] = [frame.width, frame.height];
	const words = new Set();
	const walk = (v) => (typeof v === "string" ? words.add(bare(v)) : v && typeof v === "object" ? Object.values(v).forEach(walk) : typeof v === "number" ? words.add(String(v)) : null);
	walk(film.scenes);
	walk(film.brand);
	const all = [...words].join(" ");
	const longest = [...words].filter((w) => w.length > 1).sort((x, y) => y.length - x.length);
	const out = [];
	const texts = lines(found);
	const bleed = BLEED.has(film.scenes[0].type) || FOLLOWS.has(film.scenes[0].type);
	for (const t of texts) {
		const bounds = pictureBounds(t);
		const settled = settledScene || still.has(t.text);
		const short = t.text.length > 28 ? `${t.text.slice(0, 27)}…` : t.text;
		const letters = bare(t.text);
		if (settled && !bleed && !t.mock) {
			if (bounds.x < -2 || bounds.y < -2 || bounds.x + bounds.w > W + 2 || bounds.y + bounds.h > H + 2 || (!t.roll && !t.shaped && (t.auditSeen ?? t.seen) < 0.85)) out.push(["cut", short]);
			else if (bounds.x < W * safe.left || bounds.x + bounds.w > W * (1 - safe.right) || bounds.y < H * safe.top || bounds.y + bounds.h > H * (1 - safe.bottom)) out.push(["unsafe", short, `x ${Math.round((100 * bounds.x) / W)}-${Math.round((100 * (bounds.x + bounds.w)) / W)}%, y ${Math.round((100 * bounds.y) / H)}-${Math.round((100 * (bounds.y + bounds.h)) / H)}%`]);
		}
		if (settled && !t.mock && !t.roll && t.line / 1.2 < Math.min(W, H) * SMALLEST && letters.length > 1) out.push(["small", `${short} (${Math.round(t.line / 1.2)} px)`]);
		// --scale: type that is not fitted to the frame's width is set in a step of the scale
		// (compiler/plan.cjs TYPE), so the same part is the same size from scene to scene.
		if (SCALE && settled && !t.mock && !t.roll && !t.fitted && !t.glyph && letters.length > 1 && t.size) {
			const steps = Object.values(require(path.join(SOURCE, "lib", "compiler", "plan.cjs")).typeOf(W, H));
			// Inside the scale's range: a word as large as the frame and a note smaller than a label are not on it.
			if (t.size >= steps[0] * 0.8 && t.size <= steps[steps.length - 1] * 1.12 && !steps.some((step) => Math.abs(t.size - step) <= step * 0.04)) out.push(["scale", `${Math.round(t.size)} px`]);
		}
		// A figure counting up or a clock is the kit's to write; words are the film's.
		if (/\p{L}{3}/u.test(t.text) && !all.includes(letters)) {
			// What is left of it once the film's own words are taken out.
			let left = letters;
			for (const word of longest) left = left.split(word).join(" ");
			if (/\p{L}{3}/u.test(left)) out.push([t.mock ? "invented" : "foreign", short]);
		}
	}
	for (let i = 0; !bleed && i < texts.length; i++) {
		for (let j = i + 1; j < texts.length; j++) {
			const [a, b] = [texts[i], texts[j]];
			if (!settledScene && !(still.has(a.text) && still.has(b.text))) continue;
			if (pictureTextOverlap(a, b) && bare(a.text) !== bare(b.text) && !a.roll && !b.roll && !a.shaped && !b.shaped && !a.mock && !b.mock && !a.over && !b.over) out.push(["overlap", `${a.text.slice(0, 14)} / ${b.text.slice(0, 14)}`]);
		}
	}
	return out;
};

/** The eight moments of a case and the faults of where its texts stand, each seen at two of them: [kind, what]. */
const placed = async (tab, film, early = true) => {
	const frame = await tab.play(film);
	const shots = [];
	for (const at of [0.1, 0.2, 0.32, 0.45, 0.6, 0.7, 0.8, 0.9]) {
		await tab.shoot(frame.duration * at);
		shots.push({ at, raw: await readTexts(tab) });
	}
	const late = new Set(shots.filter((shot) => shot.at >= 0.6).flatMap((shot) => lines(shot.raw).map((t) => t.text)));
	const seen = new Map();
	let before = new Map();
	for (const { at, raw } of shots) {
		const here = lines(raw);
		const still = new Set(here.filter((t) => {
			const was = before.get(t.text);
			return early && !late.has(t.text) && was && Math.max(Math.abs(was.x - t.x), Math.abs(was.y - t.y), Math.abs(was.w - t.w), Math.abs(was.h - t.h)) < frame.width * 0.012;
		}).map((t) => t.text));
		before = new Map(here.map((t) => [t.text, t]));
		for (const [kind, what] of faultsOf(raw, film, frame, at === 0.6 || at === 0.8, still)) {
			if (!["cut", "unsafe", "small", "overlap"].includes(kind)) continue;
			seen.set(`${kind}|${what}`, (seen.get(`${kind}|${what}`) ?? 0) + 1);
		}
	}
	return { frame, shots, faults: [...seen].filter(([, n]) => n >= 2).map(([key]) => key.split("|")) };
};

/** Every text field of a scene's sample that has a longest length: [path, spec], a path as "items[]" or "messages[].text". */
const leaves = (value, spec, at = "") => {
	if (!spec || value === undefined) return [];
	if (spec.kind === "string") return typeof value === "string" && spec.max && stretched(value, spec) !== value ? [[at, spec]] : [];
	if (spec.kind === "array" && Array.isArray(value) && value.length) return leaves(value[0], spec.of, `${at}[]`);
	if (spec.kind === "object" && value && typeof value === "object") return Object.entries(spec.fields ?? {}).flatMap(([k, sub]) => leaves(value[k], sub, `${at}.${k}`));
	return [];
};
/** A sample with the texts at one path made `length` characters long (every item of a list: the worst case). */
const withLength = (value, spec, pathLeft, length, salt = 0) => {
	if (!pathLeft) return stretched(value, { ...spec, max: length }, salt);
	// Each item its own words: two items that say the same are one text to the measure.
	if (pathLeft.startsWith("[]")) return value.map((v, i) => withLength(v, spec.of, pathLeft.slice(2), length, salt + i * 3));
	const [, key, rest] = /^\.?([^.[]+)(.*)$/.exec(pathLeft);
	return { ...value, [key]: withLength(value[key], spec.fields ? spec.fields[key] : spec[key], rest, length, salt) };
};
const specsOf = (type) => ({ ...require(path.join(SOURCE, "lib", "compiler", "fields.cjs")), ...Object.fromEntries(Object.entries(require(path.join(SOURCE, "lib", "compiler", "definitions.cjs"))).map(([t, def]) => [t, def.fields])) })[type] ?? {};

const main = async () => {
	const all = samples();
	const asked = option("scenes", null)?.split(",") ?? [...all.keys()];
	const looks = option("looks", "editorial,sting").split(",");
	const aspects = option("aspects", "9:16,16:9,1:1").split(",");
	const browser = await createNativeBrowser();
	const { aspects: sizes } = require(path.join(SOURCE, "lib", "compiler", "plan.cjs"));
	const report = {}; // scene -> fault -> Set of "look aspect: example"
	// --limits: the longest text each field can hold with nothing cut, outside the safe area, too
	// small or over another text, in every frame and in a look that sets capitals as in one that
	// does not. Judged once the scene has settled: a limit refuses a film, so it is taken only
	// from what is sure (questions that drift across a frame and off it, early, are cropped on
	// purpose; the first search made their limit nine characters). Written beside the engine (source/lib/limits.json): what a film's check holds a
	// text to, in place of a limit taken by eye for Latin letters.
	if (args.includes("--limits")) {
		const found = {}; // type -> path -> the longest length that held everywhere
		const tried = { cases: 0 };
		for (const aspect of aspects) {
			const tab = await browser.newPage();
			await tab.setViewport(sizes[aspect]);
			for (const type of asked) {
				// Questions that drift across the frame and off it are cropped on purpose, at any length.
				if (type === "bubbles") continue;
				const sample = all.get(type);
				const specs = specsOf(type);
				// What the sample itself has in each look: a fault that is there whatever the text
				// says is the scene's, not the text's, and no length would mend it.
				const own = {};
				// Counted by kind: the same fault names another text once the text is another.
				const kinds = (faults) => faults.reduce((n, [kind]) => ({ ...n, [kind]: (n[kind] ?? 0) + 1 }), {});
				for (const look of looks) own[look] = kinds((await placed(tab, { aspect, style: look, brand: brand(), scenes: [sample] }, false)).faults);
				for (const [field, value] of Object.entries(sample)) {
					for (const [at, spec] of leaves(value, specs[field], field)) {
						const holds = async (length) => {
							for (const look of looks) {
								const scene = { ...sample, [field]: withLength(sample[field], specs[field], at.slice(field.length), length) };
								tried.cases++;
								const now = kinds((await placed(tab, { aspect, style: look, brand: brand(), scenes: [scene] }, false)).faults);
								if (Object.entries(now).some(([kind, n]) => n > (own[look][kind] ?? 0))) return false;
							}
							return true;
						};
						let best = spec.max;
						if (!(await holds(spec.max))) {
							// The longest that holds, by halves, from what the sample itself is.
							let [low, high] = [Math.max(spec.min ?? 1, 4), spec.max];
							while (high - low > Math.max(1, Math.round(spec.max * 0.06))) {
								const mid = Math.round((low + high) / 2);
								if (await holds(mid)) low = mid;
								else high = mid;
							}
							best = low;
						}
						((found[type] ??= {})[at] = Math.min(found[type][at] ?? Infinity, best));
					}
				}
			}
			await tab.close();
		}
		await browser.close();
		// A tenth to spare: the words tried are of ordinary width, a line of wide letters is longer.
		const limits = {};
		for (const [type, fields] of Object.entries(found)) {
			for (const [at, best] of Object.entries(fields)) {
				const spec = leaves(all.get(type)[at.split(/[.[]/)[0]], specsOf(type)[at.split(/[.[]/)[0]], at.split(/[.[]/)[0]).find(([p]) => p === at)?.[1];
				if (spec && best < spec.max) (limits[type] ??= {})[at] = Math.max(spec.min ?? 1, Math.floor(best * 0.9));
			}
		}
		const file = option("json", path.join(SOURCE, "lib", "limits.json"));
		fs.writeFileSync(file, `${JSON.stringify({ note: "The longest text each field holds with nothing cut, outside the safe area, too small or over another text: measured by tools/audit.mjs --limits with Russian words, in three frames and two looks, a tenth to spare. Only the fields whose measured limit is under the one in fields.js. lib/film.cjs holds a film to these.", looks, aspects, limits }, null, 1)}\n`);
		console.log(`${tried.cases} cases; ${Object.values(limits).reduce((n, f) => n + Object.keys(f).length, 0)} fields of ${Object.keys(limits).length} scenes hold less than fields.js says; wrote ${file}`);
		return;
	}
	// --leak: every scene as the second of a film, looked at while the first plays: nothing of it
	// may be seen before its time. A case is one scene alone everywhere else here, and a scene that
	// showed through the one before it was in every film that had it (the chat's bubbles: the fit
	// drew each scene to measure it and left its parts lit; HISTORY 335).
	if (args.includes("--leak")) {
		const leaks = {};
		for (const aspect of aspects) {
			const tab = await browser.newPage();
			await tab.setViewport(sizes[aspect]);
			for (const type of asked) {
				for (const look of looks) {
					const film = { aspect, style: look, brand: brand(), scenes: [{ type: "fullbleed", text: "FIRST", beats: 4 }, all.get(type)] };
					await tab.play(film);
					// Well inside the first scene: before the cut and its transition.
					await tab.shoot(0.6);
					const seen = lines(await tab.evaluate(() => window.texts())).map((t) => t.text).filter((text) => bare(text) && !bare("FIRST").includes(bare(text)) && !bare(text).includes("first"));
					const shot = Buffer.from(await tab.screenshot({ type: "png" }));
					// And the picture is the first scene's alone: the same as with any other second scene.
					await tab.play({ ...film, scenes: [film.scenes[0], { type: "fullbleed", text: "LAST", beats: 4 }] });
					await tab.shoot(0.6);
					const alone = Buffer.from(await tab.screenshot({ type: "png" }));

					const [a, b] = await Promise.all([shot, alone].map((png) => sharp(png).removeAlpha().resize(Math.round(sizes[aspect].width / 4)).raw().toBuffer()));
					let differ = 0;
					for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) > 96 || Math.abs(a[i + 1] - b[i + 1]) > 96 || Math.abs(a[i + 2] - b[i + 2]) > 96) differ++;
					if (seen.length || differ / (a.length / 3) > 0.002) ((leaks[type] ??= []).push(`${look} ${aspect}: ${seen.length ? `"${seen[0].slice(0, 30)}"` : `${((100 * differ) / (a.length / 3)).toFixed(1)}% of the picture`}`));
				}
			}
			await tab.close();
		}
		await browser.close();
		for (const [type, where] of Object.entries(leaks)) console.log(`${type}\n  leak     ${where.length} cases, e.g. ${where[0]}`);
		console.log(`${asked.length * looks.length * aspects.length} cases; ${Object.keys(leaks).length} scenes are seen before their time`);
		process.exitCode = Object.keys(leaks).length ? 1 : 0;
		return;
	}
	// --survey: how each scene is laid out once it has settled, as numbers: the sizes of its texts,
	// the box they take, the edges they share. What the rules of one layout are written from.
	if (args.includes("--survey")) {
		const out = [];
		for (const aspect of aspects) {
			const tab = await browser.newPage();
			await tab.setViewport(sizes[aspect]);
			for (const type of asked) {
				for (const look of looks) {
					const { frame, shots } = await placed(tab, { aspect, style: look, brand: brand(), scenes: [all.get(type)] });
					const texts = lines(shots.find((shot) => shot.at === 0.8).raw).filter((t) => !t.mock && bare(t.text).length > 1);
					if (!texts.length) continue;
					const pct = (v, of) => Math.round((1000 * v) / of) / 10;
					out.push({
						type, look, aspect,
						sizes: texts.map((t) => Math.round(t.line / 1.2)).sort((a, b) => b - a),
						box: [pct(Math.min(...texts.map((t) => t.x)), frame.width), pct(Math.min(...texts.map((t) => t.y)), frame.height), pct(Math.max(...texts.map((t) => t.x + t.w)), frame.width), pct(Math.max(...texts.map((t) => t.y + t.h)), frame.height)],
						lefts: texts.map((t) => pct(t.x, frame.width)), centres: texts.map((t) => pct(t.x + t.w / 2, frame.width)),
					});
				}
			}
			await tab.close();
		}
		await browser.close();
		fs.writeFileSync(option("json", "survey.json"), JSON.stringify(out));
		console.log(`${out.length} cases surveyed`);
		return;
	}
	let cases = 0, faulty = 0;
	for (const aspect of aspects) {
		const tab = await browser.newPage();
		await tab.setViewport(sizes[aspect]);
		const errors = [];
		tab.on("pageerror", (err) => errors.push(err.message));
		for (const type of asked) {
			for (const look of looks) {
				const film = { aspect, style: look, brand: brand(), scenes: [args.includes("--long") ? long(all.get(type)) : all.get(type)] };
				errors.length = 0;
				const frame = await tab.play(film);
				const found = new Map();
				const seen = new Map(); // "kind|text" -> how many moments had it, and where
				// Where a text is counts once the scene has settled, and before that for a text that
				// holds still from one moment to the next: a line shown and gone in the first half of
				// its scene is read too (one stood from edge to edge of a real film and was never
				// measured), while what is still arriving is not yet where it will be read.
				const MOMENTS = [0.1, 0.2, 0.32, 0.45, 0.6, 0.7, 0.8, 0.9];
				const shots = [];
				for (const at of MOMENTS) {
					await tab.shoot(frame.duration * at);
					shots.push({ at, raw: await readTexts(tab) });
				}
				// A text on screen once the scene has settled is measured there; one that is gone by
				// then is measured where it held still.
				const late = new Set(shots.filter((shot) => shot.at >= 0.6).flatMap((shot) => lines(shot.raw).map((t) => t.text)));
				let before = new Map();
				for (const { at, raw } of shots) {
					const here = lines(raw);
					const still = new Set(here.filter((t) => {
						const was = before.get(t.text);
						return !late.has(t.text) && was && Math.max(Math.abs(was.x - t.x), Math.abs(was.y - t.y), Math.abs(was.w - t.w), Math.abs(was.h - t.h)) < frame.width * 0.012;
					}).map((t) => t.text));
					before = new Map(here.map((t) => [t.text, t]));
					if (args.includes("--texts") && (at === 0.6 || at === 0.8)) {
						console.log(`${type} ${look} ${aspect} at ${at}, fit: ${JSON.stringify(await tab.evaluate(() => Object.values(window.__pkScenes ?? {})[0]?.fitted ?? null))}`);
						for (const t of here) {
							const b = pictureBounds(t);
							console.log(`  x ${Math.round((100 * b.x) / frame.width)}-${Math.round((100 * (b.x + b.w)) / frame.width)}% y ${Math.round((100 * b.y) / frame.height)}-${Math.round((100 * (b.y + b.h)) / frame.height)}% ${Math.round(t.line / 1.2)} px seen ${(t.auditSeen ?? t.seen).toFixed(2)} (raw ${t.seen.toFixed(2)})${t.mock ? " mock" : ""}${t.roll ? " roll" : ""}${t.shaped ? " shaped" : ""}  ${t.text.slice(0, 40)}`);
						}
					}
					for (const [kind, what, where] of new Map(faultsOf(raw, film, frame, at === 0.6 || at === 0.8, still).map((f) => [`${f[0]}|${f[1]}`, f])).values()) {
						const key = `${kind}|${what}`;
						seen.set(key, { kind, what, where, n: (seen.get(key)?.n ?? 0) + 1 });
					}
				}
				// The same moment drawn twice, with another between, is the same picture: a scene is a
				// function of its clock and of nothing else (no timer, no randomness, nothing kept
				// from the frame before).
				if (args.includes("--twice")) {
					const shot = async (at) => {
						await tab.shoot(frame.duration * at);
						return Buffer.from(await tab.screenshot({ type: "png" }));
					};
					const first = await shot(0.45);
					await shot(0.9);
					await shot(0.15);
					const again = await shot(0.45);
					if (!again.equals(first)) {
						// How much of it, seen at a quarter of the size and by more than a third of a channel's
						// range. Chrome itself draws a moment a little differently after other frames: text
						// on a scaled layer a fraction of a pixel aside, a large soft gradient rounded
						// otherwise (seen in our glass scenes: the same picture to the eye). That is its own
						// and no scene's. A thing that stands elsewhere or shows another word differs by
						// the whole range, over more of the picture.

						const [w, h] = [Math.round(frame.width / 4), Math.round(frame.height / 4)];
						const [a, b] = await Promise.all([first, again].map((png) => sharp(png).removeAlpha().resize(w, h, { fit: "fill", kernel: "cubic" }).raw().toBuffer()));
						let differ = 0;
						const box = [w, h, 0, 0];
						for (let i = 0; i < a.length; i += 3) {
							if (Math.abs(a[i] - b[i]) <= 96 && Math.abs(a[i + 1] - b[i + 1]) <= 96 && Math.abs(a[i + 2] - b[i + 2]) <= 96) continue;
							differ++;
							const [x, y] = [(i / 3) % w, Math.floor(i / 3 / w)];
							box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y);
						}
						const share = differ / (a.length / 3);
						if (process.env.AUDIT_KEEP && differ) { fs.writeFileSync(path.join(process.env.AUDIT_KEEP, `${type}-${look}-a.png`), first); fs.writeFileSync(path.join(process.env.AUDIT_KEEP, `${type}-${look}-b.png`), again); }
						if (share > 0.0002) found.set("unstable|", ["unstable", `the same moment drawn twice differs in ${(share * 100).toFixed(2)}% of the picture (x ${Math.round((100 * box[0]) / w)}-${Math.round((100 * box[2]) / w)}%, y ${Math.round((100 * box[1]) / h)}-${Math.round((100 * box[3]) / h)}%)`]);
					}
				}
				// At both settled moments (two of two), or at two moments of the eight for a word.
				for (const [key, f] of seen) if (f.n >= 2) found.set(key, [f.kind, f.where ? `${f.what} (${f.where})` : f.what]);
				for (const message of new Set(errors)) found.set(`error|${message}`, ["error", message.slice(0, 80)]);
				cases++;
				if (found.size) faulty++;
				for (const [kind, what] of found.values()) ((report[type] ??= {})[kind] ??= new Set()).add(`${look} ${aspect}: ${what}`);
			}
		}
		await tab.close();
	}
	await browser.close();
	const kinds = {};
	for (const [type, faults] of Object.entries(report)) {
		console.log(type);
		for (const [kind, where] of Object.entries(faults)) {
			kinds[kind] = (kinds[kind] ?? 0) + 1;
			console.log(`  ${kind.padEnd(8)} ${where.size} cases, e.g. ${[...where][0]}`);
		}
	}
	console.log(`${cases} cases (${asked.length} scenes x ${looks.length} looks x ${aspects.length} frames), ${faulty} with a fault; scenes by fault: ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}`);
	const knownFile = path.join(HERE, args.includes("--long") ? "audit.known.long.json" : SCALE ? "audit.known.scale.json" : "audit.known.json");
	const now = Object.fromEntries(Object.entries(report).map(([type, faults]) => [type, Object.keys(faults).sort()]).sort());
	if (option("json", null)) {
		fs.writeFileSync(option("json"), JSON.stringify(Object.fromEntries(Object.entries(report).map(([t, f]) => [t, Object.fromEntries(Object.entries(f).map(([k, w]) => [k, [...w]]))])), null, 1));
		fs.writeFileSync(`${option("json")}.sources.json`, JSON.stringify({cases,faulty,aspects,looks,scenes:asked,sourceReceipts:browser.receipts}, null, 2));
	}
	if (args.includes("--write-known")) {
		fs.writeFileSync(knownFile, `${JSON.stringify({ note: "The faults tools/audit.mjs finds in each scene today: the debt, to be paid scene by scene. A scene not here has none. `node tools/audit.mjs --known` fails on a fault that is not here; take a fault out when it is fixed, never put one in.", scenes: now }, null, 1)}\n`);
		console.log(`wrote ${knownFile}`);
		process.exit(0);
	}
	if (args.includes("--known")) {
		const known = JSON.parse(fs.readFileSync(knownFile, "utf8")).scenes;
		const fresh = Object.entries(now).flatMap(([type, found]) => found.filter((kind) => !(known[type] ?? []).includes(kind)).map((kind) => `${type}: ${kind}`));
		for (const line of fresh) console.log(`NEW  ${line}`);
		console.log(fresh.length ? `${fresh.length} faults that are not known` : "no fault that is not known");
		process.exit(fresh.length ? 1 : 0);
	}
	process.exit(faulty ? 1 : 0);
};

main().catch((err) => {
	console.error(err.stack ?? err.message);
	process.exit(2);
});
