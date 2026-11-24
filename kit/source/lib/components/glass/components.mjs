import metadata from '../metadata.mjs';
import {timedGlassFactories} from '../timing.mjs';
import {createIslandIcon,islandIconSource,islandIconFilledSource} from '../island-icon.mjs';
import {createTyping} from '../typing.mjs';
import {clamp,phase,smooth,smoother,mix,outBack} from './world.mjs';
import {enumValue,cameraMode as cameraOf,makeWorld,panelWidth,cardSurface,cardHeading,finishCard,cardCopy,updateCard,REST_TILT,fitToFrame,
  orbitCamera,caretOf,actionSlot,pointerOf,typedCount,revealer,pulse,middleOf,fontOf,svgPicture} from './scene-parts.mjs';
import {sliderSize,switchSize} from './controls.mjs';
import {portraitGlassWidth} from './layout.mjs';
import {magnifyingGlassBold} from '../upstream/phosphor-icons/search-icons.mjs';
import {createLettering} from './lettering.mjs';
import {glassGrid} from './grid.mjs';

function island(args){
  const {K,p}=args,s=p.scene;
  const cameraMode=cameraOf(s,'island');
  const exit=enumValue(s.exit,['hold','collapse'],'hold','island.exit');
  const {host,world}=makeWorld(args,'island');
  const copy=cardCopy(K,host,{title:s.title,body:s.body,icon:s.icon});
  const card=world.addCard({width:copy.width,height:copy.height,element:copy.surface});
  world.prepare();
  return (time,duration=p.dur,backdropTime=time)=>{
    const marks=metadata.island.anchors(s,duration);
    const introScale=marks.open/.3;
    const n=clamp(time/duration),enter=phase(time,marks.open,Math.min(1.05,duration*.48));
    const close=exit==='collapse'?smoother(phase(time,marks.collapse,.9*duration)):0;
    const widthGrowth=outBack(enter)*(1-close),heightGrowth=outBack(phase(time,.38*introScale,marks.opened))*(1-close);
    updateCard(card,world,copy.width,copy.height,widthGrowth,heightGrowth,smooth(enter)*(1-close));
    const flight=exit==='collapse'?Math.pow(phase(time,marks.exit,duration),3):0;
    card.group.position.set((K.W*world.U/2+copy.width*world.U)*flight,.1*flight,0);
    card.group.rotation.set(REST_TILT.x,REST_TILT.y+.12*flight,REST_TILT.z);
    const titleOpacity=smooth(phase(time,.58*introScale,Math.min(1.22,duration*.55)));
    card.opacity=exit==='hold'?titleOpacity:titleOpacity*(1-smooth(phase(n,.7,.78)));
    orbitCamera(world,cameraMode,n,{sway:.085,rise:.025,near:.98,rest:1.03});world.render(backdropTime);
  };
}

// The rail of a switch or a slider takes the brand's accent, or a clear green.
function controlColors({K,p,accent}){
  const tinted=K.plan.brand?.tokens?.accent!==undefined||K.plan.brand?.colors?.length||p.explicitAccent;
  return {railAccent:tinted?accent:'#08cd08'};
}

// The submit wave of send-prompt, lighter: the same arc and rim at about half
// the force, with a third of the sparks, and in plain light instead of the
// send button's green. It is laid over a field that is polygons (smoked glass,
// metal); traced glass ripples itself.
const CLEAR_LIGHT={colors:Array.from({length:7},(_,i)=>i%2?[236,242,255]:[255,255,255]),ahead:[255,255,255],behind:[214,226,255]};
function lightClickWave(style){
  for(const key of ['strength','amplitude','swell','blur','rimStrength','gatherGlow','hairlineOpacity'])style[key]*=.55;
  style.particleCount=Math.round(style.particleCount/3);
  style.palette=CLEAR_LIGHT;
}
// How long a click's wave runs, in seconds, and the least it is squeezed to.
const RIPPLE=1.2,RIPPLE_SHORTEST=.25;
// One ring leaves a click, widens as it runs to the far end of the field and
// dies away: its radius, width and lift for the glass, in logical pixels.
function clickRing(progress,reach,deep){
  if(!(progress>0&&progress<1))return null;
  const run=1-Math.pow(1-progress,2.2);
  return {radius:reach*(.04+.96*run),width:reach*mix(.1,.22,run),
    lift:deep*smooth(phase(progress,0,.14))*(1-smooth(phase(progress,.45,1)))};
}

