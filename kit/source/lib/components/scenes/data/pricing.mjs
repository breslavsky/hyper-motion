// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {compact} from '../_shared/charts.mjs';
export const factory = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, expoOut, prog, clamp, spring, alpha, textOn, makeCursor } = K;
	const s = p.scene;
	const vertical = H >= W;
	const featureWidth = Math.max(...s.features.map(copy=>{
        const probe=el('span','',cam,copy);K.design.apply(probe,'body');
        set(probe,{position:'absolute',whiteSpace:'nowrap'});
        const width=probe.scrollWidth;probe.remove();return width;
    }));
    const minimumWidth=featureWidth+K.design.space(4)*2+48*S+K.design.space(2)+K.design.space(1);
    const cw = Math.min(K.safe.w,Math.max(vertical?W*.84:Math.min(W*.42,860*S),minimumWidth));
	const card = el("div", "card", cam);
	const cardBg = textOn(fg) === "#111111" ? "#ffffff" : "#111111";
	const ink = textOn(cardBg);
	set(card, { width: px(cw), left: px((W - cw) / 2), background: cardBg, color: ink, boxShadow: `0 ${px(50 * S)} ${px(110 * S)} rgba(0,0,0,0.25)`, display: "flex", flexDirection: "column" });
	const cardBox=K.design.surface(card,'card',{density:s.features.length>=5?'compact':'normal'});
    const name = el("div", "mono", card, s.name);
	set(name, { opacity: "0.7" }); K.design.apply(name, 'label');
	K.design.truncateLine(name);name.title = s.name;
	const priceRow = el("div", "", card);
	set(priceRow, { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: px(K.design.space(1)) });
	const price = el("div", "display", priceRow, `$${s.price}`);
	// Rolling digits after the "$" (sized and fitted as the final price first).
	const rollPriceAfterFit = () => {
		price.textContent = "$";
		return K.odometer(el("span", "", price), String(s.price));
	};
	set(price, { color: ink, whiteSpace: "nowrap", flex: "none", fontVariantNumeric: "tabular-nums" }); K.design.fitLine(price,cw-K.design.space(4)*2,K.safe.h*.15,'display');
	const per = el("div", "bold", priceRow, s.period ?? "");
	set(per, { opacity: "0.6" }); K.design.apply(per, 'caption');
	set(per, { maxWidth: px(cw-cardBox.paddingX*2) });K.design.truncateLine(per);per.title = s.period ?? "";
	const featureH=(K.safe.h-cardBox.paddingY*2-name.offsetHeight-priceRow.offsetHeight-K.design.control('button').height-cardBox.gap*(s.features.length+2)-K.design.space(1))/s.features.length;
	const feats = s.features.map((f) => {
		const r = el("div", "", card);
		set(r, { display: "flex", alignItems: "center", gap: px(K.design.space(2)) }); K.design.apply(r, 'body');
		const ck = el("div", "", r);
		set(ck, { width: px(48 * S), height: px(48 * S), borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" });
		ck.innerHTML = `<svg viewBox="0 0 24 24" width="62%" height="62%"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="${textOn(accent)}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
		const label=el("div", "", r, f);
        K.design.fitSize(label,cw-K.design.space(4)*2-48*S-K.design.space(2),Math.min(K.design.type('body').lineHeight*2,featureH),'body');
		return r;
	});
	const btn = el("div", "", card);
	set(btn, { marginTop: px(K.design.space(1)), height: px(110 * S), borderRadius: px(K.design.radius(6)), background: accent, color: textOn(accent), display: "flex", alignItems: "center", justifyContent: "center" }); K.design.apply(btn, 'button');
			btn.dataset.designControl='button';btn.dataset.designControlLayout='stretch';
			const control = K.design.control('button');
			set(btn, {height: px(control.height), minHeight: px(control.height), boxSizing: 'border-box', padding: `${px(control.paddingY)} ${px(control.paddingX)}`, borderRadius: px(control.radius), flex: 'none'});
	const buttonLabel = el("div", "", btn, s.cta ?? "→");
	set(buttonLabel, { maxWidth: "100%", textAlign: "center" });
	K.design.truncateLine(buttonLabel);buttonLabel.title = s.cta ?? "→";
	const cursor = makeCursor(cam, 80 * S);
	const chH = card.offsetHeight;
	const top = (H - chH) / 2;
	const clickAt = p.dur * 0.78;
	let rollPrice = null;
	return (l) => {
		const e = spring(l, 2.4, 0.65);
		// Once landed the card floats a little, so it never sits frozen.
		const fl = clamp((l - 0.8) / 0.6);
		set(card, { top: px(top), transform: `translateY(${px((1 - e) * H * 0.5 + Math.sin(l * 1.4) * 6 * S * fl)}) rotate(${((1 - e) * -6 + Math.sin(l * 0.9) * 0.6 * fl).toFixed(3)}deg)`, opacity: clamp(l / 0.1).toFixed(3) });
		const pk = expoOut(prog(l, 0.15, 0.9));
		rollPrice ??= rollPriceAfterFit();
		rollPrice(s.price * pk);
		feats.forEach((r, i) => {
			const k = spring(l - 0.45 - i * 0.12, 3, 0.6);
			set(r, { opacity: clamp((l - 0.45 - i * 0.12) / 0.08).toFixed(3), transform: `translateX(${px((1 - k) * 40 * S)})` });
		});
		// A press that dips and springs back over a few frames rather than snapping.
		const press = Math.sin(Math.PI * prog(l, clickAt - 0.03, 0.22));
		set(btn, { transform: `scale(${(1 - 0.05 * press).toFixed(4)})`, filter: press > 0.01 ? `brightness(${(1 - 0.08 * press).toFixed(3)})` : "none" });
		const bx = W / 2;
		const by = top + chH - 56 * S - 55 * S;
		cursor(l, { fx: bx + 300 * S, fy: by + 260 * S, x: bx + 60 * S, y: by, start: clickAt - 0.55, arrive: clickAt - 0.05, click: clickAt, ringColor: alpha(accent, 0.9) });
	};
};

