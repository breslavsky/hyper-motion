// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../typing.mjs';
const sceneFactories = {};

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
sceneFactories.code = ({ p, cam, accent, K }) => {
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

// ---- chat -------------------------------------------------------------------------------
sceneFactories.chat = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, spring, clamp, textOn, alpha, prog, expoOut } = K;
	const s = p.scene;
	const D=K.design;
	const marks = p.marks ?? s.messages.map((_, i) => 0.2 + i * p.beatLen * 1.5);
	const vertical = H > W * 1.2;
	const colW = vertical ? W * 0.88 : Math.min(W * 0.62, 1240 * S);
	const col = el("div", "", cam);
	set(col, { position: "absolute", left: px((W - colW) / 2), width: px(colW), display: "flex", flexDirection: "column", gap: px(D.space(3)) });
	D.surfaceGap(col,3);
	const them = alpha(fg, 0.1);
	const bubbles = s.messages.map((m) => {
		const row = el("div", "", col);
		set(row, { display: "flex", justifyContent: m.me ? "flex-end" : "flex-start" });
		const b = el("div", "", row, m.text);
		set(b, { maxWidth: "80%", background: m.me ? accent : them, color: m.me ? textOn(accent) : fg, transformOrigin: m.me ? "100% 100%" : "0 100%" });
		D.surface(b,"field",{shape:"pill"});
		D.apply(b,"body");
		// Typing dots before their messages.
		let dots = null;
		if (!m.me) {
			dots = el("div", "", row);
			set(dots, { position: "absolute", background: them, display: "flex" });
			D.surface(dots,"field",{shape:"pill"});
			for (let i = 0; i < 3; i++) {
				const d = el("div", "", dots);
				set(d, { width: px(20 * S), height: px(20 * S), borderRadius: "50%", background: alpha(fg, 0.55) });
			}
		}
		return { row, b, dots };
	});
	const heights = bubbles.map((x) => x.row.offsetHeight + D.space(3));
	return (l) => {
		let shown = 0;
		let newest=bubbles.findLastIndex((_,i)=>l>=marks[i]);
		const next=newest+1;
		// Typing may reserve spare room, but cannot replace a message before
		// that message has appeared on its own authored event.
		if(next<bubbles.length&&bubbles[next].dots&&l>=marks[next]-.45&&
			(newest<0||heights[newest]+heights[next]<=K.safe.h))newest=next;
		let first=Math.max(0,newest),capacity=0;
		for(let i=newest;i>=0;i--){if(capacity+heights[i]>K.safe.h&&i<newest)break;capacity+=heights[i];first=i;}
		bubbles.forEach(({ row, b, dots }, i) => {
			const at = marks[i];
			const typing = dots && l >= at - 0.45 && l < at;
			const k = K.ease.softLand(prog(l, at, 0.32));
			const on = l >= at;
			const inWindow=i>=first&&i<=newest;
			set(row, { display: inWindow&&(on || typing) ? "flex" : "none" });
			// Landed bubbles bob a little, out of step with each other, so the thread feels alive.
			const bob = Math.sin(l * 1.6 + i * 1.3) * 4 * S * clamp((l - at - 0.4) / 0.6);
			set(b, { visibility: on ? "visible" : "hidden", transform: `translateY(${px(bob + (1 - k) * 26 * S)}) scale(${(1.1 - 0.1 * k).toFixed(4)})`, opacity: K.smooth((l - at) / 0.08).toFixed(3) });
			// The typing row eases the conversation up as it appears, and the message takes over
			// the space the dots already made, so the column never jumps.
			const tk = dots ? K.smooth(prog(l, at - 0.45, 0.24)) : 0;
			if (dots) {
				set(dots, { opacity: (tk * (1 - clamp((l - at) / 0.06))).toFixed(3) });
				[...dots.children].forEach((d, j) => set(d, { transform: `translateY(${px(Math.sin(l * 14 - j) * 5 * S)})` }));
			}
			if (inWindow&&(on || typing)) shown += heights[i] * (dots ? tk : expoOut(prog(l, at, 0.3)));
		});
		set(col, { top: px(K.safe.y+(K.safe.h-shown)/2) });
	};
};