function search(args){
  const {K,p,fg}=args,{el,set,px,design}=K,scene=p.scene;
  const {host,world}=makeWorld(args,'search');
  const field=el('div','pk-glass-search-field',host);
  field.dataset.glassCopy=scene.query;
  const recipe=design.surface(field,'field',{shape:'pill'});
  const height=design.type('body').lineHeight+2*recipe.paddingY;
  const width=panelWidth(K), buttonSize=design.space(6);
  set(field,{position:'absolute',width:px(width),height:px(height),display:'flex',alignItems:'center',color:fg});
  const icon=el('div','pk-glass-search-icon',field);
  icon.innerHTML=magnifyingGlassBold;
  icon.setAttribute('aria-hidden','true');
  const iconSize=design.type('body').size;
  set(icon,{display:'flex',flex:'none',width:px(iconSize),height:px(iconSize),opacity:'.68'});

  const viewport=el('div','pk-glass-search-input',field);
  set(viewport,{position:'relative',minWidth:'0',flex:'1',overflow:'hidden'});
  const hint=scene.placeholder??metadata.search.fields.placeholder.default;
  viewport.setAttribute('role','searchbox');
  viewport.setAttribute('aria-label','Search');
  viewport.setAttribute('aria-placeholder',hint);
  viewport.setAttribute('aria-readonly','true');
  const placeholder=el('div','pk-glass-search-placeholder',viewport,hint);
  design.apply(placeholder,'body');
  set(placeholder,{position:'absolute',inset:'0',whiteSpace:'nowrap',opacity:'.68'});
  placeholder.setAttribute('aria-hidden','true');
  const query=el('div','pk-glass-search-query',viewport);
  design.apply(query,'body');
  set(query,{width:'max-content',minWidth:'100%',whiteSpace:'pre',paddingRight:px(design.unit)});
  const caret=caretOf(K,query,'currentColor');
  const typing=createTyping(K,query,{text:scene.query,caret,unit:'codepoint',id:'search-query'});

  // Keep a full click target but mirror the leading magnifier's visual inset:
  // the glyph stands where the field's padding ends, and the target around it
  // is a layer over the padding, so the row keeps room for no more than the
  // glyph and the target's inner half.
  const reach=(buttonSize-iconSize)/2;
  set(el('div','pk-glass-search-button-place',field),{flex:'none',width:px(buttonSize-reach),height:px(iconSize)});
  const slot=actionSlot(K,field,'pk-glass-search-button',buttonSize,
    {position:'absolute',right:px(recipe.paddingX-reach),top:'50%',marginTop:px(-buttonSize/2)});
  slot.setAttribute('role','button');
  slot.setAttribute('aria-label','Search');
  typing.measure();
  // Measured, like the caret's places, before the field is projected into 3D.
  const letters=createLettering(K,field);
  const drawHint=letters.text(placeholder),drawQuery=letters.glyphs(typing),drawCaret=letters.caret(caret);
  letters.measure();
  const inputWidth=viewport.clientWidth;
  // The round button the field folds into is larger than its place in the field.
  const finalSize=buttonSize*1.5;
  const card=world.addCard({width,height,element:field,backdropOnly:true,fixedOptics:true});
  card.geometry.update(width*world.U,height*world.U,height*world.U/2,.24*K.S,.05*K.S);
  // The pane folds around the middle of the field and the button travels
  // there, so the scene ends on one round button in the centre, the folded
  // pane its body.
  const buttonAt=middleOf(slot),buttonX=buttonAt.x;
  // The same ink as the magnifier on the left; a soft circle comes in under
  // the pointer.
  const button=world.addSendButton(card,{slot,icon:'search',glyphSize:iconSize,ink:fg});

  const definition=metadata.search, marks=definition.anchors(scene,p.dur), keys=definition.keys(scene,marks);
  const trigger=definition.retime(scene,p.dur,p.beatLen)?.cueTime(marks.search)??marks.search;
  const {pointer,cursor}=pointerOf(K,field,'pk-glass-search-pointer',iconSize,2);
  // The click lands where the text begins, right after the magnifier.
  const inputX=viewport.offsetLeft+iconSize*.25, inputY=height*.66;
  const focusPointer={fx:width*.38,fy:height*2.1,x:inputX,y:inputY,
    start:0,arrive:marks.focus*.88,click:marks.focus};
  const searchPointer={fx:inputX,fy:inputY,x:buttonX,y:buttonAt.y,
    start:marks.typed,arrive:mix(marks.typed,marks.search,.90),click:marks.search};
  // A ripple carries a picture of the field's lettering (lettering.mjs): the
  // magnifier, the hint or every typed glyph, the caret.
  const inkColor=host.ownerDocument.defaultView.getComputedStyle(query).color;
  const lensPath=new Path2D(new DOMParser().parseFromString(magnifyingGlassBold,'image/svg+xml').querySelector('path').getAttribute('d'));
  // A canvas places right-to-left glyphs one by one differently from the page.
  // Such a field keeps its own text on the page, and only its glass ripples.
  const carried=!/[\u0590-\u08FF\uFB1D-\uFEFC]/.test(scene.query+hint);
  const copy={count:0,opacity:1,caret:0,left:0};
  function ink(ctx){
    if(copy.opacity<=0||!carried)return;
    ctx.save();
    ctx.fillStyle=inkColor;
    ctx.globalAlpha=.68*copy.opacity;
    if(icon.offsetLeft>=copy.left){
      ctx.save();
      ctx.translate(icon.offsetLeft,icon.offsetTop);ctx.scale(iconSize/256,iconSize/256);ctx.fill(lensPath);
      ctx.restore();
    }
    const from=Math.max(viewport.offsetLeft,copy.left),to=Math.min(viewport.offsetLeft+inputWidth,width-copy.left);
    if(to<=from){ctx.restore();return;}
    ctx.beginPath();ctx.rect(from,0,to-from,height);ctx.clip();
    if(copy.count===0)drawHint(ctx,.68*copy.opacity);
    drawQuery(ctx,copy.opacity,copy.count);
    drawCaret(ctx,copy.opacity*copy.caret);
    ctx.restore();
  }
  // A wave leaves a square the size of the pointer around each click.
  const around=(x,y)=>({x:x-iconSize/2,y:y-iconSize/2,w:iconSize,h:iconSize});
  const fieldClick=around(inputX,inputY),buttonClick=around(buttonX,buttonAt.y);
  // Traced glass ripples itself; a polygon field gets the wave laid over it.
  const ripple=card.slab?world.addRipple(card,{ink}):null;
  const drawWave=ripple?null:world.addSendWave(card,{ink,source:fieldClick,tune:lightClickWave});
  const middle=box=>({x:box.x+box.w/2,y:box.y+box.h/2});
  // A wave runs for RIPPLE seconds, or for less when the music is fast: the
  // first has left the field by the second click, the second by the beat the
  // checkmark lands on. Pinning those actions to beats sets its pace.
  const span=(from,to)=>Math.max(RIPPLE_SHORTEST,Math.min(RIPPLE,to-from));
  const firstWave=span(marks.focus,marks.search),secondWave=span(marks.search,marks.checked);
  const showTyped=revealer(typing,count=>{
    // Expose the insertion point of a long query just like a one-line input.
    viewport.scrollLeft=Math.max(0,typing.caretAt(count).x+design.unit-inputWidth);
    placeholder.style.visibility=count?'hidden':'visible';
  });
  world.prepare();
  return (time,duration=p.dur,backdropTime=time)=>{
    const count=typedCount(keys,time);
    const focused=time>=marks.focus, submitted=time>=marks.search, checked=time>=marks.checked;
    const closing=phase(time,marks.collapse,marks.collapsed), morph=smoother(closing);
    showTyped(count);
    caret.style.opacity=focused&&!submitted?(count&&count<typing.length?'1':String(K.blink(time-marks.focus))):'0';
    copy.count=count;copy.caret=Number(caret.style.opacity);
    const w=mix(width,finalSize,morph), h=mix(height,finalSize,morph);
    const center=width/2,travel=(width/2-buttonX)*morph;
    card.geometry.update(w*world.U,h*world.U,h*world.U/2,.24*K.S,.05*K.S);
    const copyOpacity=1-smooth(phase(closing,0,.6)), visibility=copyOpacity>0?'visible':'hidden';
    copy.opacity=copyOpacity;copy.left=center-w/2;
    const second=time>=marks.search,from=second?buttonClick:fieldClick;
    const wave=phase(time-(second?marks.search:marks.focus),0,second?secondWave:firstWave);
    if(ripple){
      const ring=clickRing(wave,width,height*.2);
      // While the glass carries the lettering, the page's own copy is unseen
      // but stays in place and counts as shown.
      const unseen=ripple(ring&&{...middle(from),...ring})&&carried?'opacity(0)':'none';
      viewport.style.filter=unseen;icon.style.filter=unseen;
    }else drawWave(wave,from);
    set(field,{clipPath:closing>0?`inset(0 ${px(center-w/2)} round ${px(h/2)})`:'none'});
    set(viewport,{opacity:String(copyOpacity),visibility});

    set(icon,{opacity:String(.68*copyOpacity),visibility});
    viewport.setAttribute('aria-hidden',String(copyOpacity===0));
    slot.setAttribute('aria-busy',String(submitted&&!checked));
    slot.setAttribute('aria-label',checked?'Search complete':'Search');
    cursor(time,time<marks.typed?focusPointer:searchPointer);
    // The pointer leaves once it has put the caret in the field and returns
    // as it sets off for the button.
    const typingAway=smooth(phase(time,marks.focus+.06,marks.focus+.2))*(1-smooth(phase(time,marks.typed,marks.typed+.12)));
    pointer.style.opacity=String((1-typingAway)*(1-smooth(phase(time,marks.search+duration*.04,marks.search+duration*.14))));
    const press=pulse(time,marks.search,marks.search+.18);
    // The circle appears as the pointer comes over the button. It gives way
    // to the pane as that folds into the same circle: two discs of one size,
    // one flat and one bevelled, would show a double edge.
    const over=smooth(phase(time,mix(marks.typed,marks.search,.74),searchPointer.arrive));
    button.draw((1-.12*press)*mix(1,finalSize/buttonSize,morph),{loading:submitted&&!checked?Math.max(0,backdropTime-trigger):null,
      checked,fill:over,shift:travel,disc:over*(1-morph)});
    world.render(backdropTime);
  };
}

