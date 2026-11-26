// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../../typing.mjs';
import {DOUBLE} from '../_shared/hands.mjs';
// ---- palette: a command bar that filters as you type ---------------------------------------------------
// A big search bar types the query; the results under it filter live as letters arrive, the selection
// slides to the match, Enter presses and the picked row opens. The camera starts close on the bar and
// settles back. Seen in Raycast's 2026 teaser.
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, lum, alpha, mixHex, textOn, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const light = lum(bg) > 0.45;
	const query = DOUBLE(s.query || "clipboard");
	const items = (s.results?.length ? s.results : [s.query || ""]).map(DOUBLE).slice(0, 6);
	const panelBg = light ? "#ffffff" : mixHex(bg, "#ffffff", 0.07);
	const ink = light ? "#141414" : "#f2f2f2";
	const mute = alpha(ink, 0.45);
	const pw = H >= W ? W * 0.9 : Math.min(W * 0.62, 1240 * S);
	const panelBox = D.box("card"), rowBox = D.box("field", { density: "compact" });
	const listGap = D.space(2);
	const barH = D.type("body").lineHeight * (H >= W ? 2 : 1) + D.space(4);
	const rowH = D.type("controlLabel").lineHeight * (vertical ? 2 : 1) + rowBox.paddingY * 2;
	const fs = barH * 0.42;
	const split = (t) => {
		const m = t.match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
		return m ? { icon: m[1], title: m[2] } : { icon: "", title: t };
	};
	const parsed = items.map(split);
	// Which rows match each prefix of the query; the pick is the first match of the full query.
	const matches = (n) => {
		const q = query.slice(0, n).toLowerCase();
		return parsed.map((r) => n < 2 || r.title.toLowerCase().includes(q) || r.title.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)));
	};
	const finalM = matches(query.length);
	let pick = typeof s.pick === "number" ? Math.min(items.length - 1, s.pick) : finalM.findIndex(Boolean);
	if (pick < 0) pick = 0;
	const listH = rowH * items.length + listGap * Math.max(0, items.length - 1);
	const totalH = barH + panelBox.gap * 2 + listH;
	const px0 = (W - pw) / 2;
	const py0 = (H - totalH) / 2;
	const world = el("div", "", cam);
	set(world, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), transformOrigin: "0 0", willChange: "transform" });
	const panel = el("div", "", world);
	set(panel, { position: "absolute", left: px(px0), top: px(py0), width: px(pw), height: px(totalH), background: panelBg, boxShadow: `0 ${px(40 * S)} ${px(100 * S)} ${alpha("#000000", light ? 0.16 : 0.5)}, 0 0 0 ${px(1.5 * S)} ${alpha(ink, 0.07)}`, overflow: "hidden" });
	D.surface(panel, "card", { layout: "frame", purpose: "window" });
	const bar = el("div", "", panel);
	set(bar, { position: "absolute", left: "0", top: "0", right: "0", height: px(barH), display: "flex", alignItems: "center", borderBottom: `${px(1.5 * S)} solid ${alpha(ink, 0.08)}`, color: ink });
	const queryBox = D.surface(bar, "field", { shape: "square" });
	D.apply(bar,"body");
	const mark = el("div", "", bar);
	set(mark, { width: px(barH * 0.42), height: px(barH * 0.42), borderRadius: px(barH * 0.12), background: accent, flex: "none" });
	const field = el("div", "", bar);
	set(field, { position: "relative", flex: "1", minWidth: "0", whiteSpace: "normal" });
	const caret = el("span", "", field);
	set(caret, { display: "inline-block", width: px(3 * S), height: px(fs * 1.1), background: accent, verticalAlign: "middle", marginLeft: px(2 * S) });
	const queryTyping = createTyping(K, field, { text: query, caret, id: "palette-query" });
	D.fitSize(field, pw - barH * .92 - queryBox.paddingX * 2 - queryBox.gap * 2, barH - queryBox.paddingY * 2, "body");
	queryTyping.measure();
	const enter = el("div", "", bar, "↵");
	set(enter, { flex: "none", width: px(barH * 0.5), height: px(barH * 0.5), borderRadius: px(D.radius(2)), border: `${px(1.5 * S)} solid ${alpha(ink, 0.15)}`, display: "flex", alignItems: "center", justifyContent: "center", color: mute });
	D.apply(enter,"button");
	const sel = el("div", "", panel);
	set(sel, { position: "absolute", left: px(panelBox.paddingX), right: px(panelBox.paddingX), height: px(rowH), borderRadius: px(D.radius(3)), background: alpha(accent, light ? 0.14 : 0.22), boxShadow: `inset 0 0 0 ${px(1.5 * S)} ${alpha(accent, 0.5)}` });
	// Selection is a painted state behind the result fields, not another field.
	set(sel, { borderRadius: px(D.box("field").radius) });
	const rows = parsed.map((r, k) => {
		const row = el("div", "", panel);
		set(row, { position: "absolute", left: px(panelBox.paddingX), right: px(panelBox.paddingX), height: px(rowH), display: "flex", alignItems: "center", color: ink });
		D.surface(row, "field", { density: "compact" });
		D.apply(row,"controlLabel");
		const ic = el("div", "", row, r.icon || r.title.charAt(0));
		set(ic, { width: px(rowH * 0.56), height: px(rowH * 0.56), borderRadius: px(rowH * 0.16), background: r.icon ? alpha(ink, 0.06) : [palette.coral, palette.sky, palette.lime, palette.butter, palette.lilac, accent][k % 6], display: "flex", alignItems: "center", justifyContent: "center", flex: "none", color: textOn(accent) });
		D.apply(ic,"initials");
		const title = el("div", "", row, r.title);
		set(title, { flex: "1", minWidth: "0" });
		D.apply(title, "controlLabel");
		D.truncateLine(title);title.title = r.title;
		// No kind beside a result: the kinds were the kit's own English.
		const kind = el("div", "", row, "");
		set(kind, { color: mute });
		D.apply(kind,"meta");
		return row;
	});
	// The detail card that opens from the picked row.
	let detailH = rowH * 2.7;
	const detail = el("div", "", world);
	set(detail, { position: "absolute", left: px(px0 + panelBox.paddingX), width: px(pw - panelBox.paddingX * 2), top: px(py0 + barH + panelBox.paddingY), minHeight: px(detailH), background: accent, color: textOn(accent), opacity: "0", boxShadow: `0 ${px(30 * S)} ${px(70 * S)} ${alpha(accent, 0.4)}` });
	D.surface(detail, "card");
	D.nest(detail, panel, { inset: panelBox.paddingX });
	set(detail, { display: "flex", flexDirection: "column" });
	D.apply(detail,"cardTitle");
	el("div", "", detail, `${parsed[pick].icon} ${parsed[pick].title}`.trim());
	for (const w of [0.7, 0.86, 0.5]) {
		const b = el("div", "", detail);
		set(b, { height: px(fs * 0.36), width: `${w * 100}%`, borderRadius: px(99), background: alpha(textOn(accent), 0.22) });
	}
	detailH = detail.offsetHeight;
	const t0 = 0.35;
	const cps = Math.max(9, query.length / Math.max(0.6, d0 * 0.32));
	const tTyped = t0 + query.length / cps;
	const tEnter = tTyped + 0.55;
	const zoom0 = vertical ? 1.5 : 1.85;
	return (l) => {
		const panelOpen = E.softLand(prog(l, tEnter + 0.05, 0.5));
		const n = Math.max(0, Math.min(query.length, Math.floor((l - t0) * cps)));
		queryTyping.reveal(n);
		set(caret, { opacity: l < tTyped ? "1" : K.blink(l - tTyped).toFixed(3) });
		// Rows: matching ones keep their place in order, the rest fold away.
		const m = matches(n);
		const mPrev = matches(Math.max(0, n - 1));
		const typeT = t0 + n / cps;
		const k = E.softInOut(prog(l, typeT, 0.18));
		let y = barH + panelBox.gap;
		const ys = [];
		rows.forEach((row, i) => {
			const v = (mPrev[i] ? 1 : 0) + ((m[i] ? 1 : 0) - (mPrev[i] ? 1 : 0)) * k;
			const a = E.softLand(prog(l, 0.1 + i * 0.05, 0.4));
			ys.push(y);
			set(row, { top: px(y), opacity: (clamp(a * 2) * v * (1 - panelOpen)).toFixed(3), transform: `translateY(${px((1 - a) * 18 * S)}) scale(${(0.96 + 0.04 * v).toFixed(4)})` });
			y += (rowH + listGap) * v;
		});
		const visIdx = m.findIndex(Boolean);
		const target = l >= tTyped - 0.1 ? pick : Math.max(0, visIdx);
		const sy = ys[target] ?? barH + panelBox.gap;
		set(sel, { top: px(sy), opacity: (E.softLand(prog(l, 0.4, 0.3)) * (m[target] || l < t0 + 0.2 ? 1 : 0.3) * (1 - panelOpen)).toFixed(3) });
		// Enter: the key flashes, the picked row opens into the detail card.
		const press = l >= tEnter - 0.03 && l < tEnter + 0.1 ? 1 : 0;
		set(enter, { background: press ? accent : "transparent", color: press ? textOn(accent) : mute, transform: `scale(${(1 - 0.08 * press).toFixed(3)})` });
		const op = E.softLand(prog(l, tEnter + 0.05, 0.5));
		// The panel fits what it shows: the matching rows, then the opened card.
		const rowsH = y - barH;
		const openH = panelBox.paddingY * 2 + detailH;
		const curH = barH + (rowsH - listGap + panelBox.gap) * (1 - op) + openH * op;
		set(panel, { height: px(curH) });
		set(detail, { opacity: clamp(op * 3).toFixed(3), transform: `translateY(${px((1 - op) * (sy - (barH + panelBox.paddingY)))}) scale(${(0.9 + 0.1 * op).toFixed(4)})`, transformOrigin: "50% 0" });
		// Camera: close on the bar while it types, then back to the whole palette.
		const back = E.softInOut(prog(l, t0, Math.max(.9, tTyped - t0)));
		// The camera ends framing the panel as it ends up, not the empty space round it.
		const Zend = Math.min(1.45, (W * 0.9) / pw, (H * 0.6) / (barH + openH));
		const Z = zoom0 + (Zend - zoom0) * back;
		const fx = px0 + pw * 0.3 + (W / 2 - (px0 + pw * 0.3)) * back;
		const fy = py0 + barH / 2 + (py0 + curH / 2 - (py0 + barH / 2)) * back;
		set(world, { transform: `translate(${px(W / 2 - fx * Z)}, ${px(H / 2 - fy * Z)}) scale(${Z.toFixed(4)})` });
	};
};
