// Real HyperFrames frames for the two defects found in the delivered reel.
// No replacement animation clock; geometry retains camera/entrance transforms.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser,sourceHashes,SOURCE} from './native-browser.mjs';
import {maximumScene} from './quality-layout.mjs';

const demo=JSON.parse(fs.readFileSync(new URL('./surface-motion-demo.json',import.meta.url)));
const drag=demo.scenes.find(s=>s.type==='drag'),scan=demo.scenes.find(s=>s.type==='scan');
export const fixtures=[
  {id:'drag-demo',scene:drag},
  {id:'drag-short',filenameExpectation:'fit',scene:{...drag,files:['А.pdf','B.png','Я.mp4']}},
  {id:'drag-max',filenameExpectation:'truncate',scene:{...drag,files:['Ш'.repeat(20)+'.pdf','W'.repeat(20)+'.png','Ф'.repeat(20)+'.mp4']}},
  {id:'scan-demo',scene:scan},
  {id:'scan-max',scene:{...maximumScene('scan'),in:'cut'}},
  {id:'scan-busy-only',scene:{...scan,complete:undefined}},
  {id:'scan-done-only',scene:{...scan,scanning:undefined}},
];

export function readGeometry(scene){
  const instance=window.__pkScenes.s1,root=instance.sceneRoot;
  const frame=root.getBoundingClientRect(),sx=instance.plan.width/frame.width,sy=instance.plan.height/frame.height;
  const round=n=>Math.round(n*1e4)/1e4;
  const box=r=>({x:round((r.left-frame.left)*sx),y:round((r.top-frame.top)*sy),w:round(r.width*sx),h:round(r.height*sy)});
  const opacity=node=>{let a=1;for(let n=node;n;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden')return 0;a*=Number(s.opacity);}return round(a);};
  const exactText=copy=>[...root.querySelectorAll('[data-design-role]')].find(n=>n.textContent===copy);
  const textBox=node=>{
    const range=document.createRange();range.selectNodeContents(node);
    return box(range.getBoundingClientRect());
  };
  const projectedFontSize=node=>{
    let matrix=new DOMMatrix();
    for(let n=node;n&&n!==root;n=n.parentElement){
      const style=getComputedStyle(n);
      if(style.transform!=='none')matrix=new DOMMatrix(style.transform).multiply(matrix);
      if(style.scale!=='none'){
        const values=style.scale.split(/\s+/).map(Number);
        matrix=new DOMMatrix().scale(values[0],values[1]??values[0]).multiply(matrix);
      }
    }
    // The smallest singular value retains actual camera and tile scale while
    // avoiding the false apparent growth of a rotated glyph's bounding box.
    if(!matrix.is2D)return null;
    const {a,b,c,d}=matrix,trace=a*a+b*b+c*c+d*d,det=a*d-b*c;
    const scale=Math.sqrt(Math.max(0,(trace-Math.sqrt(Math.max(0,trace*trace-4*det*det)))/2));
    return round(parseFloat(getComputedStyle(node).fontSize)*scale);
  };
  if(scene.type==='drag'){
    // Text lookup also runs the exact same geometry test against old revisions
    // that predate the diagnostic data attributes.
    const panel=root.querySelector('[data-drag-panel]')??exactText(scene.label)?.parentElement.parentElement;
    if(!panel)throw new Error('Missing rendered drag panel');
    const files=scene.files.map(name=>{
      const cap=[...root.querySelectorAll('[data-drag-filename]')].find(n=>n.textContent===name)??exactText(name);
      if(!cap)throw new Error(`Missing filename: ${name}`);
      const tile=cap.parentElement,face=tile.querySelector('[data-drag-face]')??tile.firstElementChild,world=tile.parentElement;
      const style=getComputedStyle(cap),clipped=cap.dataset.designOverflow==='ellipsis'&&style.whiteSpace==='nowrap'
        &&style.textOverflow==='ellipsis'&&['hidden','clip'].includes(style.overflowX);
      // A Range includes the hidden suffix of ellipsized text. Its clipping
      // element is the actual painted footprint; retain every camera/rotation
      // transform and independently validate the CSS contract below.
      return {text:cap.textContent,expectedText:name,title:cap.title,box:clipped?box(cap.getBoundingClientRect()):textBox(cap),
        alpha:opacity(cap),face:box(face.getBoundingClientRect()),faceAlpha:opacity(face),
        cssFontSize:parseFloat(style.fontSize),projectedFontSize:projectedFontSize(cap),
        intrinsicOverflow:cap.scrollWidth-cap.clientWidth,
        labelStyle:{overflowPolicy:cap.dataset.designOverflow??null,whiteSpace:style.whiteSpace,textOverflow:style.textOverflow,
          overflowX:style.overflowX,overflowY:style.overflowY,lineHeight:parseFloat(style.lineHeight),
          contentHeight:cap.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom),
          contentWidth:cap.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),
          verticalOverflow:cap.scrollHeight-cap.clientHeight},
        gap:round(8*Number(cap.dataset.designUnit)*world.getBoundingClientRect().width/world.offsetWidth*sx)};
    });
    const title=exactText(scene.label),header=title.parentElement;
    const zone=panel.querySelector('[data-drag-dropzone]')??panel.children[1],button=exactText(scene.button);
    return {type:'drag',width:instance.plan.width,height:instance.plan.height,labelCssSize:instance.context.K.design.type('label').size,fit:instance.fitted??null,
      vertical:instance.plan.height>instance.plan.width*1.2,
      panel:box(panel.getBoundingClientRect()),files,panelLayout:{alpha:opacity(panel),title:textBox(title),header:box(header.getBoundingClientRect()),
        zone:box(zone.getBoundingClientRect()),button:box(button.getBoundingClientRect()),gap:8*Number(title.dataset.designUnit),
        headerGap:zone.offsetTop-header.offsetTop-header.offsetHeight,footerGap:button.offsetTop-zone.offsetTop-zone.offsetHeight}};
  }
  const status=root.querySelector('[data-scan-status]');
  if(!status)throw new Error('Missing scan status');
  const busy=status.querySelector('[data-scan-busy]')??[...status.children].find(n=>!n.hasAttribute('data-scan-complete'));
  const done=status.querySelector('[data-scan-complete]');
  const row=n=>{
    if(!n)return null;
    const leaf=n.querySelector('[data-design-overflow]');
    let bounds=textBox(n),invalidEllipsis=false;
    if(leaf){
      const s=getComputedStyle(leaf),lineHeight=parseFloat(s.lineHeight);
      const paddingY=parseFloat(s.paddingTop)+parseFloat(s.paddingBottom);
      const valid=leaf.dataset.designOverflow==='ellipsis'&&s.whiteSpace==='nowrap'&&s.textOverflow==='ellipsis'
        &&['hidden','clip'].includes(s.overflowX)&&['hidden','clip'].includes(s.overflowY)
        &&!['inline','flex','inline-flex','grid','inline-grid'].includes(s.display)
        &&leaf.children.length===0&&!leaf.closest('.glyph,[data-typing-host],[data-typing-id]')
        &&s.clipPath==='none'&&s.maskImage==='none'&&Number.isFinite(lineHeight)&&lineHeight>0
        &&leaf.clientWidth>0&&Math.abs(leaf.clientHeight-paddingY-lineHeight)<=1&&leaf.scrollHeight<=leaf.clientHeight+1;
      if(valid){
        // Measure the actual label aperture plus its separate status icon.
        // Never intersect with the outer status surface: that would hide a
        // genuinely displaced or cropped row from the containment assertion.
        const boxes=[...n.children].map(child=>box(child.getBoundingClientRect()));
        const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
        bounds={x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y};
      }else invalidEllipsis=true;
    }
    return {alpha:opacity(n),text:n.textContent.trim(),box:bounds,invalidEllipsis};
  };
  const backgroundAlpha=node=>{
    const s=getComputedStyle(node),parts=s.backgroundColor.match(/[\d.]+/g)?.map(Number)??[];
    return (parts.length===3?1:parts[3]??0)*opacity(node);
  };
  return {type:'scan',box:box(status.getBoundingClientRect()),
    footprint:{x:status.offsetLeft,y:status.offsetTop,w:status.offsetWidth,h:status.offsetHeight},
    busy:scene.scanning?row(busy):null,done:scene.complete?row(done):null,
    backgroundAlpha:round(Math.max(...[status,busy,done].filter(Boolean).map(backgroundAlpha),0))};
}

