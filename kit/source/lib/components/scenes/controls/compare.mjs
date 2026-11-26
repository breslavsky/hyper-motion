// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
/** Before / after: a divider sweeps across, the cursor dragging it. */
export const factory = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, clamp, cubicInOut, prog, alpha, textOn, makeCursor, lerp } = K;
	const s = p.scene;
	const D=K.design;
	const left = el("div", "", cam);
	set(left, { position: "absolute", inset: "0", background: alpha(fg, 0.08), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: px(D.space(2)) });
	// The labels are the film's words or none: with none, the struck line and the wipe tell it.
	const bl = el("div", "mono", left, s.beforeLabel ?? "");
	D.apply(bl,"label");
	set(bl, { color: alpha(fg, 0.6) });
	set(bl,{maxWidth:px(W*.8),textAlign:"center"});D.truncateLine(bl);bl.title=s.beforeLabel??"";
	const bt = el("div", "bold", left, s.before);
	set(bt, { color: alpha(fg, 0.55), textDecoration: "line-through", textDecorationThickness: "0.06em", textAlign: "center" });
	D.fitSize(bt, W * 0.8, H * 0.3, "display");
	const right = el("div", "", cam);
	set(right, { position: "absolute", inset: "0", background: accent, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: px(D.space(2)) });
	const al = el("div", "mono", right, s.afterLabel ?? "");
	D.apply(al,"label");
	set(al, { color: alpha(textOn(accent), 0.7) });
	set(al,{maxWidth:px(W*.8),textAlign:"center"});D.truncateLine(al);al.title=s.afterLabel??"";
	const at = el("div", "display", right, s.after);
	set(at, { color: textOn(accent), textAlign: "center" });
	D.fitSize(at, W * 0.8, H * 0.34, "display");
	const handle = el("div", "", cam);
	set(handle, { position: "absolute", top: "0", bottom: "0", width: px(8 * S), background: "#ffffff", boxShadow: `0 0 ${px(30 * S)} rgba(0,0,0,0.25)` });
	const knob = el("div", "", handle);
	set(knob, { position: "absolute", top: "50%", left: "50%", width: px(84 * S), height: px(84 * S), marginLeft: px(-42 * S), marginTop: px(-42 * S), borderRadius: "50%", background: "#ffffff", boxShadow: `0 ${px(10 * S)} ${px(30 * S)} rgba(0,0,0,0.25)` });
	const cursor = makeCursor(cam, 72 * S);
	const from = p.dur * 0.3;
	const to = p.dur * 0.8;
	return (l) => {
		const k = cubicInOut(prog(l, from, to - from));
		const x = lerp(W * 0.94, -W * 0.02, k);
		set(right, { clipPath: `inset(0 0 0 ${px(Math.max(0, x))})` });
		set(left, { clipPath: `inset(0 ${px(Math.max(0,W-Math.max(0,x)))} 0 0)` });
		set(handle, { left: px(x - 4 * S), opacity: x > 0 ? "1" : "0" });
		cursor(l, { fx: x + 200 * S, fy: H / 2 + 200 * S, x: x + 10 * S, y: H / 2 + 10 * S, start: 0.05, arrive: from - 0.08, click: from - 0.02, ringColor: alpha("#ffffff", 0.9) });
		if (l > from) cursor(l, { fx: x + 10 * S, fy: H / 2 + 10 * S, x: x + 10 * S, y: H / 2 + 10 * S, start: from, arrive: from + 0.01, click: 1e9 });
		set(bt, { opacity: clamp(l / 0.15).toFixed(3) });
	};
};

