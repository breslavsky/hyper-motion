import {validateSound,validateSoundTargets} from './sound-contract.mjs';

// A designed sequence compiles once; no simulation or playback engine advances it.
export const DEFAULT_RECIPE = {
  schema:'document-flow.v1', aspect:'9:16', bpm:108,
  brand:{name:'Folio',font:'Geist Mono',background:'#0b0b0b',foreground:'#f4f4f0',accent:'#ff6a70',accent2:'#bbddff'},
  content:{opening:'From scattered to sorted',
    documents:[
      {id:'notes',label:'Notes',category:'ideas',kind:'note'},
      {id:'tasks',label:'Tasks',category:'tasks',kind:'task'},
      {id:'sketches',label:'Sketches',category:'ideas',kind:'sketch'},
      {id:'files',label:'Files',category:'files',kind:'file'},
      {id:'ideas',label:'Ideas',category:'ideas',kind:'idea'},
      {id:'drafts',label:'Drafts',category:'files',kind:'draft'},
    ],
    categories:[{id:'ideas',label:'Ideas'},{id:'tasks',label:'Tasks'},{id:'files',label:'Files'}],
    steps:['Collect','Arrange','Create'],closing:'Find your next idea',cta:'Try Folio'},
  sound:{},
};
export const FORMATS={'9:16':{width:1080,height:1920},'1:1':{width:1080,height:1080},'16:9':{width:1920,height:1080}};
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const mix=(a,b,p)=>a+(b-a)*p;
const smooth=p=>{p=clamp(p);return p*p*(3-2*p);};
const progress=(t,a,b)=>clamp((t-a)/(b-a));
const object=(o,label)=>{if(!o||typeof o!=='object'||Array.isArray(o))throw new Error(`${label}: expected an object`);};
function keys(o,allowed,label){object(o,label);for(const k of Object.keys(o))if(!allowed.includes(k))throw new Error(`${label}.${k}: unsupported field`);}
function text(s,label,max){if(typeof s!=='string'||!s.trim()||s!==s.trim()||[...s].length>max||/[\n\r\t\x00-\x1f]/.test(s))throw new Error(`${label}: use 1–${max} characters on one logical line`);return s;}
function id(s,label){if(typeof s!=='string'||!/^\w[\w-]{0,31}$/.test(s))throw new Error(`${label}: use a short stable id`);return s;}
function list(a,n,label){if(!Array.isArray(a)||a.length!==n)throw new Error(`${label}: this recipe requires exactly ${n} entries`);}
function unique(a,label){if(new Set(a).size!==a.length)throw new Error(`${label}: duplicate ids are not allowed`);}
export function normalize(input={}){
  keys(input,['schema','aspect','bpm','brand','content','sound'],'recipe');
  const r={...structuredClone(DEFAULT_RECIPE),...structuredClone(input)};
  if(r.schema!=='document-flow.v1')throw new Error('schema: expected document-flow.v1');
  if(typeof r.aspect!=='string'||!Object.prototype.hasOwnProperty.call(FORMATS,r.aspect))throw new Error('aspect: use 9:16, 1:1 or 16:9');
  if(!Number.isFinite(r.bpm)||r.bpm<96||r.bpm>132)throw new Error('bpm: use 96–132');
  keys(r.brand,['name','font','background','foreground','accent','accent2'],'brand');
  r.brand={...DEFAULT_RECIPE.brand,...r.brand};
  text(r.brand.name,'brand.name',18);
  if(!['Geist','Geist Mono','Archivo'].includes(r.brand.font))throw new Error('brand.font: use Geist, Geist Mono or Archivo');
  for(const k of ['background','foreground','accent','accent2'])if(typeof r.brand[k]!=='string'||!/^#[\da-f]{6}$/i.test(r.brand[k]))throw new Error(`brand.${k}: use an exact six-digit hex color`);
  keys(r.content,['opening','documents','categories','steps','closing','cta'],'content');
  for(const [k,max]of [['opening',64],['closing',56],['cta',24]])text(r.content[k],`content.${k}`,max);
  if(r.content.opening.split(/\s+/).length>8||r.content.closing.split(/\s+/).length>8)throw new Error('opening/closing: at most eight words fit the authored reading window');
  list(r.content.documents,6,'content.documents');list(r.content.categories,3,'content.categories');list(r.content.steps,3,'content.steps');
  r.content.categories.forEach((c,i)=>{keys(c,['id','label'],`categories[${i}]`);id(c.id,'category.id');text(c.label,'category.label',20);});
  unique(r.content.categories.map(c=>c.id),'categories');
  r.content.documents.forEach((d,i)=>{
    keys(d,['id','label','category','kind'],`documents[${i}]`);id(d.id,'document.id');text(d.label,'document.label',24);
    if(!r.content.categories.some(c=>c.id===d.category))throw new Error(`document ${d.id}: unknown category ${d.category}`);
    if(!['note','task','sketch','file','idea','draft'].includes(d.kind))throw new Error(`document ${d.id}: unsupported kind`);
  });
  unique(r.content.documents.map(d=>d.id),'documents');
  for(const c of r.content.categories){const n=r.content.documents.filter(d=>d.category===c.id).length;if(n<1||n>3)throw new Error(`category ${c.id}: this layout supports one to three documents`);}
  r.content.steps.forEach((s,i)=>{text(s,`steps[${i}]`,16);if(s.split(/\s+/).length>2)throw new Error(`steps[${i}]: at most two words`);});
  validateSound(r.sound);
  // Readability is a scheduling constraint, independent of whether copy fits spatially.
  for(const [value,beats,name]of [[r.content.opening,4.45,'opening'],[r.content.closing,5,'closing'],...r.content.steps.map(s=>[s,4,'step'])]){
    if(.5+.28*value.split(/\s+/).length>beats*60/r.bpm)throw new Error(`${name}: too many words at ${r.bpm} BPM; shorten copy or lower the tempo`);
  }
  return r;
}

// This family uses a clear dealing corridor above the destination board.
// Destinations fill bottom-up: a carried sheet never crosses an occupied slot.
export function compile(spec={}){
  const recipe=normalize(spec),{aspect,brand,content,bpm}=recipe,{width:W,height:H}=FORMATS[aspect];
  const tall=aspect==='9:16',wide=aspect==='16:9',beat=60/bpm;
  const card={w:wide?440:316,h:wide?174:tall?248:176};
  const groups=content.categories.map((c,i)=>({...c,index:i,x:wide?370+i*590:216+i*324,
    y:tall?1010:wide?600:640,w:wide?500:320,h:tall?1080:760}));
  const queue={x:W/2,y:tall?520:wide?275:326};
  const slots=new Map(),order=[];
  for(const g of groups){
    const docs=content.documents.filter(d=>d.category===g.id);
    docs.forEach((d,i)=>slots.set(d.id,{x:g.x,y:(tall?790:wide?470:520)+i*(tall?290:card.h+22)}));
    order.push(...docs.slice().reverse().map(d=>d.id));
  }
  const source=wide?[[360,450,-3],[960,430,3],[1560,466,-3],[400,775,3],[980,780,-2],[1540,790,3]]
    :tall?[[300,630,-3],[780,650,3],[300,990,2],[780,1010,-3],[300,1350,-2],[780,1370,3]]
      :[[216,460,-.5],[540,470,.5],[864,460,-.5],[216,790,.5],[540,800,-.5],[864,790,.5]];
  const draftIndex=content.documents.findIndex(d=>d.kind==='draft'),heroIndex=draftIndex<0?content.documents.length-1:draftIndex;
  const documents=content.documents.map((d,i)=>{
    const destination=slots.get(d.id),sortIndex=order.indexOf(d.id),sortBeat=10.2+sortIndex*1.5;
    const dx=Math.abs(destination.x-queue.x),dy=destination.y-queue.y,length=dx+dy;
    // The sheet turns face-up only after clearing the back-facing queue.
    const clearDistance=dx>=card.w+16?card.w+16:dx+card.h+18;
    const frontBeat=sortBeat+.1+1-Math.cbrt(Math.max(0,1-clearDistance/length));
    return {...d,index:i,width:card.w,height:card.h,hero:i===heroIndex,sortIndex,
      source:{x:source[i][0],y:source[i][1],rotation:source[i][2],scale:tall?1.1:1},destination,
      arriveBeat:i===heroIndex?.15:5+i*.06,sortBeat,sortEndBeat:sortBeat+1.35,frontBeat,
      route:{points:[{...queue},{x:destination.x,y:queue.y},destination],length},
    };
  });
  const scan={top:Math.min(...source.map(p=>p[1]))-card.h*.62,bottom:Math.max(...source.map(p=>p[1]))+card.h*.62,left:wide?105:65,right:W-(wide?105:65),startBeat:5.5,endBeat:8.6};
  for(const d of documents)d.scanBeat=mix(scan.startBeat,scan.endBeat,(d.source.y-scan.top)/(scan.bottom-scan.top));
  const arrangeEndBeat=Math.max(...documents.map(d=>d.sortEndBeat));
  const actions=[{id:'collect',startBeat:5,endBeat:10},{id:'arrange',startBeat:10,endBeat:22},{id:'create',startBeat:22,endBeat:26}];
  const events=[
    ...documents.map(d=>({id:`arrive-${d.id}`,time:d.arriveBeat*beat,kind:'document.arrive',target:`document:${d.id}`})),
    {id:'scan-start',time:scan.startBeat*beat,kind:'scan.start',target:'scanner'},
    ...documents.map(d=>({id:`scan-${d.id}`,time:d.scanBeat*beat,kind:'document.scanned',target:`document:${d.id}`})),
    ...documents.map(d=>({id:`sorted-${d.id}`,time:d.sortEndBeat*beat,kind:'document.sorted',target:`document:${d.id}`})),
    ...groups.map(g=>({id:`ready-${g.id}`,time:Math.max(...documents.filter(d=>d.category===g.id).map(d=>d.sortEndBeat))*beat,kind:'category.ready',target:`category:${g.id}`})),
    ...actions.map(a=>({id:`action-${a.id}`,time:a.startBeat*beat,kind:'action.start',target:`action:${a.id}`})),
    {id:'cta-reveal',time:27*beat,kind:'cta.reveal',target:'cta'},
  ].sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id,'en'));
  validateSoundTargets(recipe.sound,events);
  const safe=tall?{x:54,y:154,w:972,h:1459}:{x:W*.05,y:54,w:W*.9,h:972};
  return {schema:recipe.schema,choreography:'folio-02',recipe,brand,content,aspect,bpm,beat,width:W,height:H,duration:32*beat,
    phases:[['intro',0,5],['collect',5,10],['arrange',10,22],['create',22,26],['end',26,32]].map(([id,start,end])=>({id,start:start*beat,end:end*beat})),
    actions,events,layout:{documents,categories:groups,scan,safe,card,queue,arrangeEndBeat,heroId:documents[heroIndex].id,heroIndex,
      heroPose:{x:wide?1280:540,y:tall?1080:wide?660:690,scale:tall?2.15:wide?1.65:2.35,rotation:-4},
      center:{x:W/2,y:H/2},tall,wide},
  };
}

