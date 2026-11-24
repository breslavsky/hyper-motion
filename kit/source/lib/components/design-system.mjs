/* Radix Themes 3.3.0 token values, MIT. See upstream/radix-themes/RECEIPT.json.
 * Pure Kinetic owns the semantic roles and the video-scale mapping below.
 * This module styles existing native components; it adds no player or clock.
 */
import {createSurfaceSystem} from './surface-system.mjs';
const freeze = value => {Object.values(value).forEach(v=>{if(v&&typeof v==='object')freeze(v);});return Object.freeze(value);};
export const RADIX_TOKENS = freeze({
  fontSizes:[12,14,16,18,20,24,28,35,60],
  lineHeights:[16,20,24,26,28,30,36,40,60],
  letterSpacing:['0.0025em','0em','0em','-0.0025em','-0.005em','-0.00625em','-0.0075em','-0.01em','-0.025em'],
  space:[4,8,12,16,24,32,40,48,64],radius:[3,4,6,8,12,16],
});
export const ROLE_STEPS = freeze({
  // Video display roles share the Radix ladder. Hero type uses one explicit
  // octave for a word-led shot; it never changes interface/control sizes.
  hero:{steps:[9,8,7,6,5,4,3,2,1],weight:700,multiplier:2},
  display:{steps:[9,8,7,6,5,4,3],weight:700},
  sceneTitle:{steps:[7,6,5],weight:700},cardTitle:{steps:[6,5],weight:700},
  body:{steps:[3,2],weight:400},label:{steps:[1],weight:500},
  button:{steps:[2],weight:500},caption:{steps:[3,2],weight:500},
  quote:{steps:[8,7,6,5,4,3],weight:500},name:{steps:[3,2],weight:500},
  meta:{steps:[1],weight:400},value:{steps:[2],weight:500},
  calloutValue:{steps:[3],weight:700},metric:{steps:[7,6],weight:700},initials:{steps:[3],weight:500},
  code:{steps:[2,1],weight:400,family:'"Geist Mono", monospace'},
  controlLabel:{steps:[2,1],weight:500},
});

// Shared by native scene text and decorative interface chrome. The layout
// supplies a finite width; neither policy changes the chosen font recipe.
export function truncateLine(node) {
  Object.assign(node.style,{minWidth:'0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',
    overflowWrap:'normal',wordBreak:'normal',textWrap:'nowrap'});
  node.dataset.designOverflow='ellipsis';
  return node;
}

export function truncateCanvasLine(context,copy,maxWidth) {
  if(!Number.isFinite(maxWidth)||maxWidth<=0)throw new Error('Invalid canvas label width');
  const fullText=String(copy??''),width=context.measureText(fullText).width;
  if(width<=maxWidth)return {text:fullText,fullText,width,truncated:false};
  const ellipsis='…';
  if(context.measureText(ellipsis).width>maxWidth)throw new Error('Canvas label is narrower than its ellipsis');
  // Never split a combining sequence, flag or emoji family. Measure the whole
  // candidate with the active canvas font/tracking, including the ellipsis.
  const graphemes=Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(fullText),part=>part.segment);
  let low=0,high=graphemes.length;
  while(low<high){
    const mid=Math.ceil((low+high)/2),candidate=graphemes.slice(0,mid).join('')+ellipsis;
    if(context.measureText(candidate).width<=maxWidth)low=mid;else high=mid-1;
  }
  const text=graphemes.slice(0,low).join('')+ellipsis;
  return {text,fullText,width:context.measureText(text).width,truncated:true};
}

