// The recipe is compiled once. Rendering any time has no dependency on earlier frames.
export const FORMATS = {
  '16:9': {width:1920,height:1080,safe:{top:.05,bottom:.05,left:.04,right:.04}},
  '1:1': {width:1080,height:1080,safe:{top:.05,bottom:.05,left:.05,right:.05}},
  '9:16': {width:1080,height:1920,safe:{top:.08,bottom:.16,left:.05,right:.05}},
};
export const DEFAULT_STYLE = {bg:'#0D0B1E',fg:'#FFFFFF',muted:'#A7A3BA',accent:'#FB2D89',control:'#353244',font:'Geist'};
const clamp = (v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const mix = (a,b,t)=>a+(b-a)*t;
const smooth = t=>{t=clamp(t);return t*t*(3-2*t);};
const span = (t,a,b)=>clamp((t-a)/(b-a));
const point = (a,b,t)=>({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)});

export function compile({aspect='16:9',duration,style={},labels={},sliderLength,music={},timing={}}={}) {
  if(!FORMATS[aspect])throw new Error('aspect: use 16:9, 1:1 or 9:16');
  const bpm=music.bpm??120,offset=music.offset??0;
  if(!Number.isFinite(bpm)||bpm<60||bpm>180)throw new Error('music.bpm: expected 60–180');
  if(!Number.isFinite(offset)||offset<0)throw new Error('music.offset: expected non-negative seconds');
  for(const key of Object.keys(timing))if(key!=='slide')throw new Error(`timing.${key}: unsupported action`);
  const theme={...DEFAULT_STYLE,...style};
  for(const key of ['bg','fg','muted','accent','control'])if(!/^#[\da-f]{6}$/i.test(theme[key]))throw new Error(`style.${key}: expected #RRGGBB`);
  if(!['Geist','Archivo','Geist Mono'].includes(theme.font))throw new Error('style.font: use a bundled font (Geist, Archivo or Geist Mono)');
  const wide=aspect==='16:9',tall=aspect==='9:16';
  const length=sliderLength??(wide?460:tall?440:400);
  if(!Number.isFinite(length)||length<300||length>(wide?480:440))throw new Error('sliderLength: outside the supported responsive envelope');
  const start=wide?{x:220,y:0}:{x:-length/2,y:tall?320:230};
  const end={x:start.x+length,y:start.y};
  const layout={
    switch:{cx:0,cy:0,w:91,h:52,r:22,off:{x:-19.5,y:0},on:{x:19.5,y:0}},
    slider:{start,end,length,tickCount:11},
    bounds:{x:Math.min(-60,start.x-35),y:-100,w:end.x+35-Math.min(-60,start.x-35),h:start.y+210},
  };
  const text={switch:'FOCUS',slider:'INTENSITY',...labels};
  for(const [key,value] of Object.entries(text))if(typeof value!=='string'||!value.trim()||value.length>40)throw new Error(`labels.${key}: use 1–40 characters`);
  // One authored action schedule feeds both visual evaluation and sound events.
  // This proof interprets these three actions; it is not a general physics engine.
  const actions={
    toggle:{at:.5,duration:.28,target:'switch',from:'switch.off',to:'switch.on'},
    jump:{at:1,duration:.5,actor:'ball',from:'switch.on',to:'slider.start'},
    slide:{at:1.5,duration:3,actor:'ball',target:'slider',from:'slider.start',to:'slider.end'},
  };
  if(timing.slide!==undefined){
    const value=timing.slide;
    if(!value||!Number.isFinite(value.startBeat)||!Number.isFinite(value.endBeat)||value.startBeat<0||value.endBeat<=value.startBeat)throw new Error('timing.slide: expected 0 <= startBeat < endBeat');
    const at=offset+value.startBeat*60/bpm,end=offset+value.endBeat*60/bpm;
    if(at<actions.jump.at+actions.jump.duration)throw new Error('timing.slide.startBeat: the ball must land before sliding');
    actions.slide.at=at;actions.slide.duration=end-at;
  }
  const minimum=actions.slide.at+actions.slide.duration+1.5;
  duration??=Math.max(6,minimum);
  if(!Number.isFinite(duration)||duration<minimum||duration>120)throw new Error(`duration: expected ${minimum}–120 seconds, including the ending camera move`);
  const {toggle,jump,slide}=actions;
  // Events describe interactions. The threshold schedule is the inverse of the
  // slider's easeOutQuad curve, so sound remains on its actual visual crossing.
  const events=[
    {id:'toggle-on',time:toggle.at,kind:'switch.on',target:toggle.target,value:1},
    {id:'ball-detach',time:jump.at,kind:'actor.detach',target:toggle.target},
    {id:'ball-land',time:jump.at+jump.duration,kind:'actor.land',target:slide.target,value:0},
    ...Array.from({length:9},(_,i)=>{const value=(i+1)*10;return {id:`slider-${value}`,time:slide.at+slide.duration*(1-Math.sqrt(1-value/100)),kind:'slider.tick',target:slide.target,value};}),
    {id:'slider-complete',time:slide.at+slide.duration,kind:'slider.complete',target:slide.target,value:100},
  ];
  const camera={
    initial:{x:0,y:13,zoom:wide?4.1:tall?3.1:3.7},
    landing:wide?{x:380,y:8,zoom:2.35}:{x:tall?-12:-30,y:start.y+5,zoom:tall?1.86:1.95},
    finish:wide?{x:500,y:8,zoom:2.35}:{x:tall?12:30,y:start.y+5,zoom:tall?1.86:1.95},
    overview:wide?{x:320,y:10,zoom:2.1}:{x:0,y:tall?170:135,zoom:tall?1.85:1.95},
  };
  return {schemaVersion:1,aspect,...FORMATS[aspect],duration,style:theme,labels:text,layout,camera,actions,events,...(timing.slide?{music:{bpm,offset},timing}: {})};
}

export function resolveAnchor(plan,name,state) {
  const {layout}=plan;
  const anchors={
    'switch.off':layout.switch.off,'switch.on':layout.switch.on,
    'slider.start':layout.slider.start,'slider.end':layout.slider.end,
  };
  if(name==='slider.handle')return point(layout.slider.start,layout.slider.end,(state?.sliderValue??0)/100);
  if(!anchors[name])throw new Error(`Unknown anchor: ${name}`);
  return {...anchors[name]};
}

function cameraMix(a,b,t) {
  return {x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),zoom:Math.exp(mix(Math.log(a.zoom),Math.log(b.zoom),t))};
}

