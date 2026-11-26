// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function create(K) {
const { maths, dom, moves } = K.helpers;
const D=K.design;
const { clamp, lerp, prog, expoOut } = maths;
const { el, set, px } = dom;
const { odometer } = moves;
const { W, H, S, spring } = K;
return ({ p, cam, fg, accent }) => {
			const s = p.scene;
			const wrap = el("div", "center", cam);
			const num = el("div", "display", wrap);
			set(num, { color: fg, fontVariantNumeric: "tabular-nums" });
			const decimals = (String(s.value).split(".")[1] ?? "").length;
			const final = `${s.prefix ?? ""}${s.value.toFixed(decimals)}${s.suffix ?? ""}`;
			num.textContent = final;
			const size = D.fitLine(num, W * 0.8, H * 0.5, "hero");
			const label = el("div", "bold", wrap, s.label);
			D.fitSize(label,W*.8,H*.16,"caption");
			set(label, { color: fg, marginTop: px(D.space(4)), position: "relative" });
			const bar = el("div", "", label);
			set(bar, { position: "absolute", left: "0", right: "0", bottom: "-0.28em", height: "0.16em", background: accent, transformOrigin: "0 50%", borderRadius: "0.08em" });
			const countDur = Math.min(1.2, p.dur * 0.7);
			// Rolling digits between the prefix and suffix, sized for the widest value it passes.
			num.textContent = "";
			if (s.prefix) el("span", "", num, s.prefix);
			const roll = odometer(el("span", "", num), (s.value === 0 ? 99 : Math.abs(s.value)).toFixed(decimals));
			if (s.suffix) el("span", "", num, s.suffix);
			return (l) => {
				const k = expoOut(prog(l, 0.04, countDur));
				roll(s.value === 0 ? lerp(99, 0, k) : lerp(0, s.value, k));
				const e = spring(l, 2.6, 0.55);
				set(num, { transform: `translateY(${px((1 - e) * 60 * S)}) scale(${(0.9 + 0.1 * e).toFixed(4)})`, opacity: clamp(l / 0.08).toFixed(3) });
				const lk = expoOut(prog(l, 0.25, 0.5));
				set(label, { opacity: lk.toFixed(3), transform: `translateY(${px((1 - lk) * 24 * S)})` });
				set(bar, { transform: `scaleX(${expoOut(prog(l, 0.45, 0.5)).toFixed(4)})` });
			};
		};
}
