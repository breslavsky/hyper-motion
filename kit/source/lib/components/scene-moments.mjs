// When the moments inside a scene happen, on the film's beats: the one reckoning of it, read by
// the plan for the sounds (compiler/plan.cjs) and by the scene for its picture (`p.marks`, `p.at`,
// `p.clickAt`), so what is seen and what is heard cannot part. tools/sync-scene-moments.cjs writes
// the browser's module from this file.
//
// A moment is said in beats of the film, in the scene's own clock (`beat` is a beat there, `len`
// the scene's length): a film on a track has its beat from the track, and a scene whose moments
// stand on beats follows the music all the way through. How long a move takes is the scene's own
// matter and stays in seconds, in the scene's file.

/** The first beat at or after `t`; the first half or quarter beat when a whole one comes after `limit`. */
function onBeat(t, beat, limit = Infinity) {
	return [beat, beat / 2, beat / 4].map((grid) => Math.ceil(t / grid - 1e-6) * grid).find((at) => at <= limit) ?? Math.min(t, limit);
}

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
		case "append": return spread(scene.words.length, 0.5, len * 0.85);
		case "countdown": return spread(scene.from + 1, 0.02, len * 0.8);
		case "callouts": return spread(scene.notes.length, 0.55, len * 0.8);
		case "chat": return spread(scene.messages.length, 0.2, len * 0.8);
		case "notify": return spread(scene.items.length, 0.15, len * 0.7);
		case "timeline": return spread(scene.items.length, 0.35, len * 0.85);
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
	// The tools fly in an eighth of a beat apart, a label lights on every beat, and the mark takes
	// them all in on a beat (`pop`: the pull begins a moment before, as long as it takes).
	hive(s, len, beat) {
		const n = Math.min(12, s.icons?.length || 8), labels = s.labels?.length ?? 0;
		const icons = beat / 2, stagger = Math.min(beat / 8, (beat * 2) / n), land = beat / 2;
		const first = onBeat(icons + n * stagger + 0.35, beat / 2);
		const pop = onBeat(Math.max(first + labels * beat + 0.3, len * 0.62) + 0.36, beat, len - 0.7);
		return { icons, stagger, land, labels: Array.from({ length: labels }, (_, i) => first + i * beat), pull: pop - 0.36, pop };
	},
};

/** Everything a scene is told about its moments: {marks, clickAt, at}, each only when the scene has it. */
function sceneMoments(scene, len, beat) {
	const out = { marks: marks(scene, len, beat), clickAt: clickAt(scene, len) };
	const at = MOMENTS[scene.type]?.(scene, len, beat);
	if (at) out.at = at;
	return out;
}

export {sceneMoments, onBeat, landings};
