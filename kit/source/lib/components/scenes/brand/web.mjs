// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE} from '../_shared/hands.mjs';
// ---- web: the words around the product, joined to it --------------------------------------------------
// The product's mark in the middle; the words that describe it arrive on rings around it, each joined
// by a hairline; the camera turns slowly in 3D and the key words light up in turn. Seen in ab_works'
// "Pulse It" launch film.
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
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
