// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../metadata.mjs';
import {swift} from './_shared/text.mjs';
const sceneFactories = {};
// Every move speeds up and then slows down. `inOut` is even; `swift` gets up to speed in its first part and
// takes the rest of its time to stop.
const inOut = (k) => k * k * (3 - 2 * k);
// The same with more of both: a move that is seen to gather itself and to brake.
const firm = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
// How much of a ring a spinning line takes, in radians: its ends are turned 40 degrees away.
const ARC = 1.4;

/**
 * The sign of the Kinetic Text family: one tube of light, nearly white at its
 * core in a glow of its own colour. `tube(k)` is its colour, the standing
 * light at 0 and the other, of words that are taken or in motion, at 1.
 */
const kineticSign = (K, palette, accent, em) => {
	const { px } = K;
	const lights = [palette?.signTaken ?? accent, palette?.signStanding ?? palette?.brand2 ?? accent];
	const tube = (k) => `color-mix(in srgb, ${lights[0]} ${(k * 100).toFixed(1)}%, ${lights[1]})`;
	return { lights, tube,
		core: (k) => `color-mix(in srgb, ${tube(k)} 12%, #fff)`,
		glow: (k, strength = 1) => `0 0 ${px(em * 0.035)} #fff, 0 0 ${px(em * 0.11)} ${tube(k)}, 0 0 ${px(em * 0.3)} ${tube(k)}, 0 0 ${px(em * 0.75 * strength)} color-mix(in srgb, ${tube(k)} 70%, transparent)` };
};

/**
 * A line that is edited before the viewer, drawn as a sign of one tube of
 * light in a font of its own: it stands in the wrong order, the words that
 * are out of place are selected (they take the other light and lift off the
 * line), carried over the rest behind a caret and dropped where
 * they belong; then, with a picture or a video, a strip of that clip grows
 * out of a caret between the words, and the words leave to the sides. Ours, after one move of Apple's
 * Creator Studio film (SOURCE.json). Every frame comes from the scene's time
 * alone: the two orders are measured once, and the words move between them.
 */
