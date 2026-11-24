// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
/** How far a move that starts `at` and takes `d` is at time `t`, from 0 to 1. */
const prog = (t, at, d) => (d <= 0 ? (t >= at ? 1 : 0) : clamp((t - at) / d));

// Out-curves start at their top speed, which on screen is a one-frame jolt: the element is
// still, then suddenly racing. `launch` warps time so the speed builds over the first few
// percent of the move (smooth at the start) and the curve still lands exactly on 1.
const LAUNCH = 0.07;
const launch = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : (t < LAUNCH ? (t * t) / (2 * LAUNCH) : t - LAUNCH / 2) / (1 - LAUNCH / 2));

const expoOut = (t) => (t >= 1 ? 1 : t <= 0 ? 0 : 1 - 2 ** (-10 * launch(t)));
const expoIn = (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10));
const expoInOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2);
/** Smoothstep on a clamped value: fades that start and stop without a kink. */
const smooth = (t) => {
	const x = clamp(t);
	return x * x * (3 - 2 * x);
};
const cubicInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const quartOut = (t) => 1 - (1 - launch(clamp(t))) ** 4;

/** CSS's cubic-bezier(x1, y1, x2, y2) as a function of progress 0..1 (Newton, then bisection). */
const bezier = ([x1, y1, x2, y2]) => {
	const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
	const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
	const X = (u) => ((ax * u + bx) * u + cx) * u;
	const Y = (u) => ((ay * u + by) * u + cy) * u;
	const dX = (u) => (3 * ax * u + 2 * bx) * u + cx;
	return (x) => {
		if (x <= 0) return 0;
		if (x >= 1) return 1;
		let u = x;
		for (let i = 0; i < 8; i++) {
			const d = dX(u);
			if (Math.abs(d) < 1e-6) break;
			const next = u - (X(u) - x) / d;
			if (next < 0 || next > 1) break;
			u = next;
		}
		if (Math.abs(X(u) - x) > 1e-4) {
			let lo = 0, hi = 1;
			for (let i = 0; i < 30; i++) {
				u = (lo + hi) / 2;
				if (X(u) < x) lo = u;
				else hi = u;
			}
		}
		return Y(u);
	};
};

/**
 * An underdamped spring's answer to a step, 0 -> 1 with overshoot, in closed form (no state).
 * `feel` is the film's: `snap` scales the spring's speed, `bounce` its overshoot (0 = no
 * overshoot at all).
 */
const spring = (t, freq = 3.6, damp = 0.5, feel = { snap: 1, bounce: 1 }) => {
	if (t <= 0) return 0;
	freq *= feel.snap;
	damp = feel.bounce <= 0.01 ? 0.999 : Math.min(0.999, Math.max(0.12, damp / feel.bounce));
	const w = 2 * Math.PI * freq;
	const wd = w * Math.sqrt(1 - damp * damp);
	const v = 1 - Math.exp(-damp * w * t) * (Math.cos(wd * t) + ((damp * w) / wd) * Math.sin(wd * t));
	// Measured on professional films, overshoot is rare and small (under 9% of moves, a late lean
	// past the mark): unless the look is bouncy on purpose, a spring flies half as far past its mark.
	return v > 1 && feel.bounce < 1.5 ? 1 + (v - 1) * 0.5 : v;
};

// The eases measured on some 4,300 moves of professional launch films (motionmaxxing,
// Apache-2.0; SOURCE.json), as closed forms: a landing slows down, a leaving speeds up, a
// drift is linear.
const softExp = (a) => (t) => (t <= 0 ? 0 : t >= 1 ? 1 : (1 - Math.exp(-a * t)) / (1 - Math.exp(-a)));
const EASE = {
	cruise: (t) => clamp(t),
	glide: (t) => 1 - (1 - clamp(t)) ** 1.7,
	softInOut: (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t)),
	softLand: softExp(3.6),
	gentleIn: (t) => clamp(t) ** 2.07,
	snapSettle: softExp(7.8),
	whip: (t) => 1 - (1 - clamp(t)) ** 2.5,
	accelExit: (t) => clamp(t) ** 2.6,
	crashOut: (t) => clamp(t) ** 4,
	popOver: (t) => {
		const c = 1.4;
		const u = clamp(t) - 1;
		return 1 + (c + 1) * u ** 3 + c * u * u;
	},
	crashIn: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-5 * t) * Math.cos(9 * t) * (1 - t * 0.2)),
};

/** A number from 0 to 1 that is always the same for the same `n`: the engine's only randomness. */
const hash = (n) => {
	const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

const six = (hex) => {
	const h = String(hex).replace("#", "");
	return h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6);
};
/** Relative luminance of a #hex (WCAG). */
const lum = (hex) => {
	const f = six(hex);
	const [r, g, b] = [0, 2, 4].map((i) => {
		const c = Number.parseInt(f.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Dark or white ink with the stronger contrast on a resolved solid ground. */
const textOn = (bg) => {
	// The painted sky has a separate component surface policy.
	if (bg === "sky") return "#ffffff";
	const light = lum(bg), dark = lum("#111111");
	const darkContrast = (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
	const whiteContrast = 1.05 / (light + 0.05);
	return darkContrast >= whiteContrast ? "#111111" : "#ffffff";
};
/** A #hex as rgba() with an alpha. */
const alpha = (hex, a) => {
	const n = Number.parseInt(six(hex), 16);
	return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** The colour `k` of the way from one #hex to another, as rgb(). */
const mixHex = (a, b, k) => {
	const parts = (hex) => {
		const n = Number.parseInt(six(hex), 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	};
	const [x, y] = [parts(a), parts(b)];
	const c = x.map((v, i) => Math.round(v + (y[i] - v) * clamp(k)));
	return `rgb(${c[0]},${c[1]},${c[2]})`;
};


export { clamp, lerp, prog, launch, expoOut, expoIn, expoInOut, smooth, cubicInOut, quartOut, bezier, spring, EASE, hash, lum, textOn, alpha, mixHex };
export default { clamp, lerp, prog, launch, expoOut, expoIn, expoInOut, smooth, cubicInOut, quartOut, bezier, spring, EASE, hash, lum, textOn, alpha, mixHex };
