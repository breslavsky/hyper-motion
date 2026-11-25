import metadata from '../metadata.mjs';
import {timedGlassFactories} from '../timing.mjs';
import {createIslandIcon,islandIconSource,islandIconFilledSource} from '../island-icon.mjs';
import {createTyping} from '../typing.mjs';
import {clamp,phase,smooth,smoother,mix,outBack} from './world.mjs';
import {enumValue,cameraMode as cameraOf,makeWorld,panelWidth,cardSurface,cardHeading,finishCard,cardCopy,updateCard,REST_TILT,fitToFrame,
  orbitCamera,caretOf,actionSlot,pointerOf,typedCount,revealer,pulse,middleOf,fontOf,svgPicture} from './scene-parts.mjs';
import {sliderSize,switchSize} from './controls.mjs';
import {portraitGlassWidth} from './layout.mjs';
import {magnifyingGlassBold,questionMarkBold} from '../upstream/phosphor-icons/search-icons.mjs';
import {createLettering} from './lettering.mjs';
import {glassGrid} from './grid.mjs';
import {createOwnKit} from '../own-kit.mjs';
import {socialIcons} from '../upstream/simple-icons/icons.mjs';

function island(args){
  const {K,p}=args,s=p.scene;
  const cameraMode=cameraOf(s,'glass-island');
  const exit=enumValue(s.exit,['hold','collapse'],'hold','island.exit');
  const {host,world}=makeWorld(args,'glass-island');
  const copy=cardCopy(K,host,{title:s.title,body:s.body,icon:s.icon});
  const card=world.addCard({width:copy.width,height:copy.height,element:copy.surface});
  world.prepare();
  return (time,duration=p.dur,backdropTime=time)=>{
    const marks=metadata['glass-island'].anchors(s,duration);
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
// What is on, pressed or done is shown in one colour across the family: the
// brand's accent, or a clear green when the film has none.
const ACTIVE='#08cd08';
function activeColor({K,p,accent}){
  const tinted=K.plan.brand?.tokens?.accent!==undefined||K.plan.brand?.colors?.length||p.explicitAccent;
  return tinted?accent:ACTIVE;
}
function controlColors(args){
  return {railAccent:activeColor(args)};
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
  const {K,p,fg}=args,{el,set,px,design}=K,scene=p.scene,G=glassGrid(K),joined=Boolean(args.ride?.joined);
  const {host,world}=makeWorld(args,'glass-search');
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
  const hint=scene.placeholder??metadata['glass-search'].fields.placeholder.default;
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
  // The field grows out of the family's drop and folds back into it: the
  // round button it ends on, larger than the button's place in the field.
  const finalSize=G.drop;
  const card=world.addCard({width,height,element:field,backdropOnly:true,fixedOptics:true});
  card.geometry.update(width*world.U,height*world.U,height*world.U/2,.24*K.S,.05*K.S);
  // The pane folds around the middle of the field and the button travels
  // there, so the scene ends on one round button in the centre, the folded
  // pane its body.
  const buttonAt=middleOf(slot),buttonX=buttonAt.x;
  // The same ink as the magnifier on the left; a soft circle comes in under
  // the pointer.
  const button=world.addSendButton(card,{slot,icon:'search',glyphSize:iconSize,ink:fg});

  const definition=metadata['glass-search'], marks=definition.anchors(scene,p.dur), keys=definition.keys(scene,marks);
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
  const iconTravel=width/2-icon.offsetLeft-iconSize/2;
  const openFor=Math.min(G.time.open,Math.max(.12,(marks.focus-marks.open)*.8));
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
    // The drop opens into the field before the pointer reaches it.
    const opened=phase(time,marks.open,marks.open+openFor),fold=Math.max(1-smoother(opened),morph);
    showTyped(count);
    caret.style.opacity=focused&&!submitted?(count&&count<typing.length?'1':String(K.blink(time-marks.focus))):'0';
    copy.count=count;copy.caret=Number(caret.style.opacity);
    const w=mix(width,finalSize,fold), h=mix(height,finalSize,fold);
    const center=width/2,travel=(width/2-buttonX)*morph;
    card.geometry.update(w*world.U,h*world.U,h*world.U/2,.24*K.S,.05*K.S);
    const copyOpacity=(1-smooth(phase(closing,0,.6)))*smooth(phase(opened,.45,1)), visibility=copyOpacity>0?'visible':'hidden';
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
    set(field,{clipPath:fold>0?`inset(0 ${px(center-w/2)} round ${px(h/2)})`:'none'});
    // The drop pops in, unless a ride hands it over from the scene before.
    card.group.scale.setScalar(joined?1:.02+.98*outBack(phase(time,marks.open-.05,marks.open+.13)));
    card.opacity=joined?1:smooth(phase(time,marks.open-.05,marks.open+.04));
    set(viewport,{opacity:String(copyOpacity),visibility});

    // The scene's own icon stands in the middle of the drop and goes to the head of the field as it opens.
    const leaving=1-smooth(phase(closing,0,.6)),inDrop=1-smoother(opened);
    // The drop itself is clear: the icon comes up as it opens.
    const iconShown=.68*leaving*smooth(phase(opened,.1,.55));
    set(icon,{opacity:String(iconShown),visibility:iconShown>0?'visible':'hidden',
      transform:`translateX(${px(iconTravel*inDrop)})`});
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
    // The checkmark goes before the scene ends: what is left is the clear drop.
    const cleared=smooth(phase(time,marks.clear,marks.clear+Math.min(.2,(duration-marks.clear)*.9)));
    button.draw((1-.12*press)*mix(1,finalSize/buttonSize,morph)*outBack(phase(opened,.55,1))*(1-cleared),{loading:submitted&&!checked?Math.max(0,backdropTime-trigger):null,
      checked,fill:over,shift:travel,disc:over*(1-morph)});
    world.render(backdropTime);
  };
}

function controls(args){
  const {K,p}=args,{el,set,px}=K,s=p.scene;
  const cameraMode=cameraOf(s,'glass-controls');
  const {host,world}=makeWorld(args,'glass-controls');
  const {surface,width,recipe}=cardSurface(K,host,[s.title,...s.toggles,s.slider]);
  surface.classList.add('pk-glass-controls');
  const contentW=width-recipe.paddingX*2,unit=K.design.unit;
  if(s.title)cardHeading(K,surface,s.title,contentW);
  const marks=metadata['glass-controls'].anchors(s,p.dur);
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
  const camera=cameraOf(s,'glass-ask');
  const {host,world}=makeWorld(args,'glass-ask');
  const {surface,width,recipe}=cardSurface(K,host,[s.text,s.reply]);
  surface.classList.add('pk-glass-ask');
  const exit=enumValue(s.exit,['drop','hold'],'drop','glass-ask.exit'),joined=Boolean(args.ride?.joined);
  const {unit}=K.design,iconSize=K.design.space(5),sendSize=K.design.space(6),G=glassGrid(K),seedSize=G.drop;
  const contentWidth=width-recipe.paddingX*2,textInset=iconSize+recipe.gap;
  const row=el('div','pk-glass-ask-row',surface);
  set(row,{display:'grid',gridTemplateColumns:`${px(iconSize)} minmax(0,1fr) ${px(sendSize)}`,alignItems:'start',gap:px(recipe.gap),flex:'none'});
  // The scene's own icon: it stands in the middle of the drop and goes to the head of the prompt.
  const icon=el('div','pk-glass-ask-icon',row);
  icon.innerHTML=questionMarkBold;
  icon.setAttribute('aria-hidden','true');
  set(icon,{display:'flex',flex:'none',width:px(iconSize),height:px(iconSize)});
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
  // Where the icon stands in the drop: the middle of the panel, whatever its height.
  const seedOffsetX=(width-iconSize)/2-recipe.paddingX;
  const seedOffsetY=height=>height/2-recipe.paddingY-firstLineHeight/2;
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
  const marks=metadata['glass-ask'].anchors(s,p.dur);
  // Short films and long replies still reach their last word before the final hold.
  const wordsBy=exit==='drop'?marks.collapse:p.dur;
  const wordDelay=reply?Math.min(.05,Math.max(0,wordsBy-marks.reply-.43)/Math.max(1,words.length-1)):0;
  const showTyped=revealer(typing);
  // Pressing send runs a wave through the panel from the button, as a click
  // does in glass-search. The glass carries a picture of what is written on
  // it (lettering.mjs): the icon, the typed question and the answer's words.
  const letters=createLettering(K,surface);
  const inkPrompt=letters.glyphs(typing),inkWords=words.map(word=>letters.text(word));
  letters.measure();
  const inkColor=host.ownerDocument.defaultView.getComputedStyle(prompt).color;
  const markPath=new Path2D(new DOMParser().parseFromString(questionMarkBold,'image/svg+xml').querySelector('path').getAttribute('d'));
  const iconAt={x:icon.offsetLeft,y:icon.offsetTop},sendAt=middleOf(send);
  const carried=!/[\u0590-\u08FF\uFB1D-\uFEFC]/.test(s.text+(s.reply??''));
  // The picture is the whole panel's; while the panel is still short it lies lower by half the difference.
  const copy={count:0,shown:0,words:[],drop:0};
  function ink(ctx){
    if(!carried)return;
    ctx.save();ctx.translate(0,copy.drop);
    ctx.save();ctx.globalAlpha=copy.shown;ctx.fillStyle=inkColor;
    ctx.translate(iconAt.x,iconAt.y);ctx.scale(iconSize/256,iconSize/256);ctx.fill(markPath);ctx.restore();
    inkPrompt(ctx,copy.shown,copy.count);
    inkWords.forEach((draw,i)=>draw(ctx,copy.words[i]??0));
    ctx.restore();
  }
  const sendBox={x:send.offsetLeft,y:send.offsetTop,w:send.offsetWidth,h:send.offsetHeight};
  const ripple=card.slab?world.addRipple(card,{ink}):null;
  const drawWave=ripple?null:world.addSendWave(card,{ink,source:sendBox,tune:lightClickWave});
  // The wave has left the panel before it folds.
  const waveFor=Math.max(RIPPLE_SHORTEST,Math.min(RIPPLE,(marks.collapse??p.dur)-marks.send));
  world.prepare();
  return (time,duration=p.dur,backdropTime=time)=>{
    const open=phase(time,marks.open,.51);
    // The panel folds back into the drop it came out of, its icon in the middle again.
    const close=exit==='drop'?smoother(phase(time,marks.collapse,marks.collapse+G.time.open)):0;
    const opening=outBack(open)*(1-close),visible=smooth(open)*(1-smooth(phase(close,0,.5)));
    const answer=reply?smoother(phase(time,marks.reply,marks.reply+.3)):0;
    const height=mix(promptHeight,fullHeight,answer);
    // Anchor the top of the open prompt as the same mesh extends under the reply.
    card.height=height;set(surface,{height:px(height)});
    updateCard(card,world,width,height,opening,opening,smooth(open)*(1-close),seedSize);
    const press=pulse(time,.2,marks.open);
    // The drop pops in, unless a ride hands it over from the scene before.
    card.group.scale.setScalar(fitScale*(joined?1:.02+.98*outBack(phase(time,0,.18)))*(1-.12*press));
    // The drop stands in the middle; the open prompt rises to leave room for its reply.
    card.group.position.set(0,(fullHeight-height)*world.U*fitScale/2*smooth(open),0).applyQuaternion(card.group.quaternion);
    card.opacity=joined?1:smooth(phase(time,0,.09));
    const iconTravel=1-smooth(open)*(1-close);
    // The drop itself is clear: the icon comes up as it opens and goes as it folds.
    set(icon,{opacity:String(smooth(phase(open,.1,.6))*(1-smooth(phase(close,.25,.8)))),transform:`translate(${px(seedOffsetX*iconTravel)},${px(seedOffsetY(height)*iconTravel)})`});
    const shown=Math.round(K.prog(time,marks.type,marks.typed-marks.type)*typing.length);
    showTyped(shown);
    set(prompt,{opacity:String(visible)});
    copy.count=shown;copy.shown=visible;copy.drop=(fullHeight-height)/2;
    set(caret,{opacity:time>=marks.send?'0':shown>0&&shown<typing.length?'1':String(K.blink(time))});
    const sendPress=pulse(time,marks.send,marks.send+.22);
    // Nobody points at this button: its circle comes in as it is pressed.
    button.draw(outBack(phase(time,.36,.52))*(1-.14*sendPress)*(1-smooth(phase(close,0,.5))),{fill:smooth(phase(time,marks.send-.12,marks.send))});
    if(reply){
      set(reply,{opacity:String(answer*(1-smooth(phase(close,0,.5))))});
      const answered=answer*(1-smooth(phase(close,0,.5)));
      words.forEach((word,i)=>{const at=marks.reply+.15+i*wordDelay,said=smooth(phase(time,at,at+.16));set(word,{opacity:String(said)});copy.words[i]=said*answered;});
    }
    const wave=phase(time-marks.send,0,waveFor);
    if(ripple){
      const ring=clickRing(wave,width,firstLineHeight*.2);
      // While the glass carries the lettering, the page's own copy is unseen.
      const unseen=ripple(ring&&{x:sendAt.x,y:sendAt.y+copy.drop,...ring})&&carried?'opacity(0)':'none';
      for(const node of [icon,prompt,reply])if(node)node.style.filter=unseen;
    }else drawWave(wave,sendBox);
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
  const cues=metadata['glass-send-prompt'],marks=cues.anchors(s,p.dur),keys=cues.keys(s,marks);
  const {world,host}=makeWorld(args,'glass-send-prompt');
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
  const {K,p}=args,s=p.scene,cameraMode=cameraOf(s,'glass-lens','static');
  const {host,world}=makeWorld(args,'glass-lens');
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
    const marks=metadata['glass-lens'].anchors(s,duration);
    const n=clamp(time/duration),progress=smoother(phase(time,marks.sweep,marks.sweepEnd));
    card.group.position.set(mix(-travel,travel,progress)*world.U,(K.H/2-textTop-lineH/2)*world.U,.18);
    card.group.rotation.set(0,mix(-.13,.13,progress),-.025);
    card.group.visible=n>=.12&&n<.94;
    orbitCamera(world,cameraMode,n,{sway:.055,rise:0,far:1,near:1,rest:1,target:-.2});world.render(backdropTime);
  };
}

// Text that does not fit its lines at the role's smallest step keeps that
// step and takes the lines it needs.
// A figure as a number to count up to, and the text of it part of the way.
const {figure:figureOf,counted:countedTo}=createOwnKit();

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

// A glass panel of key figures: it grows out of a pill, its title comes in,
// then the figures one after another, each a label and a big number that pops and
// counts up. Columns in a wide frame, rows in a square or tall one or
// when the figures are long: a row is its label and its figure side by side,
// or the label over the figure when they do not fit one line. Every measure
// is the family's grid (grid.mjs).
// The share of a row a figure may take beside its label.
const ROW_FIGURE=.62;
function glassWidgets(args){
  const {K,p}=args,{el,set,px}=K,s=p.scene;
  const cameraMode=cameraOf(s,'glass-widgets');
  const {host,world}=makeWorld(args,'glass-widgets');
  const {surface,width}=cardSurface(K,host,[s.title,...s.items.flatMap(item=>[item.value,item.label])]);
  surface.classList.add('pk-glass-widgets');
  const G=glassGrid(K),count=s.items.length;
  const smallest=(nodes,role,width)=>smallestStep(K,nodes,role,width);
  let heading=null;
  if(s.title){
    try{heading=cardHeading(K,surface,s.title,G.content).heading;}
    catch{heading=surface.querySelector('.pk-glass-heading');smallest([heading],G.type.title.role,G.content);}
    set(heading,{opacity:'0'});
  }
  const lay=(shape,gaps)=>{
    const rows=shape!=='columns',stacked=shape==='stacked';
    const list=el('div','pk-glass-widget-list',surface);
    set(list,{display:'flex',flexDirection:rows?'column':'row',alignItems:rows?'stretch':'flex-start',gap:px(rows?gaps.rows:gaps.columns)});
    const align=shape==='columns'?'center':stacked?'left':'right';
    const tiles=s.items.map(item=>{
      const tile=el('div','pk-glass-widget',list);
      set(tile,{display:'flex',flexDirection:shape==='rows'?'row-reverse':'column-reverse',alignItems:shape==='columns'?'center':shape==='rows'?'center':'flex-start',
        justifyContent:shape==='rows'?'space-between':'flex-start',gap:px(shape==='rows'?gaps.lead:G.gap.hair),flex:rows?'none':'1',minWidth:'0'});
      // The figure is first in the page, as what is read, and stands under or after its label.
      const value=el('div','pk-glass-widget-value',tile,item.value);
      set(value,{flex:'none',fontVariantNumeric:'tabular-nums',textAlign:align,opacity:'0'});
      const label=el('div','pk-glass-widget-label',tile,item.label);
      set(label,{minWidth:'0',textAlign:shape==='columns'?'center':'left',opacity:'0'});
      return {tile,value,label,figure:figureOf(item.value),text:item.value};
    });
    const values=tiles.map(tile=>tile.value),labels=tiles.map(tile=>tile.label);
    const columnW=(G.content-gaps.columns*(count-1))/count;
    const fail=()=>{list.remove();return null;};
    // The figures are one set: all are in the step the longest one needs.
    try{K.design.fitGroup(values,{role:G.type.figure.role,w:shape==='columns'?columnW:stacked?G.content:G.content*ROW_FIGURE,h:G.type.figure.height,wrap:'nowrap'});}
    catch{if(!stacked)return fail();smallest(values,G.type.figure.role,G.content);}
    // A figure keeps the width of its final text while it counts.
    const widest=Math.max(...values.map(value=>value.offsetWidth));
    if(shape==='columns'&&widest>columnW)return fail();
    for(const value of values)set(value,{width:px(shape==='rows'?widest:value.offsetWidth)});
    const labelW=shape==='columns'?columnW:stacked?G.content:G.content-widest-gaps.lead;
    try{K.design.fitGroup(labels,{role:G.type.label.role,w:labelW,h:G.type.label.height,wrap:'anywhere'});}
    catch{if(!stacked)return fail();smallest(labels,G.type.label.role,labelW);}
    K.design.surfaceGap(surface,gaps.sectionStep);
    if(heading)set(heading,{textAlign:shape==='columns'?'center':'left'});
    return {shape,tiles,list,height:surface.offsetHeight};
  };
  const build=gaps=>(G.wide?lay('columns',gaps):null)??lay('rows',gaps)??lay('stacked',gaps);
  // Airy when the panel has room at its own size; dense when the airy one
  // would have to be scaled down to fit the frame.
  let density='airy',laid=build(G.density('airy'));
  if(fitToFrame(K,laid.height)<1){laid.list.remove();laid=build(G.density('dense'));density='dense';}
  const {tiles}=laid;
  Object.assign(surface.dataset,{widgetsLayout:laid.shape,widgetsDensity:density});
  const copy=finishCard(K,surface,width);
  const card=world.addCard({width,height:copy.height,element:surface,backdropOnly:true});
  card.group.scale.setScalar(fitToFrame(K,copy.height));
  world.prepare();
  const T=G.time;
  return (time,duration=p.dur,backdropTime=time)=>{
    const live=metadata['glass-widgets'].anchors(s,duration);
    const n=clamp(time/duration),enter=phase(time,live.open,live.open+T.open);
    updateCard(card,world,width,copy.height,outBack(enter),outBack(phase(time,live.open+.04,live.open+T.open+.04)),smooth(enter));
    card.group.rotation.set(REST_TILT.x,REST_TILT.y,REST_TILT.z);
    card.opacity=smooth(phase(time,live.open+.16,live.open+T.open));
    if(heading)set(heading,{opacity:smooth(phase(time,live.open+.12,live.open+.12+T.fade)).toFixed(4)});
    const counting=Math.max(.1,live.settled-live.items.at(-1)-.1);
    tiles.forEach((tile,i)=>{
      const at=live.items[i],settle=smooth(phase(time,at+.1,at+.1+T.pop));
      set(tile.value,{opacity:smooth(phase(time,at,at+.12)).toFixed(4),transform:`scale(${(.6+.4*outBack(phase(time,at,at+T.pop))).toFixed(4)})`});
      set(tile.label,{opacity:settle.toFixed(4),transform:`translateY(${px((1-settle)*G.move.settle)})`});
      if(tile.figure){
        const text=countedTo(tile.figure,K.expoOut(phase(time,at+.1,at+.1+counting)));
        if(text!==tile.text){tile.value.textContent=text;tile.text=text;}
      }
    });
    orbitCamera(world,cameraMode,n,{sway:.07,rise:.02,near:1,rest:1.04});world.render(backdropTime);
  };
}

// A long process walked step by step: up to ten steps down a line, each a
// glass pill with its name and, over the pill's left end, a round glass mark
// with its number; no panel behind them. The steps are taken one after another: the one being
// done is lit, the ones before it are ticked, and the camera goes down the
// line with it, so the step being done stands in the middle of the frame
// however many there are. After the look of a mobile stepper (SOURCE.json);
// every measure is the family's grid (grid.mjs).
// How much larger the step in the middle of the frame is, and over how many steps to either side that falls away.
const MAGNIFY=.3,MAGNIFY_REACH=1.3;
function glassStepper(args){
  const {K,p,fg}=args,{el,set,px,design}=K,s=p.scene;
  const {host,world}=makeWorld(args,'glass-stepper');
  const G=glassGrid(K),count=s.items.length;
  const tick=islandIconSource('check'),active=activeColor(args);
  // A pill is the family's field, as the search field is: one line of body text and its insets.
  const pills=s.items.map(text=>{
    const pill=el('div','pk-glass-copy pk-glass-stepper-pill',host);pill.dataset.glassCopy=text;
    const recipe=design.surface(pill,'field',{shape:'pill'});
    set(pill,{position:'absolute',display:'flex',alignItems:'center',color:fg,boxSizing:'border-box',width:'max-content'});
    // Lit while its step is being done: the active colour around the pill.
    // It is drawn in a box that has room for its glow, so the glow can be cut to the mark's round edge.
    const lit=el('span','pk-glass-stepper-lit',pill);lit.setAttribute('aria-hidden','true');
    set(lit,{position:'absolute',inset:px(-2*G.gap.block),opacity:'0'});
    const outline=el('span','',lit);
    set(outline,{position:'absolute',inset:px(2*G.gap.block),borderRadius:px(9999),boxShadow:`inset 0 0 0 ${px(G.mark.stroke)} ${active}, 0 0 ${px(G.gap.block)} ${active}`});
    // The mark stands over the pill's left end: the name begins clear of it.
    const under=el('span','pk-glass-stepper-under',pill);under.setAttribute('aria-hidden','true');set(under,{flex:'none'});
    const line=el('div','pk-glass-stepper-text',pill,text);
    set(line,{position:'relative',minWidth:'0',textAlign:'left'});
    return {pill,line,lit,under,recipe};
  });
  const inset=pills[0].recipe.paddingX,size=design.type('body').lineHeight+2*pills[0].recipe.paddingY;
  // The mark is larger than the pill it stands on, by a hair's gap all round, and the name begins clear of it.
  const round=size+2*G.gap.hair,lead=round/2+G.gap.item;
  for(const {under} of pills)set(under,{width:px(lead-inset)});
  // The names are one list: all are set in the step the longest one needs, on one line.
  // The longest name still fits the family's width when its step is the one magnified.
  const room=G.width/(1+MAGNIFY)-round/2-lead-inset,role=G.type.item.role;
  try{design.fitGroup(pills.map(({line})=>line),{role,w:room,h:design.type(role).lineHeight,wrap:'nowrap'});}
  catch{smallestStep(K,pills.map(({line})=>line),role,room);}
  // Every pill is as wide as the longest name needs and as tall as the tallest.
  const pillW=Math.min(room+lead+inset,Math.ceil(Math.max(...pills.map(({pill})=>pill.offsetWidth)))),pillH=Math.max(size,...pills.map(({pill})=>pill.offsetHeight));
  for(const {pill} of pills)set(pill,{width:px(pillW),height:px(pillH)});
  // The pill's lit outline and its glow stop at the mark's round edge: the two read as one shape.
  const cut=`radial-gradient(circle at ${px(2*G.gap.block)} 50%, transparent ${px(round/2-G.mark.stroke/2)}, #000 ${px(round/2)})`;
  for(const {lit} of pills)set(lit,{maskImage:cut,webkitMaskImage:cut});
  const between=G.gap.section,pitch=round+between,total=count*round+(count-1)*between;
  // The line is centred as its magnified step stands: that step is the widest, and the marks keep one line.
  const markX=-(round/2+pillW)*(1+MAGNIFY)/2+round*(1+MAGNIFY)/2;
  const steps=pills.map(({pill,line,lit},i)=>{
    // The mark is a round piece of glass over the pill's left end: a ring, its
    // number, and when the step is done the family's active colour under the
    // icon set's own check. The line to the next mark hangs under it.
    const mark=el('div','pk-glass-copy pk-glass-stepper-mark',host);mark.dataset.glassCopy=String(i+1);
    set(mark,{position:'absolute',display:'grid',placeItems:'center',color:fg,width:px(round),height:px(round),borderRadius:px(round/2)});
    const part=(name,style)=>{const node=el('span',name,mark);node.setAttribute('aria-hidden','true');set(node,{position:'absolute',inset:'0',borderRadius:'inherit',...style});return node;};
    const glow=part('pk-glass-stepper-glow',{boxShadow:`inset 0 0 0 ${px(G.mark.stroke)} ${active}, 0 0 ${px(G.gap.block)} ${active}`,opacity:'0'});
    const fill=part('pk-glass-stepper-fill',{background:active,opacity:'0'});
    const number=el('span','pk-glass-stepper-number',mark,String(i+1));
    design.apply(number,G.type.mark.role,{step:G.type.mark.step});set(number,{position:'relative'});
    const check=el('span','pk-glass-stepper-check',mark);check.setAttribute('aria-hidden','true');
    set(check,{position:'absolute',width:px(G.check.glyph),height:px(G.check.glyph),backgroundColor:'currentColor',
      maskImage:`url("${tick}")`,maskMode:'alpha',maskSize:'100% 100%',maskRepeat:'no-repeat',clipPath:'inset(0 100% 0 0)'});
    let rail=null,done=null;
    if(i<count-1){
      const piece=(name,style)=>{const node=el('span',name,mark);node.setAttribute('aria-hidden','true');
        set(node,{position:'absolute',left:px(round/2-G.mark.stroke/2),top:px(round),width:px(G.mark.stroke),height:px(between),...style});return node;};
      rail=piece('pk-glass-stepper-rail',{background:'currentColor',opacity:'0'});
      done=piece('pk-glass-stepper-done',{background:active,transformOrigin:'50% 0',transform:'scaleY(0)'});
    }
    // Where the step stands, in frame pixels from the middle of the line.
    const y=-total/2+round/2+i*pitch;
    const glass=(element,width,height,x,z)=>{
      const card=world.addCard({width,height,element,backdropOnly:true,fixedOptics:true});
      card.geometry.update(width*world.U,height*world.U,height*world.U/2,.24*K.S,.05*K.S);
      card.group.position.set(x*world.U,-y*world.U,z);
      return card;
    };
    // The pill first and the mark over it, a pane's depth nearer.
    const bar=glass(pill,pillW,pillH,markX+pillW/2,0);
    return {y,line,lit,glow,fill,number,check,rail,done,bar,round:glass(mark,round,round,markX,.3*K.S)};
  });
  host.dataset.stepperSteps=String(count);
  world.prepare();
  const T=G.time;
  return (time,duration=p.dur,backdropTime=time)=>{
    const live=metadata['glass-stepper'].anchors(s,duration);
    // The camera stands over the step being done and goes on to the next as it is reached.
    let focus=steps[0].y;
    live.items.forEach((at,i)=>{if(i)focus=mix(focus,steps[i].y,smoother(phase(time,at-.28,at+.14)));});
    // Magnification, as in a dock: a step is larger the nearer it stands to
    // the middle of the frame, and its neighbours make room for it. Sizes
    // first, by where each step stands down the line; then the line laid out
    // again with every step at its size, the camera's place kept in the middle.
    const sizes=steps.map(step=>1+MAGNIFY*Math.exp(-(((step.y-focus)/(MAGNIFY_REACH*pitch))**2)));
    const down=[0];
    for(let i=1;i<count;i++)down.push(down[i-1]+(round*(sizes[i-1]+sizes[i])/2+between));
    const along=(focus-steps[0].y)/pitch,k=Math.min(count-2,Math.max(0,Math.floor(along)));
    const centre=count>1?mix(down[k],down[k+1],along-k):0;
    steps.forEach((step,i)=>{
      const from=live.open+i*T.stagger,shown=smooth(phase(time,from,from+T.fade)),pop=outBack(phase(time,from,from+T.pop));
      const reached=live.items[i],left=live.items[i+1]??(i===live.items.length-1?live.finish:undefined);
      const now=reached===undefined?0:smooth(phase(time,reached,reached+.2));
      const done=left===undefined?0:smooth(phase(time,left,left+.22));
      const lit=now*(1-done),hop=left===undefined?0:Math.sin(Math.PI*phase(time,left,left+T.pop));
      // A step that has left the frame, or is leaving it, is not shown: nothing is cut by the frame's edge.
      const size=sizes[i],y=down[i]-centre,edge=K.safe.h/2-round*size/2;
      const inside=1-smooth(phase(Math.abs(y),edge-round,edge));
      step.round.opacity=step.bar.opacity=shown*inside;
      step.round.group.visible=step.bar.group.visible=inside>0;
      const grow=size*(1+.04*hop);
      step.round.group.scale.setScalar(mix(.6,1,pop)*grow);
      step.bar.group.scale.setScalar(mix(.9,1,pop)*size);
      // The marks stay on one line; a pill grows away from its mark.
      step.round.group.position.y=step.bar.group.position.y=-y*world.U;
      step.bar.group.position.x=(markX+pillW*size/2)*world.U;
      if(step.rail&&i<count-1){
        // The line to the next mark, in the mark's own pixels at its size.
        const length=Math.max(0,(down[i+1]-down[i]-round*(size+sizes[i+1])/2)/grow);
        set(step.rail,{height:px(length)});set(step.done,{height:px(length)});
      }
      set(step.glow,{opacity:lit.toFixed(4)});set(step.lit,{opacity:lit.toFixed(4)});
      set(step.fill,{opacity:done.toFixed(4)});
      set(step.number,{opacity:(mix(.5,1,now)*(1-done)).toFixed(4)});
      set(step.check,{clipPath:`inset(0 ${(100*(1-done)).toFixed(2)}% 0 0)`});
      set(step.line,{opacity:mix(.5,mix(1,.75,done),now).toFixed(4)});
      if(step.rail){set(step.rail,{opacity:'.3'});set(step.done,{transform:`scaleY(${done.toFixed(4)})`});}
    });
    orbitCamera(world,'static',0,{rest:1});
    world.render(backdropTime);
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
  const tick=islandIconSource('check'),active=activeColor(args);
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
      // Ticked, the box is filled with the family's active colour under its tick.
      const fill=el('span','pk-glass-check-fill',box);fill.setAttribute('aria-hidden','true');
      set(box,{position:'relative'});
      set(fill,{position:'absolute',inset:'0',borderRadius:px(G.check.radius),background:active,opacity:'0'});
      const art=el('span','pk-glass-check-tick',box);
      art.setAttribute('aria-hidden','true');
      set(art,{position:'relative',display:'block',width:px(G.check.glyph),height:px(G.check.glyph),backgroundColor:'currentColor',
        maskImage:`url("${tick}")`,maskMode:'alpha',maskSize:'100% 100%',maskRepeat:'no-repeat',clipPath:'inset(0 100% 0 0)'});
      // The line is its words, each lit in turn as the line is read.
      const line=el('div','pk-glass-check-text',item);
      const words=String(text).trim().split(/\s+/u).filter(Boolean).map((word,k,all)=>{
        const span=el('span','pk-glass-check-word',line,word+(k<all.length-1?' ':''));
        set(span,{opacity:'0'});
        return span;
      });
      set(line,{textAlign:'left',minWidth:'0'});
      return {item,box,fill,art,line,words,ticked:i<done};
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
      set(row.fill,{opacity:drawn.toFixed(4)});
      set(row.art,{clipPath:`inset(0 ${(100*(1-drawn)).toFixed(2)}% 0 0)`,transform:`scale(${(.7+.3*outBack(drawn)).toFixed(4)})`});
    });
    orbitCamera(world,cameraMode,n,{sway:.07,rise:.02,near:1,rest:1.04});world.render(backdropTime);
  };
}

