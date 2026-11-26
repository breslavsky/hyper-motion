// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE} from '../_shared/ground.mjs';
// ---- knockout: zoom through the type ---------------------------------------------------------------
// The frame is the background with one giant word cut out of it; the product shows through the
// letters. The camera dives into the thickest stroke of the word until the product fills the frame,
// then the product settles into a card and the line lands above it. The classic after-effects
// zoom-through, done with a real mask so the letters stay sharp at any scale.
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
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
