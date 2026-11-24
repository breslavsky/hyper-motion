// Holds lib/compiler/plan.cjs to Kinetic's own compiler: the 28 plans its site ships
// (reference/plans.json), and the compiler cut from its app (reference/plan.min.js) on every
// template it offers, at every pace and aspect, and on scenes of the types no template uses.
//   node templates/pure-kinetic/tools/kinetic/plans.test.js
const fs = require("fs");
const path = require("path");
const ours = require("../../source/lib/compiler/plan.cjs");
const theirs = require("./reference/plan.min.js");
const here = (name) => path.join(__dirname, name);
// A plan as Kinetic makes it: without what ours adds for the engine here (the frame's safe area,
// whether the look throws sparks on a hit, the sizes of type by their part).
const kinetics = ({ safe, sparks, type, audioEvents, ...plan }) => plan;

const same = (a, b, where) => {
	if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9 ? null : `${where}: ${a} != ${b}`;
	if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return a === b ? null : `${where}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const k of keys) {
		if (a[k] === undefined && b[k] === undefined) continue;
		const diff = same(a[k], b[k], `${where}.${k}`);
		if (diff) return diff;
	}
	return null;
};

let checked = 0;
const failures = [];
const check = (name, film, aspect) => {
	checked++;
	let diff;
	try {
		diff = same(kinetics(ours.compile(film, aspect)), theirs.compile(film, aspect), name);
	} catch (err) {
		diff = `${name}: ${err.message}`;
	}
	if (diff) failures.push(diff);
};

// 1. The plans of the site, rebuilt into films and compiled again.
const plans = JSON.parse(fs.readFileSync(here("reference/plans.json"), "utf8"));
for (const [id, plan] of Object.entries(plans)) {
	const pace = Object.entries(theirs.paces).find(([, p]) => p.speed === plan.speed)[0];
	const film = { aspect: "16:9", style: id, brand: plan.brand, music: { bpm: plan.bpm }, pace, grain: plan.grain, scenes: plan.scenes.map((s) => s.scene) };
	checked++;
	const got = kinetics(ours.compile(film));
	const strip = ({ look, palette, ...rest }) => rest; // a plan on the site carries its look whole
	const diff = same(JSON.parse(JSON.stringify(got)), plan, `site:${id}`);
	if (diff) failures.push(diff);
}

// 2. Every template, at every pace and aspect, in its own look and in two others.
const templates = JSON.parse(fs.readFileSync(here("templates.json"), "utf8"));
const types = new Set();
for (const t of templates) {
	for (const s of t.scenes) types.add(s.type);
	for (const pace of Object.keys(theirs.paces)) {
		for (const aspect of Object.keys(theirs.aspects)) {
			for (const style of [t.style, "glitch", "onetake"]) {
				const film = { aspect: t.aspect, style, brand: { name: "Nook", colors: ["#ff7a4d", "#2433ff"] }, music: { bpm: t.bpm }, pace, scenes: t.scenes, motion: { trLength: 1.3, text: "spring" } };
				check(`template:${t.id}/${pace}/${aspect}/${style}`, film, aspect);
			}
		}
	}
}

// 3. Scenes of the types no template uses, with the fields their sounds read.
const extra = [
	{ type: "tiles", text: "HELLO THERE" }, { type: "inline", text: "a [ ] b", images: ["a", "b", "c"] }, { type: "inline", text: "a [ ] b", items: ["a", "b"] },
	{ type: "bubbles", questions: ["a?", "b?", "c?"], answer: "One answer for all of them" }, { type: "bubbles", questions: ["a?"] },
	{ type: "retype", from: "Design", to: ["Motion", "Launch films"] }, { type: "checklist", items: ["a", "b", "c"] },
	{ type: "cards3d", titles: ["a", "b", "c", "d"] }, { type: "icon3d" }, { type: "roll", words: ["a", "b", "c"] },
	{ type: "journey", text: "From idea to launch", wheel: ["a", "b", "c"] }, { type: "faces" }, { type: "shuffle" },
	{ type: "dot", lead: "It starts" }, { type: "dot" }, { type: "flip", words: ["a", "b", "c"] }, { type: "flip", words: ["a", "b"], gather: false },
	{ type: "pullback", text: "Describe your product in a sentence" }, { type: "pack" }, { type: "swarm", text: "Ready" }, { type: "swarm" },
	{ type: "split", words: ["a", "b", "c"] }, { type: "montage", lines: ["a", "b"] }, { type: "web", words: ["a", "b", "c", "d"], keys: [0, 2] },
	{ type: "picker" }, { type: "palette", query: "make a launch video" }, { type: "agent", steps: ["a", "b", "c"] }, { type: "particles" },
	{ type: "wave" }, { type: "arc", words: ["a", "b"] }, { type: "orb", lines: ["a", "b"] }, { type: "scatter", text: "Describe a video in chat" },
	{ type: "knockout" }, { type: "assemble", word: "KINETIC" }, { type: "hive", icons: ["a", "b", "c"], labels: ["x", "y"] },
	{ type: "between", words: ["a", "b", "c"] }, { type: "drag", files: ["a", "b"] }, { type: "field" }, { type: "trail" },
	{ type: "overlay", cards: [{}, {}] }, { type: "props3d" }, { type: "phone3d" }, { type: "mosaic" },
	{ type: "slam", lines: ["A", "B", "C"] }, { type: "morph", states: ["button", "loader", "check"] }, { type: "steps", steps: ["a", "b", "c"] },
	{ type: "ticket", title: "t", rows: [["a", "b"]], stamp: "OK" }, { type: "append", base: "Zero", words: ["a", "b"] }, { type: "countdown", from: 3 },
	{ type: "callouts", notes: ["a", "b"] }, { type: "chat", messages: [{}, {}] }, { type: "notify", items: [{}, {}] }, { type: "timeline", items: ["a", "b", "c"] },
	{ type: "ui-macro" }, { type: "ui-macro", click: false }, { type: "prompt", text: "x" }, { type: "toggle", label: "x" },
	{ type: "highlight", text: "a *b*", mark: "coral" }, { type: "swap", lead: "a", from: "b", to: "c", pill: "#ff0000" }, { type: "fullbleed", text: "GO" },
	{ type: "logo3d" }, { type: "title", text: "x", bg: "ink", fg: "#ffffff", in: "flash", look: "neon" },
];
for (const s of extra) types.add(s.type);
for (const beats of [2, 5, 9]) {
	for (const pace of Object.keys(theirs.paces)) {
		for (const style of Object.keys(theirs.looks)) {
			const scenes = [{ type: "title", text: "Open", beats: 2 }, ...extra.map((s, i) => ({ ...s, beats, in: Object.keys(theirs.transitions)[i % 18] })), { type: "endcard", cta: "go", beats: 4 }];
			check(`extra/${beats}/${pace}/${style}`, { aspect: "9:16", style, brand: { name: "Nook" }, pace, scenes });
		}
	}
}

console.log(`${checked} films compared, ${types.size} scene types, ${failures.length} different`);
for (const f of failures.slice(0, 8)) console.log("  " + f);
process.exit(failures.length ? 1 : 0);
