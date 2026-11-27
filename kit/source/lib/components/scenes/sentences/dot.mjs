// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE} from '../_shared/words.mjs';
// ---- dot: one ball carries the scene ------------------------------------------------------------
// "Reduce Motion": the lead word's letters tumble away, a ball drops in and bounces into place as
// the dot of the i (or a full stop), then rolls off, floods the frame, morphs through shapes and
// ends as a small dot with the product's words orbiting it in 3D.
export const factory = ({ p, cam, fg, accent, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, smooth, hash, alpha, mixHex, lum, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const word = DOUBLE(s.word || "Launch");
	const lead = DOUBLE(s.lead || "");
	const dark = lum(bg) < 0.4;
	const ink = dark ? "#f4f1ea" : "#141414";
	const inkBg = dark ? "#f4f1ea" : "#121212";
	const onInk = dark ? "#121212" : "#f4f1ea";

	// Glyphs: lay out "lead word" and "word" alone in hidden rows to get every letter's place.
	const wordRole = /\s/.test(word) ? "display" : "hero";
	let textSpec = D.type(wordRole), fs = textSpec.size;
	const iAt = (() => {
		const low = word.toLowerCase();
		const k = Math.max(low.lastIndexOf("i"), low.lastIndexOf("j"));
		return k;
	})();
	const shown = [...word].map((c, k) => (k === iAt ? (c === "j" ? "ȷ" : c === "i" ? "ı" : c) : c)).join("");
	const probe = (parts) => {
		const row = el("div", "display", cam);
		set(row, { position: "absolute", left: "0", top: "0", whiteSpace: "nowrap", visibility: "hidden" });
		D.apply(row,wordRole,{step:textSpec.step});
		const spans = [];
		parts.forEach((pt, pi) => {
			if (pi) el("span", "", row, " ");
			for (const c of pt) spans.push(el("span", "", row, c));
		});
		const w = row.offsetWidth;
		const out = spans.map((sp) => ({ x: sp.offsetLeft, w: sp.offsetWidth }));
		row.remove();
		return { w, out };
	};
	let solo;
	for(const candidate of D.steps(wordRole)) {
		textSpec=candidate;fs=candidate.size;solo=probe([shown]);
		if(solo.w<=W*(vertical?.78:.6) && (!lead || probe([lead,shown]).w<=W*.88))break;
	}
	if(solo.w>W*.96 || (lead && probe([lead,shown]).w>W*.96))throw new Error("Dot display copy exceeds available width");
	solo = probe([shown]);
	const both = lead ? probe([lead, shown]) : null;
	const top = H / 2 - textSpec.lineHeight / 2;
	const wordGroup = el("div", "word", cam);
	set(wordGroup, { position: "absolute", inset: "0" });
	const glyphs = [];
	const mk = (c, isLead, k) => {
		const n = el("div", "glyph display", wordGroup, c);
		set(n, { position: "absolute", left: "0", top: px(top), color: ink, whiteSpace: "pre", willChange: "transform" });
		D.apply(n,wordRole,{step:textSpec.step});
		return { n, isLead, k };
	};
	if (lead) [...lead].forEach((c, k) => glyphs.push({ ...mk(c, true, k), from: both.out[k].x + (W - both.w) / 2 }));
	[...shown].forEach((c, k) => glyphs.push({ ...mk(c, false, k), from: lead ? both.out[lead.length + k].x + (W - both.w) / 2 : null, to: solo.out[k].x + (W - solo.w) / 2, w: solo.out[k].w }));
	const wordGlyphs = glyphs.filter((g) => !g.isLead);
	const last = wordGlyphs[wordGlyphs.length - 1];
	const r = fs * 0.085;
	const dotTarget = iAt >= 0 ? { x: wordGlyphs[iAt].to + wordGlyphs[iAt].w / 2, y: top + fs * 0.17 } : { x: last.to + last.w + r * 1.6, y: top + fs * 0.8 - r };

	const flood = el("div", "", cam);
	set(flood, { position: "absolute", left: "0", top: "0", width: px(2 * r), height: px(2 * r), borderRadius: "50%", background: accent, willChange: "transform" });
	const shape = el("div", "", cam);
	const sz = Math.min(W, H) * 0.3;
	set(shape, { position: "absolute", left: px(W / 2 - sz / 2), top: px(H / 2 - sz / 2), width: px(sz), height: px(sz), background: inkBg, opacity: "0", willChange: "transform" });
	const ringBox = el("div", "", cam);
	set(ringBox, { position: "absolute", left: px(W / 2), top: px(H / 2), width: "0", height: "0", perspective: px(1400 * S), opacity: "0" });
	const ringInner = el("div", "word", ringBox);
	set(ringInner, { position: "absolute", left: "0", top: "0", transformStyle: "preserve-3d" });
	const ringStr = `${(s.ring?.length ? s.ring : [word, "in one prompt"]).map(DOUBLE).join(" · ").toUpperCase()} · `;
	const ringFs = D.type("sceneTitle").size;
	const R = Math.min(W, H) * (vertical ? 0.38 : 0.36);
	const ringCh = [...ringStr];
	const ringNodes = ringCh.map((c) => {
		const n = el("div", "glyph display", ringInner, c);
		set(n, { position: "absolute", left: "0", top: "0", color: onInk, whiteSpace: "pre", backfaceVisibility: "visible", transformOrigin: "50% 50%" });
		return n;
	});
	for(const n of ringNodes)D.apply(n,"sceneTitle");
	const ringW = ringNodes.map((n) => n.offsetWidth);
	const totalW = ringW.reduce((a, b) => a + b, 0) || 1;
	// Long copy forms several readable bands on the same rotating cylinder.
	const bandCount = Math.max(1, Math.ceil(totalW / (2 * Math.PI * R * .9)));
	const capacity = totalW / bandCount;
	const ringAng = [], ringY = [];
	let bandWidth = 0, band = 0;
	for (const w of ringW) {
		if (bandWidth > 0 && bandWidth + w > capacity && band < bandCount - 1) { band++; bandWidth = 0; }
		ringAng.push(((bandWidth + w / 2) / capacity) * 360);
		ringY.push((band - (bandCount - 1) / 2) * D.type("sceneTitle").lineHeight * 1.5);
		bandWidth += w;
	}
	const ringR = Math.max(R * .8, capacity / (2 * Math.PI) * 1.02);
	const core = el("div", "", cam);
	const cr = Math.min(W, H) * 0.034;
	set(core, { position: "absolute", left: px(W / 2 - cr), top: px(H / 2 - cr), width: px(2 * cr), height: px(2 * cr), borderRadius: "50%", background: accent, opacity: "0" });

	// Timing: the scene's moments, on the film's beats (scene-moments.cjs). The ball is dropped so that
	// it lands on its beat, and its two bounces end on the moments after it.
	const tFall = p.at.fall;
	const tBall = p.at.ball;
	const hits = p.at.hits;
	const g = 2 * (dotTarget.y + 2 * r) / (hits[0] - tBall) ** 2; // gravity so the drop lands on its moment
	const drop = dotTarget.y + 2 * r;
	const bounces = [
		[hits[0] - tBall, drop],
		[hits[1] - hits[0], drop * 0.16],
		[hits[2] - hits[1], drop * 0.04],
	];
	const ballY = (e) => {
		if (e < bounces[0][0]) return -2 * r + 0.5 * g * e * e;
		let t0 = bounces[0][0];
		for (let k = 1; k < bounces.length; k++) {
			const [len, h] = bounces[k];
			if (e < t0 + len) {
				const u = (e - t0) / len;
				return dotTarget.y - 4 * h * u * (1 - u);
			}
			t0 += len;
		}
		return dotTarget.y;
	};
	const impactAt = hits.map((hit) => hit - tBall);
	const tMove = p.at.move;
	const tRing = p.at.ring;
	// A scene too short for it has no shapes: it goes from the flood to the ring.
	const hasShapes = p.at.shapes !== undefined;
	const tShapes = p.at.shapes;
	const shapes = [
		{ r: 0.5, rot: 0, w: 1, h: 1 },
		{ r: 0.3, rot: 90, w: 1, h: 1 },
		{ r: 0.14, rot: 135, w: 0.9, h: 0.9 },
		{ r: 0.5, rot: 180, w: 1.9, h: 0.62 },
	];
	const marks = hasShapes ? [tShapes, ...p.at.morphs] : [];
	const cover = Math.hypot(W, H) / (2 * r) + 2;

	return (l) => {
		// 1. The lead word's letters tumble off, each a frame apart, accelerating.
		for (const gl of glyphs) {
			if (gl.isLead) {
				const e = l - tFall - gl.k * 0.035;
				const y = e > 0 ? 0.5 * 3200 * S * e * e : 0;
				const rot = e > 0 ? e * (180 + hash(gl.k * 3.1) * 260) * (hash(gl.k) > 0.5 ? 1 : -1) : 0;
				const x = e > 0 ? e * (hash(gl.k * 7.7) - 0.6) * 300 * S : 0;
				set(gl.n, { transform: `translate(${px(gl.from + x)}, ${px(y)}) rotate(${rot.toFixed(2)}deg)`, opacity: y > H ? "0" : "1" });
				continue;
			}
			let x = gl.to;
			let y = 0;
			let sc = 1;
			let op = 1;
			let blur = 0;
			if (lead) x = gl.from + (gl.to - gl.from) * E.softLand(prog(l, tFall + 0.18, 0.5));
			else {
				// No lead: the word arrives from oversize, landing decelerated.
				const k = E.snapSettle(prog(l, -0.05, 0.6));
				sc = 1 + (1 - k) * 0.9;
				blur = (1 - k) * 0.12;
				op = clamp((l + 0.05) / 0.08);
			}
			// 2. The word leaves upward, letter by letter, accelerating.
			const out = E.accelExit(prog(l, tMove + gl.k * 0.025, 0.3));
			y -= out * fs * 1.1;
			op *= 1 - clamp(out * 1.6 - 0.6);
			blur += out * 0.08;
			set(gl.n, { transform: `translate(${px(x)}, ${px(y)}) scale(${sc.toFixed(4)})`, transformOrigin: `${px(W / 2 - x)} 50%`, opacity: op.toFixed(3), filter: blur > 0.002 ? `blur(${(blur * fs).toFixed(2)}px)` : "none" });
		}
		// 3. The ball: drops, bounces into place, then rolls to the centre and floods the frame.
		const e = l - tBall;
		let bx = dotTarget.x + (1 - E.glide(clamp(e / 0.75))) * W * 0.12;
		let by = e < 0 ? -4 * r : ballY(e);
		let sx = 1;
		let sy = 1;
		for (const ia of impactAt) {
			const q = e - ia;
			if (q > -0.02 && q < 0.14) {
				const k = q < 0 ? 1 + q / 0.02 : Math.exp(-q * 30) * Math.cos(q * 40);
				sx += 0.3 * k;
				sy -= 0.28 * k;
			}
		}
		const mv = E.glide(prog(l, tMove, 0.38));
		bx += (W / 2 - bx) * mv;
		by += (H / 2 - by) * mv;
		const grow = E.whip(prog(l, p.at.grow, 0.5));
		const scale = 1 + (cover - 1) * grow;
		set(flood, { transform: `translate(${px(bx - r)}, ${px(by - r + (1 - sy) * r)}) scale(${(sx * scale).toFixed(4)}, ${(sy * scale).toFixed(4)})`, opacity: e < -0.02 ? "0" : "1" });

		// 4. A shape lands on the accent and morphs: circle, rounded square, diamond, pill.
		if (hasShapes) {
			const inK = E.snapSettle(prog(l, tShapes, 0.45));
			let cur = shapes[0];
			for (let k = 1; k < shapes.length; k++) {
				const m = E.softInOut(prog(l, marks[k], 0.34));
				if (m <= 0) break;
				const a = cur;
				const b = shapes[k];
				cur = { r: a.r + (b.r - a.r) * m, rot: a.rot + (b.rot - a.rot) * m, w: a.w + (b.w - a.w) * m, h: a.h + (b.h - a.h) * m };
			}
			// Then the pill fills the frame in ink (the next colour), ready for the ring.
			const fill = E.whip(prog(l, tRing - 0.45, 0.5));
			const big = Math.hypot(W, H) / sz + 0.5;
			const w = cur.w + (big - cur.w) * fill;
			const h = cur.h + (big - cur.h) * fill;
			const breathe = 1 + Math.sin(l * 3) * 0.015 * (1 - fill);
			set(shape, {
				opacity: l < tShapes ? "0" : "1",
				borderRadius: `${(cur.r * 100 * (1 - fill)).toFixed(2)}% / ${(cur.r * 100 * (1 - fill) * (cur.w / cur.h)).toFixed(2)}%`,
				width: px(sz * w),
				height: px(sz * h),
				left: px(W / 2 - (sz * w) / 2),
				top: px(H / 2 - (sz * h) / 2),
				transform: `rotate(${(cur.rot * (1 - fill)).toFixed(2)}deg) scale(${((1 + (1 - inK) * 0.7) * breathe).toFixed(4)})`,
			});
		}
		// 5. The ring of words orbits a small dot, in 3D (the back half seen mirrored, dimmer).
		const ringK = E.softLand(prog(l, tRing - (hasShapes ? 0.05 : 0.3), 0.6));
		// Hidden again before its moment: a frame is drawn for the time asked, whatever was drawn before it. Left as
		// it was, the ink plate of a later frame stayed over the word when an earlier frame was drawn after it, which
		// is what a render does (its workers take frames in no order).
		if (!hasShapes) set(shape, l > tRing - 0.5
			? { opacity: "1", borderRadius: "0", width: px(W * 1.2), height: px(H * 1.2), left: px(-W * 0.1), top: px(-H * 0.1), transform: `scale(${E.whip(prog(l, tRing - 0.5, 0.45)).toFixed(4)})` }
			: { opacity: "0" });
		set(ringBox, { opacity: ringK.toFixed(3), transform: `scale(${(1.6 - 0.6 * ringK).toFixed(4)})` });
		set(ringInner, { transform: `rotateX(-16deg) rotateZ(-6deg) rotateY(${(-l * 46).toFixed(2)}deg)` });
		for (let k = 0; k < ringNodes.length; k++) {
			const a = ringAng[k];
			const face = Math.cos(((a - l * 46) * Math.PI) / 180);
			set(ringNodes[k], { transform: `translate(-50%, -50%) translateY(${px(ringY[k])}) rotateY(${a.toFixed(2)}deg) translateZ(${px(ringR)})`, opacity: (0.42 + 0.58 * clamp(face * 0.5 + 0.5)).toFixed(3) });
		}
		const ck = E.snapSettle(prog(l, tRing, 0.4));
		set(core, { opacity: (l > tRing ? 1 : 0).toFixed(0), transform: `scale(${((1 + (1 - ck) * 2.2) * (1 + K.beatKick(l, 7) * 0.12)).toFixed(4)})` });
	};
};

