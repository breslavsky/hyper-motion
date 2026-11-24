// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../metadata.mjs';
export function createFamily(K) {
const sceneFactories={};
const stepped = (table, f) => {
		if (f <= 0) return table[0];
		if (f >= table.length - 1) return table[table.length - 1];
		const i = Math.floor(f);
		return table[i] + (table[i + 1] - table[i]) * (f - i);
	};
const definition_gather={...metadata["gather"],build({ p, cam, fg, accent, K }){
			const { W, H, S, el, set, px, hash, clamp, prog, smooth } = K;
			const s = p.scene;
			const wrap = el("div", "center", cam);
			const word = el("div", "display", wrap, s.word);
			set(word, { color: fg, whiteSpace: "nowrap", transformOrigin: "50% 55%" });
			K.design.fitLine(word, K.safe.w * 0.92, K.safe.h * 0.42, 'hero');
			const layer = K.helpers.moves.canvasLayer(cam, 2, W, H);
			layer.c.dataset.designRaster=JSON.stringify([{...K.design.type('hero',Number(word.dataset.designStep)),text:s.word}]);

			// Where the word's ink is: the word drawn once off screen in the look's own type, at the
			// place the page laid it out, and sampled. The dots land on those points.
			const k = cam.getBoundingClientRect().width / W || 1;
			const origin = cam.getBoundingClientRect();
			const range = document.createRange();
			range.selectNodeContents(word);
			const box = range.getBoundingClientRect();
			const [bx, by, bw, bh] = [(box.left - origin.left) / k, (box.top - origin.top) / k, box.width / k, box.height / k];
			const style = getComputedStyle(word);
			const R = 0.5; // the sampling canvas is half the stage's size
			const off = document.createElement("canvas");
			off.dataset.designRaster = layer.c.dataset.designRaster;
			off.width = Math.ceil(W * R);
			off.height = Math.ceil(H * R);
			const g = off.getContext("2d");
			g.setTransform(R, 0, 0, R, 0, 0);
			g.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
			if ("letterSpacing" in g) g.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
			const shown = style.textTransform === "uppercase" ? s.word.toUpperCase() : style.textTransform === "lowercase" ? s.word.toLowerCase() : s.word;
			const m = g.measureText(shown);
			const [up, down] = [m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent, m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent];
			g.textBaseline = "alphabetic";
			g.fillStyle = "#fff";
			g.fillText(shown, bx, by + (bh - (up + down)) / 2 + up);
			const ink = g.getImageData(0, 0, off.width, off.height).data;
			const points = [];
			const [x0, x1, y0, y1] = [Math.max(0, Math.floor((bx - 20) * R)), Math.min(off.width, Math.ceil((bx + bw + 20) * R)), Math.max(0, Math.floor((by - 20) * R)), Math.min(off.height, Math.ceil((by + bh + 20) * R))];
			for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) if (ink[(y * off.width + x) * 4 + 3] > 128) points.push([x / R, y / R]);
			const [cx, cy] = [bx + bw / 2, by + bh / 2];
			const far = Math.hypot(W, H);
			const dots = points.length
				? Array.from({ length: Math.min(1600, Math.max(500, points.length)) }, (_, i) => {
						const [tx, ty] = points[Math.floor(hash(i * 3.1 + 0.7) * points.length)];
						return { sx: hash(i * 1.3) * W, sy: hash(i * 2.9 + 4) * H, vx: (hash(i * 5.3 + 1) - 0.5) * 34 * S, vy: (hash(i * 7.7 + 2) - 0.5) * 34 * S, tx, ty, delay: hash(i * 9.1 + 3) * 0.1, phase: hash(i * 4.7 + 5) * 6.283, r: (1.6 + hash(i * 6.1 + 6) * 1.8) * S, burst: 0.6 + hash(i * 8.3 + 7) * 0.8, lit: hash(i * 2.3 + 8) < 0.25 };
					})
				: [];
			const at = this.times(s, p.dur);
			/** Where a dot is at the scene's moment `l`. */
			const place = (d, l) => {
				const [fx, fy] = [d.sx + d.vx * l, d.sy + d.vy * l];
				const e = 0.5 - 0.5 * Math.cos(Math.PI * clamp((l - at.gather - d.delay) / 0.5));
				let x = fx + (d.tx - fx) * e + Math.sin(l * 9 + d.phase) * 1.4 * S * e;
				let y = fy + (d.ty - fy) * e + Math.cos(l * 7 + d.phase) * 1.4 * S * e;
				if (l > at.burst) {
					// The word swells, and a push from its middle flings every dot out of the frame.
					const u = (l - at.burst) / 0.32;
					const [dx, dy] = [x - cx, y - cy];
					const dist = Math.hypot(dx, dy) || 1;
					const swell = 1 + 3.2 * d.burst * u * u;
					const push = far * d.burst * u * u * u;
					x = cx + dx * swell + (dx / dist) * push;
					y = cy + dy * swell + (dy / dist) * push;
				}
				return [x, y];
			};
			return (l) => {
				const solid = smooth((l - at.word) / 0.18);
				const gone = clamp((l - at.burst) / 0.14);
				// The word itself takes over from the dots once they have landed, and leaves first.
				set(word, { opacity: (solid * (1 - gone)).toFixed(3), transform: `scale(${(1 + 0.5 * gone * gone).toFixed(4)})` });
				layer.clear();
				const { g: c } = layer;
				c.lineCap = "round";
				c.globalAlpha = 1 - 0.72 * solid * (1 - gone);
				for (const lit of [false, true]) {
					c.strokeStyle = lit ? accent : fg;
					for (const d of dots) {
						if (d.lit !== lit) continue;
						// Drawn from a moment before to a moment after, so a fast dot is a streak.
						const [ax, ay] = place(d, l - 1 / 180);
						const [zx, zy] = place(d, l + 1 / 180);
						c.lineWidth = d.r * 2;
						c.beginPath();
						c.moveTo(ax, ay);
						c.lineTo(zx + 0.01, zy);
						c.stroke();
					}
				}
				c.globalAlpha = 1;
				void prog;
			};
		}};
