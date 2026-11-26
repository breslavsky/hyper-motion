// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../../typing.mjs';
export function create(K) {
const { maths, dom, ui } = K.helpers;
const D=K.design;
const { clamp, lerp, prog, expoOut, cubicInOut, lum, textOn, alpha, mixHex } = maths;
const { el, set, px } = dom;
const { makeCursor } = ui;
const { W, H, S, plan, spring } = K;
		/** One shape, never cut: a UI element morphing state to state on the beat, driven by the cursor. */
		const MORPH_SHAPES = {
			button: { w: 520, h: 150, r: 75 },
			loader: { w: 150, h: 150, r: 75 },
			check: { w: 150, h: 150, r: 75 },
			toggle: { w: 300, h: 160, r: 80 },
			slider: { w: 780, h: 70, r: 35 },
			player: { w: 780, h: 210, r: 48 },
			tabs: { w: 780, h: 124, r: 62 },
			search: { w: 840, h: 134, r: 34 },
			toast: { w: 660, h: 134, r: 67 },
		};
return ({ p, cam, accent, bg }) => {
			const s = p.scene;
			const states = s.states;
			const marks = p.marks ?? states.map((_, i) => (i * p.dur) / states.length);
			const k = S * (W > H ? 1.25 : 1.05);
			const controls=D.forSurface((3*k)/D.unit),button=controls.control("button");
			const labelMeasure=el("span","",cam,s.label??"→");
			controls.apply(labelMeasure,"button");
			set(labelMeasure,{position:"absolute",whiteSpace:"nowrap",visibility:"hidden"});
			const MORPH=Object.fromEntries(Object.entries(MORPH_SHAPES).map(([state,geometry])=>[state,{...geometry}]));
			Object.assign(MORPH,{button:{w:Math.min(K.safe.w,labelMeasure.getBoundingClientRect().width+button.paddingX*2)/k,h:button.height/k,r:button.radius/k}});
			labelMeasure.remove();
			const ink = lum(bg) > 0.4 ? "#111111" : "#f4f4f4";
			const onInk = textOn(ink);
			const solid = (st) => (st === "check" || st === "toggle" ? accent : st === "search" ? "#ffffff" : st === "slider" ? mixHex(bg, ink, 0.14) : ink);
			const shape = el("div", "", cam);
			set(shape, { position: "absolute", overflow: "hidden", boxShadow: `0 ${px(24 * S)} ${px(60 * S)} rgba(0,0,0,0.16)` });
			const layer = (st, index) => {
				const c = el("div", "", shape);
				set(c, { position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", gap: px(controls.space(2)), color: onInk, whiteSpace: "nowrap" });
				const d = MORPH[st];
				const ctl = { c, st };
				if (st === "button") {
					controls.apply(c,"button");
					const label=el("div","",c,s.label??"→");
					set(label,{maxWidth:`calc(100% - ${px(button.paddingX*2)})`});
					controls.truncateLine(label);label.title=s.label??"→";
				} else if (st === "loader") {
					c.innerHTML = `<svg viewBox="0 0 50 50" width="${(80 * k).toFixed(0)}" height="${(80 * k).toFixed(0)}"><circle cx="25" cy="25" r="19" fill="none" stroke="${alpha(onInk, 0.25)}" stroke-width="5"/><circle cx="25" cy="25" r="19" fill="none" stroke="${onInk}" stroke-width="5" stroke-linecap="round" stroke-dasharray="40 200"/></svg>`;
					ctl.spin = c.querySelector("svg");
				} else if (st === "check") {
					c.innerHTML = `<svg viewBox="0 0 24 24" width="${(84 * k).toFixed(0)}" height="${(84 * k).toFixed(0)}"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="${textOn(accent)}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="24" stroke-dashoffset="24"/></svg>`;
					ctl.path = c.querySelector("path");
				} else if (st === "toggle") {
					const knob = el("div", "", c);
					set(knob, { position: "absolute", top: px(14 * k), width: px(132 * k), height: px(132 * k), borderRadius: "50%", background: "#fff", boxShadow: `0 ${px(6 * k)} ${px(14 * k)} rgba(0,0,0,0.2)` });
					ctl.knob = knob;
				} else if (st === "slider") {
					const fill = el("div", "", c);
					set(fill, { position: "absolute", left: "0", top: "0", bottom: "0", background: accent, borderRadius: px(35 * k) });
					const knob = el("div", "", shape);
					set(knob, { position: "absolute", top: px(-13 * k), width: px(96 * k), height: px(96 * k), borderRadius: "50%", background: "#fff", boxShadow: `0 ${px(8 * k)} ${px(20 * k)} rgba(0,0,0,0.25)` });
					ctl.fill = fill;
					ctl.knob = knob;
				} else if (st === "player") {
					set(c, { justifyContent: "flex-start" });
					controls.surface(c,"card",{density:"compact"});
					MORPH.player.r=controls.box("card",{density:"compact"}).radius/k;
					const btn = el("div", "", c);
					set(btn, { width: px(110 * k), height: px(110 * k), borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" });
					btn.innerHTML = `<svg viewBox="0 0 24 24" width="46%" height="46%"><path d="M7 5l12 7-12 7z" fill="${textOn(accent)}"/></svg>`;
					const col = el("div", "", c);
					set(col, { flex: "1", minWidth:"0", display: "flex", flexDirection: "column", gap: px(controls.space(2)) });
					const t = el("div", "", col, plan.brand?.name ?? "Launch film");
					controls.apply(t,"controlLabel");
					controls.truncateLine(t);t.title=plan.brand?.name??"Launch film";
					const bar = el("div", "", col);
					set(bar, { height: px(10 * k), borderRadius: px(5 * k), background: alpha(onInk, 0.2), position: "relative", overflow: "hidden" });
					const fillBar = el("div", "", bar);
					set(fillBar, { position: "absolute", left: "0", top: "0", bottom: "0", background: onInk, borderRadius: px(5 * k) });
					ctl.prog = fillBar;
				} else if (st === "tabs") {
					const ind = el("div", "", c);
					set(ind, { position: "absolute", top: px(14 * k), height: px(96 * k), borderRadius: px(48 * k), background: accent });
					const tabW = (d.w * k - 28 * k) / 3;
					["Write", "Edit", "Export"].forEach((name, i) => {
						const t = el("div", "", c, name);
						set(t, { position: "absolute", left: px(14 * k + i * tabW), width: px(tabW), textAlign: "center", zIndex: "1" });
						controls.apply(t,"button");
						controls.truncateLine(t);t.title=name;
					});
					ctl.ind = ind;
					ctl.tabW = tabW;
				} else if (st === "search") {
					set(c, { justifyContent: "flex-start", color: "#15161a" });
					const field=controls.surface(c,"field");
					MORPH.search.r=field.radius/k;
					const kbd = el("div", "mono", c, "⌘K");
					controls.apply(kbd,"code");
					set(kbd, { background: "#efeff2", color: "#50525c" });
					controls.surface(kbd,"badge",{density:"compact"});
					const q = el("div", "", c);
					controls.apply(q,"body");
					const query = s.text ?? plan.brand?.name ?? "";
					const qw = d.w * k - field.paddingX * 2 - kbd.offsetWidth - field.gap;
					set(q, { width: px(qw), minWidth: '0', flex: 'none' });
					ctl.typing = createTyping(K, q, { text: query, id: `morph.search.${index}` });
					// Keep the public maximum query readable inside the same surface.
					// Its full reserved layout may use two lines; keys only reveal ink.
					controls.fitSize(q, qw, MORPH_SHAPES.search.h * k, 'body');
					d.h=Math.max(d.h,(q.offsetHeight+field.paddingY*2)/k);
					ctl.typing.measure();
				} else if (st === "toast") {
					controls.surface(c,"badge",{density:"comfortable",shape:"pill"});
					const dot = el("div", "", c);
					set(dot, { width: px(76 * k), height: px(76 * k), borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" });
					dot.innerHTML = `<svg viewBox="0 0 24 24" width="60%" height="60%"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="${textOn(accent)}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
					const t = el("div", "", c, s.text ?? "");
					controls.apply(t,"body");
					set(t,{flex:"1"});controls.truncateLine(t);t.title=s.text??"";
				}
				return ctl;
			};
			const layers = states.map(layer);
			const cursor = makeCursor(cam, 84 * S);
			// Springs summed per target change keep every property a pure function of time.
			const chain = (get) => (l) => {
				let v = get(states[0]);
				for (let i = 1; i < states.length; i++) v += (get(states[i]) - get(states[i - 1])) * spring(l - marks[i], 3.1, 0.62);
				return v;
			};
			const wOf = chain((st) => MORPH[st].w * k);
			const hOf = chain((st) => MORPH[st].h * k);
			const rOf = chain((st) => MORPH[st].r * k);
			const cx = W / 2;
			const cy = H / 2;
			/** Where the cursor acts in a state, in stage coordinates (the shape is centred). */
			const actionPoint = (st) => {
				const d = MORPH[st];
				if (st === "toggle") return { x: cx - d.w * k * 0.22, y: cy };
				if (st === "slider") return { x: cx - d.w * k * 0.38, y: cy };
				if (st === "player") return { x: cx - d.w * k * 0.5 + 99 * k, y: cy };
				if (st === "tabs") return { x: cx + (d.w * k) / 3, y: cy };
				return { x: cx, y: cy };
			};
			const sliderValue = (l, i) => {
				const span = (i + 1 < states.length ? marks[i + 1] : p.dur) - marks[i];
				return lerp(0.12, 0.88, cubicInOut(prog(l - marks[i], span * 0.18, span * 0.55)));
			};
			return (l) => {
				const w = wOf(l);
				const h = hOf(l);
				const z = clamp(Math.min((W * 0.62) / Math.max(1, w), (H * 0.5) / Math.max(1, h)), 1, 1.9) * (1 + 0.06 * (l / p.dur));
				set(cam, { transform: `translate(${px((W * (1 - z)) / 2)}, ${px((H * (1 - z)) / 2)}) scale(${z.toFixed(4)})` });
				let cur = 0;
				for (let i = 0; i < states.length; i++) if (l >= marks[i]) cur = i;
				const col = cur === 0 ? solid(states[0]) : mixHex(solid(states[cur - 1]), solid(states[cur]), clamp((l - marks[cur]) / 0.18));
				set(shape, {
					left: px(cx - w / 2),
					top: px(cy - h / 2),
					width: px(Math.max(10, w)),
					height: px(Math.max(10, h)),
					borderRadius: px(Math.max(0, rOf(l))),
					background: col,
					overflow: states[cur] === "slider" ? "visible" : "hidden",
				});
				layers.forEach((ctl, i) => {
					const start = marks[i];
					const end = i + 1 < states.length ? marks[i + 1] : Infinity;
					const a = clamp((l - start - 0.08) / 0.12) * (1 - clamp((l - end + 0.02) / 0.08));
					set(ctl.c, { opacity: a.toFixed(3), filter: a < 0.99 ? `blur(${((1 - a) * 10 * S).toFixed(2)}px)` : "none", visibility: a > 0 ? "visible" : "hidden" });
					if (ctl.knob && ctl.st === "slider") set(ctl.knob, { visibility: a > 0 ? "visible" : "hidden", opacity: a.toFixed(3) });
					// Hidden states still receive their canonical time-derived values.
					// Otherwise reverse seeking retains a later spinner/knob/text state.
					const local = l - start;
					const span = (end === Infinity ? p.dur : end) - start;
					if (ctl.spin) ctl.spin.style.transform = `rotate(${(local * 540).toFixed(1)}deg)`;
					if (ctl.path) ctl.path.setAttribute("stroke-dashoffset", String((1 - expoOut(prog(local, 0.08, 0.3))) * 24));
					if (ctl.st === "toggle") set(ctl.knob, { left: px(lerp(14 * k, MORPH.toggle.w * k - 146 * k, spring(local - span * 0.35, 3, 0.6))) });
					if (ctl.st === "slider") {
						const v = sliderValue(l, i);
						set(ctl.fill, { width: px(v * MORPH.slider.w * k) });
						set(ctl.knob, { left: px(v * MORPH.slider.w * k - 48 * k) });
					}
					if (ctl.prog) set(ctl.prog, { width: `${(prog(local, 0.1, span) * 100).toFixed(2)}%` });
					if (ctl.ind) set(ctl.ind, { left: px(14 * k + ctl.tabW * lerp(0, 2, spring(local - span * 0.25, 2.6, 0.7))), width: px(ctl.tabW) });
					if (ctl.typing) {
						const q = s.text ?? plan.brand?.name ?? "";
						ctl.typing.reveal(Math.round(clamp((local - 0.1) / Math.max(0.2, span * 0.6)) * q.length));
					}
				});
				// The cursor acts on the current state, then clicks into the next one on its beat.
				const next = cur + 1 < states.length ? cur + 1 : -1;
				const st = states[cur];
				const ap = actionPoint(st);
				if (st === "slider") {
					const x = cx - (MORPH.slider.w * k) / 2 + sliderValue(l, cur) * MORPH.slider.w * k;
					cursor(l, { fx: x, fy: cy, x, y: cy, start: marks[cur], arrive: marks[cur] + 0.01, click: marks[cur] + 0.15, ringColor: alpha(accent, 0.9) });
				} else if (next >= 0) {
					const from = cur > 0 ? actionPoint(states[cur - 1]) : { x: cx + 300 * S, y: cy + 260 * S };
					cursor(l, { fx: from.x, fy: from.y, x: ap.x, y: ap.y, start: marks[cur] + 0.05, arrive: marks[next] - 0.08, click: marks[next], ringColor: alpha(accent, 0.9) });
				} else cursor(l, { fx: ap.x, fy: ap.y, x: ap.x + 260 * S, y: ap.y + 240 * S, start: marks[cur] + 0.2, arrive: marks[cur] + 0.9, click: 1e9 });
			};
		};
}
