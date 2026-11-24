// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
// Higher drums carry only during the final fraction of the lowest displayed
// place. Integer/rounded endpoints must show their exact digits (9999, not 0009).
export function odometerPosition(value,place,lowest){
  const raw=Math.abs(value)/10**lowest,nearest=Math.round(raw);
  const units=Math.abs(raw-nearest)<1e-7?nearest:raw,cycle=10**(place-lowest);
  const q=units/cycle,whole=Math.floor(q+1e-9),digit=whole%10;
  if(place===lowest)return digit+Math.max(0,q-whole);
  const remainder=units%cycle;
  const t=Math.max(0,Math.min(1,remainder-(cycle-1)));
  return digit+t*t*(3-2*t);
}
export function createMoves({ maths, dom }) {
const { clamp, smooth } = maths;
	const { el, set, px } = dom;

	/** The fractional part of a number. */
	const frac = (x) => x - Math.floor(x);

	/**
	 * A canvas over a scene's ground, W x H in stage units and drawn at three quarters of that
	 * resolution. Returns { c, g, clear }: the element, its 2D context, and clear(), which sets
	 * the context to stage units and empties it.
	 */
	const canvasLayer = (parent, z, W, H) => {
		const R = 0.75;
		const c = el("canvas", "deco", parent);
		c.width = Math.round(W * R);
		c.height = Math.round(H * R);
		set(c, { width: px(W), height: px(H), ...(z ? { zIndex: String(z) } : {}) });
		const g = c.getContext("2d");
		return { c, g, clear: () => (g.setTransform(R, 0, 0, R, 0, 0), g.clearRect(0, 0, W, H)) };
	};

	// A pulse that rises over 60 ms, then decays. An instant attack is a one-frame jump on every
	// beat, which reads as judder; this still lands on the beat but moves smoothly.
	const pulse = (phase, k) => (phase < 0.06 ? Math.sin(((phase / 0.06) * Math.PI) / 2) : 1) * Math.exp(-phase * k);
	/** The kick of the beat at time `t`: 1 just after a beat, decaying at rate `k`; `beat` its length in seconds. */
	const beatKick = (t, k, beat) => pulse((t + 1e-6) % beat, k);

	/**
	 * Rolling digits. `node` gets one slot per character of `template` (the widest text the number
	 * will show, such as "12,400"), each digit a column of 0-9 that rolls to its value, so the
	 * width never changes as digits are added and digits glide instead of swapping per frame.
	 * Returns update(value); leading places fade in as the number reaches them.
	 */
	const odometer = (node, template) => {
		node.textContent = "";
		// Columns of digits behind a mask: one figure to a viewer (tools/audit.mjs measures the box).
		node.setAttribute("data-roll", "");
		const dot = template.indexOf(".");
		const intEnd = dot < 0 ? template.length : dot;
		// The power of ten each digit's slot stands for: 0 for the units, negative after the point.
		const places = [];
		let place = 0;
		for (let i = intEnd - 1; i >= 0; i--) if (/\d/.test(template[i])) places[i] = place++;
		place = -1;
		for (let i = intEnd + 1; i < template.length; i++) if (/\d/.test(template[i])) places[i] = place--;
		const lowest = Math.min(...places.filter((x) => x !== undefined));
		const cells = [...template].map((ch, i) => {
			if (places[i] === undefined) return { sp: el("span", "", node, ch), sep: true, i };
			const sp = el("span", "", node);
			// Soft top and bottom edges, so a digit rolling out fades rather than being sliced off.
			const edge = "linear-gradient(transparent, #000 7%, #000 93%, transparent)";
			// The mask clips (no overflow: hidden), with side padding so tight letter-spacing never cuts a digit.
			set(sp, { display: "inline-block", position: "relative", height: "1lh", verticalAlign: "top", padding: "0 0.2em", margin: "0 -0.2em", maskImage: edge, webkitMaskImage: edge });
			const ghost = el("span", "", sp, "0");
			set(ghost, { visibility: "hidden" });
			const col = el("span", "", sp);
			set(col, { position: "absolute", left: "0.2em", top: "0", display: "flex", flexDirection: "column" });
			for (let d = 0; d <= 10; d++) el("span", "", col, String(d % 10)).style.height = "1lh";
			return { sp, col, e: places[i], i };
		});
		return (value) => {
			const a = Math.abs(value);
			let shownFrom = Infinity;
			for (const c of cells) {
				if (c.sep) continue;
				const q = a / 10 ** c.e;
				const pos = odometerPosition(a,c.e,lowest);
				set(c.col, { transform: `translateY(${(-pos * 100 / 11).toFixed(3)}%)` });
				// Leading zeros stay hidden until the number grows into them, and give back their
				// width smoothly, so 99 -> 0 leaves no gap where the tens were.
				const shown = c.e <= 0 ? 1 : smooth((q - 0.9) / 0.1);
				c.w ??= c.sp.offsetWidth - Number.parseFloat(getComputedStyle(c.sp).paddingLeft) * 2;
				set(c.sp, { opacity: shown.toFixed(3), width: px(c.w * shown), boxSizing: "content-box" });
				if (shown > 0) shownFrom = Math.min(shownFrom, c.i);
			}
			for (const c of cells) if (c.sep && /[,\s]/.test(template[c.i])) set(c.sp, { opacity: c.i > shownFrom ? "1" : "0" });
		};
	};

	/**
	 * A caret's blink at time `t`, `rate` blinks a second, fading over a few frames instead of
	 * switching in one (a hard on and off is a one-frame jolt on an otherwise calm picture).
	 */
	const blink = (t, rate = 1.2) => clamp(0.5 + 0.5 * Math.cos(t * rate * 2 * Math.PI) * 2.4);


return { frac, canvasLayer, pulse, beatKick, odometer, blink };
}