function controls(args){
  const {K,p}=args,{el,set,px}=K,s=p.scene;
  const cameraMode=cameraOf(s,'controls');
  const {host,world}=makeWorld(args,'controls');
  const {surface,width,recipe}=cardSurface(K,host,[s.title,...s.toggles,s.slider]);
  surface.classList.add('pk-glass-controls');
  const contentW=width-recipe.paddingX*2,unit=K.design.unit;
  if(s.title)cardHeading(K,surface,s.title,contentW);
  const marks=metadata.controls.anchors(s,p.dur);
  const {railAccent}=controlColors(args);
  const tw=switchSize.width*unit,th=switchSize.height*unit;
  const rows=s.toggles.map((name,i)=>{
    const row=el('div','pk-glass-control-row',surface);
    // A 32-unit single-line row plus the card's 12-unit gap gives a 44-unit pitch.
    // Wrapped labels can grow their own row without shifting the control column.
    set(row,{display:'flex',alignItems:'center',justifyContent:'space-between',gap:px(recipe.gap),minHeight:px(K.design.space(6))});
    const label=el('div','pk-glass-control-label',row,name);
    set(label,{minWidth:'0',flex:'1'});
    K.design.fitSize(label,contentW-tw-recipe.gap,K.design.type('body').lineHeight*2,'body',{wrap:'anywhere'});
    const track=el('div','pk-glass-switch',row);
    track.setAttribute('role','switch');track.setAttribute('aria-label',name);track.setAttribute('aria-disabled','true');
    set(track,{width:px(tw),height:px(th),flex:'none'});
    return {track,at:marks.toggles[i]};
  });
  let slider=null;
  if(s.slider){
    const row=el('div','pk-glass-slider-row',surface);
    set(row,{display:'flex',flexDirection:'column'});
    K.design.surfaceGap(row,1);
    const label=el('div','pk-glass-control-label',row,s.slider);
    K.design.fitSize(label,contentW,K.design.type('body').lineHeight*2,'body',{wrap:'anywhere'});
    const track=el('div','pk-glass-slider',row);
    track.setAttribute('role','progressbar');track.setAttribute('aria-label',s.slider);
    track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
    set(track,{width:'100%',height:px(sliderSize.diameter*unit)});
    slider={track};
  }
  const copy=finishCard(K,surface,width);
  const card=world.addCard({width,height:copy.height,element:surface,backdropOnly:true});
  const models=world.addControls(card,{switchSlots:rows.map(row=>row.track),sliderSlot:slider?.track,accent:railAccent});
  // Long, wrapped rows can exceed the frame. Fit the whole attached panel so
  // type, control proportions and spacing stay on the same shared scale.
  card.group.scale.setScalar(fitToFrame(K,copy.height));
  world.prepare();
  return (time,duration=p.dur,backdropTime=time)=>{
    // Copy is readable before the existing first switch cue at 0.5 seconds.
    const enter=phase(time,marks.open,.42),n=clamp(time/duration);
    updateCard(card,world,width,copy.height,outBack(enter),outBack(phase(time,.06,.46)),smooth(enter));
    card.group.rotation.set(REST_TILT.x,REST_TILT.y,REST_TILT.z);
    card.opacity=smooth(phase(time,.2,.44));
    for(const [index,row] of rows.entries()){
      const k=smooth(phase(time,row.at,row.at+.24));
      models.updateSwitch(index,k);
      row.track.setAttribute('aria-checked',String(time>=row.at+.04));
    }
    if(slider){
      const travel=K.expoInOut(phase(time,marks.slider,marks.sliderEnd));
      const value=mix(.12,.82,travel);
      models.updateSlider(value,4*travel*(1-travel));
      slider.track.setAttribute('aria-valuenow',String(Math.round(value*100)));
    }
    orbitCamera(world,cameraMode,n);world.render(backdropTime);
  };
}

function ask(args){
  const {K,p,accent}=args,{el,set,px}=K,s=p.scene;
  const camera=cameraOf(s,'ask');
  const {host,world}=makeWorld(args,'ask');
  const {surface,width,recipe}=cardSurface(K,host,[s.text,s.reply]);
  surface.classList.add('pk-glass-ask');
  const {unit}=K.design,iconSize=K.design.space(5),sendSize=K.design.space(6),seedSize=K.design.space(7);
  const contentWidth=width-recipe.paddingX*2,textInset=iconSize+recipe.gap;
  const row=el('div','pk-glass-ask-row',surface);
  set(row,{display:'grid',gridTemplateColumns:`${px(iconSize)} minmax(0,1fr) ${px(sendSize)}`,alignItems:'start',gap:px(recipe.gap),flex:'none'});
  const icon=createIslandIcon(K,row,'sparkles',iconSize);
  icon.setAttribute('aria-hidden','true');
  const prompt=el('div','pk-glass-ask-prompt',row);
  set(prompt,{minWidth:'0',boxSizing:'border-box',paddingRight:px(2*unit)});
  const caret=caretOf(K,prompt,accent);
  const typing=createTyping(K,prompt,{text:s.text,caret,unit:'codepoint',id:'ask-prompt'});
  K.design.fitSize(prompt,contentWidth-textInset-sendSize-recipe.gap,K.safe.h*.72,'cardTitle',{wrap:'anywhere'});
  const firstLineHeight=parseFloat(prompt.style.lineHeight);
  set(icon,{marginTop:px((firstLineHeight-iconSize)/2)});
  const send=actionSlot(K,row,'pk-glass-ask-send',sendSize);
  send.setAttribute('aria-hidden','true');

  const promptHeight=surface.offsetHeight;
  const seedOffsetX=(width-iconSize)/2-recipe.paddingX;
  const seedOffsetY=promptHeight/2-recipe.paddingY-firstLineHeight/2;
  let reply=null,words=[];
  if(s.reply){
    reply=el('div','pk-glass-ask-reply',surface);
    set(reply,{marginLeft:px(textInset),flex:'none'});
    for(const part of s.reply.split(/(\s+)/u)){
      if(!part)continue;
      if(part.trim())words.push(el('span','',reply,part));
      else reply.append(part);
    }
    K.design.fitSize(reply,contentWidth-textInset,K.safe.h*.65,'body',{wrap:'anywhere'});
  }
  const fullHeight=surface.offsetHeight;
  // Cache caret positions in the measured text column before projecting it into 3D.
  typing.measure();
  const card=world.addCard({width,height:fullHeight,element:surface,fixedOptics:true,backdropOnly:true});
  // The answer opens below the prompt: the arrow points there.
  const button=world.addSendButton(card,{slot:send,icon:'down',ink:args.fg});
  const fitScale=fitToFrame(K,fullHeight);
  // Register the finished sheet's pose before the opening animation scales
  // it. Illumination stays here as the edge advances to reveal the answer.
  card.group.rotation.set(REST_TILT.x,REST_TILT.y,REST_TILT.z);
  card.group.scale.setScalar(fitScale);
  const marks=metadata.ask.anchors(s,p.dur);
  // Short films and long replies still reach their last word before the final hold.
  const wordDelay=reply?Math.min(.05,Math.max(0,p.dur-marks.reply-.43)/Math.max(1,words.length-1)):0;
  const showTyped=revealer(typing);
  world.prepare();
  return (time,duration=p.dur,backdropTime=time)=>{
    const open=phase(time,marks.open,.51),opening=outBack(open);
    const answer=reply?smoother(phase(time,marks.reply,marks.reply+.3)):0;
    const height=mix(promptHeight,fullHeight,answer);
    // Anchor the top of the open prompt as the same mesh extends under the reply.
    card.height=height;set(surface,{height:px(height)});
    updateCard(card,world,width,height,opening,opening,smooth(open),seedSize);
    const press=pulse(time,.2,marks.open);
    card.group.scale.setScalar(fitScale*(.02+.98*outBack(phase(time,0,.18)))*(1-.12*press));
    card.group.position.set(0,(fullHeight-height)*world.U*fitScale/2,0).applyQuaternion(card.group.quaternion);
    card.opacity=smooth(phase(time,0,.09));
    const iconTravel=1-smooth(open);
    set(icon,{transform:`translate(${px(seedOffsetX*iconTravel)},${px(seedOffsetY*iconTravel)})`});
    const shown=Math.round(K.prog(time,marks.type,marks.typed-marks.type)*typing.length);
    showTyped(shown);
    set(prompt,{opacity:String(smooth(open))});
    set(caret,{opacity:time>=marks.send?'0':shown>0&&shown<typing.length?'1':String(K.blink(time))});
    const sendPress=pulse(time,marks.send,marks.send+.22);
    // Nobody points at this button: its circle comes in as it is pressed.
    button.draw(outBack(phase(time,.36,.52))*(1-.14*sendPress),{fill:smooth(phase(time,marks.send-.12,marks.send))});
    if(reply){
      set(reply,{opacity:String(answer)});
      words.forEach((word,i)=>{const at=marks.reply+.15+i*wordDelay;set(word,{opacity:String(smooth(phase(time,at,at+.16)))});});
    }
    // Orbit while the prompt is being typed. The camera settles before the
    // lower edge opens for the reply, keeping its motion separate from resizing.
    orbitCamera(world,camera,phase(time,.51,reply?marks.reply:duration));world.render(backdropTime);
  };
}

