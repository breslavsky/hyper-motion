// Pure Kinetic semantic surfaces. Dimensions are design units, scaled by the
// same local unit as Radix typography. Motion, colours and shadows stay local.
export const SURFACE_RECIPES = Object.freeze(Object.fromEntries(Object.entries({
  card:{compact:[12,12,8,12],normal:[16,16,12,16],comfortable:[24,24,16,16]},
  field:{compact:[8,6,4,6],normal:[12,8,8,8],comfortable:[16,12,12,12]},
  badge:{compact:[8,4,4,6],normal:[12,4,4,8],comfortable:[12,8,8,8]},
}).map(([kind,variants])=>[kind,Object.freeze(Object.fromEntries(Object.entries(variants)
  .map(([density,[paddingX,paddingY,gap,radius]])=>[density,Object.freeze({paddingX,paddingY,gap,radius})])))])));

const SHAPES=new Set(['rounded','pill','square']);
const LAYOUTS=new Set(['flow','absolute','frame']);
const FRAME_PURPOSES=new Set(['media','device','window']);
const positive=(value,name)=>{if(!(Number.isFinite(value)&&value>0))throw new Error(`Invalid surface ${name}: ${value}`);return value;};
export function nestedRadius(radius,inset){
  if(!Number.isFinite(radius)||radius<0||!Number.isFinite(inset)||inset<0)throw new Error('Invalid nested radius/inset');
  return Math.max(0,radius-inset);
}
export function surfaceRecipe(kind,{density='normal',shape='rounded',unit=1}={}){
  const recipe=SURFACE_RECIPES[kind]?.[density];
  if(!recipe||!SHAPES.has(shape))throw new Error(`Unknown surface recipe: ${kind}/${density}/${shape}`);
  positive(unit,'unit');
  return {kind,density,shape,unit,...Object.fromEntries(Object.entries(recipe).map(([key,value])=>[key,value*unit])),
    radius:shape==='pill'?9999*unit:shape==='square'?0:recipe.radius*unit,
    minHeight:(20+recipe.paddingY*2)*unit};
}

export function createSurfaceSystem(K,{unit,space}){
  const px=n=>`${n}px`,set=(node,styles)=>K.set?K.set(node,styles):Object.assign(node.style,styles);
  const box=(kind,options={})=>surfaceRecipe(kind,{...options,unit});
  const record=node=>{
    if(!node?.dataset?.designSurface)throw new Error('Surface must be declared before content, nesting or motion');
    return surfaceRecipe(node.dataset.designSurface,{density:node.dataset.surfaceDensity,shape:node.dataset.surfaceShape,unit:+node.dataset.surfaceUnit});
  };
  const id=node=>{
    if(!node.dataset.surfaceId){const serial=K.__surfaceSerial=(K.__surfaceSerial??0)+1;node.dataset.surfaceId=K.uid?.(`surface-${serial}`)??`surface-${serial}`;}
    return node.dataset.surfaceId;
  };
  function surface(node,kind,{density='normal',shape='rounded',layout='flow',purpose}={}){
    if(!LAYOUTS.has(layout))throw new Error(`Unknown surface layout: ${layout}`);
    if(layout==='frame'&&!FRAME_PURPOSES.has(purpose))throw new Error('A zero-padding frame needs a media/device/window purpose');
    const spec=box(kind,{density,shape});
    // Redeclaring a recipe replaces prior radius/gap derivations as well as CSS.
    // Keep identity and real content anchors stable across that replacement.
    for(const key of ['surfaceRadiusMotion','surfaceParent','surfaceInset','surfaceGapStep','surfaceGapUnit'])delete node.dataset[key];
    Object.assign(node.dataset,{designSurface:kind,surfaceDensity:density,surfaceShape:shape,surfaceLayout:layout,surfaceUnit:String(unit)});
    if(purpose)node.dataset.surfacePurpose=purpose;else delete node.dataset.surfacePurpose;
    id(node);
    set(node,{boxSizing:'border-box',borderRadius:px(spec.radius),
      padding:layout==='flow'?`${px(spec.paddingY)} ${px(spec.paddingX)}`:'0px',gap:layout==='flow'?px(spec.gap):'0px'});
    return spec;
  }
  function surfaceContent(parent,content,{apply=false}={}){
    const spec=record(parent);
    if(!content||content===parent||content.ownerDocument!==parent.ownerDocument)throw new Error('Surface content needs a real, distinct content element');
    const parents=new Set((content.dataset.surfaceContent??'').split(/\s+/).filter(Boolean));parents.add(id(parent));
    content.dataset.surfaceContent=[...parents].join(' ');
    if(apply){
      if(!parent.contains(content))throw new Error('Applied surface content must be a descendant');
      set(content,{position:'absolute',boxSizing:'border-box',left:px(spec.paddingX),right:px(spec.paddingX),top:px(spec.paddingY),bottom:px(spec.paddingY)});
    }
    return spec;
  }
  function surfaceGap(node,step){
    const value=space(step);Object.assign(node.dataset,{surfaceGapStep:String(step),surfaceGapUnit:String(unit)});
    set(node,{gap:px(value)});return value;
  }
  function surfaceRadius(node,{from='rounded',to='rounded',progress=1,scaleX=1,scaleY=1}={}){
    const spec=record(node);
    if(!SHAPES.has(from)||!SHAPES.has(to)||!Number.isFinite(progress)||progress<0||progress>1)throw new Error('Invalid surface radius transition');
    positive(scaleX,'scaleX');positive(scaleY,'scaleY');
    const value=shape=>shape==='pill'?Math.min(node.offsetWidth*scaleX,node.offsetHeight*scaleY)/2:
      shape==='square'?0:SURFACE_RECIPES[spec.kind][spec.density].radius*spec.unit;
    const radius=value(from)+(value(to)-value(from))*progress;
    node.dataset.surfaceRadiusMotion=JSON.stringify({from,to,progress,scaleX,scaleY});
    set(node,{borderRadius:`${px(radius/scaleX)} / ${px(radius/scaleY)}`});
    return radius;
  }
  function nest(inner,outer,{inset}={}){
    record(inner);const parent=record(outer);
    if(!Number.isFinite(inset)||inset<0)throw new Error('Nested surface needs a finite nonnegative inset');
    const style=outer.ownerDocument.defaultView.getComputedStyle(outer);
    const radii=style.borderTopLeftRadius.split(/\s+/).map(parseFloat);
    const radius=Math.min(radii[0]||0,radii[1]??radii[0]??0,outer.clientWidth/2,outer.clientHeight/2);
    const derived=nestedRadius(radius,inset);
    Object.assign(inner.dataset,{surfaceParent:id(outer),surfaceInset:String(inset)});
    set(inner,{borderRadius:px(derived)});return {...parent,radius:derived};
  }
  return {box,surface,surfaceContent,surfaceGap,surfaceRadius,nest};
}
