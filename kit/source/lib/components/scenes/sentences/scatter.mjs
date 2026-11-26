// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
// ---- scatter: a sentence spread over the frame, with things between the words ----------------------
// "To  [phone]  book  a  [pen]  job." The words sit loose across the frame in reading order, small,
// and objects drop into the gaps between them. Then everything leaves except the *key* word, which
// glides to the centre and grows. Seen in Abdullah's launch films for ClickUp and ElevenLabs.
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, alpha, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const light = lum(bg) > 0.45;
	const raw = String(s.text || "To *book* a job takes one tap.").split(/\s+/).filter(Boolean);
	const words = raw.map((w) => ({ t: w.replace(/\*/g, ""), key: /^\*.*\*[.,!?]?$/.test(w) }));
	if (!words.some((w) => w.key)) words[Math.min(1, words.length - 1)].key = true;
	const keyIdx = words.findIndex((w) => w.key);
	const icons = (s.icons?.length ? s.icons : ["📱", "✏️", "📅", "☕"]).slice(0, 5);
	const n = words.length;
	const flow = el("div", "", cam);
	set(flow, { position: "absolute", visibility: "hidden", width: px(K.safe.w * .9), display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `${px(D.space(3))} ${px(D.space(4))}` });
	const measured = words.map(w => el("span", "", flow, w.t));
	const fs = D.fitSize(flow, K.safe.w * .9, K.safe.h * .8, "sceneTitle");
	const textStep = Number(flow.dataset.designStep);
	const flowTop = (H - flow.offsetHeight) / 2;
	const flowLeft = (W - flow.offsetWidth) / 2;
	const nodes = words.map((w, k) => {
		const sp = measured[k];
		const nd = el("div", "display", cam, w.t);
		set(nd, { position: "absolute", left: "0", top: "0", whiteSpace: "pre", color: w.key ? accent : fg, willChange: "transform" });
		D.apply(nd, "sceneTitle", { step: textStep });
		if (w.key && K.plan?.look?.display?.accent === "serif") nd.style.fontStyle = "italic";
		return { nd, x: flowLeft + sp.offsetLeft, y: flowTop + sp.offsetTop, w: sp.offsetWidth, key: w.key };
	});
	flow.remove();
	// Objects in the gaps between consecutive words, spread through the sentence.
	const gaps = [];
	for (let i = 0; i < icons.length; i++) gaps.push(Math.min(n - 2, Math.floor(((i + 0.5) / icons.length) * (n - 1))));
	const tileS = fs * 1.35;
	const placed = [];
	const hits = (x, y) =>
		nodes.some((nd) => x + tileS * 0.6 > nd.x && x - tileS * 0.6 < nd.x + nd.w && y + tileS * 0.6 > nd.y - fs * 0.1 && y - tileS * 0.6 < nd.y + fs * 1.1) ||
		placed.some((q) => Math.hypot(q.x - x, q.y - y) < tileS * 1.3);
	const objs = icons.map((ic, i) => {
		const a = nodes[gaps[i]];
		const b = nodes[gaps[i] + 1] ?? a;
		const mx = (a.x + a.w + b.x) / 2;
		const my = (a.y + b.y) / 2 + fs / 2;
		let x = mx;
		let y = my;
		const flip = hash(i * 4.4) > 0.5 ? 1 : -1;
		for (const [ox, oy] of [[0, 0], [0, 1.3 * flip], [0, -1.3 * flip], [1.4, 0], [-1.4, 0], [0, 2.1 * flip], [0, -2.1 * flip], [1.6, 1.4], [-1.6, -1.4]]) {
			const cx = clamp(mx + ox * fs, W * 0.06 + tileS / 2, W * 0.94 - tileS / 2);
			const cy = clamp(my + oy * fs, H * 0.08 + tileS / 2, H * 0.92 - tileS / 2);
			if (!hits(cx, cy)) {
				x = cx;
				y = cy;
				break;
			}
		}
		placed.push({ x, y });
		const o = el("div", "", cam);
		set(o, { position: "absolute", left: "0", top: "0", width: px(tileS), height: px(tileS), borderRadius: px(tileS * 0.28), background: light ? "#ffffff" : "#1c1f27", boxShadow: `0 ${px(tileS * 0.12)} ${px(tileS * 0.35)} ${alpha("#000000", light ? 0.14 : 0.45)}`, display: "flex", alignItems: "center", justifyContent: "center", willChange: "transform" });
		D.forSurface(tileS/(D.unit*48)).apply(o,"cardTitle");
		o.textContent = ic;
		return { o, x, y, rot: (hash(i * 2.9) - 0.5) * 36, after: gaps[i] };
	});
	const stag = Math.min(0.16, 1.6 / Math.max(1, n));
	const tWord = (k) => 0.1 + k * stag;
	const tGather = Math.max(tWord(n - 1) + 0.7, p.dur * 0.55);
	const key = nodes[keyIdx];
	const bigFs = Math.min((vertical ? 210 : 240) * S, (W * 0.8 * fs) / Math.max(1, key.w));
	const kScale = bigFs / fs;

	return (l) => {
		const gone = E.accelExit(prog(l, tGather, 0.38));
		nodes.forEach((nd, k) => {
			const a = E.softLand(prog(l, tWord(k), 0.45));
			if (nd.key) {
				const g = E.softInOut(prog(l, tGather + 0.1, 0.7));
				const cx = nd.x + nd.w / 2;
				const x = cx + (W / 2 - cx) * g;
				const y = nd.y + fs / 2 + (H / 2 - nd.y - fs / 2) * g;
				const sc = (1.5 - 0.5 * a) * (1 + (kScale - 1) * g);
				set(nd.nd, { opacity: clamp(a * 4).toFixed(3), transform: `translate(${px(x - nd.w / 2)}, ${px(y - fs / 2)}) scale(${sc.toFixed(4)})`, transformOrigin: "50% 50%" });
			} else {
				// Leave outward from the centre, accelerating.
				const dx = nd.x + nd.w / 2 - W / 2;
				const dy = nd.y - H / 2;
				set(nd.nd, { opacity: (clamp(a * 4) * (1 - clamp((gone - 0.6) / 0.4))).toFixed(3), transform: `translate(${px(nd.x + dx * gone * 0.9)}, ${px(nd.y + (1 - a) * fs * 0.6 + dy * gone * 0.9)}) scale(${(1.5 - 0.5 * a).toFixed(4)})` });
			}
		});
		objs.forEach((ob, i) => {
			const a = E.softLand(prog(l, tWord(ob.after) + stag * 0.5, 0.5));
			const bob = Math.sin(l * 2.2 + i * 1.3) * fs * 0.06;
			const dx = ob.x - W / 2;
			const dy = ob.y - H / 2;
			set(ob.o, { opacity: (clamp(a * 4) * (1 - clamp((gone - 0.6) / 0.4))).toFixed(3), transform: `translate(${px(ob.x - tileS / 2 + dx * gone)}, ${px(ob.y - tileS / 2 + bob - (1 - a) * fs * 1.2 + dy * gone)}) rotate(${(ob.rot * (1 - a) + ob.rot * 0.25).toFixed(2)}deg) scale(${(1.4 - 0.4 * a).toFixed(4)})` });
		});
	};
};
