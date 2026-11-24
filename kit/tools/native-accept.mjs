// Native acceptance for the complete library. Run after any runtime/catalogue change.
// --reference /path/to/frozen/source compares the exact template before migration.
// --quick keeps one of each family; --scenes title,controls filters the catalogue.
// --aspects 9:16,16:9,1:1 --out /tmp/pk-accept --extended adds variants/looks/transitions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createNativeBrowser,SOURCE,TEMPLATE,sharp,compiler} from './native-browser.mjs';
const require=createRequire(import.meta.url),args=process.argv.slice(2);
const option=(key,fallback)=>args.includes(`--${key}`)?args[args.indexOf(`--${key}`)+1]:fallback;
const OUT=path.resolve(option('out','/tmp/pk-native-acceptance'));
const reference=option('reference',null),aspects=option('aspects','9:16,16:9,1:1').split(',');
const catalog=JSON.parse(fs.readFileSync(path.join(SOURCE,'lib/components/catalog.json'),'utf8'));
const P=compiler();
fs.mkdirSync(OUT,{recursive:true});
function samples(){
  const all=new Map();
  const fill=scene=>JSON.parse(JSON.stringify(scene).replaceAll('{name}','Nook').replaceAll('{NAME}','NOOK').replaceAll('{url}','nook.app').replaceAll('{tagline}','Bookings that run themselves'));
  for(const template of require('./kinetic/templates.json'))for(const scene of template.scenes){
    const {image,images,...rest}=scene;
    if(catalog[scene.type]&&!all.has(scene.type))all.set(scene.type,fill(rest));
  }
  for(const scene of require('./kinetic/samples.json'))if(catalog[scene.type]&&!all.has(scene.type))all.set(scene.type,scene);
  for(const [type,def]of Object.entries(require('../source/lib/compiler/definitions.cjs')))all.set(type,def.sample);
  assert.deepEqual([...all.keys()].sort(),Object.keys(catalog).sort());
  return all;
}
const all=samples(),brand={name:'Nook',url:'nook.app',colors:['#ff7a4d','#2433ff']};
const film=(scenes,aspect='9:16',style='editorial',more={})=>({aspect,style,brand,scenes,...more});
let names=option('scenes',null)?.split(',')??Object.keys(catalog);
if(args.includes('--quick')){const families=new Set();names=names.filter(name=>{const family=catalog[name].family;if(families.has(family))return false;families.add(family);return true;});}
const cases=[];
for(const name of names)for(const aspect of aspects)cases.push({id:`${name}-${aspect.replace(':','x')}`,film:film([all.get(name)],aspect),compare:true});
if(args.includes('--extended')){
  const variants={toggle:{kind:['switch','checkbox','slider']},chart:{kind:['line','bar','pie','ring']},fullbleed:{variant:['solid','repeat']},stat:{trend:['up','down','none']}};
  for(const [type,fields]of Object.entries(variants))for(const [key,values]of Object.entries(fields))for(const value of values)for(const aspect of aspects)
    cases.push({id:`variant-${type}-${value}-${aspect.replace(':','x')}`,film:film([{...all.get(type),[key]:value}],aspect),compare:true});
  const states=['button','loader','check','toggle','slider','player','tabs','search','toast'];
  for(const aspect of aspects)cases.push({id:`variant-morph-all-${aspect.replace(':','x')}`,film:film([{...all.get('morph'),states}],aspect),stateSamples:states.length,compare:true});
  for(const style of Object.keys(P.looks))cases.push({id:`look-${style}`,film:film([all.get('title'),all.get('controls')],'9:16',style),compare:true});
  for(const transition of Object.keys(P.transitions))cases.push({id:`transition-${transition}`,film:film([{...all.get('title'),beats:3},{...all.get('stack'),beats:3,in:transition}]),boundaries:true,compare:true});
  for(const type of ['ui-float','photo','cards3d','phone3d','laptop','browser'])cases.push({id:`image-${type}`,film:film([{...all.get(type),...(['cards3d','phone3d'].includes(type)?{images:['assets/migration-fixture.svg']}:{image:'assets/migration-fixture.svg'})}]),image:true,compare:type!=='ui-float',referenceException:type==='ui-float'?'Frozen engine throws NotFoundError for supplied ui-float image; native factory fixes insertion into camera wrapper.':null});
  for(const bpm of [72,120,180])cases.push({id:`timed-dial-${bpm}`,film:film([{...all.get('dial'),timing:{slide:{startBeat:1,endBeat:3}}}],'9:16','editorial',{music:{bpm}}),compare:false,timed:true});
  cases.push({id:'timed-dial-long',film:film([{...all.get('dial'),beats:8,timing:{slide:{startBeat:1,endBeat:6}}}]),timed:true,compare:false});
  for(const type of ['cards3d','icon3d','phone3d','field'])cases.push({id:`halftone-${type}`,film:film([{...all.get(type),halftone:true}]),compare:true});
}
// Equal inner windows share a definition while their clocks, IDs and palettes stay private.
for(const aspect of aspects)cases.push({id:`independent-${aspect.replace(':','x')}`,film:film([
  {...all.get('title'),beats:3}, {...all.get('winner'),title:'First',beats:4,in:'glide'},
  {...all.get('winner'),title:'Second',beats:4,in:'glide'}, {...all.get('endcard'),beats:3,in:'glide'}],aspect),independent:true,compare:true});
