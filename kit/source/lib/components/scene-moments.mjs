// When the moments inside a scene happen, on the film's beats: the one reckoning of it, read by
// the plan for the sounds (compiler/plan.cjs) and by the scene for its picture (`p.marks`, `p.at`,
// `p.clickAt`), so what is seen and what is heard cannot part. tools/sync-scene-moments.cjs writes
// the browser's module from this file.
//
// A moment is said in beats of the film, in the scene's own clock (`beat` is a beat there, `len`
// the scene's length): a film on a track has its beat from the track, and a scene whose moments
// stand on beats follows the music all the way through. How long a move takes is the scene's own
// matter and stays in seconds, in the scene's file.
import {onBeat, nearBeat, lastBeat} from './beat-grid.mjs';

/**
 * `count` parts landing one after another: the first on beat `lead`, the next a beat later each; half
 * or quarter beats apart when the scene is too short for whole ones to end by `share` of its length.
 */
function landings(count, len, beat, lead = 1, share = 0.82) {
	const every = [beat, beat / 2, beat / 4].find((step) => lead * beat + (count - 1) * step <= len * share) ?? beat / 4;
	return Array.from({ length: count }, (_, i) => lead * beat + i * every);
}

/** The moments a scene's parts land on, as a list (`p.marks`): each sounds as it lands. */
function marks(scene, len, beat) {
	const spread = (count, from, to) => {
		const step = Math.min(beat, (to - from) / Math.max(1, count));
		return Array.from({ length: count }, (_, i) => from + i * step);
	};
	switch (scene.type) {
		case "slam": return spread(scene.lines.length, 0.02, len * 0.72);
		case "morph": return Array.from({ length: scene.states.length }, (_, i) => (i * len) / scene.states.length);
		case "steps": return landings(scene.steps.length, len, beat, 1, 0.82);
		case "ticket": return [Math.max(0.6, len * 0.66)];
		case "append": return landings(scene.words.length, len, beat, 1, 0.85);
		case "countdown": return spread(scene.from + 1, 0.02, len * 0.8);
		case "callouts": return landings(scene.notes.length, len, beat, 1, 0.8);
		// The first message and the first card arrive half a beat in: the frame is theirs from the start.
		case "chat": return landings(scene.messages.length, len, beat, 0.5, 0.8);
		case "notify": return landings(scene.items.length, len, beat, 0.5, 0.7);
		case "timeline": return landings(scene.items.length, len, beat, 1, 0.85);
		default: return undefined;
	}
}

/** When the cursor of a scene presses (`p.clickAt`). */
function clickAt(scene, len) {
	if ((scene.type === "ui-macro" && scene.click !== false) || scene.type === "prompt") return Math.min(len - 0.25, Math.max(0.5, len * 0.74));
	if (scene.type === "toggle") return Math.max(0.45, len * 0.42);
	return undefined;
}

