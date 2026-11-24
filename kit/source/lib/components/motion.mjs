// Camera recipes are deterministic functions of a component's local and film time.
// Preserved from the licensed Kinetic adaptation; no shared film state or clock.
export function createMotion({W,H,S,plan,M,helpers}) {
  const {clamp,expoOut,prog,cubicInOut,hash}=helpers.maths;
  const {pulse}=helpers.moves;
  const {px}=helpers.dom;
	const lifeOf = (l, dur, i, strong) => {
		const u = clamp(l / Math.max(0.5, dur));
		const a = strong ? 1.15 : 0.7;
		const z = 1 + 0.045 * a * u;
		const x = W * 0.005 * a * Math.sin(l * 0.6 + i * 1.7);
		const y = H * 0.005 * a * Math.cos(l * 0.5 + i * 2.3);
		return `translate(${px((W * (1 - z)) / 2 + x)}, ${px((H * (1 - z)) / 2 + y)}) scale(${z.toFixed(5)})`;
	};

	/** Each style's camera: how the frame lives while a scene plays. l = scene time, t = film time. */
	const camera = (kind, l, dur, t, punch, kick, i) => {
		const u = clamp(l / dur);
		const beatPhase = (t + 1e-6) % plan.beat;
		const beatN = Math.floor((t + 1e-6) / plan.beat);
		let z = 1, x = 0, y = 0, r = 0, extra = "";
		if (kind === "punch") {
			// Poster: every scene slams in from a tight crop, a hard kick on each beat.
			z = 1 + 0.14 * (1 - expoOut(prog(l, 0, 0.35))) + 0.03 * pulse(beatPhase, 12);
		} else if (kind === "settle") {
			// Keynote: starts close and slowly settles back, like a stage camera.
			// It keeps easing back after it lands, so the frame never freezes.
			z = 1.14 - 0.1 * expoOut(prog(l, 0, Math.min(dur, 2.4))) - 0.06 * u;
			y = -H * 0.012 * (1 - u);
		} else if (kind === "pan") {
			// Blueprint / Swiss: a precise, linear dolly sideways, alternating direction.
			z = 1.04;
			x = W * 0.025 * (i % 2 ? 1 : -1) * (u - 0.5);
		} else if (kind === "shake") {
			// Loud: big beat kicks with a jolt in a random direction.
			const k = pulse(beatPhase, 10);
			z = 1.02 + 0.045 * k + punch;
			x = (hash(beatN) - 0.5) * W * 0.02 * k;
			y = (hash(beatN + 0.37) - 0.5) * H * 0.02 * k;
			r = (hash(beatN + 0.71) - 0.5) * 1.6 * k;
		} else if (kind === "glitch") {
			// Terminal: hard, stepped jumps a few times a scene, otherwise dead still.
			const step = Math.floor(l * 6);
			const on = hash(step + i * 13) > 0.86;
			// Each jump snaps in and out over ~2 frames instead of one, so it reads as a hit, not a
			// dropped frame. Under the jumps, a slow push so the frame never sits dead.
			const f = l * 6 - step;
			const e = on ? Math.min(1, f / 0.18, (1 - f) / 0.18) : 0;
			z = 1.01 + 0.035 * u + 0.03 * e;
			x = e * (hash(step + 0.5) - 0.5) * W * 0.03;
		} else if (kind === "handheld") {
			// Riso / Halftone: a gentle wander, like a camera held by hand.
			z = 1.035 + 0.02 * u + kick;
			x = W * 0.008 * Math.sin(t * 1.3) + W * 0.004 * Math.sin(t * 3.1);
			y = H * 0.008 * Math.cos(t * 1.1) + H * 0.003 * Math.sin(t * 2.7);
			r = 0.5 * Math.sin(t * 0.9);
		} else if (kind === "float") {
			// Glass: the whole frame floats and tilts in 3D.
			z = 1.03 + 0.02 * u;
			y = H * 0.01 * Math.sin(t * 1.4);
			extra = ` perspective(${px(2600 * S)}) rotateX(${(2.2 * Math.sin(t * 0.8)).toFixed(3)}deg) rotateY(${(3 * Math.cos(t * 0.6)).toFixed(3)}deg)`;
		} else if (kind === "onetake") {
			// One take: the camera keeps travelling in one direction for the whole film, so scenes
			// read as one continuous shot. Film time drives it, not scene time.
			z = 1.08 + 0.03 * Math.sin(t * 0.45);
			x = -W * 0.035 * Math.sin(t * 0.32);
			y = -H * 0.02 * Math.cos(t * 0.27);
			r = 0.6 * Math.sin(t * 0.21);
		} else if (kind === "orbit") {
			// Neon / Chrome: a 3D orbit around the subject, sweeping side to side, kicking in on the beat.
			const sw = cubicInOut(u) * 2 - 1;
			z = 0.97 + 0.02 * pulse(beatPhase, 9) + punch;
			y = H * 0.006 * Math.sin(t * 1.1);
			extra = ` perspective(${px(3000 * S)}) rotateY(${(sw * 3.2 * (i % 2 ? -1 : 1)).toFixed(3)}deg) rotateX(${(1.4 * Math.sin(t * 0.7)).toFixed(3)}deg)`;
		} else if (kind === "dolly") {
			// Cinematic: a slow, steady dolly in with a faint drift, like a camera on rails.
			z = 1.02 + 0.075 * cubicInOut(u);
			x = W * 0.006 * Math.sin(t * 0.35 + i);
			y = H * 0.008 * (0.5 - u);
		} else if (kind === "still") {
			// Minimal / Mono / Sting: no camera moves you'd notice, only a slow drift in, so the
			// frame is never frozen while the design does the moving.
			// Constant speed (an eased push stops dead at both ends of every scene).
			z = 1.015 + 0.075 * u;
			x = W * 0.006 * Math.sin(t * 0.5 + i);
			y = H * 0.004 * Math.cos(t * 0.4 + i);
		} else {
			z = 1 + 0.055 * u + punch + kick;
		}
		return `translate(${px((W * (1 - z)) / 2 + x)}, ${px((H * (1 - z)) / 2 + y)}) scale(${z.toFixed(4)}) rotate(${r.toFixed(3)}deg)${extra}`;
	};

  return {lifeOf,camera};
}
