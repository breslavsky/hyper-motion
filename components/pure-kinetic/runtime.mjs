import {components,validateContent,validateStyle,validateDuration} from './catalog.mjs';

export function makeContext(root, config) {
  const {width,height,norms}=config;
  const scale=Math.min(width,height)/norms.base;
  const typeScale=scale*(height/width>norms.tall.over?norms.tall.scale:1);
  const m=norms.aspects[config.aspect].safe;
  const ctx={root,width,height,duration:config.duration,style:config.style,seed:config.seed??0,scale,
    safe:{x:width*m.left,y:height*m.top,w:width*(1-m.left-m.right),h:height*(1-m.top-m.bottom)},
    type:Object.fromEntries(Object.entries(norms.type).map(([k,v])=>[k,v*typeScale]))};
  ctx.el=(tag,parent,css={},text='')=>{const n=document.createElement(tag);Object.assign(n.style,css);if(text)n.textContent=text;parent.append(n);return n;};
  ctx.text=(parent,text,role='body',css={})=>{
    const n=ctx.el('div',parent,{fontFamily:`"${ctx.style.font}",sans-serif`,fontSize:`${ctx.type[role]}px`,fontWeight:String(ctx.style.weight),letterSpacing:`${ctx.style.tracking}em`,lineHeight:'1.06',color:ctx.style.fg,...css},text);
    n.dataset.textRole=role;return n;
  };
  ctx.fit=(node,w,h,{max,min=ctx.type.label,wrap=true}={})=>{
    Object.assign(node.style,{width:`${w}px`,whiteSpace:wrap?'normal':'nowrap',overflowWrap:wrap?'break-word':'normal'});
    const previousHeight=node.style.height;node.style.height='auto';
    const fits=size=>{node.style.fontSize=`${size}px`;return node.scrollWidth<=w+1&&node.scrollHeight<=h+1;};
    if(!fits(min))throw new Error(`${node.dataset.field||node.dataset.textRole||'text'}: cannot fit at ${min.toFixed(1)}px; shorten the text`);
    let lo=min,hi=Math.max(min,max??ctx.type.big);
    for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(fits(mid))lo=mid;else hi=mid;}
    node.style.fontSize=`${lo}px`;node.style.height=previousHeight;
    return lo;
  };
  return ctx;
}

export async function mount(root, config, variables, gsap) {
  const raw={};
  for(const [key,field] of Object.entries(components[config.kind].fields)) {
    const value=variables[key]??config.data[key];
    try{raw[key]=field.type==='array'&&typeof value==='string'?JSON.parse(value):value;}
    catch{throw new Error(`${config.kind}.${key}: invalid JSON array`);}
  }
  const data=validateContent(config.kind,raw);
  const style=validateStyle(variables.style?JSON.parse(variables.style):config.style);
  const duration=validateDuration(Number(variables.duration??config.duration));
  if(Math.abs(duration-config.duration)>.0001) throw new Error('duration: regenerate the host and component together to change timing');
  Object.assign(root.style,{position:'absolute',inset:'0',width:`${config.width}px`,height:`${config.height}px`,overflow:'hidden',isolation:'isolate',background:style.bg});
  const fontText=Object.values(data).flat().join(' ');
  await document.fonts.load(`${style.weight} 100px "${style.font}"`,fontText);
  await document.fonts.ready;
  const ctx=makeContext(root,{...config,style,duration});
  const {default:create}=await import(`./scenes/${config.kind}.mjs`);
  const scene=await create(ctx,data);
  let time=0;
  const clock={get time(){return time;},set time(value){time=Math.max(0,Math.min(duration,Number(value)));scene.draw(time);}};
  // A property setter runs even when HyperFrames seeks with GSAP callbacks suppressed.
  const timeline=gsap.timeline({paused:true}).to(clock,{time:duration,duration,ease:'none'},0);
  scene.draw(0);
  window.__mfComponents??={};
  // A definition can be mounted by several native hosts. Its authored ID is
  // not the identity of an instance (HyperFrames scopes its local document).
  const host=root.closest('[data-composition-file], [data-composition-src]');
  const id=host?.dataset.compositionId??config.id;
  if(window.__mfComponents[id])throw new Error(`duplicate component root: ${id}`);
  window.__mfComponents[id]={kind:config.kind,data,style,duration,root,scene,ctx,get time(){return time;},dispose(){timeline.kill();scene.dispose?.();delete window.__mfComponents[id];}};
  // GSAP timelines are thenables: returning one from an async function would
  // await completion forever because the render timeline is deliberately paused.
  return {timeline};
}