// Track the measured insertion point in the plane of the sheet. Smoothing each
// change in focus keeps a line wrap from snapping the camera back to the margin.
function pullbackCamera(K,world,prompt,typing,keys,marks,width,height,faceZ,zoom) {
  const closeWidth=K.W/zoom;
  const initial=typing.parts[0].before;
  const rtl=prompt.ownerDocument.defaultView.getComputedStyle(prompt).direction==='rtl';
  function focus(point) {
    const x=rtl?Math.min(initial.x-closeWidth*.30,point.x+closeWidth*.13)
      :Math.max(initial.x+closeWidth*.30,point.x-closeWidth*.13);
    return {x:(prompt.offsetLeft+x-width/2)*world.U,
      y:(height/2-prompt.offsetTop-point.y-point.h/2)*world.U};
  }
  const first=focus(initial),points=keys.map(key=>({...focus(typing.caretAt(key.count)),at:key.at}));
  const follow=(marks.typed-marks.type)*.22;
  const finalZoom=Math.min(1,K.safe.h*.92/height);
  return time=>{
    let x=first.x,y=first.y,previous=first;
    for(const point of points){
      const start=point.at-follow*.5;
      if(time<start)break;
      const amount=smoother(phase(time,start,Math.min(marks.pull,start+follow)));
      x+=(point.x-previous.x)*amount;y+=(point.y-previous.y)*amount;
      previous=point;
    }
    const travel=smoother(phase(time,marks.pull,marks.landed));
    const depth=world.distance/Math.exp(mix(Math.log(zoom),Math.log(finalZoom),travel));
    const arc=Math.sin(Math.PI*travel);
    x*=1-travel;y*=1-travel;
    world.camera.position.set(x+depth*(mix(-.045,.012,travel)+.21*arc),
      y+depth*(mix(.016,.003,travel)+.065*arc),faceZ+depth);
    world.camera.lookAt(x,y,faceZ);
  };
}

function sendPrompt(args) {
  const {K,p,fg,accent}=args,{el,set,px,design}=K,s=p.scene;
  const cues=metadata['send-prompt'],marks=cues.anchors(s,p.dur),keys=cues.keys(s,marks);
  const {world,host}=makeWorld(args,'send-prompt');
  const {surface,width,recipe}=cardSurface(K,host,[s.text,...(s.chips??[])]);
  surface.classList.add('pk-send-prompt');
  const contentWidth=width-recipe.paddingX*2,zoom=K.H>K.W?2.8:3.6,chips=[];
  const inkLayer=el('div','pk-send-prompt-ink',surface);
  set(inkLayer,{display:'flex',flexDirection:'column',gap:'inherit',minWidth:'0'});
  if(s.chips?.length){
    const row=el('div','pk-pullback-chips',inkLayer);
    set(row,{display:'flex',alignItems:'start',flexWrap:'wrap',gap:px(design.space(2))});
    for(const name of s.chips){
      const chip=el('div','pk-pullback-chip',row);
      design.surface(chip,'badge',{shape:'pill',density:'compact'});
      set(chip,{flex:'none',width:'max-content',maxWidth:'100%',border:`1px solid ${K.alpha(fg,.24)}`,background:K.alpha(fg,.10)});
      const label=el('span','pk-pullback-chip-label',chip,name);
      label.title=name;design.apply(label,'label');
      set(label,{display:'block',whiteSpace:'normal',overflowWrap:'anywhere'});
      chips.push(chip);
    }
  }
  const prompt=el('div','pk-pullback-prompt',inkLayer);
  const mention=cues.mention(s);
  let token;
  if(mention){
    const letters=[...s.text];
    prompt.append(letters.slice(0,mention.start).join(''));
    token=el('span','pk-pullback-mention',prompt);
    token.textContent=mention.text;
    set(token,{borderRadius:px(design.unit*3),boxDecorationBreak:'clone'});
    prompt.append(letters.slice(mention.end).join(''));
  }else prompt.textContent=s.text;
  // The caret is the ink of the text it writes.
  const caret=caretOf(K,prompt,fg,'.92em');
  const typing=createTyping(K,prompt,{caret,unit:'codepoint',id:'pullback-prompt'});
  design.fitSize(prompt,contentWidth,K.safe.h*.66,'cardTitle',{wrap:'anywhere'});
  const bar=el('div','pk-pullback-toolbar',inkLayer),buttonSize=design.space(6);
  set(bar,{display:'flex',alignItems:'center',gap:px(design.space(3))});
  const tools=['plus','sparkles'].map(name=>{
    const icon=createIslandIcon(K,bar,name,design.space(4));
    icon.setAttribute('aria-hidden','true');set(icon,{opacity:'.70'});
    return icon;
  });
  const send=actionSlot(K,bar,'pk-pullback-send',buttonSize,{marginLeft:'auto'});
  typing.measure();
  // The wave bends the card's lettering as it stands when the prompt is
  // sent: chips landed, the mention lit, every glyph typed, no caret
  // (lettering.mjs). It is drawn over the current panel pixels even when
  // seeking backwards.
  const letters=createLettering(K,surface);
  const chipInk=chips.map(chip=>[letters.box(chip,{fill:K.alpha(fg,.10),stroke:K.alpha(fg,.24),radius:'pill'}),letters.text(chip.firstElementChild)]).flat();
  const mentionInk=token?letters.box(token,{fill:K.alpha(accent,.22),radius:design.unit*3}):null;
  const promptInk=letters.glyphs(typing),toolInk=tools.map(letters.icon);
  letters.measure();
  const ink=ctx=>{
    for(const draw of chipInk)draw(ctx);
    mentionInk?.(ctx);promptInk(ctx);
    for(const draw of toolInk)draw(ctx,.70);
  };
  const height=surface.offsetHeight;
  // A mention is typed like the rest and takes its highlight once it is whole.
  const mentioned=mention?keys.find(key=>key.count>=mention.end).at:0;
  const mentionFade=Math.min((marks.pull-marks.typed)*.8,p.dur*.04);
  const card=world.addCard({width,height,element:surface,backdropOnly:true,fixedOptics:true});
  const button=world.addSendButton(card,{slot:send,ink:args.fg});
  const focus=pullbackCamera(K,world,prompt,typing,keys,marks,width,height,card.contentZ,zoom);
  const {pointer,cursor}=pointerOf(K,surface,'pk-pullback-pointer',buttonSize*.69,3);
  const click={x:send.offsetLeft+buttonSize/2,y:send.offsetTop+buttonSize/2,
    fx:width+buttonSize,fy:height+buttonSize,start:mix(marks.pull,marks.send,.62),arrive:mix(marks.landed,marks.send,.86),
    click:marks.send};
  const drawWave=world.addSendWave(card,{ink,source:{x:send.offsetLeft,y:send.offsetTop,w:send.offsetWidth,h:send.offsetHeight}});
  const showTyped=revealer(typing);
  world.prepare();
  return (time,duration=p.dur,backdropTime=time)=>{
    showTyped(typedCount(keys,time));
    set(caret,{opacity:time<marks.typed?'1':time<marks.send?String(K.blink(time-marks.typed)):'0'});
    if(token)set(token,{backgroundColor:K.alpha(accent,.22*smooth(phase(time,mentioned,mentioned+mentionFade)))});
    chips.forEach((chip,i)=>{
      const landed=smooth(phase(time,marks.chips[i],marks.chips[i]+duration*.075));
      set(chip,{opacity:String(landed),transform:`translateY(${px((1-landed)*design.space(3))})`});
    });
    const reveal=smooth(phase(time,marks.pull,marks.landed));
    set(bar,{opacity:String(reveal)});
    const press=pulse(time,marks.send,marks.send+duration*.055);
    button.draw(reveal*(1-.14*press),{fill:smooth(phase(time,mix(click.start,click.arrive,.7),click.arrive))});
    cursor(time,click);
    set(pointer,{opacity:String(1-smooth(phase(time,mix(marks.send,marks.sent,.65),marks.sent)))});
    drawWave(phase(time,marks.send,marks.sent));
    focus(time);world.render(backdropTime);
  };
}

