// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
/** A product card with tooltip callouts popping out beside it on the beat. */
export const factory = ({ p, cam, fg, accent, palette, K }) => {
	const { W, H, S, el, set, px, spring, clamp, images, mockUI, alpha, expoOut, prog } = K;
	const s = p.scene;
	const D=K.design;
	const marks = p.marks; // when each part lands: components/scene-moments.cjs
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