const overlaps=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1;
export function geometryFindings(state,{handoff=false,filenameExpectation}={}){
  const found=[];
  if(state.type==='drag'&&state.panelLayout?.alpha>.01){
    const p=state.panelLayout,t=p.title,h=p.header;
    if(p.headerGap<p.gap-1||p.footerGap<p.gap-1)found.push({kind:'drag-panel-structural-gap',header:p.headerGap,footer:p.footerGap,required:p.gap});
    if(t.x<h.x-1||t.x+t.w>h.x+h.w+1||t.y<h.y-1||t.y+t.h>h.y+h.h+1)found.push({kind:'drag-title-outside-header'});
    if(t.y+t.h>p.zone.y+1||p.zone.y+p.zone.h>p.button.y+1)found.push({kind:'drag-panel-animated-overlap'});
  }
  if(state.type==='drag')for(const [i,file]of state.files.entries()){
    if(file.alpha<=.01)continue;
    const style=file.labelStyle??{},clips=value=>['hidden','clip'].includes(value);
    const singleLine=Number.isFinite(style.lineHeight)&&style.lineHeight>0&&style.contentWidth>0
      &&Math.abs(style.contentHeight-style.lineHeight)<=1&&style.verticalOverflow<=1;
    const truncationContract=style.overflowPolicy==='ellipsis'&&style.whiteSpace==='nowrap'&&style.textOverflow==='ellipsis'
      &&clips(style.overflowX)&&clips(style.overflowY)&&singleLine;
    if(!truncationContract)found.push({kind:'drag-filename-truncation-contract',file:i,style});
    if(file.text!==file.expectedText||file.title!==file.expectedText)found.push({kind:'drag-filename-text-changed',file:i});
    // Authored camera/landing transforms may change the projected size. The
    // label keeps its nominal shared role; run() separately compares actual
    // projection frame by frame across filename lengths to catch auto-shrink.
    if(!Number.isFinite(file.cssFontSize)||Math.abs(file.cssFontSize-state.labelCssSize)>.05)
      found.push({kind:'drag-filename-css-font-size',file:i,actual:file.cssFontSize,required:state.labelCssSize});
    const b=file.box,p=state.panel,gap=state.vertical?p.y-(b.y+b.h):p.x-(b.x+b.w);
    if(gap<file.gap-1)found.push({kind:'drag-filename-panel-clearance',file:i,gap,required:file.gap});
    if(b.x< -1||b.y< -1||b.x+b.w>state.width+1||b.y+b.h>state.height+1)found.push({kind:'drag-filename-outside-frame',file:i,box:b});
    if(file.intrinsicOverflow>1&&!truncationContract)found.push({kind:'drag-filename-overflow',file:i,overflow:file.intrinsicOverflow});
    if(filenameExpectation==='truncate'&&file.intrinsicOverflow<=1)found.push({kind:'drag-long-filename-not-truncated',file:i});
    if(filenameExpectation==='fit'&&file.intrinsicOverflow>1)found.push({kind:'drag-short-filename-truncated',file:i});
    for(const [j,other]of state.files.entries())if(j!==i){
      if(other.faceAlpha>.01&&overlaps(b,other.face))found.push({kind:'drag-filename-file-collision',file:i,other:j});
      if(j>i&&other.alpha>.01&&overlaps(b,other.box))found.push({kind:'drag-filename-collision',file:i,other:j});
    }
  }
  if(state.type==='scan'){
    if(state.busy?.alpha>0&&state.done?.alpha>0)found.push({kind:'scan-status-co-visible',busy:state.busy.alpha,done:state.done.alpha});
    if(handoff&&state.busy&&state.done&&state.backgroundAlpha<.999)found.push({kind:'scan-status-background-flash',alpha:state.backgroundAlpha});
    for(const [name,row]of [['busy',state.busy],['done',state.done]])if(row?.alpha>.01){
      if(row.invalidEllipsis)found.push({kind:'scan-status-invalid-ellipsis',row:name});
      const b=row.box,s=state.box;
      if(b.x<s.x-1||b.x+b.w>s.x+s.w+1||b.y<s.y-1||b.y+b.h>s.y+s.h+1)found.push({kind:'scan-status-outside-surface',row:name,box:b,surface:s});
    }
  }
  return found;
}

