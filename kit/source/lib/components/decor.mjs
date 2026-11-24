// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {truncateLine} from './design-system.mjs';
export function createDecor({ maths, dom, moves, layers }) {
const { clamp, expoOut, hash, lum, alpha } = maths;
	const { el, set, px, plain } = dom;
	const { pulse, blink } = moves;

	/**
	 * The decoration of a film. `film` is { W, H, S, plan, stage, M }: its size and scale, its plan
	 * (the look of the scene being built, the palette, the beat), the stage element the overlays
	 * are added to, and its feel. Returns decorate(root, ps) -> draw(l), letterboxBar() and
	 * buildOverlays() -> the overlays as functions (t, ps) to call at every frame.
	 */
	const of = (film) => {
		const { W, H, S, plan, stage } = film;
		const beatKick = (t, k = 8) => moves.beatKick(t, k, plan.beat);
		const { particleField, gridFloor, axesPlane, popShapes } = layers.of(film);

		/** Style decorations behind a scene's content. Returns a draw(l) for any that move. */
		const decorate = (root, ps) => {
			const look = plan.look ?? {};
			// A plain scene keeps the style's colours and type but none of its decoration.
			const deco = ps.scene.plain ? {} : (look.deco ?? {});
			const bgHex = ps.bg === "sky" ? plan.palette.sky : ps.bg;
			const dark = lum(bgHex) < 0.18;
			const draws = [];
			if (deco.grid) {
				// Drafting grid: 60 px cells, every fifth line stronger. Ink depends on the paper.
				const g = el("div", "deco", root);
				const blue = lum(bgHex) < 0.3 && !dark;
				const ink = dark ? plan.palette.lime : blue ? "#ffffff" : plan.palette.electric;
				const cell = 60 * S;
				set(g, {
					backgroundImage: [
						`linear-gradient(${alpha(ink, 0.26)} 1px, transparent 1px)`,
						`linear-gradient(90deg, ${alpha(ink, 0.26)} 1px, transparent 1px)`,
						`linear-gradient(${alpha(ink, 0.12)} 1px, transparent 1px)`,
						`linear-gradient(90deg, ${alpha(ink, 0.12)} 1px, transparent 1px)`,
					].join(","),
					backgroundSize: `${px(cell * 5)} ${px(cell * 5)}, ${px(cell * 5)} ${px(cell * 5)}, ${px(cell)} ${px(cell)}, ${px(cell)} ${px(cell)}`,
					backgroundPosition: "center center",
				});
			}
			if (deco.glow && dark) {
				// Luminous light behind dark scenes: soft blobs in the style's accents, drifting.
				const cols = [plan.palette.electric, plan.palette.lilac, plan.palette.coral];
				const blobs = cols.map((c, i) => {
					const b = el("div", "deco", root);
					const r = (0.55 + hash(i + ps.index * 3) * 0.35) * Math.max(W, H);
					set(b, { inset: "auto", width: px(r), height: px(r), borderRadius: "50%", background: `radial-gradient(circle, ${alpha(c, 0.5)} 0%, ${alpha(c, 0)} 65%)` });
					return { b, r, x: hash(i * 7.3 + ps.index) * W, y: hash(i * 3.9 + ps.index * 2) * H, sp: (hash(i * 2.2) - 0.5) * 120 * S };
				});
				draws.push((l) => {
					for (const k of blobs) set(k.b, { left: px(k.x - k.r / 2 + l * k.sp), top: px(k.y - k.r / 2 - l * k.sp * 0.5) });
				});
			}
			const typeLed = ["title", "fullbleed", "endcard", "logo3d", "icon3d", "slam", "counter", "swap", "highlight"].includes(ps.scene.type);
			if (deco.sunburst && typeLed) {
				// Op-art sunburst turning continuously behind type-led scenes.
				const sb = el("div", "deco", root);
				const ray = lum(bgHex) < 0.4 ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)";
				const d = Math.hypot(W, H) * 1.1;
				set(sb, { inset: "auto", left: px(W / 2 - d / 2), top: px(H / 2 - d / 2), width: px(d), height: px(d), borderRadius: "50%", background: `repeating-conic-gradient(${ray} 0deg 6deg, transparent 6deg 15deg)` });
				draws.push((l) => set(sb, { transform: `rotate(${(l * 9 + ps.index * 17).toFixed(3)}deg)` }));
			}
			if (deco.mesh) {
				// Mesh-gradient light: four big soft blobs in the style's colours, orbiting slowly.
				const cols = [plan.palette.electric, plan.palette.coral, plan.palette.lilac, plan.palette.lime];
				const blobs = cols.map((c, i) => {
					const b = el("div", "deco", root);
					const r = (0.7 + hash(i * 1.7 + ps.index) * 0.4) * Math.max(W, H);
					set(b, { inset: "auto", width: px(r), height: px(r), borderRadius: "50%", background: `radial-gradient(circle, ${alpha(c, dark ? 0.55 : 0.42)} 0%, ${alpha(c, 0)} 62%)` });
					return { b, r, a: hash(i * 5.1 + ps.index * 1.3) * Math.PI * 2, rad: (0.18 + hash(i * 9.2) * 0.2) * W };
				});
				draws.push((l) => {
					for (const [i, k] of blobs.entries()) {
						const a = k.a + l * (0.35 + i * 0.08) * (i % 2 ? -1 : 1);
						set(k.b, { left: px(W / 2 + Math.cos(a) * k.rad - k.r / 2), top: px(H / 2 + Math.sin(a) * k.rad * 0.7 - k.r / 2) });
					}
				});
			}
			if (deco.spotlight) {
				// Premium dark: one soft overhead light, a faint floor glow and a dotted grid fading
				// out from the centre, so dark scenes have depth instead of flat black.
				const beam = el("div", "deco", root);
				set(beam, { background: `radial-gradient(ellipse 55% 60% at 50% -8%, ${alpha("#ffffff", 0.13)} 0%, ${alpha(plan.palette.electric, 0.08)} 38%, transparent 70%)` });
				const floor = el("div", "deco", root);
				set(floor, { background: `radial-gradient(ellipse 60% 35% at 50% 108%, ${alpha(plan.palette.lilac, 0.16)} 0%, transparent 70%)` });
				const dots = el("div", "deco", root);
				set(dots, { backgroundImage: `radial-gradient(circle, ${alpha("#ffffff", 0.09)} 1px, transparent 1.5px)`, backgroundSize: `${px(34 * S)} ${px(34 * S)}`, maskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, #000 0%, transparent 75%)", webkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, #000 0%, transparent 75%)" });
				draws.push((l) => {
					set(beam, { opacity: (0.85 + 0.15 * Math.sin(l * 1.3 + ps.index)).toFixed(3) });
					set(dots, { backgroundPosition: `${px(l * 6 * S)} ${px(l * -4 * S)}` });
				});
			}
			if (deco.aurora) {
				// Premium light: two big soft lights in the accent colours, drifting slowly.
				const cols = [plan.palette.electric, plan.palette.lilac];
				const blobs = cols.map((c, i) => {
					const b = el("div", "deco", root);
					const r = (0.75 + hash(i * 3.1 + ps.index) * 0.3) * Math.max(W, H);
					set(b, { inset: "auto", width: px(r), height: px(r), borderRadius: "50%", background: `radial-gradient(circle, ${alpha(c, 0.32)} 0%, ${alpha(c, 0)} 62%)` });
					const side = (i + ps.index) % 2 ? 1 : -1;
					return { b, r, x: W / 2 + side * W * 0.42, y: H * (i ? 0.85 : 0.1) };
				});
				draws.push((l) => {
					for (const [i, k] of blobs.entries()) set(k.b, { left: px(k.x - k.r / 2 + Math.sin(l * 0.5 + i) * 60 * S), top: px(k.y - k.r / 2 + Math.cos(l * 0.4 + i) * 40 * S) });
				});
			}
			if (deco.halftone) {
				// Print dots, biggest in one corner and fading out across the frame.
				const h = el("div", "deco", root);
				const ink = lum(bgHex) < 0.35 ? "rgba(255,255,255,0.22)" : alpha(plan.palette.ink, 0.16);
				const cell = 26 * S;
				const corner = ["135deg", "315deg", "45deg", "225deg"][ps.index % 4];
				set(h, {
					backgroundImage: `radial-gradient(circle, ${ink} 34%, transparent 36%)`,
					backgroundSize: `${px(cell)} ${px(cell)}`,
					maskImage: `linear-gradient(${corner}, transparent 35%, #000 100%)`,
					webkitMaskImage: `linear-gradient(${corner}, transparent 35%, #000 100%)`,
				});
				draws.push((l) => set(h, { backgroundPosition: `${px(l * 14 * S)} ${px(l * 9 * S)}` }));
			}
			if (deco.scanlines) {
				const sl = el("div", "deco", root);
				set(sl, {
					zIndex: "800",
					backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 ${px(2 * S)}, transparent ${px(2 * S)} ${px(5 * S)}), radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)`,
				});
				const bar = el("div", "deco", root);
				set(bar, { zIndex: "801", inset: "auto", left: "0", width: px(W), height: px(H * 0.18), background: `linear-gradient(transparent, ${alpha(plan.palette.lime, 0.05)}, transparent)` });
				draws.push((l) => {
					set(bar, { top: px(((l * 0.35 + ps.index * 0.3) % 1.2) * H * 1.1 - H * 0.2) });
					set(sl, { opacity: (0.85 + 0.15 * Math.sin(l * 40)).toFixed(3) });
				});
			}
			if (deco.numeral && ps.scene.type !== "fullbleed") {
				const n = el("div", "deco", root, String(ps.index + 1).padStart(2, "0"));
				const ink = lum(bgHex) < 0.4 ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)";
				set(n, { inset: "auto", left: px(-0.04 * H), bottom: px(-0.12 * H), fontFamily: '"Archivo", sans-serif', fontWeight: "900", fontSize: px(H * 0.62), lineHeight: "1", letterSpacing: "-0.06em", color: ink, fontVariationSettings: '"wdth" 90' });
				draws.push((l) => set(n, { transform: `translateY(${px((1 - expoOut(clamp(l / 0.7))) * H * 0.25)})` }));
			}
			if (deco.floor) draws.push(gridFloor(root, ps));
			if (deco.axes) draws.push(axesPlane(root, ps, bgHex));
			if (deco.shapes) draws.push(popShapes(root, ps, bgHex));
			if (deco.leak) {
				// Light leaks: two warm, blown-out blobs sweeping across the frame, breathing.
				const cols = [plan.palette.lime, plan.palette.coral];
				const leaks = cols.map((c, i) => {
					const b = el("div", "deco", root);
					const r = (0.8 + hash(i * 4.3 + ps.index) * 0.5) * Math.max(W, H);
					set(b, { inset: "auto", width: px(r), height: px(r * 0.7), borderRadius: "50%", mixBlendMode: "screen", background: `radial-gradient(ellipse, ${alpha(c, 0.55)} 0%, ${alpha(c, 0.18)} 35%, ${alpha(c, 0)} 68%)` });
					return { b, r, y: (i ? 0.9 : 0.05) * H, dir: (ps.index + i) % 2 ? 1 : -1, ph: hash(i + ps.index * 2.7) * 6 };
				});
				draws.push((l) => {
					for (const k of leaks) {
						const x = W / 2 + k.dir * (-0.75 + ((l * 0.11 + k.ph * 0.1) % 1.5)) * W;
						set(k.b, { left: px(x - k.r / 2), top: px(k.y - k.r * 0.35), opacity: (0.55 + 0.45 * Math.sin(l * 1.7 + k.ph)).toFixed(3) });
					}
				});
			}
			if (deco.sheen) {
				// A soft, wide light drifting slowly across flat paper, the way a lit set breathes, so a
				// plain background is never a frozen frame.
				const sh = el("div", "deco", root);
				const r = Math.max(W, H) * 1.3;
				const glow = dark ? "rgba(255,255,255,0.08)" : lum(bgHex) > 0.7 ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.32)";
				const shade = dark ? "rgba(0,0,0,0)" : alpha(plan.palette.ink, lum(bgHex) > 0.7 ? 0.11 : 0.12);
				set(sh, { inset: "auto", width: px(r), height: px(r), borderRadius: "50%", background: `radial-gradient(circle, ${glow} 0%, transparent 55%)` });
				const sd = el("div", "deco", root);
				set(sd, { inset: "auto", width: px(r), height: px(r), borderRadius: "50%", background: `radial-gradient(circle, ${shade} 0%, transparent 60%)` });
				const ph = hash(ps.index * 3.7) * 6.28;
				draws.push((l) => {
					const t = ps.start + l;
					set(sh, { left: px(W * (0.5 + 0.42 * Math.sin(t * 0.55 + ph)) - r / 2), top: px(H * (0.35 + 0.3 * Math.cos(t * 0.47 + ph)) - r / 2) });
					set(sd, { left: px(W * (0.5 - 0.45 * Math.sin(t * 0.5 + ph)) - r / 2), top: px(H * (0.7 - 0.3 * Math.cos(t * 0.53 + ph)) - r / 2) });
				});
			}
			if (deco.crosshair) {
				// Artboard crosshairs at the corners of a frame round the middle, with a hairline between.
				const ink = dark ? "rgba(255,255,255,0.85)" : lum(bgHex) < 0.5 ? "#ffffff" : alpha(plan.palette.ink, 0.5);
				const fx = W * (W > H ? 0.3 : 0.38);
				const fy = H * (W > H ? 0.32 : 0.26);
				const a = 16 * S;
				const th = 2 * S;
				const marks = [-1, 1].flatMap((sx) =>
					[-1, 1].map((sy) => {
						const m = el("div", "deco", root);
						set(m, { inset: "auto", left: px(W / 2 + sx * fx - a), top: px(H / 2 + sy * fy - a), width: px(a * 2), height: px(a * 2), background: `linear-gradient(${ink},${ink}) center/100% ${px(th)} no-repeat, linear-gradient(${ink},${ink}) center/${px(th)} 100% no-repeat` });
						return m;
					}),
				);
				const frame = el("div", "deco", root);
				set(frame, { inset: "auto", left: px(W / 2 - fx), top: px(H / 2 - fy), width: px(fx * 2), height: px(fy * 2), boxSizing: "border-box", border: `${px(1.2 * S)} solid ${dark ? "rgba(255,255,255,0.1)" : alpha(plan.palette.ink, 0.07)}` });
				draws.push((l) => {
					const k = expoOut(clamp(l / 0.7));
					marks.forEach((m, i) => set(m, { opacity: k.toFixed(3), transform: `rotate(${((1 - k) * (i % 2 ? 90 : -90)).toFixed(2)}deg) scale(${(0.4 + 0.6 * k).toFixed(3)})` }));
					set(frame, { opacity: expoOut(clamp((l - 0.2) / 0.8)).toFixed(3) });
				});
			}
			if (deco.rays && (typeLed || ps.scene.type === "endcard" || ps.scene.type === "tiles")) {
				// Saturated rays bursting from the centre, white-hot in the middle, turning slowly.
				const pal = plan.palette;
				const cols = [pal.electric, pal.peach, pal.lilac, pal.coral, pal.sky, pal.butter].filter(Boolean);
				const stops = [];
				const n = 14;
				for (let i = 0; i < n; i++) {
					const a0 = (i * 360) / n;
					const w = 360 / n;
					const c = cols[i % cols.length];
					stops.push(`${c} ${a0.toFixed(2)}deg ${(a0 + w * 0.55).toFixed(2)}deg`, `transparent ${(a0 + w * 0.55).toFixed(2)}deg ${(a0 + w).toFixed(2)}deg`);
				}
				const d = Math.hypot(W, H) * 1.2;
				const r = el("div", "deco", root);
				const mask = "radial-gradient(circle, transparent 9%, rgba(0,0,0,0.35) 18%, #000 42%)";
				set(r, { inset: "auto", left: px(W / 2 - d / 2), top: px(H / 2 - d / 2), width: px(d), height: px(d), borderRadius: "50%", background: `conic-gradient(${stops.join(",")})`, maskImage: mask, webkitMaskImage: mask });
				const glow = el("div", "deco", root);
				set(glow, { background: `radial-gradient(circle at 50% 50%, ${dark ? alpha(pal.butter, 0.5) : "rgba(255,255,255,0.95)"} 0%, transparent 30%)` });
				draws.push((l) => {
					const k = expoOut(clamp(l / 0.6));
					set(r, { opacity: (0.92 * k).toFixed(3), transform: `rotate(${(l * 7 + ps.index * 11).toFixed(3)}deg) scale(${(0.6 + 0.4 * k + 0.03 * beatKick(ps.start + l)).toFixed(4)})` });
				});
			}
			if (deco.particles) draws.push(particleField(root, ps, deco.particles, bgHex, typeLed || ps.scene.type === "endcard"));
			if (deco.flare) {
				// Anamorphic flare: a hairline streak of light across the frame with a soft bloom round its
				// hot spot. It flashes as the scene opens, then idles and drifts.
				const y = H * (0.3 + hash(ps.index * 5.3 + 1) * 0.4);
				const hue = ps.index % 3 === 2 ? plan.palette.peach : plan.palette.lime;
				const streak = el("div", "deco", root);
				set(streak, { inset: "auto", left: px(-W * 0.2), width: px(W * 1.4), top: px(y - 1.5 * S), height: px(3 * S), mixBlendMode: "screen", background: `linear-gradient(90deg, transparent 0%, ${alpha(hue, 0.0)} 8%, ${alpha(hue, 0.55)} 38%, rgba(255,255,255,0.95) 50%, ${alpha(hue, 0.55)} 62%, ${alpha(hue, 0)} 92%, transparent 100%)`, zIndex: "790" });
				const halo = el("div", "deco", root);
				const hr = H * 0.34;
				set(halo, { inset: "auto", width: px(hr * 2.6), height: px(hr * 0.5), top: px(y - hr * 0.25), borderRadius: "50%", mixBlendMode: "screen", background: `radial-gradient(ellipse, ${alpha("#ffffff", 0.35)} 0%, ${alpha(hue, 0.22)} 30%, transparent 70%)`, zIndex: "790" });
				const dir = ps.index % 2 ? 1 : -1;
				draws.push((l) => {
					const pop = Math.exp(-Math.max(0, l - 0.05) * 2.4);
					const k = clamp(0.28 + 0.72 * pop + 0.08 * Math.sin(l * 1.9 + ps.index));
					const cx = W * (0.5 + dir * (0.22 - l * 0.045));
					set(streak, { opacity: k.toFixed(3), transform: `translateX(${px(cx - W / 2)}) scaleY(${(0.7 + 0.6 * pop).toFixed(3)})` });
					set(halo, { opacity: (k * 0.9).toFixed(3), left: px(cx - hr * 1.3) });
				});
			}
			if (deco.hud) {
				// Heads-up display: corner brackets inside the scope bars, a faint reticle that turns,
				// and small live readouts in the corners. Mono, thin, never louder than the type.
				const ink = dark ? plan.palette.lime : alpha(plan.palette.ink, 0.7);
				const bar = deco.letterbox ? letterboxBar() : 0;
				if (dark) {
					// Moody atmosphere: cold haze and a warm one drifting through the dark, and a dim
					// horizon glow low in the frame, so black never reads as empty.
					const fogs = [[plan.palette.electric, 0.13, 0.25, 0.3], [plan.palette.lime, 0.09, 0.75, 0.62], [plan.palette.peach, 0.06, 0.4, 0.85]].map(([c, a, fx, fy], i) => {
						const f = el("div", "deco", root);
						const r = Math.max(W, H) * (0.9 + i * 0.2);
						set(f, { inset: "auto", width: px(r), height: px(r * 0.55), borderRadius: "50%", background: `radial-gradient(ellipse, ${alpha(c, a)} 0%, ${alpha(c, a * 0.4)} 35%, transparent 70%)` });
						return { f, r, fx, fy, ph: hash(i * 7.7 + ps.index) * 6.28 };
					});
					const horizon = el("div", "deco", root);
					set(horizon, { background: `radial-gradient(ellipse 80% 22% at 50% 100%, ${alpha(plan.palette.lime, 0.12)} 0%, transparent 70%)` });
					draws.push((l) => {
						const t = ps.start + l;
						for (const k of fogs) set(k.f, { left: px(W * k.fx + Math.sin(t * 0.13 + k.ph) * W * 0.12 - k.r / 2), top: px(H * k.fy + Math.cos(t * 0.11 + k.ph) * H * 0.06 - k.r * 0.275) });
					});
				}
				const mx = 44 * S;
				const my = bar + 30 * S;
				const arm = 34 * S;
				const th = 1.6 * S;
				const brackets = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([sx, sy]) => {
					const b = el("div", "deco", root);
					set(b, { inset: "auto", width: px(arm), height: px(arm), left: px(sx ? W - mx - arm : mx), top: px(sy ? H - my - arm : my), boxSizing: "border-box", [sx ? "borderRight" : "borderLeft"]: `${px(th)} solid ${alpha(ink, 0.7)}`, [sy ? "borderBottom" : "borderTop"]: `${px(th)} solid ${alpha(ink, 0.7)}` });
					return b;
				});
				const mono = { fontFamily: '"Geist Mono", ui-monospace, monospace', fontSize: px(15 * S), letterSpacing: "0.14em", color: alpha(ink, 0.72), whiteSpace: "nowrap", lineHeight: "1.5" };
				const read = (pos) => {
					const n = el("div", "deco", root);
					set(n, { inset: "auto", ...mono, ...(pos.includes("t") ? { top: px(my + arm + 8 * S) } : { bottom: px(my + arm + 8 * S) }), ...(pos.includes("l") ? { left: px(mx) } : { right: px(mx), textAlign: "right" }) });
					return n;
				};
				const tl = read("tl");
				const tr = read("tr");
				const bl = read("bl");
				const br = read("br");
				const two = (x) => String(Math.floor(x)).padStart(2, "0");
				const name = (plan.brand?.name ?? "").toUpperCase();
				set(br,{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:px(12*S),width:px(W/2-mx-32*S)});
				const brandLabel=el("span","",br,name),sequenceLabel=el("span","",br);
				set(brandLabel,{display:"block",minWidth:"0"});truncateLine(brandLabel);brandLabel.title=name;
				brandLabel.dataset.ellipsisField="hud.brand";
				set(sequenceLabel,{flex:"none"});
				const ret = el("div", "deco", root);
				const rr = Math.min(W, H) * 0.36;
				set(ret, { inset: "auto", left: px(W / 2 - rr), top: px(H / 2 - rr), width: px(rr * 2), height: px(rr * 2), borderRadius: "50%", boxSizing: "border-box", border: `${px(1 * S)} dashed ${alpha(ink, 0.13)}`, background: `repeating-conic-gradient(${alpha(ink, 0.22)} 0deg 0.6deg, transparent 0.6deg 15deg)`, maskImage: "radial-gradient(circle, transparent 94%, #000 94.5%, #000 100%)", webkitMaskImage: "radial-gradient(circle, transparent 94%, #000 94.5%, #000 100%)" });
				const lat = 34 + hash(ps.index * 2.1) * 20;
				const lon = 110 + hash(ps.index * 3.3) * 40;
				draws.push((l) => {
					const t = ps.start + l;
					const k = expoOut(clamp(l / 0.6));
					brackets.forEach((b, i) => set(b, { opacity: k.toFixed(3), transform: `translate(${px((1 - k) * (i % 2 ? 16 : -16) * S)}, ${px((1 - k) * (i < 2 ? -16 : 16) * S)})` }));
					const blink = Math.floor(t * 2) % 2 ? "●" : "○";
					tl.textContent = `${blink} REC   T+00:${two(t / 60)}:${two(t % 60)}:${two((t * 24) % 24)}`;
					tr.textContent = `${lat.toFixed(4)}° N   ${(lon + l * 0.013).toFixed(4)}° W`;
					bl.textContent = `SIGNAL ${(92 + 6 * Math.sin(t * 3.1)).toFixed(1)}%`;
					sequenceLabel.textContent = `SEQ ${two(ps.index + 1)}/${two(plan.scenes.length)}`;
					for (const n of [tl, tr, bl, br]) set(n, { opacity: (k * (0.85 + 0.15 * Math.sin(t * 7 + ps.index))).toFixed(3) });
					set(ret, { opacity: (0.9 * k).toFixed(3), transform: `rotate(${(t * 6).toFixed(3)}deg) scale(${(1.08 - 0.08 * k).toFixed(4)})` });
				});
			}
			const vig = look.post?.vignette;
			if (vig) {
				const v = el("div", "deco", root);
				set(v, { zIndex: "799", background: `radial-gradient(ellipse 75% 70% at 50% 50%, transparent 45%, rgba(0,0,0,${(vig * (dark ? 0.85 : 0.35)).toFixed(3)}) 100%)` });
			}
			return (l) => {
				for (const d of draws) d(l);
			};
		};

		/** Cinema bar height: 2:1 scope on landscape, thin bars on square and vertical. */
		const letterboxBar = () => (W / H > 1.3 ? (H - W / 2) / 2 : H * 0.05);

		/** Overlays on every scene: figure labels and a beat counter, poster crumbs, beat ticks. */
		let overlays = [];
		const buildOverlays = () => {
			overlays = [];
			const deco = plan.look?.deco ?? {};
			const label = (pos) => {
				const n = el("div", "overlay-label", stage);
				const m = 54 * S;
				set(n, { fontSize: px(19 * S), ...(pos.includes("t") ? { top: px(m * 0.8) } : { bottom: px(m * 0.8) }), ...(pos.includes("l") ? { left: px(m) } : { right: px(m) }) });
				return n;
			};
			const total = Math.round(plan.duration / plan.beat);
			const two = (x) => String(x).padStart(2, "0");
			if (deco.corners) {
				const tl = label("tl");
				const br = label("br");
				overlays.push((t, ps) => {
					tl.textContent = `FIG. ${two(ps.index + 1)} — ${ps.scene.type.replace("-", " ")}`;
					br.textContent = `BEAT ${two(Math.min(total, Math.floor(t / plan.beat) + 1))} / ${total}`;
					for (const n of [tl, br]) set(n, { color: alpha(ps.fg, 0.75) });
				});
			}
			if (deco.crumbs) {
				const tl = label("tl");
				const tr = label("tr");
				const bl = label("bl");
				const br = label("br");
				overlays.push((t, ps) => {
					tl.textContent = (plan.brand?.name ?? "").toUpperCase();
					tr.textContent = `${two(ps.index + 1)} / ${two(plan.scenes.length)}`;
					bl.textContent = (plan.brand?.url ?? "").toUpperCase();
					br.textContent = `00:${two(Math.floor(t))}:${two(Math.floor(t * 30) % 30)}`;
					for (const n of [tl, tr, bl, br]) set(n, { color: alpha(ps.fg, 0.7) });
				});
			}
			if (deco.letterbox) {
				// Scope bars that slide in as the film starts.
				const bar = letterboxBar();
				const bars = ["top", "bottom"].map((side) => {
					const b = el("div", "", stage);
					set(b, { position: "absolute", left: "0", width: px(W), height: px(bar), [side]: "0", background: "#000", zIndex: "945", transformOrigin: side === "top" ? "50% 0" : "50% 100%" });
					return b;
				});
				overlays.push((t) => {
					const k = expoOut(clamp(t / 0.9)).toFixed(4);
					for (const b of bars) set(b, { transform: `scaleY(${k})` });
				});
			}
			if (deco.ticks) {
				// A row of thin bars along the bottom that kicks on every beat, like a waveform.
				const row = el("div", "", stage);
				set(row, { position: "absolute", left: px(W * 0.3), width: px(W * 0.4), bottom: px(36 * S), height: px(46 * S), display: "flex", alignItems: "flex-end", justifyContent: "space-between", zIndex: "950" });
				const bars = Array.from({ length: 48 }, (_, i) => {
					const b = el("div", "", row);
					set(b, { width: px(3 * S), height: "100%", transformOrigin: "50% 100%" });
					return { b, h: 0.2 + hash(i * 5.5) * 0.8 };
				});
				overlays.push((t, ps) => {
					const kick = pulse(t % plan.beat, 7);
					for (const [i, k] of bars.entries()) {
						const wave = 0.5 + 0.5 * Math.sin(t * 6 + i * 0.5);
						set(k.b, { background: ps.accent, transform: `scaleY(${(0.12 + k.h * (0.25 + 0.75 * kick) * (0.6 + 0.4 * wave)).toFixed(3)})` });
					}
				});
			}
		};

		return { decorate, letterboxBar, buildOverlays: () => (buildOverlays(), overlays) };
	};


return { of };
}