function glassFlow(args){
  const {K,p}=args,s=p.scene,{host,world}=makeWorld(args,'glass-flow');
  const copies=[cardCopy(K,host,{title:s.title,body:s.body}),cardCopy(K,host,{title:s.nextTitle,body:s.nextBody})];
  const width=copies[0].width;
  const height=Math.max(...copies.map(c=>c.height));
  for(const c of copies){c.height=height;K.set(c.surface,{height:K.px(height)});}
  const depth=world.distance*1.45;
  const cards=copies.map((c,i)=>world.addCard({width,height,element:c.surface,z:i?-depth:0}));
  cards[0].group.rotation.set(.015,-.045,.005);cards[1].group.rotation.set(-.018,.045,-.008);
  world.prepare();
  return (time,duration=p.dur,backdropTime=time)=>{
    const marks=metadata['glass-flow'].anchors(s,duration),enter=phase(time,marks.open,marks.opened);
    updateCard(cards[0],world,width,height,outBack(phase(time,marks.open,marks.opened-.03*duration)),outBack(phase(time,marks.open+.015*duration,marks.opened)),smooth(enter));
    updateCard(cards[1],world,width,height,1,1,1);
    const orbit=smoother(phase(time,marks.open-.005*duration,marks.flight)),dive=smoother(phase(time,marks.flight,marks.land)),settle=smooth(phase(time,marks.land,duration));
    const d=world.distance;
    world.camera.position.set(mix(mix(-.09,.12,orbit)*d,.003*d,dive)-.05*d*settle,
      mix(.032*d,.006*d,dive)+.015*d*settle,mix(mix(1.1,.96,orbit)*d,-depth+d*1.02,dive)-.04*d*settle);
    world.camera.lookAt(.005*d*dive,0,-depth*smoother(phase(time,marks.flight-.02*duration,marks.cross-.04*duration)));
    cards[0].group.visible=world.camera.position.z>-.35;
    cards[1].group.visible=time>=marks.cross-.055*duration;
    cards[0].opacity=smooth(phase(time,marks.title,marks.titleShown))*(1-smooth(phase(time,marks.flight+.015*duration,marks.flight+.07*duration)));
    cards[1].opacity=smooth(phase(time,marks.nextTitle,marks.nextTitleShown));
    const crossing=Math.exp(-Math.pow((world.camera.position.z-.04)/(d*.16),2));
    world.render(backdropTime,{warm:smoother(phase(time,marks.cross-.015*duration,marks.cross+.065*duration)),dive:crossing,travel:dive});
  };
}

// Paint the fitted browser text into a real texture which participates in
// Three's transmission pass. Range measurements happen only during setup.
async function textTexture(K,line,text){
  const canvas=line.ownerDocument.createElement('canvas');canvas.width=K.W;canvas.height=K.H;
  const context=canvas.getContext('2d'),origin=K.stage.getBoundingClientRect();
  const scale=origin.width/K.W||1,style=getComputedStyle(line);
  context.font=fontOf(style);
  context.fillStyle=style.color;context.textBaseline='alphabetic';
  context.letterSpacing=style.letterSpacing;
  const fontSize=Number.parseFloat(style.fontSize),metric=context.measureText('Mg');
  const baseline=metric.fontBoundingBoxAscent??fontSize*.8;
  const walker=line.ownerDocument.createTreeWalker(line,NodeFilter.SHOW_TEXT),runs=[];
  while(walker.nextNode()){
    const node=walker.currentNode;if(node.parentElement.closest('svg'))continue;
    let run=null;
    for(const part of new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(node.nodeValue)){
      const range=line.ownerDocument.createRange();range.setStart(node,part.index);range.setEnd(node,part.index+part.segment.length);
      const rect=range.getBoundingClientRect();
      const x=(rect.x-origin.x)/scale,y=(rect.y-origin.y)/scale;
      if(!run||Math.abs(run.y-y)>fontSize*.25){run={text:part.segment,x,y};runs.push(run);}else run.text+=part.segment;
    }
  }
  for(const run of runs)context.fillText(run.text,run.x,run.y+baseline);
  await Promise.all([...line.querySelectorAll('.emoji svg')].map(async svg=>{
    const rect=svg.getBoundingClientRect(),image=svgPicture(svg);
    await image.decode();
    context.drawImage(image,(rect.x-origin.x)/scale,(rect.y-origin.y)/scale,rect.width/scale,rect.height/scale);
  }));
  const entry={text,role:line.dataset.designRole,step:Number(line.dataset.designStep),unit:Number(line.dataset.designUnit),size:fontSize,
    lineHeight:Number.parseFloat(style.lineHeight),tracking:style.letterSpacing,weight:Number(style.fontWeight),width:line.offsetWidth};
  (K.rasterTypography??=[]).push(entry);
  return {canvas,receipt:{text,sourceFont:context.font,sourceColor:style.color,typography:entry}};
}
function lens(args){
  const {K,p}=args,s=p.scene,cameraMode=cameraOf(s,'lens','static');
  const {host,world}=makeWorld(args,'lens');
  const projection=cameraMode==='orbit'?K.el('div','pk-glass-lens-projection',host):null;
  if(projection)K.set(projection,{position:'absolute',inset:'0',transformOrigin:'0 0'});
  const text=K.plain(s.text),wrap=K.el('div','pk-glass-lens-layout',projection??host);
  const portraitWidth=portraitGlassWidth(K),textWidth=portraitWidth??K.safe.w*.92;
  const left=portraitWidth===null?K.safe.x+K.safe.w*.04:(K.W-textWidth)/2;
  K.set(wrap,{position:'absolute',left:K.px(left),top:K.px(K.H*.39),width:K.px(textWidth)});
  const line=K.el('div','pk-glass-lens-source',wrap,text);
  K.set(line,{color:args.fg,width:'100%',textAlign:'center'});
  K.design.fitSize(line,textWidth,K.safe.h*.3,'display',{wrap:'anywhere'});
  const lineH=line.offsetHeight;
  const caption=s.sub?K.el('div','pk-glass-lens-caption',wrap,s.sub):null;
  if(caption){K.design.apply(caption,'label');K.set(caption,{marginTop:K.px(K.design.space(3)),textAlign:'center',color:args.fg});}
  K.set(wrap,{top:K.px((K.H-wrap.offsetHeight)/2)});
  const textTop=wrap.offsetTop;
  const lensWidth=Math.min(K.W*.35,Math.max(lineH*1.25,260*K.S)),lensHeight=lineH*1.45;
  const card=world.addCard({width:lensWidth,height:lensHeight,lens:true});
  card.geometry.update(lensWidth*world.U,lensHeight*world.U,Math.min(lensWidth,lensHeight)*world.U/2,.44,.1);
  const sourceReady=Promise.all([textTexture(K,line,text),...(caption?[textTexture(K,caption,s.sub)]:[])]).then(([main,sub])=>{
    if(sub)main.canvas.getContext('2d').drawImage(sub.canvas,0,0);
    const receipt={...main.receipt,textureCopy:[text,s.sub].filter(Boolean).join('\n'),...(sub?{subtitle:s.sub,subtitleFont:sub.receipt.sourceFont}:{})};
    world.addTextTexture(main.canvas,receipt,{card,projection});
    world.canvas.dataset.designRaster=JSON.stringify(K.rasterTypography??[]);return world.prepare();
  });
  K.defer(sourceReady);
  const travel=(portraitWidth??K.safe.w)*.62;
  return (time,duration=p.dur,backdropTime=time)=>{
    const marks=metadata.lens.anchors(s,duration);
    const n=clamp(time/duration),progress=smoother(phase(time,marks.sweep,marks.sweepEnd));
    card.group.position.set(mix(-travel,travel,progress)*world.U,(K.H/2-textTop-lineH/2)*world.U,.18);
    card.group.rotation.set(0,mix(-.13,.13,progress),-.025);
    card.group.visible=n>=.12&&n<.94;
    orbitCamera(world,cameraMode,n,{sway:.055,rise:0,far:1,near:1,rest:1,target:-.2});world.render(backdropTime);
  };
}

