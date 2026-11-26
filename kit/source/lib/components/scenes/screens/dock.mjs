// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
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
export const factory = ({ p, cam, fg, accent, palette, K }) => {
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

