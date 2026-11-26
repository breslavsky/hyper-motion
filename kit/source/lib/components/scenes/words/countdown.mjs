// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
/** 3, 2, 1, LIVE: each number slams on its beat. */
export const factory = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, spring, clamp, expoIn, prog, misreg } = K;
	const s = p.scene;
	const n = s.from;
	const marks = p.marks ?? Array.from({ length: n + 1 }, (_, i) => i * p.beatLen);
	const labels = [...Array.from({ length: n }, (_, i) => String(n - i)), s.label ?? "GO"];
	const wrap = el("div", "center", cam);
	const nodes = labels.map((txt, i) => {
		const d = el("div", "display", wrap, txt);
		set(d, { position: "absolute", color: i === labels.length - 1 ? accent : fg, fontVariantNumeric: "tabular-nums" });
		K.design.fitLine(d, W * 0.86, H * 0.72, 'hero');
		return d;
	});
	return (l) => {
		nodes.forEach((d, i) => {
			const at = marks[i];
			const next = i + 1 < nodes.length ? marks[i + 1] : 1e9;
			const k = spring(l - at, 3.8, 0.5);
			const out = K.smooth(prog(l, next - 0.1, 0.16));
			const on = l >= at && l < next + 0.06;
			set(d, { opacity: on ? (K.smooth((l - at) / 0.06) * (1 - out)).toFixed(3) : "0", transform: `scale(${(1.6 - 0.6 * k + out * 0.4).toFixed(4)})` });
			misreg(d, on ? 1 - prog(l, at + 0.04, 0.18) : 0);
		});
	};
};
