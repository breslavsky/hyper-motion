// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import catalog from '../../catalog.mjs';
import {surfaceForeground} from '../../brand-tokens.mjs';
import {logoNodeFor} from '../../builtin.mjs';
export function create(K) {
const { maths, dom } = K.helpers;
const D=K.design;
const { clamp, prog, expoOut, hash, textOn } = maths;
const { el, set, px } = dom;
const { W, H, S, plan, glyphText, beatKick, spring } = K;
const logoNode = logoNodeFor(K);
return ({ p, cam, fg, accent }) => {
			fg=K.surfaceForeground=surfaceForeground(catalog.endcard.surface,p.bg,plan.palette,fg,{explicit:p.explicitForeground??(p.scene.fg!==undefined||K.plan.brand?.tokens?.foreground!==undefined)});
			const s = p.scene;
			const wrap = el("div", "center", cam);
			const size = Math.min(W, H) * 0.17;
			const logo = logoNode(wrap, size, plan.palette.brand);
			set(logo, { marginBottom: px(D.space(5)), boxShadow: `0 ${px(20 * S)} ${px(50 * S)} rgba(0,0,0,0.18)` });
			const name = el("div", "display", wrap);
			set(name, { color: fg });
			const g = glyphText(name, plan.brand?.name ?? "").glyphs;
			D.fitSize(name, W * 0.82, H * 0.3, "display");
			let tag = null;
			if (s.tagline) {
				tag = el("div", "bold", wrap, s.tagline);
				set(tag, { color: fg, marginTop: px(D.space(3)), opacity: "0.8", whiteSpace: "normal", textAlign: "center" });
				// Long brand copy wraps at a readable size instead of shrinking below
				// the shared label floor. Leave room for the camera's final push.
				D.fitSize(tag, K.safe.w * 0.88, H * 0.14, "body");
			}
			const pill = el("div", "pill mono", wrap, s.cta);
			pill.dataset.designControl="button";pill.dataset.designControlLayout="flow";
			const shine = textOn(accent) === "#ffffff" ? 0.2 : 0.45;
			const button = D.control("button");
			D.apply(pill,"button");
			set(pill, { background: accent, color: textOn(accent), padding: `${px(button.paddingY)} ${px(button.paddingX)}`, borderRadius:px(button.radius), marginTop: px(D.space(4)), maxWidth:px(K.safe.w*.82), whiteSpace: "normal", textAlign: "center", boxSizing: "border-box" });
			const seeds = g.map((x) => ({ dx: hash(x.i * 3.3) * 2 - 1, dy: hash(x.i * 7.7) * 2 - 1, r: hash(x.i * 1.9) * 2 - 1, at: hash(x.i * 4.4) * 0.35 }));
			return (l) => {
				const le = spring(l, 2.4, 0.5);
				// Once landed it keeps living: the logo floats, the pill kicks on the beat and a light
				// sweeps across it, so the last frames of a film never freeze.
				const alive = clamp((l - 1) / 0.6);
				// The whole card keeps a slow push, so a long end card never sits frozen.
				set(wrap, { transform: `scale(${(1 + 0.05 * clamp(l / Math.max(1, p.dur))).toFixed(4)})` });
				set(logo, { transform: `translateY(${px(Math.sin(l * 2.2) * 10 * S * alive)}) scale(${le.toFixed(4)}) rotate(${((1 - le) * -30 + Math.sin(l * 1.6) * 3 * alive).toFixed(3)}deg)` });
				g.forEach((x, i) => {
					const sd = seeds[i];
					const k = spring(l - 0.12 - sd.at, 2.6, 0.62);
					set(x.node, {
						opacity: clamp((l - 0.12 - sd.at) / 0.08).toFixed(3),
						transform: `translate(${((1 - k) * sd.dx * 1.6).toFixed(4)}em, ${((1 - k) * sd.dy * 1.2).toFixed(4)}em) rotate(${((1 - k) * sd.r * 70).toFixed(3)}deg) scale(${(0.5 + 0.5 * k).toFixed(4)})`,
					});
				});
				if (tag) {
					const k = expoOut(prog(l, 0.6, 0.5));
					set(tag, { opacity: (k * 0.8).toFixed(3), transform: `translateY(${px((1 - k) * 20 * S)})` });
				}
				const pk = spring(l - 0.75, 2.6, 0.55);
				const kickP = beatKick(p.start + l) * 0.035 * alive;
				const sweep = ((l * 0.55) % 1.3) - 0.15;
				set(pill, {
					opacity: clamp((l - 0.75) / 0.08).toFixed(3),
					transform: `translateY(${px((1 - pk) * 40 * S)}) scale(${(0.8 + 0.2 * pk + kickP).toFixed(4)})`,
					backgroundImage: alive > 0 ? `linear-gradient(105deg, transparent ${((sweep - 0.12) * 100).toFixed(1)}%, rgba(255,255,255,${shine}) ${(sweep * 100).toFixed(1)}%, transparent ${((sweep + 0.12) * 100).toFixed(1)}%)` : "none",
				});
			};
		};
}