sceneFactories["kinetic-swap-words"] = ({ p, cam, fg, accent, palette, K }) => {
	const { W, el, set, px, clamp } = K;
	const s = p.scene;
	const def = metadata["kinetic-swap-words"];
	const length = p.ldur ?? p.dur;
	const t = def.times(s, length, p.beatLen);
	const { moved, rest, first } = def.parts(s);
	const hasClip = Boolean(s.image || s.video);
	const smooth = inOut;
	const at = (from, to, l) => clamp((l - from) / Math.max(1e-6, to - from), 0, 1);

	const wrap = el("div", "center", cam);
	const line = el("div", "bold", wrap);
	set(line, { position: "relative", whiteSpace: "nowrap", color: fg, lineHeight: "1.15" });

	// The line as it ends, to fit and to measure: the moved words, a space, the rest.
	const a = el("span", "", line, moved), gap = el("span", "", line, " "), b = el("span", "", line, rest);
	if (!first) line.insertBefore(b, a), line.insertBefore(gap, a);
	for (const node of [a, b]) set(node, { display: "inline-block", whiteSpace: "pre" });
	set(gap, { display: "inline-block", whiteSpace: "pre" });
	// A tube is bent from one line: the sign has a font of its own (the definition's `font`), set on the
	// words themselves, since the line's own font is its role's.
	for (const node of [a, gap, b]) set(node, { fontFamily: `"${def.font}", sans-serif`, fontWeight: "700" });
	// The line reads as a line of an editor, not as a poster: a sixth of a wide frame's height at most, a
	// tenth of a square or tall one, and with a clip between the words still inside the frame.
	const { H } = K;
	K.design.fitSize(line, K.safe.w * (hasClip ? 0.56 : 0.86), K.safe.h * (W > H * 1.2 ? 0.17 : 0.11), "sceneTitle", { wrap: "nowrap" });
	const em = parseFloat(getComputedStyle(line).fontSize) || 48;
	const wa = a.getBoundingClientRect().width / (K.scale || 1), wb = b.getBoundingClientRect().width / (K.scale || 1);
	const sp = gap.getBoundingClientRect().width / (K.scale || 1), high = em * 1.15;
	const full = wa + sp + wb;
	gap.remove();
	set(line, { width: px(full), height: px(high) });
	for (const node of [a, b]) set(node, { position: "absolute", left: "0", top: "0", willChange: "transform" });
	// Where each part stands, from the line's left: in the order it ends in, and in the wrong one.
	const ends = first ? { a: 0, b: wa + sp } : { a: wb + sp, b: 0 };
	const begins = first ? { a: wb + sp, b: 0 } : { a: 0, b: wa + sp };
	// The line is a sign of one tube of light: standing, the second light of the family; taken, the first.
	const { lights, tube, core, glow: tubeGlow } = kineticSign(K, palette, accent, em);
	// A tube does not come on at once: it flickers for the first third of a second, at 24 frames a second.
	const START = [0, 0, 1, 0.15, 0, 0.7, 1, 0.3, 1];
	const lit = (l) => START[Math.floor((l + 1e-6) * 24)] ?? 1;
	const caret = el("span", "", line);
	const caretW = Math.max(2, em * 0.035), caretH = high * 1.16;
	set(caret, { position: "absolute", top: px(-high * 0.08), width: px(caretW), height: px(caretH), background: accent, borderRadius: px(em * 0.02), opacity: "0" });

	// The clip between the words: a strip of its frames over a band of sound, in a selection of the accent.
	const stripH = high * 1.5, stripW = hasClip ? Math.min(K.safe.w * 0.34, stripH * 4.2) : 0;
	// A source drawn into a box as large as needed to cover it, the rest cut off.
	const cover = (g, source, x, y, w, h) => {
		const sw = source.videoWidth || source.naturalWidth || source.width, sh = source.videoHeight || source.naturalHeight || source.height;
		if (!sw || !sh || w <= 0 || h <= 0) return;
		const k = Math.max(w / sw, h / sh), cw = w / k, ch = h / k;
		g.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, w, h);
	};
	const sharp = hasClip ? 1.3 : 1;
	let strip = null, ring = null, halo = null, paint = null;
	if (hasClip) {
		// The clip hangs in a tube of its own: a ring of the sign's two lights that run round it, and their glow.
		halo = el("div", "", line);
		ring = el("div", "", line);
		for (const node of [halo, ring]) set(node, { position: "absolute", opacity: "0", pointerEvents: "none" });
		set(halo, { filter: `blur(${px(em * 0.3)})` });
		strip = el("div", "", line);
		set(strip, { position: "absolute", top: px((high - stripH) / 2), height: px(stripH), width: px(stripW), borderRadius: px(em * 0.12), overflow: "hidden", opacity: "0",
			background: "#0a0d14", transformOrigin: "50% 50%" });
		const canvas = document.createElement("canvas");
		// Drawn at the size it ends at, a little larger than it stands, so it is sharp there.
		const tiles = 4, th = Math.round(stripH * 0.74 * sharp), tw = Math.round(stripW * sharp / tiles);
		canvas.width = tw * tiles; canvas.height = Math.round(stripH * sharp);
		// The frames keep their own size and stand in the middle of the strip: the strip is a window that
		// opens over them, so nothing is ever stretched.
		set(canvas, { position: "absolute", left: "50%", top: "50%", width: px(stripW), height: px(stripH), translate: "-50% -50%" });
		strip.append(canvas);
		const g = canvas.getContext("2d");
		// The band of sound under the frames: the same bars whenever it is drawn.
		let seed = 0x2545f491 ^ Math.imul(String(s.text).length + 7, 0x9e3779b1);
		const bars = Array.from({ length: 64 }, () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 1000) / 1000; });
		paint = (source) => {
			g.fillStyle = "#101a33"; g.fillRect(0, 0, canvas.width, canvas.height);
			// Each frame of the strip is the clip cropped to its own shape.
			if (source) for (let i = 0; i < tiles; i++) cover(g, source, i * tw + sharp, 0, tw - 2 * sharp, th);
			g.fillStyle = "#7f9bd6";
			const room = canvas.height - th - 4 * sharp, step = canvas.width / bars.length;
			bars.forEach((v, i) => { const h = Math.max(1, v * room * 0.9); g.fillRect(i * step, canvas.height - 2 * sharp - h, Math.max(1, step * 0.6), h); });
		};
		paint(null);
		if (s.image && K.images[s.image]) {
			const im = new Image();
			im.crossOrigin = "anonymous";
			im.onload = () => { still = im; paint(im); };
			im.src = K.images[s.image].src;
			K.defer(im.decode ? im.decode().then(() => paint(im)).catch(() => {}) : Promise.resolve());
		}
	}
	let video = null, still = null;
	// The video whole, in its own shape: the scene crops it itself, to a frame of the strip and, handed over,
	// to the place it goes to, so it is asked for as large as it will be shown.
	const large = s.to ? Math.max(s.to.w * W, s.to.h * K.H) : stripW * sharp / 2;
	if (s.video) K.defer(K.videoSource(0, large, large, { whole: true }).then((source) => { video = source.element; }));

	// Handing the clip over: with `to` the scene ends with the clip standing in that part of the frame, as one
	// picture, for what follows to take it up there. The picture is never bent to fit: it is cropped.
	let out = null, outCanvas = null;
	if (hasClip && s.to) {
		// In the frame itself, not in the layer the scene's own content is fitted in: a part of the frame is
		// a part of the frame.
		out = el("div", "", cam.parentElement ?? cam);
		set(out, { position: "absolute", overflow: "hidden", background: "#0a0d14", display: "none" });
		outCanvas = document.createElement("canvas");
		set(outCanvas, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%" });
		out.append(outCanvas);
	}
	const lift = high * 0.62;
	// How much the clip grows as it goes out at the end: a fifth, no more. It never fills the frame.
	const ZOOM = hasClip ? 0.2 : 0;
	// How the taken words travel, as a hand would carry them and never evenly: a quick pull towards the place,
	// a hover over the line while the rest makes room, then the last of the way. `u` is the share of the carry.
	const way = (u) => {
		if (u < 0.28) return 0.56 * swift(u / 0.28);
		if (u < 0.68) return 0.56 + 0.16 * inOut((u - 0.28) / 0.4);
		return 0.72 + 0.28 * inOut((u - 0.68) / 0.32);
	};
	return (l) => {
		const between = Math.min(ends.a, ends.b) + (first ? wa : wb) + sp / 2;
		const taken = smooth(at(t.select, t.select + 0.12, l));
		const u = at(t.carry, t.drop, l);
		// Down onto the line in the last tenth of the carry, a little past it, and back.
		const fall = at(t.drop - 0.09, t.drop, l), settle = at(t.drop, t.drop + 0.14, l);
		const held = taken * (1 - inOut(fall));
		const selected = taken * (1 - smooth(at(t.drop, t.drop + 0.08, l)));
		// Higher in the middle of the way than at its ends: an arc over the rest of the line.
		const height = lift * held * (1 + 0.6 * Math.sin(Math.PI * Math.min(1, u / 0.9))) - lift * 0.1 * Math.sin(Math.PI * settle) * (1 - settle);
		const carried = way(u);
		// The rest steps aside in one move, when the caret has come to its place.
		const made = swift(at(t.carry + (t.drop - t.carry) * 0.58, t.carry + (t.drop - t.carry) * 0.78, l));
		// With a clip the line opens: the words part by the strip's width and the whole line gives room.
		// The clip opens in a burst that takes its time to stop, and goes a little past its width and back.
		const opening = hasClip ? at(t.open, t.placed, l) : 0, opened = swift(opening);
		const room = opened * (stripW + sp);
		const left = (which) => begins[which] + (ends[which] - begins[which]) * (which === "a" ? carried : made);
		// Then the clip grows a little from its own middle and the words go out to the sides.
		const leaving = hasClip ? at(t.leave, out ? t.arrive : Math.max(t.leave + 0.2, length - 0.05), l) : 0, gone = firm(leaving);
		// As it grows the line goes out, to nothing by the end of the scene: what follows starts clean.
		const faded = inOut(at(out ? 0 : 0.25, out ? 0.55 : 1, leaving));
		const shift = (which) => (ends[which] > ends[which === "a" ? "b" : "a"] ? 1 : -1) * (room / 2 + gone * W * 0.3);
		// As the line opens the words grow and go apart, out of the frame if they must: the clip takes the middle.
		const grown = 1 + 0.24 * opened;
		// Nothing stands still once the clip is in: the frame keeps coming closer, slowly, until it goes in.
		const nearer = hasClip ? 0.07 * inOut(at(t.placed - 0.1, t.leave + 0.15, out ? Math.min(l, t.leave) : l)) : 0;
		set(line, { scale: ((1 + nearer) * (1 + (out ? 0 : ZOOM) * gone)).toFixed(4), transformOrigin: `${px(between)} 50%`, opacity: (1 - faded).toFixed(3) });
		const side = begins.a > ends.a ? -1 : 1;
		set(a, { translate: `${px(left("a") + shift("a"))} ${px(-height)}`, scale: ((1 + 0.14 * held - 0.03 * Math.sin(Math.PI * settle)) * grown).toFixed(4), transformOrigin: opened > 0 ? `${ends.a < ends.b ? 100 : 0}% 60%` : "50% 60%",
			rotate: `${(side * 2.4 * held * Math.sin(Math.PI * u)).toFixed(3)}deg`,
			// Nearly white at the core, in a glow of the tube's own colour, wider while the words are taken.
			color: core(selected), textShadow: tubeGlow(selected, 1 + 0.3 * selected) });
		set(b, { translate: `${px(left("b") + shift("b"))} 0`, scale: grown.toFixed(4), transformOrigin: `${ends.b < ends.a ? 100 : 0}% 60%`, opacity: ((1 - 0.55 * selected) * lit(l)).toFixed(3), color: core(0), textShadow: tubeGlow(0) });
		a.style.opacity = lit(l).toFixed(3);
		// The caret stands where the words were taken from, then jumps to where they will be put: in front of
		// the rest of the line, and it stays at that word's first letter while the word steps aside.
		const from = begins.a - sp / 2, to = first ? left("b") + shift("b") - sp * 0.18 : ends.a - sp / 2;
		const jumped = swift(at(t.carry + (t.drop - t.carry) * 0.46, t.carry + (t.drop - t.carry) * 0.62, l));
		// With a clip the caret comes back between the words, and the clip grows out of it.
		const waits = hasClip && l >= t.open - Math.min(0.3, (t.open - t.drop) * 0.5) && opened <= 0.001;
		set(caret, { left: px(waits ? between - caretW / 2 : from + (to - from) * jumped), opacity: waits || (selected > 0.5 && Math.floor(l / 0.26) % 4 !== 3) ? "1" : "0" });
		if (strip) {
			// A window that opens from the caret's own width and height to the strip's, wider first and then to
			// its full height: the clip behind it fills the room as it comes.
			const wide = caretW + (stripW - caretW) * (opened + 0.05 * Math.sin(Math.PI * opening) * opened), tall = caretH + (stripH - caretH) * firm(at(0.2, 1, opened));
			set(strip, { left: px(between - wide / 2), top: px((high - tall) / 2), width: px(wide), height: px(tall), opacity: opened > 0.001 ? "1" : "0" });
			// The lights go once round the clip in three seconds, now quicker and now slower; the same turn at the
			// same moment of the scene.
			const edge = Math.max(2, em * 0.05), turn = (((l * 120 + 26 * Math.sin(l * 2.1)) % 360 + 360) % 360).toFixed(1);
			const lightsRound = `conic-gradient(from ${turn}deg, ${lights[0]}, ${lights[1]}, #fff 52%, ${lights[1]}, ${lights[0]})`;
			for (const [node, grow] of [[ring, edge], [halo, edge * 2.2]]) set(node, { left: px(between - wide / 2 - grow), top: px((high - tall) / 2 - grow), width: px(wide + 2 * grow), height: px(tall + 2 * grow),
				borderRadius: px(em * 0.12 + grow), background: lightsRound, opacity: opened > 0.001 ? (node === halo ? "0.9" : "1") : "0" });
			if (video && opened > 0.001 && !(out && leaving > 0)) paint(video);
			if (out) {
				const on = leaving > 0;
				out.style.display = on ? "block" : "none";
				strip.style.visibility = on ? "hidden" : "visible";
				if (on) {
					// From where the strip stands to the place it is handed over in: its middle and its size go there
					// together, and its four frames become one that fills it.
					// Where the strip stands is measured as it is seen, under everything that places the line.
					const host = out.parentElement.getBoundingClientRect(), seen = strip.getBoundingClientRect(), k = host.width / W || 1;
					const from = { x: (seen.left + seen.width / 2 - host.left) / k, y: (seen.top + seen.height / 2 - host.top) / k, w: seen.width / k, h: seen.height / k };
					const k0 = from.w / stripW;
					const to = { x: (s.to.x + s.to.w / 2) * W, y: (s.to.y + s.to.h / 2) * K.H, w: s.to.w * W, h: s.to.h * K.H };
					const mix = (a, b) => a + (b - a) * gone;
					const w = mix(from.w, to.w), h = mix(from.h, to.h);
					set(out, { left: px(mix(from.x, to.x) - w / 2), top: px(mix(from.y, to.y) - h / 2), width: px(w), height: px(h), borderRadius: px(em * 0.12 * k0 * (1 - gone)) });
					const cw = Math.max(2, Math.round(w)), ch = Math.max(2, Math.round(h));
					if (outCanvas.width !== cw || outCanvas.height !== ch) { outCanvas.width = cw; outCanvas.height = ch; }
					const g = outCanvas.getContext("2d"), source = video ?? still;
					g.fillStyle = "#101a33"; g.fillRect(0, 0, cw, ch);
					// The band of sound goes down out of the window; the frames widen from a quarter of it to all of it,
					// the second of them coming to the middle.
					const band = stripH * 0.26 * k0 * (1 - gone), tall = ch - band, wide = mix(cw / 4, cw), middle = mix(1.5, 1, gone), gap = 1 - gone;
					if (source) for (let i = 0; i < 4; i++) cover(g, source, cw / 2 + (i - middle) * wide - wide / 2 + gap, 0, wide - 2 * gap, tall);
				}
			}
		}
	};
};

