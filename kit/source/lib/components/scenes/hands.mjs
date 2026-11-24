// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../typing.mjs';
const sceneFactories = {};
const DOUBLE = (w) => String(w ?? "").replace(/\*/g, "");

/** A painted ground: large soft washes of the palette that drift slowly, like a gouache backdrop
 *  behind the product. Built first so it sits behind everything in the scene. */
const paintGround = (cam, K, palette, accent, bg) => {
	const { W, H, el, set, px, mixHex, lum } = K;
	const g = el("div", "", cam);
	set(g, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), overflow: "hidden", background: bg });
	const light = lum(bg) > 0.45;
	// A gouache needs colour: if the style's palette is mostly greys, fall back to soft pastels.
	const chroma = (h) => {
		const n = parseInt(String(h).replace("#", "").slice(0, 6), 16);
		if (Number.isNaN(n)) return 0;
		const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		return (Math.max(...c) - Math.min(...c)) / 255;
	};
	let cols = [palette.coral, palette.sky, palette.butter, palette.lilac].filter((c) => c && chroma(c) > 0.25);
	if (cols.length < 3) cols = ["#ffb199", "#9fd3ff", "#ffe08a", "#cdb8ff"];
	cols.push(accent);
	const blobs = [0, 1, 2, 3, 4].map((i) => {
		const b = el("div", "", g);
		const src = cols[i % cols.length];
		const c = mixHex(src, bg, src === accent ? (light ? 0.6 : 0.7) : light ? 0.15 : 0.45);
		const r = Math.max(W, H) * (0.55 + 0.12 * (i % 3));
		set(b, { position: "absolute", left: "0", top: "0", width: px(r), height: px(r), borderRadius: "50%", background: `radial-gradient(circle at 50% 50%, ${c} 0%, ${c} 22%, transparent 68%)`, willChange: "transform" });
		return { b, r, i };
	});
	const seeds = [
		[0.12, 0.2],
		[0.85, 0.15],
		[0.7, 0.9],
		[0.15, 0.85],
		[0.5, 0.5],
	];
	return (l) => {
		blobs.forEach(({ b, r, i }) => {
			const [sx, sy] = seeds[i];
			const x = sx * W + Math.sin(l * 0.35 + i * 1.7) * W * 0.05 - r / 2;
			const y = sy * H + Math.cos(l * 0.3 + i * 2.3) * H * 0.05 - r / 2;
			set(b, { transform: `translate(${px(x)}, ${px(y)}) scale(${(1 + Math.sin(l * 0.25 + i) * 0.05).toFixed(4)})` });
		});
	};
};

/** A fingertip: arrives from oversize, presses, lifts and leaves a ring. */
const makeTouch = (parent, K, size) => {
	const { el, set, px, prog, clamp, ease: E } = K;
	const dot = el("div", "", parent);
	set(dot, { position: "absolute", left: "0", top: "0", width: px(size), height: px(size), borderRadius: "50%", background: "rgba(255,255,255,0.92)", boxShadow: `0 ${px(size * 0.12)} ${px(size * 0.4)} rgba(0,0,0,0.28), inset 0 0 0 ${px(size * 0.05)} rgba(0,0,0,0.08)`, zIndex: "40", opacity: "0" });
	const ring = el("div", "", parent);
	set(ring, { position: "absolute", left: "0", top: "0", borderRadius: "50%", border: `${px(size * 0.06)} solid rgba(255,255,255,0.9)`, zIndex: "39", opacity: "0" });
	/** taps: [{t, x, y}] — one fingertip, several taps in a row. */
	return (l, taps) => {
		let best = null;
		for (const tp of taps) if (l >= tp.t - 0.3 && l <= tp.t + 0.3) best = tp;
		if (!best) {
			// A reverse seek before the first tap restores the hidden constructor
			// state as well; no coordinates from a later tap survive off-screen.
			set(dot, { opacity: "0", transform: "" });
			set(ring, { opacity: "0", transform: "", width: "", height: "" });
			return;
		}
		const arrive = E.softLand(prog(l, best.t - 0.3, 0.26));
		const press = l >= best.t - 0.04 && l < best.t + 0.08 ? 1 : 0;
		const leave = E.accelExit(prog(l, best.t + 0.12, 0.18));
		const sc = (1.6 - 0.6 * arrive) * (1 - 0.2 * press) * (1 - 0.1 * leave);
		set(dot, { opacity: (clamp(arrive * 2) * (1 - leave)).toFixed(3), transform: `translate(${px(best.x - size / 2)}, ${px(best.y - size / 2)}) scale(${sc.toFixed(4)})` });
		const rk = prog(l, best.t, 0.45);
		const rs = size * (0.8 + E.whip(rk) * 1.8);
		set(ring, { opacity: l >= best.t && rk < 1 ? (0.9 * (1 - rk)).toFixed(3) : "0", transform: `translate(${px(best.x - rs / 2)}, ${px(best.y - rs / 2)})`, width: px(rs), height: px(rs) });
	};
};

