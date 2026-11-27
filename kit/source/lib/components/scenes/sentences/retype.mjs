// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../../typing.mjs';
// ---- retype: a value selected and typed over ---------------------------------------------------
export const factory = ({ p, cam, fg, accent, palette, K }) => {
	const { W, H, S, el, set, px, spring, clamp, prog, expoOut, alpha } = K;
	const D = K.design;
	const s = p.scene;
	const seq = [s.from, ...s.to];
	const blue = palette.electric ?? "#2f6bff";
	const wrap = el("div", "center", cam);
	let label = null;
	if (s.label) {
		label = el("div", "mono", wrap, s.label);
		set(label, { color: fg, opacity: "0.8", marginBottom: px(D.space(3)), maxWidth: px(K.safe.w * .9) });
		D.apply(label, "label");
		D.truncateLine(label);label.title = s.label;
	}
	const big = el("div", "", wrap);
	set(big, { color: fg, fontFeatureSettings: '"tnum" 1', whiteSpace: "nowrap", position: "relative", display: "grid", paddingRight: "0.12em" });
	const values = seq.map((text, i) => {
		const layer = el("div", "", big);
		set(layer, { gridArea: "1 / 1", whiteSpace: "pre", opacity: "0", textAlign: "left" });
		return createTyping(K, layer, { text, id: `retype-value-${i}` });
	});
	D.fitLine(big, W * (H > W * 1.2 ? 0.74 : 0.7), H * (s.label ? 0.3 : 0.38), "hero");
	// All complete variants share one measured grid footprint. The widest
	// rendered value determines the field, independently of character count.
	set(big, { width: px(big.offsetWidth), height: px(big.offsetHeight), boxSizing: "border-box", textAlign: "left" });
	for (const value of values) {
		value.measure();
		for (const part of value.parts) set(part.node, { position: "relative" });
	}
	// Selection and caret are drawn over the text, so both can move continuously.
	const sel = el("div", "", big);
	set(sel, { position: "absolute", top: "0.08em", height: "0.96em", background: alpha(blue, 0.28), borderRadius: "0.04em", pointerEvents: "none" });
	// The selected word, kept for a few frames after the first new key so it fades out with its
	// highlight instead of vanishing in one frame.
	const ghost = el("div", "", big);
	set(ghost, { position: "absolute", left: "0", top: "0", whiteSpace: "pre", pointerEvents: "none", transformOrigin: "0 50%" });
	const ghostSel = el("div", "", ghost);
	set(ghostSel, { position: "absolute", left: "0", right: "0", top: "0.08em", height: "0.96em", background: alpha(blue, 0.28), borderRadius: "0.04em" });
	const ghostTxt = el("span", "", ghost);
	const caret = el("div", "", big);
	set(caret, { position: "absolute", top: "0.14em", width: "0.04em", height: "0.8em", background: blue, borderRadius: "0.02em" });
	const fsPx = Number.parseFloat(big.style.fontSize) || 100;
	// Plan the edits: type the first value, then for each next value select it all and type over.
	// When each begins and how far apart the keys fall is the scene's moments (scene-moments.cjs).
	const CH = p.at.key;
	const steps = [];
	steps.push({ kind: "type", text: seq[0], index: 0, at: p.at.start, dur: seq[0].length * CH });
	for (let i = 1; i < seq.length; i++) {
		steps.push({ kind: "select", from: seq[i - 1], index: i - 1, at: p.at.selects[i - 1], dur: 0.28 });
		steps.push({ kind: "type", text: seq[i], index: i, at: p.at.types[i - 1], dur: seq[i].length * CH, n: i, prev: seq[i - 1] });
	}
	const txt = (n, v) => {
		if (n.textContent !== v) n.textContent = v;
	};
	return (l, d) => {
		let valueIndex = 0;
		let completed = 0;
		let partK = 0;
		let selN = 0;
		let typing = false;
		let pop = 0;
		let gone = null;
		let goneK = 1;
		let idleFrom = 0;
		for (const st of steps) {
			if (l < st.at) break;
			valueIndex = st.index;
			const k = clamp((l - st.at) / st.dur);
			if (st.kind === "type") {
				const n = k * st.text.length;
				completed = Math.floor(n);
				partK = n - Math.floor(n);
				selN = 0;
				typing = k < 1;
				idleFrom = st.at + st.dur;
				if (st.prev) {
					gone = st.prev;
					goneK = clamp((l - st.at) / 0.1);
				}
				if (k >= 1 && st.n) pop = Math.max(pop, 1 - expoOut(prog(l, st.at + st.dur, 0.5)));
			} else {
				completed = st.from.length;
				partK = 0;
				// Shift-selects from the end back to the start, sweeping smoothly.
				selN = expoOut(k);
				typing = false;
				gone = null;
			}
		}
		const value = values[valueIndex];
		const hasFresh = typing && partK > 0;
		const shownCount = completed + (hasFresh ? 1 : 0);
		for (const [i, candidate] of values.entries()) {
			set(candidate.host, { opacity: i === valueIndex ? "1" : "0" });
			candidate.reveal(i === valueIndex ? shownCount : 0, { fresh: hasFresh ? clamp(partK * 1.6) : 1 });
			for (const part of candidate.parts) set(part.node, { top: "0" });
		}
		if (hasFresh) {
			const part = value.parts.find(part => part.end === shownCount);
			if (part) set(part.node, { top: `${((1 - partK) * 0.12).toFixed(4)}em` });
		}
		const textW = value.caretAt(completed).x;
		const nextX = value.caretAt(shownCount).x;
		const grow = hasFresh ? K.cubicInOut(clamp(partK * 1.4)) : 1;
		const end = textW + (nextX - textW) * grow;
		if (selN > 0) set(sel, { display: "block", left: px(textW * (1 - selN)), width: px(textW * selN) });
		else set(sel, { display: "none" });
		const caretX = selN > 0 ? textW * (1 - selN) : end;
		set(caret, { left: px(caretX + fsPx * 0.05), opacity: typing || selN > 0 ? "1" : K.blink(l - idleFrom).toFixed(3) });
		if (gone && goneK < 1) {
			txt(ghostTxt, gone);
			set(ghost, { display: "block", opacity: (1 - goneK).toFixed(3), transform: `translateY(${(-0.08 * goneK).toFixed(4)}em) scale(${(1 - 0.04 * goneK).toFixed(4)})` });
		} else set(ghost, { display: "none" });
		const intro = spring(l, 2.6, 0.7);
		// A slow, constant grow and sway under the edits, so the pauses between them never freeze.
		set(big, { transform: `translate(${(Math.sin(l * 0.9) * 0.03).toFixed(4)}em, ${(Math.sin(l * 1.6) * 0.035).toFixed(4)}em) rotate(${(Math.sin(l * 0.7) * 0.6).toFixed(3)}deg) scale(${((1 + pop * 0.06) * (0.94 + 0.14 * (l / d))).toFixed(4)})` });
		if (label) set(label, { opacity: (0.8 * clamp(l / 0.25)).toFixed(3), transform: `translateY(${px((1 - intro) * 14 * S)})` });
	};
};

