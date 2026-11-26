// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../../typing.mjs';
export const factory = ({ p, cam, fg, accent, palette, K }) => {
	const { W, H, S, el, set, px, spring, clamp, prog, expoOut, images, mockUI, lerp, cubicInOut } = K;
	const s = p.scene;
	const D=K.design;
	const img = s.image ? images[s.image] : null;
	const vertical = H > W * 1.2;
	const ww = vertical ? W * 0.92 : W * 0.74;
	const wh = vertical ? H * 0.6 : ww * 0.6;
	const toolbar=D,control=toolbar.control("button"),barH=toolbar.space(7)+toolbar.space(1);
	const win = el("div", "card", cam);
	set(win, { left: px((W - ww) / 2), top: px((H - wh) / 2), width: px(ww), height: px(wh), background: "#ffffff", boxShadow: `0 ${px(50 * S)} ${px(110 * S)} rgba(0,0,0,0.28)` });
	D.surface(win,"card",{layout:"frame",purpose:"window"});
	const bar = el("div", "", win);
	set(bar, { height: px(barH), background: "#efedea", display: "flex", alignItems: "center", gap: px(toolbar.space(2)), padding: `0 ${px(toolbar.space(3))}` });
	for (const c of ["#ff5f57", "#febc2e", "#28c840"]) {
		const d = el("div", "", bar);
		set(d, { width: px(18 * S), height: px(18 * S), borderRadius: "50%", background: c, flex: "none" });
	}
	const url = el("div", "", bar);
	set(url, { flex: "1", minWidth: "0", marginLeft: px(toolbar.space(2)), height: px(control.height), background: "#ffffff", display: "flex", alignItems: "center", color: "#222" });
	toolbar.surface(url,"field",{density:"compact"});
	toolbar.apply(url,"controlLabel");
	const lock = el("span", "", url, "🔒 ");
	set(lock, { marginRight: px(toolbar.space(1)), flex: "none" });
	const viewport=el('div','',url);
	viewport.dataset.typingViewport='browser-url';
	viewport.dataset.layoutFitAnchor='browser-url-viewport';
	set(viewport,{position:'relative',flex:'1',minWidth:'0',height:px(toolbar.type('controlLabel').lineHeight),overflow:'hidden'});
	const flow=el('div','',viewport);
	flow.dataset.typingScroll='browser-url';
	set(flow,{position:'relative',width:'max-content',whiteSpace:'pre'});
	const caret = el("span", "caret", flow);
	set(caret, { width: px(3 * S), height: px(32 * S), background: accent, marginLeft: px(3*S) });
	const typing=createTyping(K,flow,{text:s.url,caret,unit:'utf16',id:'browser-url'});
	typing.measure();
	const contentWidth=flow.offsetWidth+caret.offsetWidth+3*S;
	const loadBar = el("div", "", win);
	set(loadBar, { height: px(5 * S), background: accent, width: "0" });
	const page = el("div", "", win);
	set(page, { position: "absolute", left: "0", right: "0", top: px(barH+5*S), bottom: "0", overflow: "hidden" });
	if (img) {
		const im = el("img", "fill", page);
		im.src = img.src;
	} else mockUI(page, palette, accent, p.index);
	const typeEnd = p.dur * 0.42;
	const loadAt = typeEnd + 0.12;
	return (l) => {
		const e = spring(l, 2.2, 0.7);
		set(win, { transform: `scale(${(0.88 + 0.12 * e).toFixed(4)})`, opacity: clamp(l / 0.1).toFixed(3) });
		const n = Math.round(clamp((l - 0.15) / Math.max(0.2, typeEnd - 0.15)) * s.url.length);
		typing.reveal(n);
		const insertion=typing.caretAt(n),end=insertion.x+caret.offsetWidth+3*S;
		const scroll=Math.max(0,Math.min(contentWidth-viewport.clientWidth,end-viewport.clientWidth));
		set(flow,{transform:`translateX(${px(-scroll)})`});
		set(caret, { opacity: (1 - clamp((l - loadAt) / 0.08)).toFixed(3) });
		const lk = prog(l, loadAt, 0.5);
		set(loadBar, { width: `${(cubicInOut(lk) * 100).toFixed(1)}%`, opacity: (1 - K.smooth((l - loadAt - 0.45) / 0.15)).toFixed(3) });
		const pk = expoOut(prog(l, loadAt + 0.25, 0.6));
		// Once loaded, a slow push into the page (from its top edge), so the hold keeps moving.
		const kb = 1 + 0.05 * clamp((l - loadAt - 0.25) / Math.max(0.8, p.dur - loadAt));
		set(page, { opacity: pk.toFixed(3), transformOrigin: "50% 0", transform: `translateY(${px((1 - pk) * 60 * S)}) scale(${kb.toFixed(4)})` });
		void lerp;
	};
};