// ---- notifications ------------------------------------------------------------------------
sceneFactories.notify = ({ p, cam, fg, palette, K }) => {
	const { W, H, S, el, set, px, spring, clamp, textOn, lum } = K;
	const s = p.scene;
	const D=K.design;
	const marks = p.marks ?? s.items.map((_, i) => 0.15 + i * p.beatLen);
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

// A dense dock becomes a measured app grid. Labels keep their body-level
// role while the same ordered hover, selection and final dive remain visible.
function denseDock({p,cam,fg,accent,palette,K}){
  const {W,H,S,safe,el,set,px,clamp,lerp,cubicInOut,prog,expoIn,makeCursor,textOn,images,plan}=K;
  const D=K.design,s=p.scene,n=s.apps.length,open=Math.min(n-1,s.open??Math.floor(n/2));
  const gap=D.space(2),pad=D.space(3),cols=H>W*1.2?3:Math.ceil(n/2),rows=Math.ceil(n/cols);
  let cap=null,captionH=0;
  if(s.caption){cap=el("div","display",cam,s.caption);set(cap,{position:"absolute",left:px(safe.x),top:px(safe.y),width:px(safe.w),textAlign:"center",color:fg});D.fitSize(cap,safe.w,safe.h*.3,"sceneTitle");captionH=cap.offsetHeight+D.space(4);}
  const cellW=(safe.w-pad*2-gap*(cols-1))/cols;
  const labelH=D.type("controlLabel").lineHeight;
  const availableH=safe.h-captionH;
  const base=Math.min(120*S,cellW/1.75,(availableH-pad*2-gap*(rows-1)-rows*(labelH+gap))/(rows*1.75));
  if(base<32*S)throw new Error("Dock labels exceed the readable grid capacity");
  const cellH=base*1.75+labelH+gap,gridH=rows*cellH+gap*(rows-1)+pad*2;
  const top=safe.y+captionH+(availableH-gridH)/2;
  const bar=el("div","",cam);
  set(bar,{position:"absolute",left:px(safe.x),top:px(top),width:px(safe.w),height:px(gridH),borderRadius:px(D.radius(5)),background:"rgba(255,255,255,.14)",border:`${px(S)} solid rgba(255,255,255,.25)`});
  D.surface(bar,"card",{density:"compact",layout:"frame",purpose:"device"});
  const colors=[palette.electric,palette.lime,palette.coral,palette.peach,palette.sage,palette.lilac,palette.butter,palette.ink];
  const logo=plan.brand?.logo?images[plan.brand.logo]:null;
  const cells=s.apps.map((name,i)=>{
    const x=safe.x+pad+(i%cols)*(cellW+gap)+cellW/2,y=top+pad+Math.floor(i/cols)*(cellH+gap)+base*1.75;
    const fill=name==="★"?palette.brand:colors[i%colors.length],icon=el("div","",cam);
    set(icon,{position:"absolute",left:px(x-base/2),top:px(y-base),width:px(base),height:px(base),borderRadius:px(D.radius(4)),background:fill,color:textOn(fill),display:"grid",placeItems:"center",transformOrigin:"50% 100%"});
    if(name==="★"&&logo){const im=el("img","",icon);im.src=logo.src;set(im,{width:"70%",height:"70%",objectFit:"contain"});}
    else {const glyph=el("span","",icon,[...(name==="★"?(plan.brand?.name??"K"):name)][0]??"");D.apply(glyph,"initials");glyph.dataset.designGlyphArt="app-icon";}
    const labelText=name==="★"?plan.brand?.name??name:name;
    const label=el("div","",cam,labelText);
    set(label,{position:"absolute",left:px(x-cellW/2),top:px(y+gap),width:px(cellW),textAlign:"center",color:fg});
    D.apply(label,"controlLabel");D.truncateLine(label);label.title=labelText;
    return {icon,label,x,y:y-base/2};
  });
  const cursor=makeCursor(cam,70*S),sweepEnd=p.dur*.5,clickAt=p.dur*.58;
  return l=>{
    const sweep=cubicInOut(prog(l,.1,sweepEnd-.1)),back=cubicInOut(prog(l,sweepEnd,clickAt-sweepEnd-.05));
    const index=lerp((n-1)*sweep,open,back),i=Math.floor(index),j=Math.min(n-1,i+1),fraction=index-i;
    const pointer={x:lerp(cells[i].x,cells[j].x,fraction),y:lerp(cells[i].y,cells[j].y,fraction)};
    const dive=expoIn(prog(l,clickAt+.25,p.dur-clickAt-.25)),labels=1-clamp((l-clickAt-.05)/.15);
    cells.forEach((cell,k)=>{
      const zoom=1+.75*Math.exp(-(((k-index)/1.25)**2))*clamp(l/.2);
      const bounce=k===open&&l>clickAt?Math.abs(Math.sin((l-clickAt)*9))*Math.exp(-(l-clickAt)*3)*50*S:0;
      set(cell.icon,{transform:`translateY(${px(-bounce)}) scale(${zoom.toFixed(5)})`});
      set(cell.label,{opacity:String(labels)});
    });
    cursor(l,{fx:pointer.x,fy:pointer.y,x:pointer.x,y:pointer.y,start:.1,arrive:.11,click:clickAt});
    const z=1+dive*14,focus=cells[open];
    set(cam,{transform:`translate(${px((W/2-focus.x*z)*dive)},${px((H/2-focus.y*z)*dive)}) scale(${z.toFixed(4)})`});
    if(cap)set(cap,{opacity:String(clamp(l/.2)*labels)});
  };
}

// ---- dock ---------------------------------------------------------------------------------
sceneFactories.dock = ({ p, cam, fg, accent, palette, K }) => {
	if(p.scene.apps.length>5)return denseDock({p,cam,fg,accent,palette,K});
	const { W, H, S, el, set, px, spring, clamp, textOn, lerp, cubicInOut, prog, expoIn, makeCursor, images, plan } = K;
	const s = p.scene;
	const D=K.design;
	const n = s.apps.length;
	const open = Math.min(n - 1, s.open ?? Math.floor(n / 2));
	const base = 120 * S * (W > H ? 1 : 0.9);
	const iconDesign=D.forSurface(base/(40*D.unit));
	const gap = iconDesign.space(2);
	const dockW = n * base + (n + 1) * gap;
	const bar = el("div", "", cam);
	set(bar, { position: "absolute", left: px((W - dockW) / 2), top: px(H * 0.62), width: px(dockW), height: px(base + gap * 2), background: "rgba(255,255,255,0.22)", backdropFilter: `blur(${px(24 * S)})`, border: `${px(1.5 * S)} solid rgba(255,255,255,0.35)`, boxShadow: `0 ${px(30 * S)} ${px(80 * S)} rgba(0,0,0,0.25)` });
	D.surface(bar,"card",{density:"compact",layout:"frame",purpose:"device"});
	const cols = [palette.electric, palette.lime, palette.coral, palette.peach, palette.sage, palette.lilac, palette.butter, palette.ink];
	const logo = plan.brand?.logo ? images[plan.brand.logo] : null;
	const icons = s.apps.map((a, i) => {
		const ic = el("div", "", cam);
		const col = a === "★" ? palette.brand : cols[i % cols.length];
		set(ic, { position: "absolute", width: px(base), height: px(base), borderRadius: px(iconDesign.radius(4)), background: col, display: "flex", alignItems: "center", justifyContent: "center", color: textOn(col), boxShadow: `0 ${px(8 * S)} ${px(18 * S)} rgba(0,0,0,0.2)`, transformOrigin: "0 0" });
		if (a === "★" && logo) {
			const im = el("img", "", ic);
			im.src = logo.src;
			set(im, { width: "70%", height: "70%", objectFit: "contain" });
		} else ic.textContent = a === "★" ? (plan.brand?.name ?? "K").charAt(0) : a;
		iconDesign.apply(ic,"initials");
		return { ic, col };
	});
	let cap = null;
	if (s.caption) {
		cap = el("div", "display", cam, s.caption);
		set(cap, { position: "absolute", left: "0", right: "0", top: px(H * 0.2), textAlign: "center", color: fg, margin: "0 auto" });
		D.fitSize(cap, W * 0.84, H * 0.2, "sceneTitle");
	}
	const cursor = makeCursor(cam, 70 * S);
	const sweepEnd = p.dur * 0.5;
	const clickAt = p.dur * 0.58;
	const centers = icons.map((_, i) => (W - dockW) / 2 + gap + i * (base + gap) + base / 2);
	const dockY = H * 0.62 + gap + base / 2;
	return (l) => {
		// The cursor sweeps left to right, then comes back to the app it opens.
		const sweep = cubicInOut(prog(l, 0.1, sweepEnd - 0.1));
		const back = cubicInOut(prog(l, sweepEnd, clickAt - sweepEnd - 0.05));
		const mx = lerp(lerp(centers[0] - base, centers[n - 1] + base * 0.5, sweep), centers[open], back);
		let x = (W - dockW) / 2 + gap;
		const scales = icons.map((_, i) => 1 + 0.75 * Math.exp(-(((centers[i] - mx) / (base * 1.25)) ** 2)) * clamp(l / 0.2));
		const total = scales.reduce((a, k) => a + k * base, 0) + (n - 1) * gap;
		x = W / 2 - total / 2;
		icons.forEach(({ ic }, i) => {
			const k = scales[i];
			const bounce = i === open && l > clickAt ? Math.abs(Math.sin((l - clickAt) * 9)) * Math.exp(-(l - clickAt) * 3) * 50 * S : 0;
			set(ic, { left: px(x), top: px(dockY + base / 2 - base * k - bounce), transform:`scale(${k.toFixed(5)})` });
			x += base * k + gap;
		});
		set(bar, { left: px(W / 2 - total / 2 - gap), width: px(total + gap * 2) });
		cursor(l, { fx: mx, fy: dockY + base * 0.35, x: mx, y: dockY + base * 0.35, start: 0.1, arrive: 0.11, click: clickAt });
		// Then the camera dives into the opened app until its colour fills the frame.
		const dive = expoIn(prog(l, clickAt + 0.25, p.dur - clickAt - 0.25));
		const z = 1 + dive * 14;
		const fx = centers[open];
		const fy = dockY;
		set(cam, { transform: `translate(${px(W / 2 - fx * z + (fx - W / 2) * (1 - dive))}, ${px(H / 2 - fy * z + (fy - H / 2) * (1 - dive))}) scale(${z.toFixed(4)})` });
		if (cap) set(cap, { opacity: (clamp(l / 0.2) * (1 - dive)).toFixed(3) });
		void spring;
		void accent;
	};
};

// ---- tab chaos ------------------------------------------------------------------------------
sceneFactories.chaos = ({ p, cam, fg, palette, K }) => {
	const { W, H, S, el, set, px, spring, clamp, hash, images, alpha, expoOut, prog } = K;
	const s = p.scene;
	const D=K.design;
	const imgs = (s.images ?? []).map((u) => images[u]).filter(Boolean);
	const n = 14;
	const cols = [palette.electric, palette.coral, palette.lime, palette.peach, palette.sage, palette.butter];
	const wins = Array.from({ length: n }, (_, i) => {
		const w = (0.16 + hash(i * 2.1) * 0.1) * W;
		const h = w * 0.66;
		const local=D.forSurface(w/(320*D.unit));
		const ang = (i / n) * Math.PI * 2 + hash(i) * 0.6;
		const rad = 0.3 + hash(i * 4.4) * 0.16;
		const x = W / 2 + Math.cos(ang) * W * rad - w / 2;
		const y = H / 2 + Math.sin(ang) * H * (rad + 0.08) - h / 2;
		const c = el("div", "card", cam);
		set(c, { left: px(x), top: px(y), width: px(w), height: px(h), boxShadow: `0 ${px(20 * S)} ${px(50 * S)} rgba(0,0,0,0.18)`, background: "#fff" });
		local.surface(c,"card",{density:"compact",layout:"frame",purpose:"window"});
		const bar = el("div", "", c);
		set(bar, { height: px(h * 0.12), background: "#eceae6", display: "flex", alignItems: "center", gap: px(local.space(1)), padding: `0 ${px(local.space(2))}` });
		for (const d of ["#ff5f57", "#febc2e", "#28c840"]) {
			const dd = el("div", "", bar);
			set(dd, { width: px(8 * S), height: px(8 * S), borderRadius: "50%", background: d });
		}
		const img = imgs.length ? imgs[i % imgs.length] : null;
		if (img) {
			const im = el("img", "fill", c);
			im.src = img.src;
			set(im, { height: "88%" });
		} else {
			const body = el("div", "", c);
			set(body, { display: "grid", gridTemplateColumns: "1fr 1fr" });
			local.surface(body,"card",{density:"compact",shape:"square"});
			for (let j = 0; j < 4; j++) {
				const b = el("div", "", body);
				set(b, { height: px(h * 0.28), borderRadius: px(local.radius(3)), background: j === 0 ? cols[i % cols.length] : alpha("#000000", 0.07) });
			}
		}
		return { c,x,y,w,h, at: 0.1 + (i / n) * p.dur * 0.6, rot: (hash(i * 9.9) - 0.5) * 24, dx: Math.cos(ang), dy: Math.sin(ang) };
	});
	const text = el("div", "bold", cam, s.text);
	set(text, { position: "absolute", left: "0", right: "0", textAlign: "center", color: fg, zIndex: "5", margin: "0 auto" });
	D.fitSize(text, K.safe.w*.92, K.safe.h*.4, "sceneTitle");
	const th = text.offsetHeight;
	// White windows must not sit behind the headline's white ink. Reserve its
	// measured central band, including the windows' rotated corner extents.
	const bandTop=H/2-th/2-D.space(3),bandBottom=H/2+th/2+D.space(3);
	for(const win of wins){
		const angle=Math.abs(win.rot)*Math.PI/180;
		const halfHeight=(win.h*Math.cos(angle)+win.w*Math.sin(angle))/2;
		const center=win.y+win.h/2;
		if(center+halfHeight>bandTop&&center-halfHeight<bandBottom){
			const target=center<H/2?bandTop-halfHeight:bandBottom+halfHeight;
			set(win.c,{top:px(target-win.h/2)});
		}
	}
	return (l) => {
		for (const w of wins) {
			const k = spring(l - w.at, 2.6, 0.6);
			const on = l >= w.at;
			set(w.c, { opacity: on ? clamp((l - w.at) / 0.06).toFixed(3) : "0", transform: `translate(${px((1 - k) * w.dx * W * 0.5)}, ${px((1 - k) * w.dy * H * 0.5)}) rotate(${(w.rot * (0.4 + 0.6 * k)).toFixed(2)}deg) scale(${(0.6 + 0.4 * k).toFixed(4)})` });
		}
		const tk = expoOut(prog(l, 0.02, 0.5));
		set(text, { top: px(H / 2 - th / 2), opacity: tk.toFixed(3), transform: `scale(${(0.9 + 0.1 * tk).toFixed(4)})` });
	};
};

sceneFactories.laptop = ({ p, cam, fg, accent, palette, K }) => {
	const { W, H, S, el, set, px, spring, clamp, expoInOut, prog, images, mockUI, lerp } = K;
	const s = p.scene;
	const D=K.design;
	const img = s.image ? images[s.image] : null;
	const vertical = H > W * 1.2;
	const sw = vertical ? W * 0.84 : W * (s.caption ? 0.48 : 0.56);
	const sh = sw * 0.625;
	let top = H * (s.caption ? (vertical ? 0.3 : 0.27) : 0.18);
	const lid = el("div", "", cam);
	set(lid, { position: "absolute", left: px((W - sw) / 2 - sw * 0.03), top: px(top), width: px(sw * 1.06), height: px(sh * 1.08), borderRadius: px(sw * 0.03), background: "#1b1c1f", boxShadow: `0 0 0 ${px(2 * S)} #3a3b40 inset` });
	// Hardware proportions define a local design unit; the product UI keeps its own.
	const device=D.forSurface(sw*.03/(16*D.unit));
	device.surface(lid,"card",{layout:"frame",purpose:"device"});
	const screen = el("div", "card", lid);
	set(screen, { left: px(sw * 0.03), top: px(sh * 0.04), width: px(sw), height: px(sh) });
	D.forSurface(sw*.008/(12*D.unit)).surface(screen,"card",{density:"compact",layout:"frame",purpose:"media"});
	if (img) {
		const im = el("img", "fill", screen);
		im.src = img.src;
	} else mockUI(screen, palette, accent, p.index);
	const baseW = sw * 1.32;
	const baseEl = el("div", "", cam);
	set(baseEl, { position: "absolute", left: px((W - baseW) / 2), top: px(top + sh * 1.08), width: px(baseW), height: px(sw * 0.035), background: "linear-gradient(#c9cbd1, #9a9ca3)", borderRadius: `0 0 ${px(sw * 0.04)} ${px(sw * 0.04)}`, boxShadow: `0 ${px(30 * S)} ${px(60 * S)} rgba(0,0,0,0.25)` });
	let cap = null;
	if (s.caption) {
		cap = el("div", "display", cam, s.caption);
		set(cap, { position: "absolute", left: "0", right: "0", top: px(K.safe.y+D.space(3)), textAlign: "center", color: fg, margin: "0 auto" });
		D.fitSize(cap, W * 0.84, K.safe.h*.4, "sceneTitle");
		top=Math.max(top,K.safe.y+D.space(3)+cap.offsetHeight+D.space(4));
		set(lid,{top:px(top)});set(baseEl,{top:px(top+sh*1.08)});
	}
	const scx = W / 2;
	const scy = top + sh * 0.04 + sh / 2;
	const zMax = Math.min(W / sw, H / sh) * 1.02;
	return (l) => {
		const e = spring(l, 2, 0.75);
		const dive = expoInOut(prog(l, p.dur * 0.5, p.dur * 0.45));
		// A slow constant push under the settle and the dive, so the wait between them moves.
		const z = lerp(0.8 + 0.2 * e, zMax, dive) * (1 + 0.05 * clamp(l / p.dur) * (1 - dive));
		const cx = lerp(W / 2, scx, dive);
		const cy = lerp(H / 2, scy, dive);
		set(cam, { transform: `translate(${px(W / 2 - cx * z)}, ${px(H / 2 - cy * z)}) scale(${z.toFixed(4)})` });
		set(lid, { opacity: clamp(l / 0.1).toFixed(3) });
		if (cap) set(cap, { opacity: (clamp(l / 0.2) * (1 - dive)).toFixed(3) });
	};
};

sceneFactories.browser = ({ p, cam, fg, accent, palette, K }) => {
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

/** A product card with tooltip callouts popping out beside it on the beat. */
sceneFactories.callouts = ({ p, cam, fg, accent, palette, K }) => {
	const { W, H, S, el, set, px, spring, clamp, images, mockUI, alpha, expoOut, prog } = K;
	const s = p.scene;
	const D=K.design;
	const marks = p.marks ?? s.notes.map((_, i) => 0.55 + i * p.beatLen);
	const img = s.image ? images[s.image] : null;
	const vertical = W <= H * 1.2;
	const gap=D.space(3);
	let title=null,titleHeight=0;
	if(s.title){
		title=el("div","bold",cam,s.title);
		set(title,{position:"absolute",left:px(K.safe.x),top:px(K.safe.y),width:px(K.safe.w),textAlign:"center",color:fg});
		D.fitSize(title,K.safe.w,K.safe.h*.35,"sceneTitle");
		titleHeight=title.offsetHeight+gap;
	}
	const columns=vertical?Math.min(2,s.notes.length):1,rows=Math.ceil(s.notes.length/columns);
	const regionW=vertical?K.safe.w:K.safe.w*.44;
	const noteW=(regionW-gap*(columns-1))/columns;
	const notes=s.notes.map(text=>{
		const line=el("div","",cam),dot=el("div","",cam),pill=el("div","",cam,text);
		set(pill,{position:"absolute",width:px(noteW),boxSizing:"border-box",background:"#ffffff",color:"#15161a",whiteSpace:"normal",boxShadow:`0 ${px(18*S)} ${px(46*S)} rgba(0,0,0,.16)`,transformOrigin:"0 50%"});
		D.surface(pill,"badge",{density:"comfortable"});
		D.apply(pill,"caption");
		set(line,{position:"absolute",height:px(3*S),background:alpha(fg,.35),transformOrigin:"0 50%",display:vertical?"none":"block"});
		set(dot,{position:"absolute",width:px(16*S),height:px(16*S),borderRadius:"50%",background:accent,display:vertical?"none":"block"});
		return {line,dot,pill};
	});
	const rowHeights=()=>Array.from({length:rows},(_,r)=>Math.max(...notes.slice(r*columns,(r+1)*columns).map(n=>n.pill.offsetHeight)));
	let heights=rowHeights(),noteH=heights.reduce((a,b)=>a+b,0)+gap*(rows-1);
	const availableH=K.safe.h-titleHeight;
	if(noteH>(vertical?availableH-D.space(6)-gap:availableH)){
		for(const {pill}of notes)D.apply(pill,"caption",{step:2});
		heights=rowHeights();noteH=heights.reduce((a,b)=>a+b,0)+gap*(rows-1);
	}
	// Keep readable notes and the product in view. Dense copy advances through
	// measured pages on the existing note events instead of shrinking the type.
	const maxRowHeight=Math.max(...heights);
	const noteBudget=vertical?availableH*.6:availableH;
	const visibleRows=Math.min(rows,Math.max(1,Math.floor((noteBudget+gap)/(maxRowHeight+gap))));
	const capacity=Math.min(notes.length,visibleRows*columns);
	const paged=capacity<notes.length;
	if(paged){heights=Array.from({length:visibleRows},()=>maxRowHeight);noteH=visibleRows*maxRowHeight+gap*(visibleRows-1);}
	const aspect=img?img.w/img.h:.78;
	const maxCardW=vertical?K.safe.w*.84:K.safe.w-regionW-gap*2;
	const maxCardH=vertical?availableH-noteH-gap:availableH;
	if(maxCardH<=0||noteH>availableH)throw new Error("Callout copy exceeds the readable layout capacity");
	const cw=Math.min(maxCardW,maxCardH*aspect),ch=cw/aspect;
	const cx=vertical?K.safe.x+(K.safe.w-cw)/2:K.safe.x;
	const cy=K.safe.y+titleHeight+(vertical?0:(availableH-ch)/2);
	const card=el("div","card",cam);
	set(card,{left:px(cx),top:px(cy),width:px(cw),height:px(ch),boxShadow:`0 ${px(40*S)} ${px(90*S)} rgba(0,0,0,.24)`});
	D.surface(card,"card",{layout:"frame",purpose:"media"});
	if(img){const im=el("img","fill",card);im.src=img.src;}else mockUI(card,palette,accent,p.index);
	const nx=vertical?K.safe.x:K.safe.x+K.safe.w-regionW;
	const ny=vertical?cy+ch+gap:K.safe.y+titleHeight+(availableH-noteH)/2;
	for(let i=0;i<notes.length;i++){
		const slot=i%capacity,r=Math.floor(slot/columns),y=ny+heights.slice(0,r).reduce((a,b)=>a+b+gap,0),x=nx+(slot%columns)*(noteW+gap);
		set(notes[i].pill,{left:px(x),top:px(y)});
		set(notes[i].line,{left:px(cx+cw),top:px(y+notes[i].pill.offsetHeight/2),width:px(Math.max(0,x-cx-cw))});
		set(notes[i].dot,{left:px(cx+cw-8*S),top:px(y+notes[i].pill.offsetHeight/2-8*S)});
	}
	return (l) => {
		const e = spring(l, 2.2, 0.7);
		set(card, { opacity: clamp(l / 0.1).toFixed(3), transform: `translateY(${px((1 - e) * 120 * S)}) rotate(${((1 - e) * -3).toFixed(2)}deg)` });
		if (title) set(title, { opacity: clamp(l / 0.2).toFixed(3) });
		let newest=0;
		for(let i=0;i<marks.length;i++)if(l>=marks[i])newest=i;
		const page=Math.floor(newest/capacity);
		notes.forEach(({ line, dot, pill }, i) => {
			const visible=Math.floor(i/capacity)===page;
			const k = spring(l - marks[i], 3, 0.55);
			const on = visible && l >= marks[i] - 0.15;
			// Grows from nothing (no 30% pop), then pulses softly while it waits.
			const dk = on ? expoOut(prog(l, marks[i] - 0.15, 0.24)) : 0;
			set(dot, { transform: `scale(${(dk * (1 + 0.1 * Math.sin((l - marks[i]) * 4) * clamp((l - marks[i]) / 0.5))).toFixed(4)})` });
			set(line, { opacity: visible ? "1" : "0", transform: `scaleX(${expoOut(prog(l, marks[i] - 0.1, 0.2)).toFixed(3)})` });
			set(pill, { opacity: (visible ? clamp((l - marks[i]) / 0.06) : 0).toFixed(3), transform: `scale(${(0.6 + 0.4 * k).toFixed(4)})` });
		});
	};
};

/** Before / after: a divider sweeps across, the cursor dragging it. */
sceneFactories.compare = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, clamp, cubicInOut, prog, alpha, textOn, makeCursor, lerp } = K;
	const s = p.scene;
	const D=K.design;
	const left = el("div", "", cam);
	set(left, { position: "absolute", inset: "0", background: alpha(fg, 0.08), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: px(D.space(2)) });
	// The labels are the film's words or none: with none, the struck line and the wipe tell it.
	const bl = el("div", "mono", left, s.beforeLabel ?? "");
	D.apply(bl,"label");
	set(bl, { color: alpha(fg, 0.6) });
	set(bl,{maxWidth:px(W*.8),textAlign:"center"});D.truncateLine(bl);bl.title=s.beforeLabel??"";
	const bt = el("div", "bold", left, s.before);
	set(bt, { color: alpha(fg, 0.55), textDecoration: "line-through", textDecorationThickness: "0.06em", textAlign: "center" });
	D.fitSize(bt, W * 0.8, H * 0.3, "display");
	const right = el("div", "", cam);
	set(right, { position: "absolute", inset: "0", background: accent, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: px(D.space(2)) });
	const al = el("div", "mono", right, s.afterLabel ?? "");
	D.apply(al,"label");
	set(al, { color: alpha(textOn(accent), 0.7) });
	set(al,{maxWidth:px(W*.8),textAlign:"center"});D.truncateLine(al);al.title=s.afterLabel??"";
	const at = el("div", "display", right, s.after);
	set(at, { color: textOn(accent), textAlign: "center" });
	D.fitSize(at, W * 0.8, H * 0.34, "display");
	const handle = el("div", "", cam);
	set(handle, { position: "absolute", top: "0", bottom: "0", width: px(8 * S), background: "#ffffff", boxShadow: `0 0 ${px(30 * S)} rgba(0,0,0,0.25)` });
	const knob = el("div", "", handle);
	set(knob, { position: "absolute", top: "50%", left: "50%", width: px(84 * S), height: px(84 * S), marginLeft: px(-42 * S), marginTop: px(-42 * S), borderRadius: "50%", background: "#ffffff", boxShadow: `0 ${px(10 * S)} ${px(30 * S)} rgba(0,0,0,0.25)` });
	const cursor = makeCursor(cam, 72 * S);
	const from = p.dur * 0.3;
	const to = p.dur * 0.8;
	return (l) => {
		const k = cubicInOut(prog(l, from, to - from));
		const x = lerp(W * 0.94, -W * 0.02, k);
		set(right, { clipPath: `inset(0 0 0 ${px(Math.max(0, x))})` });
		set(left, { clipPath: `inset(0 ${px(Math.max(0,W-Math.max(0,x)))} 0 0)` });
		set(handle, { left: px(x - 4 * S), opacity: x > 0 ? "1" : "0" });
		cursor(l, { fx: x + 200 * S, fy: H / 2 + 200 * S, x: x + 10 * S, y: H / 2 + 10 * S, start: 0.05, arrive: from - 0.08, click: from - 0.02, ringColor: alpha("#ffffff", 0.9) });
		if (l > from) cursor(l, { fx: x + 10 * S, fy: H / 2 + 10 * S, x: x + 10 * S, y: H / 2 + 10 * S, start: from, arrive: from + 0.01, click: 1e9 });
		set(bt, { opacity: clamp(l / 0.15).toFixed(3) });
	};
};
export {sceneFactories};
export default sceneFactories;
