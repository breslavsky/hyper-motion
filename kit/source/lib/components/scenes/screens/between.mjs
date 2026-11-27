// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE, paintGround} from '../_shared/ground.mjs';
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
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
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

	// Timing: the taps, the burst and the exit stand on the film's beats (`p.at`); a screen answers
	// its tap a moment after the press.
	const { confirm: tTap, burst: tBurst, exit: tExit } = p.at;
	const swapAt = words.map((_, k) => (k ? p.at.taps[k - 1] + 0.14 : -9));
	const taps = [];
	for (let k = 1; k < n; k++) taps.push({ t: p.at.taps[k - 1], x: pLeft + inset + sw * (0.3 + 0.35 * (k % 2)), y: pTop + inset + sh * (0.42 + 0.12 * k) });
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
		const bk = prog(l, tBurst, 0.5);
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

