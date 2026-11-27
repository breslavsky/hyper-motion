// Native scene around the unchanged MIT Thinking Orbs engine and canonical
// clock-free adapter. See ../thinking-orbs/vendor/SOURCE.json and LICENSE.
import {createOrb} from '../../thinking-orbs/orb.mjs';
import metadata from '../../metadata.mjs';

export const sceneFactories = {
  'thinking-orb': ({p,cam,fg,accent,palette,bg,K}) => {
    const s=p.scene,{safe,W,H,set,px}=K,D=K.design;
    const errors=[...metadata['thinking-orb'].validate(s),...metadata['thinking-orb'].validateResolved(s,{palette,accent})];
    if(errors.length)throw new Error(`thinking-orb: ${errors.join('; ')}`);
    const group=K.el('div','',cam);
    set(group,{position:'absolute',inset:'0',color:fg});
    group.dataset.thinkingOrbScene=s.state;
    const wide=W>H*1.2,copy=Boolean(s.title||s.body),gap=D.space(5);
    const copyWidth=wide&&copy?safe.w*.49:safe.w;
    const copyX=wide&&copy?safe.x+safe.w-copyWidth:safe.x;
    const textGroup=K.el('div','',group);
    set(textGroup,{position:'absolute',left:px(copyX),width:px(copyWidth),top:'0'});
    const title=s.title?D.text(textGroup,s.title,{role:'sceneTitle',align:wide?'left':'center',box:{w:copyWidth,h:D.type('sceneTitle').lineHeight*3}}):null;
    const titleH=title?.h??0,bodyY=titleH+(title&&s.body?D.space(3):0);
    const body=s.body?D.text(textGroup,s.body,{role:'body',align:wide?'left':'center',box:{y:bodyY,w:copyWidth,h:D.type('body').lineHeight*4}}):null;
    const copyHeight=body?bodyY+body.h:titleH;
    const availableW=wide&&copy?safe.w-copyWidth-gap:safe.w;
    const availableH=wide||!copy?safe.h:safe.h-copyHeight-gap;
    if(availableH<=0||availableW<=0)throw new Error('thinking-orb: copy leaves no room for the orb');
    const size=Math.max(1,Math.floor(Math.min(availableW,availableH)*(s.size??1)));
    // Fit includes the canvas, not only its captions, under the actual camera.
    const holder=K.el('div','',group);
    holder.setAttribute('data-layout-fit-anchor','');
    const canvas=K.el('canvas','',holder);
    canvas.setAttribute('aria-hidden','true');
    set(holder,{position:'absolute',width:px(size),height:px(size)});
    const totalHeight=wide?Math.max(size,copyHeight):size+(copy?gap+copyHeight:0);
    const top=safe.y+(safe.h-totalHeight)/2;
    set(holder,{left:px(safe.x+(availableW-size)/2),top:px(wide?safe.y+(safe.h-size)/2:top)});
    set(textGroup,{top:px(wide?safe.y+(safe.h-copyHeight)/2:top+size+(copy?gap:0))});
    const color=s.tint===undefined?accent:(palette[s.tint]??s.tint);
    const orb=createOrb(canvas,{state:s.state,size,presetSize:64,pixelRatio:1,speed:s.orbSpeed??1,dark:K.lum(bg)<.4,color});
    canvas.dataset.thinkingOrb=s.state;
    for(const [key,value] of Object.entries(orb.options))canvas.dataset[key]=String(value);
    canvas.orbInstance=orb;
    K.onDispose(()=>orb.dispose());
    const times=metadata['thinking-orb'].times(s,p.dur,p.beatLen);
    // The parent native runtime supplies seekable local seconds; no second clock.
    return l=>{
      orb.draw(l);
      for(const [part,at] of [[title,times.title],[body,times.body]])if(part){
        const progress=K.expoOut(K.prog(l,at,times.arrival));
        set(part.el,{opacity:progress.toFixed(5),transform:`translateY(${px((1-progress)*D.space(2))})`});
      }
    };
  },
};
// The scene's factory (scenes/folders.mjs).
export const factory = sceneFactories["thinking-orb"];
