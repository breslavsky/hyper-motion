// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function createUi({ maths, dom }) {
const { lerp, prog, expoOut, hash, lum, textOn, alpha } = maths;
	const { el, set, px } = dom;

	const CURSOR_SVG =
		'<svg viewBox="0 0 28 38" width="100%" height="100%"><path d="M3 2.5 L3 30.5 L10 24 L15 35 L20 32.8 L15.2 22.2 L25 22.2 Z" fill="#fff" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/></svg>';

	/**
	 * A cursor of `size` px in `parent`, with an optional click ring. Returns the cursor at the
	 * scene's time `l`: it moves along an arc from (fx, fy) to (x, y) between `start` and
	 * `arrive`, presses at `click`, and the ring spreads from the point it pressed.
	 */
	const makeCursor = (parent, size, { clickRing = true } = {}) => {
		const cursor = el("div", "cursor", parent);
		cursor.innerHTML = CURSOR_SVG;
		set(cursor, { width: px(size * 0.74), height: px(size) });
		const ring = clickRing ? el("div", "ring", parent) : null;
		if (ring) set(ring, { borderWidth: px(size * 0.06), borderColor: "rgba(255,255,255,0.95)" });
		return (l, { fx, fy, x, y, start, arrive, click, ringColor }) => {
			const p = expoOut(prog(l, start, arrive - start));
			const cx = lerp(fx, x, p) + Math.sin(p * Math.PI) * size * 0.6;
			const cy = lerp(fy, y, p);
			const press = l >= click ? 1 - expoOut(prog(l, click, 0.25)) : 0;
			const down = l >= click - 0.06 && l < click + 0.12 ? 1 : press;
			set(cursor, {
				opacity: l >= start ? "1" : "0",
				transform: `translate(${px(cx - size * 0.08)}, ${px(cy - size * 0.06)}) scale(${(1 - 0.16 * down).toFixed(3)})`,
			});
			if (!ring) return;
			const spread = prog(l, click, 0.55);
			set(ring, {
				opacity: l >= click && spread < 1 ? (1 - spread).toFixed(3) : "0",
				left: px(x),
				top: px(y),
				width: px(size * (0.4 + expoOut(spread) * 2.6)),
				height: px(size * (0.4 + expoOut(spread) * 2.6)),
				borderColor: ringColor ?? "rgba(255,255,255,0.95)",
			});
		};
	};

	/** What a drawn screen shows when the film says nothing of the product's own: plausible, never grey bars. */
	// A screen with no words of its own: where the film gives none (`app` of film.json: the
	// product's real menu, title, figures and rows), a part is drawn as a grey bar, the way an
	// interface is sketched. Kinetic's had a menu, people and figures made up, in English, on
	// a film about somebody's real product.
	const SCREEN = {
		kind: "dashboard",
		nav: [null, null, null, null, null],
		title: null,
		stats: [[null, null], [null, null], [null, null]],
		rows: [[null, null], [null, null], [null, null], [null, null]],
		status: [null, null, null, null],
		cta: null,
	};
	const STATUS_COLOURS = ["#16a34a", "#d97706", "#2563eb", "#7c3aed"];

	/**
	 * A believable screen of the product, sized to `parent` (a phone gets a phone's screen): the
	 * brand's mark and name, a sidebar of real labels, a header with a search and a button, then
	 * by `kind` stat cards with a list and a chart (dashboard), a list (inbox), a thread (chat) or
	 * a page (editor). Light or dark by the look's paper. `film` is { W, H, brand, app, ui }: the
	 * film's size and brand, its `app` block and the scene's own `ui`, which say the texts.
	 */
	const mockUI = (parent, palette, sceneAccent, seed, kindOverride, film) => {
		const ui = { ...SCREEN, ...(film.app ?? {}), ...(film.ui ?? {}) };
		// A real product keeps one brand colour on every screen, whatever the scene's accent is.
		const accent = palette.brand ?? sceneAccent;
		const dark = lum(palette.paper) < 0.2;
		const T = dark
			? { bg: "#0d0f15", side: "#0a0c11", card: "#141720", line: "rgba(255,255,255,0.07)", text: "#eef0f6", mute: "#878ea0", soft: "rgba(255,255,255,0.05)" }
			: { bg: "#ffffff", side: "#f6f7f9", card: "#ffffff", line: "rgba(12,14,22,0.08)", text: "#0d0f14", mute: "#6b7180", soft: "rgba(12,14,22,0.035)" };
		const brandColour = palette.brand ?? accent;
		const pw = parent.offsetWidth || film.W * 0.6;
		const ph = parent.offsetHeight || film.H * 0.6;
		const narrow = pw / Math.max(1, ph) < 0.8;
		// A phone's screen has phone-sized type, not a shrunken desktop's.
		const unit = narrow ? pw / 400 : pw / 1150;
		const f = (n) => px(n * unit);
		const D=film.design.forSurface(unit/film.design.unit);
		const space=step=>px(D.space(step)),radius=step=>px(D.radius(step));
		const kind = kindOverride ?? ui.kind ?? "dashboard";

		const screen = el("div", "mock", parent);
		set(screen, { display: "grid", gridTemplateColumns: narrow ? "1fr" : "21% 1fr", background: T.bg, color: T.text, textAlign: "left" });

		D.apply(screen,"body");

		const card = (into, extra = {}, density = "normal") => {
			const c = el("div", "", into);
			set(c, { display:"flex", flexDirection:"column", minWidth:"0", background: T.card, border: `1px solid ${T.line}`, boxShadow: dark ? "none" : `0 ${f(2)} ${f(10)} rgba(12,14,22,0.05)`, ...extra });
			D.surface(c,"card",{density});
			return c;
		};
		const pill = (into, text, i) => {
			const colour = STATUS_COLOURS[i % STATUS_COLOURS.length];
			const b = el("span", "", into);
			const label=word(b, text, 2.4);
			D.apply(b,"label");
			set(b, { flex: "0 1 auto", minWidth:"0", maxWidth:"32%", color: colour, background: alpha(colour, dark ? 0.18 : 0.11) });
			D.surface(b,"badge",{density:"compact",shape:"pill"});
			if(text){set(label,{display:"block"});D.truncateLine(label);label.title=text;}
			return b;
		};
		const initials = (name) => (name ? name.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase() : "");
		/** A text of the film's, or a bar `ems` wide in its place: an inline element either way. */
		const word = (into, text, ems = 4) => {
			if (text) return el("span", "", into, text);
			const bar = el("span", "", into);
			set(bar, { display: "inline-block", width: `${ems}em`, maxWidth: "100%", height: "0.62em", borderRadius: "0.31em", background: "currentColor", opacity: "0.2", verticalAlign: "middle" });
			return bar;
		};

		if (!narrow) {
			const side = el("div", "", screen);
			set(side, { background: T.side, borderRight: `1px solid ${T.line}`, padding: `${space(5)} ${space(4)}`, display: "flex", flexDirection: "column", gap: space(1), minWidth:"0" });
			const logo = el("div", "", side);
			set(logo, { display: "flex", alignItems: "center", gap: space(2), marginBottom: space(4), padding: `0 ${space(1)}`, whiteSpace: "nowrap", overflow: "hidden" });
			D.apply(logo,"name");
			const mark = el("span", "", logo, (film.brand?.name ?? "K").trim().charAt(0).toUpperCase());
			set(mark, { flex: "none", width: f(28), height: f(28), borderRadius: radius(4), background: brandColour, color: textOn(brandColour), display: "grid", placeItems: "center",  });
			D.apply(mark,"initials");
			const brand=el("span", "", logo, film.brand?.name ?? "");
			set(brand,{display:"block",flex:"1"});D.truncateLine(brand);brand.title=film.brand?.name??"";
			ui.nav.forEach((label, i) => {
				const item = el("div", "", side);
				set(item, { display: "flex", alignItems: "center", gap: space(2), padding: `${space(2)} ${space(2)}`, borderRadius: radius(3), color: i === 0 ? T.text : T.mute, background: i === 0 ? alpha(accent, dark ? 0.16 : 0.1) : "transparent", whiteSpace: "nowrap" });
				const icon = el("span", "", item);
				set(icon, { flex: "none", width: f(15), height: f(15), borderRadius: radius(2), border: `${f(2)} solid ${i === 0 ? accent : T.mute}`, opacity: i === 0 ? "1" : "0.6" });
				D.apply(item,"controlLabel");
				const name=word(item, label, 3.4 + (i % 3) * 0.9);
				if(label){set(name,{display:"block",flex:"1"});D.truncateLine(name);name.title=label;}
			});
		}

		const main = el("div", "", screen);
		set(main, { padding: narrow ? `${space(5)} ${space(4)}` : `${space(5)} ${space(5)}`, display: "flex", flexDirection: "column", gap: space(4), minWidth: "0", overflow: "hidden" });
		const head = el("div", "", main);
		set(head, { display: "flex", alignItems: "center", gap: space(3) });
		D.surfaceGap(head,3);
		const title = el("div", "", head);
		word(title, ui.title, 5.5);
		D.apply(title,"cardTitle");
		set(title, { flex: "1",minWidth:"0" });
		if(ui.title){D.truncateLine(title);title.title=ui.title;}
		if (!narrow) {
			const search = el("div", "", head, "\u00a0");
			D.apply(search,"controlLabel");
			set(search, { width: f(200), border: `1px solid ${T.line}`, color: T.mute, background: T.soft });
			D.surface(search,"field",{density:"compact"});
		}
		const button = el("div", "", head);
		button.dataset.designControl="button";button.dataset.designControlLayout="flow";
		const buttonLabel=word(button, ui.cta, 2.6);
		D.apply(button,"button");
		const control=D.control("button");
		set(button, { padding: `${px(control.paddingY)} ${px(control.paddingX)}`, borderRadius: px(control.radius), minHeight:px(control.height), boxSizing:"border-box", minWidth:"0", maxWidth:"40%", background: accent, color: textOn(accent), whiteSpace: "nowrap", boxShadow: `0 ${f(4)} ${f(14)} ${alpha(accent, 0.35)}` });
		if(ui.cta){set(buttonLabel,{display:"block"});D.truncateLine(buttonLabel);buttonLabel.title=ui.cta;}

		if (kind === "dashboard") {
			const stats = el("div", "", main);
			const shown = ui.stats.slice(0, narrow ? 2 : 3);
			// A narrow screen still has room for two compact stat cards. Keeping
			// them side by side reserves enough vertical space for the complete list.
			set(stats, { display: "grid", gridTemplateColumns: `repeat(${shown.length}, 1fr)`, gap: space(3) });
			D.surfaceGap(stats,3);
			shown.forEach(([label, value], i) => {
				const c = card(stats);
				const name = el("div", "", c);
				word(name, label, 5 + i);
				D.apply(name,"label");
				set(name, { color: T.mute });
				if(label){D.truncateLine(name);name.title=label;}
				const row = el("div", "", c);
				set(row, { display: "flex", alignItems: "baseline", gap: space(2) });
				const number = el("div", "", row);
				word(number, value, 2.4);
				D.apply(number,"metric");
				// A rise beside the figure is an arrow: a percentage nobody measured is not shown.
				const change = el("span", "", row, "▲");
				D.apply(change,"label");
				set(change, { color: "#16a34a" });
			});
		}

		const bottom = el("div", "", main);
		set(bottom, { display: "grid", gridTemplateColumns: narrow || kind !== "dashboard" ? "1fr" : "1.45fr 1fr", gap: space(3), flex: "1", minHeight: "0" });
		D.surfaceGap(bottom,3);
		if (kind === "chat") {
			const thread = card(bottom, { display: "flex", flexDirection: "column" });
			ui.rows.slice(0, 4).forEach(([name, text], i) => {
				const mine = i % 2 === 1;
				const bubble = el("div", "", thread);
				word(bubble, text, 7 + (i % 2) * 3);
				D.apply(bubble,"body");
				set(bubble, { display:"flex", flexDirection:"column", alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "72%", background: mine ? accent : T.soft, color: mine ? textOn(accent) : T.text, border: mine ? "none" : `1px solid ${T.line}` });
				D.surface(bubble,"field",{shape:"pill"});
				if (!mine) {
					const who = el("div", "", bubble);
					word(who, name, 3);
					D.apply(who,"meta");
					set(who, { color: T.mute });
					if(name){D.truncateLine(who);who.title=name;}
				}
			});
		} else if (kind === "editor") {
			const page = card(bottom, { display: "flex", flexDirection: "column" },"comfortable");
			ui.rows.slice(0, 5).forEach(([name, text], i) => {
				const line = el("div", "", page);
				D.apply(line,i===0?"cardTitle":"body");
				set(line, { color: i === 0 ? T.text : T.mute });
				if (i === 0) word(line, name, 9);
				else {
					word(line, name ? `${name} ` : null, 6 + (i % 3) * 2);
					line.appendChild(document.createTextNode(" "));
					const marked = word(line, text, 8 - (i % 2) * 3);
					set(marked, { background: i === 2 ? alpha(accent, 0.25) : "transparent", color: i === 2 ? T.text : T.mute, borderRadius: radius(2), padding: `0 ${space(1)}` });
				}
			});
		} else {
			const list = card(bottom, { display: "flex", flexDirection: "column", overflow: "hidden" },"compact");
			const avatars = [palette.electric, palette.coral, palette.lime, palette.lilac, palette.peach];
			ui.rows.slice(0, narrow ? 4 : kind === "inbox" ? 5 : 4).forEach(([name, detail], i) => {
				const row = el("div", "", list);
				set(row, { display: "flex", alignItems: "center", gap: space(3), padding: `${space(2)} ${space(3)}`, borderBottom: `1px solid ${T.line}`, minWidth: "0" });
				const colour = avatars[(i + seed) % avatars.length] ?? accent;
				const avatar = el("span", "", row, initials(name));
				set(avatar, { flex: "none", width: f(34), height: f(34), borderRadius: "50%", background: colour, color: textOn(colour), display: "grid", placeItems: "center",  });
				D.apply(avatar,"initials");
				const texts = el("div", "", row);
				set(texts, { flex: "1", minWidth: "0" });
				const who = el("div", "", texts);
				word(who, name, 4.5 + (i % 2));
				D.apply(who,"name");
				if(name){D.truncateLine(who);who.title=name;}
				const what = el("div", "", texts);
				word(what, detail, 8 + (i % 3) * 1.5);
				D.apply(what,"meta");
				set(what, { color: T.mute });
				if(detail){D.truncateLine(what);what.title=detail;}
				pill(row, ui.status[i % ui.status.length], i);
			});
			if (kind === "dashboard" && !narrow) {
				const chart = card(bottom, { display: "flex", flexDirection: "column" });
				const name = el("div", "", chart);
				word(name, ui.stats[0]?.[0], 5);
				D.apply(name,"label");
				set(name, { color: T.mute });
				if(ui.stats[0]?.[0]){D.truncateLine(name);name.title=ui.stats[0][0];}
				const bars = el("div", "", chart);
				set(bars, { flex: "1", display: "flex", alignItems: "flex-end", gap: space(2), marginTop: space(3), minHeight: f(90) });
				for (let i = 0; i < 12; i++) {
					const bar = el("div", "", bars);
					const height = 25 + 70 * (0.35 + 0.65 * hash(i * 1.7 + seed)) * (0.55 + i / 24);
					set(bar, { flex: "1", height: `${Math.min(100, height)}%`, borderRadius: radius(2), background: i === 11 ? accent : alpha(accent, dark ? 0.35 : 0.22) });
				}
			}
		}

		if (narrow) {
			// A phone's tab bar: the first four labels, the current one in the brand's colour.
			const tabs = el("div", "", screen);
			set(tabs, { position: "absolute", left: "0", right: "0", bottom: "0", display: "flex", justifyContent: "space-around", padding: `${space(2)} ${space(2)} ${space(4)}`, borderTop: `1px solid ${T.line}`, background: T.bg });
			ui.nav.slice(0, 4).forEach((label, i) => {
				const tab = el("div", "", tabs);
				set(tab, { display: "flex", flexDirection: "column", alignItems: "center", flex:"1", minWidth:"0", gap: space(1), color: i === 0 ? accent : T.mute });
				const icon = el("span", "", tab);
				set(icon, { width: f(18), height: f(18), borderRadius: radius(2), border: `${f(2)} solid currentColor` });
				D.apply(tab,"label");
				const name=word(tab, label, 2.2);
				if(label){set(name,{display:"block",width:"100%",textAlign:"center"});D.truncateLine(name);name.title=label;}
			});
		}
		return screen;
	};


return { makeCursor, mockUI, CURSOR_SVG };
}
