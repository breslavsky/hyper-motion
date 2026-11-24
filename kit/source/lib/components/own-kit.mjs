// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function createOwnKit() {
const panel = (K, parent, { ground, radius = 5, blur = 28, tint } = {}) => {
		const { el, set, px, S, lum, alpha } = K;
		const dark = lum(ground) < 0.4;
		const node = el("div", "glass", parent);
		const rim = dark ? 0.3 : 0.95;
		const sheen = dark
			? "linear-gradient(145deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 52%, rgba(255,255,255,0.12))"
			: "linear-gradient(145deg, rgba(255,255,255,0.82), rgba(255,255,255,0.44) 52%, rgba(255,255,255,0.66))";
		const wash = tint ? alpha(tint, dark ? 0.24 : 0.16) : null;
		// A dark translucent panel needs a stable dark layer beneath its sheen.
		// Otherwise moving bright orbs bleach the surface behind white labels.
		const base = dark ? alpha(ground, 0.82) : null;
		const layers = [sheen, ...(wash ? [`linear-gradient(${wash}, ${wash})`] : []), ...(base ? [`linear-gradient(${base}, ${base})`] : [])];
		set(node, {
			position: "relative",
			boxSizing: "border-box",
			borderRadius: radius === 'full' ? '9999px' : px(K.design.radius(radius)),
			background: layers.join(", "),
			backdropFilter: `blur(${px(blur * S)}) saturate(1.8) brightness(${dark ? 1.1 : 1.03})`,
			webkitBackdropFilter: `blur(${px(blur * S)}) saturate(1.8) brightness(${dark ? 1.1 : 1.03})`,
			border: `${px(Math.max(1, 1.5 * S))} solid rgba(255,255,255,${rim})`,
			boxShadow: [
				`inset 0 ${px(2 * S)} ${px(1 * S)} rgba(255,255,255,${dark ? 0.42 : 0.9})`,
				`inset 0 ${px(-2 * S)} ${px(6 * S)} rgba(255,255,255,${dark ? 0.08 : 0.5})`,
				`inset ${px(10 * S)} 0 ${px(24 * S)} rgba(255,255,255,${dark ? 0.04 : 0.2})`,
				`0 ${px(30 * S)} ${px(70 * S)} rgba(0,0,0,${dark ? 0.38 : 0.14})`,
				`0 ${px(4 * S)} ${px(12 * S)} rgba(0,0,0,${dark ? 0.22 : 0.06})`,
			].join(", "),
		});
		return node;
	};

	/**
	 * Soft colour drifting behind glass, so there is light for it to bend: three big blurred
	 * lights in the palette's accents inside `parent`. Returns the draw of moment `l`.
	 */
	const orbs = (K, parent, palette, accent, ground, seed = 0) => {
		const { el, set, px, W, H, hash, lum, alpha } = K;
		const dark = lum(ground) < 0.4;
		const colours = [accent, palette.electric, palette.coral, palette.lilac].filter((c, i, all) => c && c !== ground && all.indexOf(c) === i).slice(0, 3);
		const lights = colours.map((c, i) => {
			const r = (0.34 + hash(seed * 3.1 + i * 1.7) * 0.2) * Math.max(W, H);
			const node = el("div", "deco", parent);
			set(node, { inset: "auto", width: px(r), height: px(r), borderRadius: "50%", background: `radial-gradient(circle, ${alpha(c, dark ? 0.7 : 0.5)} 0%, ${alpha(c, dark ? 0.28 : 0.18)} 38%, ${alpha(c, 0)} 68%)` });
			return { node, r, a: hash(seed * 7.3 + i * 5.1) * Math.PI * 2, rx: (0.2 + hash(i * 9.2 + seed) * 0.16) * W, ry: (0.16 + hash(i * 4.4 + seed) * 0.14) * H };
		});
		return (l) => {
			for (const [i, k] of lights.entries()) {
				const a = k.a + l * (0.32 + i * 0.09) * (i % 2 ? -1 : 1);
				set(k.node, { left: px(W / 2 + Math.cos(a) * k.rx - k.r / 2), top: px(H / 2 + Math.sin(a) * k.ry - k.r / 2) });
			}
		};
	};

	/**
	 * "$12,400" as { before: "$", number: 12400, after: "", decimals: 0, comma: true }; null when it
	 * holds no number, or holds a time or a range ("18:30", "9-5"), which is not counted up to.
	 */
	const figure = (text) => {
		if (/\d\s*[:\-–/]\s*\d/.test(String(text))) return null;
		const found = /^(.*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(String(text));
		if (!found) return null;
		const digits = found[2].replace(/,/g, "");
		return { before: found[1], number: Number(digits), after: found[3], decimals: (digits.split(".")[1] ?? "").length, comma: found[2].includes(",") };
	};
	/** The figure at `k` of its way up from nothing, written as the text wrote it. */
	const counted = (f, k) => {
		const value = (f.number * k).toFixed(f.decimals);
		const [whole, part] = value.split(".");
		return `${f.before}${f.comma ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : whole}${part ? `.${part}` : ""}${f.after}`;
	};

	/** `n` moments spread from `from` to `to`. */
	const spread = (n, from, to) => Array.from({ length: n }, (_, i) => (n < 2 ? from : from + ((to - from) * i) / (n - 1)));

	/** Geometry and typography use the same design unit; artistic paths remain proportional. */
	const unit = K => K.design.unit / 3;

return { panel, orbs, figure, counted, spread, unit };
}
