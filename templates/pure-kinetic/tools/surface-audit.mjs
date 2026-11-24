import {surfaceRecipe,nestedRadius} from '../source/lib/components/surface-system.mjs';
import {RADIX_TOKENS} from '../source/lib/components/design-system.mjs';

export function surfaceFindings({surfaces=[],gaps=[]}={}){
  const out=[],near=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<=.12;
  const issue=(kind,row,details={})=>out.push({kind,id:row.id,surface:row.kind,...details});
  const byId=new Map(surfaces.map(row=>[row.id,row]));
  const seen=new Set();
  for(const row of surfaces){
    if(!row.id||seen.has(row.id))issue('surface-id-collision',row);
    seen.add(row.id);
    let spec;
    try{spec=surfaceRecipe(row.kind,{density:row.density,shape:row.shape,unit:row.unit});}
    catch{issue('unknown-surface-recipe',row);continue;}
    if(row.visible===false)continue;
    if(!['flow','absolute','frame'].includes(row.layout)){issue('unknown-surface-layout',row);continue;}
    if(row.layout==='frame'&&!['media','device','window'].includes(row.purpose))issue('undeclared-frame-purpose',row);
    const pad=row.layout==='flow'?[spec.paddingY,spec.paddingX,spec.paddingY,spec.paddingX]:[0,0,0,0];
    for(let i=0;i<4;i++)if(!near(row.padding[i],pad[i]))issue('surface-padding-drift',row,{side:i,actual:row.padding[i],expected:pad[i]});
    const gap=row.layout==='flow'?spec.gap:0;
    if(!row.separateGap&&row.gap.some(value=>!near(value,gap)))issue('surface-gap-drift',row,{actual:row.gap,expected:gap});
    if(row.layout==='flow'&&row.flowChildren>1&&!/flex|grid/.test(row.display))issue('surface-gap-inert',row);
    let expected=[spec.radius,spec.radius];
    if(row.motion){
      const m=row.motion;
      if(!['rounded','pill','square'].includes(m.from)||!['rounded','pill','square'].includes(m.to)||
        !Number.isFinite(m.progress)||m.progress<0||m.progress>1||!(m.scaleX>0&&m.scaleY>0))issue('invalid-surface-radius-motion',row);
      else{
        const radius=shape=>shape==='square'?0:shape==='pill'?Math.min(row.width*m.scaleX,row.height*m.scaleY)/2:
          surfaceRecipe(row.kind,{density:row.density,unit:row.unit}).radius;
        const r=radius(m.from)+(radius(m.to)-radius(m.from))*m.progress;
        expected=[r/m.scaleX,r/m.scaleY];
      }
    }
    if(row.parent){
      const parent=byId.get(row.parent);
      if(!parent)issue('nested-surface-parent-missing',row);
      else if(!Number.isFinite(row.inset)||row.inset<0)issue('invalid-nested-inset',row);
      else{
        const r=Math.min(...parent.radii[0],parent.clientWidth/2,parent.clientHeight/2);
        expected=[nestedRadius(r,row.inset),nestedRadius(r,row.inset)];
        if(row.nestedInsets&&(row.nestedInsets.some(value=>value<row.inset-1.1)||Math.abs(Math.min(...row.nestedInsets)-row.inset)>1.1))issue('nested-surface-inset-drift',row,{actual:row.nestedInsets,expected:row.inset});
      }
    }
    row.radii.forEach((r,corner)=>r.forEach((value,axis)=>{if(!near(value,expected[axis]))issue('surface-radius-drift',row,{corner,axis,actual:value,expected:expected[axis]});}));
    if(row.layout==='absolute'&&row.visible&&row.content.length===0)issue('surface-content-unmeasured',row);
    for(const child of row.content){
      if(!row.visible||!child.visible)continue;
      const p=[spec.paddingY+row.border[0],spec.paddingX+row.border[1],spec.paddingY+row.border[2],spec.paddingX+row.border[3]];
      const actual=[child.y,row.width-child.x-child.w,row.height-child.y-child.h,child.x];
      if(actual.some((value,i)=>value<p[i]-1.1))issue('surface-content-inset',row,{content:child.id,actual,minimum:p});
    }
  }
  for(const row of gaps){
    if(row.visible===false)continue;
    const expected=RADIX_TOKENS.space[row.step-1]*row.unit;
    if(!(row.unit>0)||!Number.isFinite(expected)||row.gap.some(value=>!near(value,expected)))issue('layout-gap-drift',row,{actual:row.gap,expected});
    if(row.flowChildren>1&&!/flex|grid/.test(row.display))issue('layout-gap-inert',row);
  }
  return out;
}

export function rasterSurfaceFindings(paints=[]){
  const out=[];
  for(const p of paints){
    const r=p.receipt;let spec;
    try{spec=surfaceRecipe(r.kind,{density:r.density,shape:r.shape,unit:r.unit});}catch{out.push({kind:'unknown-raster-surface',paint:p});continue;}
    const [x,y,w,h,radius]=p.args;
    const rect=r.rect,content=r.content;
    if(!rect||![x,y,w,h,rect.x,rect.y,rect.w,rect.h].every(Number.isFinite)||w<=0||h<=0||rect.w<=0||rect.h<=0){out.push({kind:'invalid-raster-surface-geometry',paint:p});continue;}
    const expected=r.shape==='pill'?Math.min(w,h)/2:spec.radius;
    if([x,y,w,h].some((v,i)=>Math.abs(v-[r.rect.x,r.rect.y,r.rect.w,r.rect.h][i])>.1))out.push({kind:'raster-surface-rect-drift',paint:p});
    const values=Array.isArray(radius)?radius:[radius];
    if(!values.length||values.some(v=>!Number.isFinite(v)||Math.abs(v-expected)>.1))out.push({kind:'raster-surface-radius-drift',paint:p,expected});
    if(r.layout==='frame'){
      if(!['media','device','window'].includes(r.purpose))out.push({kind:'raster-frame-purpose',paint:p});
    }else if(!r.content)out.push({kind:'raster-surface-content-missing',paint:p});
    else if(![content.x,content.y,content.w,content.h].every(Number.isFinite)||content.w<0||content.h<0)out.push({kind:'invalid-raster-content-geometry',paint:p});
    else{
      const c=r.content,actual=[c.x-x,c.y-y,x+w-c.x-c.w,y+h-c.y-c.h];
      if(actual.some((v,i)=>v<(i%2?spec.paddingY:spec.paddingX)-.1))out.push({kind:'raster-surface-content-inset',paint:p,actual});
    }
    if(r.gap!==undefined&&(!Number.isFinite(r.gap)||Math.abs(r.gap-spec.gap)>.1))out.push({kind:'raster-surface-gap-drift',paint:p});
  }
  return out;
}