function routeAt(route,p){
  const [a,c,z]=route.points,dx=Math.abs(c.x-a.x),dy=z.y-c.y,d=clamp(p)*route.length;
  if(!dx)return {x:a.x,y:mix(a.y,z.y,p)};
  const radius=Math.min(20,dx/3,dy/3),sign=Math.sign(c.x-a.x);
  if(d<dx-radius)return {x:a.x+sign*d,y:a.y};
  if(d<dx+radius){const u=(d-dx+radius)/(2*radius);return {x:c.x-sign*radius*(1-u)*(1-u),y:c.y+radius*u*u};}
  return {x:z.x,y:c.y+d-dx};
}

export function stateAt(plan,seconds){
  if(!Number.isFinite(seconds))throw new Error('time: expected finite seconds');
  const time=clamp(seconds,0,plan.duration),b=time/plan.beat,{layout}=plan,{tall,wide}=layout;
  const phase=plan.phases.find(p=>time<p.end)?.id??'end';
  const actionIndex=phase==='collect'?0:phase==='arrange'?1:phase==='create'?2:-1;
  const end=smooth(progress(b,26,27)),hero=layout.documents[layout.heroIndex];
  const base={x:plan.width/2,y:plan.height/2,zoom:1};
  let camera={...base};
  if(b<5){const p=1-smooth(progress(b,3.8,5));camera.zoom=1+.045*p;}
  const heroZoom=tall?2.1:wide?1.8:2.25;
  const screen={x:wide?plan.width*.69:plan.width*.5,y:tall?plan.height*.61:wide?plan.height*.62:plan.height*.64};
  const close={x:hero.destination.x-(screen.x-plan.width/2)/heroZoom,y:hero.destination.y-(screen.y-plan.height/2)/heroZoom,zoom:heroZoom};
  if(b>=22&&b<26){const p=smooth(progress(b,22.25,23.6));camera={x:mix(base.x,close.x,p),y:mix(base.y,close.y,p),zoom:mix(1,close.zoom,p)};}
  if(b>=26){const p=smooth(progress(b,26,27));camera={x:mix(close.x,base.x,p),y:mix(close.y,base.y,p),zoom:mix(close.zoom,.96,p)};}
  const documents=layout.documents.map(d=>{
    let x=d.source.x,y=d.source.y,rotation=d.source.rotation,scale=d.source.scale,opacity=1,front=1,moving=false;
    if(b<5){
      const p=smooth(progress(b,3.8,5));
      if(d.hero){x=mix(layout.heroPose.x,d.source.x,p);y=mix(layout.heroPose.y,d.source.y,p);scale=mix(layout.heroPose.scale,d.source.scale,p);rotation=mix(layout.heroPose.rotation,d.source.rotation,p);}
      else opacity=0;
    } else if(b<9){opacity=d.hero?1:smooth(progress(b,d.arriveBeat,d.arriveBeat+.35));}
    if(b>=9&&b<10){
      front=1-smooth(progress(b,9,9.25));
      const p=smooth(progress(b,9.3,10));
      x=mix(d.source.x,layout.queue.x+(d.index-2.5)*7,p);y=mix(d.source.y,layout.queue.y-(d.index-2.5)*5,p);rotation=mix(d.source.rotation,(d.index-2.5)*2,p);scale=mix(d.source.scale,1,p);
    }
    if(b>=10){
      x=layout.queue.x+(d.index-2.5)*7;y=layout.queue.y-(d.index-2.5)*5;rotation=(d.index-2.5)*2;scale=1;front=0;
      if(b>=d.sortBeat){
        const p=progress(b,d.sortBeat+.1,d.sortBeat+1.1),e=1-(1-p)**3,pos=routeAt(d.route,e);
        x=pos.x;y=pos.y;rotation=mix((d.index-2.5)*2,0,smooth(progress(b,d.sortBeat,d.sortBeat+.25)));
        front=smooth(progress(b,d.frontBeat,d.frontBeat+.24));moving=time<d.sortEndBeat*plan.beat;
        if(b>=d.sortBeat+1.1)y+=Math.sin(Math.PI*progress(b,d.sortBeat+1.1,d.sortEndBeat))*3;
      }
    }
    if(b>=22&&!d.hero)opacity=1-.94*smooth(progress(b,22,22.23));
    if(b>=26)opacity=mix(d.hero?1:.06,.03,end);
    const active=opacity>.7&&front>.92&&(b<22||d.hero)&&b<26;
    return {id:d.id,category:d.category,x,y,rotation,scale,opacity,front,face:front>.5?'front':'back',active,moving,
      hero:d.hero,emphasis:d.hero&&(phase==='intro'||phase==='create'),artProgress:d.hero?smooth(progress(b,23.4,25)):0,
      scanned:time>=d.scanBeat*plan.beat,sorted:time>=d.sortEndBeat*plan.beat,
    };
  });
  const categories=layout.categories.map(g=>({id:g.id,index:g.index,label:g.label,count:documents.filter(d=>d.category===g.id&&d.sorted).length,
    opacity:smooth(progress(b,9.7,10.3))*(b<22?1:mix(1,.07,smooth(progress(b,22,22.23))))*(1-end),
    active:time>=layout.arrangeEndBeat*plan.beat&&b<22,focused:false}));
  return {time,beat:b,phase,camera,documents,categories,actionIndex,actionLabel:actionIndex<0?'':plan.content.steps[actionIndex],heroId:layout.heroId,
    introOpacity:1-smooth(progress(b,4.3,4.9)),scan:{y:mix(layout.scan.top,layout.scan.bottom,progress(b,layout.scan.startBeat,layout.scan.endBeat)),opacity:b>=5.5&&b<8.9?Math.min(1,progress(b,5.5,5.7),1-progress(b,8.6,8.9)):0},
    endOpacity:smooth(progress(b,26.35,27)),ctaOpacity:smooth(progress(b,27,27.5)),
  };
}