export function createDesignSystem(K,{surfaceScale=1}={}) {
  // A 1080-short-side video uses 3 render pixels per design pixel. Preserve the
  // existing format's readable label floor by scaling the ENTIRE system.
  const presentationScale=K.presentationScale??1;
  if(!(Number.isFinite(presentationScale)&&presentationScale>0))throw new Error('Invalid presentation scale');
  if(!(Number.isFinite(surfaceScale)&&surfaceScale>0))throw new Error('Invalid surface scale');
  const unit=Math.max(3*K.S,(K.type?.label??0)/12)/presentationScale*surfaceScale;
  if(!(Number.isFinite(unit)&&unit>0))throw new Error('Invalid design-system scale');
  const px=n=>`${n}px`;
  const token=(values,step)=>{
    if(!Number.isInteger(step)||step<1||step>values.length)throw new Error(`Unknown design token step: ${step}`);
    return values[step-1]*unit;
  };
  const roleOf=role=>{const definition=ROLE_STEPS[role];if(!definition)throw new Error(`Unknown text role: ${role}`);return definition;};
  const fitSteps=(role,maxStep)=>{
    const steps=roleOf(role).steps;
    if(maxStep===undefined)return steps;
    if(!steps.includes(maxStep))throw new Error(`Invalid ${role} maximum type step: ${maxStep}`);
    return steps.filter(step=>step<=maxStep);
  };
  const type=(role,step=roleOf(role).steps[0])=>{
    const definition=roleOf(role);if(!definition.steps.includes(step))throw new Error(`Invalid ${role} type step: ${step}`);
    const multiplier=definition.multiplier??1;
    return {role,step,size:token(RADIX_TOKENS.fontSizes,step)*multiplier,minSize:token(RADIX_TOKENS.fontSizes,definition.steps.at(-1))*multiplier,
      lineHeight:token(RADIX_TOKENS.lineHeights,step)*multiplier,tracking:RADIX_TOKENS.letterSpacing[step-1],weight:definition.weight,
      family:definition.family??'var(--fd)',unit};
  };
  function apply(node,role,{step}={}) {
    const spec=type(role,step);
    // The role owns its complete type recipe, including an intentional mono
    // family for code; descendants inherit it through the brand CSS rule.
    node.style.setProperty('--pk-role-font',spec.family);
    Object.assign(node.style,{fontFamily:spec.family,fontSize:px(spec.size),fontWeight:String(spec.weight),
      lineHeight:px(spec.lineHeight),letterSpacing:spec.tracking,fontStyle:'normal',fontStretch:'normal',textTransform:'none'});
    node.dataset.designRole=role;node.dataset.designStep=String(spec.step);node.dataset.designUnit=String(unit);
    node.dataset.designCompact=String(spec.step!==roleOf(role).steps[0]);
    return spec;
  }
  function fitSize(node,w,h,role,{align,wrap='normal',maxStep}={}) {
    if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)throw new Error(`Invalid ${role} text bounds`);
    Object.assign(node.style,{maxWidth:px(w),whiteSpace:wrap==='nowrap'?'nowrap':'normal',
      overflowWrap:wrap==='anywhere'?'anywhere':'normal',wordBreak:'normal',...(align?{textAlign:align}:{})});
    for(const step of fitSteps(role,maxStep)){
      const spec=apply(node,role,{step});
      if(node.scrollWidth<=w+1&&node.offsetHeight<=h+1)return spec.size;
    }
    throw new Error(`Design text cannot fit role ${role} above ${type(role).minSize}px in ${w}x${h}: ${node.textContent}`);
  }
  function fitGroup(nodes,{role,w,h,wrap='normal',maxStep}) {
    if(!nodes.length)throw new Error('Empty design text group');
    for(const node of nodes)fitSize(node,w,h,role,{wrap,maxStep});
    const step=Math.min(...nodes.map(node=>Number(node.dataset.designStep)));
    for(const node of nodes)apply(node,role,{step});
    return type(role,step);
  }
  function fit(node,{role,w,h,align,wrap='normal',maxStep}) {
    if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)throw new Error(`Invalid ${role} text bounds`);
    Object.assign(node.style,{boxSizing:'border-box',width:px(w),height:'auto',margin:'0',whiteSpace:wrap==='nowrap'?'nowrap':'normal',
      overflowWrap:wrap==='anywhere'?'anywhere':'normal',wordBreak:'normal',...(align?{textAlign:align}:{})});
    for(const step of fitSteps(role,maxStep)){
      const spec=apply(node,role,{step});
      if(node.scrollWidth<=w+1&&node.scrollHeight<=h+1){
        const measured=Math.max(node.offsetHeight,node.scrollHeight);
        node.style.height=px(measured);return {el:node,w,h:measured,...spec};
      }
    }
    throw new Error(`Design text cannot fit role ${role} above ${type(role).minSize}px in ${w}x${h}: ${node.textContent}`);
  }
  function text(parent,copy,{role,box,align,color,wrap,maxStep}={}) {
    const node=K.el('div','',parent,copy);
    for(const key of ['overlap','occlusion','overflow'])node.removeAttribute(`data-layout-allow-${key}`);
    Object.assign(node.style,{position:'absolute',left:px(box.x??0),top:px(box.y??0),...(color?{color}:{})});
    return fit(node,{role,w:box.w,h:box.h,align,wrap,maxStep});
  }
  function control(name) {
    if(name!=='button')throw new Error(`Unknown control: ${name}`);
    // Radix base-button size 2: 32 high, font step 2, space-3 horizontal,
    // space-2 gap, radius-2. Vertical space follows its 20px line box.
    return {role:'button',height:32*unit,paddingX:12*unit,paddingY:6*unit,gap:8*unit,radius:4*unit};
  }
  const space=step=>token(RADIX_TOKENS.space,step);
  return Object.freeze({unit,type,apply,truncateLine,truncateCanvasLine,fit,text,control,fitSize,fitGroup,
    ...createSurfaceSystem(K,{unit,space}),
    fitLine:(node,w,h,role,options={})=>fitSize(node,w,h,role,{...options,wrap:'nowrap'}),
    steps:role=>roleOf(role).steps.map(step=>type(role,step)),
    forSurface:scale=>createDesignSystem(K,{surfaceScale:surfaceScale*scale}),
    space,radius:step=>token(RADIX_TOKENS.radius,step)});
}
