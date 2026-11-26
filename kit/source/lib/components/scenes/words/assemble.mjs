// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE} from '../_shared/ground.mjs';
// ---- assemble: a ransom-note word resolves into one clean word -------------------------------------
// Every letter arrives on its own scrap of paper in a different face (a serif italic, a condensed
// black, a mono, a hairline), flickers through a couple more, then the scraps drop away and the
// letters glide into the shared brand headline. Seen in Oddfellows' launch films: the collage settles.
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
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