// A glass panel that gives a rating: it grows out of a pill, its question
// comes in, then five stars fill with colour one after another up to the
// rating, a half star to its middle, and a line under them says the rating in
// words. After the look of "Rating Element Liquid Glass" (SOURCE.json); every
// measure is the family's grid (grid.mjs).
const RATING_GOLD='#ffc93c',RATING_STARS=5;
function glassRating(args){
  const {K,p,accent}=args,{el,set,px}=K,s=p.scene;
  const cameraMode=cameraOf(s,'glass-rating');
  const exit=enumValue(s.exit,['hold','collapse'],'hold','glass-rating.exit');
  const {host,world}=makeWorld(args,'glass-rating');
  const {surface,width:panel,recipe}=cardSurface(K,host,[s.title,s.caption]);
  surface.classList.add('pk-glass-rating');
  const G=glassGrid(K),rating=s.stars??RATING_STARS;
  set(surface,{alignItems:'center',textAlign:'center'});
  let heading=null;
  if(s.title){
    try{heading=cardHeading(K,surface,s.title,G.content).heading;}
    catch{heading=surface.querySelector('.pk-glass-heading');smallestStep(K,[heading],G.type.title.role,G.content);}
    set(heading,{opacity:'0',textAlign:'center'});
  }
  // A star is the icon set's own, filled: once in the text's ink, faint, as
  // the empty star, and once in gold over it, uncovered from its left.
  const tinted=K.plan.brand?.tokens?.accent!==undefined||K.plan.brand?.colors?.length||p.explicitAccent;
  const source=islandIconFilledSource('star'),gold=tinted?accent:RATING_GOLD;
  const row=el('div','pk-glass-rating-stars',surface);
  row.setAttribute('role','img');row.setAttribute('aria-label',`${rating} out of ${RATING_STARS}`);
  set(row,{display:'flex',flexDirection:'row',justifyContent:'center',gap:px(G.gap.item),opacity:'0'});
  const stars=Array.from({length:RATING_STARS},(_,i)=>{
    const star=el('div','pk-glass-rating-star',row);
    set(star,{position:'relative',flex:'none',width:px(G.mark.size),height:px(G.mark.size)});
    const art=color=>{
      const node=el('span','',star);node.setAttribute('aria-hidden','true');
      set(node,{position:'absolute',inset:'0',backgroundColor:color,maskImage:`url("${source}")`,maskMode:'alpha',maskSize:'100% 100%',maskRepeat:'no-repeat'});
      return node;
    };
    const empty=art('currentColor');set(empty,{opacity:'.28'});
    const full=art(gold);set(full,{clipPath:'inset(0 100% 0 0)'});
    // How much of this star the rating fills: all, a part, or none.
    return {star,full,share:clamp(rating-i)};
  });
  let caption=null;
  if(s.caption){
    caption=el('div','pk-glass-rating-caption',surface,s.caption);
    try{K.design.fitGroup([caption],{role:G.type.label.role,w:G.content,h:G.type.label.height,wrap:'anywhere'});}
    catch{smallestStep(K,[caption],G.type.label.role,G.content);}
    set(caption,{textAlign:'center',opacity:'0'});
  }
  // In a wide frame the panel is as wide as what it holds, with the card's
  // own insets: five stars and a short question would stand in the middle of
  // an empty sheet. A tall or square frame keeps the family's panel width.
  let width=panel;
  if(G.wide){
    const natural=node=>{set(node,{width:'max-content',maxWidth:px(G.content)});return node.offsetWidth;};
    width=Math.min(panel,Math.ceil(Math.max(row.offsetWidth,...[heading,caption].filter(Boolean).map(natural)))+2*recipe.paddingX);
    set(surface,{width:px(width)});
  }
  const lay=name=>{K.design.surfaceGap(surface,G.density(name).sectionStep);return surface.offsetHeight;};
  // Airy when the panel has room at its own size; dense when the airy one
  // would have to be scaled down to fit the frame.
  let density='airy',laid=lay('airy');
  if(fitToFrame(K,laid)<1){density='dense';laid=lay('dense');}
  Object.assign(surface.dataset,{ratingDensity:density,ratingStars:String(rating)});
  const copy=finishCard(K,surface,width);
  const card=world.addCard({width,height:copy.height,element:surface,backdropOnly:true});
  card.group.scale.setScalar(fitToFrame(K,copy.height));
  world.prepare();
  const T=G.time;
  return (time,duration=p.dur,backdropTime=time)=>{
    const live=metadata['glass-rating'].anchors(s,duration);
    const n=clamp(time/duration),enter=phase(time,live.open,live.open+T.open);
    const close=exit==='collapse'?smoother(phase(time,live.collapse,duration*.98)):0;
    updateCard(card,world,width,copy.height,outBack(enter)*(1-close),outBack(phase(time,live.open+.04,live.open+T.open+.04))*(1-close),smooth(enter)*(1-close));
    card.group.rotation.set(REST_TILT.x,REST_TILT.y,REST_TILT.z);
    card.opacity=smooth(phase(time,live.open+.16,live.open+T.open))*(1-smooth(phase(close,.05,.55)));
    if(heading)set(heading,{opacity:smooth(phase(time,live.title,live.title+T.fade)).toFixed(4)});
    set(row,{opacity:smooth(phase(time,live.title+.08,live.title+.08+T.fade)).toFixed(4)});
    stars.forEach(({star,full,share},i)=>{
      const at=live.stars[i],fill=share*smooth(phase(time,at,at+.18));
      // A star hops as it is filled; one the rating does not reach stays put.
      const hop=share>0?Math.sin(Math.PI*phase(time,at,at+T.pop)):0;
      set(full,{clipPath:`inset(0 ${(100*(1-fill)).toFixed(2)}% 0 0)`});
      set(star,{transform:`translateY(${px(-G.move.settle*hop)}) scale(${(1+.12*hop).toFixed(4)})`});
    });
    if(caption){
      const said=smooth(phase(time,live.caption,live.caption+T.fade));
      set(caption,{opacity:said.toFixed(4),transform:`translateY(${px((1-said)*G.move.settle)})`});
    }
    orbitCamera(world,cameraMode,n,{sway:.07,rise:.02,near:1,rest:1.04});world.render(backdropTime);
  };
}

