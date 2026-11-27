// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {accents, media} from '../_shared/media.mjs';
// ---- mosaic: a grid of panels with crosshairs and one word over it ------------------------------
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, expoOut, spring, hash, images, mockUI, alpha } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const cols = vertical ? 2 : 3;
	const rowsN = vertical ? 3 : 2;
	const g = 6 * S;
	const pw = (W - g * (cols + 1)) / cols;
	const ph = (H - g * (rowsN + 1)) / rowsN;
	const pics = (s.images ?? []).map((u) => images[u]).filter(Boolean);
	const panels = [];
	const order = [4, 0, 2, 5, 1, 3];
	for (let r = 0; r < rowsN; r++)
		for (let c = 0; c < cols; c++) {
			const i = r * cols + c;
			const pn = el("div", "", cam);
			set(pn, { position: "absolute", left: px(g + c * (pw + g)), top: px(g + r * (ph + g)), width: px(pw), height: px(ph), overflow: "hidden", fontSize: px(Math.min(pw, ph)) });
			D.surface(pn, "card", { density: "compact", layout: "frame", purpose: "media" });
			const inner = el("div", "", pn);
			set(inner, { position: "absolute", inset: "0", fontSize: px(Math.min(pw, ph)) });
			if (pics.length) media(K, inner, pics[i % pics.length], i, palette, bg);
			else if (i % 2 === 1) {
				// The product itself in every other panel.
				media(K, inner, null, i + p.index * 3, palette, bg, null);
				inner.innerHTML = "";
				const box = el("div", "", inner);
				set(box, { position: "absolute", left: "9%", top: "12%", width: "92%", height: "96%", overflow: "hidden", boxShadow: `0 ${px(20 * S)} ${px(50 * S)} rgba(0,0,0,0.25)`, background: "#fff" });
				D.surface(box, "card", { layout: "frame", purpose: "window" });
				mockUI(box, palette, accent, i, ["dashboard", "inbox", "chat"][i % 3]);
			} else media(K, inner, null, i + p.index * 3, palette, bg, null);
			// A panel is a tenth of a second open on its moment (`p.at`).
			panels.push({ pn, inner, at: p.at.first + order.indexOf(i % 6) * p.at.every - 0.1, dir: i % 4 });
		}
	const shade = el("div", "", cam);
	set(shade, { position: "absolute", inset: "0", background: "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(0,0,0,0.38), transparent 75%)" });
	const plus = [];
	for (let r = 1; r < rowsN; r++)
		for (let c = 1; c < cols; c++) {
			const x = c * (pw + g) + g / 2;
			const y = r * (ph + g) + g / 2;
			const pl = el("div", "", cam);
			const a = 22 * S;
			set(pl, { position: "absolute", left: px(x - a), top: px(y - a), width: px(a * 2), height: px(a * 2), background: `linear-gradient(#fff,#fff) center/100% ${px(2.5 * S)} no-repeat, linear-gradient(#fff,#fff) center/${px(2.5 * S)} 100% no-repeat` });
			plus.push(pl);
		}
	const wrap = el("div", "center", cam);
	const word = el("div", "", wrap, s.text.replace(/\*/g, ""));
	set(word, { color: "#ffffff", textShadow: `0 ${px(6 * S)} ${px(50 * S)} rgba(0,0,0,0.45)`, whiteSpace: "nowrap" });
	D.fitSize(word, K.safe.w * 0.9, H * 0.34, "hero", { align: "center" });
	word.textContent = "";
	const { glyphs } = K.glyphText(word, s.text.replace(/\*/g, ""));
	// A measured backing protects white headline ink over arbitrary screenshots.
	// It is outside the text layout, so fitting and the original anchor stay exact.
	const captionPlate = el("div", "", wrap);
	const scrimBox = D.box("badge", { density: "comfortable" });
	captionPlate.dataset.designMaterial = "headline-scrim";
	set(captionPlate, { position: "absolute", left: px(word.offsetLeft - scrimBox.paddingX), top: px(word.offsetTop - scrimBox.paddingY), width: px(word.offsetWidth + scrimBox.paddingX * 2), height: px(word.offsetHeight + scrimBox.paddingY * 2), background: "rgba(0,0,0,0.74)", opacity: "0", pointerEvents: "none", zIndex: "1" });
	D.surface(captionPlate, "badge", { density: "comfortable", layout: "absolute" });
	D.surfaceContent(captionPlate, word);
	set(word, { position: "relative", zIndex: "2" });
	// Labels occupy two reserved bands around the headline, never its line box.
	const noteBands = [0, 1].map((i) => {
		const band = el("div", "", cam);
		set(band, { position: "absolute", left: px(K.safe.x), width: px(K.safe.w), ...(i ? { bottom: px(H - K.safe.y - K.safe.h + D.space(4)) } : { top: px(K.safe.y + D.space(4)) }), display: "flex", flexWrap: "wrap", justifyContent: "center", gap: px(D.space(2)), zIndex: "3" });
		return band;
	});
	const notes = (s.notes ?? []).map((t, i) => {
		const nd = el("div", "", noteBands[i % noteBands.length]);
		set(nd, { maxWidth: px(K.safe.w), background: "rgba(255,255,255,0.88)", color: "#111318", whiteSpace: "normal", boxShadow: `0 ${px(14 * S)} ${px(40 * S)} rgba(0,0,0,0.22)`, display: "flex", alignItems: "center" });
		const noteBox = D.surface(nd, "badge", { shape: "pill" });
		D.apply(nd,"label");
		const dot = el("span", "", nd);
		set(dot, { width: px(12 * S), height: px(12 * S), borderRadius: "50%", background: accent, flex: "none" });
		const label = el("span", "", nd, t);
		set(label, { display: "block", maxWidth: px(K.safe.w - noteBox.paddingX * 2 - 12 * S - noteBox.gap) });
		D.truncateLine(label);label.title = t;
		return nd;
	});
	const noteAreas = [
		{ top: K.safe.y, bottom: word.offsetTop - D.space(3) },
		{ top: word.offsetTop + word.offsetHeight + D.space(3), bottom: K.safe.y + K.safe.h },
	];
	for (const [i, band] of noteBands.entries()) {
		const area = noteAreas[i];
		if (band.offsetHeight > area.bottom - area.top) {
			for (const note of band.children) D.surface(note, "badge", { density: "compact", shape: "pill" });
		}
		if (band.offsetHeight > area.bottom - area.top) throw new Error("Mosaic notes exceed their reserved headline bands");
		set(band, { top: px(clamp(band.offsetTop, area.top, area.bottom - band.offsetHeight)), bottom: "auto" });
	}
	return (l, d) => {
		for (const k of panels) {
			const e = expoOut(prog(l, k.at, 0.6));
			const ins = ((1 - e) * 100).toFixed(2);
			const clip = [`inset(0 0 ${ins}% 0)`, `inset(0 ${ins}% 0 0)`, `inset(${ins}% 0 0 0)`, `inset(0 0 0 ${ins}%)`][k.dir];
			set(k.pn, { clipPath: clip });
			set(k.inner, { transform: `scale(${(1.25 - 0.17 * e - 0.04 * (l / d)).toFixed(4)})` });
		}
		const pk = expoOut(prog(l, 0.45, 0.5));
		for (const pl of plus) set(pl, { opacity: pk.toFixed(3), transform: `scale(${pk.toFixed(4)}) rotate(${((1 - pk) * 90).toFixed(2)}deg)` });
		set(shade, { opacity: expoOut(prog(l, 0.4, 0.6)).toFixed(3) });
		set(captionPlate, { opacity: expoOut(prog(l, .5, .3)).toFixed(3) });
		glyphs.forEach((gl, i) => {
			const k = expoOut(prog(l, 0.55 + i * 0.035, 0.7));
			set(gl.node, { display: "inline-block", opacity: k.toFixed(3), transform: `translateY(${((1 - k) * 0.2).toFixed(4)}em)`, filter: k < 0.99 ? `blur(${((1 - k) * 0.1).toFixed(4)}em)` : "none" });
		});
		notes.forEach((nd, i) => {
			const k = spring(l - (0.8 + i * 0.25), 2.6, 0.6);
			set(nd, { opacity: clamp((l - 0.8 - i * 0.25) / 0.1).toFixed(3), transform: `translateY(${px((1 - k) * 30 * S)}) scale(${(0.8 + 0.2 * k).toFixed(4)})` });
		});
	};
};

