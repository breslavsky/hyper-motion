// Persistent paper objects, one camera, and instance-scoped editorial typography.
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const blend=(a,b,p)=>`rgb(${rgb(a).map((v,i)=>Math.round(v+(rgb(b)[i]-v)*p)).join(',')})`;
const rgba=(c,a)=>`rgba(${rgb(c).join(',')},${a})`;
const lum=c=>rgb(c).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
const onColor=c=>{const l=lum(c),d=lum('#111111');return(l+.05)/(d+.05)>=1.05/(l+.05)?'#111111':'#ffffff';};
const px=n=>`${n.toFixed(3)}px`;
const set=(node,style)=>Object.assign(node.style,style);
const NS='http://www.w3.org/2000/svg';
function el(tag,klass,parent,text){const e=parent.ownerDocument.createElement(tag);if(klass)e.className=klass;if(text!==undefined)e.textContent=text;parent.append(e);return e;}
function svgEl(tag,attrs,parent){const e=parent.ownerDocument.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));parent.append(e);return e;}
function fitText(node,{size,min,width,height,line=1.08}){
  set(node,{width:px(width),fontSize:px(size),lineHeight:String(line),overflowWrap:'normal'});
  while(size>min&&(node.scrollHeight>height+.5||node.scrollWidth>width+.5)){size=Math.max(min,size-1);node.style.fontSize=px(size);}
  if(node.scrollWidth>width+.5){node.style.overflowWrap='anywhere';}
  if(node.scrollHeight>height+1||node.scrollWidth>width+1)throw new Error(`Text cannot fit without violating the readable floor: ${node.textContent}`);
  return size;
}
function glyph(parent,kind,ink,accent){
  const svg=svgEl('svg',{viewBox:'0 0 360 160','aria-hidden':'true'},parent);svg.classList.add('df-glyph');
  const g=svgEl('g',{fill:'none',stroke:ink,'stroke-width':5,'stroke-linecap':'round','stroke-linejoin':'round'},svg);
  const line=(x1,y1,x2,y2)=>svgEl('line',{x1,y1,x2,y2},g),pieces=[];let photo=null,accentPanel=null;
  if(kind==='note'){[26,72,118].forEach((y,i)=>line(8,y,340-i*58,y));svgEl('circle',{cx:326,cy:130,r:13,fill:accent,stroke:'none'},g);}
  if(kind==='task'){[35,110].forEach(y=>{svgEl('rect',{x:8,y:y-20,width:40,height:40,rx:5},g);line(78,y,336,y);});svgEl('path',{d:'M16 34 L27 45 L43 24',stroke:accent,'stroke-width':8},g);}
  if(kind==='sketch'){svgEl('path',{d:'M6 114 Q54 -2 106 77 T204 72 T298 47 L349 116 M37 144 L326 144'},g);svgEl('circle',{cx:280,cy:28,r:13,fill:accent,stroke:'none'},g);}
  if(kind==='file'){svgEl('path',{d:'M16 138 V14 H82 L110 43 V138 Z M82 14 V43 H110'},g);[34,77,121].forEach((y,i)=>line(154,y,342-i*24,y));}
  if(kind==='idea'){svgEl('circle',{cx:80,cy:76,r:42,fill:accent,stroke:'none'},g);for(let i=0;i<8;i++){const a=i*Math.PI/4;line(80+52*Math.cos(a),76+52*Math.sin(a),80+70*Math.cos(a),76+70*Math.sin(a));}[34,78,122].forEach((y,i)=>line(185,y,340-i*24,y));}
  if(kind==='draft'){
    const panels=[[10,12,134,134],[168,12,178,54],[168,92,178,54]];
    panels.forEach(([x,y,w,h],i)=>{const p=svgEl('g',{},g);const r=svgEl('rect',{x,y,width:w,height:h,rx:6,fill:i===1?accent:'none',stroke:i===1?'none':ink},p);if(i===1)accentPanel=r;pieces.push(p);});
    photo=svgEl('path',{d:'M27 124 L59 64 L84 95 L108 54 L130 124 Z',fill:ink,stroke:ink,'stroke-width':4},pieces[0]);
    line(188,111,325,111);line(188,128,278,128);
  }
  return {svg,draw(progress){if(photo)photo.setAttribute('fill-opacity',String(progress));if(accentPanel){accentPanel.setAttribute('width',String(56+122*progress));accentPanel.setAttribute('opacity',String(.45+.55*progress));}for(const[p,i]of pieces.map((p,i)=>[p,i]))p.setAttribute('transform',`translate(${(1-progress)*[9,-10,12][i]} ${(1-progress)*[8,-9,10][i]}) rotate(${(1-progress)*[-4,5,-3][i]} ${[77,257,257][i]} ${[79,39,119][i]})`);}};
}

