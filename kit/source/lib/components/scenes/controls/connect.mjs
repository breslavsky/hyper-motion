// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../../metadata.mjs';
import {kit} from '../_shared/own-kit.mjs';
export function create(K) {
const { panel, orbs, figure, counted, spread, unit } = kit;
const definition_connect={...metadata["connect"],build({ p, cam, fg, accent, palette, bg, K }){
			const { W, H, el, set, px, spring, clamp, alpha, textOn } = K;
			const S = unit(K);
			const s = p.scene;
			const light = orbs(K, cam, palette, accent, bg, p.index);
			const t = this.times(s, p.dur, p.beatLen);
			const cubicOut = (u) => 1 - (1 - clamp(u)) ** 3;
			const quadOut = (u) => 1 - (1 - clamp(u)) ** 2;
			const quadInOut = (u) => ((u = clamp(u)) < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
			const vertical = H >= W;
			const n = s.sources.length;
			// Where things stand: the sources in a column (a row on top in a tall frame), the target opposite.
			const sourceGrid = vertical && n === 4;
			const from = s.sources.map((_, i) => (sourceGrid ? { x: W * (i % 2 ? 0.72 : 0.28), y: H * (i < 2 ? 0.2 : 0.36) } : vertical ? { x: W * (0.5 + (i - (n - 1) / 2) * Math.min(0.3, 0.84 / n)), y: H * 0.26 } : { x: W * 0.22, y: H * (0.5 + (i - (n - 1) / 2) * Math.min(0.2, 0.7 / n)) }));
			const to = vertical ? { x: W * 0.5, y: H * 0.7 } : { x: W * 0.76, y: H * 0.5 };
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
			svg.setAttribute("class", "deco");
			svg.setAttribute("data-layout-allow-overlap", "");
			set(svg, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H) });
			cam.appendChild(svg);
			const lines = from.map((a) => {
				const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
				const bend = vertical ? `M${a.x} ${a.y} C ${a.x} ${(a.y + to.y) / 2}, ${to.x} ${(a.y + to.y) / 2}, ${to.x} ${to.y}` : `M${a.x} ${a.y} C ${(a.x + to.x) / 2} ${a.y}, ${(a.x + to.x) / 2} ${to.y}, ${to.x} ${to.y}`;
				path.setAttribute("d", bend);
				path.setAttribute("fill", "none");
				path.setAttribute("stroke", alpha(fg, 0.5));
				path.setAttribute("stroke-width", String(4.5 * S));
				path.setAttribute("stroke-linecap", "round");
				svg.appendChild(path);
				const length = path.getTotalLength();
				const dot = el("div", "", cam);
				const dd = 18 * S;
				set(dot, { position: "absolute", left: px(-dd / 2), top: px(-dd / 2), width: px(dd), height: px(dd), borderRadius: "50%", background: accent, boxShadow: `0 0 ${px(18 * S)} ${px(6 * S)} ${alpha(accent, 0.55)}` });
				return { path, length, dot };
			});
			const pw = Math.min(W * (sourceGrid ? 0.4 : vertical ? Math.min(0.3, 0.84 / n) : 0.3), 420 * S);
			const pills = s.sources.map((name, i) => {
				const pill = panel(K, cam, { ground: bg, radius: 'full' });
				pill.dataset.connectSource = String(i);
				set(pill, { position: "absolute", width: px(pw), left: px(from[i].x - pw / 2), textAlign: "center" });
				K.design.surface(pill,'badge',{density:'compact',shape:'pill'});
                const label = el("div", "bold", pill, name);
				set(label, { color: fg, width: "100%" });
				K.design.apply(label, 'controlLabel');
				K.design.truncateLine(label);label.title = name;
				set(pill, { top: px(from[i].y - pill.offsetHeight / 2) });
				return pill;
			});
			const td = Math.min(W * (vertical ? 0.5 : 0.24), 420 * S);
			const tile = el("div", "", cam);
			set(tile, { position: "absolute", left: px(to.x - td / 2), top: px(to.y - td / 2), width: px(td), height: px(td), borderRadius: px(td * 0.24), background: accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${px(30 * S)} ${px(80 * S)} ${alpha(accent, 0.45)}` });
			const name = el("div", "bold", tile, s.target);
			name.dataset.connectTarget = '';
			set(name, { color: textOn(accent), whiteSpace: "normal", overflowWrap: "anywhere", textAlign: "center" });
			K.design.fitSize(name, td * 0.82, td * 0.8, 'cardTitle');
			return (l) => {
				light(l);
				pills.forEach((pill, i) => {
					// A pill comes into focus as it rises a little.
					const e = cubicOut((l - t[i].pill) / 0.18);
					set(pill, { opacity: e.toFixed(3), transform: `translateY(${px((1 - e) * 14 * S)})`, filter: e < 1 ? `blur(${px((1 - e) * 10 * S)})` : "none" });
				});
				const land = spring(l - 0.2, 2.2, 0.6);
				// The target swells a little each time a light reaches it.
				const hit = t.reduce((sum, at) => sum + Math.sin(clamp((l - at.lands) / 0.4) * Math.PI), 0);
				set(tile, { opacity: clamp((l - 0.2) / 0.12).toFixed(3), transform: `scale(${(0.7 + 0.3 * land + 0.04 * Math.min(1, hit)).toFixed(4)})` });
				lines.forEach((line, i) => {
					// A dotted line that draws itself: dots a fixed distance apart, shown up to the drawn length.
					const drawn = quadOut((l - t[i].line) / 0.32) * line.length;
					const gap = 13 * S;
					const dots = Math.floor(drawn / gap);
					line.path.setAttribute("stroke-dasharray", dots > 0 ? `${Array.from({ length: dots }, () => `0.1 ${gap - 0.1}`).join(" ")} 0 ${line.length}` : `0 ${line.length}`);
					// A line not begun shows nothing: a dash of no length with a round cap is still a dot.
					line.path.style.visibility = dots > 0 ? "visible" : "hidden";
					// A light runs the curve, then runs it again.
					const span = 0.55, again = Math.max(0.65, (p.dur - t[i].run) / 2);
					const since = l - t[i].run;
					const lap = since < 0 ? -1 : since % again;
					const k = lap < 0 || lap > span ? -1 : quadInOut(lap / span);
					if (k < 0) set(line.dot, { opacity: "0", transform: "none" });
					else {
						const at = line.path.getPointAtLength(k * line.length);
						set(line.dot, { opacity: clamp(lap / 0.08).toFixed(3), transform: `translate(${px(at.x)}, ${px(at.y)})` });
					}
				});
			};
		}};
return given=>definition_connect.build(given);
}