// A glass panel that is a message arriving: it grows out of a pill with the
// picture of who it is from, their name, when it came and what it says.
// After the look of "Liquid Glass Message Popup" (SOURCE.json); every measure
// is the family's grid (grid.mjs).
function glassMessage(args){
  const {K,p,fg}=args,{el,set,px}=K,s=p.scene;
  const cameraMode=cameraOf(s,'glass-message');
  const exit=enumValue(s.exit,['hold','collapse'],'hold','glass-message.exit');
  const {host,world}=makeWorld(args,'glass-message');
  const {surface,width}=cardSurface(K,host,[s.name,s.time,s.text]);
  surface.classList.add('pk-glass-message');
  const G=glassGrid(K);
  const row=el('div','pk-glass-message-row',surface);
  set(row,{display:'flex',flexDirection:'row',alignItems:'flex-start',gap:px(G.gap.group),minWidth:'0'});
  // The picture, or the first letters of the name on a tint of the text's ink.
  const avatar=el('div','pk-glass-message-avatar',row);
  set(avatar,{flex:'none',width:px(G.avatar.size),height:px(G.avatar.size),borderRadius:px(G.avatar.radius),overflow:'hidden',
    display:'grid',placeItems:'center',background:K.alpha(fg,.16),opacity:'0'});
  const picture=s.image?K.images[s.image]:null;
  if(picture){
    const image=el('img','',avatar);image.src=picture.src;image.alt='';
    set(image,{display:'block',width:'100%',height:'100%',objectFit:'cover'});
  }else{
    const letters=String(s.name).trim().split(/\s+/u).slice(0,2).map(word=>[...word][0]??'').join('').toUpperCase();
    K.design.apply(el('div','pk-glass-message-initials',avatar,letters),'initials');
  }
  const besideW=G.beside(G.avatar.size,G.gap.group);
  const words=el('div','pk-glass-message-words',row);
  set(words,{display:'flex',flexDirection:'column',gap:px(G.gap.hair),minWidth:'0',flex:'1'});
  // The name and, at the far end of its line, when the message came.
  const head=el('div','pk-glass-message-head',words);
  // The time stands at the top of the name's line, as on a phone.
  set(head,{display:'flex',flexDirection:'row',alignItems:'flex-start',gap:px(G.gap.item),minWidth:'0'});
  const name=el('div','pk-glass-message-name',head,s.name);
  K.design.apply(name,G.type.name.role,{step:G.type.name.step});
  set(name,{flex:'1',minWidth:'0',overflowWrap:'anywhere',opacity:'0'});
  let time=null;
  if(s.time){
    time=el('div','pk-glass-message-time',head,s.time);
    K.design.apply(time,G.type.time.role);
    set(time,{flex:'none',whiteSpace:'nowrap',opacity:'0'});
  }
  const text=el('div','pk-glass-message-text',words,s.text);
  try{K.design.fitGroup([text],{role:G.type.item.role,w:besideW,h:G.type.item.height,wrap:'anywhere'});}
  catch{smallestStep(K,[text],G.type.item.role,besideW);}
  set(text,{opacity:'0'});
  surface.dataset.messageAvatar=picture?'picture':'initials';
  const copy=finishCard(K,surface,width);
  const card=world.addCard({width,height:copy.height,element:surface,backdropOnly:true});
  card.group.scale.setScalar(fitToFrame(K,copy.height));
  world.prepare();
  const T=G.time;
  return (time_,duration=p.dur,backdropTime=time_)=>{
    const live=metadata['glass-message'].anchors(s,duration);
    const n=clamp(time_/duration),enter=phase(time_,live.open,live.open+T.open);
    const close=exit==='collapse'?smoother(phase(time_,live.collapse,duration*.98)):0;
    updateCard(card,world,width,copy.height,outBack(enter)*(1-close),outBack(phase(time_,live.open+.04,live.open+T.open+.04))*(1-close),smooth(enter)*(1-close));
    card.group.rotation.set(REST_TILT.x,REST_TILT.y,REST_TILT.z);
    card.opacity=smooth(phase(time_,live.open+.16,live.open+T.open))*(1-smooth(phase(close,.05,.55)));
    set(avatar,{opacity:smooth(phase(time_,live.name-.06,live.name+.1)).toFixed(4),transform:`scale(${(.6+.4*outBack(phase(time_,live.name-.06,live.name-.06+T.pop))).toFixed(4)})`});
    const named=smooth(phase(time_,live.name,live.name+T.fade));
    set(name,{opacity:named.toFixed(4)});
    if(time)set(time,{opacity:(.68*named).toFixed(4)});
    const said=smooth(phase(time_,live.text,live.text+T.fade));
    set(text,{opacity:said.toFixed(4),transform:`translateY(${px((1-said)*G.move.settle)})`});
    orbitCamera(world,cameraMode,n,{sway:.07,rise:.02,near:1,rest:1.04});world.render(backdropTime);
  };
}

