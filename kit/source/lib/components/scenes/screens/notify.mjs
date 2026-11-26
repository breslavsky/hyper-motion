// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
// ---- notifications ------------------------------------------------------------------------
export const factory = ({ p, cam, fg, palette, K }) => {
	const { W, H, S, el, set, px, spring, clamp, textOn, lum } = K;
	const s = p.scene;
	const D=K.design;
	const marks = p.marks; // when each part lands: components/scene-moments.cjs
	const vertical = H > W * 1.2;
	const w = vertical ? W * 0.9 : Math.min(W * 0.58, 1160 * S);
	const dark = lum(fg) > 0.5;
	const colors = [palette.electric, palette.coral, palette.lime, palette.peach, palette.sage];
	const cards = s.items.map((it, i) => {
		const c = el("div", "", cam);
		set(c, { position: "absolute", left: px((W - w) / 2), width: px(w), boxSizing: "border-box", background: dark ? "rgba(40,40,46,0.82)" : "rgba(255,255,255,0.86)", backdropFilter: `blur(${px(20 * S)})`, boxShadow: `0 ${px(24 * S)} ${px(60 * S)} rgba(0,0,0,0.18)`, display: "flex", gap: px(D.space(2)), alignItems: "center", color: dark ? "#fff" : "#111" });
		D.surface(c,"card",{density:"compact"});
		const ic = el("div", "", c, it.app.charAt(0).toUpperCase());
		const col = colors[i % colors.length];
		set(ic, { width: px(108 * S), height: px(108 * S), borderRadius: px(D.radius(4)), background: col, color: textOn(col), display: "flex", alignItems: "center", justifyContent: "center", flex: "none" });
		D.apply(ic,"initials");
		const txt = el("div", "", c);
		set(txt, { flex: "1", minWidth: "0" });
		const top = el("div", "", txt);
		set(top, { display: "flex", justifyContent: "space-between", opacity: "0.6" });
		D.apply(top,"meta");
		const appName=el("span", "", top, it.app.toUpperCase());
		set(appName,{display:"block",flex:"1"});D.truncateLine(appName);appName.title=it.app.toUpperCase();
		// No time beside the app's name: "now" was the kit's own English.
		const t = el("div", "", txt, it.title);
		D.apply(t,"cardTitle");
		set(t, { marginTop: px(D.space(1)) });
		if (it.body) {
			const b = el("div", "", txt, it.body);
			D.apply(b,"body");
			set(b, { opacity: "0.8", marginTop: px(D.space(1)) });
		}
		return c;
	});
	const hs = cards.map((c) => c.offsetHeight + D.space(2));
	return (l) => {
		// Newest on top: each arrival pushes the stack down.
		const order=cards.map((_,i)=>i).reverse(),visible=new Set();
		let stackHeight=0;
		for(const i of order){if(l<marks[i])continue;if(stackHeight+hs[i]>K.safe.h&&visible.size)break;visible.add(i);stackHeight+=hs[i];}
		const y=K.safe.y+(K.safe.h-stackHeight)/2;
		let offset = 0;
		for (const i of order) {
			const k = spring(l - marks[i], 2.8, 0.62);
			const on = visible.has(i);
			const bob = Math.sin(l * 1.5 + i * 1.1) * 5 * S * clamp((l - marks[i] - 0.5) / 0.6);
			set(cards[i], { top: px(y + offset), transform: `translateY(${px((1 - k) * -H * 0.35 + bob)}) scale(${(0.92 + 0.08 * k).toFixed(4)})`, opacity: on ? clamp((l - marks[i]) / 0.08).toFixed(3) : "0" });
			if (on) offset += hs[i] * Math.min(1, k);
		}
	};
};