// Text that does not fit its lines at the role's smallest step keeps that
// step and takes the lines it needs.
function smallestStep(K,nodes,role,width){
  const step=K.design.steps(role).at(-1).step;
  for(const node of nodes){K.design.apply(node,role,{step});K.set(node,{maxWidth:K.px(width),whiteSpace:'normal',overflowWrap:'anywhere'});}
  return K.design.type(role,step);
}

// A glass panel that explains a process: it grows out of a pill, its title
// comes in, then the steps one after another, each a numbered mark that pops
// and a line that settles beside it. Before a collapsing exit the steps hop
// in a wave. Columns in a wide frame, rows in a square or tall one. After the
// look of "Liquid Glass Infographic List" (SOURCE.json); every measure is the
// family's grid (grid.mjs).
function glassSteps(args){
  const {K,p}=args,{el,set,px}=K,s=p.scene;
  const cameraMode=cameraOf(s,'glass-steps');
  const exit=enumValue(s.exit,['hold','collapse'],'hold','glass-steps.exit');
  const {host,world}=makeWorld(args,'glass-steps');
  const {surface,width}=cardSurface(K,host,[s.title,...s.items]);
  surface.classList.add('pk-glass-steps');
  const G=glassGrid(K),count=s.items.length;
  // Text that does not fit its lines at the role's smallest step keeps that
  // step and takes the lines it needs: the panel grows with it and is then
  // scaled to the frame (fitToFrame), so nothing is cut and nothing leaves.
  const smallest=(nodes,role,width)=>smallestStep(K,nodes,role,width);
  let heading=null;
  if(s.title){
    try{heading=cardHeading(K,surface,s.title,G.content).heading;}
    catch{heading=surface.querySelector('.pk-glass-heading');smallest([heading],G.type.title.role,G.content);}
    set(heading,{opacity:'0'});
  }
  // Columns when the frame is wide and the phrases fit them at a size the
  // type's role allows; rows otherwise, the mark on the first line's centre.
  const lay=(rows,gaps)=>{
    const list=el('div','pk-glass-step-list',surface);
    set(list,{display:'flex',flexDirection:rows?'column':'row',alignItems:rows?'stretch':'flex-start',gap:px(rows?gaps.rows:gaps.columns)});
    const steps=s.items.map((text,i)=>{
      const item=el('div','pk-glass-step',list);
      // A row reads from its mark; a column is centred under it.
      set(item,{display:'flex',flexDirection:rows?'row':'column',alignItems:rows?'flex-start':'center',gap:px(rows?gaps.lead:gaps.stack),flex:rows?'none':'1',minWidth:'0'});
      const mark=el('div','pk-glass-step-number',item,String(i+1));
      K.design.apply(mark,G.type.mark.role,{step:G.type.mark.step});
      set(mark,{flex:'none',width:px(G.mark.size),height:px(G.mark.size),display:'grid',placeItems:'center',
        borderRadius:px(G.mark.radius),boxShadow:`inset 0 0 0 ${px(G.mark.stroke)} currentColor`,opacity:'0'});
      const line=el('div','pk-glass-step-text',item,text);
      set(line,{textAlign:rows?'left':'center',minWidth:'0',opacity:'0'});
      return {item,mark,line};
    });
    // The steps are one list: all are set in the step the longest one needs.
    const lines=steps.map(step=>step.line),role=G.type.item.role,beside=G.beside(G.mark.size,gaps.lead);
    const columnW=(G.content-gaps.columns*(count-1))/count;
    let fitted;
    try{fitted=K.design.fitGroup(lines,{role,w:rows?beside:columnW,h:G.type.item.height,wrap:'anywhere'});}
    catch{
      if(!rows){list.remove();return null;}
      fitted=smallest(lines,role,beside);
    }
    if(rows)for(const step of steps)set(step.line,{paddingTop:px(G.firstLine(fitted.lineHeight))});
    // The title stands a section's gap above the steps, centred over columns.
    K.design.surfaceGap(surface,gaps.sectionStep);
    if(heading)set(heading,{textAlign:rows?'left':'center'});
    return {rows,steps,list,height:surface.offsetHeight};
  };
  // Airy when the panel has room at its own size; dense when the airy one
  // would have to be scaled down to fit the frame.
  let laid=(G.wide?lay(false,G.density('airy')):null)??lay(true,G.density('airy'));
  let density='airy';
  if(fitToFrame(K,laid.height)<1){const rows=laid.rows;laid.list.remove();laid=lay(rows,G.density('dense'))??lay(true,G.density('dense'));density='dense';}
  const {rows,steps}=laid;
  Object.assign(surface.dataset,{stepsLayout:rows?'rows':'columns',stepsDensity:density});
  const copy=finishCard(K,surface,width);
  const card=world.addCard({width,height:copy.height,element:surface,backdropOnly:true});
  card.group.scale.setScalar(fitToFrame(K,copy.height));
  world.prepare();
  const T=G.time;
  return (time,duration=p.dur,backdropTime=time)=>{
    const live=metadata['glass-steps'].anchors(s,duration);
    const n=clamp(time/duration),enter=phase(time,live.open,live.open+T.open);
    const close=exit==='collapse'?smoother(phase(time,live.collapse,duration*.98)):0;
    updateCard(card,world,width,copy.height,outBack(enter)*(1-close),outBack(phase(time,live.open+.04,live.open+T.open+.04))*(1-close),smooth(enter)*(1-close));
    card.group.rotation.set(REST_TILT.x,REST_TILT.y,REST_TILT.z);
    card.opacity=smooth(phase(time,live.open+.16,live.open+T.open))*(1-smooth(phase(close,.05,.55)));
    if(heading)set(heading,{opacity:smooth(phase(time,live.title,live.title+T.fade)).toFixed(4)});
    steps.forEach((step,i)=>{
      const at=live.items[i],settle=smooth(phase(time,at+.1,at+.1+T.pop));
      const wave=exit==='collapse'?Math.sin(Math.PI*phase(time,live.wave+i*T.stagger,live.wave+i*T.stagger+T.hop)):0;
      set(step.item,{transform:`translateY(${px(-G.move.hop*wave)})`});
      set(step.mark,{opacity:smooth(phase(time,at,at+.12)).toFixed(4),transform:`scale(${(.4+.6*outBack(phase(time,at,at+T.pop))).toFixed(4)})`});
      set(step.line,{opacity:settle.toFixed(4),transform:`translateY(${px((1-settle)*G.move.settle)})`});
    });
    orbitCamera(world,cameraMode,n,{sway:.07,rise:.02,near:1,rest:1.04});world.render(backdropTime);
  };
}