export function stateAt(plan,seconds) {
  if(!Number.isFinite(seconds))throw new Error('time: expected finite seconds');
  const time=clamp(seconds,0,plan.duration),{layout,camera:cam,actions}=plan;
  const {toggle:on,jump,slide}=actions,land=jump.at+jump.duration,done=slide.at+slide.duration;
  const toggle=smooth(span(time,on.at,on.at+on.duration));
  const drag=span(time,slide.at,done),progress=1-(1-drag)**2;
  const phase=time<on.at?'ready':time<jump.at?'switch':time<land?'flight':time<done?'drag':'complete';
  let actor,scaleX=1,scaleY=1;
  if(time<jump.at){
    actor={...point(resolveAnchor(plan,on.from),resolveAnchor(plan,on.to),toggle),owner:'switch'};
    const crouch=Math.sin(Math.PI*span(time,jump.at-.17,jump.at));
    scaleX=1+.15*crouch;scaleY=1-.15*crouch;
  }else if(time<land){
    const p=span(time,jump.at,land);
    actor={...point(resolveAnchor(plan,jump.from),resolveAnchor(plan,jump.to),smooth(p)),owner:'world'};
    actor.y-=(plan.aspect==='16:9'?115:100)*4*p*(1-p);
    scaleX=1-.09*Math.sin(Math.PI*p);scaleY=1+.16*Math.sin(Math.PI*p);
  }else{
    actor={...point(resolveAnchor(plan,slide.from),resolveAnchor(plan,slide.to),progress),owner:'slider'};
    const elapsed=time-land;
    // Finite, analytic settling: random access is identical to forward playback.
    const squash=elapsed<.32?Math.exp(-elapsed*13)*Math.cos(elapsed*28)*(1-smooth(elapsed/.32)):0;
    scaleX=1+.25*squash;scaleY=1-.22*squash;
  }
  actor={...actor,r:22,scaleX,scaleY};
  let camera;
  if(time<land){
    camera=cameraMix(cam.initial,cam.landing,smooth(span(time,jump.at-.2,land)));
    // Reflowed layouts travel downward. Delay vertical follow until the ball
    // leaves its perch; otherwise the camera crops the top of its jump.
    camera.y=mix(cam.initial.y,cam.landing.y,smooth(span(time,jump.at-.05,land)));
  }
  else if(time<done)camera=cameraMix(cam.landing,cam.finish,progress);
  else camera=cameraMix(cam.finish,cam.overview,smooth(span(time,done+.2,done+1.05)));
  return {time,phase,switchValue:toggle,sliderValue:100*progress,actor,camera,bubbleOpacity:smooth(span(time,land-.08,land+.12))};
}

export function projectPoint(plan,camera,p) {
  return {x:plan.width/2+(p.x-camera.x)*camera.zoom,y:plan.height/2+(p.y-camera.y)*camera.zoom};
}