sceneFactories["gather"]=given=>definition_gather.build(given);
const definition_impact={...metadata["impact"],build({ p, cam, fg, accent, K }){
			const { W, H, S, el, set, px, hash, clamp, expoOut, prog } = K;
			const s = p.scene;
			const wrap = el("div", "center", cam);
			const word = el("div", "display", wrap, s.text);
			set(word, { color: fg, whiteSpace: "nowrap", transformOrigin: "50% 55%" });
			K.design.fitSize(word, K.safe.w * 0.9, K.safe.h * 0.42, 'hero');
			let lead = null;
			if (s.lead) {
				lead = el("div", "bold", wrap, s.lead);
				set(lead, { position: "absolute", color: fg, whiteSpace: "nowrap" });
				K.design.fitSize(lead, K.safe.w * 0.8, K.design.type('sceneTitle').lineHeight*2, 'sceneTitle');
			}
			// The ring, round the middle of the safe area, where the word is.
			const [cx, cy] = [K.safe.x + K.safe.w / 2, K.safe.y + K.safe.h / 2];
			const unit = Math.min(W, H);
			const ring = el("div", "deco", cam);
			set(ring, { left: px(cx), top: px(cy), width: "0", height: "0", inset: "auto" });
			set(ring, { left: px(cx), top: px(cy) });
			const lines = Array.from({ length: 46 }, (_, i) => {
				const spoke = el("div", "", ring);
				set(spoke, { position: "absolute", left: "0", top: "0", width: "0", height: "0", transform: `rotate(${((i / 46) * 360 + (hash(i * 3.3) - 0.5) * 6).toFixed(2)}deg)` });
				const line = el("div", "", spoke);
				const thick = Math.max(2, 3.5 * S);
				set(line, { position: "absolute", left: "0", top: px(-thick / 2), height: px(thick), width: px((0.035 + hash(i * 5.1 + 1) * 0.05) * unit), borderRadius: px(thick), background: hash(i * 7.9 + 2) < 0.25 ? accent : fg, willChange: "transform" });
				return { line, r: (0.21 + hash(i * 2.7 + 3) * 0.23) * unit };
			});
			// One value a frame at 30 a second, as the technique gives them.
			const FLY = [1, 1.5, 1.95, 2.35, 2.7, 3, 3];
			const FADE = [1, 1, 1, 1, 0.4, 0.2, 0];
			const SLAM = [2, 1.16, 1.06, 0.93, 0.88, 0.88, 0.92, 0.97, 1.005, 1.024, 1.027, 1.02, 1.008, 1];
			const at = this.times(s, p.dur, p.beatLen);
			return (l) => {
				const f = (l - at.drop) * 30;
				for (const { line, r } of lines) set(line, { opacity: f < 0 ? "0" : stepped(FADE, f).toFixed(3), transform: `translateX(${px(r * stepped(FLY, f))})` });
				// The word comes a frame after the lines, and drifts a little larger once it rests.
				const rest = 1 + 0.03 * clamp((l - at.drop - 0.5) / Math.max(0.5, p.dur));
				set(word, { opacity: f < 1 ? "0" : f < 2 ? "0.6" : "1", transform: `scale(${(stepped(SLAM, f - 1) * rest).toFixed(4)})` });
				if (lead) {
					const k = expoOut(prog(l, 0, 0.35));
					set(lead, { opacity: f >= 0 ? "0" : k.toFixed(3), transform: `translateY(${px((1 - k) * 24 * S)})` });
				}
			};
		}};
sceneFactories["impact"]=given=>definition_impact.build(given);

return {sceneFactories};
}