// ---- between: a phone in the gap of a sentence ----------------------------------------------------
// "Book [phone] a table": the phone lands in the gap, the words slide out from behind it, a finger
// taps through the app's screens while the last word changes with each one, and the final tap turns
// the button into a check. Then the phone leaves upward and the words part, accelerating.
sceneFactories.between = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, alpha, lum, mockUI, textOn, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	// Square frames stack too: words beside a tall phone get squeezed.
	let vertical = H > W * 0.95;
	const groundDraw = s.ground ? paintGround(cam, K, palette, accent, bg) : null;
	const lead = DOUBLE(s.lead || "Book");
	const words = (s.words?.length ? s.words : ["in seconds"]).map(DOUBLE).slice(0, 3);
	const cta = DOUBLE(s.cta || "→");
	const pics = (s.images ?? []).map((u) => K.images[u]).filter(Boolean);
	const n = words.length;
	const world = el("div", "", cam);
	set(world, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), transformOrigin: "50% 50%" });

	let ph = vertical ? H * 0.44 : H * 0.74;
	let pw = ph / 2.05;
	const gap = D.space(3),textW=K.safe.w*.94;
	let textSpec=D.type("display"),wrapped=false;
	const meas = (t, spec=textSpec) => {
		const r=el("div","",world,t);set(r,{position:"absolute",whiteSpace:wrapped?"normal":"pre",visibility:"hidden",
			...(wrapped?{width:px(textW),overflowWrap:"anywhere"}:{})});
		D.apply(r,"display",{step:spec.step});const size={w:r.scrollWidth,h:r.offsetHeight};r.remove();return size;
	};
	const choose = () => D.steps("display").find(spec => {
		const lw=meas(lead,spec).w,ww=Math.max(...words.map(w=>meas(w,spec).w));
		return vertical ? Math.max(lw,ww)<=textW : lw+ww+pw+gap*2<=textW;
	});
	let fitted=choose();
	if(!fitted&&!vertical){vertical=true;ph=H*.44;pw=ph/2.05;fitted=choose();}
	if(!fitted){
		// Valid wide-script words may need two lines even at the smallest display
		// step. Keep the full copy and type ladder; the phone gives up height.
		wrapped=true;
		const textMaxH=(K.safe.h-Math.min(ph,K.safe.h*.4))/2-gap;
		fitted=D.steps("display").find(spec=>[lead,...words].every(text=>{
			const measured=meas(text,spec);
			return measured.w<=textW+1&&measured.h<=Math.min(textMaxH,spec.lineHeight*2)+1;
		}));
	}
	if(!fitted)throw new Error("Between phrases exceed display capacity");
	textSpec=fitted;
	const leadW = meas(lead).w;
	const wordWs = words.map((w) => meas(w).w);
	const wordMax = Math.max(...wordWs);
	const pcx = vertical ? W / 2 : W / 2 + (leadW - wordMax) / 2;
	const boxH = wrapped?Math.max(...[lead,...words].map(text=>meas(text).h)):textSpec.lineHeight;
	// Stacked, the words above and below the phone stay inside the safe area: the phone gives way.
	if (vertical) {
		ph = Math.min(ph, K.safe.h - 2 * (boxH + gap));
		pw = ph / 2.05;
	}
	const pTop = vertical ? K.safe.y + (K.safe.h - ph) / 2 : (H - ph) / 2;
	const pLeft = pcx - pw / 2;

	// Words in clipping boxes that start at the phone's edges, so they slide out from behind it.
	const leadBox = el("div", "", world);
	const tailBox = el("div", "", world);
	if (vertical) {
		const width=wrapped?textW:W,left=wrapped?(W-textW)/2:0;
		set(leadBox, { position: "absolute", left: px(left), width: px(width), top: px(pTop - gap - boxH), height: px(boxH), overflow: "hidden", textAlign: "center" });
		set(tailBox, { position: "absolute", left: px(left), width: px(width), top: px(pTop + ph + gap), height: px(boxH), overflow: "hidden", textAlign: "center" });
	} else {
		set(leadBox, { position: "absolute", left: px(pLeft - gap - leadW - 20 * S), width: px(leadW + 20 * S), top: px(H / 2 - boxH / 2), height: px(boxH), overflow: "hidden", textAlign: "right" });
		set(tailBox, { position: "absolute", left: px(pLeft + pw + gap), width: px(wordMax + 20 * S), top: px(H / 2 - boxH / 2), height: px(boxH), overflow: "hidden", textAlign: "left" });
	}
	const mkWord = (box, t) => {
		const w = el("div", "display", box, t);
		set(w, { position: "absolute", left: "0", right: "0", top: px(wrapped?(boxH-meas(t).h)/2:0),
			whiteSpace: wrapped?"normal":"pre", overflowWrap:wrapped?"anywhere":"normal",color: fg, willChange: "transform" });
		D.apply(w,"display",{step:textSpec.step});
		return w;
	};
	const leadN = mkWord(leadBox, lead);
	const tailNs = words.map((w) => mkWord(tailBox, w));

	// The phone, its pages and the button on the last page.
	const phone = el("div", "phone", world);
	set(phone, { width: px(pw), height: px(ph), left: px(pLeft), top: px(pTop), borderRadius: px(pw * 0.16), boxShadow: `0 ${px(40 * S)} ${px(90 * S)} rgba(0,0,0,0.32)`, willChange: "transform", zIndex: "5" });
	const inset = pw * 0.035;
	const scr = el("div", "screen", phone);
	set(scr, { left: px(inset), top: px(inset), right: px(inset), bottom: px(inset), borderRadius: px(pw * 0.13) });
	const sw = pw - inset * 2;
	const sh = ph - inset * 2;
	const dark = lum(palette.paper) < 0.2;
	const kinds = ["dashboard", "inbox", "chat"];
	const pages = words.map((_, k) => {
		const pg = el("div", "", scr);
		set(pg, { position: "absolute", left: "0", top: "0", width: px(sw), height: px(sh), overflow: "hidden", background: dark ? "#0d0f15" : "#ffffff", boxSizing: "border-box", paddingTop: px(pw * 0.12), zIndex: String(k + 1), boxShadow: k ? `${px(-20 * S)} 0 ${px(40 * S)} rgba(0,0,0,0.18)` : "none" });
		const img = pics.length ? pics[k % pics.length] : null;
		if (img) {
			set(pg, { paddingTop: "0" });
			const im = el("img", "fill", pg);
			im.src = img.src;
			set(im, { width: "100%", height: "100%", objectFit: "cover" });
		} else {
			const inner = el("div", "", pg);
			set(inner, { position: "relative", width: "100%", height: "100%" });
			mockUI(inner, palette, accent, k, kinds[k % kinds.length]);
		}
		return pg;
	});
	const lastPg = pages[n - 1];
	const PD=D.forSurface(sw/(D.unit*180));
	const bh = PD.control("button").height;
	const bw = sw * 0.82;
	const btn = el("div", "bold", lastPg);
	const btnTop = sh - bh - sh * 0.06;
	set(btn, { position: "absolute", left: px((sw - bw) / 2), top: px(btnTop), width: px(bw), height: px(bh), borderRadius: px(PD.control("button").radius), background: accent, color: textOn(accent), display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${px(10 * S)} ${px(24 * S)} ${alpha(accent, 0.4)}`, zIndex: "6", overflow: "hidden" });
	PD.apply(btn,"button");
	const btnTxt = el("span", "", btn, cta);
	set(btnTxt, { display: "block", maxWidth: px(bw - PD.control("button").paddingX * 2) });
	PD.truncateLine(btnTxt);btnTxt.title = cta;
	const ns = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(ns, "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	set(svg, { position: "absolute", left: "50%", top: "50%", width: px(bh * 0.5), height: px(bh * 0.5), transform: "translate(-50%,-50%)", overflow: "visible" });
	const chk = document.createElementNS(ns, "path");
	chk.setAttribute("d", "M5 12.5l4.5 4.5L19 7.5");
	chk.setAttribute("fill", "none");
	chk.setAttribute("stroke", textOn(accent));
	chk.setAttribute("stroke-width", "3.2");
	chk.setAttribute("stroke-linecap", "round");
	chk.setAttribute("stroke-linejoin", "round");
	chk.setAttribute("stroke-dasharray", "24");
	chk.setAttribute("stroke-dashoffset", "24");
	svg.appendChild(chk);
	btn.appendChild(svg);
	const island = el("div", "", phone);
	set(island, { position: "absolute", top: px(pw * 0.06), left: px(pw * 0.36), width: px(pw * 0.28), height: px(pw * 0.08), borderRadius: px(99), background: "#0b0b0d", zIndex: "20" });
	// A burst of short strokes around the check, in the world (not clipped by the phone).
	const bcx = pLeft + inset + sw / 2;
	const bcy = pTop + inset + btnTop + bh / 2;
	const rays = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
		const r = el("div", "", world);
		set(r, { position: "absolute", left: px(bcx), top: px(bcy), width: px(bh * 0.32), height: px(5 * S), borderRadius: px(3 * S), background: i % 2 ? accent : fg, transformOrigin: "0 50%", opacity: "0", zIndex: "8" });
		return r;
	});
	const touch = makeTouch(world, K, 58 * S);

	// Timing.
	const step = Math.max(0.6, (d0 * 0.5) / Math.max(1, n));
	const swapAt = words.map((_, k) => 0.95 + (k - 1) * step + (k ? 0 : -9));
	const tTap = (n > 1 ? swapAt[n - 1] : 0.7) + Math.max(0.75, step * 0.9);
	const tExit = Math.max(tTap + 1.0, d0 - 0.34);
	const taps = [];
	for (let k = 1; k < n; k++) taps.push({ t: swapAt[k] - 0.14, x: pLeft + inset + sw * (0.3 + 0.35 * (k % 2)), y: pTop + inset + sh * (0.42 + 0.12 * k) });
	taps.push({ t: tTap, x: bcx + bw * 0.12, y: bcy + bh * 0.1 });

	return (l) => {
		if (groundDraw) groundDraw(l);
		// The phone lands from below and from oversize, then leaves upward, accelerating.
		const land = E.softLand(prog(l, 0, 0.6));
		const out = E.accelExit(prog(l, tExit, 0.34));
		const float = Math.sin(l * 1.6) * 4 * S * (1 - out);
		set(phone, { transform: `translateY(${px((1 - land) * H * 0.55 - out * H * 1.1 + float)}) rotate(${((1 - land) * -9 + out * 6).toFixed(3)}deg) scale(${(1.14 - 0.14 * land).toFixed(4)})` });
		// Words slide out from behind the phone, and part when it leaves.
		const wIn = E.softLand(prog(l, 0.28, 0.5));
		const part = E.accelExit(prog(l, tExit - 0.03, 0.32));
		if (vertical) set(leadN, { transform: `translateY(${px((1 - wIn) * boxH - part * boxH * 1.1)})` });
		else set(leadN, { transform: `translateX(${px((1 - wIn) * (leadW + 40 * S) - part * W * 0.5)})` });
		tailNs.forEach((t, k) => {
			const enter = k === 0 ? wIn : E.softLand(prog(l, swapAt[k] + 0.06, 0.36));
			const exit = k < n - 1 ? E.accelExit(prog(l, swapAt[k + 1] - 0.04, 0.16)) : 0;
			const on = k === 0 || l >= swapAt[k] + 0.06;
			let tr;
			if (k === 0 && vertical) tr = `translateY(${px(-(1 - enter) * boxH - exit * boxH)})`;
			else if (k === 0) tr = `translateX(${px(-(1 - enter) * (wordWs[0] + 40 * S))}) translateY(${px(-exit * boxH)})`;
			else tr = `translateY(${px((1 - enter) * boxH * 0.9 - exit * boxH)})`;
			if (k === n - 1) tr += vertical ? ` translateY(${px(part * boxH * 1.1)})` : ` translateX(${px(part * W * 0.5)})`;
			set(t, { opacity: on && exit < 1 ? "1" : "0", transform: tr });
		});
		// Pages push in from the right; the one underneath slides a third and darkens.
		pages.forEach((pg, k) => {
			const enter = k === 0 ? 1 : E.softLand(prog(l, swapAt[k], 0.42));
			const under = k < n - 1 ? E.softLand(prog(l, swapAt[k + 1], 0.42)) : 0;
			set(pg, { transform: `translateX(${px((1 - enter) * sw - under * sw * 0.3)})`, filter: under > 0.01 ? `brightness(${(1 - under * 0.25).toFixed(3)})` : "none" });
		});
		// The final tap: the button presses, folds into a circle and draws a check.
		const press = l >= tTap - 0.03 && l < tTap + 0.09 ? 1 : 0;
		const fold = E.snapSettle(prog(l, tTap + 0.06, 0.34));
		const w = bw + (bh - bw) * fold;
		set(btn, { width: px(w), left: px((sw - w) / 2), transform: `scale(${(1 - 0.06 * press).toFixed(4)})` });
		set(btnTxt, { opacity: (1 - clamp(fold * 3)).toFixed(3) });
		chk.setAttribute("stroke-dashoffset", (24 * (1 - E.softLand(prog(l, tTap + 0.22, 0.3)))).toFixed(2));
		const bk = prog(l, tTap + 0.26, 0.5);
		rays.forEach((r, i) => {
			const a = (i / rays.length) * Math.PI * 2 - Math.PI / 2;
			const dist = bh * (0.75 + E.whip(bk) * 0.7);
			set(r, { opacity: bk > 0 && bk < 1 ? (1 - bk).toFixed(3) : "0", transform: `translate(${px(Math.cos(a) * dist)}, ${px(Math.sin(a) * dist)}) rotate(${a}rad) scaleX(${(1 - bk * 0.7).toFixed(3)})` });
		});
		touch(l, taps);
		// A slow push the whole time.
		set(world, { transform: `scale(${(1 + clamp(l / d0) * 0.035).toFixed(4)})` });
	};
};

// ---- drag: files go into the product ---------------------------------------------------------------
// Files lie on the desk; the cursor picks each one up (it lifts, tilts with the move), drops it
// into the product's drop zone, where it uploads and gets a check. Each drag is quicker than the
// last. Then the cursor clicks the button and the line lands where the files were.
sceneFactories.drag = ({ p, cam, fg, accent, palette, bg, K }) => {
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
// ---- knockout: zoom through the type ---------------------------------------------------------------
// The frame is the background with one giant word cut out of it; the product shows through the
// letters. The camera dives into the thickest stroke of the word until the product fills the frame,
// then the product settles into a card and the line lands above it. The classic after-effects
// zoom-through, done with a real mask so the letters stay sharp at any scale.
sceneFactories.knockout = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, alpha, mockUI, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const word = DOUBLE(s.word || "Launch");
	const pic = s.image ? K.images[s.image] : null;

	// The product, full frame, behind everything.
	const plate = el("div", "", cam);
	set(plate, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), overflow: "hidden", transformOrigin: "50% 50%", willChange: "transform", background: "#ffffff" });
	D.surface(plate, "card", { layout: "frame", purpose: "media" });
	if (pic) {
		const im = el("img", "fill", plate);
		im.src = pic.src;
		set(im, { width: "100%", height: "100%", objectFit: "cover" });
	} else {
		const inner = el("div", "", plate);
		set(inner, { position: "relative", width: "100%", height: "100%" });
		mockUI(inner, palette, accent, 3, vertical ? "inbox" : "dashboard");
	}

	// The word's look, taken from the style's display type.
	const probe = el("div", "display", cam, word);
	set(probe, { position: "absolute", visibility: "hidden", whiteSpace: "pre" });
	const maskRole = /\s/.test(word) ? "display" : "hero";
	D.fitLine(probe, W * (vertical ? .9 : .86), H * (vertical ? .3 : .62), maskRole);
	const maskSpec = D.type(maskRole, Number(probe.dataset.designStep));
	const cs = getComputedStyle(probe);
	const upper = cs.textTransform === "uppercase";
	const shown = upper ? word.toUpperCase() : word;
	const fam = cs.fontFamily;
	const wt = cs.fontWeight;
	const st = cs.fontStretch;
	const ls200 = parseFloat(cs.letterSpacing) || 0;
	const w200 = probe.offsetWidth;
	probe.remove();
	const fs = maskSpec.size;
	const ls = ls200;

	// Find the point inside the letters with the most room around it (a distance transform on a
	// small canvas), so the dive lands in a stroke and the hole opens evenly.
	const cw = 520;
	const scale = cw / W;
	const ch = Math.ceil(H * scale);
	const cv = document.createElement("canvas");
	cv.width = cw;
	cv.height = ch;
	const g = cv.getContext("2d");
	g.font = `${st && st !== "normal" && st !== "100%" ? st + " " : ""}${wt} ${fs * scale}px ${fam}`;
	try {
		g.letterSpacing = `${ls * scale}px`;
	} catch {}
	g.textAlign = "center";
	g.textBaseline = "middle";
	g.fillStyle = "#000";
	cv.dataset.designRaster = JSON.stringify([{ ...maskSpec, unit: maskSpec.unit * scale, size: fs * scale, lineHeight: maskSpec.lineHeight * scale, text: shown }]);
	g.fillText(shown, cw / 2, ch / 2);
	const data = g.getImageData(0, 0, cw, ch).data;
	const INF = 1e9;
	const dist = new Float32Array(cw * ch);
	for (let i = 0; i < cw * ch; i++) dist[i] = data[i * 4 + 3] > 128 ? INF : 0;
	for (let y = 0; y < ch; y++)
		for (let x = 0; x < cw; x++) {
			const i = y * cw + x;
			if (!dist[i]) continue;
			let v = dist[i];
			if (x > 0) v = Math.min(v, dist[i - 1] + 1);
			if (y > 0) v = Math.min(v, dist[i - cw] + 1);
			if (x > 0 && y > 0) v = Math.min(v, dist[i - cw - 1] + 1.414);
			if (x < cw - 1 && y > 0) v = Math.min(v, dist[i - cw + 1] + 1.414);
			dist[i] = v;
		}
	for (let y = ch - 1; y >= 0; y--)
		for (let x = cw - 1; x >= 0; x--) {
			const i = y * cw + x;
			if (!dist[i]) continue;
			let v = dist[i];
			if (x < cw - 1) v = Math.min(v, dist[i + 1] + 1);
			if (y < ch - 1) v = Math.min(v, dist[i + cw] + 1);
			if (x < cw - 1 && y < ch - 1) v = Math.min(v, dist[i + cw + 1] + 1.414);
			if (x > 0 && y < ch - 1) v = Math.min(v, dist[i + cw - 1] + 1.414);
			dist[i] = v;
		}
	let best = -1;
	let bx = cw / 2;
	let by = ch / 2;
	let br = 1;
	for (let y = 0; y < ch; y++)
		for (let x = 0; x < cw; x++) {
			const v = dist[y * cw + x];
			if (!v || v >= INF) continue;
			// Prefer strokes near the middle of the frame: the dive reads as straight ahead.
			const off = Math.hypot((x - cw / 2) / cw, (y - ch / 2) / ch);
			const score = v * (1 - off * 0.9);
			if (score > best) {
				best = score;
				bx = x;
				by = y;
				br = v;
			}
		}
	const P = { x: bx / scale, y: by / scale };
	const r = Math.max(4 * S, br / scale);
	const far = Math.max(Math.hypot(P.x, P.y), Math.hypot(W - P.x, P.y), Math.hypot(P.x, H - P.y), Math.hypot(W - P.x, H - P.y));
	const Zmax = (far / r) * 1.15;

	// The cut-out: the background with the word as a hole, a real SVG mask.
	const ns = "http://www.w3.org/2000/svg";
	const mk = (tag, attrs) => {
		const n = document.createElementNS(ns, tag);
		for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
		return n;
	};
	const svg = mk("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
	set(svg, { position: "absolute", left: "0", top: "0", overflow: "visible", transformOrigin: `${px(P.x)} ${px(P.y)}`, willChange: "transform" });
	const id = K.uid('cutout-mask');
	const big = { x: -W * 2, y: -H * 2, width: W * 5, height: H * 5 };
	const defs = mk("defs", {});
	const mask = mk("mask", { id, maskUnits: "userSpaceOnUse", ...big });
	mask.appendChild(mk("rect", { ...big, fill: "#fff" }));
	const tx = mk("text", { x: W / 2, y: H / 2, fill: "#000", "text-anchor": "middle", "dominant-baseline": "central" });
	tx.textContent = shown;
	D.apply(tx, maskRole, { step: maskSpec.step });
	svg.dataset.designRaster = JSON.stringify([{ ...maskSpec, text: shown }]);
	mask.appendChild(tx);
	defs.appendChild(mask);
	svg.appendChild(defs);
	// On a pale background the plate goes dark, so a white product reads through the letters.
	const plateCol = s.cover ?? (K.lum(bg) > 0.55 ? "#111214" : bg);
	svg.appendChild(mk("rect", { ...big, fill: plateCol, mask: `url(#${id})` }));
	cam.appendChild(svg);

	// The line that lands once the product has settled.
	const line = String(s.text || "");
	const capBox = el("div", "display", cam);
	const capFs = D.type("sceneTitle").size;
	set(capBox, { position: "absolute", left: px(W * 0.06), width: px(W * 0.88), top: px(vertical ? H * 0.09 : H * 0.045), textAlign: "center", color: fg });
	D.apply(capBox,"sceneTitle");
	const capWords = [];
	line
		.split(/\s+/)
		.filter(Boolean)
		.forEach((wd, i) => {
			if (i) capBox.appendChild(document.createTextNode(" "));
			const clip = el("span", "", capBox);
			set(clip, { display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.12em", marginBottom: "-0.12em" });
			const em = /^\*.*\*[.,!?]?$/.test(wd);
			const inner = el("span", "", clip, wd.replace(/\*/g, ""));
			set(inner, { display: "inline-block", color: em ? accent : fg });
			if (em && K.plan?.look?.display?.accent === "serif") inner.style.fontStyle = "italic";
			capWords.push(inner);
		});
	const capH = capBox.offsetHeight;

	// Timing.
	const tZoom = Math.min(1.0, d0 * 0.28);
	const zDur = 0.85;
	const tSettle = tZoom + zDur + 0.25;
	const settleTo = line ? (vertical ? 0.8 : 0.76) : 0.86;
	const settleY = line ? (vertical ? H * 0.06 : (capH + H * 0.07) / 2) : 0;

	return (l) => {
		// The word arrives from oversize, holds with a slow push, then the dive.
		const arrive = E.softLand(prog(l, 0, 0.55));
		const hold = 1 + clamp(l / Math.max(0.1, tZoom)) * 0.05;
		const zk = prog(l, tZoom, zDur);
		const Z = Math.pow(Zmax, E.gentleIn(zk));
		const s0 = (1.12 - 0.12 * arrive) * hold * Z;
		set(svg, { transform: `scale(${s0.toFixed(5)})`, opacity: zk >= 1 ? "0" : "1" });
		// The product behind moves slower than the type: depth.
		const pIn = 1.32 - 0.32 * E.softLand(prog(l, tZoom + zDur * 0.35, zDur * 0.9));
		const st2 = E.softInOut(prog(l, tSettle, 0.7));
		const sc = pIn * (1 + (settleTo - 1) * st2);
		D.surfaceRadius(plate, { from: "square", to: "rounded", progress: st2, scaleX: sc, scaleY: sc });
		set(plate, { transform: `translateY(${px(settleY * st2)}) scale(${sc.toFixed(5)})`, boxShadow: st2 > 0.01 ? `0 ${px(30 * S * st2)} ${px(80 * S * st2)} ${alpha("#000000", 0.25 * st2)}` : "none" });
		capWords.forEach((w, i) => {
			const k = E.softLand(prog(l, tSettle + 0.25 + i * 0.06, 0.5));
			set(w, { opacity:k>0?"1":"0",transform: `translateY(${((1 - k) * 105).toFixed(2)}%)` });
		});
	};
};
// ---- assemble: a ransom-note word resolves into one clean word -------------------------------------
// Every letter arrives on its own scrap of paper in a different face (a serif italic, a condensed
// black, a mono, a hairline), flickers through a couple more, then the scraps drop away and the
// letters glide into the shared brand headline. Seen in Oddfellows' launch films: the collage settles.
sceneFactories.assemble = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, mixHex, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const word = DOUBLE(s.word || "Intelligence.");
	const sub = s.text ? String(s.text) : "";
	const light = lum(bg) > 0.45;
	const ink = light ? "#161616" : "#f2efe8";
	const FACES = [
		{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontWeight: "400", fontStretch: "100%", up: false, k: 1.1 },
		{ fontFamily: '"Archivo", sans-serif', fontStyle: "normal", fontWeight: "900", fontStretch: "62%", up: true, k: 1.0 },
		{ fontFamily: '"Geist Mono", monospace', fontStyle: "normal", fontWeight: "700", fontStretch: "100%", up: false, k: 0.82 },
		{ fontFamily: '"Geist", sans-serif', fontStyle: "normal", fontWeight: "200", fontStretch: "100%", up: false, k: 1.0 },
		{ fontFamily: '"Archivo", sans-serif', fontStyle: "normal", fontWeight: "800", fontStretch: "125%", up: true, k: 0.8 },
		{ fontFamily: '"Instrument Serif", serif', fontStyle: "normal", fontWeight: "400", fontStretch: "100%", up: true, k: 1.05 },
	];
	const FINAL = {fontFamily:"var(--fd)",fontStyle:"normal",fontWeight:"700",fontStretch:"normal"};
	const scrapCols = [palette.paper ?? "#f4f0e6", "#ffffff", palette.butter, palette.sky, palette.lilac, palette.coral, "#1a1a1a", accent].filter(Boolean);

	// Final layout: the shared hero role, measured letter by letter.
	let textSpec=D.type("hero"),fs=textSpec.size;
	const row = el("div", "", cam);
	const layout = () => {
		row.innerHTML = "";
		set(row, { position: "absolute", left: "0", top: "0", whiteSpace: "pre", visibility: "hidden", ...FINAL });
		D.apply(row,"hero",{step:textSpec.step});
		const spans = [...word].map((c) => el("span", "", row, c));
		return { w: row.offsetWidth, spans };
	};
	let m = layout();
	for(const candidate of D.steps("hero")){textSpec=candidate;fs=candidate.size;m=layout();if(m.w<=W*(vertical?.86:.74))break;}
	if(m.w>W*.9)throw new Error("Assemble word exceeds hero capacity");
	const x0 = (W - m.w) / 2;
	const yMid = H / 2 - (sub ? fs * 0.18 : 0);
	const slots = m.spans.map((sp) => ({ cx: x0 + sp.offsetLeft + sp.offsetWidth / 2, w: sp.offsetWidth }));
	row.remove();

	const wordGroup=el("div","word",cam);
	set(wordGroup,{position:"absolute",inset:"0"});
	const letters = [...word].map((c, k) => {
		const h1 = hash(k * 7.13 + 1.7);
		const h2 = hash(k * 3.71 + 9.2);
		const h3 = hash(k * 5.29 + 4.4);
		const wrap = el("div", "", wordGroup);
		set(wrap, { position: "absolute", left: "0", top: "0", willChange: "transform" });
		const scrap = el("div", "", wrap);
		const col = scrapCols[Math.floor(h2 * scrapCols.length)];
		const dark = lum(col) < 0.35;
		set(scrap, { position: "absolute", left: "50%", top: "50%", background: col, transform: "translate(-50%,-50%)", boxShadow: `0 ${px(6 * S)} ${px(16 * S)} rgba(0,0,0,0.16)` });
		const g = el("div", "glyph", wrap, c);
		set(g, { position: "absolute", left: "0", top: "0", transform: "translate(-50%,-50%)", whiteSpace: "pre", color: dark ? "#f4f1ea" : col === accent ? K.textOn(accent) : "#161616" });
		D.apply(g,"hero",{step:textSpec.step});
		g.dataset.designMotion="type-collage";
		if (c === " ") set(scrap, { display: "none" });
		const faces = [0, 1, 2].map((j) => Math.floor(hash(k * 11.3 + j * 2.9) * FACES.length));
		return {
			c,
			wrap,
			scrap,
			g,
			faces,
			size: 0.78 + h1 * 0.5,
			rot: (h3 - 0.5) * 22,
			jx: (hash(k * 2.2 + 0.4) - 0.5) * fs * 0.22,
			jy: (hash(k * 8.8 + 1.1) - 0.5) * fs * 0.42,
			padX: 0.1 + h2 * 0.12,
			padY: 0.04 + h1 * 0.1,
			darkInk: dark,
		};
	});

	const n = letters.length;
	const stag = Math.min(0.07, 0.6 / Math.max(1, n));
	const tFlick = 0.25 + n * stag;
	const tResolve = tFlick + 0.55;
	const resDur = 0.6;
	// The sub line, under the word, rising through its own edge.
	let subN = null;
	let subInner = null;
	if (sub) {
		subN = el("div", "", cam);
		set(subN, { position: "absolute", left: "0", width: px(W), top: px(yMid + fs * 0.62), textAlign: "center", overflow: "hidden", color: fg, opacity: "0.8" });
		D.apply(subN,"caption");
		subInner = el("div", "", subN, sub.replace(/\*/g, ""));
		set(subInner, { display: "inline-block" });
	}

	return (l, d) => {
		letters.forEach((L, k) => {
			const slot = slots[k];
			// Which face: arrive in one, flicker through two more, then the final brand face.
			const tArr = 0.05 + k * stag;
			const fi = l < tFlick + hash(k * 4.1) * 0.15 ? 0 : l < tFlick + 0.22 + hash(k * 6.7) * 0.15 ? 1 : 2;
			const resolved = l >= tResolve + k * 0.02;
			const F = FACES[L.faces[fi]];
			const sz = resolved ? fs : fs * L.size * F.k;
			set(L.g, resolved ? {...FINAL,textTransform:"none",color:ink,transform:"translate(-50%,-50%)"} : {fontFamily:F.fontFamily,fontStyle:F.fontStyle,fontWeight:F.fontWeight,fontStretch:F.fontStretch,textTransform:F.up?"uppercase":"none",color:L.darkInk?"#f4f1ea":"#161616",transform:`translate(-50%,-50%) scale(${(sz/fs).toFixed(4)})`});
			// Scrap sized to the letter in its current face.
			const gw = L.g.offsetWidth;
			const gh = L.g.offsetHeight;
			const drop = E.accelExit(prog(l, tResolve - 0.05 + k * 0.02, 0.32));
			set(L.scrap, { width: px(gw + sz * L.padX * 2), height: px(gh * 0.78 + sz * L.padY * 2), opacity: (1 - drop).toFixed(3), transform: `translate(-50%,-50%) translateY(${px(drop * fs * 0.5)}) rotate(${(drop * L.rot * 1.5).toFixed(2)}deg) scale(${(1 - 0.3 * drop).toFixed(3)})` });
			// Position: land messy from oversize, glide clean on resolve.
			const a = E.softLand(prog(l, tArr, 0.42));
			const r = E.softInOut(prog(l, tResolve + k * 0.02, resDur));
			const mx = slot.cx + L.jx;
			const my = yMid + L.jy;
			const x = mx + (slot.cx - mx) * r;
			const y = my + (yMid - my) * r;
			const rot = L.rot * (1 - r);
			const sc = (1.7 - 0.7 * a) * (1 + 0.03 * Math.sin(l * 9 + k) * (1 - r) * (l > tArr + 0.4 ? 1 : 0));
			set(L.wrap, { opacity: clamp(a * 4).toFixed(3), transform: `translate(${px(x)}, ${px(y)}) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(4)})` });
		});
		if (subN) {
			const k = E.softLand(prog(l, tResolve + resDur * 0.7, 0.5));
			set(subInner, { opacity:k>0?"1":"0",transform: `translateY(${((1 - k) * 110).toFixed(1)}%)` });
		}
	};
};

// ---- hive: the product's pieces gather around its mark ----------------------------------------------
// A honeycomb of empty slots opens around the logo; the product's tools fly in from off frame and
// land in their slots, a couple of them name themselves, then the whole hive pulls into the mark and
// the name lands beside it. Seen in Enobase's launch film.
sceneFactories.hive = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, alpha, logoNode, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const light = lum(bg) > 0.45;
	const icons = (s.icons?.length ? s.icons : ["📅", "💬", "📊", "🧾", "📁", "✉️", "🧠", "⚡"]).slice(0, 12);
	const labels = (s.labels ?? []).map(DOUBLE).slice(0, 3);
	const name = DOUBLE(s.word || K.plan.brand?.name || "");
	const tile = Math.min(W, H) * (vertical ? 0.15 : 0.135);
	const sp = tile * 1.32;
	// Axial hex positions, ring by ring.
	const slots = [];
	const dirs = [
		[1, 0],
		[0, 1],
		[-1, 1],
		[-1, 0],
		[0, -1],
		[1, -1],
	];
	for (let ring = 1; ring <= 2; ring++) {
		let q = dirs[4][0] * ring;
		let r = dirs[4][1] * ring;
		for (let side = 0; side < 6; side++)
			for (let st = 0; st < ring; st++) {
				slots.push({ q, r, ring });
				q += dirs[side][0];
				r += dirs[side][1];
			}
	}
	const pos = (sl) => ({ x: W / 2 + sp * (sl.q + sl.r / 2), y: H / 2 + sp * sl.r * 0.866 });
	const world = el("div", "", cam);
	set(world, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), transformOrigin: "50% 50%" });
	const empties = slots.map((sl) => {
		const n = el("div", "", world);
		const P = pos(sl);
		set(n, { position: "absolute", left: px(P.x - tile / 2), top: px(P.y - tile / 2), width: px(tile), height: px(tile), borderRadius: px(tile * .26), background: alpha(light ? "#000000" : "#ffffff", 0.045), willChange: "transform" });
		return { n, P, ring: sl.ring };
	});
	// Which slots get a tool: spread around both rings.
	const order = slots.map((_, i) => i).sort((a, b) => hash(a * 3.3 + 1) - hash(b * 3.3 + 1));
	const used = order.slice(0, icons.length);
	const tiles = icons.map((ic, k) => {
		const si = used[k];
		const P = pos(slots[si]);
		const n = el("div", "", world);
		set(n, { position: "absolute", left: "0", top: "0", width: px(tile), height: px(tile), borderRadius: px(tile * 0.26), background: light ? "#ffffff" : "#1c1f27", boxShadow: `0 ${px(tile * 0.08)} ${px(tile * 0.25)} ${alpha("#000000", light ? 0.13 : 0.4)}, 0 0 0 ${px(1.5 * S)} ${alpha(light ? "#000000" : "#ffffff", 0.06)}`, display: "flex", alignItems: "center", justifyContent: "center", willChange: "transform", zIndex: "3" });
		D.forSurface(tile/(D.unit*48)).apply(n,"cardTitle");
		n.textContent = ic;
		const ang = hash(k * 5.7 + 2.1) * Math.PI * 2;
		const far = Math.max(W, H) * 0.75;
		return { n, P, from: { x: W / 2 + Math.cos(ang) * far, y: H / 2 + Math.sin(ang) * far }, rot: (hash(k * 1.9) - 0.5) * 60 };
	});
	const labelNs = labels.map((t, k) => {
		const n = el("div", "bold", world);
		set(n, { position: "absolute", left: "0", top: "0", background: light ? "#111111" : "#ffffff", color: light ? "#ffffff" : "#111111", whiteSpace: "nowrap", zIndex: "6", opacity: "0", transformOrigin: "0 50%" });
		D.surface(n, "badge", { density: "compact", shape: "pill" });
		D.apply(n,"label");
		const label = el("div", "", n, t);
		set(label, { maxWidth: px(K.safe.w * .4 - D.box("badge", { density: "compact" }).paddingX * 2) });
		D.truncateLine(label);label.title = t;
		return n;
	});
	const core = logoNode(world, tile * 1.15, accent);
	set(core, { position: "absolute", left: px(W / 2 - tile * 0.575), top: px(H / 2 - tile * 0.575), zIndex: "5", boxShadow: `0 ${px(tile * 0.1)} ${px(tile * 0.4)} ${alpha(accent, 0.45)}`, willChange: "transform" });
	const nameN = el("div", "display", world, name);
	set(nameN, { position: "absolute", left: "0", top: "0", color: fg, whiteSpace: "pre", opacity: "0", zIndex: "5" });
	D.apply(nameN,"display");
	D.fitLine(nameN,K.safe.w-tile*1.5,H*.2,"display");
	const nameW = nameN.offsetWidth;
	const gapN = tile * 0.35;

	const tIcons = 0.35;
	const stag = Math.min(0.08, 0.9 / icons.length);
	const tLabels = tIcons + icons.length * stag + 0.35;
	const tPull = Math.max(tLabels + labels.length * 0.45 + 0.3, p.dur * 0.62);

	return (l) => {
		const pull = E.accelExit(prog(l, tPull, 0.42));
		// Empty slots open ring by ring, from oversize.
		empties.forEach((e) => {
			const k = E.softLand(prog(l, 0.04 + e.ring * 0.08, 0.45));
			const px2 = W / 2 + (e.P.x - W / 2) * (1 - pull);
			const py2 = H / 2 + (e.P.y - H / 2) * (1 - pull);
			set(e.n, { opacity: (clamp(k * 3) * (1 - pull)).toFixed(3), transform: `translate(${px(px2 - e.P.x)}, ${px(py2 - e.P.y)}) scale(${(1.25 - 0.25 * k).toFixed(4)})` });
		});
		tiles.forEach((t, k) => {
			const a = E.softLand(prog(l, tIcons + k * stag, 0.55));
			let x = t.from.x + (t.P.x - t.from.x) * a;
			let y = t.from.y + (t.P.y - t.from.y) * a;
			x = W / 2 + (x - W / 2) * (1 - pull);
			y = H / 2 + (y - H / 2) * (1 - pull);
			set(t.n, { opacity: (1 - clamp((pull - 0.7) / 0.3)).toFixed(3), transform: `translate(${px(x - tile / 2)}, ${px(y - tile / 2)}) rotate(${(t.rot * (1 - a)).toFixed(2)}deg) scale(${((1 + 0.25 * (1 - a)) * (1 - 0.6 * pull)).toFixed(4)})` });
		});
		labelNs.forEach((n, k) => {
			const t = tiles[k % tiles.length];
			const on = E.snapSettle(prog(l, tLabels + k * 0.45, 0.3));
			const off = E.accelExit(prog(l, tLabels + k * 0.45 + 0.75, 0.2));
			set(n, { opacity: (on * (1 - off)).toFixed(3), transform: `translate(${px(t.P.x + tile * 0.55)}, ${px(t.P.y - tile * 0.62)}) scale(${(0.9 + 0.1 * on).toFixed(4)})` });
		});
		// The mark: arrives first, then takes everything in and moves aside for the name.
		const ca = E.softLand(prog(l, 0, 0.45));
		const bump = l > tPull + 0.34 ? E.popOver(clamp((l - tPull - 0.34) / 0.45)) : 1;
		const slide = name ? E.softInOut(prog(l, tPull + 0.4, 0.6)) : 0;
		const total = tile * 1.15 + gapN + nameW;
		const cx = W / 2 + (-(total / 2) + tile * 0.575) * slide;
		set(core, { transform: `translate(${px(cx - W / 2)}, 0) scale(${((1.4 - 0.4 * ca) * (l > tPull + 0.34 ? 0.92 + 0.08 * bump : 1) * (1 + 0.25 * slide)).toFixed(4)})` });
		const nk = E.softLand(prog(l, tPull + 0.55, 0.5));
		set(nameN, { opacity: clamp(nk * 3).toFixed(3), transform: `translate(${px(cx + tile * 0.575 * 1.25 + gapN + (1 - nk) * 30 * S)}, ${px(H / 2 - tile * 0.52)})` });
	};
};
// ---- scatter: a sentence spread over the frame, with things between the words ----------------------
// "To  [phone]  book  a  [pen]  job." The words sit loose across the frame in reading order, small,
// and objects drop into the gaps between them. Then everything leaves except the *key* word, which
// glides to the centre and grows. Seen in Abdullah's launch films for ClickUp and ElevenLabs.
sceneFactories.scatter = ({ p, cam, fg, accent, palette, bg, K }) => {
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
// ---- arc: photos on a curve under a small line -----------------------------------------------------
// A short line sits high and small; below it a strip of photos rides an arc, the middle one biggest,
// drifting sideways the whole time, while the line's *word* rolls through options. Seen in Enobase.
sceneFactories.arc = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, alpha, mixHex, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const pics = (s.images ?? []).map((u) => K.images[u]).filter(Boolean);
	const text = String(s.text || "Your business is *different*");
	const alts = (s.words ?? []).map(DOUBLE).slice(0, 3);
	const n = vertical ? 7 : 11;
	const cw = vertical ? W * 0.3 : W * 0.15;
	const chh = cw * 1.3;
	const cy = H * (vertical ? 0.6 : 0.62);
	const strip = el("div", "", cam);
	set(strip, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), perspective: px(1600 * S) });
	const cols = [palette.coral, palette.sky, palette.butter, palette.lilac, palette.lime, accent].filter(Boolean);
	const cards = Array.from({ length: n + 2 }, (_, i) => {
		const c = el("div", "", strip);
		set(c, { position: "absolute", left: "0", top: "0", width: px(cw), height: px(chh), overflow: "hidden", boxShadow: `0 ${px(18 * S)} ${px(40 * S)} ${alpha("#000000", 0.22)}`, willChange: "transform" });
		D.surface(c, "card", { layout: "frame", purpose: "media" });
		const pic = pics.length ? pics[i % pics.length] : null;
		if (pic) {
			const im = el("img", "fill", c);
			im.src = pic.src;
			set(im, { width: "100%", height: "100%", objectFit: "cover" });
		} else {
			// No photos: soft colour studies, two tones and a horizon, never grey boxes.
			const a = cols[i % cols.length];
			const b = cols[(i + 2) % cols.length];
			set(c, { background: `linear-gradient(${160 + hash(i) * 40}deg, ${mixHex(a, "#ffffff", 0.25)} 0%, ${mixHex(b, "#000000", 0.15)} 100%)` });
			const sun = el("div", "", c);
			set(sun, { position: "absolute", left: `${20 + hash(i * 3) * 50}%`, top: `${15 + hash(i * 5) * 30}%`, width: px(cw * 0.26), height: px(cw * 0.26), borderRadius: "50%", background: alpha("#ffffff", 0.7) });
		}
		return c;
	});
	// The line, small and high, with the rolling word.
	const line = el("div", "display", cam);
	const fs = D.type("sceneTitle").size;
	const lineWidth = K.safe.w * 0.94;
	set(line, { position: "absolute", left: px((W - lineWidth) / 2), width: px(lineWidth), top: px(H * (vertical ? 0.22 : 0.17)), textAlign: "center", color: fg, whiteSpace: "normal" });
	D.apply(line,"sceneTitle");
	const parts = text.split(/(\*[^*]+\*)/).filter(Boolean);
	const pieces = [];
	let roller = null;
	const options = [];
	parts.forEach((pt) => {
		if (/^\*.*\*$/.test(pt)) {
			const box = el("span", "", line);
			set(box, { display: "inline-block", position: "relative", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.14em", marginBottom: "-0.14em" });
			const all = [pt.slice(1, -1), ...alts];
			all.forEach((w, k) => {
				const o = el("span", "", box, w);
				set(o, { display: "inline-block", color: accent, position: k ? "absolute" : "relative", left: "0", top: "0", whiteSpace: "pre" });
				if (K.plan?.look?.display?.accent === "serif") o.style.fontStyle = "italic";
				options.push(o);
			});
			roller = box;
		} else
			pt.split(/(\s+)/).forEach((w) => {
				if (!w) return;
				if (/^\s+$/.test(w)) return void line.appendChild(document.createTextNode(" "));
				const clip = el("span", "", line);
				set(clip, { display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.14em", marginBottom: "-0.14em" });
				const inner = el("span", "", clip, w);
				set(inner, { display: "inline-block" });
				pieces.push(inner);
			});
	});
	// Fit the longest rolling option in a wrapping headline. The shared label
	// floor stays intact even when a valid sentence needs more than one line.
	{
		const first = options[0]?.textContent;
		if (options.length) options[0].textContent = options.reduce((a, b) => a.scrollWidth > b.scrollWidth ? a : b).textContent;
		D.fitSize(line,lineWidth,H*(vertical?.3:.32),"sceneTitle");
		if (options.length) options[0].textContent = first;
	}
	// The roller keeps the width of whichever option is showing, so the line stays centred.
	const optW = options.map((o) => o.offsetWidth);
	const swapAt = options.map((_, k) => 0.7 + k * Math.max(0.6, (d0 * 0.6) / Math.max(1, options.length)));
	const spacing = cw * 1.12;
	const speed = cw * 0.55;
	return (l) => {
		const off = l * speed + E.accelExit(prog(l, d0 - 0.45, 0.45)) * W * 0.4;
		cards.forEach((c, i) => {
			let x = i * spacing - off;
			const span = spacing * cards.length;
			x = ((((x + spacing) % span) + span) % span) - spacing;
			const rel = (x + cw / 2 - W / 2) / (W / 2);
			const ar = clamp(Math.abs(rel), 0, 1.4);
			const rise = E.softLand(prog(l, 0.05 + clamp((rel + 1) / 2) * 0.35, 0.6));
			const sc = 1.18 - 0.5 * ar * ar;
			const y = cy - chh / 2 + ar * ar * H * 0.15 + (1 - rise) * H * 0.5;
			set(c, { transform: `translate(${px(x)}, ${px(y)}) rotateY(${(-rel * 30).toFixed(2)}deg) rotateZ(${(rel * 7).toFixed(2)}deg) scale(${sc.toFixed(4)})`, zIndex: String(100 - Math.round(ar * 50)), opacity: clamp(1.5 - ar).toFixed(3) });
		});
		pieces.forEach((w, i) => {
			const k = E.softLand(prog(l, 0.15 + i * 0.05, 0.5));
			set(w, { transform: `translateY(${((1 - k) * 105).toFixed(1)}%)` });
		});
		let cur = 0;
		options.forEach((o, k) => {
			if (l >= swapAt[k] && k > 0) cur = k;
		});
		options.forEach((o, k) => {
			const enter = k === 0 ? E.softLand(prog(l, 0.15 + pieces.length * 0.05, 0.5)) : E.softLand(prog(l, swapAt[k], 0.4));
			const exit = k < options.length - 1 ? E.accelExit(prog(l, swapAt[k + 1] - 0.05, 0.2)) : 0;
			set(o, { transform: `translateY(${((1 - enter) * 135 - exit * 135).toFixed(1)}%)`, opacity: (k === 0 || l >= swapAt[k]) && exit < 1 ? "1" : "0" });
		});
		if (roller && options.length > 1) {
			const prev = optW[Math.max(0, cur - 1)];
			const w = prev + (optW[cur] - prev) * E.softInOut(prog(l, swapAt[cur], 0.35));
			set(roller, { width: px(cur ? w : optW[0]) });
		}
	};
};

// ---- orb: a living gradient sphere and a few calm lines -------------------------------------------
// A glowing sphere of the brand's colours, the colours turning slowly inside it, breathing; it
// arrives soft and oversized, pulses as each short line takes its turn below it. Seen in
// Abdullah's ElevenLabs film: the product as a presence, not a screen.
sceneFactories.orb = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, lum, alpha, mixHex, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const lines = (s.lines?.length ? s.lines : [s.text || K.plan?.brand?.name || ""]).map(DOUBLE).slice(0, 3);
	const R = Math.min(W, H) * (vertical ? 0.3 : 0.24);
	const ocx = W / 2;
	const ocy = H * (vertical ? 0.42 : 0.42);
	// Sci-fi: not a soft gradient ball but a star, a hot core in the warm colours with a dark limb
	// and thin metal rings turning round it.
	const star = !!K.plan?.look?.deco?.hud;
	const cols = star
		? [palette.lime ?? accent, palette.peach ?? "#ff7a2f", palette.butter ?? "#ffd59a", palette.coral ?? "#ff5a2a", palette.lime ?? accent, "#fff3dc"]
		: [accent, palette.sky ?? "#7cc6ff", palette.lilac ?? "#c9b6ff", palette.butter ?? "#ffe27a", palette.coral ?? "#ff8a73", palette.lime ?? "#c6f36b"];
	const rings = star
		? [0, 1, 2].map((i) => {
				const r = el("div", "", cam);
				const rr = R * (1.55 + i * 0.32);
				set(r, { position: "absolute", left: px(ocx - rr), top: px(ocy - rr), width: px(rr * 2), height: px(rr * 2), borderRadius: "50%", boxSizing: "border-box", border: `${px((2.4 - i * 0.6) * S)} solid ${alpha("#d9dde3", 0.55 - i * 0.12)}`, boxShadow: `0 0 ${px(14 * S)} ${alpha(palette.lime ?? accent, 0.25)}`, willChange: "transform" });
				return { r, tilt: 68 + i * 6, spin: (i % 2 ? -1 : 1) * (14 + i * 6), base: i * 50 };
			})
		: [];
	const glow = el("div", "", cam);
	set(glow, { position: "absolute", left: px(ocx - R * 2), top: px(ocy - R * 2), width: px(R * 4), height: px(R * 4), borderRadius: "50%", background: `radial-gradient(circle, ${alpha(accent, 0.35)} 0%, ${alpha(cols[1], 0.18)} 35%, transparent 65%)` });
	const ball = el("div", "", cam);
	set(ball, { position: "absolute", left: px(ocx - R), top: px(ocy - R), width: px(R * 2), height: px(R * 2), borderRadius: "50%", overflow: "hidden", willChange: "transform", boxShadow: `0 ${px(R * 0.15)} ${px(R * 0.6)} ${alpha(accent, 0.35)}` });
	const swirlA = el("div", "", ball);
	set(swirlA, { position: "absolute", left: px(-R * 0.5), top: px(-R * 0.5), width: px(R * 3), height: px(R * 3), background: `conic-gradient(from 0deg at 46% 54%, ${cols[0]}, ${cols[1]}, ${cols[2]}, ${cols[3]}, ${cols[4]}, ${cols[0]})`, filter: `blur(${(R * 0.22).toFixed(1)}px)`, willChange: "transform" });
	const swirlB = el("div", "", ball);
	set(swirlB, { position: "absolute", left: px(-R * 0.5), top: px(-R * 0.5), width: px(R * 3), height: px(R * 3), background: `radial-gradient(circle at 30% 35%, ${alpha(cols[5], 0.85)} 0%, transparent 38%), radial-gradient(circle at 70% 70%, ${alpha(cols[2], 0.9)} 0%, transparent 42%)`, filter: `blur(${(R * 0.12).toFixed(1)}px)`, willChange: "transform" });
	const shade = el("div", "", ball);
	set(shade, { position: "absolute", inset: "0", borderRadius: "50%", background: star ? `radial-gradient(circle at 50% 50%, ${alpha("#fff6e0", 0.55)} 0%, transparent 32%), radial-gradient(circle at 50% 50%, transparent 52%, ${alpha("#2a0a00", 0.75)} 100%)` : `radial-gradient(circle at 34% 28%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.12) 22%, transparent 45%), radial-gradient(circle at 50% 50%, transparent 58%, ${alpha("#000000", 0.28)} 100%)` });
	if (star) set(glow, { background: `radial-gradient(circle, ${alpha(palette.lime ?? accent, 0.55)} 0%, ${alpha(palette.peach ?? accent, 0.22)} 30%, transparent 62%)` });
	const box = el("div","",cam);
	set(box,{position:"absolute",left:px(K.safe.x + K.safe.w * .02),width:px(K.safe.w * .96),top:px(ocy+R*1.35),textAlign:"center",overflow:"hidden"});
	const lineNs=lines.map(text=>{
		const node=el("div","",box,text);set(node,{position:"absolute",left:"0",right:"0",top:"0",color:fg});return node;
	});
	const lineSpec=D.fitGroup(lineNs,{role:"sceneTitle",w:K.safe.w*.96,h:H*.22,wrap:"normal"});
	set(box, { height: px(Math.max(...lineNs.map(n => n.offsetHeight))) });
	const step = Math.max(0.7, (d0 - 0.9) / lines.length);
	const at = lines.map((_, k) => 0.55 + k * step);
	return (l) => {
		const a = E.softLand(prog(l, 0, 0.9));
		let pulse = 0;
		at.forEach((t) => {
			if (l >= t) pulse = Math.max(pulse, Math.exp(-(l - t) * 6) * 0.06);
		});
		const breath = 1 + Math.sin(l * 2.1) * 0.015;
		const sc = (1.5 - 0.5 * a) * breath * (1 + pulse);
		set(ball, { transform: `scale(${sc.toFixed(4)})`, opacity: clamp(a * 2).toFixed(3) });
		set(glow, { transform: `scale(${(sc * (1 + pulse * 2)).toFixed(4)})`, opacity: (clamp(a * 2) * (0.8 + pulse * 3)).toFixed(3) });
		set(swirlA, { transform: `rotate(${(l * 40).toFixed(2)}deg)` });
		for (const g of rings) set(g.r, { opacity: clamp(a * 1.6).toFixed(3), transform: `rotateX(${g.tilt}deg) rotateZ(${(g.base + l * g.spin).toFixed(2)}deg) scale(${(sc * 0.98).toFixed(4)})` });
		set(swirlB, { transform: `rotate(${(-l * 65).toFixed(2)}deg) scale(${(1 + Math.sin(l * 1.3) * 0.08).toFixed(4)})` });
		lineNs.forEach((n, k) => {
			const enter = E.softLand(prog(l, at[k], 0.45));
			const exit = k < lines.length - 1 ? E.accelExit(prog(l, at[k + 1] - 0.05, 0.2)) : 0;
			// A line that has left is gone, not waiting above its window.
			set(n, { transform: `translateY(${((1 - enter) * 105 - exit * 105).toFixed(1)}%)`, opacity: l >= at[k] - 0.01 && exit < 1 ? "1" : "0" });
		});
	};
};
// ---- particles: a constellation that becomes the line ---------------------------------------------
// Dots drift across the frame joined by faint lines, then fly in and settle into the words; the dots
// tighten into solid type. Seen in Benji Taylor's launch films for Grok.
sceneFactories.particles = ({ p, cam, fg, accent, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, alpha, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const text = String(s.text || "Frontier-level intelligence");
	const plainText = text.replace(/\*/g, "");
	// The solid line, laid out first so the dots know where to land.
	const line = el("div", "display", cam);
	const fs0 = D.type("display").size;
	set(line, { position: "absolute", left: px(W * 0.07), width: px(W * 0.86), top: "0", textAlign: "center", color: fg, opacity: "0" });
	const words = [];
	text.split(/\s+/).filter(Boolean).forEach((w, i) => {
		if (i) line.appendChild(document.createTextNode(" "));
		const em = /^\*.*\*[.,!?]?$/.test(w);
		const n = el("span", "", line, w.replace(/\*/g, ""));
		if (em) {
			set(n, { color: accent });
			if (K.plan?.look?.display?.accent === "serif") n.style.fontStyle = "italic";
		}
		words.push(n);
	});
	D.fitSize(line,W*.86,H*.5,"display");
	const lh = line.offsetHeight;
	const top = (H - lh) / 2;
	set(line, { top: px(top) });
	// Sample the line into dots: draw each word's box with the same font on a canvas.
	const cs = getComputedStyle(line);
	const fsz = parseFloat(cs.fontSize);
	const cv = document.createElement("canvas");
	const sc = 0.5;
	cv.width = Math.ceil(W * sc);
	cv.height = Math.ceil(H * sc);
	const g = cv.getContext("2d");
	g.fillStyle = "#000";
	g.textBaseline = "alphabetic";
	// Layout offsets, not screen rects: the stage may be scaled on screen while it builds.
	const rasterSpec = D.type("display", Number(line.dataset.designStep));
	cv.dataset.designRaster = JSON.stringify(words.map(nd => ({ ...rasterSpec, unit: rasterSpec.unit * sc, size: fsz * sc, lineHeight: rasterSpec.lineHeight * sc, text: nd.textContent })));
	words.forEach((nd) => {
		const ws = getComputedStyle(nd);
		g.font = `${ws.fontStyle} ${ws.fontWeight} ${ws.fontStretch && ws.fontStretch !== "100%" ? ws.fontStretch + " " : ""}${fsz * sc}px ${ws.fontFamily}`;
		g.letterSpacing = `${(parseFloat(ws.letterSpacing) || 0) * sc}px`;
		const lineH = nd.offsetHeight;
		g.fillText(nd.textContent, (line.offsetLeft + nd.offsetLeft) * sc, (top + nd.offsetTop + lineH * 0.5 + fsz * 0.34) * sc);
	});
	const data = g.getImageData(0, 0, cv.width, cv.height).data;
	const pts = [];
	const step = Math.max(2, Math.round((vertical ? 3 : 3.4) * (cv.width / 960)));
	for (let y = 0; y < cv.height; y += step)
		for (let x = 0; x < cv.width; x += step) if (data[(y * cv.width + x) * 4 + 3] > 140) pts.push({ x: x / sc, y: y / sc });
	// Cap the count; keep an even spread.
	const MAX = 2600;
	const keep = pts.length > MAX ? pts.filter((_, i) => hash(i * 1.37) < MAX / pts.length) : pts;
	const parts = keep.map((t, i) => {
		const a = hash(i * 3.17) * Math.PI * 2;
		const rr = Math.sqrt(hash(i * 7.31)) * Math.max(W, H) * 0.62;
		return { tx: t.x, ty: t.y, sx: W / 2 + Math.cos(a) * rr, sy: H / 2 + Math.sin(a) * rr * 0.75, ph: hash(i * 9.1) * 6.28, delay: hash(i * 5.5) * 0.45 + (t.x / W) * 0.25, acc: false };
	});
	// Drawn at the size the picture is watched at (K.previewScale: the live
	// preview's stream), laid over the frame at its own size.
	const q = K.previewScale ?? 1;
	const canvas = el("canvas", "", cam);
	canvas.width = Math.round(W * q);
	canvas.height = Math.round(H * q);
	set(canvas, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H) });
	const ctx = canvas.getContext("2d");
	ctx.setTransform(q, 0, 0, q, 0, 0);
	const r0 = Math.max(1.2, 2.3 * S);
	const tGather = Math.min(0.7, d0 * 0.18);
	const gDur = 1.1;
	const tSolid = tGather + gDur + 0.5;
	const lineN = Math.min(160, parts.length);
	return (l) => {
		ctx.clearRect(0, 0, W, H);
		const solid = E.softInOut(prog(l, tSolid, 0.45));
		const pos = parts.map((q) => {
			const k = E.softInOut(prog(l, tGather + q.delay, gDur));
			const drift = (1 - k) * 18 * S;
			return { x: q.sx + (q.tx - q.sx) * k + Math.cos(l * 0.8 + q.ph) * drift, y: q.sy + (q.ty - q.sy) * k + Math.sin(l * 0.7 + q.ph) * drift, k };
		});
		// Faint constellation lines while the dots are loose.
		const looseA = 1 - E.softInOut(prog(l, tGather, 0.6));
		if (looseA > 0.01) {
			ctx.strokeStyle = alpha(fg, 0.16 * looseA);
			ctx.lineWidth = Math.max(1, 1.2 * S);
			ctx.beginPath();
			const lim = (W * 0.11) ** 2;
			for (let i = 0; i < lineN; i++)
				for (let j = i + 1; j < lineN; j++) {
					const dx = pos[i].x - pos[j].x;
					const dy = pos[i].y - pos[j].y;
					if (dx * dx + dy * dy < lim) {
						ctx.moveTo(pos[i].x, pos[i].y);
						ctx.lineTo(pos[j].x, pos[j].y);
					}
				}
			ctx.stroke();
		}
		ctx.fillStyle = fg;
		const fade = 1 - solid;
		if (fade > 0.01) {
			ctx.globalAlpha = clamp(l / 0.3) * fade;
			for (let i = 0; i < pos.length; i++) {
				const q = pos[i];
				const rr = r0 * (1.6 - 0.6 * q.k) * (0.6 + 0.4 * fade);
				ctx.fillRect(q.x - rr / 2, q.y - rr / 2, rr, rr);
			}
			ctx.globalAlpha = 1;
		}
		set(line, { opacity: solid.toFixed(3), transform: `scale(${(1.03 - 0.03 * solid).toFixed(4)})` });
	};
};

// ---- wave: a voice, its waveform and the words it says ---------------------------------------------
// A player pill with a live waveform; the transcript appears under it word by word, the spoken word
// lit, like karaoke. A small label sits above. Seen in Benji Taylor's Grok voice launch.
sceneFactories.wave = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, alpha, mixHex, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const light = lum(bg) > 0.45;
	const label = DOUBLE(s.label || "");
	const said = String(s.text || "Hi, I booked your table for eight.").split(/\s+/).filter(Boolean);
	const pw = vertical ? W * 0.86 : W * 0.56;
	const ph = (vertical ? 136 : 130) * S;
	const py = H * (vertical ? 0.4 : 0.38) - ph / 2;
	const pill = el("div", "", cam);
	set(pill, { position: "absolute", left: px((W - pw) / 2), top: px(py), width: px(pw), height: px(ph), background: light ? "#ffffff" : mixHex(bg, "#ffffff", 0.08), boxShadow: `0 ${px(20 * S)} ${px(60 * S)} ${alpha("#000000", light ? 0.12 : 0.4)}`, willChange: "transform" });
	const playerBox = D.surface(pill, "field", { density: "compact", shape: "pill", layout: "absolute" });
	const play = el("div", "", pill);
	const pb = ph * 0.62, playPulse = .04;
	const playLeft = playerBox.paddingX + pb * playPulse / 2;
	set(play, { position: "absolute", left: px(playLeft), top: px((ph - pb) / 2), width: px(pb), height: px(pb), borderRadius: "50%", background: accent });
	D.surfaceContent(pill, play);
	const tri = el("div", "", play);
	set(tri, { position: "absolute", left: "54%", top: "50%", width: "0", height: "0", borderLeft: `${px(pb * 0.28)} solid ${K.textOn(accent)}`, borderTop: `${px(pb * 0.18)} solid transparent`, borderBottom: `${px(pb * 0.18)} solid transparent`, transform: "translate(-50%,-50%)" });
	const time = el("div", "", pill, "0:00");
	set(time, { position: "absolute", right: px(playerBox.paddingX), top: px((ph - D.type("code").lineHeight) / 2), color: alpha(light ? "#111111" : "#ffffff", 0.55) });
	D.surfaceContent(pill, time);
	D.apply(time,"code");
	const n = vertical ? 34 : 56;
	const barStart = playLeft + pb * (1 + playPulse / 2) + playerBox.gap;
	const barArea = { x: barStart, w: pw - playerBox.paddingX - time.offsetWidth - playerBox.gap - barStart };
	const bw = barArea.w / n;
	const bars = Array.from({ length: n }, (_, i) => {
		const b = el("div", "", pill);
		set(b, { position: "absolute", left: px(barArea.x + i * bw + bw * 0.2), top: "50%", width: px(bw * 0.6), borderRadius: px(bw), background: mixHex(accent, palette.butter ?? "#ffcc66", (i / n) * 0.6) });
		D.surfaceContent(pill, b);
		return b;
	});
	let labelN = null;
	if (label) {
		labelN = el("div", "", cam, label);
		set(labelN, { position: "absolute", left: px(K.safe.x), width: px(K.safe.w), top: px(py - 84 * S), textAlign: "center", color: fg, opacity: "0.7" });
		D.apply(labelN,"label");
		D.truncateLine(labelN);labelN.title = label;
	}
	const tr = el("div", "display", cam);
	const fs = (vertical ? 84 : 84) * S;
	set(tr, { position: "absolute", left: px(W * 0.08), width: px(W * 0.84), top: px(py + ph + 70 * S), textAlign: "center", color: fg });
	D.apply(tr,"sceneTitle");
	const wordNs = said.map((w, i) => {
		if (i) tr.appendChild(document.createTextNode(" "));
		const em = /^\*.*\*[.,!?]?$/.test(w);
		const sp = el("span", "", tr, w.replace(/\*/g, ""));
		set(sp, { display: "inline-block", color: em ? accent : fg });
		if (em && K.plan?.look?.display?.accent === "serif") sp.style.fontStyle = "italic";
		return sp;
	});
	const tTalk = 0.55;
	const talkDur = Math.max(1.2, Math.min(d0 - 1.0, said.length * 0.28));
	const wordT = (i) => tTalk + (i / said.length) * talkDur;
	return (l) => {
		const a = E.softLand(prog(l, 0, 0.5));
		set(pill, { opacity: clamp(a * 3).toFixed(3), transform: `translateY(${px((1 - a) * 30 * S)}) scale(${(1.06 - 0.06 * a).toFixed(4)})` });
		if (labelN) set(labelN, { opacity: (0.7 * E.softLand(prog(l, 0.15, 0.4))).toFixed(3) });
		const talking = l >= tTalk && l <= tTalk + talkDur;
		const env = talking ? 0.35 + 0.65 * Math.abs(Math.sin((l - tTalk) * 5.3)) * (0.6 + 0.4 * Math.sin((l - tTalk) * 1.7 + 1)) : 0.06;
		bars.forEach((b, i) => {
			const v = talking ? clamp(env * (0.35 + 0.65 * Math.abs(Math.sin(l * 11 + i * 0.9 + hash(i) * 6) * Math.cos(l * 4.7 + i * 0.37)))) : 0.08 + 0.04 * Math.sin(l * 2 + i * 0.5);
			const h = ph * 0.62 * Math.max(0.08, v);
			set(b, { height: px(h), top: px((ph - h) / 2), opacity: (0.45 + 0.55 * Math.max(0.15, v)).toFixed(3) });
		});
		const sec = Math.max(0, Math.min(talkDur, l - tTalk));
		time.textContent = `0:${String(Math.floor(sec + 0.0001) % 60).padStart(2, "0")}`;
		set(play, { transform: `scale(${(talking ? 1 + playPulse * Math.sin(l * 8) : 1).toFixed(4)})` });
		wordNs.forEach((w, i) => {
			const k = E.softLand(prog(l, wordT(i), 0.3));
			// The spoken word is lit; once the voice is done, the whole line is.
			const lit = l >= wordT(i) && (i === said.length - 1 || l < wordT(i + 1) + 0.15 || l > tTalk + talkDur + 0.2);
			set(w, { opacity: (k * (lit ? 1 : 0.42)).toFixed(3), transform: `translateY(${px((1 - k) * fs * 0.3)})` });
		});
	};
};
// ---- agent: the product working through a job --------------------------------------------------------
// "Meridian working…": a spinner and a status line; tasks arrive one under another, each spinning
// until it checks off; then the header turns into the result ("Financial statements ready.") and a
// result card slides up. Seen in Marleen Swift's Meridian film and the Grok Build films.
sceneFactories.agent = ({ p, cam, fg, accent, palette, bg, K }) => {
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
	const tStart = 0.35;
	const step = Math.max(0.5, Math.min(0.95, (d0 * 0.62) / steps.length));
	const startT = (k) => tStart + k * step;
	const doneT = (k) => startT(k) + step * 0.82;
	const tAll = doneT(steps.length - 1) + 0.15;
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
// ---- palette: a command bar that filters as you type ---------------------------------------------------
// A big search bar types the query; the results under it filter live as letters arrive, the selection
// slides to the match, Enter presses and the picked row opens. The camera starts close on the bar and
// settles back. Seen in Raycast's 2026 teaser.
sceneFactories.palette = ({ p, cam, fg, accent, palette, bg, K }) => {
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
// ---- picker: a grid where the selection hops and lands -------------------------------------------------
// A big grid of icon tiles, close up; a selection ring hops from tile to tile while the grid slides to
// keep it near the middle; on the last hop the pick lifts out, the rest dim, and its name lands.
// Seen in Raycast's 2026 teaser (the emoji picker).
sceneFactories.picker = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, lum, alpha, mixHex, hash, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const light = lum(bg) > 0.45;
	const icons = (s.items?.length ? s.items : ["😀", "🤖", "🫣", "🔥", "💧", "🎙️", "🚀", "🎨", "📈", "🧠", "⚡", "🌈", "🍕", "🎧", "📦", "🔒", "💬", "🌍"]).slice(0, 24);
	const label = DOUBLE(s.text || "");
	const cols = vertical ? 4 : 7;
	const tile = (vertical ? W * 0.2 : W * 0.115);
	const gap = D.space(2);
	const rowsN = Math.ceil(icons.length / cols);
	const gridW = cols * tile + (cols - 1) * gap;
	const gridH = rowsN * tile + (rowsN - 1) * gap;
	const tileBg = light ? "#ffffff" : mixHex(bg, "#ffffff", 0.08);
	const world = el("div", "", cam);
	set(world, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), willChange: "transform" });
	const pos = (i) => ({ x: (i % cols) * (tile + gap), y: Math.floor(i / cols) * (tile + gap) });
	const tiles = icons.map((ic, i) => {
		const t = el("div", "", world, ic);
		const P = pos(i);
		set(t, { position: "absolute", left: px(P.x), top: px(P.y), width: px(tile), height: px(tile), borderRadius: px(tile * 0.24), background: tileBg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${px(tile * 0.06)} ${px(tile * 0.2)} ${alpha("#000000", light ? 0.1 : 0.35)}`, willChange: "transform" });
		D.forSurface(tile / (D.unit * 48)).apply(t, "cardTitle");
		if (/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Component}\s]+$/u.test(String(ic))) t.dataset.designGlyphArt = "icon";
		return t;
	});
	const ring = el("div", "", world);
	set(ring, { position: "absolute", left: "0", top: "0", width: px(tile + 12 * S), height: px(tile + 12 * S), borderRadius: px(tile * 0.28), boxSizing: "border-box", border: `${px(5 * S)} solid ${accent}`, boxShadow: `0 0 ${px(30 * S)} ${alpha(accent, 0.55)}`, zIndex: "5" });
	// The hop path: a few tiles across the grid, ending on the pick.
	const n = icons.length;
	const pick = typeof s.pick === "number" ? Math.min(n - 1, s.pick) : Math.min(n - 1, cols + 3);
	const path = [0, 1, 2].map((k) => Math.floor(hash(k * 3.7 + 1) * n)).concat([pick]);
	path[0] = Math.min(n - 1, cols + 1);
	const hopT = (k) => 0.55 + k * Math.max(0.32, (d0 * 0.45) / path.length);
	const tLand = hopT(path.length - 1) + 0.3;
	const nameN = label ? el("div", "display", cam, label) : null;
	if (nameN) set(nameN, { position: "absolute", left: "0", width: px(W), top: px(H * (vertical ? 0.78 : 0.8)), textAlign: "center", color: fg, opacity: "0" });
	if(nameN)D.apply(nameN,"sceneTitle");
	return (l) => {
		// Where the ring is: eased hops between tiles.
		let k = 0;
		while (k < path.length - 1 && l >= hopT(k + 1)) k++;
		const from = pos(path[k]);
		const to = pos(path[Math.min(path.length - 1, k + 1)]);
		const h = k < path.length - 1 ? E.softInOut(prog(l, hopT(k + 1) - 0.24, 0.24)) : 1;
		const rx = from.x + (to.x - from.x) * (k < path.length - 1 ? h : 0);
		const ry = from.y + (to.y - from.y) * (k < path.length - 1 ? h : 0);
		const appear = E.softLand(prog(l, hopT(0) - 0.15, 0.3));
		set(ring, { opacity: appear.toFixed(3), transform: `translate(${px(rx - 6 * S)}, ${px(ry - 6 * S)}) scale(${(1.15 - 0.15 * appear).toFixed(4)})` });
		// The grid slides so the ring stays near the middle; it lands centred on the pick.
		const land = E.softInOut(prog(l, tLand - 0.2, 0.6));
		const pk = pos(pick);
		const cx = rx + tile / 2;
		const cy = ry + tile / 2;
		const fx = cx + (pk.x + tile / 2 - cx) * land;
		const fy = cy + (pk.y + tile / 2 - cy) * land - (nameN ? H * 0.06 * land : 0);
		const z = 1.12 + 0.12 * land;
		const a = E.softLand(prog(l, 0, 0.6));
		set(world, { transform: `translate(${px(W / 2 - fx * z)}, ${px(H / 2 - fy * z + (1 - a) * 60 * S)}) scale(${z.toFixed(4)})`, opacity: clamp(a * 2).toFixed(3) });
		const lift = E.popOver(clamp((l - tLand) / 0.45));
		tiles.forEach((t, i) => {
			const isPick = i === pick && l >= tLand;
			const sel = i === path[k] || (k < path.length - 1 && i === path[k + 1] && h > 0.5);
			set(t, { opacity: l >= tLand && !isPick ? (1 - 0.65 * clamp((l - tLand) / 0.3)).toFixed(3) : "1", transform: `scale(${(isPick ? 1 + 0.3 * lift : sel ? 1.06 : 1).toFixed(4)})`, zIndex: isPick ? "6" : "1" });
		});
		if (nameN) {
			const nk = E.softLand(prog(l, tLand + 0.15, 0.45));
			set(nameN, { opacity: clamp(nk * 3).toFixed(3), transform: `translateY(${px((1 - nk) * 40 * S)})` });
		}
		void gridW;
		void gridH;
	};
};
// ---- montage: footage and small lines, cut on the beat --------------------------------------------------
// Full-bleed photographs cut fast with a slow push on each, and between them a line of small type on
// a plain card, a few words at a time. A brand film's rhythm. Seen in theProcessXCII's "Finality".
sceneFactories.montage = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, alpha, mixHex, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const pics = (s.images ?? []).map((u) => K.images[u]).filter(Boolean);
	const lines = (s.lines?.length ? s.lines : ["Everyone has a plan.", "Few ship it."]).slice(0, 5);
	// Sci-fi keeps its dark scope between shots, the line set in the style's wide display face.
	const scope = !!K.plan?.look?.deco?.hud;
	const cardBg = scope || lum(bg) > 0.5 ? bg : "#f4f2ee";
	const cardInk = lum(cardBg) > 0.5 ? "#141414" : "#f4f2ee";
	// The cut list: two shots, then a line; repeat.
	const segs = [];
	lines.forEach((ln, i) => {
		segs.push({ kind: "shot", i: i * 2 });
		segs.push({ kind: "shot", i: i * 2 + 1 });
		segs.push({ kind: "line", text: ln });
	});
	const weights = segs.map((g) => (g.kind === "line" ? 2.2 : 1));
	const wsum = weights.reduce((a, b) => a + b, 0);
	let acc = 0;
	const starts = weights.map((w) => {
		const t = acc;
		acc += (w / wsum) * d0;
		return t;
	});
	const durs = weights.map((w) => (w / wsum) * d0);
	const layers = segs.map((g, k) => {
		const box = el("div", "", cam);
		set(box, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), overflow: "hidden", opacity: "0" });
		if (g.kind === "shot") {
			const pic = pics.length ? pics[g.i % pics.length] : null;
			const inner = el(pic ? "img" : "div", "fill", box);
			if (pic) {
				inner.src = pic.src;
				set(inner, { width: "100%", height: "100%", objectFit: "cover", willChange: "transform" });
			} else {
				// No photos: a graded colour plate with a soft light, never a grey box.
				const c = [palette.coral, palette.sky, palette.butter, palette.lilac, accent].filter(Boolean)[g.i % 5] ?? accent;
				set(inner, { position: "absolute", inset: "0", background: `radial-gradient(circle at ${30 + hash(k) * 40}% ${30 + hash(k * 2) * 40}%, ${mixHex(c, "#ffffff", 0.3)} 0%, ${mixHex(c, "#000000", 0.55)} 70%)` });
			}
			// A film grade: a little darker at the edges.
			const vig = el("div", "", box);
			set(vig, { position: "absolute", inset: "0", background: `radial-gradient(ellipse at 50% 50%, transparent 55%, ${alpha("#000000", 0.38)} 100%)` });
			return { box, inner, kind: "shot", dir: hash(k * 5.3) > 0.5 ? 1 : -1 };
		}
		set(box, { background: cardBg });
		const tx = el("div", scope ? "display" : "", box);
		const fs = (scope ? 50 : 62) * S;
		set(tx, { position: "absolute", left: px(W * 0.1), width: px(W * 0.8), top: "50%", transform: "translateY(-50%)", textAlign: "center", color: cardInk, ...(scope ? {} : { }) });
		D.apply(tx,"display");
		const words = String(g.text).split(/\s+/).filter(Boolean).map((w, j) => {
			if (j) tx.appendChild(document.createTextNode(" "));
			const em = /^\*.*\*[.,!?]?$/.test(w);
			const sp = el("span", "", tx, w.replace(/\*/g, ""));
			// The accent word must read on the card: fall back to the ink with italic emphasis.
			const [hi, lo] = [lum(accent), lum(cardBg)].sort((a, b) => b - a);
			const readable = (hi + 0.05) / (lo + 0.05) >= 3;
			set(sp, { display: "inline-block", color: em && readable ? accent : cardInk });
			if (em && (!readable || K.plan?.look?.display?.accent === "serif")) sp.style.fontStyle = "italic";
			return sp;
		});
		return { box, words, kind: "line" };
	});
	return (l) => {
		layers.forEach((L, k) => {
			const t0 = starts[k];
			const on = l >= t0 && (k === layers.length - 1 || l < starts[k + 1]);
			set(L.box, { opacity: on ? "1" : "0" });
			// Hidden shots and lines also reset from time, so a reverse seek
			// cannot retain transforms from a later montage segment.
			const u = clamp((l - t0) / durs[k]);
			if (L.kind === "shot") {
				// A slow push and drift on every shot, so no frame is ever still.
				const sc = 1.12 - 0.08 * E.cruise(u);
				set(L.inner, { transform: `scale(${sc.toFixed(4)}) translateX(${(L.dir * (u - 0.5) * 2.4).toFixed(3)}%)` });
			} else {
				L.words.forEach((w, j) => {
					const a = E.softLand(prog(l - t0, 0.04 + j * 0.07, 0.35));
					set(w, { opacity: clamp(a * 2).toFixed(3), transform: `translateY(${px((1 - a) * 18 * S)})` });
				});
			}
		});
	};
};

// ---- web: the words around the product, joined to it --------------------------------------------------
// The product's mark in the middle; the words that describe it arrive on rings around it, each joined
// by a hairline; the camera turns slowly in 3D and the key words light up in turn. Seen in ab_works'
// "Pulse It" launch film.
sceneFactories.web = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, alpha, logoNode, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const light = lum(bg) > 0.45;
	const words = (s.words?.length ? s.words : ["Speed", "Design", "Sound", "3D", "Brand", "Motion", "Edit", "Export", "AI", "Type"]).map(DOUBLE).slice(0, 16);
	const keys = (s.keys?.length ? s.keys.map(DOUBLE) : words.slice(0, 3)).slice(0, 4);
	const R = Math.min(W, H) * (vertical ? 0.44 : 0.4);
	const stage3 = el("div", "", cam);
	set(stage3, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), perspective: px(1800 * S) });
	const plane = el("div", "", stage3);
	set(plane, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), transformStyle: "preserve-3d", transformOrigin: "50% 50%", willChange: "transform" });
	const ns = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(ns, "svg");
	svg.setAttribute("width", String(W));
	svg.setAttribute("height", String(H));
	set(svg, { position: "absolute", left: "0", top: "0", overflow: "visible" });
	plane.appendChild(svg);
	const nodes = words.map((w, i) => {
		const ring = i % 3;
		const ang = (i / words.length) * Math.PI * 2 + hash(i * 3.1) * 0.5;
		const rr = R * (0.42 + ring * 0.29) * (0.9 + hash(i * 1.7) * 0.2);
		const x = W / 2 + Math.cos(ang) * rr * (vertical ? 0.85 : 1.25);
		const y = H / 2 + Math.sin(ang) * rr * (vertical ? 1.25 : 0.82);
		const line = document.createElementNS(ns, "line");
		for (const [k, v] of Object.entries({ x1: W / 2, y1: H / 2, x2: x, y2: y, stroke: alpha(fg, 0.22), "stroke-width": String(1.6 * S) })) line.setAttribute(k, String(v));
		svg.appendChild(line);
		const isKey = keys.includes(w);
		const n = el("div", "bold", plane);
		const fs = (isKey ? 70 : 52) * S * (vertical ? 1 : 1);
		set(n, { position: "absolute", left: "0", top: "0", color: fg, background: light ? "#ffffff" : alpha("#ffffff", 0.06), border: `${px(1.5 * S)} solid ${alpha(fg, 0.15)}`, whiteSpace: "nowrap", willChange: "transform" });
		D.surface(n, "badge", { density: "compact" });
		D.apply(n, "caption", { step: 2 });
		const label = el("div", "", n, w);
		set(label, { maxWidth: px(K.safe.w * .38 - D.box("badge", { density: "compact" }).paddingX * 2), textAlign: "center" });
		D.truncateLine(label);label.title = w;
		const nw = n.offsetWidth;
		const nh = n.offsetHeight;
		return { n, line, x, y, nw, nh, isKey, keyIdx: keys.indexOf(w), ring };
	});
	const dense = words.length > 10 || nodes.some(n => n.nw > R * .7);
	let labelsPerPage = nodes.length;
	if (dense) {
		const height = Math.max(...nodes.map(n => n.nh));
		const stepY = height + D.space(2);
		const rowsPerPage = Math.max(1, Math.floor(K.safe.h * .76 / stepY));
		labelsPerPage = rowsPerPage * 2;
		nodes.forEach((n, i) => {
			const page = Math.floor(i / labelsPerPage), cell = i % labelsPerPage;
			const pageRows = Math.ceil(Math.min(labelsPerPage, nodes.length - page * labelsPerPage) / 2);
			n.x = W / 2 + (cell % 2 ? 1 : -1) * K.safe.w * .265;
			n.y = H / 2 + (Math.floor(cell / 2) - (pageRows - 1) / 2) * stepY;
		});
	}
	const pageCount = Math.ceil(nodes.length / labelsPerPage);
	const pageDuration = (d0 - .6) / pageCount;
	const core = logoNode(plane, Math.min(W, H) * 0.12, accent);
	const cs = Math.min(W, H) * 0.12;
	set(core, { position: "absolute", left: px(W / 2 - cs / 2), top: px(H / 2 - cs / 2), boxShadow: `0 0 ${px(60 * S)} ${alpha(accent, 0.55)}` });
	const step = Math.min(0.09, 1.1 / words.length);
	const tKeys = 0.4 + words.length * step + 0.3;
	const keyDur = Math.max(0.45, (d0 - tKeys - 0.6) / Math.max(1, keys.length));
	return (l) => {
		const ca = E.softLand(prog(l, 0, 0.5));
		set(core, { transform: `scale(${(1.4 - 0.4 * ca).toFixed(4)})`, opacity: clamp(ca * 2).toFixed(3) });
		let active = -1;
		for (let k = 0; k < keys.length; k++) if (l >= tKeys + k * keyDur) active = k;
		nodes.forEach((N, i) => {
			const page = Math.floor(i / labelsPerPage);
			const pageStart = .4 + page * pageDuration;
			const a = E.softLand(prog(l, pageStart + (i % labelsPerPage) * step, .5));
			const pageOut = page < pageCount - 1 ? E.accelExit(prog(l, pageStart + pageDuration - .15, .15)) : 0;
			const lit = N.isKey && N.keyIdx === active;
			const dim = active >= 0 && !lit;
			const x = W / 2 + (N.x - W / 2) * (0.6 + 0.4 * a);
			const y = H / 2 + (N.y - H / 2) * (0.6 + 0.4 * a);
			set(N.n, { opacity: (clamp(a * 2) * (1 - pageOut) * (dim ? 0.45 : 1)).toFixed(3), transform: `translate(${px(x - N.nw / 2)}, ${px(y - N.nh / 2)}) scale(${(lit ? 1.18 : 1).toFixed(3)})`, background: lit ? accent : light ? "#ffffff" : alpha("#ffffff", 0.06), color: lit ? K.textOn(accent) : fg, zIndex: lit ? "4" : "1" });
			N.line.setAttribute("x2", String(x));
			N.line.setAttribute("y2", String(y));
			N.line.setAttribute("stroke", lit ? accent : alpha(fg, 0.22 * clamp(a * 2) * (1 - pageOut) * (dim ? 0.5 : 1)));
			N.line.setAttribute("stroke-width", String((lit ? 3 : 1.6) * S));
		});
		// A slow turn in 3D, then a push toward the middle at the end.
		const tilt = 22 * (1 - E.softInOut(prog(l, 0, d0)));
		const turn = -8 + 16 * (l / d0);
		const push = 1 + 0.25 * E.gentleIn(prog(l, d0 - 0.7, 0.7));
		set(plane, { transform: `rotateX(${tilt.toFixed(2)}deg) rotateY(${turn.toFixed(2)}deg) scale(${push.toFixed(4)})` });
	};
};
// ---- split: one word on a panel, a grid of what it means --------------------------------------------------
// A coloured panel holds one big word that swaps ("Posters." "Covers." "Merch."), and beside it a
// grid of tiles reshuffles with every word, a tile at a time. Seen in Higgsfield's "rastr" film.
sceneFactories.split = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, alpha, mixHex, textOn, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const words = (s.words?.length ? s.words : ["Posters.", "Covers.", "Merch.", "Motion."]).map(DOUBLE).slice(0, 5);
	const pics = (s.images ?? []).map((u) => K.images[u]).filter(Boolean);
	const items = (s.items ?? []).slice(0, 12);
	const panelW = vertical ? W : W * 0.36;
	const panelH = vertical ? H * 0.34 : H;
	const panel = el("div", "", cam);
	set(panel, { position: "absolute", left: "0", top: "0", width: px(panelW), height: px(panelH), background: accent, overflow: "hidden", willChange: "transform" });
	const wordNs = words.map((w) => {
		const n = el("div", "display", panel, w);
		set(n, { position: "absolute", left: px(vertical ? W * 0.07 : panelW * 0.12), bottom: px(panelH * (vertical ? 0.16 : 0.12)), color: textOn(accent), whiteSpace: "nowrap", willChange: "transform" });
		D.apply(n,"display");
		return n;
	});
	const wordType = D.fitGroup(wordNs, { role: "display", w: panelW * (vertical ? 0.86 : 0.8), h: panelH * 0.5, wrap: "normal" });
	const fs = wordType.size;
	// The grid.
	const gx = vertical ? W * 0.05 : panelW + W * 0.03;
	const gy = vertical ? panelH + H * 0.03 : H * 0.06;
	const gw = vertical ? W * 0.9 : W - panelW - W * 0.06;
	const gh = vertical ? H - panelH - H * 0.06 : H * 0.88;
	const wordTiles = items.some(item => String(item).length > 2 && !/\p{Extended_Pictographic}/u.test(String(item)));
	const cols = wordTiles ? 2 : vertical ? 3 : 4;
	const rows = vertical ? 3 : 3;
	const gap = D.space(2);
	const tw = (gw - gap * (cols - 1)) / cols;
	const th = (gh - gap * (rows - 1)) / rows;
	const cols2 = [palette.coral, palette.sky, palette.butter, palette.lilac, palette.lime, accent].filter(Boolean);
	const light = lum(bg) > 0.45;
	const tiles = [];
	for (let r = 0; r < rows; r++)
		for (let c = 0; c < cols; c++) {
			const i = r * cols + c;
			const t = el("div", "", cam);
			set(t, { position: "absolute", left: px(gx + c * (tw + gap)), top: px(gy + r * (th + gap)), width: px(tw), height: px(th), overflow: "hidden", willChange: "transform" });
			D.surface(t, "card", { layout: "frame", purpose: "media" });
			// One face per word, swapped in turn.
			const faces = words.map((_, k) => {
				const f = el("div", "", t);
				set(f, { position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center" });
				const pic = pics.length ? pics[(i + k * 3) % pics.length] : null;
				if (pic) {
					const im = el("img", "fill", f);
					im.src = pic.src;
					set(im, { width: "100%", height: "100%", objectFit: "cover" });
				} else {
					const c1 = cols2[(i + k) % cols2.length];
					const dark = hash(i * 3.1 + k) > 0.55;
					set(f, { background: dark ? (light ? "#151515" : "#0b0b0d") : mixHex(c1, light ? "#ffffff" : "#000000", 0.25), color: dark ? c1 : textOn(c1) });
					const glyph = items.length ? items[(i + k * 2) % items.length] : ["◆", "●", "▲", "✦", "■", "◐"][(i + k) % 6];
					f.textContent = glyph;
					if ([...String(glyph)].length <= 2 || /^\p{Extended_Pictographic}/u.test(glyph)) D.forSurface(Math.min(tw, th) / (D.unit * 48)).apply(f, "cardTitle");
					else {
						set(f, { padding: px(D.space(2)), boxSizing: "border-box", textAlign: "center", whiteSpace: "normal" });
						D.fitSize(f, tw, th, "caption");
					}
				}
				return f;
			});
			tiles.push({ t, faces, i, delay: hash(i * 7.7) * 0.22 });
		}
	const step = Math.max(0.55, (d0 - 0.5) / words.length);
	const swapAt = words.map((_, k) => 0.3 + k * step);
	return (l) => {
		const pa = E.softLand(prog(l, 0, 0.5));
		set(panel, { transform: vertical ? `translateY(${px(-(1 - pa) * panelH)})` : `translateX(${px(-(1 - pa) * panelW)})` });
		wordNs.forEach((n, k) => {
			const enter = E.softLand(prog(l, swapAt[k], 0.4));
			const exit = k < words.length - 1 ? E.accelExit(prog(l, swapAt[k + 1] - 0.06, 0.18)) : 0;
			set(n, { opacity: l >= swapAt[k] && exit < 1 ? (Math.min(enter, 1 - exit) ** 8).toFixed(3) : "0", transform: `translateY(${px((1 - enter) * fs * 0.9 - exit * fs * 0.9)})` });
		});
		tiles.forEach((T) => {
			const a = E.softLand(prog(l, 0.1 + T.delay, 0.45));
			set(T.t, { opacity: clamp(a * 3).toFixed(3), transform: `scale(${(1.1 - 0.1 * a).toFixed(4)})` });
			// Each tile flips to the next word's face a moment after the word changes.
			T.faces.forEach((f, k) => {
				const at = swapAt[k] + T.delay * 0.8;
				const nextAt = k < words.length - 1 ? swapAt[k + 1] + T.delay * 0.8 : 1e9;
				const inK = k === 0 ? 1 : E.softLand(prog(l, at, 0.3));
				const outK = E.accelExit(prog(l, nextAt, 0.2));
				const on = (k === 0 || l >= at) && outK < 1;
				set(f, { opacity: on ? (Math.min(inK, 1 - outK) ** 8).toFixed(3) : "0", transform: `translateY(${((1 - inK) * 100 - outK * 100).toFixed(2)}%)` });
			});
		});
	};
};
// ---- pack: circles crowd round one word -------------------------------------------------------------------
// Circles of every size pop in from oversize and pack the frame round a word in the biggest one, the
// palette's colours with the ink; they breathe, then scatter outward. Seen in ab_works' "Pulse It".
sceneFactories.pack = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, textOn, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const word = DOUBLE(s.word || "Everything");
	const cols = [accent, palette.ink ?? "#111111", palette.sky, palette.butter, palette.coral, palette.lilac].filter(Boolean);
	// Greedy circle packing, seeded so the same scene always packs the same way.
	const R0 = Math.min(W, H) * (vertical ? 0.3 : 0.27);
	const circles = [{ x: W / 2, y: H / 2, r: R0, main: true }];
	let tries = 0;
	while (circles.length < 90 && tries < 4000) {
		tries++;
		const x = hash(tries * 1.31) * W;
		const y = hash(tries * 2.77) * H;
		let r = Math.min(W, H) * (0.02 + hash(tries * 3.9) * 0.12);
		for (const c of circles) {
			const d = Math.hypot(c.x - x, c.y - y) - c.r - 6 * S;
			if (d < r) r = d;
		}
		if (r > Math.min(W, H) * 0.018) circles.push({ x, y, r, main: false });
	}
	const nodes = circles.map((c, i) => {
		const n = el("div", "", cam);
		const col = c.main ? accent : cols[1 + Math.floor(hash(i * 5.3) * (cols.length - 1))];
		set(n, { position: "absolute", left: px(c.x - c.r), top: px(c.y - c.r), width: px(c.r * 2), height: px(c.r * 2), borderRadius: "50%", background: col, willChange: "transform", zIndex: c.main ? "5" : "1" });
		const dist = Math.hypot(c.x - W / 2, c.y - H / 2);
		return { n, c, dist };
	});
	const maxD = Math.hypot(W, H) / 2;
	const label = el("div", "display", cam, word);
	const fs = R0 * 0.42;
	set(label, { position: "absolute", left: px(W / 2 - R0), width: px(R0 * 2), top: px(H / 2 - fs * 0.55), textAlign: "center", color: textOn(accent), zIndex: "6", whiteSpace: "nowrap" });
	D.apply(label,"display");
	D.fitSize(label, R0 * 1.7, R0 * 1.3, "display", { align: "center" });
	const tOut = Math.max(1.6, d0 - 0.45);
	return (l) => {
		nodes.forEach(({ n, c, dist }, i) => {
			const at = c.main ? 0 : 0.12 + (dist / maxD) * 0.55 + hash(i) * 0.1;
			const a = E.softLand(prog(l, at, 0.4));
			const breathe = 1 + Math.sin(l * 2.4 + i) * 0.025 * clamp((l - at - 0.4) / 0.4);
			const out = c.main ? 0 : E.accelExit(prog(l, tOut + (1 - dist / maxD) * 0.1, 0.4));
			const dx = (c.x - W / 2) * out * 0.9;
			const dy = (c.y - H / 2) * out * 0.9;
			set(n, { opacity: clamp(a * 3).toFixed(3), transform: `translate(${px(dx)}, ${px(dy)}) scale(${((1.35 - 0.35 * a) * breathe).toFixed(4)})` });
		});
		const la = E.softLand(prog(l, 0.15, 0.45));
		set(label, { opacity: clamp(la * 2).toFixed(3), transform: `translateY(${px((1 - la) * 24 * S)})` });
	};
};

// ---- swarm: a cloud of pictures in depth, then the line -----------------------------------------------------
// Dozens of pictures hang in 3D at every depth, turning slowly as the camera pushes through them;
// then they fly out past the lens and the line lands in the clearing. Seen in ab_works' "Pulse It".
sceneFactories.swarm = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, mixHex, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const pics = (s.images ?? []).map((u) => K.images[u]).filter(Boolean);
	const text = String(s.text || "");
	const N = 40;
	const view = el("div", "", cam);
	set(view, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), perspective: px(900 * S), overflow: "hidden" });
	const world = el("div", "", view);
	set(world, { position: "absolute", left: px(W / 2), top: px(H / 2), width: "0", height: "0", transformStyle: "preserve-3d", willChange: "transform" });
	const cw = Math.min(W, H) * 0.3;
	const cols = [palette.coral, palette.sky, palette.butter, palette.lilac, palette.lime, accent].filter(Boolean);
	const cards = Array.from({ length: N }, (_, i) => {
		const c = el("div", "", world);
		const asp = 0.7 + hash(i * 2.2) * 0.6;
		set(c, { position: "absolute", left: px(-cw / 2), top: px((-cw * asp) / 2), width: px(cw), height: px(cw * asp), overflow: "hidden", boxShadow: `0 ${px(10 * S)} ${px(30 * S)} rgba(0,0,0,0.35)`, backfaceVisibility: "hidden" });
		D.surface(c, "card", { layout: "frame", purpose: "media" });
		const pic = pics.length ? pics[i % pics.length] : null;
		if (pic) {
			const im = el("img", "fill", c);
			im.src = pic.src;
			set(im, { width: "100%", height: "100%", objectFit: "cover" });
		} else {
			const a = cols[i % cols.length];
			set(c, { background: `linear-gradient(${hash(i) * 360}deg, ${mixHex(a, "#ffffff", 0.25)}, ${mixHex(a, "#000000", 0.35)})` });
		}
		return { c, x: (hash(i * 3.1) - 0.5) * W * 1.6, y: (hash(i * 4.7) - 0.5) * H * 1.5, z: -hash(i * 5.9) * 1700 * S, ry: (hash(i * 6.3) - 0.5) * 70, rz: (hash(i * 7.1) - 0.5) * 30 };
	});
	let cap = null;
	let capWords = [];
	if (text) {
		cap = el("div", "display", cam);
		set(cap, { position: "absolute", left: px(W * 0.08), width: px(W * 0.84), top: "50%", transform: "translateY(-50%)", textAlign: "center", color: fg });
		D.apply(cap,"display");
		capWords = text.split(/\s+/).filter(Boolean).map((w, j) => {
			if (j) cap.appendChild(document.createTextNode(" "));
			const em = /^\*.*\*[.,!?]?$/.test(w);
			const sp = el("span", "", cap, w.replace(/\*/g, ""));
			set(sp, { display: "inline-block", color: em ? accent : fg });
			if (em && K.plan?.look?.display?.accent === "serif") sp.style.fontStyle = "italic";
			return sp;
		});
	}
	if (cap) D.fitSize(cap, K.safe.w * 0.92, K.safe.h * 0.7, "display");
	const tOut = text ? Math.max(1.2, d0 * 0.58) : d0 + 1;
	return (l) => {
		const push = E.cruise(l / d0) * 900 * S;
		const out = E.accelExit(prog(l, tOut, 0.55));
		set(world, { transform: `translateZ(${(push + out * 2400 * S).toFixed(1)}px) rotateY(${(Math.sin(l * 0.4) * 6).toFixed(2)}deg)` });
		cards.forEach((C, i) => {
			const a = E.softLand(prog(l, hash(i * 9.1) * 0.5, 0.6));
			const spin = l * (hash(i * 1.9) - 0.5) * 20;
			const spread = 1 + out * 0.8;
			set(C.c, { opacity: clamp(a * 2).toFixed(3), transform: `translate3d(${px(C.x * spread)}, ${px(C.y * spread)}, ${(C.z - (1 - a) * 600 * S).toFixed(1)}px) rotateY(${(C.ry + spin).toFixed(2)}deg) rotateZ(${C.rz.toFixed(2)}deg)` });
		});
		capWords.forEach((w, j) => {
			const k = E.softLand(prog(l, tOut + 0.25 + j * 0.06, 0.5));
			set(w, { opacity: clamp(k * 2).toFixed(3), transform: `translateY(${px((1 - k) * 40 * S)}) scale(${(1.15 - 0.15 * k).toFixed(4)})` });
		});
	};
};
export {sceneFactories};
export default sceneFactories;
