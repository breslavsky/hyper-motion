// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../../typing.mjs';
const CHECK = '<svg viewBox="0 0 24 24" width="78%" height="78%"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>';

// ---- checklist: the cursor ticks each item -------------------------------------------------------
export const factory = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, spring, alpha, textOn, makeCursor, lerp } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const n = s.items.length;
	const column = W * 0.86;
	const probe = el("div", "", cam);
	set(probe, {position:"absolute",visibility:"hidden",whiteSpace:"nowrap"});
	const widthAt = (text, spec) => {
		D.apply(probe,spec.role,{step:spec.step});probe.textContent=text;
		return probe.offsetWidth;
	};
	const itemSpec = D.steps("caption").find(spec => Math.max(...s.items.map(t=>widthAt(t,spec)+spec.size*1.05*1.45)) <= column);
	let titleHeight = 0;
	const titleSpec = D.steps("sceneTitle").find(spec => {
		D.apply(probe, "sceneTitle", { step: spec.step });
		set(probe, { width: px(column), whiteSpace: "normal" });
		probe.textContent = s.title || "";
		titleHeight = probe.offsetHeight;
		return titleHeight <= H * 0.24;
	});
	set(probe, { width: "auto", whiteSpace: "nowrap" });
	if(!itemSpec || !titleSpec)throw new Error("Checklist copy exceeds semantic column capacity");
	const fs=itemSpec.size,titleFs=titleSpec.size;
	const rowH = fs * 2.1;
	let widest = Math.max(...s.items.map((t) => widthAt(t, itemSpec) + fs * 1.05 * 1.45), s.title ? Math.min(column, widthAt(s.title, titleSpec)) : 0);
	probe.remove();
	const blockH = (s.title ? titleHeight + D.space(4) : 0) + n * rowH;
	const top = (H - blockH) / 2;
	const left = Math.max(W * 0.06, (W - widest) / 2);
	let title = null, titleTyping = null;
	if (s.title) {
		title = el("div", "bold", cam);
		set(title, { position: "absolute", left: px(left), top: px(top), width: px(column), color: fg, whiteSpace: "normal" });
		D.apply(title,"sceneTitle",{step:titleSpec.step});
		titleTyping = createTyping(K, title, { text: s.title, id: "checklist-title" });
		titleTyping.measure();
	}
	const y0 = top + (s.title ? titleHeight + D.space(4) : 0);
	const box = fs * 1.05;
	const rows = s.items.map((text, i) => {
		const y = y0 + i * rowH;
		const b = el("div", "", cam);
		set(b, { position: "absolute", left: px(left), top: px(y + (rowH - box) / 2 - rowH * 0.15), width: px(box), height: px(box), boxSizing: "border-box", borderRadius: px(D.radius(2)), border: `${px(3 * S)} solid ${alpha(fg, 0.45)}`, display: "grid", placeItems: "center", color: textOn(accent) });
		b.innerHTML = CHECK;
		const path = b.querySelector("path");
		const t = el("div", "", cam);
		set(t, { position: "absolute", left: px(left + box * 1.45), top: px(y + (rowH - fs * 1.2) / 2 - rowH * 0.15), color: fg, whiteSpace: "nowrap" });
		D.apply(t,"caption",{step:itemSpec.step});
		const tx = el("span", "", t);
		const strike = el("div", "", t);
		set(strike, { position: "absolute", left: "0", top: "54%", height: px(3.5 * S), background: fg, transformOrigin: "0 50%", width: "100%" });
		tx.textContent = text;
		const tw = t.offsetWidth;
		set(tx, { display: "inline-block" });
		const typing = createTyping(K, tx, { text, id: `checklist-item-${i}` });
		typing.measure();
		return { b, path, t, typing, strike, text, tw, cx: left + box / 2, cy: y + rowH / 2 - rowH * 0.15 };
	});
	const cur = makeCursor(cam, 78 * S);
	const tick0 = Math.max(0.7, p.dur * 0.24);
	const tickGap = Math.max(0.3, (p.dur * 0.97 - tick0) / n);
	const ticks = rows.map((_, i) => tick0 + i * tickGap);
	return (l) => {
		if (title) {
			const k = Math.floor(clamp((l + 0.08) / 0.45) * s.title.length);
			titleTyping.reveal(k);
		}
		rows.forEach((r, i) => {
			const ta = 0.02 + i * 0.09;
			const k = expoOut(prog(l, ta, 0.5));
			const shownN = Math.floor(clamp((l - ta) / (0.018 * r.text.length + 0.1)) * r.text.length);
			r.typing.reveal(shownN);
			// The tick fills over a few frames and the box dips and springs back, rather than
			// switching colour and size in one frame.
			const fill = clamp((l - ticks[i]) / 0.08);
			const dip = Math.sin(Math.PI * clamp((l - ticks[i]) / 0.26));
			const intro = 0.7 + 0.3 * spring(l - ta, 3, 0.55);
			set(r.b, { opacity: k.toFixed(3), background: fill > 0 ? alpha(accent, fill) : "transparent", borderColor: fill > 0.5 ? accent : alpha(fg, 0.45), transform: `scale(${(intro * (1 - 0.16 * dip)).toFixed(4)})` });
			r.path.setAttribute("stroke-dashoffset", (1 - expoOut(prog(l, ticks[i] + 0.04, 0.35))).toFixed(4));
			const sk = expoOut(prog(l, ticks[i] + 0.1, 0.45));
			set(r.strike, { transform: `scaleX(${sk.toFixed(4)})`, opacity: (0.55 * clamp(sk * 6)).toFixed(3) });
			set(r.t, { opacity: (1 - 0.5 * sk).toFixed(3) });
		});
		// The list floats a little, so the gaps between ticks are never frozen.
		const fy = Math.sin(l * 1.7) * 7 * S;
		for (const r of rows) {
			r.b.style.translate = `0 ${px(fy)}`;
			r.t.style.translate = `0 ${px(fy)}`;
		}
		if (title) title.style.translate = `0 ${px(fy)}`;
		// Cursor hops from box to box.
		let k = ticks.findIndex((t) => l < t + 0.05);
		if (k < 0) k = n - 1;
		const target = rows[k];
		const prev = k > 0 ? rows[k - 1] : { cx: W * 0.85, cy: H * 0.9 };
		cur(l, { fx: prev.cx, fy: prev.cy, x: target.cx, y: target.cy, start: k > 0 ? ticks[k - 1] + 0.12 : tick0 - 0.75, arrive: ticks[k] - 0.08, click: ticks[k], ringColor: accent });
	};
};

