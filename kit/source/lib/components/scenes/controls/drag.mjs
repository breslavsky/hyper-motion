// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE, paintGround} from '../_shared/hands.mjs';
// ---- drag: files go into the product ---------------------------------------------------------------
// Files lie on the desk; the cursor picks each one up (it lifts, tilts with the move), drops it
// into the product's drop zone, where it uploads and gets a check. Each drag is quicker than the
// last. Then the cursor clicks the button and the line lands where the files were.
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, alpha, lum, mixHex, textOn, CURSOR_SVG, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const groundDraw = s.ground ? paintGround(cam, K, palette, accent, bg) : null;
	// On anything but a dark ground the panel is white: a panel a shade lighter than a
	// mid-tone ground (coral, sage) was hardly there.
	const light = lum(bg) > 0.14 || !!s.ground;
	const cardBg = light ? "#ffffff" : mixHex(bg, "#ffffff", 0.09);
	const ink = light ? "#151515" : "#f3f3f3";
	const mute = alpha(ink, 0.5);
	// With no words of the film's for them, the panel has no title and its button an arrow.
	const label = DOUBLE(s.label || "");
	const button = DOUBLE(s.button || "→");
	const pics = (s.images ?? []).map((u) => K.images[u]).filter(Boolean);
	const names = (s.files?.length ? s.files : ["", "", ""]).map(DOUBLE).slice(0, 3);
	const kindOf = (nm, k) => (/\.(pdf|docx?|txt|md)$/i.test(nm) ? "doc" : /\.(mp4|mov|webm)$/i.test(nm) ? "clip" : /\.(jpe?g|png|webp|gif)$/i.test(nm) ? "photo" : ["photo", "doc", "clip"][k % 3]);
	const world = el("div", "", cam);
	set(world, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), transformOrigin: "50% 50%" });

	// The product panel.
	const pW = vertical ? W * 0.86 : W * 0.42;
	const pH = vertical ? H * 0.4 : H * 0.62;
	const pX = vertical ? (W - pW) / 2 : W * 0.52;
	const pY = vertical ? H * 0.5 : (H - pH) / 2;
	const panel = el("div", "", world);
	panel.dataset.dragPanel = "";
	set(panel, { position: "absolute", left: px(pX), top: px(pY), width: px(pW), height: px(pH), background: cardBg, boxShadow: `0 ${px(34 * S)} ${px(90 * S)} ${alpha("#000000", light ? 0.14 : 0.45)}, 0 0 0 ${px(1.5 * S)} ${alpha(ink, 0.07)}`, color: ink, willChange: "transform", transformOrigin: "50% 60%" });
	const panelBox = D.surface(panel, "card", { layout: "absolute" });
	const pad = panelBox.paddingX;
	const head = el("div", "", panel);
	head.dataset.dragHeader = "";
	set(head, { position: "absolute", left: px(pad), right: px(pad), top: px(pad), minHeight: px(54 * S), display: "flex", alignItems: "center", gap: px(D.space(1)) });
	D.surfaceContent(panel, head);
	D.surfaceGap(head, 1);
	for (const c of ["#ff5f57", "#febc2e", "#28c840"]) {
		const dd = el("div", "", head);
		set(dd, { width: px(14 * S), height: px(14 * S), borderRadius: "50%", background: c });
	}
	const ttl = el("div", "bold", head, label);
	ttl.dataset.dragTitle = "";
	set(ttl, { marginLeft: px(D.space(2)) });
	D.apply(ttl,"controlLabel");
	const zX = pad;
	const zY = pad + head.offsetHeight + D.space(2);
	const zW = pW - pad * 2;
	const bH = D.control("button").height;
	const zH = pH - zY - pad - bH - D.space(2);
	const zone = el("div", "", panel);
	zone.dataset.dragDropzone = "";
	set(zone, { position: "absolute", left: px(zX), top: px(zY), width: px(zW), height: px(zH), border: `${px(2.5 * S)} dashed ${alpha(ink, 0.2)}` });
	const zoneBox = D.surface(zone, "field", { layout: "absolute" });
	D.nest(zone, panel, { inset: pad });
	D.surfaceContent(panel, zone);
	const hint = el("div", "", zone);
	set(hint, { position: "absolute", left: "0", right: "0", top: "50%", transform: "translateY(-50%)", textAlign: "center", color: mute, });
	set(hint, { left: px(zoneBox.paddingX), right: px(zoneBox.paddingX) });
	D.surfaceContent(zone, hint);
	D.apply(hint,"label");
	const arrow = el("div", "", hint, "↑");
	set(arrow, { width: px(54 * S), height: px(54 * S), margin: `0 auto ${px(12 * S)}`, borderRadius: "50%", background: alpha(ink, 0.06), display: "flex", alignItems: "center", justifyContent: "center", color: ink });
	D.apply(arrow,"button");
	const btn = el("div", "bold", panel, button);
	btn.dataset.dragButton = "";
	set(btn, { position: "absolute", right: px(pad), bottom: px(pad), height: px(bH), padding: `0 ${px(D.space(3))}`, borderRadius: px(D.control("button").radius), background: accent, color: textOn(accent), display: "flex", alignItems: "center", boxShadow: `0 ${px(10 * S)} ${px(24 * S)} ${alpha(accent, 0.35)}` });
	D.surfaceContent(panel, btn);
	D.apply(btn,"button");
	if (!s.button) { btn.textContent = ""; btn.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
	const meta = el("div", "", panel, `0 / ${names.length}`);
	set(meta, { position: "absolute", left: px(pad), bottom: px(pad), height: px(bH), display: "flex", alignItems: "center", color: mute, });
	D.surfaceContent(panel, meta);
	D.apply(meta,"meta");

	// Slots inside the zone, where each file ends up.
	const sGap = D.space(2);
	const zoneInset = zoneBox.paddingX + 2.5 * S;
	const slotW = (zW - zoneInset * 2 - sGap * 2) / 3;
	const slotH = slotW * 0.78;
	const slotY = pY + zY + (zH - slotH) / 2 - 10 * S;
	const slotX = (k) => pX + zX + zoneInset + k * (slotW + sGap);
	const bars = names.map((_, k) => {
		const tr = el("div", "", world);
		set(tr, { position: "absolute", left: px(slotX(k)), top: px(slotY + slotH + 12 * S), width: px(slotW), height: px(6 * S), borderRadius: px(3 * S), background: alpha(ink, 0.08), overflow: "hidden", opacity: "0", zIndex: "6" });
		const fill = el("div", "", tr);
		set(fill, { height: "100%", width: "100%", background: accent, transformOrigin: "0 50%", transform: "scaleX(0)" });
		const badge = el("div", "", world, "✓");
		const bs = 30 * S;
		set(badge, { position: "absolute", left: px(slotX(k) + slotW - bs * 0.6), top: px(slotY - bs * 0.4), width: px(bs), height: px(bs), borderRadius: "50%", background: accent, color: textOn(accent), display: "flex", alignItems: "center", justifyContent: "center", zIndex: "12", opacity: "0", boxShadow: `0 ${px(4 * S)} ${px(10 * S)} rgba(0,0,0,0.2)` });
		D.apply(badge,"initials");
		return { tr, fill, badge };
	});

	// Files on the desk.
	const tw = vertical ? W * 0.22 : W * 0.135;
	const th = tw * 0.78;
	const square = !vertical && W < H * 1.2;
	const fileGap = D.space(2);
	// Single-line filenames keep the readable label role and use an ellipsis.
	// Desk cells stay separate from the panel's largest entrance footprint.
	const desk = { left: W * 0.05, top: H * 0.05, right: vertical ? W * 0.95 : pX - pW * 0.04 - fileGap,
		bottom: vertical ? pY - pH * 0.048 - fileGap : H * 0.95 };
	const columnWidth = (desk.right - desk.left - fileGap * (vertical ? 2 : 1)) / (vertical ? 3 : 2);
	const captionWidth = square ? desk.right - desk.left - tw - D.space(3) - fileGap * 2
		: columnWidth - D.space(4);
	const tiles = names.map((nm, k) => {
		const kind = kindOf(nm, k);
		const t = el("div", "", world);
		t.dataset.dragFile = String(k);
		set(t, { position: "absolute", left: "0", top: "0", width: px(tw), height: px(th), transformOrigin: "50% 50%", willChange: "transform", zIndex: String(10 + k) });
		const face = el("div", "", t);
		face.dataset.dragFace = String(k);
		set(face, { position: "absolute", inset: "0", overflow: "hidden", boxShadow: `0 ${px(14 * S)} ${px(30 * S)} rgba(0,0,0,0.22)` });
		D.surface(face, "card", { density: "compact", layout: "frame", purpose: "media" });
		const img = kind === "photo" && pics.length ? pics[k % pics.length] : null;
		if (img) {
			const im = el("img", "fill", face);
			im.src = img.src;
			set(im, { width: "100%", height: "100%", objectFit: "cover" });
		} else if (kind === "photo") {
			const sky = palette.sky ?? "#9cc9ff";
			set(face, { background: `linear-gradient(180deg, ${sky} 0%, ${mixHex(sky, "#ffffff", 0.5)} 60%)` });
			const sun = el("div", "", face);
			set(sun, { position: "absolute", left: "62%", top: "18%", width: px(tw * 0.18), height: px(tw * 0.18), borderRadius: "50%", background: palette.butter ?? "#ffd166" });
			const h1 = el("div", "", face);
			set(h1, { position: "absolute", left: "-20%", top: "58%", width: "90%", height: "90%", borderRadius: "50%", background: mixHex(palette.lime ?? "#7bd389", "#1e5e3a", 0.35) });
			const h2 = el("div", "", face);
			set(h2, { position: "absolute", left: "35%", top: "66%", width: "100%", height: "90%", borderRadius: "50%", background: mixHex(palette.lime ?? "#7bd389", "#0f3d24", 0.5) });
		} else if (kind === "doc") {
			set(face, { background: "#ffffff" });
			// A document thumbnail is a small UI surface, not an oversize glyph.
			const documentDesign = D.forSurface(tw / (D.unit * 160));
			documentDesign.surface(face, "card", { density: "compact" });
			set(face, { display: "flex", flexDirection: "column", alignItems: "flex-start" });
			const extension = /\.([a-z0-9]{1,5})$/i.exec(nm)?.[1]?.toUpperCase() ?? "DOC";
			const tag = el("div", "bold", face, extension);
			tag.setAttribute("data-deco", ""); // File-type mark on the miniature document.
			set(tag, { display: nm ? "inline-block" : "none", background: "#e5484d", color: "#fff", flexShrink: "0" });
			documentDesign.surface(tag, "badge", { density: "compact" });
			documentDesign.apply(tag,"label");
			for (const wv of [0.86, 0.7, 0.92, 0.55]) {
				const ln = el("div", "", face);
				set(ln, { height: px(documentDesign.space(1)), width: `${wv * 100}%`, borderRadius: px(documentDesign.radius(1)), background: "rgba(0,0,0,0.12)", flexShrink: "0" });
			}
		} else {
			set(face, { background: `linear-gradient(135deg, #1b1d29, ${mixHex(accent, "#1b1d29", 0.45)})` });
			const play = el("div", "", face);
			set(play, { position: "absolute", left: "50%", top: "50%", width: "0", height: "0", borderLeft: `${px(tw * 0.13)} solid rgba(255,255,255,0.95)`, borderTop: `${px(tw * 0.085)} solid transparent`, borderBottom: `${px(tw * 0.085)} solid transparent`, transform: "translate(-35%,-50%)" });
		}
		const cap = el("div", "", t, nm);
		cap.dataset.dragFilename = String(k);
		cap.title = nm;
		set(cap, { position: "absolute", width: px(captionWidth), textAlign: square ? "left" : "center", color: fg });
		D.apply(cap,"label");
		D.truncateLine(cap);
		const captionHeight = cap.offsetHeight;
		const captionX = square ? tw + D.space(3) : (tw - captionWidth) / 2;
		const captionY = square ? (th - captionHeight) / 2 : th + D.space(1);
		set(cap, { left: px(captionX), top: px(captionY) });
		const angle = [-6, vertical ? 4 : 5, -3][k];
		// The caption disappears during the lift, before the drag begins. Reserve
		// its visible lift scale, every intermediate resting rotation, and the
		// entrance offset; those transforms must not spend the layout's gaps.
		const corners = [[0,0],[tw,0],[0,th],[tw,th],
			[captionX,captionY],[captionX+captionWidth,captionY],
			[captionX,captionY+captionHeight],[captionX+captionWidth,captionY+captionHeight]];
		const points = [];
		for (let step = 0; step <= 12; step++) {
			const radians = angle * step / 12 * Math.PI / 180;
			for (const [cx,cy] of corners) {
				const dx = cx - tw/2, dy = cy - th/2;
				points.push({ x: (dx*Math.cos(radians)-dy*Math.sin(radians))*1.03,
					y: (dx*Math.sin(radians)+dy*Math.cos(radians))*1.03 });
			}
		}
		const bounds = { left: Math.min(...points.map(v=>v.x)), right: Math.max(...points.map(v=>v.x)),
			top: Math.min(...points.map(v=>v.y)) - 50*S, bottom: Math.max(...points.map(v=>v.y)) };
		return { t, face, cap, angle, bounds };
	});
	// A square has three file rows with names beside the previews. A portrait
	// has three columns above the panel; landscape keeps the staggered desk.
	const cell = (k) => {
		if (square) {
			const h = (desk.bottom-desk.top-fileGap*(tiles.length-1))/tiles.length;
			return {x:desk.left,y:desk.top+k*(h+fileGap),w:desk.right-desk.left,h};
		}
		if (vertical) return {x:desk.left+k*(columnWidth+fileGap),y:desk.top,w:columnWidth,h:desk.bottom-desk.top};
		const h = (desk.bottom-desk.top-fileGap)/2;
		return {x:desk.left+(k===1?columnWidth+fileGap:0),y:k===1?desk.top+h/2:desk.top+(k===2?h+fileGap:0),w:columnWidth,h};
	};
	tiles.forEach((tile,k) => {
		const area=cell(k),b=tile.bounds;
		if (b.right-b.left>area.w+1||b.bottom-b.top>area.h+1)
			throw new Error(`Drag file cannot fit its desk cell: ${names[k]}`);
		const cx=area.x+(area.w-b.right+b.left)/2-b.left;
		const cy=area.y+(area.h-b.bottom+b.top)/2-b.top;
		tile.home=[cx-tw/2,cy-th/2,tile.angle];
	});

	// The line that lands where the files were.
	const line = String(s.text || "Drop it in. *Done.*");
	const capBox = el("div", "display", world);
	const capFs = D.type("display").size;
	set(capBox, vertical ? { position: "absolute", left: px(W * 0.07), width: px(W * 0.86), top: px(H * 0.2), color: fg, textAlign: "center" } : { position: "absolute", left: px(W * 0.07), width: px(W * 0.4), top: px(H * 0.3), color: fg, });
	D.apply(capBox,"display");
	const capWords = [];
	line.split(/\s+/).forEach((wd, i) => {
		if (i) capBox.appendChild(document.createTextNode(" "));
		const clip = el("span", "", capBox);
		set(clip, { display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.12em", marginBottom: "-0.12em" });
		const inner = el("span", "", clip, wd.replace(/\*/g, ""));
		const em = /^\*.*\*[.,!?]?$/.test(wd);
		set(inner, { display: "inline-block", color: em ? accent : fg });
		if (em && K.plan?.look?.display?.accent === "serif") inner.style.fontStyle = "italic";
		capWords.push(inner);
	});

	if (vertical) set(capBox, { left: px((W - K.safe.w * .9) / 2), width: px(K.safe.w * .9) });
	D.fitSize(capBox, vertical ? K.safe.w * 0.9 : W * 0.36, H * (vertical ? 0.3 : 0.5), "display");
	const cur = el("div", "cursor", world);
	cur.innerHTML = CURSOR_SVG;
	const cS = 62 * S;
	set(cur, { width: px(cS * 0.74), height: px(cS), left: "0", top: "0" });
	const ring = el("div", "ring", world);
	set(ring, { borderWidth: px(cS * 0.06), borderColor: accent });

	// Timing: three drags, each quicker than the last.
	// In a short scene the drags hurry, so the line that follows them is on screen long enough
	// to be read: at their own pace they took 3.8 s, and the line landed as the scene ended.
	const pace = clamp((d0 * 0.6) / 3.8, 0.45, 1);
	const mv = [0.72, 0.52, 0.4].map((v) => v * pace);
	const appr = [0.42, 0.3, 0.26].map((v) => v * pace);
	const plan = [];
	let t = 0.7 * pace;
	names.forEach((_, k) => {
		const a = t;
		const g = a + appr[k];
		const r = g + 0.1 * pace + mv[k];
		plan.push({ a, g, r, mv: mv[k] });
		t = r + 0.08 * pace;
	});
	const lastR = plan[plan.length - 1].r;
	const tBtnArrive = lastR + 0.5;
	const tClick = tBtnArrive + 0.04;
	const tLine = lastR + 0.05;
	const btnPos = { x: pX + pW - pad - 70 * S, y: pY + pH - pad - bH / 2 };
	const center = (k) => ({ x: tiles[k].home[0] + tw / 2, y: tiles[k].home[1] + th / 2 });
	const slotC = (k) => ({ x: slotX(k) + slotW / 2, y: slotY + slotH / 2 });
	const grabOff = { x: tw * 0.08, y: th * 0.12 };

	return (l) => {
		if (groundDraw) groundDraw(l);
		// The panel lands from oversize; the files drop onto the desk a frame apart.
		const land = E.softLand(prog(l, 0, 0.55));
		set(panel, { opacity: clamp(land * 3).toFixed(3), transform: `translateY(${px((1 - land) * 40 * S)}) scale(${(1.08 - 0.08 * land).toFixed(4)})` });
		let hover = 0;
		let curX = W * 1.05;
		let curY = H * 1.1;
		let down = 0;
		tiles.forEach((tl, k) => {
			const pl = plan[k];
			const drop = E.softLand(prog(l, 0.12 + k * 0.07, 0.5));
			const c0 = center(k);
			const c1 = slotC(k);
			const lift = E.snapSettle(prog(l, pl.g, 0.14));
			const mp = E.softInOut(prog(l, pl.g + 0.1 * pace, pl.mv));
			const settle = E.snapSettle(prog(l, pl.r, 0.3));
			const arc = Math.sin(mp * Math.PI) * (vertical ? -H * 0.08 : -H * 0.07);
			let x = c0.x + (c1.x - c0.x) * mp;
			let y = c0.y + (c1.y - c0.y) * mp + arc;
			const dir = Math.sign(c1.x - c0.x) || 1;
			const tilt = l < pl.r ? Math.sin(mp * Math.PI) * 8 * dir : 0;
			const rot = tl.home[2] * (1 - lift);
			const slotScale = slotW / tw;
			let sc = 1 + 0.07 * lift - (1.07 - slotScale) * clamp((mp - 0.45) / 0.55);
			if (l >= pl.r) {
				sc = slotScale * (1 + 0.06 * (1 - settle));
				x = c1.x;
				y = c1.y;
			}
			set(tl.t, { transform: `translate(${px(x - tw / 2)}, ${px(y - th / 2 + (1 - drop) * -50 * S)}) rotate(${(rot + tilt).toFixed(3)}deg) scale(${sc.toFixed(4)})`, opacity: clamp(drop * 3).toFixed(3), zIndex: l >= pl.g ? "30" : String(10 + k) });
			set(tl.face, { boxShadow: `0 ${px((14 + 26 * lift * (1 - settle)) * S)} ${px((30 + 40 * lift * (1 - settle)) * S)} rgba(0,0,0,${(0.22 + 0.1 * lift * (1 - settle)).toFixed(3)})` });
			set(tl.cap, { opacity: (1 - clamp(lift * 2.5)).toFixed(3) });
			if (l >= pl.g && l < pl.r) hover = Math.max(hover, clamp((mp - 0.55) / 0.3));
			// Cursor: approach this file, then ride with it.
			if (l >= pl.a && l < pl.g) {
				const from = k === 0 ? { x: W * 1.05, y: H * 1.1 } : slotC(k - 1);
				const ap = E.softInOut(prog(l, pl.a, pl.g - pl.a));
				curX = from.x + (c0.x + grabOff.x - from.x) * ap;
				curY = from.y + (c0.y + grabOff.y - from.y) * ap + Math.sin(ap * Math.PI) * -30 * S;
			} else if (l >= pl.g && l < pl.r + 0.08) {
				curX = x + grabOff.x * (l < pl.r ? sc : slotScale);
				curY = y + grabOff.y * (l < pl.r ? sc : slotScale);
				down = l < pl.r ? 1 : 0;
			}
			// Upload, then a check.
			const up = E.softInOut(prog(l, pl.r + 0.08, 0.55));
			set(bars[k].tr, { opacity: l > pl.r ? (clamp((l - pl.r) / 0.1) * (1 - clamp((l - pl.r - 0.8) / 0.2))).toFixed(3) : "0" });
			set(bars[k].fill, { transform: `scaleX(${up.toFixed(4)})` });
			const bk = l > pl.r + 0.6 ? E.popOver(clamp((l - pl.r - 0.6) / 0.35)) : 0;
			set(bars[k].badge, { opacity: clamp(bk * 3).toFixed(3), transform: `scale(${bk.toFixed(4)})` });
		});
		const lastPl = plan[plan.length - 1];
		if (l >= lastPl.r + 0.08) {
			const from = slotC(names.length - 1);
			const ap = E.softInOut(prog(l, lastPl.r + 0.08, tBtnArrive - lastPl.r - 0.08));
			curX = from.x + (btnPos.x - from.x) * ap;
			curY = from.y + (btnPos.y - from.y) * ap;
			down = l >= tClick - 0.04 && l < tClick + 0.1 ? 1 : 0;
		}
		const firstOn = l >= plan[0].a;
		set(cur, { opacity: firstOn ? "1" : "0", transform: `translate(${px(curX - cS * 0.08)}, ${px(curY - cS * 0.06)}) scale(${(1 - 0.14 * down).toFixed(3)})` });
		const rk = prog(l, tClick, 0.55);
		set(ring, { opacity: l >= tClick && rk < 1 ? (1 - rk).toFixed(3) : "0", left: px(btnPos.x), top: px(btnPos.y), width: px(cS * (0.4 + E.whip(rk) * 2.4)), height: px(cS * (0.4 + E.whip(rk) * 2.4)) });
		// The zone answers the file over it.
		set(zone, { borderColor: hover > 0.01 ? alpha(accent, 0.25 + 0.75 * hover) : alpha(ink, 0.2), background: alpha(accent, 0.07 * hover), transform: `scale(${(1 + 0.015 * hover).toFixed(4)})` });
		set(hint, { opacity: (1 - E.softLand(prog(l, plan[0].r - 0.1, 0.2))).toFixed(3) });
		const done = names.filter((_, k) => l > plan[k].r + 0.6).length;
		// How many are in, of how many: a count reads in every language.
		meta.textContent = `${done} / ${names.length}`;
		const bp = l > tClick ? E.popOver(clamp((l - tClick) / 0.4)) : 1;
		set(btn, { transform: `scale(${(l > tClick && l < tClick + 0.08 ? 0.92 : 0.92 + 0.08 * bp).toFixed(4)})` });
		// The line lands where the files were, word by word, from below.
		capWords.forEach((w, i) => {
			const k = E.softLand(prog(l, tLine + i * 0.06, 0.5));
			set(w, { opacity:k>0?"1":"0",transform: `translateY(${((1 - k) * 105).toFixed(2)}%)` });
		});
		set(world, { transform: `scale(${(1 + clamp(l / d0) * 0.03).toFixed(4)})` });
	};
};