// A glass panel that ticks a list off: it grows out of a pill, its title
// comes in, then the items one after another, each an empty box that pops, a
// line read word by word, and a tick drawn into the box when the line is
// said. Always rows: a checklist is read down. After the look of "Liquid
// Glass List" (SOURCE.json); every measure is the family's grid (grid.mjs).
function glassChecklist(args){
  const {K,p}=args,{el,set,px}=K,s=p.scene;
  const cameraMode=cameraOf(s,'glass-checklist');
  const exit=enumValue(s.exit,['hold','collapse'],'hold','glass-checklist.exit');
  const {host,world}=makeWorld(args,'glass-checklist');
  const {surface,width}=cardSurface(K,host,[s.title,...s.items]);
  surface.classList.add('pk-glass-checklist');
  const G=glassGrid(K),count=s.items.length,done=s.done??count;
  let heading=null;
  if(s.title){
    try{heading=cardHeading(K,surface,s.title,G.content).heading;}
    catch{heading=surface.querySelector('.pk-glass-heading');smallestStep(K,[heading],G.type.title.role,G.content);}
    set(heading,{opacity:'0',textAlign:'left'});
  }
  const tick=islandIconSource('check');
  const lay=gaps=>{
    const list=el('div','pk-glass-check-list',surface);
    set(list,{display:'flex',flexDirection:'column',alignItems:'stretch',gap:px(gaps.rows)});
    const rows=s.items.map((text,i)=>{
      const item=el('div','pk-glass-check',list);
      // A box the size of its text stands closer to it than a mark does: the
      // density's gap between a lead and what is stacked under it.
      set(item,{display:'flex',flexDirection:'row',alignItems:'flex-start',gap:px(gaps.stack),minWidth:'0'});
      // The box is the grid's check, sized to the text beside it; the tick is
      // the icon set's own check, an alpha mask in the text's ink, uncovered
      // from its left.
      const box=el('div','pk-glass-check-box',item);
      set(box,{flex:'none',width:px(G.check.size),height:px(G.check.size),display:'grid',placeItems:'center',
        borderRadius:px(G.check.radius),boxShadow:`inset 0 0 0 ${px(G.check.stroke)} currentColor`,opacity:'0'});
      const art=el('span','pk-glass-check-tick',box);
      art.setAttribute('aria-hidden','true');
      set(art,{display:'block',width:px(G.check.glyph),height:px(G.check.glyph),backgroundColor:'currentColor',
        maskImage:`url("${tick}")`,maskMode:'alpha',maskSize:'100% 100%',maskRepeat:'no-repeat',clipPath:'inset(0 100% 0 0)'});
      // The line is its words, each lit in turn as the line is read.
      const line=el('div','pk-glass-check-text',item);
      const words=String(text).trim().split(/\s+/u).filter(Boolean).map((word,k,all)=>{
        const span=el('span','pk-glass-check-word',line,word+(k<all.length-1?' ':''));
        set(span,{opacity:'0'});
        return span;
      });
      set(line,{textAlign:'left',minWidth:'0'});
      return {item,box,art,line,words,ticked:i<done};
    });
    // The items are one list: all are set in the step the longest one needs.
    const lines=rows.map(row=>row.line),role=G.type.item.role,beside=G.beside(G.check.size,gaps.stack);
    let fitted;
    try{fitted=K.design.fitGroup(lines,{role,w:beside,h:G.type.item.height,wrap:'anywhere'});}
    catch{fitted=smallestStep(K,lines,role,beside);}
    // The box stands on the centre of its line's first row.
    for(const row of rows){set(row.box,{marginTop:px(G.leadDrop(fitted.lineHeight,G.check.size))});set(row.line,{paddingTop:px(G.firstLine(fitted.lineHeight,G.check.size))});}
    K.design.surfaceGap(surface,gaps.sectionStep);
    return {rows,list,height:surface.offsetHeight};
  };
  // Airy when the panel has room at its own size; dense when the airy one
  // would have to be scaled down to fit the frame.
  let laid=lay(G.density('airy')),density='airy';
  if(fitToFrame(K,laid.height)<1){laid.list.remove();laid=lay(G.density('dense'));density='dense';}
  const {rows}=laid;
  Object.assign(surface.dataset,{checklistDensity:density,checklistDone:String(done)});
  const copy=finishCard(K,surface,width);
  const card=world.addCard({width,height:copy.height,element:surface,backdropOnly:true});
  card.group.scale.setScalar(fitToFrame(K,copy.height));
  world.prepare();
  const T=G.time;
  return (time,duration=p.dur,backdropTime=time)=>{
    const live=metadata['glass-checklist'].anchors(s,duration);
    const n=clamp(time/duration),enter=phase(time,live.open,live.open+T.open);
    const close=exit==='collapse'?smoother(phase(time,live.collapse,duration*.98)):0;
    updateCard(card,world,width,copy.height,outBack(enter)*(1-close),outBack(phase(time,live.open+.04,live.open+T.open+.04))*(1-close),smooth(enter)*(1-close));
    card.group.rotation.set(REST_TILT.x,REST_TILT.y,REST_TILT.z);
    card.opacity=smooth(phase(time,live.open+.16,live.open+T.open))*(1-smooth(phase(close,.05,.55)));
    if(heading)set(heading,{opacity:smooth(phase(time,live.title,live.title+T.fade)).toFixed(4)});
    rows.forEach((row,i)=>{
      const at=live.items[i],ticked=live.ticks[i];
      // Before a folding panel leaves, its rows go one after another.
      const gone=exit==='collapse'?smooth(phase(time,live.leave+i*T.stagger,live.leave+i*T.stagger+T.fade)):0;
      set(row.item,{opacity:(1-gone).toFixed(4),transform:`translateY(${px(G.move.settle*gone)})`});
      set(row.box,{opacity:smooth(phase(time,at,at+.12)).toFixed(4),transform:`scale(${(.4+.6*outBack(phase(time,at,at+T.pop))).toFixed(4)})`});
      // A word waits dim and is lit when the reading reaches it.
      const read=phase(time,at+.1,ticked-.04),shown=smooth(phase(time,at+.06,at+.06+T.fade));
      row.words.forEach((word,k)=>{
        const lit=smooth(phase(read*row.words.length,k,k+1));
        set(word,{opacity:(shown*(.38+.62*lit)).toFixed(4)});
      });
      const drawn=row.ticked?smooth(phase(time,ticked,ticked+.2)):0;
      set(row.art,{clipPath:`inset(0 ${(100*(1-drawn)).toFixed(2)}% 0 0)`,transform:`scale(${(.7+.3*outBack(drawn)).toFixed(4)})`});
    });
    orbitCamera(world,cameraMode,n,{sway:.07,rise:.02,near:1,rest:1.04});world.render(backdropTime);
  };
}

// The colour a pressed icon takes when the film has no accent of its own.
const LIKE_TINT=Object.freeze({like:'#4a9dff',heart:'#ff4d6d',star:'#ffc93c',bell:'#ffc93c',save:'#4a9dff',plus:'#08cd08',check:'#08cd08'});

