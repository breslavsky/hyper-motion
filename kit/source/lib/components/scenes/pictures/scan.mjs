// Scan, tag and sort into cards. Adapted from community technique
// c8af3fb3-c765-49e9-b5d4-bd52713c3629-1-6; layout and clocks are instance-local.
import metadata from '../../metadata.mjs';

// One background survives the text handoff. Busy copy leaves before the
// completion cue; done copy enters on the cue and keeps its original full hold.
// Row opacities are local to the shared surface, so optional single-label
// variants can fade the complete surface without applying opacity twice.
export function scanStatusState(time,timing,length,{busy=true,done=true}={}) {
  const clamp=value=>Math.max(0,Math.min(1,value)),fade=length*.03;
  const entered=1-(1-clamp((time-timing.enter)/(length*.07)))**3;
  const completed=clamp((time-timing.complete)/fade);
  return {
    surfaceOpacity:busy?entered*(done?1:1-completed):done?completed:0,
    busyOpacity:busy?(done?clamp((timing.complete-time)/fade):1):0,
    doneOpacity:done?(busy?completed:1):0,
  };
}

export function createFamily(K) {
  const definition={...metadata.scan,build({p,cam,fg,accent,palette,bg}){
    const s=p.scene,errors=this.validate(s);
    if(errors.length)throw new Error(`scan: ${errors.join('; ')}`);
    const {W,H,S,safe,el,set,px,clamp,alpha,mixHex,textOn}=K;
    const len=p.ldur??p.dur,t=this.times(s,len,p.beatLen);
    const ease=u=>1-(1-clamp(u))**3;
    const mix=(a,b,k)=>a+(b-a)*k;
    const rect=(node,x,y,w,h)=>set(node,{position:'absolute',left:px(x),top:px(y),width:px(w),height:px(h)});
    const cardBox=K.design.box('card',{density:'compact'}),badgeBox=K.design.box('badge',{density:'compact'});
    const gap=K.design.space(2),pad=cardBox.paddingX;
    let wide=W>H*1.25;
    const root=el('div','',cam);root.dataset.scanRoot='';rect(root,0,0,W,H);
    const title=s.title?el('div','bold',root,s.title):null;
    if(title){
      rect(title,safe.x,safe.y,safe.w,0);set(title,{height:'auto',color:fg,textAlign:'center'});
      const fullHeight=Math.min(safe.h*.3,K.design.type('sceneTitle').lineHeight*3);
      // Try the compact title tier before sacrificing the scan board's height.
      // All copy stays visible and only existing scene-title steps are used.
      try{K.design.fitSize(title,safe.w,Math.min(fullHeight,K.design.steps('sceneTitle').at(-1).lineHeight*2),'sceneTitle');}
      catch{K.design.fitSize(title,safe.w,fullHeight,'sceneTitle');}
    }
    const titleH=title?.offsetHeight??0,statusH=s.scanning||s.complete?K.design.type('label').lineHeight+K.design.space(2):0;
    const roomH=safe.h-titleH-statusH-gap*2,rows=Math.ceil(s.categories.length/2);
    const categoryTextW=(safe.w-gap)/2-pad*2;
    const categoryHeadH=Math.max(...s.categories.map(name=>{
      const probe=el('div','',root,name);set(probe,{position:'absolute',width:px(categoryTextW)});
      K.design.apply(probe,'controlLabel');K.design.truncateLine(probe);
      const height=probe.offsetHeight;probe.remove();return height;
    }))+pad;
    const categoryMinH=categoryHeadH+pad+gap+K.design.space(2)+2*Math.floor(1.5*S);
    const compactColumns=!wide&&roomH-categoryMinH*rows-gap*rows<K.design.space(7);
    wide ||= compactColumns;
    // The scan board and its gutter must hold the widest unbroken tag word.
    const tagWordWidth=Math.max(...s.items.flatMap(item=>item.label.split(/\s+/)).map(copy=>{
      const probe=el('span','',root,copy);K.design.apply(probe,'label');
      set(probe,{position:'absolute',whiteSpace:'nowrap'});const width=probe.scrollWidth;probe.remove();return width;
    }));
    const minimumBoardW=tagWordWidth+badgeBox.paddingX*2-gap*2;
    let bw,bh,cardsW,cw,ch,boardX,boardY,cardsX,cardsY;
    if(wide){
      bh=Math.min(roomH,720*S);bw=Math.max(compactColumns?minimumBoardW:0,Math.min(safe.w*(compactColumns?.22:.36),bh*.83));
      cardsW=safe.w-bw-gap*2;cw=(cardsW-gap)/2;
      ch=Math.min((roomH-gap*(rows-1))/rows,300*S);
      const contentH=Math.max(bh,ch*rows+gap*(rows-1));
      boardX=safe.x;boardY=safe.y+titleH+gap+(roomH-contentH)/2+(contentH-bh)/2;
      cardsX=boardX+bw+gap*2;cardsY=safe.y+titleH+gap+(roomH-ch*rows-gap*(rows-1))/2;
    }else{
      bh=Math.min(roomH*(rows===2?.46:.61),roomH-categoryMinH*rows-gap*rows,640*S);bw=Math.min(safe.w*.9,Math.max(bh*1.25,safe.w*.73));
      cardsW=safe.w;cw=(cardsW-gap)/2;
      ch=Math.min((roomH-bh-gap*rows)/rows,250*S);
      const contentH=bh+gap+ch*rows+gap*(rows-1);
      boardX=safe.x+(safe.w-bw)/2;boardY=safe.y+titleH+gap+(roomH-contentH)/2;
      cardsX=safe.x;cardsY=boardY+bh+gap;
    }
    // mixHex returns CSS rgb(); textOn/alpha consume hex colours.
    const mixed=(a,b,k)=>`#${mixHex(a,b,k).match(/\d+/g).map(value=>Number(value).toString(16).padStart(2,'0')).join('')}`;
    const surface=mixed(bg,fg,.88),cardInk=textOn(surface),boardGround=mixed(bg,accent,.15);
    const lineInk=mixHex(fg,bg,.22),white=textOn(fg);
    const board=el('div','',root);board.dataset.scanBoard='';rect(board,boardX,boardY,bw,bh);
    set(board,{overflow:'hidden',background:boardGround,boxShadow:`0 ${px(18*S)} ${px(38*S)} ${alpha(fg,.13)}`});
    K.design.surface(board,'card',{layout:'frame',purpose:'media'});
    const image=s.image?K.images[s.image]:null;
    let imageW=0,imageH=0,imageX=0,imageY=0;
    if(image){
      const scale=Math.max(bw/image.w,bh/image.h);imageW=image.w*scale;imageH=image.h*scale;
      imageX=(bw-imageW)/2;imageY=(bh-imageH)/2;
      set(board,{backgroundImage:`url(${JSON.stringify(image.src)})`,backgroundSize:`${px(imageW)} ${px(imageH)}`,backgroundPosition:`${px(imageX)} ${px(imageY)}`,backgroundRepeat:'no-repeat'});
    }
    const colours=[accent,palette.coral,palette.lilac,palette.electric,palette.sage,palette.butter].filter(Boolean);
    const art=(parent,index,w,h)=>{
      const colour=colours[index%colours.length];
      set(parent,{background:colour});
      const shape=el('div','',parent),d=Math.min(w,h)*.59;
      rect(shape,(w-d)/2,(h-d)/2,d,d);
      set(shape,{background:alpha(textOn(colour),.84),borderRadius:index%3===0?'50%':px(d*.16),transform:`rotate(${index%3===2?45:0}deg) scale(${index%3===2?.76:1})`});
      const inset=el('div','',shape);
      set(inset,{position:'absolute',inset:'28%',background:colour,borderRadius:index%2?'50%':px(d*.06)});
    };
    const categories=s.categories.map((name,i)=>{
      const x=cardsX+(i%2)*(cw+gap),y=cardsY+Math.floor(i/2)*(ch+gap);
      const card=el('div','',root);card.dataset.scanCategory=String(i);rect(card,x,y,cw,ch);
      set(card,{background:surface,border:`${px(1.5*S)} solid ${alpha(cardInk,.12)}`,boxShadow:`0 ${px(12*S)} ${px(26*S)} ${alpha(fg,.07)}`});
      K.design.surface(card,'card',{density:'compact',layout:'absolute'});
      const border=parseFloat(getComputedStyle(card).borderLeftWidth),innerW=cw-border*2,innerH=ch-border*2;
      const count=Math.max(1,t.counts[i]),columns=compactColumns?1:count,slotRows=compactColumns?count:1;
      const sideSlot=compactColumns?Math.min(44*S,(innerW-pad*2)*.14):0;
      const labelW=innerW-pad*2-(compactColumns?sideSlot+K.design.space(1):0);
      const labelMaxH=Math.min(K.design.type('controlLabel').lineHeight*3,innerH-pad*2-(compactColumns?0:gap+20*S));
      const label=el('div','bold',card,name);rect(label,pad,pad,labelW,labelMaxH);
      set(label,{height:'auto',color:cardInk});K.design.apply(label,'controlLabel');K.design.truncateLine(label);
      K.design.surfaceContent(card,label);
      const headH=pad+label.offsetHeight+gap;
      const slotGap=K.design.space(1),slotSize=compactColumns?Math.min(sideSlot,(innerH-pad*2-slotGap*(slotRows-1))/slotRows):Math.min(90*S,(innerW-pad*2-slotGap*(columns-1))/columns,(innerH-headH-pad-slotGap*(slotRows-1))/slotRows);
      const slotsW=slotSize*columns+slotGap*(columns-1),slotsH=slotSize*slotRows+slotGap*(slotRows-1);
      const sx=compactColumns?innerW-pad-slotsW:(innerW-slotsW)/2,sy=compactColumns?(innerH-slotsH)/2:headH+(innerH-headH-pad-slotsH)/2;
      const slots=Array.from({length:count},(_,j)=>{
        const slot=el('div','',card),xx=sx+(j%columns)*(slotSize+slotGap),yy=sy+Math.floor(j/columns)*(slotSize+slotGap);
        slot.dataset.scanSlot=`${i}:${j}`;
        rect(slot,xx,yy,slotSize,slotSize);K.design.surfaceContent(card,slot);set(slot,{border:`${px(2*S)} dashed ${alpha(cardInk,.2)}`,borderRadius:px(K.design.radius(2))});
        return {x:x+border+xx+slotSize/2,y:y+border+yy+slotSize/2,size:slotSize};
      });
      const badge=el('div','',card),dots=t.counts[i];
      const indicatorDesign=K.design.forSurface(1/3),indicatorBox=indicatorDesign.box('badge',{density:'compact'});
      const dotD=7*S,dotGap=indicatorBox.gap,badgeW=Math.max(dotD,dots*dotD+(dots-1)*dotGap)+indicatorBox.paddingX*2+2*S;
      const badgeH=dotD+indicatorBox.paddingY*2+2*S;
      rect(badge,cw-badgeW-pad,ch-badgeH/2,badgeW,badgeH);
      set(badge,{background:surface,display:'flex',alignItems:'center',justifyContent:'center',border:`${px(S)} solid ${alpha(cardInk,.13)}`});
      indicatorDesign.surface(badge,'badge',{density:'compact'});
      const indicators=Array.from({length:dots},(_,j)=>{
        const dot=el('i','',badge);dot.dataset.scanDot=`${i}:${j}`;
        set(dot,{display:'block',width:px(dotD),height:px(dotD),borderRadius:'50%',background:alpha(cardInk,.14)});return dot;
      });
      return {card,slots,indicators};
    });
    const objects=t.items.map((item,i)=>{
      const {box}=item,cellW=box.w*bw,y=box.y*bh,h=box.h*bh;
      // A provided picture keeps its real crop proportions. Invented brand
      // objects can stay square, so they remain readable after sorting in a
      // short square-format board; labels still use the full scan-cell width.
      const w=image?cellW:Math.min(cellW,h*1.1),x=box.x*bw+(cellW-w)/2;
      if(!image){const original=el('div','',board);rect(original,x,y,w,h);set(original,{borderRadius:px(K.design.radius(3)),overflow:'hidden'});art(original,i,w,h);}
      const ghost=el('div','',board);rect(ghost,x,y,w,h);set(ghost,{borderRadius:px(K.design.radius(3)),background:boardGround});
      const marker=el('div','',root);marker.dataset.scanMark=String(i);rect(marker,boardX+x-5*S,boardY+y-5*S,w+10*S,h+10*S);set(marker,{zIndex:'30'});
      const corner=20*S;
      for(let k=0;k<4;k++){
        const bracket=el('i','',marker);
        set(bracket,{position:'absolute',[k%2?'right':'left']:'0',[k<2?'top':'bottom']:'0',width:px(corner),height:px(corner),borderStyle:'solid',borderColor:lineInk,borderWidth:`${k<2?3*S:0}px ${k%2?3*S:0}px ${k>=2?3*S:0}px ${k%2?0:3*S}px`,borderRadius:px(K.design.radius(1))});
      }
      const tag=el('div','',marker),tagPad=badgeBox.paddingX,tagH=K.design.type('label').lineHeight*2+badgeBox.paddingY*2;
      rect(tag,5*S+(w-cellW)/2,-tagH*.46,cellW,tagH);
      set(tag,{boxSizing:'border-box',background:fg,color:white,textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'});
      K.design.surface(tag,'badge',{density:'compact'});
      const tagText=el('div','bold',tag,s.items[i].label);
      // A tag is an annotation, not an image crop. Its bounded text leaf keeps
      // one line; the shared badge padding stays outside the clipping window.
      K.design.apply(tagText,'label');set(tagText,{whiteSpace:'nowrap'});
      let wordWidth=0;
      for(const word of s.items[i].label.split(/\s+/)){tagText.textContent=word;wordWidth=Math.max(wordWidth,tagText.scrollWidth);}
      tagText.textContent=s.items[i].label;
      // Dense layouts let annotations use the empty gutter beside the board.
      // Their whole-word minimum remains independent of image crop width.
      const tagRoom=compactColumns?cardsX-boardX:bw;
      const tagW=Math.min(tagRoom,Math.max(cellW,wordWidth+tagPad*2));
      const tagX=Math.max(boardX,Math.min(boardX+tagRoom-tagW,boardX+box.x*bw+(cellW-tagW)/2));
      set(tag,{width:px(tagW),left:px(tagX-(boardX+x-5*S))});
      set(tagText,{width:px(tagW-tagPad*2)});K.design.truncateLine(tagText);
      const fittedTagH=Math.min(tagH,tagText.offsetHeight+badgeBox.paddingY*2);
      tag.dataset.scanTag=String(i);
      set(tag,{height:px(fittedTagH),top:px(-fittedTagH*.46)});
      const lift=el('div','',root);lift.dataset.scanItem=String(i);rect(lift,boardX+x,boardY+y,w,h);
      set(lift,{boxSizing:'border-box',overflow:'hidden',borderStyle:'solid',borderColor:lineInk,transformOrigin:'50% 50%',boxShadow:`0 ${px(10*S)} ${px(26*S)} ${alpha(fg,.18)}`});
      K.design.surface(lift,'card',{density:'compact',layout:'frame',purpose:'media'});
      if(image)set(lift,{backgroundImage:`url(${JSON.stringify(image.src)})`,backgroundSize:`${px(imageW)} ${px(imageH)}`,backgroundPosition:`${px(imageX-x)} ${px(imageY-y)}`,backgroundRepeat:'no-repeat'});
      else art(lift,i,w,h);
      const target=categories[item.category].slots[item.slot];
      return {...item,ghost,marker,tag,tagX,tagY:boardY+y-5*S-fittedTagH*.46,tagW,tagH:fittedTagH,markerY:boardY+y-5*S,liftNode:lift,x:boardX+x+w/2,y:boardY+y+h/2,w,h,target,dot:categories[item.category].indicators[item.slot]};
    });
    // A short board displays only the active scan row. Its annotations live
    // in a stable board overlay, independently of each marker's pop transform.
    // This keeps long labels out of the title and category cards.
    const packedTags=compactColumns||objects.some(obj=>obj.tagY<boardY||obj.tagY+obj.tagH>boardY+bh);
    if(packedTags){
      const groups=Array.from({length:Math.ceil(objects.length/2)},(_,i)=>objects.slice(i*2,i*2+2));
      groups.forEach((group,index)=>{
        const tagGap=K.design.space(1),width=group.reduce((sum,obj)=>sum+obj.tagW,0)+tagGap*(group.length-1);
        const horizontal=width<=bw;
        const height=horizontal?Math.max(...group.map(obj=>obj.tagH)):group.reduce((sum,obj)=>sum+obj.tagH,0)+tagGap*(group.length-1);
        let x=boardX+(bw-width)/2,y=boardY+(bh-height)/2;
        for(const obj of group){
          obj.tagY=y;obj.tagHide=Math.min(obj.fly,groups[index+1]?.[0].scan??Infinity);
          if(horizontal){obj.tagX=x;x+=obj.tagW+tagGap;}else y+=obj.tagH+tagGap;
          root.appendChild(obj.tag);set(obj.tag,{left:px(obj.tagX),top:px(obj.tagY),zIndex:'31'});
        }
      });
    }else objects.forEach((obj,i)=>{
      for(const previous of objects.slice(0,i))if(obj.tagX<previous.tagX+previous.tagW&&obj.tagX+obj.tagW>previous.tagX)
        obj.tagY=Math.max(obj.tagY,previous.tagY+previous.tagH+6*S);
      set(obj.tag,{top:px(obj.tagY-obj.markerY)});
    });
    // The bright bottom edge is the scan's measured front. Its linear position
    // and every tag's timestamp use the same normalized crop centre.
    const band=el('div','',board);band.dataset.scanBand='';
    const bandH=bh*.16;rect(band,0,-bandH,bw,bandH);
    set(band,{background:`linear-gradient(180deg,${alpha(accent,0)},${alpha(accent,.4)})`,borderBottom:`${px(3*S)} solid ${lineInk}`,boxShadow:`0 ${px(3*S)} ${px(12*S)} ${alpha(accent,.7)}`});
    const statusY=Math.max(boardY+bh,cardsY+ch*rows+gap*(rows-1))+gap*.7;
    const status=statusH?el('div','',root):null;
    if(status){
      status.dataset.scanStatus='';rect(status,safe.x,statusY,safe.w,statusH);
      set(status,{display:'grid',alignItems:'center',justifyItems:'center',color:cardInk,background:surface});
      K.design.surface(status,'badge',{shape:'pill'});
    }
    const statusLine=(copy,done)=>{
      if(!copy)return null;
      const row=el('div','',status);set(row,{gridArea:'1 / 1',width:'100%',height:'100%',minWidth:'0',display:'flex',alignItems:'center',justifyContent:'center'});
      K.design.surfaceGap(row,1);
      const icon=el('div','',row);set(icon,{flex:'0 0 auto',width:px(27*S),height:px(27*S),borderRadius:'50%'});
      if(done){set(icon,{background:accent});icon.innerHTML=`<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M6 12l4 4 8-8" fill="none" stroke="${textOn(accent)}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}
      else set(icon,{border:`${px(3*S)} solid ${alpha(accent,.22)}`,borderTopColor:accent});
      if(copy){
        const text=el('div','bold',row,copy);
        set(text,{maxWidth:px(safe.w-K.design.box('badge').paddingX*2-27*S-K.design.box('badge').gap),flex:'0 1 auto'});
        K.design.apply(text,'label');K.design.truncateLine(text);
      }
      return {row,icon};
    };
    const busy=statusLine(s.scanning,false),done=statusLine(s.complete,true);
    if(busy)busy.row.dataset.scanBusy='';
    if(done)done.row.dataset.scanComplete='';
    return l=>{
      const enter=ease((l-t.enter)/(len*.07));
      set(board,{opacity:enter.toFixed(4),transform:`translateY(${px((1-enter)*18*S)}) scale(${(.97+.03*enter).toFixed(5)})`});
      if(title)set(title,{opacity:enter.toFixed(4),transform:`translateY(${px((1-enter)*10*S)})`});
      categories.forEach(({card},i)=>{const a=ease((l-t.enter-i*len*.012)/(len*.09));set(card,{opacity:a.toFixed(4),transform:`translateY(${px((1-a)*24*S)})`});});
      const front=clamp((l-t.scanStart)/(t.scanEnd-t.scanStart));
      set(band,{opacity:(clamp((l-t.scanStart)/(len*.015))*(1-clamp((l-t.scanEnd)/(t.bandGone-t.scanEnd)))).toFixed(4),transform:`translateY(${px(front*bh)})`});
      for(const obj of objects){
        const tag=ease((l-obj.scan)/(len*.03)),hide=clamp((l-obj.fly)/(len*.03));
        if(packedTags)set(obj.tag,{opacity:(l<obj.tagHide?tag*(1-hide):0).toFixed(4)});
        set(obj.marker,{opacity:(tag*(1-hide)).toFixed(4),transform:`scale(${(1+.12*(1-tag)).toFixed(5)})`});
        const up=ease((l-obj.lift)/(len*.035)),flight=clamp((l-obj.fly)/(obj.land-obj.fly)),travel=flight**3;
        const shrink=(obj.target.size-4*S)/Math.max(obj.w,obj.h),scale=mix(1+.06*up,shrink,travel);
        set(obj.liftNode,{opacity:up.toFixed(4),transform:`translate(${px((obj.target.x-obj.x)*travel)},${px((obj.target.y-obj.y)*travel)}) scale(${scale.toFixed(6)})`,borderWidth:px((4-2*travel)*S/scale)});
        K.design.surfaceRadius(obj.liftNode,{scaleX:scale,scaleY:scale});
        set(obj.ghost,{opacity:(.82*clamp((l-obj.fly)/(len*.03))).toFixed(4)});
        set(obj.dot,{background:l>=obj.land?accent:alpha(cardInk,.14),transform:`scale(${(1+.25*Math.sin(clamp((l-obj.land)/(len*.045))*Math.PI)).toFixed(5)})`});
      }
      const statusState=scanStatusState(l,t,len,{busy:Boolean(busy),done:Boolean(done)});
      if(status)set(status,{opacity:statusState.surfaceOpacity.toFixed(4)});
      if(busy){
        set(busy.row,{opacity:statusState.busyOpacity.toFixed(4)});
        set(busy.icon,{transform:`rotate(${(clamp(l/t.complete)*900).toFixed(3)}deg)`});
      }
      if(done)set(done.row,{opacity:statusState.doneOpacity.toFixed(4)});
    };
  }};
  return {sceneFactories:{scan:given=>definition.build(given)}};
}
// The scene's factory for the kit's context (scenes/folders.mjs).
export function create(K) { return createFamily(K).sceneFactories["scan"]; }
