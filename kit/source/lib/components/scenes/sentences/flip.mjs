// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE} from '../_shared/words.mjs';
// ---- flip: "Explore [card] history" ---------------------------------------------------------------
export const factory = ({ p, cam, fg, accent, palette, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, alpha, mixHex, images, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const words = (s.words ?? []).map(DOUBLE).filter(Boolean).slice(0, 5);
	if (!words.length) words.push("everything");
	const icons = words.map((_, k) => s.icons?.[k] ?? ["✨", "\u{1F680}", "\u{1F3A8}", "⚡", "\u{1F3AC}"][k % 5]);
	// Card faces want colour: the style's tints, or a doodle set when the style has too few.
	let tints = [...new Set([palette.butter, palette.sky, palette.lilac, palette.peach, palette.sage, palette.coral].filter(Boolean))].filter((c) => Math.abs(K.lum(c) - K.lum(palette.paper ?? "#ffffff")) > 0.06 || c.toLowerCase() !== (palette.paper ?? "").toLowerCase());
	if (new Set(tints).size < 3 || tints.every((c) => K.lum(c) > 0.85)) tints = ["#ffd84d", "#8fd3ff", "#c9a7ff", "#ff9f80", "#9be3a5"];
	const fs = D.type("display",8).size;
	const ch = fs * 1.45;
	const cw = ch * 0.82;
	const gap = D.space(3);
	const line = (txt, align) => {
		const n = el("div", "display", cam, txt);
		set(n, { position: "absolute", top: px(H / 2 - fs * 0.55), color: fg, whiteSpace: "nowrap", ...(align === "r" ? { right: px(W / 2 + cw / 2 + gap) } : { left: px(W / 2 + cw / 2 + gap) }) });
		D.apply(n,"display",{step:8});
		return n;
	};
	const leadN = line(DOUBLE(s.lead || "Explore"), "r");
	const wordNs = words.map((w) => line(w, "l"));
	const stacked = leadN.scrollWidth + Math.max(...wordNs.map(n => n.scrollWidth)) + cw + gap * 2 > K.safe.w * 0.94;
	if (stacked) {
		const width = K.safe.w * 0.94;
		for (const node of [leadN, ...wordNs]) {
			set(node, { left: px((W - width) / 2), right: "auto", width: px(width), whiteSpace: "normal", overflowWrap: "anywhere", textAlign: "center" });
			D.fitSize(node, width, H * 0.16, "display", {wrap:"anywhere"});
			set(node, { top: px(node === leadN ? H / 2 - ch / 2 - gap - node.offsetHeight : H / 2 + ch / 2 + gap) });
		}
	}
	const face = (k, parent) => {
		const c = el("div", "", parent);
		const ic = icons[k];
		set(c, { position: "absolute", left: px(-cw / 2), top: px(-ch / 2), width: px(cw), height: px(ch), background: tints[k % tints.length] ?? accent, border: `${px(3.5 * S)} solid ${mixHex(fg, "#000000", 0.2)}`, boxShadow: `${px(5 * S)} ${px(6 * S)} 0 ${alpha(mixHex(fg, "#000000", 0.2), 0.9)}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", backfaceVisibility: "hidden" });
		D.surface(c, "card", { layout: "frame", purpose: "media" });
		D.forSurface(ch/(D.unit*48)).apply(c,"cardTitle");
		if (images?.[ic]) {
			const im = el("img", "", c);
			im.src = images[ic].src ?? ic;
			set(im, { width: "100%", height: "100%", objectFit: "cover" });
		} else c.textContent = ic;
		return c;
	};
	const holder = el("div", "", cam);
	holder.setAttribute("data-over", ""); // The icon cards intentionally overlap in the fan and pinwheel.
	set(holder, { position: "absolute", left: px(W / 2), top: px(H / 2), width: "0", height: "0", perspective: px(900 * S) });
	const cards = words.map((_, k) => {
		const w = el("div", "", holder);
		set(w, { position: "absolute", left: "0", top: "0", transformStyle: "preserve-3d" });
		face(k, w);
		return w;
	});
	// Doodles around the card: outline sparkles and dots that re-pop on every flip.
	const NS = "http://www.w3.org/2000/svg";
	const doodles = [0, 1, 2, 3, 4, 5].map((k) => {
		const a = (k / 6) * Math.PI * 2 + 0.4;
		const rr = ch * (0.78 + hash(k * 2.3) * 0.22);
		const svg = document.createElementNS(NS, "svg");
		const sz = (k % 2 ? 16 : 30) * S * (vertical ? 0.8 : 1);
		svg.setAttribute("viewBox", "-12 -12 24 24");
		svg.style.cssText = `position:absolute;left:${-sz / 2}px;top:${-sz / 2}px;width:${sz}px;height:${sz}px;overflow:visible`;
		const path = document.createElementNS(NS, k % 2 ? "circle" : "path");
		if (k % 2) {
			path.setAttribute("r", "8");
			path.setAttribute("fill", tints[(k + 2) % tints.length] ?? accent);
			path.setAttribute("stroke", mixHex(fg, "#000000", 0.2));
			path.setAttribute("stroke-width", "2");
		} else {
			path.setAttribute("d", "M0 -10 Q1.5 -1.5 10 0 Q1.5 1.5 0 10 Q-1.5 1.5 -10 0 Q-1.5 -1.5 0 -10Z");
			path.setAttribute("fill", "none");
			path.setAttribute("stroke", mixHex(fg, "#000000", 0.2));
			path.setAttribute("stroke-width", "1.8");
			path.setAttribute("stroke-linejoin", "round");
		}
		svg.appendChild(path);
		holder.appendChild(svg);
		return { svg, x: Math.cos(a) * rr * 1.25, y: Math.sin(a) * rr * 0.8, k };
	});
	const n = words.length;
	const gather = s.gather !== false && n >= 3;
	// When the words change, the cards fan out and gather is the scene's moments (scene-moments.cjs).
	const swapAt = p.at.swaps;
	const tFan = p.at.fan;
	const tGather = p.at.gather;
	const fanW = Math.min(W * 0.5, n * cw * 0.62);
	return (l, d) => {
		const fan = gather ? E.snapSettle(prog(l, tFan, 0.5)) : 0;
		const gath = gather ? E.softInOut(prog(l, tGather, 0.75)) : 0;
		const leave = gather ? E.accelExit(prog(l, tGather - 0.05, 0.4)) : 0;
		// The lead arrives sliding in, then makes room for the fan, then leaves.
		const inK = E.softLand(prog(l, -0.1, 0.45));
		set(leadN, { transform: `translateX(${px(-(1 - inK) * 60 * S - (stacked ? 0 : fan * fanW * 0.5) - leave * W * 0.4)})`, opacity: (clamp((l + 0.1) / 0.12) * (1 - leave)).toFixed(3), filter: leave > 0.01 ? `blur(${(leave * 14 * S).toFixed(2)}px)` : "none" });
		// The current word: the old one rolls up and out, accelerating; the new one lands from below.
		let cur = 0;
		for (let k = 0; k < n; k++) if (l >= swapAt[k]) cur = k;
		wordNs.forEach((wn, k) => {
			const enter = k === 0 ? E.softLand(prog(l, -0.05, 0.42)) : E.softLand(prog(l, swapAt[k] + 0.08, 0.36));
			const exit = k < n - 1 ? E.accelExit(prog(l, swapAt[k + 1] - 0.04, 0.15)) : 0;
			const on = k === 0 ? 1 : l >= swapAt[k] + 0.08 ? 1 : 0;
			const y = (1 - enter) * fs * 0.85 - exit * fs * 0.9;
			const blur = (1 - enter) * 0.07 + exit * 0.1;
			set(wn, { opacity: (on * clamp(enter * 3) * (1 - exit) * (1 - leave)).toFixed(3), transform: `translate(${px((stacked ? 0 : fan * fanW * 0.5) + leave * W * 0.4)}, ${px(y)})`, filter: blur > 0.003 ? `blur(${(blur * fs).toFixed(2)}px)` : "none" });
		});
		// Cards: one at a time in the gap, flipping on each change; then fanned; then a pinwheel.
		const spin = l * 24 * gath;
		cards.forEach((c, k) => {
			let rotY = 0;
			let vis = 0;
			let pop = 1;
			if (!fan) {
				if (k === cur) {
					const f = k === 0 ? 1 : prog(l, swapAt[k] - 0.04, 0.3);
					rotY = (1 - E.softLand(f)) * -180;
					vis = rotY > -90 ? 1 : 0;
					pop = 1 + Math.sin(f * Math.PI) * 0.08;
					if (k === 0) {
						const a = E.snapSettle(prog(l, 0, 0.5));
						pop = 1 + (1 - a) * 0.8;
						vis = l >= 0 ? 1 : 0;
					}
				} else if (k === cur - 1) {
					const f = prog(l, swapAt[cur] - 0.04, 0.3);
					rotY = E.softLand(f) * 180;
					vis = rotY < 90 ? 1 : 0;
					pop = 1 + Math.sin(f * Math.PI) * 0.08;
				}
				const tilt = (hash(k * 4.4) - 0.5) * 12 + Math.sin(l * 1.6 + k) * 2;
				set(c, { opacity: String(vis), transform: `rotateY(${rotY.toFixed(2)}deg) rotate(${tilt.toFixed(2)}deg) scale(${pop.toFixed(4)})` });
				return;
			}
			// Fan: spread out across the gap, each a frame apart, overlapping like a hand of cards.
			const fk = E.snapSettle(prog(l, tFan + k * 0.035, 0.5));
			const fx = (k - (n - 1) / 2) * (fanW / Math.max(1, n - 1)) * fk;
			const frot = (k - (n - 1) / 2) * 7 * fk + (hash(k * 4.4) - 0.5) * 12 * (1 - fk);
			const fy = Math.abs(k - (n - 1) / 2) * 10 * S * fk;
			// Gather: swing round the centre into a pinwheel mark.
			const pa = (k / n) * 360 + spin;
			const prad = cw * 0.3;
			const px_ = Math.cos(((pa - 90) * Math.PI) / 180) * prad;
			const py_ = Math.sin(((pa - 90) * Math.PI) / 180) * prad;
			const x = fx + (px_ - fx) * gath;
			const y = fy + (py_ - fy) * gath;
			const rot = frot + (pa + 20 - frot) * gath;
			const sc = 1 + gath * 0.35;
			set(c, { opacity: "1", transform: `translate(${px(x)}, ${px(y)}) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(4)})`, zIndex: String(k) });
		});
		for (const dd of doodles) {
			const since = l - swapAt[cur];
			const pk = E.snapSettle(clamp((since - dd.k * 0.03) / 0.35));
			const tw = 1 + Math.sin(l * 4 + dd.k * 2) * 0.08;
			const out = Math.max(fan, leave);
			set(dd.svg, { transform: `translate(${px(dd.x * (1 + out * 0.6))}, ${px(dd.y * (1 + out * 0.6))}) rotate(${(l * 30 + dd.k * 40).toFixed(1)}deg) scale(${((1 + (1 - pk) * 0.9) * tw * (1 - gath)).toFixed(4)})`, opacity: (clamp(pk * 2) * (1 - gath)).toFixed(3) });
		}
	};
};

