// Native computed-style checks, additional to the existing pixel/geometry audit.
import {RADIX_TOKENS,ROLE_STEPS} from '../source/lib/components/design-system.mjs';
import {surfaceFindings} from './surface-audit.mjs';

// Serialized into the native HyperFrames page. Read actual computed styles and
// geometry, not values reported by the production component as test results.
export function measureDesign(root) {
  const css=node=>root.ownerDocument.defaultView.getComputedStyle(node);
  const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
  // Compare composition anchors before the presentation camera and its safety
  // reframe; both intentionally move the whole layout during a shot.
  const outerCamera=root.querySelector('.cam'),camera=outerCamera?.querySelector(':scope > .layer')??outerCamera;
  const anchor=node=>{
    let x=0,y=0;
    for(let parent=node;parent&&parent!==camera;parent=parent.offsetParent){
      const style=css(parent),left=parseFloat(style.left),top=parseFloat(style.top);
      x+=Number.isFinite(left)?left:parent.offsetLeft;y+=Number.isFinite(top)?top:parent.offsetTop;
    }
    return {x,y};
  };
  const brandFont=css(root.closest('.pk-stage')??root).getPropertyValue('--fd').trim();
  const typography=[...root.querySelectorAll('[data-design-role]')].map(node=>{
    const s=css(node);return {role:node.dataset.designRole,step:+node.dataset.designStep,text:node.textContent,
      unit:+node.dataset.designUnit,
      size:parseFloat(s.fontSize),leading:parseFloat(s.lineHeight),tracking:parseFloat(s.letterSpacing)||0,weight:+s.fontWeight,font:s.fontFamily,
      registryRole:node.dataset.registryRole,box:rect(node),anchor:anchor(node)};
  });
  const controls=[...root.querySelectorAll('[data-design-control]')].map(node=>{
    const label=node.matches('[data-design-role="button"]')?node:node.querySelector('[data-design-role="button"]'),s=css(node);
    if(!label)return {kind:node.dataset.designControl,missingLabel:true};
    const l=css(label),range=root.ownerDocument.createRange();range.selectNodeContents(label);const ink=range.getBoundingClientRect();
    const lineTops=[...range.getClientRects()].filter(r=>r.width>.1&&r.height>.1).map(r=>Math.round(r.top*10)/10);
    return {kind:node.dataset.designControl,width:parseFloat(s.width),height:parseFloat(s.height),radius:parseFloat(s.borderTopLeftRadius),
      layout:node.dataset.designControlLayout??'natural',unit:+label.dataset.designUnit,
      paddingX:parseFloat(s.paddingLeft),paddingRight:parseFloat(s.paddingRight),paddingY:parseFloat(s.paddingTop),paddingBottom:parseFloat(s.paddingBottom),
      labelWidth:parseFloat(l.width),labelHeight:parseFloat(l.height),left:parseFloat(l.left),top:parseFloat(l.top),
      textWidth:ink.width,textHeight:ink.height,hasText:!!label.textContent.trim(),lineCount:new Set(lineTops).size,
      box:rect(node),textCenterX:ink.x+ink.width/2,textCenterY:ink.y+ink.height/2};
  });
  const pads=[...root.querySelectorAll('[data-design-padding]')].map(node=>({value:+node.dataset.designPadding}));
  const component=root.querySelector('[data-registry-item]')?.dataset.registryItem;
  // Remove the measured surface's camera/rotation only. Child transforms may
  // implement real layout (translateY(-50%) centering) and must stay measurable.
  const surfaceNodes=[...root.querySelectorAll('[data-design-surface][data-surface-unit]')];
  const gapNodes=[...root.querySelectorAll('[data-surface-gap-step]')];
  const local=(node,read)=>{
    const restore=[];
    for(let parent=node;parent;parent=parent.parentElement){const s=css(parent);
      for(const key of ['transform','translate','rotate','scale'])if(s[key]&&s[key]!=='none'){
        restore.push([parent,key,parent.style.getPropertyValue(key),parent.style.getPropertyPriority(key)]);parent.style.setProperty(key,'none','important');
      }
    }
    try{return read();}finally{for(const [n,key,value,priority]of restore.reverse()){if(value)n.style.setProperty(key,value,priority);else n.style.removeProperty(key);}}
  };
  const surfaces=[],gaps=[];
  const visible=node=>{for(let p=node;p&&p!==root.parentElement;p=p.parentElement){const s=css(p);if(s.display==='none'||s.visibility==='hidden'||+s.opacity<.4)return false;}return node.offsetWidth>0&&node.offsetHeight>0;};
  const layout=node=>{const s=css(node);return {display:s.display,gap:[s.rowGap,s.columnGap].map(v=>v==='normal'?0:parseFloat(v)),
    flowChildren:[...node.children].filter(n=>{const c=css(n);return c.display!=='none'&&!['absolute','fixed'].includes(c.position)}).length};};
  const surfaceMap=new Map(surfaceNodes.map(n=>[n.dataset.surfaceId,n]));
  for(const node of surfaceNodes){
    const entry=local(node,()=>{
      const s=css(node),r=node.getBoundingClientRect(),d=node.dataset;
      const radius=value=>{const parts=value.split(/\s+/);return [parts[0],parts[1]??parts[0]].map((v,i)=>parseFloat(v)*(v.endsWith('%')?(i?r.height:r.width)/100:1));};
      const anchors=[...root.querySelectorAll('[data-surface-content]')].filter(n=>n.dataset.surfaceContent.split(/\s+/).includes(d.surfaceId));
      const content=anchors.map((n,i)=>{
        const c=n.getBoundingClientRect();return {id:i,visible:visible(n),x:c.x-r.x,y:c.y-r.y,w:c.width,h:c.height};});
      if(d.surfaceLayout==='flow')for(const [i,n]of [...node.children].entries()){
        const c=css(n);if(anchors.includes(n)||c.display==='none'||['absolute','fixed'].includes(c.position))continue;
        // Flow padding must survive real margins and intrinsic child sizes.
        // Entrance transforms do not change the structural flow allocation.
        content.push(local(n,()=>{const b=n.getBoundingClientRect();return {id:`flow-${i}`,visible:visible(n),x:b.x-r.x,y:b.y-r.y,w:b.width,h:b.height};}));
      }
      return {id:d.surfaceId,kind:d.designSurface,density:d.surfaceDensity,shape:d.surfaceShape,layout:d.surfaceLayout,purpose:d.surfacePurpose,
        unit:+d.surfaceUnit,width:r.width,height:r.height,clientWidth:node.clientWidth,clientHeight:node.clientHeight,visible:visible(node),...layout(node),
        padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft].map(parseFloat),
        border:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth].map(parseFloat),
        radii:[s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomRightRadius,s.borderBottomLeftRadius].map(radius),
        separateGap:!!d.surfaceGapStep,content,parent:d.surfaceParent,inset:d.surfaceInset===undefined?null:+d.surfaceInset,
        motion:d.surfaceRadiusMotion?JSON.parse(d.surfaceRadiusMotion):null};
    });
    const parent=surfaceMap.get(entry.parent);
    // Nesting describes resting frame geometry. An entrance scale on the inner
    // frame must not masquerade as a different structural inset.
    entry.nestedInsets=parent?local(parent,()=>local(node,()=>{const r=node.getBoundingClientRect(),p=parent.getBoundingClientRect();return [r.y-p.y,p.right-r.right,p.bottom-r.bottom,r.x-p.x];})):null;
    surfaces.push(entry);
  }
  for(const [i,node]of gapNodes.entries())gaps.push({id:`gap-${i}`,step:+node.dataset.surfaceGapStep,unit:+node.dataset.surfaceGapUnit,visible:visible(node),...layout(node)});
  return {component,typography,controls,pads,brandFont,surfaces,gaps};
}