export async function run({out,source=SOURCE,caseIds,aspects=['9:16','1:1','16:9'],fonts=['Geist','Archivo'],baseline}={}){
  assert.ok(!fs.existsSync(out),'Use a fresh output directory');fs.mkdirSync(out,{recursive:true});
  const require=createRequire(import.meta.url),api=require(path.join(source,'lib/film.cjs')),metadata=require(path.join(source,'lib/components/metadata.cjs'));
  const prior=baseline?require(path.join(baseline,'lib/compiler/plan.cjs')):null;
  const selected=fixtures.filter(f=>!caseIds||caseIds.includes(f.id)),receipt=sourceHashes(source);
  const browser=await createNativeBrowser({source}),page=await browser.newPage();
  const fitReferences=new Map();
  const report={schema:'pure-kinetic.surface-motion-regressions-native.v1',sourceReceipt:receipt,testedSourceReceipt:page.sourceHashes,
    policy:{sampling:'Every 30 fps frame, plus scan handoff boundaries and 240 Hz handoff samples; every sample repeated in reverse.',geometry:'Actual rendered Range/element bounds, including animated rotation, scale and camera. Ellipsized filenames use their clipping element bounds.',filenames:'Full DOM/title text; explicit ellipsis policy, computed nowrap/ellipsis/hidden-or-clip CSS, one line-height, no vertical overflow. Long fixture must truncate; short fixture must fit. Computed CSS font must equal the shared label recipe. Filename variants must share the same scene fitter transform and actual projected font sizes per frame/file; authored camera changes are retained.',clearance:'space-2 (8 design units), allowing 1 physical pixel rounding.',visibilityThreshold:{drag:.01,scan:0}},results:[]};
  const write=()=>{report.completed=report.results.length;report.failed=report.results.filter(r=>!r.passed).length;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');};
  try{for(const aspect of aspects)for(const font of fonts)for(const fixture of selected){
    const scene=fixture.scene,row={id:`${fixture.id}-${aspect.replace(':','x')}-${font}`,case:fixture.id,aspect,font,errors:[],findings:[]};
    try{
      const film={...demo,aspect,brand:{...demo.brand,font},scenes:[scene,{type:'title',text:'Проверка завершена',beats:3,in:'cut'}]};
      assert.deepEqual(api.problems(film),[]);
      const {plan}=await page.play(film),ps=plan.scenes[0],duration=ps.ldur;
      if(prior){assert.deepEqual(plan,prior.compile(film),'Timeline/audio changed');row.planUnchanged=true;}
      const timing=scene.type==='scan'?metadata.scan.times(scene,duration,plan.beat*ps.speed):null;
      const times=new Set(Array.from({length:Math.ceil(ps.dur*30)},(_,i)=>+(i/30*ps.speed).toFixed(9)).filter(t=>t<duration));
      if(timing)for(let i=-30;i<=30;i++){const t=timing.complete+i/240*ps.speed;if(t>=0&&t<duration)times.add(+t.toFixed(9));}
      if(timing)for(const t of [timing.complete-duration*.03,timing.complete,timing.complete+duration*.03])for(const d of [-.00001,0,.00001])if(t+d>=0&&t+d<duration)times.add(+(t+d).toFixed(9));
      const samples=[];let firstStatusBox;
      for(const time of [...times].sort((a,b)=>a-b)){
        await page.shoot(ps.start+time/ps.speed);const geometry=await page.evaluate(readGeometry,scene);
        const found=geometryFindings(geometry,{handoff:timing&&Math.abs(time-timing.complete)<duration*.04,filenameExpectation:fixture.filenameExpectation});
        row.findings.push(...found.map(f=>({...f,time})));
        if(geometry.type==='drag')assert.deepEqual(geometry.files.map(f=>f.text),scene.files,'Filename text changed');
        else {
          firstStatusBox??=geometry.footprint;assert.deepEqual(geometry.footprint,firstStatusBox,'Status structural footprint moved');
          if(scene.scanning)assert.equal(geometry.busy?.text,scene.scanning,'Busy text changed');
          if(scene.complete)assert.equal(geometry.done?.text,scene.complete,'Completion text changed');
        }
        samples.push({time,geometry});
      }
      row.samples=samples.length;row.findingCount=row.findings.length;
      if(scene.type==='drag'){
        const visible=samples.flatMap(sample=>sample.geometry.files).filter(file=>file.alpha>.01);
        assert.ok(visible.length>0,'No visible filename samples');
        row.filenames={expected:fixture.filenameExpectation??'fit-or-truncate',visibleSamples:visible.length,
          truncatedSamples:visible.filter(file=>file.intrinsicOverflow>1).length,
          fittingSamples:visible.filter(file=>file.intrinsicOverflow<=1).length,
          minimumProjectedFontSize:Math.min(...visible.filter(file=>file.alpha>=.999).map(file=>file.projectedFontSize)),nominalCssFontSize:samples[0].geometry.labelCssSize};
        row.fit=samples[0].geometry.fit;
        const projectedFonts=samples.map(sample=>({time:sample.time,files:sample.geometry.files.map(file=>file.projectedFontSize)}));
        const key=`${aspect}:${font}`,reference=fitReferences.get(key);
        if(reference){
          assert.deepEqual(row.fit,reference.fit,'Filename length changed the global scene fitter transform');row.fitComparedTo=reference.case;
          assert.deepEqual(projectedFonts,reference.projectedFonts,'Filename length changed the actual projected font size');row.projectedFontComparedTo=reference.case;
        }else fitReferences.set(key,{case:fixture.id,fit:row.fit,projectedFonts});
      }
      row.findingCounts=row.findings.reduce((counts,f)=>({...counts,[f.kind]:(counts[f.kind]??0)+1}),{});
      row.findings=row.findings.slice(0,20);
      // Match every real rendered state after seeking backwards, including the
      // exact boundary where both labels are momentarily transparent.
      for(const sample of [...samples].reverse()){
        await page.shoot(ps.start+sample.time/ps.speed);
        assert.deepEqual(await page.evaluate(readGeometry,scene),sample.geometry,`Reverse seek at ${sample.time}`);
      }
      row.reverseExact=true;
      const witness=scene.type==='drag'?.3:timing.complete+duration*.015;
      await page.shoot(ps.start+witness/ps.speed);await page.screenshot({path:path.join(out,row.id+'.png')});row.witness=witness;
      assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
      assert.equal(row.findingCount,0,JSON.stringify(row.findings[0]));row.passed=true;
    }catch(error){row.passed=false;row.errors.push(String(error.stack??error));try{await page.screenshot({path:path.join(out,row.id+'-failure.png')});}catch{}await browser.recycle();}
    report.results.push(row);write();console.log(row.id,row.passed?'pass':row.errors[0].split('\n')[0]);
  }}finally{await browser.close();}
  report.sourceAfter=sourceHashes(source);report.sourceStable=receipt.aggregate===report.sourceAfter.aggregate;
  report.passed=report.sourceStable&&report.failed===0;write();return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=(name,fallback)=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:fallback;
  const report=await run({out:path.resolve(option('out','/tmp/pk-surface-motion-regressions')),source:path.resolve(option('source',SOURCE)),
    ...(option('cases')?{caseIds:option('cases').split(',')}:{}),...(option('fonts')?{fonts:option('fonts').split(',')}:{}),
    ...(option('aspects')?{aspects:option('aspects').split(',')}:{}),...(option('baseline')?{baseline:path.resolve(option('baseline'))}:{})});
  if(!report.passed)process.exitCode=1;
}