// What ends or refuses is shown in one red across the family.
const DANGER='#ff3b30';

// A glass panel that is a call coming in: it grows out of a pill with the
// picture of who calls, their name and "Incoming call", a button to decline
// and one to accept that pulses as the call rings; a pointer comes up and
// accepts, the accept button goes, and the line under the name counts the
// call's seconds. After the look of "Incoming Phone Call Popup Notification
// UI" (SOURCE.json); every measure is the family's grid (grid.mjs).
function glassCall(args){
  const {K,p,fg}=args,{el,set,px}=K,s=p.scene;
  const cameraMode=cameraOf(s,'glass-call');
  const exit=enumValue(s.exit,['hold','collapse'],'hold','glass-call.exit');
  const answers=s.answer??true,status=s.status??'Incoming call';
  const {host,world}=makeWorld(args,'glass-call');
  const {surface,width}=cardSurface(K,host,[s.name,status]);
  surface.classList.add('pk-glass-call');
  const G=glassGrid(K);
  const mask=(node,source,color)=>set(node,{display:'block',backgroundColor:color,maskImage:`url("${source}")`,maskMode:'alpha',maskSize:'100% 100%',maskRepeat:'no-repeat'});
  const row=el('div','pk-glass-call-row',surface);
  set(row,{display:'flex',flexDirection:'row',alignItems:'center',gap:px(G.gap.group),minWidth:'0'});
  // Who calls: their picture, or a figure on a tint of the text's ink.
  const avatar=el('div','pk-glass-call-avatar',row);
  set(avatar,{flex:'none',width:px(G.avatar.size),height:px(G.avatar.size),borderRadius:'50%',overflow:'hidden',
    display:'grid',placeItems:'center',background:K.alpha(fg,.16),opacity:'0'});
  const picture=s.image?K.images[s.image]:null;
  if(picture){
    const image=el('img','',avatar);image.src=picture.src;image.alt='';
    set(image,{display:'block',width:'100%',height:'100%',objectFit:'cover'});
  }else{
    const figure=el('span','',avatar);figure.setAttribute('aria-hidden','true');
    mask(figure,islandIconFilledSource('user'),'currentColor');set(figure,{width:px(G.icon),height:px(G.icon)});
  }
  // In a wide frame the two buttons stand at the far end of the row and the
  // words take what is left. A tall or square frame has no room for that
  // beside a name: the buttons stand in a row of their own under it, apart,
  // as on a phone.
  const round=G.mark.size,side=G.wide,spread=side?G.gap.item:G.gap.column;
  const wordsW=side?G.content-G.avatar.size-2*G.gap.group-(2*round+spread):G.beside(G.avatar.size,G.gap.group);
  const words=el('div','pk-glass-call-words',row);
  set(words,{display:'flex',flexDirection:'column',gap:px(G.gap.hair),minWidth:'0',flex:'1'});
  const name=el('div','pk-glass-call-name',words,s.name);
  K.design.apply(name,G.type.name.role,{step:G.type.name.step});
  set(name,{maxWidth:px(wordsW),overflowWrap:'anywhere',opacity:'0'});
  // Under the name: what the call is, then, once it is taken, how long it has run.
  const line=el('div','pk-glass-call-line',words);
  set(line,{position:'relative'});
  const state=el('div','pk-glass-call-status',line,status);
  try{K.design.fitGroup([state],{role:G.type.label.role,w:wordsW,h:G.type.label.height,wrap:'anywhere'});}
  catch{smallestStep(K,[state],G.type.label.role,wordsW);}
  set(state,{opacity:'0'});
  const clock=el('div','pk-glass-call-clock',line,'00:00');
  K.design.apply(clock,G.type.label.role);
  set(clock,{position:'absolute',left:'0',top:'0',whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums',opacity:'0'});
  const buttons=el('div','pk-glass-call-buttons',side?row:surface);
  set(buttons,{display:'flex',flexDirection:'row',flex:'none',justifyContent:'center',gap:px(spread),opacity:'0'});
  surface.dataset.callButtons=side?'beside':'under';
  const button=(name,icon,color)=>{
    const node=el('div',name,buttons);node.setAttribute('role','button');
    set(node,{flex:'none',width:px(round),height:px(round),borderRadius:'50%',background:color,display:'grid',placeItems:'center'});
    const art=el('span','',node);art.setAttribute('aria-hidden','true');
    mask(art,islandIconFilledSource(icon),'#ffffff');set(art,{position:'relative',width:px(G.check.glyph),height:px(G.check.glyph)});
    return node;
  };
  const decline=button('pk-glass-call-decline','phone-off',DANGER),accept=button('pk-glass-call-accept','phone',activeColor(args));
  decline.setAttribute('aria-label','Decline');accept.setAttribute('aria-label','Accept');
  // A ring of the call: a halo of the button's colour leaves it and fades,
  // and the receiver shakes once. Each is one of the scene's `rings` marks,
  // which its sound is cued on too.
  const halo=el('span','pk-glass-call-ring',accept);halo.setAttribute('aria-hidden','true');
  accept.insertBefore(halo,accept.firstChild);
  set(accept,{position:'relative'});
  set(halo,{position:'absolute',inset:'0',borderRadius:'50%',background:activeColor(args),opacity:'0'});
  const receiver=accept.lastElementChild;
  surface.dataset.callAvatar=picture?'picture':'figure';
  const copy=finishCard(K,surface,width);
  // The voice of a call that is taken: a soft glow along the panel's lower
  // edge whose height follows somebody speaking. It lies under the panel's
  // content, inside its corners, and is drawn from the scene's time alone.
  const glow=el('div','pk-glass-call-voice',surface);glow.setAttribute('aria-hidden','true');
  set(glow,{position:'absolute',inset:'0',zIndex:'-1',overflow:'hidden',borderRadius:px(G.card.radius),pointerEvents:'none',opacity:'0'});
  const voice=host.ownerDocument.createElement('canvas');
  const voiceH=G.row+G.gap.group;
  voice.width=Math.max(1,Math.round(width));voice.height=Math.max(1,Math.round(voiceH));
  glow.append(voice);
  set(voice,{position:'absolute',left:'0',bottom:'0',width:px(width),height:px(voiceH),filter:`blur(${px(G.gap.item)})`});
  const pen=voice.getContext('2d');
  // The brand's accent when the film has one; else the colours of a spectrum.
  const tinted=K.plan.brand?.tokens?.accent!==undefined||K.plan.brand?.colors?.length||p.explicitAccent;
  const spectrum=tinted?[args.accent,args.accent]:['#ff5f6d','#ffc371','#47e891','#3fa9ff','#a66bff'];
  const paint=pen.createLinearGradient(0,0,voice.width,0);
  spectrum.forEach((color,k)=>paint.addColorStop(k/(spectrum.length-1),color));
  const TAU=2*Math.PI;
  function drawVoice(since,level){
    pen.clearRect(0,0,voice.width,voice.height);
    if(!(level>0))return;
    // How loud the voice is now: syllables, about three a second, of uneven weight.
    const loud=level*(.3+.7*Math.abs(Math.sin(2.3*since))*(.55+.45*Math.pow(Math.sin(7.1*since+1.3),2)));
    pen.fillStyle=paint;pen.beginPath();pen.moveTo(0,voice.height);
    for(let x=0;x<=voice.width;x+=Math.max(2,voice.width/160)){
      const u=x/voice.width;
      // Three waves that travel at their own speeds, low at the panel's ends.
      const wave=.5+.5*(.5*Math.sin(TAU*(1.5*u-.9*since))+.3*Math.sin(TAU*(3.2*u+1.3*since)+1)+.2*Math.sin(TAU*(5.1*u-2.1*since)+2));
      pen.lineTo(x,voice.height*(1-loud*(.2+.8*Math.sin(Math.PI*u))*wave));
    }
    pen.lineTo(voice.width,voice.height);pen.closePath();pen.fill();
  }
  const card=world.addCard({width,height:copy.height,element:surface,backdropOnly:true});
  card.group.scale.setScalar(fitToFrame(K,copy.height));
  world.prepare();
  const {pointer,cursor}=pointerOf(K,surface,'pk-glass-call-pointer',G.icon,2);
  const acceptAt=middleOf(accept),T=G.time;
  // The button's place in the panel, not in its own row.
  const at={x:buttons.offsetLeft+acceptAt.x,y:buttons.offsetTop+acceptAt.y};
  let shownSeconds=-1;
  return (time,duration=p.dur,backdropTime=time)=>{
    const live=metadata['glass-call'].anchors(s,duration);
    const n=clamp(time/duration),enter=phase(time,live.open,live.open+T.open);
    const close=exit==='collapse'?smoother(phase(time,live.collapse,duration*.98)):0;
    updateCard(card,world,width,copy.height,outBack(enter)*(1-close),outBack(phase(time,live.open+.04,live.open+T.open+.04))*(1-close),smooth(enter)*(1-close));
    card.group.rotation.set(REST_TILT.x,REST_TILT.y,REST_TILT.z);
    const shown=smooth(phase(time,live.open+.16,live.open+T.open))*(1-smooth(phase(close,.05,.55)));
    card.opacity=shown;
    const named=smooth(phase(time,live.name,live.name+T.fade));
    set(avatar,{opacity:smooth(phase(time,live.name-.06,live.name+.1)).toFixed(4),transform:`scale(${(.6+.4*outBack(phase(time,live.name-.06,live.name-.06+T.pop))).toFixed(4)})`});
    set(name,{opacity:named.toFixed(4)});
    set(buttons,{opacity:smooth(phase(time,live.name+.1,live.name+.1+T.fade)).toFixed(4)});
    const taken=answers?smooth(phase(time,live.answer,live.answer+.2)):0;
    set(glow,{opacity:(taken*shown).toFixed(4)});
    drawVoice(time-live.answer,taken);
    set(state,{opacity:(.68*named*(1-taken)).toFixed(4)});
    set(clock,{opacity:(.68*taken).toFixed(4)});
    const seconds=answers?Math.max(0,Math.floor(time-live.answer)):0;
    if(seconds!==shownSeconds){shownSeconds=seconds;clock.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
    // The ring that is sounding now, if any: how far it has run.
    const rung=live.rings.findLast(at=>at<=time),ring=rung===undefined?1:phase(time,rung,rung+T.between+T.fade);
    set(halo,{opacity:(.5*(1-ring)*(1-taken)).toFixed(4),transform:`scale(${(1+.9*smooth(ring)).toFixed(4)})`});
    set(receiver,{transform:`rotate(${(14*Math.sin(6*Math.PI*ring)*(1-ring)).toFixed(3)}deg)`});
    const press=answers?Math.sin(Math.PI*phase(time,live.answer,live.answer+.22)):0;
    set(accept,{opacity:(1-taken).toFixed(4),transform:`scale(${((1-.1*press)*(1-.4*taken)).toFixed(4)})`});
    // Taken, the call has one button: it moves to the end of the row beside
    // the words, or to the middle of a row of its own.
    set(decline,{transform:`translateX(${px((round+spread)*(side?1:.5)*taken)})`});
    accept.setAttribute('aria-hidden',String(answers&&time>=live.answer));
    if(answers){
      const coming={fx:at.x+G.icon*2,fy:copy.height+G.icon*2,x:at.x,y:at.y,start:live.reach,arrive:live.answer-.1,click:live.answer};
      const going={fx:at.x,fy:at.y,x:at.x+G.icon*2.4,y:copy.height+G.icon*2.4,start:live.answer+.34,arrive:live.answer+.9,click:Infinity};
      cursor(time,time>=going.start?going:coming);
      pointer.style.opacity=String(shown*(1-smooth(phase(time,live.answer+.55,live.answer+.9))));
    }else pointer.style.opacity='0';
    orbitCamera(world,cameraMode,n,{sway:.07,rise:.02,near:1,rest:1.04});world.render(backdropTime);
  };
}

// The word on the button where a network has its own for it.
const FOLLOW_WORD=Object.freeze({youtube:'Subscribe',substack:'Subscribe',telegram:'Join',discord:'Join',patreon:'Join',whatsapp:'Message'});
// Whether a colour is light enough to carry dark ink (its relative luminance).
function lightColor(hex){
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));
  return .2126*r+.7152*g+.0722*b>.5;
}

// A glass panel that says where to follow somebody: it grows out of a pill
// with the mark of a network on its own colour, a handle and a button, and a
// pointer comes up and presses the button, which takes the family's active
// colour. After the look of "TikTok Liquid Glass Follow Notification"
// (SOURCE.json); the marks are Simple Icons' (upstream/simple-icons), each
// its owner's trademark, used to name the service. Every measure is the
// family's grid (grid.mjs).
function glassFollow(args){
  const {K,p,fg}=args,{el,set,px}=K,s=p.scene;
  const cameraMode=cameraOf(s,'glass-follow');
  const exit=enumValue(s.exit,['hold','collapse'],'hold','glass-follow.exit');
  const network=enumValue(s.network,Object.keys(socialIcons),'tiktok','glass-follow.network'),mark=socialIcons[network];
  const word=s.text??FOLLOW_WORD[network]??'Follow';
  const {host,world}=makeWorld(args,'glass-follow');
  const {surface,width:panel,recipe}=cardSurface(K,host,[s.handle,word]);
  surface.classList.add('pk-glass-follow');
  surface.dataset.followNetwork=network;
  const G=glassGrid(K);
  set(surface,{alignItems:'center',textAlign:'center'});
  // The mark on a disc of its owner's colour, in the ink that reads on it.
  const badge=el('div','pk-glass-follow-badge',surface);
  badge.setAttribute('role','img');badge.setAttribute('aria-label',mark.title);
  set(badge,{flex:'none',width:px(G.avatar.size),height:px(G.avatar.size),borderRadius:'50%',background:mark.hex,display:'grid',placeItems:'center',opacity:'0'});
  const glyph=el('span','',badge);glyph.setAttribute('aria-hidden','true');
  const markInk=lightColor(mark.hex)?'#000000':'#ffffff',markSource=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(mark.svg)}`;
  set(glyph,{display:'block',width:px(G.icon),height:px(G.icon),backgroundColor:markInk,
    maskImage:`url("${markSource}")`,maskMode:'alpha',maskSize:'100% 100%',maskRepeat:'no-repeat'});
  const handle=el('div','pk-glass-follow-handle',surface,s.handle);
  K.design.apply(handle,G.type.name.role,{step:G.type.name.step});
  set(handle,{maxWidth:px(G.content),overflowWrap:'anywhere',opacity:'0'});
  // The button: a pill of the text's ink, faint, that takes the active colour when pressed.
  const button=el('div','pk-glass-follow-button',surface);
  button.setAttribute('role','button');
  set(button,{position:'relative',flex:'none',padding:`${px(G.gap.item)} ${px(G.gap.section)}`,borderRadius:px(G.row),background:K.alpha(fg,.18),opacity:'0'});
  const fill=el('span','pk-glass-follow-fill',button);fill.setAttribute('aria-hidden','true');
  set(fill,{position:'absolute',inset:'0',borderRadius:px(G.row),background:activeColor(args),opacity:'0'});
  const label=el('div','pk-glass-follow-label',button,word);
  K.design.apply(label,'button');
  set(label,{position:'relative',whiteSpace:'nowrap'});
  // In a wide frame the panel is as wide as what it holds (as the rating is);
  // a tall or square frame keeps the family's panel width.
  let width=panel;
  if(G.wide){
    set(handle,{width:'max-content'});
    width=Math.min(panel,Math.ceil(Math.max(badge.offsetWidth,handle.offsetWidth,button.offsetWidth))+2*recipe.paddingX);
    set(surface,{width:px(width)});
  }
  K.design.surfaceGap(surface,G.density('dense').sectionStep);
  const copy=finishCard(K,surface,width);
  // Measured before the panel is projected into 3D: the press sends the wave
  // of send-prompt across the panel from the button, and the wave carries a
  // picture of what is written on it.
  const letters=createLettering(K,surface);
  const inkHandle=letters.text(handle),inkLabel=letters.text(label);
  const inkButton=letters.box(button,{fill:activeColor(args),radius:'pill'});
  letters.measure();
  // The mark is drawn the way the page shows it: a disc of its colour and the
  // artwork as a mask filled with its ink.
  const doc=host.ownerDocument,logo=new doc.defaultView.Image();
  logo.src=markSource;K.defer(logo.decode());
  let tinted=null;
  const inkBadge=ctx=>{
    const cx=badge.offsetLeft+badge.offsetWidth/2,cy=badge.offsetTop+badge.offsetHeight/2;
    ctx.save();ctx.fillStyle=mark.hex;ctx.beginPath();ctx.arc(cx,cy,badge.offsetWidth/2,0,2*Math.PI);ctx.fill();
    if(logo.complete&&logo.naturalWidth){
      if(!tinted){
        tinted=doc.createElement('canvas');tinted.width=tinted.height=256;
        const pen=tinted.getContext('2d');
        pen.fillStyle=markInk;pen.fillRect(0,0,256,256);
        pen.globalCompositeOperation='destination-in';pen.drawImage(logo,0,0,256,256);
      }
      ctx.drawImage(tinted,cx-G.icon/2,cy-G.icon/2,G.icon,G.icon);
    }
    ctx.restore();
  };
  const ink=ctx=>{inkBadge(ctx);inkHandle(ctx);inkButton(ctx);inkLabel(ctx);};
  const card=world.addCard({width,height:copy.height,element:surface,backdropOnly:true});
  card.group.scale.setScalar(fitToFrame(K,copy.height));
  const drawWave=world.addSendWave(card,{ink,source:{x:button.offsetLeft,y:button.offsetTop,w:button.offsetWidth,h:button.offsetHeight}});
  world.prepare();
  const {pointer,cursor}=pointerOf(K,surface,'pk-glass-follow-pointer',G.icon,2);
  const at=middleOf(button),T=G.time;
  return (time,duration=p.dur,backdropTime=time)=>{
    const live=metadata['glass-follow'].anchors(s,duration);
    const n=clamp(time/duration),enter=phase(time,live.open,live.open+T.open);
    const close=exit==='collapse'?smoother(phase(time,live.collapse,duration*.98)):0;
    updateCard(card,world,width,copy.height,outBack(enter)*(1-close),outBack(phase(time,live.open+.04,live.open+T.open+.04))*(1-close),smooth(enter)*(1-close));
    card.group.rotation.set(REST_TILT.x,REST_TILT.y,REST_TILT.z);
    const shown=smooth(phase(time,live.open+.16,live.open+T.open))*(1-smooth(phase(close,.05,.55)));
    card.opacity=shown;
    set(badge,{opacity:smooth(phase(time,live.handle-.08,live.handle+.08)).toFixed(4),transform:`scale(${(.6+.4*outBack(phase(time,live.handle-.08,live.handle-.08+T.pop))).toFixed(4)})`});
    const named=smooth(phase(time,live.handle,live.handle+T.fade));
    set(handle,{opacity:named.toFixed(4),transform:`translateY(${px((1-named)*G.move.settle)})`});
    const offered=smooth(phase(time,live.handle+.12,live.handle+.12+T.fade));
    const pressed=smooth(phase(time,live.click,live.click+.16)),press=Math.sin(Math.PI*phase(time,live.click,live.click+.22));
    set(button,{opacity:offered.toFixed(4),transform:`scale(${(1-.06*press).toFixed(4)})`});
    set(fill,{opacity:pressed.toFixed(4)});
    button.setAttribute('aria-pressed',String(time>=live.click));
    // The wave leaves the button at the press and has crossed the panel a second later.
    drawWave(phase(time,live.click,live.click+Math.min(1,Math.max(.4,(exit==='collapse'?live.collapse:duration)-live.click))));
    // The pointer comes up from under the panel, presses the button and goes.
    const coming={fx:at.x+G.icon*2,fy:copy.height+G.icon*2,x:at.x,y:at.y,start:live.reach,arrive:live.click-.1,click:live.click};
    const going={fx:at.x,fy:at.y,x:at.x+G.icon*2.4,y:copy.height+G.icon*2.4,start:live.click+.34,arrive:live.click+.9,click:Infinity};
    cursor(time,time>=going.start?going:coming);
    pointer.style.opacity=String(shown*(1-smooth(phase(time,live.click+.55,live.click+.9))));
    orbitCamera(world,cameraMode,n,{sway:.07,rise:.02,near:1,rest:1.04});world.render(backdropTime);
  };
}

const LIKE_ICONS=Object.freeze(['like','heart','star','bell','save','plus','check']);

// A glass button somebody presses: a pill grows out of a round seed with an
// icon and a word, a pointer comes up to the icon and clicks, a ripple runs
// the pill and the icon fills with the family's active colour. After the look of
// "Liquid Glass Like Button" (SOURCE.json); the pill is the design system's
// field, the icon the grid's, the word a title.
function glassLike(args){
  const {K,p,fg}=args,{el,set,px,design}=K,s=p.scene;
  const cameraMode=cameraOf(s,'glass-like','static');
  const exit=enumValue(s.exit,['hold','collapse'],'hold','glass-like.exit');
  const iconName=enumValue(s.icon,LIKE_ICONS,'like','glass-like.icon');
  const {host,world}=makeWorld(args,'glass-like');
  const G=glassGrid(K);
  const field=el('div','pk-glass-like',host);
  field.dataset.glassCopy=s.text;
  const recipe=design.surface(field,'field',{shape:'pill',density:'comfortable'});
  set(field,{position:'absolute',left:'0',top:'0',display:'flex',alignItems:'center',color:fg,whiteSpace:'nowrap'});
  field.setAttribute('role','button');
  // The word is set in the largest step of its role at which the pill is no
  // wider than the safe area.
  const word=el('div','pk-glass-like-label',field,s.text),role=G.type.action.role;
  const room=K.safe.w*.9-2*recipe.paddingX-recipe.gap;
  let type=design.type(role,design.steps(role).at(-1).step);
  for(const step of design.steps(role)){
    design.apply(word,role,{step:step.step});set(word,{flex:'none',whiteSpace:'nowrap'});
    type=step;
    if(word.offsetWidth+step.size<=room)break;
  }
  const height=type.lineHeight+2*recipe.paddingY,iconSize=type.size;
  set(field,{height:px(height)});
  // The icon twice, one over the other: its outline in the text's ink, and
  // filled in with colour for when it is pressed. Both are alpha masks.
  const icon=el('div','pk-glass-like-icon',field);
  field.insertBefore(icon,word);
  set(icon,{position:'relative',flex:'none',width:px(iconSize),height:px(iconSize)});
  const layer=(name,source,color,fill)=>{
    const badge=el('div',name,icon);badge.setAttribute('aria-hidden','true');
    badge.dataset.icon=iconName;if(fill)badge.dataset.iconFill='true';
    set(badge,{position:'absolute',inset:'0',color});
    set(el('span','',badge),{display:'block',width:'100%',height:'100%',backgroundColor:'currentColor',maskImage:`url("${source}")`,maskMode:'alpha',maskSize:'100% 100%',maskRepeat:'no-repeat'});
    return badge;
  };
  const outline=layer('pk-glass-like-outline',islandIconSource(iconName),'inherit',false);
  const filled=layer('pk-glass-like-filled',islandIconFilledSource(iconName),activeColor(args),true);
  const width=2*recipe.paddingX+iconSize+recipe.gap+Math.ceil(word.offsetWidth);
  set(field,{width:px(width)});
  // A pill wider than the frame's safe width is scaled as a whole.
  const scale=Math.min(1,K.safe.w*.9/width);
  // Measured before the pill is projected into 3D: the click sends a ripple
  // through the glass that carries a picture of the icon and the word.
  const letters=createLettering(K,field);
  const inkOutline=letters.icon(outline),inkFilled=letters.icon(filled),inkWord=letters.text(word);
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
    inkWord(ctx,state.shown);
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
      icon.style.filter=unseen;word.style.filter=unseen;
    }else drawWave(wave,clickBox);
    set(outline,{opacity:(1-liked).toFixed(4)});
    set(filled,{opacity:liked.toFixed(4),transform:`scale(${pop.toFixed(4)})`});
    field.setAttribute('aria-pressed',String(time>=live.click));
    // The pointer comes up from under the pill, clicks the icon and goes.
    const coming={fx:at.x+iconSize*2,fy:height*2.6,x:at.x,y:at.y,start:live.reach,arrive:live.click-.1,click:live.click};
    const going={fx:at.x,fy:at.y,x:at.x+iconSize*2.4,y:height*2.8,start:live.click+.34,arrive:live.click+.9,click:Infinity};
    cursor(time,time>=going.start?going:coming);
    pointer.style.opacity=String(shown*(1-smooth(phase(time,live.click+.55,live.click+.9))));
    orbitCamera(world,cameraMode,n,{sway:.07,rise:.02,near:1,rest:1.04});world.render(backdropTime);
  };
}

// A ride: glass scenes one after another on one drop. A step's scene grows
// out of the drop and folds back into it; the drop then travels to where the
// next step stands and that scene grows out of it. Each step is the scene
// itself, in its own world; the ride shows one at a time, moves the world of
// the step that has ended, and hands the drop over where the two agree.
function glassRide(args){
  const {K,p,cam}=args,{el,set}=K,s=p.scene;
  const plan=metadata['glass-ride'].plan(s,p.dur);
  const steps=plan.map((part,i)=>{
    const layer=el('div','pk-glass-ride-step',cam);
    set(layer,{position:'absolute',inset:'0',visibility:'hidden'});
    const ride={worlds:[],joined:i>0};
    const draw=factories[part.scene.type]({...args,cam:layer,ride,p:{...p,scene:part.scene,dur:part.dur}});
    const world=ride.worlds[0];
    // The ride is the scene; its step says which scene the world draws.
    world.canvas.dataset.glassStep=world.canvas.dataset.glass;world.canvas.dataset.glass='glass-ride';
    return {...part,layer,draw,world};
  });
  // The ride's camera: every step is a slide of its own, more than a frame
  // away from the one before, and the camera stands over the step that plays.
  const SLIDE=1.25,WAY={right:[1,0],left:[-1,0],down:[0,1],up:[0,-1]};
  steps.forEach((step,i)=>{
    const [x,y]=WAY[step.move],before=steps[i-1]?.camera??{x:0,y:0};
    step.camera=i?{x:before.x+x*K.W*SLIDE,y:before.y+y*K.H*SLIDE}:before;
  });
  let shown='';
  return (time,duration=p.dur,backdropTime=time)=>{
    // The step that plays, or the one whose drop is on its way to the next.
    let at=steps.findLastIndex(step=>time>=step.start);if(at<0)at=0;
    const step=steps[at],next=steps[at+1],local=Math.min(step.dur,Math.max(0,time-step.start));
    const travelling=next&&time>step.start+step.dur,go=travelling?phase(time,step.start+step.dur,next.start):0;
    // A scene that does not begin on the drop comes into the frame as the camera reaches it.
    const arriving=travelling&&!next.drop?at+1:-1;
    if(shown!==`${at}:${arriving}`){
      // A step that is not seen stands as it begins or as it ended, whatever
      // was last drawn in it: seeking back and forth leaves the same page.
      steps.forEach((other,i)=>{
        const seen=i===at||i===arriving;
        set(other.layer,{visibility:seen?'visible':'hidden',opacity:'1'});
        if(!seen){other.world.shift(0,0);other.world.pan(other.camera.x,other.camera.y,1);other.draw(i<at?other.dur:0,other.dur,i<at?other.start+other.dur:other.start);}
      });
      shown=`${at}:${arriving}`;
    }
    if(travelling){
      const from=step.world.stands(),to=next.world.stands();
      const way={x:next.camera.x-step.camera.x,y:next.camera.y-step.camera.y};
      if(next.drop){
        // The drop leaps to the next slide and the camera goes after it: it
        // sets off a moment later and arrives with the drop, in the middle of
        // its frame again.
        const follow=smoother(phase(go,.12,1));
        const leap=dropLeap(go,way.x+to.dx-from.dx,way.y+to.dy-from.dy,K.H);
        // It pulls back while the drop is in the air, to take the whole leap in, and comes in again as it lands.
        const near=1/(1+PULL_BACK*Math.sin(Math.PI*smoother(go)));
        step.world.pan(step.camera.x+way.x*follow,step.camera.y+way.y*follow,1/near);
        // Seen from further off, the drop is smaller and nearer the middle of the frame.
        const seen={x:(from.dx+leap.dx-way.x*follow)*near-from.dx,y:(from.dy+leap.dy-way.y*follow)*near-from.dy};
        step.world.shift(seen.x,seen.y,leap.sx*near,leap.sy*near);
      }else{
        // The drop stays where it is and the camera goes on: the drop leaves
        // the frame the way the camera came, and the next scene comes in from
        // where it is going, the one giving way to the other on the road.
        const follow=smoother(go),x=step.camera.x+way.x*follow,y=step.camera.y+way.y*follow;
        step.world.pan(x,y,1);step.world.shift(-way.x*follow,-way.y*follow);
        next.world.pan(x,y,1);next.world.shift(way.x*(1-follow),way.y*(1-follow));
        set(next.layer,{opacity:smooth(phase(go,.35,.75)).toFixed(4)});
        next.draw(0,next.dur,backdropTime);
      }
    }else{step.world.pan(step.camera.x,step.camera.y,1);step.world.shift(0,0);}
    step.draw(local,step.dur,backdropTime);
  };
}
// How the drop gets from one step's place to the next: two leaps, a high one
// and a low one, stretched as it flies and squashed as it lands, and round
// again where it sets off and where it arrives. `go` runs 0 to 1; the answer
// is its place in frame pixels from where it set off, and its scale.
// How much more the ride's camera sees at the height of a leap.
const PULL_BACK=.6;
const LEAPS=Object.freeze([{until:.62,height:.3},{until:1,height:.1}]);
export function dropLeap(go,dx,dy,frameHeight){
  if(go<=0)return {dx:0,dy:0,sx:1,sy:1};
  if(go>=1)return {dx,dy,sx:1,sy:1};
  const index=LEAPS.findIndex(leap=>go<leap.until),leap=LEAPS[index],from=index?LEAPS[index-1].until:0;
  const fly=(go-from)/(leap.until-from),arc=4*fly*(1-fly);
  // It lands between the leaps: flat for a moment, then off again.
  const landing=index?1-smooth(phase(fly,0,.3)):smooth(phase(fly,.82,1));
  const stretch=arc*(1-landing),squash=landing*.5;
  return {dx:dx*go,dy:dy*go-leap.height*frameHeight*arc,
    sx:1-.1*stretch+.3*squash,sy:1+.18*stretch-.28*squash};
}

export const factories=timedGlassFactories({'glass-ride':glassRide,'glass-stepper':glassStepper,'glass-island':island,'glass-widgets':glassWidgets,'glass-controls':controls,'glass-ask':ask,'glass-search':search,'glass-lens':lens,'glass-send-prompt':sendPrompt,'glass-steps':glassSteps,'glass-checklist':glassChecklist,'glass-like':glassLike,'glass-rating':glassRating,'glass-message':glassMessage,'glass-follow':glassFollow,'glass-call':glassCall});
