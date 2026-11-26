// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../../metadata.mjs';
import {kit} from '../_shared/cards.mjs';
export function create(K) {
const { panel, orbs, figure, counted, spread, unit } = kit;
const definition_chips={...metadata["chips"],build({ p, cam, fg, accent, palette, bg, K }){
			const { W, H, el, set, px, glyphText, riseGlyphs, clamp, prog, smooth, hash, alpha } = K;
			const S = unit(K);
			const s = p.scene;
			const light = orbs(K, cam, palette, accent, bg, p.index);
			const n = s.chips.length;
			// The chips leave in the scene's last third of a second: a fly-through, not a drift away.
			const leave = Math.max(p.dur - 0.3, p.dur * 0.6);
			const step = Math.min(0.07, (p.dur * 0.4) / n);
			// The chips stand in a box with depth, its vanishing point the middle of the frame: a chip
			// pushed toward the viewer runs along its line from the centre and grows past the camera.
			const space = el("div", "", cam);
			set(space, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), perspective: px(1000 * S), perspectiveOrigin: "50% 50%" });
			const cubicOut = (u) => 1 - (1 - clamp(u)) ** 3;
			// Places on two arcs, over and under the line (never beside it, where the line runs), every
			// other one further out, each a little off its angle.
			const over = Math.ceil(n / 2);
			const chips = s.chips.map((name, i) => {
				const top = i % 2 === 0;
				const slot = Math.floor(i / 2), slots = top ? over : n - over;
				const a = (top ? Math.PI : 0) + (Math.PI * (slot + 0.5)) / slots + (hash(i * 3.7 + 1) - 0.5) * 0.18;
				const far = slot % 2 ? 0.45 : 0.39;
				const depth = hash(i * 5.3 + 2);
				const node = panel(K, space, { ground: bg, radius: 'full', blur: 14, tint: i % 3 === 0 ? accent : undefined });
				const label = el("div", "bold", node, name);
				set(label, { color: fg, whiteSpace: "nowrap" }); const chipDesign=K.design.forSurface(0.8 + depth * 0.2); chipDesign.apply(label, 'controlLabel');
				set(node, { position: "absolute", left: "0", top: "0" });
				const chipBox=chipDesign.surface(node,'badge',{shape:'pill'});
				set(label, { maxWidth: px(K.safe.w*.4-chipBox.paddingX*2) });
				chipDesign.truncateLine(label);label.title = name;
                return { node, x: K.safe.x + K.safe.w / 2 + Math.cos(a) * K.safe.w * far, y: K.safe.y + K.safe.h / 2 + Math.sin(a) * K.safe.h * (far - 0.05), a, depth, roll: (hash(i * 7.1) - 0.5) * 10, at: 0.15 + i * step,
					// A small tilt at rest; a hard one as it goes, a moment after the others or before.
					tilt: [(hash(i * 2.9 + 4) - 0.5) * 12, (hash(i * 4.3 + 5) - 0.5) * 16], hard: [(hash(i * 6.7 + 6) - 0.5) * 120, (hash(i * 8.9 + 7) - 0.5) * 130],
					goes: leave + hash(i * 9.7 + 8) * 0.04, z: (860 + hash(i * 1.9 + 9) * 100) * S };
			});
			const wrap = el("div", "center", cam);
			const line = el("div", "display", wrap);
			set(line, { color: fg });
			const { glyphs, words } = glyphText(line, s.text);
			for (const w of words) if (w.accent) set(w.node, { color: accent });
			K.design.fitSize(line, K.safe.w * 0.78, Math.min(K.safe.h*.28,K.design.steps('display').at(-1).lineHeight*2), 'display');
			// A chip never stands on the line: at least the line's half height and its own away from the middle.
			const clear = line.offsetHeight / 2 + K.design.space(3);
			const middle = K.safe.y + K.safe.h / 2;
			for (const c of chips) if (Math.abs(c.y - middle) < clear) c.y = middle + (c.y < middle ? -clear : clear);
            if(n>6){
                for(const side of [0,1]){
                    const group=chips.filter((_,i)=>i%2===side),rows=Math.ceil(group.length/2);
                    const bandH=K.safe.h/2-clear;
                    group.forEach((chip,i)=>{
                        chip.x=K.safe.x+K.safe.w*(i%2?.75:.25);
                        chip.y=(side?middle+clear:K.safe.y)+bandH*(Math.floor(i/2)+.5)/rows;
                    });
                }
            }
			return (l) => {
				light(l);
				riseGlyphs(glyphs, l, { at: 0.05, stagger: 0.03 });
				for (const c of chips) {
					const k = cubicOut((l - c.at) / 0.22);
					const drift = Math.sin(l * 0.9 + c.a * 3) * 6 * S;
					// At rest a chip stays whole inside the frame.
					const half = c.node.offsetWidth / 2, edge = 10 * S;
					const rest = Math.min(K.safe.x + K.safe.w - half - edge, Math.max(K.safe.x + half + edge, c.x));
					const x = rest - half;
					const y = c.y - c.node.offsetHeight / 2 + drift;
					const soft = c.depth < 0.35 ? 3 * S : 0;
					// Leaving, a chip tilts hard (0.14 s) and flies at the camera (0.22 s, gathering speed),
					// blurring into a streak; it is gone before it would fill the frame.
					const turn = cubicOut((l - c.goes) / 0.14);
					const fly = clamp((l - c.goes) / 0.22) ** 2;
					const [rx, ry] = [0, 1].map((j) => c.tilt[j] + (c.hard[j] - c.tilt[j]) * turn);
					set(c.node, { opacity: (k * (1 - clamp((l - c.goes - 0.17) / 0.06))).toFixed(3), transform: `translate3d(${px(x)}, ${px(y)}, ${px(c.z * fly)}) rotate(${c.roll.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) scale(${(0.94 + 0.06 * k).toFixed(4)})`, filter: `blur(${px((1 - k) * 6 * S + soft + fly * 10 * S)})` });
				}
			};
		}};
return given=>definition_chips.build(given);
}
