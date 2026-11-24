// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export function createLayers({ maths, dom, moves }) {
const { clamp, cubicInOut, quartOut, hash, lum, alpha } = maths;
	const { el, set } = dom;
	const { frac } = moves;

	/**
	 * The layers of a film. `film` is { W, H, S, plan, M }: its size in px and its scale, its plan
	 * (the palette, the beat) and its feel, read when a layer is built; `M` is read again at
	 * every frame, since a scene in a look of its own has a feel of its own.
	 */
	const of = (film) => {
		const { W, H, S, plan } = film;
		const canvasLayer = (parent, z) => moves.canvasLayer(parent, z, W, H);
		const beatKick = (t, k = 8) => moves.beatKick(t, k, plan.beat);
		const spring = (t, freq, damp) => maths.spring(t, freq, damp, film.M);

		/** Particle field: stars warping toward the lens, embers rising, dust motes, a confetti burst,
		 *  soft bokeh, or chrome glints. Brightens on every beat. */
		const particleField = (root, ps, kind, bgHex, burst) => {
			const { g, clear } = canvasLayer(root);
			const pal = plan.palette;
			const dark = lum(bgHex) < 0.3;
			const N = { stars: 150, embers: 70, dust: 90, confetti: 110, bokeh: 20, sparks: 46 }[kind] ?? 60;
			const cols = {
				stars: ["#ffffff", "#ffffff", pal.lime, pal.coral, pal.lilac],
				embers: [pal.peach, pal.butter, pal.coral, pal.lime],
				dust: [dark ? "#ffffff" : pal.ink],
				confetti: [pal.coral, pal.electric, pal.butter, pal.lime, pal.lilac, pal.peach].filter((c) => c && c !== bgHex),
				bokeh: [pal.coral, pal.electric, pal.lilac, pal.butter, "#ffffff"],
				sparks: ["#ffffff", pal.lime, pal.electric],
			}[kind];
			const P = Array.from({ length: N }, (_, i) => {
				const h = (k) => hash(i * 17.31 + k * 3.77 + ps.index * 101.3);
				return { a: h(1), b: h(2), c: h(3), d: h(4), e: h(5), col: cols[Math.floor(h(6) * cols.length)] ?? "#fff", i };
			});
			return (l) => {
				const t = ps.start + l;
				const kick = beatKick(t);
				clear();
				if (kind === "stars") {
					const R = Math.hypot(W, H) * 0.6;
					for (const p of P) {
						const z = frac(p.b + l * 0.09 * (0.6 + p.c));
						const ang = p.a * Math.PI * 2;
						const r = z * z * R + 6 * S;
						const x = W / 2 + Math.cos(ang) * r;
						const y = H / 2 + Math.sin(ang) * r * 0.8;
						const tw = 0.6 + 0.4 * Math.sin(t * (2 + p.d * 5) + p.e * 9);
						const s = (0.6 + 2.6 * z) * S * (1 + kick * 0.6);
						g.globalAlpha = clamp(z * 2.2) * tw * (0.55 + 0.45 * kick);
						g.fillStyle = p.col;
						g.beginPath();
						g.arc(x, y, s, 0, Math.PI * 2);
						g.fill();
						if (z > 0.55) {
							// Streaks toward the edges as they rush past.
							const len = (z - 0.55) * 60 * S * (1 + kick * 2);
							g.strokeStyle = p.col;
							g.lineWidth = s * 0.9;
							g.beginPath();
							g.moveTo(x, y);
							g.lineTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len * 0.8);
							g.stroke();
						}
					}
				} else if (kind === "embers") {
					for (const p of P) {
						const u = frac(p.b + l * (0.06 + 0.08 * p.c));
						const x = p.a * W + Math.sin(l * (0.8 + p.d) + p.e * 6) * 50 * S;
						const y = H * (1.08 - u * 1.25);
						const s = (1.5 + p.c * 3.5) * S;
						const fade = Math.sin(u * Math.PI);
						g.fillStyle = p.col;
						g.globalAlpha = fade * 0.18 * (1 + kick);
						g.beginPath();
						g.arc(x, y, s * 4, 0, Math.PI * 2);
						g.fill();
						g.globalAlpha = fade * 0.9;
						g.beginPath();
						g.arc(x, y, s, 0, Math.PI * 2);
						g.fill();
					}
				} else if (kind === "dust") {
					g.fillStyle = cols[0];
					for (const p of P) {
						const x = frac(p.a + l * 0.012 * (p.c - 0.5)) * W;
						const y = frac(p.b - l * 0.01 * (0.3 + p.d)) * H;
						g.globalAlpha = (0.12 + 0.35 * p.e) * (0.6 + 0.4 * Math.sin(t * (1 + p.c * 3) + p.d * 7));
						g.beginPath();
						g.arc(x, y, (0.8 + p.c * 2.2) * S, 0, Math.PI * 2);
						g.fill();
					}
				} else if (kind === "confetti") {
					// Two party cannons fire from the bottom corners (drag + gravity, closed form), then a
					// light drift keeps falling.
					const kD = 1.7;
					const grav = 1.6 * H;
					const vt = grav / kD;
					for (const p of P) {
						let x, y, rot, flip;
						if (burst && p.i < N * 0.7) {
							const dt = l - p.c * 0.18;
							if (dt < 0) continue;
							const side = p.i % 2 ? 1 : -1;
							const vx = -side * (0.25 + 0.55 * p.a) * W;
							const vy = -(1.1 + 0.9 * p.b) * H;
							const e = (1 - Math.exp(-kD * dt)) / kD;
							x = (side > 0 ? W * 1.02 : -W * 0.02) + vx * e;
							y = H * 1.02 + (vy - vt) * e + vt * dt;
							rot = p.d * 6 + dt * (3 + p.e * 8);
							flip = Math.cos(dt * (5 + p.c * 7) + p.a * 6);
						} else {
							const u = frac(p.b + l * (0.07 + 0.06 * p.c));
							x = p.a * W + Math.sin(l * 1.3 + p.d * 6) * 40 * S;
							y = -0.05 * H + u * 1.1 * H;
							rot = p.d * 6 + l * (1 + p.e * 2);
							flip = Math.cos(l * (3 + p.c * 4) + p.a * 6);
							g.globalAlpha = burst ? 0 : 0.85;
							if (burst) continue;
						}
						if (y > H + 40 * S) continue;
						g.globalAlpha = 0.95;
						g.fillStyle = p.col;
						g.save();
						g.translate(x, y);
						g.rotate(rot);
						g.scale(1, flip);
						if (p.e > 0.7) {
							g.beginPath();
							g.arc(0, 0, 6 * S, 0, Math.PI * 2);
							g.fill();
						} else g.fillRect(-9 * S, -5 * S, 18 * S, 10 * S);
						g.restore();
					}
				} else if (kind === "bokeh") {
					g.globalCompositeOperation = dark ? "screen" : "source-over";
					for (const p of P) {
						const r = (50 + p.c * 150) * S;
						const x = (p.a * 1.2 - 0.1) * W + Math.sin(l * 0.25 + p.d * 6) * 80 * S;
						const y = (p.b * 1.2 - 0.1) * H + Math.cos(l * 0.2 + p.e * 6) * 60 * S;
						const gr = g.createRadialGradient(x, y, 0, x, y, r);
						gr.addColorStop(0, alpha(p.col, 0.42));
						gr.addColorStop(0.7, alpha(p.col, 0.22));
						gr.addColorStop(1, alpha(p.col, 0));
						g.globalAlpha = (0.55 + 0.45 * Math.sin(t * 0.8 + p.d * 9)) * (dark ? 0.8 : 0.65);
						g.fillStyle = gr;
						g.beginPath();
						g.arc(x, y, r, 0, Math.PI * 2);
						g.fill();
					}
					g.globalCompositeOperation = "source-over";
				} else if (kind === "sparks") {
					g.globalCompositeOperation = "lighter";
					for (const p of P) {
						const x = (p.a + l * 0.006 * (p.c - 0.5)) * W;
						const y = (p.b + l * 0.004 * (p.d - 0.5)) * H;
						const glint = Math.max(0, Math.sin(t * (0.9 + p.c * 1.6) + p.e * 12)) ** 8 + kick * 0.35 * (p.d > 0.6 ? 1 : 0);
						if (glint < 0.02) continue;
						const s = (10 + p.c * 26) * S * glint;
						g.globalAlpha = clamp(glint);
						g.strokeStyle = p.col;
						g.lineWidth = 1.6 * S;
						g.beginPath();
						g.moveTo(x - s, y);
						g.lineTo(x + s, y);
						g.moveTo(x, y - s);
						g.lineTo(x, y + s);
						g.stroke();
						g.fillStyle = "#ffffff";
						g.beginPath();
						g.arc(x, y, 2.2 * S * glint, 0, Math.PI * 2);
						g.fill();
					}
					g.globalCompositeOperation = "source-over";
				}
				g.globalAlpha = 1;
			};
		};

		/** Synthwave floor: a perspective grid rolling toward the camera, pulsing on the beat. */
		const gridFloor = (root, ps) => {
			const pal = plan.palette;
			const hz = H * (H > W ? 0.66 : 0.6);
			// Horizon glow above, a dark ground below; the grid draws over it.
			const sky = el("div", "deco", root);
			set(sky, { background: `linear-gradient(180deg, transparent ${((hz / H) * 100 - 22).toFixed(1)}%, ${alpha(pal.electric, 0.3)} ${((hz / H) * 100 - 3).toFixed(1)}%, ${alpha(pal.coral, 0.55)} ${((hz / H) * 100).toFixed(1)}%, ${alpha(pal.ink, 0.9)} ${((hz / H) * 100 + 0.4).toFixed(1)}%, ${alpha(pal.ink, 0.6)} 100%)` });
			const { g, clear } = canvasLayer(root);
			return (l) => {
				const t = ps.start + l;
				const kick = beatKick(t, 6);
				clear();
				const lines = (pass) => {
					g.lineWidth = (pass ? 2 : 9) * S;
					g.globalAlpha = pass ? 0.9 : 0.16 + 0.12 * kick;
					// Horizontals: depth 1 at the bottom edge, converging on the horizon.
					g.strokeStyle = pal.coral;
					const scroll = frac(t * 0.9);
					for (let j = 0; j < 22; j++) {
						const z = 1 + j - scroll;
						if (z <= 0.2) continue;
						const y = hz + (H - hz) * (0.8 / z);
						g.globalAlpha = (pass ? 0.9 : 0.2) * clamp(1.2 - z / 16);
						g.beginPath();
						g.moveTo(0, y);
						g.lineTo(W, y);
						g.stroke();
					}
					// Verticals fanning out from the vanishing point.
					g.strokeStyle = pal.lime;
					g.globalAlpha = pass ? 0.75 : 0.18;
					const sp = W * 0.11;
					for (let k = -14; k <= 14; k++) {
						g.beginPath();
						g.moveTo(W / 2 + k * sp * 0.04, hz);
						g.lineTo(W / 2 + k * sp * 1.9, H);
						g.stroke();
					}
				};
				lines(0);
				lines(1);
				g.globalAlpha = 1;
			};
		};

		/** Maths-explainer axes: a faint grid and two axes drawing themselves on, then a curve. */
		const axesPlane = (root, ps, bgHex) => {
			const pal = plan.palette;
			const ink = lum(bgHex) < 0.35 ? "#ffffff" : pal.ink;
			const ns = "http://www.w3.org/2000/svg";
			const svg = document.createElementNS(ns, "svg");
			svg.setAttribute("class", "deco");
			svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
			svg.setAttribute("width", String(W));
			svg.setAttribute("height", String(H));
			root.appendChild(svg);
			const ox = W * (ps.index % 2 ? 0.86 : 0.12);
			const oy = H * 0.84;
			const cell = 80 * S;
			const path = (d, stroke, w, op) => {
				const p = document.createElementNS(ns, "path");
				p.setAttribute("d", d);
				p.setAttribute("fill", "none");
				p.setAttribute("stroke", stroke);
				p.setAttribute("stroke-width", String(w));
				p.setAttribute("stroke-linecap", "round");
				p.setAttribute("opacity", String(op));
				svg.appendChild(p);
				const len = p.getTotalLength?.() || W * 2;
				p.setAttribute("stroke-dasharray", String(len));
				p.setAttribute("stroke-dashoffset", String(len));
				return { p, len };
			};
			let grid = "";
			for (let x = ox % cell; x < W; x += cell) grid += `M${x.toFixed(1)} 0V${H}`;
			for (let y = oy % cell; y < H; y += cell) grid += `M0 ${y.toFixed(1)}H${W}`;
			const gridP = document.createElementNS(ns, "path");
			gridP.setAttribute("d", grid);
			gridP.setAttribute("stroke", pal.electric);
			gridP.setAttribute("stroke-width", String(1.2 * S));
			gridP.setAttribute("opacity", "0");
			svg.appendChild(gridP);
			const dir = ps.index % 2 ? -1 : 1;
			const xAxis = path(`M${ox - dir * cell} ${oy}H${dir > 0 ? W - cell * 0.5 : cell * 0.5}`, ink, 3 * S, 0.55);
			const yAxis = path(`M${ox} ${oy + cell}V${cell * 0.8}`, ink, 3 * S, 0.55);
			let ticks = "";
			for (let k = 1; k * cell < W; k++) ticks += `M${ox + dir * k * cell} ${oy - 8 * S}v${16 * S}`;
			for (let k = 1; oy - k * cell > cell; k++) ticks += `M${ox - 8 * S} ${oy - k * cell}h${16 * S}`;
			const tickP = path(ticks, ink, 2 * S, 0.4);
			// A logistic curve climbing from the origin, the shape of growth.
			let curve = "";
			const span = (dir > 0 ? W - ox : ox) - cell;
			for (let i = 0; i <= 60; i++) {
				const u = i / 60;
				const y = oy - (oy - cell * 1.6) / (1 + Math.exp(-(u - 0.55) * 9));
				curve += `${i ? "L" : "M"}${(ox + dir * u * span).toFixed(1)} ${y.toFixed(1)}`;
			}
			const curveP = path(curve, pal.butter, 5 * S, 0.5);
			return (l) => {
				const a = cubicInOut(clamp(l / 0.9));
				gridP.setAttribute("opacity", (0.16 * clamp(l / 0.6)).toFixed(3));
				xAxis.p.setAttribute("stroke-dashoffset", (xAxis.len * (1 - a)).toFixed(1));
				yAxis.p.setAttribute("stroke-dashoffset", (yAxis.len * (1 - a)).toFixed(1));
				tickP.p.setAttribute("stroke-dashoffset", (tickP.len * (1 - cubicInOut(clamp((l - 0.4) / 0.8)))).toFixed(1));
				curveP.p.setAttribute("stroke-dashoffset", (curveP.len * (1 - cubicInOut(clamp((l - 0.7) / 2.2)))).toFixed(1));
			};
		};

		/** Playful vector shapes popping in around the frame edges with springs, then floating. */
		const SHAPE_SPOTS = [[0.08, 0.16], [0.9, 0.13], [0.12, 0.84], [0.88, 0.82], [0.5, 0.07], [0.04, 0.5], [0.96, 0.48], [0.62, 0.93], [0.3, 0.06], [0.35, 0.94]];
		const popShapes = (root, ps, bgHex) => {
			const pal = plan.palette;
			const cols = [pal.coral, pal.electric, pal.butter, pal.lime, pal.lilac, pal.peach, pal.ink].filter((c) => c && contrastHex(c, bgHex) > 1.35);
			const ns = "http://www.w3.org/2000/svg";
			const svg = document.createElementNS(ns, "svg");
			svg.setAttribute("class", "deco");
			svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
			svg.setAttribute("width", String(W));
			svg.setAttribute("height", String(H));
			svg.style.overflow = "visible";
			root.appendChild(svg);
			const kinds = ["ring", "squiggle", "star", "pill", "dot", "plus", "tri", "half"];
			const spots = SHAPE_SPOTS.map((s, i) => ({ s, k: hash(i * 3.3 + ps.index * 7.9) })).sort((a, b) => a.k - b.k).slice(0, 6);
			const shapes = spots.map(({ s }, i) => {
				const kind = kinds[Math.floor(hash(i * 5.1 + ps.index * 2.3) * kinds.length)];
				const col = cols[(i + ps.index) % Math.max(1, cols.length)] ?? pal.ink;
				const r = (44 + hash(i * 9.7 + ps.index) * 46) * S;
				const gEl = document.createElementNS(ns, "g");
				svg.appendChild(gEl);
				const add = (tag, attrs) => {
					const n = document.createElementNS(ns, tag);
					for (const k in attrs) n.setAttribute(k, String(attrs[k]));
					gEl.appendChild(n);
					return n;
				};
				let dash = null;
				if (kind === "ring") add("circle", { r: r * 0.8, fill: "none", stroke: col, "stroke-width": r * 0.28 });
				else if (kind === "dot") add("circle", { r: r * 0.7, fill: col });
				else if (kind === "pill") add("rect", { x: -r * 1.1, y: -r * 0.42, width: r * 2.2, height: r * 0.84, rx: r * 0.42, fill: col });
				else if (kind === "plus") add("path", { d: `M${-r} 0H${r}M0 ${-r}V${r}`, stroke: col, "stroke-width": r * 0.38, "stroke-linecap": "round" });
				else if (kind === "tri") add("path", { d: `M0 ${-r}L${r * 0.95} ${r * 0.7}L${-r * 0.95} ${r * 0.7}Z`, fill: col, "stroke-linejoin": "round", stroke: col, "stroke-width": r * 0.2 });
				else if (kind === "half") add("path", { d: `M${-r} ${r * 0.3}A${r} ${r} 0 0 1 ${r} ${r * 0.3}Z`, fill: col });
				else if (kind === "star") {
					const pts = Array.from({ length: 10 }, (_, k) => {
						const a = (k * Math.PI) / 5 - Math.PI / 2;
						const rr = k % 2 ? r * 0.45 : r;
						return `${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`;
					});
					add("path", { d: `M${pts.join("L")}Z`, fill: col, stroke: col, "stroke-width": r * 0.12, "stroke-linejoin": "round" });
				} else {
					let d = `M${-r * 1.4} 0`;
					for (let k = 0; k < 4; k++) d += `q${r * 0.35} ${k % 2 ? r * 0.7 : -r * 0.7} ${r * 0.7} 0`;
					dash = add("path", { d, fill: "none", stroke: col, "stroke-width": r * 0.26, "stroke-linecap": "round" });
					const len = dash.getTotalLength?.() || r * 6;
					dash.setAttribute("stroke-dasharray", String(len));
					dash.__len = len;
				}
				return { gEl, x: s[0] * W, y: s[1] * H, at: 0.1 + i * 0.08, rot0: (hash(i * 1.9 + ps.index) - 0.5) * 60, spin: (hash(i * 6.1) - 0.5) * 40, dash, ph: hash(i * 2.9) * 6 };
			});
			return (l) => {
				for (const k of shapes) {
					const sc = Math.max(0, spring(l - k.at, 2.4, 0.38));
					const fy = Math.sin(l * 1.6 + k.ph) * 10 * S;
					k.gEl.setAttribute("transform", `translate(${(k.x).toFixed(1)} ${(k.y + fy).toFixed(1)}) rotate(${(k.rot0 + l * k.spin + (1 - sc) * -90).toFixed(2)}) scale(${sc.toFixed(4)})`);
					if (k.dash) k.dash.setAttribute("stroke-dashoffset", (k.dash.__len * (1 - quartOut(clamp((l - k.at) / 0.7)))).toFixed(1));
				}
			};
		};
		const contrastHex = (a, b) => {
			const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
			return (x + 0.05) / (y + 0.05);
		};

		return { particleField, gridFloor, axesPlane, popShapes, contrastHex };
	};


return { of };
}
