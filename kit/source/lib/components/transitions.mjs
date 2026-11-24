// Native-parent presentation: transition recipes over adjacent component surfaces.
// No ownership of component playback. Drawn from the original licensed recipes.
export function createTransitions({W,H,S,plan,stage,wipebar,dotsCanvas,helpers}) {
  const {clamp,lerp,expoOut,expoIn,expoInOut,smooth,cubicInOut,hash,mixHex,EASE}=helpers.maths;
  const {set,px}=helpers.dom;
	const applyTransition = (kind, a, b, p) => {
		const blurAmt = (v, node) => node.setAttribute("stdDeviation", `${v.toFixed(2)} 0`);
		if (kind === "whip") {
			const e = expoInOut(p);
			const bl = Math.sin(p * Math.PI) * 70 * S;
			set(a.root, { transform: `translateX(${px(-e * W)})`, filter: `url(#${a.blurId})` });
			set(b.root, { transform: `translateX(${px((1 - e) * W)})`, filter: `url(#${b.blurId})` });
			blurAmt(bl, a.blur);
			blurAmt(bl, b.blur);
		} else if (kind === "push") {
			const e = expoInOut(p);
			set(a.root, { transform: `translateY(${px(-e * H * 0.35)}) scale(${(1 - 0.08 * e).toFixed(4)})`, opacity: (1 - e * 0.5).toFixed(3) });
			set(b.root, { transform: `translateY(${px((1 - e) * H)})` });
		} else if (kind === "circle") {
			const e = expoInOut(p);
			const r = Math.hypot(W, H) * e * 0.6;
			const fc = a.focus ?? { x: W / 2, y: H / 2 };
			set(b.root, { clipPath: `circle(${px(r)} at ${px(fc.x)} ${px(fc.y)})` });
			set(a.root, { transform: `scale(${(1 + 0.08 * e).toFixed(4)})` });
		} else if (kind === "zoom") {
			const ei = expoIn(clamp(p * 1.25));
			const eo = expoOut(clamp((p - 0.35) / 0.65));
			set(a.root, { transform: `scale(${(1 + 3.2 * ei).toFixed(4)})`, opacity: (1 - smooth((p - 0.3) / 0.4)).toFixed(3) });
			set(b.root, { transform: `scale(${(0.55 + 0.45 * eo).toFixed(4)})`, opacity: smooth((p - 0.3) / 0.35).toFixed(3) });
		} else if (kind === "glide") {
			const e = cubicInOut(p);
			set(a.root, { transform: `translateX(${px(-e * W)})` });
			set(b.root, { transform: `translateX(${px((1 - e) * W)})` });
		} else if (kind === "scan") {
			const e = cubicInOut(p);
			const y = e * H;
			set(b.root, { clipPath: `inset(0 0 ${px(H - y)} 0)` });
			wipebar.style.visibility = "visible";
			const line = 5 * S;
			set(wipebar, { background: b.ps.accent, clipPath: `inset(${px(Math.max(0, y - line))} 0 ${px(Math.max(0, H - y - line))} 0)` });
		} else if (kind === "iris") {
			// A six-blade camera aperture opening on the next scene, turning as it opens, with an
			// accent ring riding the edge.
			const e = expoInOut(p);
			const R = Math.hypot(W, H) * 0.62 * e;
			const ring = 26 * S * Math.sin(p * Math.PI);
			const rot = (1 - e) * 70;
			const fc = a.focus ?? { x: W / 2, y: H / 2 };
			const hex = (r) =>
				Array.from({ length: 6 }, (_, i) => {
					const ang = ((rot + i * 60) * Math.PI) / 180;
					return `${px(fc.x + Math.cos(ang) * r)} ${px(fc.y + Math.sin(ang) * r)}`;
				}).join(", ");
			set(b.root, { clipPath: `polygon(${hex(R)})` });
			set(a.root, { transform: `scale(${(1 + 0.1 * e).toFixed(4)}) rotate(${(e * -4).toFixed(3)}deg)` });
			if (ring > 0.5) {
				wipebar.style.visibility = "visible";
				set(wipebar, { background: b.ps.accent, clipPath: `polygon(evenodd, ${hex(R + ring)}, ${hex(Math.max(0, R))})` });
			}
		} else if (kind === "flood") {
			// Colour floods up from the bottom with a sloshing wave edge; the next scene rides behind it.
			const e = cubicInOut(p);
			const band = H * 0.16;
			const lvl = lerp(H + band + 40 * S, -band - 40 * S, e);
			const amp = 38 * S * Math.sin(p * Math.PI);
			const wave = (y0) => {
				const pts = [];
				for (let i = 0; i <= 24; i++) {
					const x = (i / 24) * W;
					pts.push(`${px(x)} ${px(y0 + Math.sin(i * 0.7 + p * 9) * amp)}`);
				}
				return pts;
			};
			const front = wave(lvl);
			const back = wave(lvl + band);
			set(b.root, { clipPath: `polygon(${back.join(", ")}, ${px(W)} ${px(H)}, 0 ${px(H)})` });
			wipebar.style.visibility = "visible";
			set(wipebar, { background: b.ps.accent, clipPath: `polygon(${front.join(", ")}, ${back.slice().reverse().join(", ")})` });
			set(a.root, { transform: `translateY(${px(-e * H * 0.08)})` });
		} else if (kind === "halftone") {
			// The next scene arrives through print dots that grow until they merge; accent dots lead.
			const cell = 44 * S;
			const r = (k) => `radial-gradient(circle at center, #000 ${(clamp(k) * 72).toFixed(2)}%, transparent ${(clamp(k) * 72 + 1).toFixed(2)}%)`;
			const k = cubicInOut(p);
			const size = `${px(cell)} ${px(cell)}`;
			set(b.root, { maskImage: r(k), webkitMaskImage: r(k), maskSize: size, webkitMaskSize: size, maskPosition: "center", webkitMaskPosition: "center" });
			if (p < 0.9) {
				wipebar.style.visibility = "visible";
				// Accent rings around each growing dot, not solid dots on top of the next scene.
				const r0 = (clamp(k) * 72).toFixed(2);
				const r1 = (clamp(k + 0.16) * 72 + 1).toFixed(2);
				const lead = `radial-gradient(circle at center, transparent ${r0}%, #000 ${r0}%, #000 ${r1}%, transparent ${(+r1 + 1).toFixed(2)}%)`;
				set(wipebar, { background: b.ps.accent, clipPath: "none", maskImage: lead, webkitMaskImage: lead, maskSize: size, webkitMaskSize: size, maskPosition: "center", webkitMaskPosition: "center" });
			}
		} else if (kind === "glitch") {
			// Signal breakup: the next scene arrives in torn horizontal bands that jitter sideways,
			// the old one hue-shifts, RGB split spikes, accent bars flicker.
			const st = Math.floor(p * 14);
			const bands = 11;
			const rects = [];
			for (let j = 0; j < bands; j++) {
				const y0 = (j / bands) * H + (hash(j * 3.1 + st) - 0.5) * H * 0.04;
				const y1 = ((j + 1) / bands) * H + (hash(j * 5.7 + st) - 0.5) * H * 0.04;
				if (p > 0.82 || hash(j * 7.13 + st * 3.31) < p * 1.25) rects.push([Math.max(0, y0), Math.min(H, y1)]);
			}
			set(b.root, {
				clipPath: p > 0.88 ? "none" : rects.length ? `polygon(${rects.map(([y0, y1]) => `0 ${px(y0)}, ${px(W)} ${px(y0)}, ${px(W)} ${px(y1)}, 0 ${px(y1)}, 0 ${px(y0)}`).join(", ")})` : "polygon(0 0, 0 0, 0 0)",
				transform: `translateX(${px((hash(st * 1.7) - 0.5) * W * 0.07 * (1 - p))})`,
			});
			// No CSS filters here: a filter over a 3D camera (orbit, float) blanks the scene in Chromium.
			set(a.root, { transform: `translateX(${px((hash(st * 2.3 + 0.4) - 0.5) * W * 0.05)})` });
			set(stage, { background: plan.palette.ink });
			const ab = (18 * Math.sin(p * Math.PI) + 2) * S;
			a.root.style.setProperty("--pk-transition-ab", ab.toFixed(2));
			b.root.style.setProperty("--pk-transition-ab", ab.toFixed(2));
			if (p < 0.9) {
				wipebar.style.visibility = "visible";
				const bars = [0, 1, 2].map((k) => {
					const y = hash(st * 4.7 + k * 1.3) * H;
					const h = (4 + hash(st + k * 9.1) * 22) * S;
					return `0 ${px(y)}, ${px(W)} ${px(y)}, ${px(W)} ${px(y + h)}, 0 ${px(y + h)}, 0 ${px(y)}`;
				});
				set(wipebar, { background: b.ps.accent, clipPath: `polygon(${bars.join(", ")})` });
			}
		} else if (kind === "shutter") {
			// Slats open one after another from their centres; an accent edge leads each one.
			const n = H > W ? 6 : 8;
			const vertical = W >= H;
			const len = vertical ? W : H;
			const sw = len / n;
			const lag = 0.05;
			const slats = (lead) =>
				Array.from({ length: n }, (_, j) => {
					const k = expoInOut(clamp((p + lead - j * lag) / (1 - (n - 1) * lag)));
					const w = k * sw;
					const a0 = j * sw + (sw - w) / 2;
					const a1 = a0 + w;
					return vertical
						? `${px(a0)} 0, ${px(a1)} 0, ${px(a1)} ${px(H)}, ${px(a0)} ${px(H)}, ${px(a0)} 0`
						: `0 ${px(a0)}, 0 ${px(a1)}, ${px(W)} ${px(a1)}, ${px(W)} ${px(a0)}, 0 ${px(a0)}`;
				});
			set(b.root, { clipPath: p >= 1 ? "none" : `polygon(${slats(0).join(", ")})` });
			set(a.root, { transform: `scale(${(1 + 0.05 * cubicInOut(p)).toFixed(4)})` });
			if (p < 0.97) {
				wipebar.style.visibility = "visible";
				set(wipebar, { background: b.ps.accent, clipPath: `polygon(evenodd, ${slats(0.07).join(", ")}, ${slats(0).join(", ")})` });
			}
		} else if (kind === "dots") {
			// The old shot dissolves into a sweeping field of dots that clears onto the new one: a
			// band of particles rides the seam, biggest at the front, scattering as they thin out.
			const e = cubicInOut(p);
			const band = W * 0.34;
			const fx = lerp(-band * 0.6, W + band * 0.6, e);
			set(b.root, { clipPath: `inset(0 ${px(Math.max(0, W - fx))} 0 0)` });
			set(a.root, { transform: `translateX(${px(-e * W * 0.04)})` });
			const g = dotsCanvas.getContext("2d");
			g.clearRect(0, 0, W, H);
			dotsCanvas.style.visibility = "visible";
			const step = 26 * S;
			const cols = Math.ceil(W / step) + 1;
			const rows = Math.ceil(H / step) + 1;
			const c1 = b.ps.accent;
			const c2 = mixHex(b.ps.accent, "#ffffff", 0.45);
			for (let j = 0; j < rows; j++) {
				for (let i = 0; i < cols; i++) {
					const n = hash(i * 13.7 + j * 71.3);
					const x0 = i * step + (j % 2 ? step / 2 : 0);
					const d = x0 - fx + (n - 0.5) * band * 0.5;
					const f = 1 - Math.abs(d) / band;
					if (f <= 0) continue;
					// Particles ahead of the front drift with it; those behind fall away.
					const x = x0 + (d < 0 ? d * 0.25 : -d * 0.15) * (1 - f);
					const y = j * step + (hash(i * 3.1 + j * 5.3) - 0.5) * step * 1.4 * (1 - f);
					const r = step * 0.42 * f ** 0.8 * (0.6 + 0.4 * n);
					g.globalAlpha = Math.min(1, f * 1.6);
					g.fillStyle = n > 0.7 ? c2 : c1;
					g.beginPath();
					g.arc(x, y, r, 0, Math.PI * 2);
					g.fill();
				}
			}
			g.globalAlpha = 1;
		} else if (kind === "open") {
			// The next shot opens out of the old one like an app from its icon: it starts as a small
			// rounded card in the middle and grows to the frame while the old shot pushes in behind it,
			// so the cut reads as one move, not two slides.
			const e = EASE.softInOut(p);
			const sc = 0.34 + 0.66 * e;
			const r = (1 - e) * 64 * S;
			set(a.root, { transform: `scale(${(1 + 0.55 * EASE.gentleIn(p)).toFixed(4)})`, opacity: (1 - clamp((p - 0.75) / 0.25)).toFixed(3) });
			set(b.root, { transform: `scale(${sc.toFixed(4)})`, clipPath: p >= 1 ? "none" : `inset(0 round ${px(r / sc)})` });
			set(stage, { background: plan.palette.ink });
		} else if (kind === "pixels") {
			// Pixel-block dissolve: the frame breaks into square blocks that switch to the next shot
			// in a sweep with scatter; the blocks on the edge of the sweep flash the accent first.
			const cols = W >= H ? 18 : 10;
			const cell = W / cols;
			const rows = Math.ceil(H / cell);
			const e = cubicInOut(p);
			const on = [];
			const g = dotsCanvas.getContext("2d");
			g.clearRect(0, 0, W, H);
			dotsCanvas.style.visibility = "visible";
			const c1 = b.ps.accent;
			const c2 = mixHex(b.ps.accent, "#ffffff", 0.55);
			for (let j = 0; j < rows; j++)
				for (let i = 0; i < cols; i++) {
					// Each block's switch time: a diagonal sweep plus a lot of scatter.
					const th = 0.08 + ((i / cols) * 0.55 + (j / rows) * 0.2) * 0.75 + hash(i * 17.3 + j * 31.7) * 0.3;
					const x0 = i * cell;
					const y0 = j * cell;
					// Each block is visited from one anchor and back along the same line, so the joins
					// have no area and the union is exact.
					if (e >= th) on.push(`0 0, ${px(x0)} ${px(y0)}, ${px(x0 + cell + 0.5)} ${px(y0)}, ${px(x0 + cell + 0.5)} ${px(y0 + cell + 0.5)}, ${px(x0)} ${px(y0 + cell + 0.5)}, ${px(x0)} ${px(y0)}, 0 0`);
					const d = th - e;
					if (d > -0.04 && d < 0.1) {
						const k = 1 - Math.abs(d - 0.03) / 0.07;
						if (k <= 0) continue;
						g.globalAlpha = Math.min(1, k * 1.4);
						g.fillStyle = hash(i * 3.3 + j * 7.1) > 0.7 ? c2 : c1;
						const inset = cell * 0.5 * (1 - Math.min(1, k * 1.2));
						g.fillRect(x0 + inset, y0 + inset, cell - inset * 2, cell - inset * 2);
					}
				}
			g.globalAlpha = 1;
			set(b.root, { clipPath: p >= 1 ? "none" : on.length ? `polygon(${on.join(", ")})` : "polygon(0 0, 0 0, 0 0)" });
			set(a.root, { transform: `scale(${(1 + 0.04 * e).toFixed(4)})` });
		} else if (kind === "flip") {
			// A card flip in 3D: the old scene turns away on its vertical axis, the new one turns in.
			const e = cubicInOut(p);
			const ang = e * 180;
			const dip = 1 - 0.14 * Math.sin(p * Math.PI);
			const persp = `perspective(${px(2400 * S)})`;
			set(stage, { background: plan.palette.ink });
			if (ang < 90) {
				set(a.root, { transform: `${persp} rotateY(${(-ang).toFixed(3)}deg) scale(${dip.toFixed(4)})` });
				set(b.root, { opacity: "0" });
			} else {
				set(b.root, { transform: `${persp} rotateY(${(180 - ang).toFixed(3)}deg) scale(${dip.toFixed(4)})` });
				set(a.root, { opacity: "0" });
			}
		} else if (kind === "flash") {
			// Lens flash: the old scene pushes in and blows out to white, the new one comes back out of it.
			const up = expoIn(clamp(p / 0.5));
			const down = expoOut(clamp((p - 0.5) / 0.5));
			// The blow-out is a white overlay, not a brightness filter (filters blank 3D cameras).
			set(a.root, { transform: `scale(${(1 + 0.07 * up).toFixed(4)})` });
			if (p < 0.5) set(b.root, { opacity: "0" });
			else set(b.root, { transform: `scale(${(1.07 - 0.07 * down).toFixed(4)})` });
			const fc = a.focus ?? { x: W / 2, y: H / 2 };
			wipebar.style.visibility = "visible";
			set(wipebar, {
				clipPath: "none",
				opacity: (p < 0.5 ? up : 1 - down).toFixed(3),
				background: `radial-gradient(ellipse 90% 80% at ${px(fc.x)} ${px(fc.y)}, #ffffff 0%, #fffaf0 45%, ${mixHex("#fff4e0", b.ps.accent, 0.35)} 100%)`,
			});
		} else if (kind === "wipe") {
			const e = cubicInOut(p);
			const k = H * 0.35;
			const x = lerp(-k, W + k, e);
			const band = 90 * S;
			set(b.root, { clipPath: `polygon(0 0, ${px(x - band + k)} 0, ${px(x - band - k)} ${px(H)}, 0 ${px(H)})` });
			wipebar.style.visibility = "visible";
			set(wipebar, {
				background: b.ps.accent,
				clipPath: `polygon(${px(x - band + k)} 0, ${px(x + k)} 0, ${px(x - k)} ${px(H)}, ${px(x - band - k)} ${px(H)})`,
			});
		}
	};

  return {applyTransition};
}
