// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {typewriterTiming} from '../../typewriter-timing.mjs';
import {createTyping} from '../../typing.mjs';
/** Typed on a blank page with a human rhythm; can erase the end and type something else. */
export const factory = ({ p, cam, fg, accent, K }) => {
	const { W, H, el, set, px } = K;
	const s = p.scene;
	const schedule = typewriterTiming(s, p.dur);
	const { then, finalText, textUnits, times, typedEnd, eraseStart, eraseEnd, thenTimes, total, scale } = schedule;
	const wrap = el("div", "center", cam);
	const line = el("div", "bold", wrap);
	line.setAttribute("data-typewriter-line", "");
	set(line, { color: fg, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", width: px(W * 0.8), textAlign: "center" });
	// Both complete variants participate in sizing, in the same grid cell. Their
	// text nodes never change during a seek: neither wrapping nor kerning depends
	// on where the current key falls. Paint alone reveals the reserved glyphs.
	const build = (reference, phase) => {
		const layer = el("span", "", line);
		layer.dataset.typewriterLayout = phase;
		set(layer, { gridArea: "1 / 1", position: "relative", minWidth: "0", whiteSpace: "pre-wrap", alignSelf: "start" });
		const caret = el("span", "caret", layer);
		caret.dataset.typewriterPart = "caret";
		set(caret, { width: "0.06em", height: "1em", background: accent, marginLeft: "0.04em" });
		const typing = createTyping(K, layer, { text: reference, caret, unit: 'codepoint', id: `typewriter-${phase}` });
		for (const part of typing.parts) part.node.dataset.typewriterUnit = String(part.start);
		return { layer, typing, caret };
	};
	const layouts = s.erase ? [build(s.text, "original"), build(finalText, "final")] : [build(finalText, "final")];
	K.design.fitSize(line, W * 0.8, H * 0.3, 'display');
	for (const layout of layouts) layout.typing.measure();
	return (l) => {
		const lt = l / scale;
		const n = times.filter(x => x <= lt).length;
		let count = n;
		if (s.erase && lt > eraseStart) count = Math.max(0, textUnits.length - Math.min(s.erase, Math.floor((lt - eraseStart) / 0.03)));
		let lastAt = n > 0 ? times[n - 1] : 0;
		if (then && lt > eraseEnd) {
			const m = thenTimes.filter(x => x <= lt).length;
			count += m;
			if (m > 0) lastAt = thenTimes[m - 1];
		}
		const erasing = s.erase && lt > eraseStart && lt <= eraseEnd + 0.15;
		const k = erasing ? 1 : K.clamp((lt - lastAt) / 0.05);
		const phase = s.erase && lt <= eraseEnd ? "original" : "final";
		line.dataset.typewriterReference = phase;
		for (const layout of layouts) {
			const active = layout.layer.dataset.typewriterLayout === phase;
			set(layout.layer, { opacity: active ? "1" : "0" });
			layout.typing.reveal(count, { fresh: k });
			const idle = lt > total || (lt > typedEnd && lt < eraseStart);
			set(layout.caret, { opacity: active ? (idle ? K.blink(lt > total ? lt - total : lt - typedEnd).toFixed(3) : "1") : "0" });
		}
	};
};