/**
 * A line that spins, in real space: its letters stand upright on a ring, each
 * turned to face outwards, and the ring turns about its upright axis under a
 * camera with perspective. So the line swings off to one side, goes round
 * behind, where it is seen from its back, mirrored and dim, and comes to the
 * front again; a few fast turns that slow into place on a beat. The browser
 * does the geometry (CSS 3D: one `rotateY` of the ring), nothing is faked by
 * moving letters about; the scene only says how far the ring has turned and
 * how much light each letter gets for the way it faces. In the film's own
 * font and ink. Ours, after one move of Apple's Creator Studio film ("Loop
 * it.", SOURCE.json).
 */
sceneFactories["kinetic-spin-words"] = ({ p, cam, fg, K }) => {
	const { W, H, el, set, px, clamp } = K;
	const s = p.scene;
	const def = metadata["kinetic-spin-words"];
	const t = def.times(s, p.ldur ?? p.dur, p.beatLen);
	const wrap = el("div", "center", cam);
	const line = el("div", "bold", wrap);
	set(line, { position: "relative", whiteSpace: "nowrap", lineHeight: "1.15", color: fg });
	const parts = def.units(s.text).map((unit) => {
		const node = el("span", "", line, unit);
		set(node, { display: "inline-block", whiteSpace: "pre" });
		return { node };
	});
	const widest = K.safe.w * 0.6;
	const tallest = K.safe.h * (W > H * 1.2 ? 0.32 : 0.14), scale = K.scale || 1;
	K.design.fitSize(line, widest, tallest, "display", { wrap: "nowrap" });
	// The type ladder stops well short of a short word's room: the line is then set as large as its length
	// lets it be, a long one to the width, a short one to the height.
	const stepped = parseFloat(getComputedStyle(line).fontSize) || 48, fitted = line.getBoundingClientRect();
	const grown = Math.min(widest / (fitted.width / scale), tallest / (fitted.height / scale));
	// The same step of the ladder on a larger unit, so its leading and tracking grow with it.
	K.design.forSurface(grown).apply(line, "display", { step: Number(line.dataset.designStep) });
	set(line, { maxWidth: "none" });
	const em = stepped * grown, high = em * 1.15;
	const box = line.getBoundingClientRect();
	for (const part of parts) {
		const r = part.node.getBoundingClientRect();
		part.width = r.width / scale;
		part.middle = (r.left - box.left) / scale + part.width / 2;
	}
	const full = box.width / scale;
	// The ring is one size for the frame, and a line takes of it what its length asks: the widest line ARC,
	// a short word a small part. The camera stands a few radii away, so the near side is a little larger
	// than the far one.
	const radius = widest / ARC;
	set(line, { width: px(full), height: px(high), perspective: px(radius * 4.2), perspectiveOrigin: "50% 50%" });
	const ring = el("div", "", line);
	set(ring, { position: "absolute", left: px(full / 2), top: "0", width: "0", height: px(high), transformStyle: "preserve-3d" });
	for (const part of parts) {
		part.angle = (part.middle - full / 2) / radius;
		ring.append(part.node);
		// Each letter is a plane on the ring, facing out; from behind it is seen mirrored, as a sign on glass is.
		set(part.node, { position: "absolute", left: px(-part.width / 2), top: "0", backfaceVisibility: "visible",
			transform: `rotateY(${part.angle.toFixed(5)}rad) translateZ(${px(radius)})` });
	}
	const whole = (t.turns + 0.5) * 2 * Math.PI;
	return (l) => {
		// It comes from behind, gets up to speed, and takes most of its time to slow into place. A turn to the
		// left: what is in front goes left.
		const turned = whole * (1 - swift(clamp((l - t.start) / Math.max(1e-6, t.land - t.start), 0, 1)));
		// The ring's axis is its own radius behind the page, so the letters in front are at their own size.
		set(ring, { transform: `translateZ(${px(-radius)}) rotateY(${turned.toFixed(5)}rad)` });
		for (const part of parts) {
			// Light by the way a letter faces: full when it faces the camera, little from behind.
			const facing = Math.cos(part.angle + turned);
			part.node.style.opacity = (facing > 0 ? 0.3 + 0.7 * facing ** 0.6 : 0.3 * (-facing) ** 0.5).toFixed(3);
		}
	};
};

export {sceneFactories};
export default sceneFactories;
