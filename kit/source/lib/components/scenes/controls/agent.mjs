// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE} from '../_shared/ground.mjs';
// ---- agent: the product working through a job --------------------------------------------------------
// "Meridian working…": a spinner and a status line; tasks arrive one under another, each spinning
// until it checks off; then the header turns into the result ("Financial statements ready.") and a
// result card slides up. Seen in Marleen Swift's Meridian film and the Grok Build films.
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, lum, alpha, mixHex, textOn, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const light = lum(bg) > 0.45;
	const name = DOUBLE(s.name || K.plan.brand?.name || "Agent");
	const steps = (s.steps?.length ? s.steps : ["Reading your brief", "Picking the scenes", "Timing every cut"]).map(DOUBLE).slice(0, 5);
	const done = DOUBLE(s.done || "Done.");
	const result = s.result ? DOUBLE(s.result) : "";
	const colW = vertical ? W * 0.88 : Math.min(W * 0.88, 1260 * S);
	const x0 = (W - colW) / 2;
	const fs = D.type("body").size;
	let rowH = D.type("body").lineHeight + D.space(4);
	const headFs = D.type("cardTitle").size;
	let blockH = headFs * 2.2 + steps.length * rowH + (result ? rowH * 2.6 : 0);
	let y0 = (H - blockH) / 2;
	const mute = alpha(fg, 0.5);
	// Everything rides one group that glides up as rows arrive, so what is showing stays centred.
	const grp = el("div", "", cam);
	set(grp, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), willChange: "transform" });
	// Header: spinner + "Name working…", later a check + the done line.
	const head = el("div", "", grp);
	set(head, { position: "absolute", left: px(x0), top: px(y0), width: px(colW), height: px(headFs * 1.4), display: "flex", alignItems: "center", gap: px(D.space(2)), color: fg, willChange: "transform" });
	D.apply(head,"cardTitle");
	const ring = el("div", "", head);
	const rs = headFs * 1.05;
	set(ring, { width: px(rs), height: px(rs), borderRadius: "50%", boxSizing: "border-box", border: `${px(4 * S)} solid ${alpha(accent, 0.25)}`, borderTopColor: accent, flex: "none" });
	const headTxt = el("div", "", head);
	set(headTxt, { display: "flex", alignItems: "center", flex: "1", minWidth: "0" });
	// The name and the dots that run after it say "working" in every language.
	const work = el("span", "", headTxt, name);
	// Leave room for the font's ascenders/descenders inside the horizontal clip.
	set(work, { display: "block", minWidth: "0", paddingBlock: px(D.space(1)) });
	D.truncateLine(work);work.title = name;
	const dots = el("span", "", headTxt, "");
	set(dots, { display: "inline-block", width: "1.4em", flex: "none" });
	const doneTxt = el("div", "bold", head, done);
	set(doneTxt, { position: "absolute", left: px(rs + 18 * S), top: "50%", transform: "translateY(-50%)", color: accent, opacity: "0", width: px(colW - rs - D.space(2)), whiteSpace: "normal" });
	D.apply(doneTxt, "caption");
	D.truncateLine(doneTxt);doneTxt.title = done;
	const headCheck = el("div", "", head);
	set(headCheck, { position: "absolute", left: "0", top: "50%", width: px(rs), height: px(rs), marginTop: px(-rs / 2), borderRadius: "50%", background: accent, opacity: "0", display: "flex", alignItems: "center", justifyContent: "center" });
	headCheck.innerHTML = `<svg viewBox="0 0 24 24" width="62%" height="62%"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="${textOn(accent)}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
	// Task rows.
	const rows = steps.map((t, k) => {
		const r = el("div", "", grp);
		set(r, { position: "absolute", left: px(x0), top: px(y0 + headFs * 2.2 + k * rowH), width: px(colW), height: px(rowH * 0.82), background: light ? "#ffffff" : mixHex(bg, "#ffffff", 0.07), boxShadow: `0 ${px(10 * S)} ${px(30 * S)} ${alpha("#000000", light ? 0.08 : 0.3)}, 0 0 0 ${px(1.5 * S)} ${alpha(fg, 0.06)}`, display: "flex", alignItems: "center", color: fg, willChange: "transform" });
		D.surface(r, "field", { density: "compact" });
		D.apply(r,"body");
		const ic = el("div", "", r);
		const is = fs * 0.9;
		set(ic, { position: "relative", width: px(is), height: px(is), flex: "none" });
		const sp = el("div", "", ic);
		set(sp, { position: "absolute", inset: "0", borderRadius: "50%", boxSizing: "border-box", border: `${px(4 * S)} solid ${alpha(fg, 0.15)}`, borderTopColor: fg });
		const ck = el("div", "", ic);
		set(ck, { position: "absolute", inset: "0", borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", opacity: "0" });
		ck.innerHTML = `<svg viewBox="0 0 24 24" width="64%" height="64%"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="${textOn(accent)}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="24" stroke-dashoffset="24"/></svg>`;
		const lab = el("div", "", r, t);
		set(lab, { flex: "1", minWidth: "0", whiteSpace: "normal" });
		D.apply(lab, "body", { step: 2 });
		D.truncateLine(lab);lab.title = t;
		return { r, sp, ck, path: ck.querySelector("path"), lab };
	});
	// The result card.
	let card = null;
	if (result) {
		card = el("div", "", grp);
		set(card, { position: "absolute", left: px(x0), top: px(y0 + headFs * 2.2 + steps.length * rowH + rowH * 0.25), width: px(colW), background: accent, color: textOn(accent), boxShadow: `0 ${px(24 * S)} ${px(60 * S)} ${alpha(accent, 0.4)}`, opacity: "0", willChange: "transform" });
		D.surface(card, "card", { density: "compact" });
		set(card, { display: "flex", flexDirection: "column" });
		D.apply(card, "cardTitle", { step: 5 });
		el("div", "", card, result);
		for (const w of [0.82, 0.6]) {
			const bar = el("div", "", card);
			set(bar, { height: px(fs * 0.32), width: `${w * 100}%`, borderRadius: px(99), background: alpha(textOn(accent), 0.22) });
		}
	}
	const headerHeight = Math.max(head.offsetHeight, doneTxt.offsetHeight, headTxt.offsetHeight);
	rowH = Math.max(...rows.map(r => Math.max(r.lab.offsetHeight, fs * .9) + D.box("field", { density: "compact" }).paddingY * 2 + D.space(2)));
	const headerBlock = headerHeight + D.space(3);
	const resultBlock = card ? card.offsetHeight + D.space(3) : 0;
	blockH = headerBlock + Math.max(steps.length * rowH, resultBlock);
	y0 = (H - blockH) / 2;
	set(head, { top: px(y0), height: px(headerHeight) });
	rows.forEach((r, i) => set(r.r, { top: px(y0 + headerBlock + i * rowH), height: px(rowH - D.space(2)) }));
	if (card) set(card, { top: px(y0 + headerBlock + D.space(3)) });
	// A step begins as the one before is ticked off, and each tick stands on the film's beats (`p.at`).
	const startT = (k) => p.at.start[k];
	const doneT = (k) => p.at.done[k];
	const tAll = p.at.all;
	return (l) => {
		const resultReveal = card ? E.softInOut(prog(l, tAll + .2, .55)) : 0;
		const ha = E.softLand(prog(l, 0, 0.45));
		set(head, { opacity: clamp(ha * 3).toFixed(3), transform: `translateY(${px((1 - ha) * 20 * S)})` });
		const finished = l >= tAll;
		set(ring, { transform: `rotate(${(l * 420).toFixed(1)}deg)`, opacity: finished ? "0" : "1" });
		dots.textContent = finished ? "" : ".".repeat(1 + (Math.floor(l * 3) % 3));
		const fk = E.softLand(prog(l, tAll, 0.4));
		set(work, { opacity: (1 - clamp(fk * 2)).toFixed(3) });
		set(doneTxt, { opacity: fk.toFixed(3), transform: `translateY(calc(-50% + ${px((1 - fk) * 16 * S)}))` });
		set(headCheck, { opacity: clamp(fk * 2).toFixed(3), transform: `scale(${(finished ? E.popOver(clamp((l - tAll) / 0.4)) : 0.6).toFixed(4)})` });
		rows.forEach((R, k) => {
			const a = E.softLand(prog(l, startT(k) - 0.12, 0.42));
			const isDone = l >= doneT(k);
			set(R.r, { opacity: (clamp(a * 3) * (1 - resultReveal)).toFixed(3), transform: `translateY(${px((1 - a) * rowH * 0.6)}) scale(${(1.04 - 0.04 * a).toFixed(4)})` });
			set(R.sp, { transform: `rotate(${(l * 480 + k * 40).toFixed(1)}deg)`, opacity: isDone ? "0" : "1" });
			const ck = isDone ? E.popOver(clamp((l - doneT(k)) / 0.35)) : 0;
			set(R.ck, { opacity: clamp(ck * 3).toFixed(3), transform: `scale(${Math.max(0.01, ck).toFixed(4)})` });
			R.path.setAttribute("stroke-dashoffset", (24 * (1 - E.softLand(prog(l, doneT(k) + 0.05, 0.3)))).toFixed(2));
			set(R.lab, { color: isDone ? mute : fg });
		});
		if (card) {
			const ck = E.softLand(prog(l, tAll + 0.2, 0.55));
			set(card, { opacity: clamp(ck * 3).toFixed(3), transform: `translateY(${px((1 - ck) * 60 * S)}) scale(${(1.05 - 0.05 * ck).toFixed(4)})` });
		}
		const shownRows = rows.reduce((n, _, k) => n + E.softInOut(prog(l, startT(k) - 0.12, 0.5)), 0);
		const visible = headerBlock + shownRows * rowH * (1 - resultReveal) + resultBlock * resultReveal;
		set(grp, { transform: `translateY(${px((blockH - visible) / 2)})` });
	};
};