/** The named moments of a scene (`p.at`), for the scenes whose parts do more than land in a row. */
const MOMENTS = {
	// The circles pop in over the first beat from a quarter in, and scatter on the last beat that
	// leaves the scatter its half second.
	pack(s, len, beat) {
		return { first: beat / 4, spread: beat, out: Math.max(beat * 2, Math.floor((len - 0.5) / beat + 1e-6) * beat) };
	},
	// The camera dives through the word and lands on a beat (`land`); the dive begins as long before
	// as it takes, and the line under the word settles after it.
	knockout(s, len, beat) {
		const land = onBeat(Math.min(1, len * 0.28) + 0.8, beat, len * 0.7);
		return { zoom: land - 0.8, land, settle: land + 0.3 };
	},
	// A tile lands every eighth of a beat from a quarter in (all of them within a beat and a quarter);
	// each falls for `fall` seconds before it lands.
	tiles(s, len, beat) {
		const n = [...s.text].length;
		return { first: beat / 4, every: Math.min(beat / 8, beat / Math.max(1, n)), fall: 0.2 };
	},
	// The faces come to rest one after another, an eighth of a beat apart, the first a quarter beat in.
	faces(s, len, beat) {
		return { first: beat / 4, every: beat / 8 };
	},
	// The panels open one after another, an eighth of a beat apart, the first a quarter beat in.
	mosaic(s, len, beat) {
		return { first: beat / 4, every: beat / 8 };
	},
	// A card arrives on every half beat, and its number comes to rest on the half beat nearest to
	// the end of its roll.
	overlay(s, len, beat) {
		const cards = Array.from({ length: Math.min(3, s.cards?.length ?? 0) }, (_, i) => ((i + 1) * beat) / 2);
		return { cards, settle: cards.map((t) => nearBeat(t + 1.2, beat)) };
	},
	// The strip of photos rises as the scene opens; the word of the line changes on beats from the
	// first on, as far apart as the scene's length gives each (0.6 s at the least, less in a scene
	// too short for it).
	arc(s, len, beat) {
		const n = 1 + Math.min(3, s.words?.length ?? 0), half = beat / 2;
		let halves = Math.max(Math.ceil(0.6 / half - 1e-6), Math.round((len * 0.6) / n / half));
		// The last word has come in before the cut.
		while (halves > 1 && beat + (n - 1) * halves * half > len - 0.5) halves--;
		return { rise: 0, swaps: Array.from({ length: n }, (_, k) => beat + k * halves * half) };
	},
	// The pictures fly out past the lens and the line lands in the clearing on a half beat (`hit`);
	// the flight begins a moment before, as long as it takes.
	swarm(s, len, beat) {
		const hit = nearBeat(Math.max(1.2, len * 0.58) + 0.3, beat);
		return { out: hit - 0.3, hit };
	},
	// A picture lands in the gap of the line on half a beat, the next ones whole half beats apart (a
	// quarter beat in a scene too short for that); with real pictures the scene then zooms into the
	// top one from a half beat (`zoom`) to its end.
	inline(s, len, beat) {
		const pictures = s.images?.length ?? 0, half = beat / 2;
		const n = Math.max(1, Math.min(6, pictures || s.items?.length || 4));
		const zoom = pictures ? nearBeat(len * 0.74, beat) : len;
		let halves = Math.round((zoom - 0.37 - half) / n / half);
		// The last picture is on top for half a second before the zoom or the cut.
		while (halves > 0 && half + (n - 1) * halves * half > zoom - 0.5) halves--;
		const every = halves ? halves * half : beat / 4;
		return { pops: Array.from({ length: n }, (_, i) => half + i * every), zoom };
	},
	// The words fly out around the mark an eighth of a beat apart from half a beat in; when they are
	// all there the key words light in turn, on beats, as far apart as the scene's length gives each.
	web(s, len, beat) {
		const n = Math.min(16, s.words?.length || 10), keys = Math.min(4, s.keys?.length || 3), half = beat / 2;
		const words = half, stagger = Math.min(beat / 8, (beat * 2) / n);
		const first = onBeat(words + n * stagger + 0.3, half);
		let halves = Math.max(Math.ceil(0.45 / half - 1e-6), Math.round((len - first - 0.6) / keys / half));
		// The last key word is lit a moment before the push that ends the scene.
		while (halves > 1 && first + (keys - 1) * halves * half > len - 1.05) halves--;
		return { words, stagger, keys: Array.from({ length: keys }, (_, k) => first + k * halves * half) };
	},
	// The first line rises on the first beat and the orb pulses with it; the next lines follow on
	// beats, as far apart as the scene's length gives each.
	orb(s, len, beat) {
		const n = Math.max(1, s.lines?.length ?? 1), half = beat / 2;
		let halves = Math.max(Math.ceil(0.6 / half - 1e-6), Math.round((len - 0.9) / n / half));
		// The last line has its entrance and a moment to be read before the cut.
		while (halves > 1 && beat + (n - 1) * halves * half > len - 0.8) halves--;
		return { lines: Array.from({ length: n }, (_, k) => beat + k * halves * half) };
	},
	// A slab lands on every half beat from the first half beat (a quarter beat apart when there are
	// too many for the first half of the scene).
	cards3d(s, len, beat) {
		const n = Math.max(2, Math.min(5, s.images?.length || s.titles?.length || 3));
		const every = beat / 2 + ((n - 1) * beat) / 2 <= len * 0.5 ? beat / 2 : beat / 4;
		return { lands: Array.from({ length: n }, (_, i) => beat / 2 + i * every) };
	},
	// The icon flies in and lands on a half beat; the shapes around it pop an eighth of a beat apart
	// from that landing, and sparkle a quarter beat after it.
	icon3d(s, len, beat) {
		const land = nearBeat(0.35, beat);
		return { land, every: beat / 8, sparkle: land + beat / 4 };
	},
	// The first word arrives on the first beat and the words change on beats after it, as far apart as
	// the scene's length gives each (half a second at the least).
	split(s, len, beat) {
		const n = s.words.length, half = beat / 2;
		const least = Math.ceil(0.5 / half - 1e-6);
		let halves = Math.max(least, Math.round((len - beat) / n / half));
		// The last word is left at least most of a turn.
		while (halves > least && beat + (n - 1) * halves * half > len - 0.6 * halves * half) halves--;
		return { swaps: Array.from({ length: n }, (_, k) => beat + k * halves * half) };
	},
	// The tools fly in an eighth of a beat apart, a label lights on every beat, and the mark takes
	// them all in on a beat (`pop`: the pull begins a moment before, as long as it takes).
	hive(s, len, beat) {
		const n = Math.min(12, s.icons?.length || 8), labels = s.labels?.length ?? 0;
		const icons = beat / 2, stagger = Math.min(beat / 8, (beat * 2) / n), land = beat / 2;
		const first = onBeat(icons + n * stagger + 0.35, beat / 2);
		const pop = onBeat(Math.max(first + labels * beat + 0.3, len * 0.62) + 0.36, beat, len - 0.7);
		return { icons, stagger, land, labels: Array.from({ length: labels }, (_, i) => first + i * beat), pull: pop - 0.36, pop };
	},
	// A finger taps the phone through its screens on half beats, as far apart as the scene's length
	// gives each, and the last tap confirms; the rays burst a moment after it, and the phone leaves
	// on the last half beat that leaves it the time to go.
	between(s, len, beat) {
		const n = Math.min(3, s.words?.length || 1), half = beat / 2;
		const exit = Math.floor((len - 0.34) / half + 1e-6) * half;
		// The confirmation folds, draws its check and bursts before the phone leaves.
		const latest = Math.floor((exit - 0.8) / half + 1e-6) * half;
		// With one screen there is nothing to tap through: it is confirmed in the middle.
		const first = Math.min(latest, n > 1 ? onBeat(0.8, half) : nearBeat(len * 0.5, beat));
		let halves = Math.max(1, Math.round((len * 0.5) / n / half));
		while (halves > 1 && first + (n - 1) * halves * half > latest + 1e-6) halves--;
		const taps = Array.from({ length: n }, (_, i) => first + i * halves * half);
		const confirm = taps.pop();
		return { taps, confirm, burst: confirm + 0.26, exit };
	},
	// A file is dropped into the product on a beat, one beat after another; the cursor grabs the
	// first a beat before its drop and the others half a beat before, each file gets its check on
	// the first half beat its upload leaves, and the button is pressed on the first beat after.
	drag(s, len, beat) {
		const n = Math.min(3, s.files?.length || 3), lead = nearBeat(len * 0.3, beat);
		const drops = Array.from({ length: n }, (_, k) => lead + k * beat);
		const grabs = drops.map((drop, k) => drop - (k ? beat / 2 : beat));
		const checks = drops.map((drop) => onBeat(drop + 0.6, beat / 2));
		return { grabs, drops, checks, click: onBeat(drops[n - 1] + 0.4, beat, len - 0.55) };
	},
	// The voice begins on the first beat, as the player lands.
	wave(s, len, beat) {
		return { talk: beat };
	},
	// A step is ticked off on a beat, the first on the second beat (half a beat sooner in a short
	// scene), as far apart as the scene's length gives each; half a beat after the last the whole
	// job is done, and the result is left the time to open.
	agent(s, len, beat) {
		const n = Math.min(5, s.steps?.length || 3), tail = beat / 2 + (s.result ? 0.75 : 0.4);
		const room = (lead, step) => (lead + (n - 1) * step) * beat + tail <= len + 1e-6;
		const [lead, step] = [[2, 1.5], [2, 1], [1.5, 1], [1.5, 0.5]].find(([first, apart]) => room(first, apart)) ?? [1.5, 0.5];
		const done = Array.from({ length: n }, (_, i) => (lead + i * step) * beat);
		return { start: [beat / 2, ...done.slice(0, -1)], done, all: done[n - 1] + beat / 2 };
	},
	// Typing starts half a beat in, a letter every eighth of a beat (faster for a long query), and
	// Enter is pressed on the first beat that leaves a pause after the last letter; the picked row
	// opens just after the key.
	palette(s, len, beat) {
		const chars = (s.query || "clipboard").length, type = beat / 2;
		const every = [beat / 8, beat / 16, beat / 32].find((step) => chars * step <= len * 0.4) ?? beat / 32;
		const typed = type + chars * every;
		const enter = onBeat(typed + 0.4, beat, len - 0.6);
		return { type, every, typed, enter, open: enter + 0.05 };
	},
	// The ring appears on a beat and hops every half beat after it; the pick lifts out on the third
	// beat, half a beat after the ring lands on it (half a beat sooner in a scene too short to show
	// its name after).
	picker(s, len, beat) {
		const land = (3 * beat + 0.6 <= len ? 3 : 2.5) * beat;
		return { ring: land - 2 * beat, hops: [3, 2, 1].map((k) => land - (k * beat) / 2), land };
	},
	// The questions pop up a quarter of a beat apart from the start (an eighth when they would not
	// be done a beat before the answer); the answer lands on a beat near the middle, the questions
	// fly off as it comes, and it is typed and sent on the first half beat after its typing.
	bubbles(s, len, beat) {
		const q = s.questions.length, count = Math.max(q, Math.min(14, q * 3)), half = beat / 2;
		const spaced = (until) => [beat / 4, beat / 8].find((step) => (count - 1) * step <= until + 1e-6) ?? beat / 8;
		if (!s.answer) return { count, every: spaced(len * 0.5) };
		const send = Math.ceil(1 / half - 1e-6) * half;
		const answer = Math.max(2, Math.min(Math.round((len * 0.58) / beat), Math.floor((len - send - 0.3) / beat + 1e-6))) * beat;
		return { count, every: spaced(answer - beat), away: answer - 0.1, answer, type: answer + 0.2, typed: answer + 0.9, sent: answer + send };
	},
	// The letters stamp in a fraction of a beat apart, flicker through their faces, and come clean as
	// one word on a half beat (`clean`); the glide to it begins as long before as it takes.
	assemble(s, len, beat) {
		const n = [...String(s.word ?? "").replace(/\*/g, "")].length, half = beat / 2;
		const first = beat / 8, every = Math.min(beat / 8, (beat * 1.25) / Math.max(1, n));
		const arrived = first + n * every;
		const clean = Math.min(nearBeat(arrived + 1.35, beat), Math.floor((len - 0.35) / half + 1e-6) * half);
		return { first, every, flick: Math.max(arrived, clean - 1.15), resolve: clean - 0.6, clean };
	},
	// The words arrive half a beat apart from the first frame, the wheel shows a quarter beat after
	// the last, and it turns to each next word on a beat (`turns`).
	journey(s, len, beat) {
		const n = String(s.text).trim().split(/\s+/).filter(Boolean).length;
		const opts = (s.wheel ?? []).filter(Boolean).slice(0, 8).length;
		const step = [beat / 2, beat / 4].find((every) => (n - 1) * every <= len * 0.42) ?? beat / 8;
		const words = Array.from({ length: n }, (_, i) => i * step);
		const wheel = (words[n - 1] ?? 0) + beat / 4;
		const first = onBeat(wheel + 0.45, beat / 2);
		const per = opts > 2 && first + (opts - 2) * beat > len - 0.8 ? beat / 2 : beat;
		return { words, wheel, turns: Array.from({ length: Math.max(0, opts - 1) }, (_, j) => first + j * per) };
	},
	// The words fly to their new places and land on a half beat (`land`); the flight begins as long
	// before as it takes.
	shuffle(s, len, beat) {
		const half = beat / 2;
		const land = Math.min(nearBeat(Math.max(0.9, len * 0.42) + 0.85, beat), Math.floor((len - 0.3) / half + 1e-6) * half);
		return { move: land - 0.85, land };
	},
	// The words land a quarter of a beat apart, and the key word takes the frame on a half beat
	// (`hit`); the others leave and it grows from `gather`, as long before as it takes.
	scatter(s, len, beat) {
		const n = String(s.text).split(/\s+/).filter(Boolean).length, half = beat / 2, first = beat / 8;
		const every = first + (n - 1) * (beat / 4) + 1.5 <= len - 0.3 ? beat / 4 : beat / 8;
		const lastWord = first + (n - 1) * every;
		const hit = Math.min(nearBeat(Math.max(lastWord + 0.7, len * 0.55) + 0.8, beat), Math.floor((len - 0.2) / half + 1e-6) * half);
		return { first, every, gather: hit - 0.8, hit };
	},
	// The dots gather into the line, which turns solid on a half beat (`solid`); the gathering begins
	// as long before as it takes.
	particles(s, len, beat) {
		const half = beat / 2;
		const solid = Math.min(nearBeat(Math.min(0.7, len * 0.18) + 1.6, beat), Math.floor((len - 0.45) / half + 1e-6) * half);
		return { gather: solid - 1.6, solid };
	},
	// The first value is typed from an eighth of a beat in, a key every `key` seconds; each next value
	// is selected on a beat (`selects`), equal turns apart, and typed over from a half beat after (`types`).
	retype(s, len, beat) {
		const texts = [s.from, ...s.to].map(String), n = texts.length - 1, half = beat / 2, key = 0.06;
		const start = beat / 8, gap = Math.ceil(0.3 / half - 1e-6) * half;
		const first = onBeat(start + texts[0].length * key + 0.3, half);
		const least = Math.ceil((gap + Math.max(0, ...texts.slice(1).map((text) => text.length)) * key + 0.3) / half - 1e-6);
		let halves = Math.max(least, Math.round((len * 0.96 - first) / Math.max(1, n) / half));
		while (halves > least && first + (n - 1) * halves * half + gap + texts[n].length * key > len - 0.3) halves--;
		const selects = Array.from({ length: n }, (_, i) => first + i * halves * half);
		return { key, start, selects, types: selects.map((select) => select + gap) };
	},
	// The wheel turns to its second word on the first beat and to each next one on a beat after it,
	// equal turns apart.
	roll(s, len, beat) {
		const n = s.words.length, half = beat / 2, least = Math.ceil(0.3 / half - 1e-6);
		let halves = Math.max(least, Math.round((len * 0.9 - 0.45) / Math.max(1, n - 1) / half));
		while (halves > least && beat + (n - 2) * halves * half > len - 0.5) halves--;
		return { turns: Array.from({ length: Math.max(0, n - 1) }, (_, i) => beat + i * halves * half) };
	},
	// The ball lands on a half beat and bounces twice (`hits`), floods the frame on a half beat (`hit`:
	// it rolls to the centre and grows as long before as that takes), and the ring of words arrives on
	// a half beat (`ring`). A scene long enough has a shape morph three times in between (`shapes`,
	// `morphs`); a short one goes from the flood to the ring.
	dot(s, len, beat) {
		const half = beat / 2, on = (t) => Math.ceil(t / half - 1e-6) * half, last = (t) => Math.floor(t / half + 1e-6) * half;
		const landWant = on((String(s.lead ?? "").replace(/\*/g, "") ? 0.62 : 0.4) + 0.38);
		const hitWant = nearBeat(Math.max(landWant + 0.91, len * 0.34) + 0.7, beat);
		const full = nearBeat(Math.max(hitWant + 1.25, len * 0.7), beat);
		const hasShapes = full <= len - 0.6;
		const ring = hasShapes ? full : Math.min(on(hitWant + 0.6), last(len - 0.4));
		const hit = hasShapes ? hitWant : Math.min(hitWant, last(ring - 0.6));
		const land = Math.min(landWant, last(hit - 1.31));
		const at = { fall: beat / 4, ball: land - 0.38, hits: [land, land + 0.24, land + 0.36], move: hit - 0.7, grow: hit - 0.38, hit, ring };
		if (!hasShapes) return at;
		const shapes = hit + beat / 4;
		const every = [half, beat / 4].find((step) => 3 * step <= ring - 0.45 - shapes) ?? beat / 8;
		return { ...at, shapes, morphs: [1, 2, 3].map((k) => shapes + k * every) };
	},
	// The words change on beats, equal turns apart (`swaps`; the first word's doodles pop a quarter
	// beat in); then the cards fan out on a half beat (`fan`) and swing into a pinwheel that sounds
	// on a half beat (`mark`).
	flip(s, len, beat) {
		const n = (s.words ?? []).map((word) => String(word ?? "").replace(/\*/g, "")).filter(Boolean).slice(0, 5).length;
		const gathers = s.gather !== false && n >= 3, half = beat / 2;
		const on = (t) => Math.ceil(t / half - 1e-6) * half, last = (t) => Math.floor(t / half + 1e-6) * half;
		const least = Math.ceil(0.3 / half - 1e-6), latest = last(len - 0.55);
		let halves = Math.max(least, Math.round((len * (gathers ? 0.58 : 0.86)) / Math.max(1, n) / half));
		while (halves > least && (n - 1) * halves * half > (gathers ? latest - 1.1 : len - 0.5)) halves--;
		const turn = halves * half;
		const swaps = Array.from({ length: n }, (_, k) => (k ? k * turn : beat / 4));
		if (!gathers) return { swaps };
		const fan = on(swaps[n - 1] + Math.max(0.5, turn * 0.9));
		const mark = Math.min(on(fan + 0.9), latest);
		return { swaps, fan: Math.min(fan, last(mark - 0.7)), gather: mark - 0.2, mark };
	},
	// The text is typed from a quarter of a beat in, a key after a key (`keys`, with a pause where a
	// mention opens and closes); the camera pulls back on a half beat (`pull`) and the cursor presses
	// send on a beat (`click`). A short scene types faster to leave the pull back its time.
	pullback(s, len, beat) {
		const text = String(s.text ?? "").replace(/\*/g, ""), n = text.length, half = beat / 2;
		const m = text.match(/@\S+(?:\s\p{Lu}\S*)*/u), mStart = m ? m.index : -1, mEnd = m ? mStart + m[0].length : -1;
		const pause = (k) => (m && k > mStart ? 0.25 : 0) + (m && k >= mEnd ? 0.1 : 0);
		const start = beat / 4;
		const clickLast = Math.floor((len - 0.4) / beat + 1e-6) * beat, pullLast = Math.floor((clickLast - 1.15) / half + 1e-6) * half;
		const span = Math.max(n * 0.02, Math.min(n * 0.05 + (m ? 0.35 : 0), pullLast - 0.2 - start - pause(n)));
		const keys = Array.from({ length: n + 1 }, (_, k) => start + (k / Math.max(1, n)) * span + pause(k));
		const pull = Math.max(onBeat(keys[n] + 0.1, half), Math.min(onBeat(keys[n] + 0.35, half), pullLast));
		const click = Math.max(onBeat(pull + 0.95, half), Math.min(onBeat(pull + 1.4, beat), clickLast));
		return { keys, pull, click };
	},
};

/** Everything a scene is told about its moments: {marks, clickAt, at}, each only when the scene has it. */
function sceneMoments(scene, len, beat) {
	const out = { marks: marks(scene, len, beat), clickAt: clickAt(scene, len) };
	const at = MOMENTS[scene.type]?.(scene, len, beat);
	if (at) out.at = at;
	return out;
}

export {sceneMoments};
