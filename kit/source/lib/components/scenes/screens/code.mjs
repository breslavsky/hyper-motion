// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../../typing.mjs';
// ---- code -------------------------------------------------------------------------------
const KEYWORDS = /\b(import|from|export|const|let|var|function|return|await|async|if|else|for|while|new|class|def|print|true|false|null|undefined)\b/g;
/** Minimal syntax colouring: strings, comments, numbers, keywords. Returns [text, colour] runs. */
const tokenize = (line, theme) => {
	const runs = [];
	const re = /(\/\/.*$|#.*$|"[^"]*"|'[^']*'|`[^`]*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b|\s+|.)/gu;
	for (const m of line.matchAll(re)) {
		const t = m[0];
		let c = theme.text;
		if (/^(\/\/|#)/.test(t)) c = theme.comment;
		else if (/^["'`]/.test(t)) c = theme.string;
		else if (/^\d/.test(t)) c = theme.number;
		else if (KEYWORDS.test(t)) c = theme.keyword;
		KEYWORDS.lastIndex = 0;
		runs.push([t, c]);
	}
	return runs;
};
export const factory = ({ p, cam, accent, K }) => {
	const { W, H, S, safe, el, set, px, spring, clamp, hash } = K;
	const s = p.scene;
	const D=K.design;
	const theme = { bg: "#0f1117", bar: "#171a22", text: "#e6e8ef", comment: "#9aa0ad", string: "#a5e36b", number: "#ffb86b", keyword: "#ff6bb0" };
	// A code sample is read at a stable size. Long rows wrap and complete rows
	// advance between pages; the renderer never shrinks an entire document.
	const fs = D.type("code").size, ww = safe.w * .98;
	const codePad=D.box("card",{density:"compact"}).paddingX;
	const win = el("div", "card", cam);
	set(win, { width: px(ww), left: px(safe.x + (safe.w - ww) / 2), background: theme.bg, boxShadow: `0 ${px(50 * S)} ${px(120 * S)} rgba(0,0,0,0.45), 0 0 0 ${px(1.5 * S)} rgba(255,255,255,0.06)`, color: theme.text });
	D.surface(win,"card",{density:"compact",layout:"frame",purpose:"window"});
	win.dataset.codePages = '';
	const bar = el("div", "", win);
	set(bar, { minHeight: px(D.control("button").height), background: theme.bar, display: "flex", alignItems: "center", gap: px(D.space(2)), padding: `${px(D.space(2))} ${px(D.space(3))}` });
	for (const c of ["#ff5f57", "#febc2e", "#28c840"]) {
		const d = el("div", "", bar);
		set(d, { width: px(18 * S), height: px(18 * S), borderRadius: "50%", background: c, flex: "none" });
	}
	const title = el("div", "", bar, s.title ?? "");
	set(title, { marginLeft: px(D.space(2)), color: "#b8bdc9", flex: "1", minWidth: "0", overflowWrap: "anywhere" });
	D.apply(title,"code");
	D.truncateLine(title);title.title=s.title??"";
	const viewport = el("div", "", win);
	set(viewport, { position: "relative" });
	D.surface(viewport,"card",{density:"compact",shape:"square"});
	const body = el("div", "", viewport);
	set(body, { position: "relative" });
	D.apply(body,"code");
	const rows = s.lines.map((text, i) => {
		const r = el("div", "", body);r.dataset.codeLine = String(i);
		set(r, { display: "flex", minHeight: px(D.type("code").lineHeight), alignItems: "flex-start" });
		const no = el("span", "", r, String(i + 1).padStart(2, " "));
		set(no, { color: "#9aa0ad", width: "2ch", marginRight: px(D.space(2)), flex: "none", whiteSpace: "pre" });
		const code = el("span", "", r);
		set(code, { flex: "1", minWidth: "0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" });
		for (const [t, c] of tokenize(text, theme)) {
			const sp = el("span", "", code);sp.textContent=t;sp.style.color = c;
		}
		const typing=createTyping(K,code,{unit:'utf16',emojify:false,id:`code-line-${i}`});
		return { r, code, typing, len: text.length, height: r.offsetHeight };
	});
	const available = Math.max(fs * 3, safe.h * .94 - bar.offsetHeight - codePad * 2);
	const pages = [];let page = { rows: [], height: 0, from: 0, chars: 0 }, total = 0;
	for (const row of rows) {
		if (page.rows.length && page.height + row.height > available) { pages.push(page);page = { rows: [], height: 0, from: total, chars: 0 }; }
		page.rows.push(row);page.height += row.height;page.chars += row.len;total += row.len;
		// Fix the fully wrapped height while only a prefix is being typed.
		row.r.style.minHeight = px(row.height);
	}
	pages.push(page);
	const bodyHeight = Math.max(...pages.map(x => x.height));body.style.height = px(bodyHeight);
	for(const row of rows)row.typing.measure();
	const hgt = bar.offsetHeight + bodyHeight + codePad * 2;
	const caret = el("span", "caret", body);
	set(caret, { width: ".08em", height: "1.15em", background: accent, position: "absolute", pointerEvents: "none" });
	const typeEnd = p.dur * .82;
	return (l) => {
		const e = spring(l, 2.2, .7);
		set(win, { top: px(safe.y + (safe.h - hgt) / 2), transform: `perspective(${px(2400 * S)}) rotateX(${((1 - e) * 22).toFixed(2)}deg) translateY(${px((1 - e) * 120 * S)})`, opacity: clamp(l / .1).toFixed(3) });
		const count = Math.min(total,Math.floor(clamp((l - .25) / Math.max(.3,typeEnd - .25)) * total + hash(Math.floor(l * 12)) * .5));
		const active = Math.max(0,pages.findLastIndex(page => count > page.from));
		win.dataset.codePage = String(active);win.dataset.codePageCount = String(pages.length);
		let caretAt = null;
		for (const [index,page] of pages.entries()) {
			let budget = Math.max(0,count - page.from);
			for (const row of page.rows) {
				row.r.style.display = index === active ? "flex" : "none";
				const n=Math.max(0,Math.min(row.len,budget));
				row.typing.reveal(n);budget-=row.len;
				if(index===active&&n>0)caretAt={row,n};
			}
		}
		if (caretAt) {
			const {row,n}=caretAt,point=row.typing.caretAt(n);
			set(caret, { left: px(row.code.offsetLeft+point.x+3*S), top: px(row.code.offsetTop+point.y), opacity: Math.floor(l * 3) % 2 && l > typeEnd ? "0" : "1" });
		} else set(caret, { left: "0px", top: "0px", opacity: "0" });
	};
};

