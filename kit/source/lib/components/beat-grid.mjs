// Where a moment stands on the film's beats: the three ways a scene says it. `beat` is a beat in the
// scene's own clock. Read by components/scene-moments.cjs and by the definitions in metadata.cjs;
// tools/sync-beat-grid.cjs writes the browser's module from this file.

/** The first beat at or after `t`; the first half or quarter beat when a whole one comes after `limit`. */
function onBeat(t, beat, limit = Infinity) {
	return [beat, beat / 2, beat / 4].map((grid) => Math.ceil(t / grid - 1e-6) * grid).find((at) => at <= limit) ?? Math.min(t, limit);
}

/** The half beat nearest to `t`, never before the first. */
function nearBeat(t, beat) {
	return Math.max(1, Math.round(t / (beat / 2))) * (beat / 2);
}

/** The last half beat at or before `t`. */
function lastBeat(t, beat) {
	return Math.floor(t / (beat / 2) + 1e-6) * (beat / 2);
}

export {onBeat, nearBeat, lastBeat};