// A glass button somebody presses: a pill grows out of a round seed with an
// icon and a word, a pointer comes up to the icon and clicks, the icon fills
// with colour and the word changes ("Like" to "Liked"). After the look of
// "Liquid Glass Like Button" (SOURCE.json); the pill is the design system's
// field, the icon the grid's, the word a title.
function glassLike(args){
  const {K,p,fg,accent}=args,{el,set,px,design}=K,s=p.scene;
  const cameraMode=cameraOf(s,'glass-like','static');
  const exit=enumValue(s.exit,['hold','collapse'],'hold','glass-like.exit');
  const iconName=enumValue(s.icon,Object.keys(LIKE_TINT),'like','glass-like.icon');
  const {host,world}=makeWorld(args,'glass-like');
  const G=glassGrid(K),before=s.text,after=s.after??s.text;
  const field=el('div','pk-glass-like',host);
  field.dataset.glassCopy=[...new Set([before,after])].join('\n');
  const recipe=design.surface(field,'field',{shape:'pill',density:'comfortable'});
  set(field,{position:'absolute',left:'0',top:'0',display:'flex',alignItems:'center',color:fg,whiteSpace:'nowrap'});
  field.setAttribute('role','button');
  // The two words stand in one place, as wide as the wider of them, so the
  // pill keeps its size when the word changes. Both are set in one step of
  // their role, the largest at which the pill is no wider than the safe area.
  const words=el('div','pk-glass-like-words',field);
  set(words,{position:'relative',flex:'none'});
  const word=text=>el('div','pk-glass-like-label',words,text);
  const off=word(before),on=word(after),role=G.type.action.role;
  const room=K.safe.w*.9-2*recipe.paddingX-recipe.gap;
  let type=design.type(role,design.steps(role).at(-1).step);
  for(const step of design.steps(role)){
    for(const node of [off,on]){design.apply(node,role,{step:step.step});set(node,{position:'absolute',left:'0',top:'0',whiteSpace:'nowrap'});}
    type=step;
    if(Math.max(off.offsetWidth,on.offsetWidth)+step.size<=room)break;
  }
  const height=type.lineHeight+2*recipe.paddingY,iconSize=type.size;
  set(field,{height:px(height)});
  // The icon twice, one over the other: its outline in the text's ink, and
  // filled in with colour for when it is pressed. Both are alpha masks.
  const icon=el('div','pk-glass-like-icon',field);
  field.insertBefore(icon,words);
  set(icon,{position:'relative',flex:'none',width:px(iconSize),height:px(iconSize)});
  const layer=(name,source,color,fill)=>{
    const badge=el('div',name,icon);badge.setAttribute('aria-hidden','true');
    badge.dataset.icon=iconName;if(fill)badge.dataset.iconFill='true';
    set(badge,{position:'absolute',inset:'0',color});
    set(el('span','',badge),{display:'block',width:'100%',height:'100%',backgroundColor:'currentColor',maskImage:`url("${source}")`,maskMode:'alpha',maskSize:'100% 100%',maskRepeat:'no-repeat'});
    return badge;
  };
  const tinted=K.plan.brand?.tokens?.accent!==undefined||K.plan.brand?.colors?.length||p.explicitAccent;
  const outline=layer('pk-glass-like-outline',islandIconSource(iconName),'inherit',false);
  const filled=layer('pk-glass-like-filled',islandIconFilledSource(iconName),tinted?accent:LIKE_TINT[iconName],true);
  const wordW=Math.ceil(Math.max(off.offsetWidth,on.offsetWidth));
  set(words,{width:px(wordW),height:px(type.lineHeight)});
  const width=2*recipe.paddingX+iconSize+recipe.gap+wordW;
  set(field,{width:px(width)});
  // A pill wider than the frame's safe width is scaled as a whole.
  const scale=Math.min(1,K.safe.w*.9/width);
  // Measured before the pill is projected into 3D: the click sends a ripple
  // through the glass that carries a picture of the icon and the word.
  const letters=createLettering(K,field);
  const inkOutline=letters.icon(outline),inkFilled=letters.icon(filled),inkOff=letters.text(off),inkOn=letters.text(on);
  letters.measure();
  const card=world.addCard({width,height,element:field,backdropOnly:true,fixedOptics:true});
  const {pointer,cursor}=pointerOf(K,field,'pk-glass-like-pointer',iconSize,2);
  const at=middleOf(icon),T=G.time;
  const state={liked:0,pop:1,shown:1};
  function ink(ctx){
    if(!(state.shown>0))return;
    inkOutline(ctx,state.shown*(1-state.liked));
    // The filled icon pops about its own middle.
    ctx.save();ctx.translate(at.x,at.y);ctx.scale(state.pop,state.pop);ctx.translate(-at.x,-at.y);inkFilled(ctx,state.shown*state.liked);ctx.restore();
    ctx.save();ctx.translate(0,-G.move.settle*state.liked);inkOff(ctx,state.shown*(1-state.liked));ctx.restore();
    ctx.save();ctx.translate(0,G.move.settle*(1-state.liked));inkOn(ctx,state.shown*state.liked);ctx.restore();
  }
  // Traced glass ripples itself; a polygon pill (smoked glass, metal) gets the wave laid over it.
  const clickBox={x:at.x-iconSize/2,y:at.y-iconSize/2,w:iconSize,h:iconSize};
  const ripple=card.slab?world.addRipple(card,{ink}):null;
  const drawWave=ripple?null:world.addSendWave(card,{ink,source:clickBox,tune:lightClickWave});
  world.prepare();
  return (time,duration=p.dur,backdropTime=time)=>{
    const live=metadata['glass-like'].anchors(s,duration);
    const n=clamp(time/duration),enter=phase(time,live.open,live.open+T.open);
    const close=exit==='collapse'?smoother(phase(time,live.collapse,duration*.98)):0;
    // It grows from a round seed to its width and folds back into one.
    const w=mix(height,width,Math.min(1.04,outBack(enter))*(1-smoother(phase(close,0,.7))));
    card.geometry.update(w*world.U,height*world.U,height*world.U/2,.24*K.S,.05*K.S);
    const press=Math.sin(Math.PI*phase(time,live.click,live.click+.22));
    card.group.scale.setScalar(Math.max(1e-4,scale*smooth(phase(time,live.open,live.open+.14))*(1-.04*press)*(1-smooth(phase(close,.6,1)))));
    card.group.rotation.set(REST_TILT.x,REST_TILT.y,REST_TILT.z);
    const shown=smooth(phase(time,live.open+.16,live.open+T.open))*(1-smooth(phase(close,0,.35)));
    card.opacity=shown;
    set(field,{clipPath:w<width?`inset(0 ${px((width-w)/2)} round ${px(height/2)})`:'none'});
    const liked=smooth(phase(time,live.click,live.click+.16)),pop=.6+.4*outBack(phase(time,live.click,live.click+T.pop));
    Object.assign(state,{liked,pop,shown});
    // One ring leaves the click and runs the pill: for RIPPLE seconds, or for
    // less in a scene that ends or folds sooner.
    const until=exit==='collapse'?live.collapse:duration;
    const wave=phase(time-live.click,0,Math.max(RIPPLE_SHORTEST,Math.min(RIPPLE,until-live.click)));
    if(ripple){
      const ring=clickRing(wave,width,height*.2);
      // While the glass carries the picture, the page's own copy is unseen.
      const unseen=ripple(ring&&{x:at.x,y:at.y,...ring})?'opacity(0)':'none';
      icon.style.filter=unseen;words.style.filter=unseen;
    }else drawWave(wave,clickBox);
    set(outline,{opacity:(1-liked).toFixed(4)});
    set(filled,{opacity:liked.toFixed(4),transform:`scale(${pop.toFixed(4)})`});
    set(off,{opacity:(1-liked).toFixed(4),transform:`translateY(${px(-G.move.settle*liked)})`});
    set(on,{opacity:liked.toFixed(4),transform:`translateY(${px(G.move.settle*(1-liked))})`});
    field.setAttribute('aria-pressed',String(time>=live.click));
    // The pointer comes up from under the pill, clicks the icon and goes.
    const coming={fx:at.x+iconSize*2,fy:height*2.6,x:at.x,y:at.y,start:live.reach,arrive:live.click-.1,click:live.click};
    const going={fx:at.x,fy:at.y,x:at.x+iconSize*2.4,y:height*2.8,start:live.click+.34,arrive:live.click+.9,click:Infinity};
    cursor(time,time>=going.start?going:coming);
    pointer.style.opacity=String(shown*(1-smooth(phase(time,live.click+.55,live.click+.9))));
    orbitCamera(world,cameraMode,n,{sway:.07,rise:.02,near:1,rest:1.04});world.render(backdropTime);
  };
}

export const factories=timedGlassFactories({island,controls,ask,search,lens,'glass-flow':glassFlow,'send-prompt':sendPrompt,'glass-steps':glassSteps,'glass-checklist':glassChecklist,'glass-like':glassLike});