if(option('cases',null)){const selected=new RegExp(option('cases'));cases.splice(0,cases.length,...cases.filter(entry=>selected.test(entry.id)));}
if(reference){
  const before=path.resolve(reference,'lib/engine');
  const referenceTypes=new Set([...Object.keys(require(path.join(before,'fields.js'))),...Object.keys(require(path.join(before,'own.js')))]);
  for(const entry of cases){
    const added=[...new Set(entry.film.scenes.filter(Boolean).map(scene=>scene.type).filter(type=>!referenceTypes.has(type)))];
    if(entry.compare&&added.length){
      entry.compare=false;
      entry.referenceException=`New native components absent from the frozen baseline: ${added.join(', ')}. Native clock, state, geometry and reverse checks still apply.`;
    }
  }
}
if(args.includes('--list')){console.log(JSON.stringify(cases.map(({id,compare,referenceException})=>({id,compare,referenceException:referenceException??null})),null,2));process.exit(0);}
const browser=await createNativeBrowser({source:path.resolve(option('source',SOURCE))}),old=reference?await createNativeBrowser({source:path.resolve(reference),legacy:true}):null;
const page=await browser.newPage(),baseline=old?await old.newPage():null;
const reversePolicy={dom:'exact SHA256 of DOM tree and values; attribute/style declaration order canonicalized',clockTolerance:1e-5,nativeVsReference:{mean:1.5,share:.01},additionalReverseRaster:{mean:.06,share:.0001},rationale:'Frozen Pure Kinetic exhibits the same Chromium transform-layer raster history. Small independent raster rounding is bounded against the frozen engine under identical seek history. No component DOM, measured geometry, or clock state may differ.'};
const results=[],sourceReceipt={native:page.sourceHashes,reference:baseline?.sourceHashes??null};
if(args.includes('--resume')){
  const previous=JSON.parse(fs.readFileSync(path.join(OUT,'report.json'),'utf8'));
  assert.equal(previous.sourceReceipt.native.aggregate,sourceReceipt.native.aggregate,'Resume must use the exact tested native source snapshot');
  assert.equal(previous.sourceReceipt.reference?.aggregate,sourceReceipt.reference?.aggregate,'Resume must use the exact frozen reference');
  results.push(...previous.results.filter(row=>!row.errors.length&&cases.some(entry=>entry.id===row.id)));
}
fs.writeFileSync(path.join(OUT,'source-receipt.json'),JSON.stringify(sourceReceipt,null,2)+'\n');
if(!fs.existsSync(path.join(OUT,'native-source')))fs.cpSync(page.project,path.join(OUT,'native-source'),{recursive:true});
const fixture='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#187ee8"/><circle cx="320" cy="200" r="120" fill="#ffca54"/><path d="M200 300L320 100L440 300Z" fill="#26294a"/></svg>';
const transformProject=(project)=>fs.writeFileSync(path.join(project,'assets/migration-fixture.svg'),fixture);
async function checkClock(time,plan){
  const state=await page.evaluate(()=>({
    rootTime:window.__pkFilm.time,legacy:['PurePlan','PureDom','PureScenes','setupFilm','drawFrame'].filter(key=>typeof window[key]!=='undefined'),
    scenes:Object.values(window.__pkScenes).map(s=>({id:s.id,localTime:s.localTime,clipStart:s.clipStart,clipDuration:s.clipDuration,type:s.ps.scene.type})),
    timelines:Object.keys(window.__timelines),errors:[...(window.__pkErrors??[]),...(window.__pkFilm.errors??[])]
  }));
  assert.deepEqual(state.legacy,[],'Legacy playback globals are forbidden');
  assert.deepEqual(state.errors,[]);
  assert.equal(state.scenes.length,plan.scenes.length,'Every instance registers exactly once');
  assert.ok(Math.abs(state.rootTime-time)<1e-5,`root clock ${state.rootTime} != ${time}`);
  for(const scene of state.scenes){
    assert.ok(state.timelines.includes(scene.id),`${scene.id} has no native timeline`);
    const expected=Math.max(0,Math.min(scene.clipDuration,time-scene.clipStart));
    assert.ok(Math.abs(scene.localTime-expected)<1e-5,`${scene.id} local clock ${scene.localTime} != ${expected}`);
  }
}
const domHash=()=>page.evaluate(()=>{
  const encode=node=>{
    if(node.nodeType!==Node.ELEMENT_NODE)return [node.nodeType,node.nodeValue];
    // The order of a style's declarations and of a class list's names is no
    // state: a class taken off and put back stands last.
    const attrs=[...node.attributes].map(a=>[a.name,a.name==='style'?[...node.style].sort().map(key=>[key,node.style.getPropertyValue(key),node.style.getPropertyPriority(key)]):a.name==='class'?[...node.classList].sort():a.value]).sort((a,b)=>a[0].localeCompare(b[0]));
    return [node.tagName,attrs,[...node.childNodes].map(encode)];
  };
  return JSON.stringify(encode(document.getElementById('root')));
}).then(html=>createHash('sha256').update(html).digest('hex'));
const geometryHash=()=>page.evaluate(()=>JSON.stringify([...document.querySelectorAll('#root,#root *')].map(node=>{
  const r=node.getBoundingClientRect(),s=getComputedStyle(node);
  return [node.tagName,...[r.x,r.y,r.width,r.height].map(v=>Number(v.toFixed(6))),s.fontFamily,s.fontSize,s.fontWeight,s.lineHeight,s.display,s.visibility,s.opacity];
}))).then(value=>createHash('sha256').update(value).digest('hex'));
async function png(){return Buffer.from(await page.screenshot({type:'png'}));}
async function pixels(bytes){return sharp(bytes).resize({width:480,height:480,fit:'inside'}).removeAlpha().raw().toBuffer();}
function delta(a,b){assert.equal(a.length,b.length);let total=0,changed=0;for(let i=0;i<a.length;i+=3){let sum=0;for(let k=0;k<3;k++)sum+=Math.abs(a[i+k]-b[i+k]);total+=sum;if(sum/3>12)changed++;}return {mean:total/a.length,share:changed/(a.length/3)};}
try{
  for(const [index,entry]of cases.entries()){
    if(results.some(row=>row.id===entry.id))continue;
    const row={id:entry.id,referenceException:entry.referenceException??null,frames:0,reverseExact:true,domExact:true,geometryExact:true,reverseRounding:[],mean:0,share:0,errors:[]};
    try{
      assert.ok(entry.film.scenes.every(Boolean),'Unknown sample');
      const {plan}=await page.play(entry.film,{transformProject:entry.image?transformProject:undefined});
      if(entry.image)assert.ok(await page.evaluate(()=>window.__pkScenes.s1.context.images['assets/migration-fixture.svg']?.w===640),'Supplied image must load before fitting');
      if(baseline&&entry.compare)await baseline.play(entry.film,{transformProject:entry.image?transformProject:undefined});
      let times=plan.scenes.flatMap(ps=>[.18,.55,.85].map(f=>ps.start+ps.dur*f));
      if(entry.stateSamples)times.push(...Array.from({length:entry.stateSamples},(_,i)=>plan.scenes[0].start+plan.scenes[0].dur*(i+.55)/entry.stateSamples));
      if(entry.boundaries)times.push(...plan.scenes.slice(1).flatMap(ps=>[ps.start-ps.trDur*.49,ps.start,ps.start+ps.trDur*.49]));
      times=[...new Set([0,...times,plan.duration-.001].map(t=>Math.max(0,t)))].sort((a,b)=>a-b);
      const forward=new Map(),referenceForward=new Map(),forwardDom=new Map(),forwardGeometry=new Map();
      for(const time of times){
        await page.shoot(time);await checkClock(time,plan);
        const shot=await png();forward.set(time,shot);forwardDom.set(time,await domHash());forwardGeometry.set(time,await geometryHash());row.frames++;
        if(baseline&&entry.compare){
          await baseline.shoot(time);
          const oldshot=Buffer.from(await baseline.screenshot({type:'png'}));referenceForward.set(time,oldshot);
          const diff=delta(await pixels(shot),await pixels(oldshot));row.mean=Math.max(row.mean,diff.mean);row.share=Math.max(row.share,diff.share);
          if(diff.mean>1.5||diff.share>.01){
            if(!row.errors.some(x=>x.startsWith('baseline'))){fs.writeFileSync(path.join(OUT,`${entry.id}-new.png`),shot);fs.writeFileSync(path.join(OUT,`${entry.id}-old.png`),oldshot);}
            row.errors.push(`baseline ${time.toFixed(3)}: mean ${diff.mean.toFixed(3)} share ${diff.share.toFixed(4)}`);
          }
        }
      }
      for(const time of times.toReversed()){
        await page.shoot(time);await checkClock(time,plan);
        const dom=await domHash();row.domExact &&= dom===forwardDom.get(time);
        assert.equal(dom,forwardDom.get(time),`DOM state differs after reverse seek at ${time}`);
        const geometry=await geometryHash();row.geometryExact &&= geometry===forwardGeometry.get(time);
        assert.equal(geometry,forwardGeometry.get(time),`Measured element geometry differs after reverse seek at ${time}`);
        const shot=await png();
        let referenceReverse=null;
        if(baseline&&entry.compare){
          await baseline.shoot(time);referenceReverse=Buffer.from(await baseline.screenshot({type:'png'}));
          const diff=delta(await pixels(shot),await pixels(referenceReverse));
          if(diff.mean>1.5||diff.share>.01)row.errors.push(`reverse baseline ${time.toFixed(3)}: mean ${diff.mean.toFixed(3)} share ${diff.share.toFixed(4)}`);
        }
        if(!forward.get(time).equals(shot)){
          row.reverseExact=false;
          const [a,b]=await Promise.all([forward.get(time),shot].map(buffer=>sharp(buffer).removeAlpha().raw().toBuffer()));
          let max=0,changed=0,large=0;for(let i=0;i<a.length;i+=3){let different=false,strong=false;for(let k=0;k<3;k++){const d=Math.abs(a[i+k]-b[i+k]);max=Math.max(max,d);different ||= d!==0;strong ||= d>96;}if(different)changed++;if(strong)large++;}
          const visual=delta(await pixels(forward.get(time)),await pixels(shot));
          const inherited=referenceReverse?delta(await pixels(referenceForward.get(time)),await pixels(referenceReverse)):null;
          // The frozen engine also exhibits Chromium transform-raster cache changes.
          // Require identical DOM+clock, preserve existing native-v-reference limits,
          // and allow no additional reverse error beyond small raster rounding.
          let pictureAuditLargeShare=null;
          if(!inherited){
            const [qa,qb]=await Promise.all([forward.get(time),shot].map(buffer=>sharp(buffer).removeAlpha().resize(Math.round(plan.width/4),Math.round(plan.height/4),{fit:'fill',kernel:'cubic'}).raw().toBuffer()));
            let changedStrong=0;for(let i=0;i<qa.length;i+=3)if(Math.abs(qa[i]-qb[i])>96||Math.abs(qa[i+1]-qb[i+1])>96||Math.abs(qa[i+2]-qb[i+2])>96)changedStrong++;
            pictureAuditLargeShare=changedStrong/(qa.length/3);
          }
          const worse=inherited?(visual.mean>inherited.mean+.06||visual.share>inherited.share+.0001):pictureAuditLargeShare>.0002;
          row.reverseRounding.push({time,max,changed,fullSizeStrongPixels:large,visual,reference:inherited,pictureAuditLargeShare});
          if(worse){row.errors.push(`reverse seek exceeds ${inherited?'reference':'picture-audit'} bounds at ${time.toFixed(3)} (${changed} pixels, max ${max})`);fs.writeFileSync(path.join(OUT,`${entry.id}-forward.png`),forward.get(time));fs.writeFileSync(path.join(OUT,`${entry.id}-reverse.png`),shot);}
        }
      }
      if(entry.id==='image-ui-float'){
        await page.shoot(plan.scenes[0].dur*.55);
        const visible=await page.evaluate(()=>[...window.__pkScenes.s1.root.querySelectorAll('img')].some(img=>{const r=img.getBoundingClientRect();return img.src.includes('migration-fixture.svg')&&img.complete&&img.naturalWidth===640&&r.width>100&&r.height>100&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;}));
        assert.ok(visible,'The supplied image must occupy the rendered ui-float component');
        const raw=await sharp(await png()).removeAlpha().raw().toBuffer();let gold=0;
        for(let i=0;i<raw.length;i+=3)if(Math.abs(raw[i]-255)<9&&Math.abs(raw[i+1]-202)<9&&Math.abs(raw[i+2]-84)<9)gold++;
        assert.ok(gold>100,'Supplied image pixels must be visible, not merely decoded');row.imageProof={visible,goldPixels:gold};
      }
      if(entry.timed){
        const beat=plan.beat,target=entry.film.scenes[0].value,{startBeat,endBeat}=entry.film.scenes[0].timing.slide;
        for(const [at,expected]of [[startBeat,0],[endBeat,target]]){
          await page.shoot(beat*at);
          const shown=await page.evaluate(()=>{const roll=window.__pkScenes.s1.root.querySelector('[data-roll]');return Number([...roll.children].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.lastElementChild.textContent).join(''));});
          assert.equal(shown,expected,`dial value at musical beat ${at}`);
        }
        assert.ok(plan.audioEvents.some(c=>c.kind==='chime'&&Math.abs(c.t-endBeat*beat)<1e-8),'dial arrival chime must coincide with target value');
      }
      if(entry.independent){
        const independence=await page.evaluate(()=>{
          const scenes=window.__pkScenes,ids=Object.values(scenes).flatMap(s=>[...s.root.querySelectorAll('[id]')].map(n=>n.id));
          const before=Object.fromEntries(Object.entries(scenes).map(([id,s])=>[id,s.localTime]));
          window.__timelines.main.seek(1,false);
          const afterRoot=Object.fromEntries(Object.entries(scenes).map(([id,s])=>[id,s.localTime]));
          window.__timelines.s2.seek(.5,false);
          return {ids,before,afterRoot,after:Object.fromEntries(Object.entries(scenes).map(([id,s])=>[id,s.localTime])),hosts:[...document.querySelectorAll('[data-composition-src],[data-composition-file]')].map(n=>({id:n.dataset.compositionId,file:n.dataset.compositionSrc??n.dataset.compositionFile}))};
        });
        assert.deepEqual(independence.afterRoot,independence.before,'Root timeline must not seek children');
        assert.equal(independence.after.s2,.5);
        for(const id of ['s1','s3','s4'])assert.equal(independence.after[id],independence.before[id],`${id} changed while seeking sibling`);
        assert.equal(new Set(independence.ids).size,independence.ids.length,'SVG/filter IDs must be unique across instances');
        const hosts=Object.fromEntries(independence.hosts.map(h=>[h.id,h.file]));
        assert.equal(hosts.s2,hosts.s3,'Repeated instances must reuse a definition file');
        await page.shoot(plan.scenes[2].start+plan.scenes[2].dur*.7);
        const futureFit=await page.evaluate(()=>({fit:window.__pkScenes.s3.fitted,texts:window.__pkScenes.s3.textBoxes().length}));
        assert.ok(futureFit.texts>0,'Future winner has no settled labels');
        assert.notEqual(futureFit.fit,'no text','A hidden future native host must be made measurable during fit');
      }
      assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[],'Native project requested external assets');
      if(baseline)assert.deepEqual(baseline.errors,[]);
    }catch(error){row.errors.push(error.stack??String(error));if(/Connection closed|browser disconnected|Target closed|detached Frame/.test(String(error)))throw error;}
    results.push(row);
    if((index+1)%25===0){await browser.recycle();if(old)await old.recycle();}
    const failures=results.filter(r=>r.errors.length).length;
    console.log(`${index+1}/${cases.length} ${entry.id}: ${row.errors.length?'FAIL '+row.errors[0].split('\n')[0]:'pass'}${baseline?` baseline mean=${row.mean.toFixed(3)} share=${row.share.toFixed(4)}`:''}`);
    fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({schema:'pk-native-acceptance-v1',catalogueTypes:Object.keys(catalog).length,aspects,reference,sourceReceipt,reversePolicy,total:cases.length,completed:results.length,failures,results},null,2)+'\n');
  }
}finally{await browser.close();if(old)await old.close();}
const failed=results.filter(row=>row.errors.length);
console.log(`${results.length} native cases, ${results.reduce((n,r)=>n+r.frames,0)} forward frames + reverse checks, ${failed.length} failed. ${OUT}/report.json`);
if(failed.length)process.exitCode=1;