export function designFindings(measured,unit) {
  const errors=[],near=(a,b)=>Math.abs(a-b)<=.06;
  const family=value=>String(value??'').replace(/["']/g,'').split(',').map(s=>s.trim().toLowerCase()).join(',');
  for(const row of measured.typography){
    const role=ROLE_STEPS[row.role],step=row.step-1;
    if(!role?.steps.includes(row.step)){errors.push({kind:'unknown-type-role',row});continue;}
    const localUnit=row.unit??unit,multiplier=role.multiplier??1;
    if(!(Number.isFinite(localUnit)&&localUnit>0)){errors.push({kind:'invalid-design-unit',row});continue;}
    const expected={size:RADIX_TOKENS.fontSizes[step]*localUnit*multiplier,leading:RADIX_TOKENS.lineHeights[step]*localUnit*multiplier,
      tracking:parseFloat(RADIX_TOKENS.letterSpacing[step])*RADIX_TOKENS.fontSizes[step]*localUnit*multiplier,weight:role.weight};
    for(const key of Object.keys(expected))if(!near(row[key],expected[key]))errors.push({kind:'type-token-drift',role:row.role,key,actual:row[key],expected:expected[key]});
    if(measured.brandFont&&family(row.font)!==family(role.family??measured.brandFont))errors.push({kind:'brand-font-drift',role:row.role,actual:row.font,expected:role.family??measured.brandFont});
  }
  for(const pad of measured.pads)if(!RADIX_TOKENS.space.some(value=>near(pad.value,value*unit)))errors.push({kind:'spacing-token-drift',pad});
  for(const c of measured.controls){
    if(c.missingLabel){errors.push({kind:'missing-control-label',control:c});continue;}
    const controlUnit=c.unit??unit;
    if(!(Number.isFinite(controlUnit)&&controlUnit>0)){errors.push({kind:'invalid-control-unit',control:c});continue;}
    if(c.layout==='stretch'||c.layout==='flow'){
      const expected={radius:4*controlUnit,paddingX:12*controlUnit,paddingRight:12*controlUnit,paddingY:6*controlUnit,paddingBottom:6*controlUnit};
      expected.height=(c.layout==='stretch'?32:Math.max(1,c.hasText?c.lineCount:0)*20+12)*controlUnit;
      for(const key of Object.keys(expected))if(!near(c[key],expected[key]))errors.push({kind:'control-spacing-drift',key,actual:c[key],expected:expected[key]});
      const scale=c.box.w/c.width;
      if(c.hasText&&c.textWidth>(c.width-c.paddingX-c.paddingRight)*scale+1)errors.push({kind:'control-copy-overflow',control:c});
      if(c.hasText&&c.textWidth>.1){
        for(const [axis,center,origin,size]of [['x',c.textCenterX,c.box.x,c.box.w],['y',c.textCenterY,c.box.y,c.box.h]]){
          if(Math.abs(center-origin-size/2)>1)errors.push({kind:'control-label-not-centered',axis,control:c});
        }
      }
      continue;
    }
    const expected={radius:4*controlUnit,left:12*controlUnit,top:6*controlUnit};
    for(const key of Object.keys(expected))if(!near(c[key],expected[key]))errors.push({kind:'control-spacing-drift',key,actual:c[key],expected:expected[key]});
    if(Math.abs(c.width-c.labelWidth-24*controlUnit)>.1||Math.abs(c.height-c.labelHeight-12*controlUnit)>1)errors.push({kind:'control-proportion-drift',control:c});
  }
  if(measured.component==='modal-morph'){
    const title=measured.typography.find(row=>row.role==='cardTitle'),body=measured.typography.find(row=>row.role==='body'),button=measured.typography.find(row=>row.role==='button');
    if(!title||!body||!button||title.size<body.size*1.25-.01||title.size<button.size*1.4-.01)errors.push({kind:'collapsed-type-hierarchy',title,body,button});
  }
  if(!measured.typography.length)errors.push({kind:'missing-design-contract'});
  return [...errors,...surfaceFindings(measured)];
}