export async function createView(root,plan){
  const {width:W,height:H,brand,content,layout}=plan,{tall,wide}=layout;
  await root.ownerDocument.fonts.load(`600 48px "${brand.font}"`,content.documents.map(d=>d.label).join(' '));await root.ownerDocument.fonts.ready;
  const scope=`[data-df-instance="${CSS.escape(root.dataset.dfInstance||root.id)}"]`;
  set(root,{position:'absolute',inset:'0',overflow:'hidden',background:brand.background,color:brand.foreground,fontFamily:`"${brand.font}"`,fontWeight:'500'});
  const style=el('style','',root);
  style.textContent=`${scope} *{box-sizing:border-box} ${scope} .df-text{white-space:normal;overflow-wrap:anywhere;word-break:normal;margin:0;letter-spacing:-.035em;font-weight:600}
  ${scope} .df-card,${scope} .df-group{position:absolute;transform-origin:50% 50%}
  ${scope} .df-card{z-index:2;border:3px solid;border-radius:14px;box-shadow:0 16px 32px rgba(0,0,0,.18)}
  ${scope} .df-card-label{position:absolute;left:${wide?24:12}px;top:22px;line-height:1.08;letter-spacing:-.045em}
  ${scope} .df-glyph{position:absolute;bottom:21px;left:24px;width:calc(100% - 48px)}
  ${scope} .df-back{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:11px}
  ${scope} .df-back svg{width:38%;height:44%}
  ${scope} .df-seal{position:absolute;right:16px;bottom:15px;width:15px;height:15px;border-radius:50%}
  ${scope} .df-group{border:2px solid;border-radius:20px}
  ${scope} .df-group-label{position:absolute;left:24px;top:18px;line-height:1.08}
  ${scope} .df-world{position:absolute;inset:0;transform-origin:0 0}
  ${scope} .df-scan{position:absolute;z-index:0;height:4px;transform-origin:0 0}
  ${scope} .df-intro,${scope} .df-action,${scope} .df-end{position:absolute}
  ${scope} .df-intro{letter-spacing:-.065em} ${scope} .df-action{letter-spacing:-.055em}
  ${scope} .df-end{inset:0;pointer-events:none} ${scope} .df-cta{position:absolute;border-radius:12px;text-align:center}
  `;
  const world=el('div','df-world',root);world.dataset.worldCamera='true';
  const groups=layout.categories.map(g=>{
    const node=el('div','df-group',world);node.dataset.categoryId=g.id;
    set(node,{left:px(g.x-g.w/2),top:px(g.y-g.h/2),width:px(g.w),height:px(g.h),borderColor:rgba(brand.foreground,.25),background:rgba(brand.foreground,.025)});
    const label=el('div','df-text df-group-label',node,g.label);
    fitText(label,{size:wide?52:tall?46:44,min:tall?44:40,width:g.w-48,height:144});
    return {node,label,g};
  });
  const cards=layout.documents.map(d=>{
    const node=el('div','df-card',world);node.dataset.documentId=d.id;node.dataset.category=d.category;
    const ink=d.hero?brand.background:brand.foreground;
    set(node,{left:px(-d.width/2),top:px(-d.height/2),width:px(d.width),height:px(d.height),color:ink,background:d.hero?brand.foreground:blend(brand.background,brand.foreground,.075),borderColor:d.hero?brand.foreground:rgba(brand.foreground,.34)});
    const label=el('div','df-text df-card-label',node,d.label);
    fitText(label,{size:wide?54:tall?52:48,min:40,width:d.width-(wide?48:24),height:d.height-42});
    const art=glyph(node,d.kind,ink,brand.accent);
    const artHeight=tall?116:wide?48:56;
    set(art.svg,{height:px(artHeight),opacity:d.hero?'1':'.66'});
    // scrollHeight includes glyph overshoot; clientHeight excludes the border.
    const artFits=label.offsetTop+label.scrollHeight+12<=node.clientHeight-21-artHeight;
    const seal=el('div','df-seal',node);set(seal,{background:brand.accent});
    const back=el('div','df-back',node);set(back,{background:brand.accent2});
    const backArt=svgEl('svg',{viewBox:'0 0 100 100','aria-hidden':'true'},back);
    svgEl('path',{d:'M22 15 H60 L79 34 V84 H22 Z M60 15 V34 H79 M34 48 H67 M34 61 H57',fill:'none',stroke:onColor(brand.accent2),'stroke-width':7,'stroke-linejoin':'round'},backArt);
    return {node,label,art,artFits,seal,back,d};
  });
  const scanner=el('div','df-scan',world);set(scanner,{left:px(layout.scan.left),width:px(layout.scan.right-layout.scan.left),background:brand.accent,boxShadow:`0 -14px 0 ${rgba(brand.accent,.08)}`});scanner.dataset.decoration='true';
  const intro=el('div','df-text df-intro',root,content.opening);
  set(intro,{left:px(wide?110:74),top:px(tall?178:wide?64:66)});
  fitText(intro,{size:wide?126:tall?124:112,min:wide?86:76,width:wide?1540:932,height:tall?340:275,line:1.04});
  const action=el('div','df-text df-action',root,content.steps[0]);
  set(action,{left:px(wide?110:74),top:px(tall?178:66),width:px(W-148)});
  let actionSize=tall?92:wide?96:92;
  for(const value of content.steps){action.textContent=value;actionSize=Math.min(actionSize,fitText(action,{size:actionSize,min:76,width:W-148,height:118,line:1.04}));}
  action.textContent=content.steps[2];
  const createSize=fitText(action,{size:wide?174:tall?164:150,min:76,width:wide?800:W-148,height:wide?220:300,line:1.02});
  action.textContent=content.steps[0];
  const end=el('div','df-end',root);
  const logo=el('div','df-text',end,brand.name);set(logo,{position:'absolute',textAlign:'center',left:px(W*.06),top:px(tall?555:wide?210:230),letterSpacing:'-.08em'});
  fitText(logo,{size:wide?290:tall?252:236,min:100,width:W*.88,height:tall?300:280,line:1.04});
  const closing=el('div','df-text',end,content.closing);set(closing,{position:'absolute',textAlign:'center',left:px(W*.08),top:px(tall?890:wide?550:520),fontWeight:'500'});
  fitText(closing,{size:wide?76:tall?72:68,min:52,width:W*.84,height:tall?230:160,line:1.1});
  const cta=el('div','df-cta',end),ctaText=el('div','df-text',cta,content.cta),ctaW=wide?1000:W*.8,ctaH=tall?132:116;
  set(cta,{left:px((W-ctaW)/2),top:px(tall?1190:wide?780:764),width:px(ctaW),height:px(ctaH),background:brand.accent,color:onColor(brand.accent),display:'flex',alignItems:'center',justifyContent:'center',padding:'12px 30px'});
  fitText(ctaText,{size:wide?66:tall?64:58,min:44,width:ctaW-60,height:ctaH-24,line:1.05});
  let current;
  function draw(state){
    current=state;const c=state.camera;
    set(world,{transform:`translate(${px(W/2-c.x*c.zoom)},${px(H/2-c.y*c.zoom)}) scale(${c.zoom.toFixed(6)})`});
    for(const[i,item]of cards.entries()){
      const d=state.documents[i],flip=Math.max(.02,Math.abs(Math.cos(Math.PI*(1-d.front))));
      set(item.node,{transform:`translate(${px(d.x)},${px(d.y)}) rotate(${d.rotation.toFixed(5)}deg) scale(${d.scale.toFixed(6)}) scaleX(${flip.toFixed(6)})`,opacity:String(d.opacity),zIndex:String(d.moving?30:d.hero&&state.phase==='create'?40:2+item.d.index),borderColor:d.scanned?brand.accent:item.d.hero?brand.foreground:rgba(brand.foreground,.34)});
      Object.assign(item.node.dataset,{scanned:String(d.scanned),sorted:String(d.sorted),active:String(d.active),face:d.face});
      item.label.style.visibility=d.active?'visible':'hidden';
      item.art.svg.style.visibility=d.front>.92&&item.artFits?'visible':'hidden';item.art.draw(d.artProgress);
      item.back.style.visibility=d.front<.5?'visible':'hidden';item.seal.style.opacity=d.scanned&&d.front>.92?'1':'0';
    }
    for(const[i,item]of groups.entries()){const g=state.categories[i];item.node.style.opacity=String(g.opacity);item.label.style.visibility=g.active?'visible':'hidden';}
    scanner.style.transform=`translateY(${px(state.scan.y)})`;scanner.style.opacity=String(state.scan.opacity);
    intro.style.opacity=String(state.introOpacity);intro.style.visibility=state.introOpacity>0?'visible':'hidden';
    action.textContent=state.actionLabel;action.style.visibility=state.actionIndex>=0?'visible':'hidden';
    set(action,{fontSize:px(state.phase==='create'?createSize:actionSize),top:px(state.phase==='create'?(tall?270:wide?225:70):(tall?178:66)),width:px(state.phase==='create'&&wide?800:W-148)});
    end.style.opacity=String(state.endOpacity);end.style.visibility=state.endOpacity>0?'visible':'hidden';cta.style.opacity=String(state.ctaOpacity);cta.style.transform=`translateY(${px(12*(1-state.ctaOpacity))})`;
  }
  function audit(){const texts=[...root.querySelectorAll('.df-text')].map(node=>{const box=node.getBoundingClientRect(),s=root.ownerDocument.defaultView.getComputedStyle(node);return{text:node.textContent,x:box.x,y:box.y,width:box.width,height:box.height,font:s.fontFamily,fontSize:parseFloat(s.fontSize),visible:s.visibility!=='hidden'};});return{...current,cameraCount:1,documentCount:cards.length,texts};}
  return {draw,audit,dispose(){root.replaceChildren();}};
}
