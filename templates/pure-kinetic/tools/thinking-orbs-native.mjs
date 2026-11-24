// Exercise the actual film compiler and native HyperFrames scene clocks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser,sharp,sourceHashes} from './migration-browser.mjs';
import {measureRenderedText,layoutFindings} from './quality-layout.mjs';
import {ORB_STATES} from '../source/lib/components/thinking-orbs/orb.mjs';

const require=createRequire(import.meta.url),F=require('../source/lib/film.cjs');
const BRANDS={
  dark:{name:'Orbs',font:'Geist',tokens:{background:'#101216',foreground:'#f4f5f7',accent:'#99c3ff'}},
  light:{name:'Orbs',font:'Geist',tokens:{background:'#f6f7f9',foreground:'#141821',accent:'#2f6be5'}},
};
export function cases(){
  return ['16:9','9:16','1:1'].flatMap(aspect=>Object.keys(BRANDS).flatMap(brand=>ORB_STATES.map((state,index)=>({
    id:`${aspect.replace(':','x')}-${brand}-${state}`,aspect,brand,state,
    scene:{type:'thinking-orb',state,beats:6,in:'glide',
      ...(index===8?{}:{title:index===1?'Находим ответы в ваших источниках':'Your assistant is '+state,
        body:index===1?'Поиск связывает вопрос с нужными материалами. Показываем процесс работы ассистента.':'A visible state for the work happening behind each response.'}),
      ...(index===2?{orbSpeed:.75,tint:'#b562db',size:.7}:{}),
      ...(index===7?{orbSpeed:0}:{}),
    },
  }))));
}

async function snapshot(page,id,dark){
  return page.evaluate(async({id,dark,measure})=>{
    const instance=window.__pkScenes[id],scene=instance.ps.scene;
    const canvas=instance.sceneRoot.querySelector('canvas[data-thinking-orb]');
    if(!canvas)throw new Error('Missing native orb Canvas');
    const {MODE_FRAMES,resolvePreset,paintFrame}=await import('./lib/components/thinking-orbs/vendor/engine.es.js');
    const preset=resolvePreset(scene.state,64),seconds=Math.max(0,(instance.time-instance.ps.start)*(instance.ps.speed??1));
    const frame=MODE_FRAMES[preset.mode](64,seconds*preset.speed*(scene.orbSpeed??1),preset.opts);
    const expected=document.createElement('canvas');expected.width=canvas.width;expected.height=canvas.height;
    const ctx=expected.getContext('2d'),scale=canvas.width/64;
    ctx.setTransform(scale,0,0,scale,0,0);
    let color=scene.tint===undefined?instance.ps.accent:(instance.plan.palette[scene.tint]??scene.tint);
    if(/^#[\da-f]{3}$/i.test(color))color='#'+color.slice(1).replace(/./g,c=>c+c);
    const rgb=Number.parseInt(color.slice(1),16);
    paintFrame(ctx,frame,dark,{r:rgb>>16&255,g:rgb>>8&255,b:rgb&255});
    const actual=canvas.toDataURL(),empty=document.createElement('canvas');empty.width=canvas.width;empty.height=canvas.height;
    const box=canvas.getBoundingClientRect();
    return {state:scene.state,seconds,pixels:actual,parity:actual===expected.toDataURL(),
      painted:actual!==empty.toDataURL(),
      box:{x:box.x,y:box.y,w:box.width,h:box.height},
      texts:(0,eval)(`(${measure})`)(instance.sceneRoot),
      copy:[...instance.sceneRoot.querySelectorAll('[data-design-role]')].map(n=>n.textContent),
      source:document.querySelector(`[data-composition-id="${id}"]`).getAttribute('data-composition-src'),
    };
  },{id,dark,measure:measureRenderedText.toString()});
}

async function clocks(page){
  return page.evaluate(()=>{
    const a=window.__pkScenes.s1,b=window.__pkScenes.s2;
    const capture=s=>JSON.stringify([s.localTime,s.sceneRoot.querySelector('canvas').toDataURL(),s.sceneRoot.innerHTML]);
    const seek=(id,n)=>window.__timelines[id].seek(n,true);
    seek('s1',a.clipDuration*.4);seek('s2',b.clipDuration*.6);
    const beforeA=capture(a),beforeB=capture(b);
    seek('s2',b.clipDuration*.8);const aStable=capture(a)===beforeA;
    seek('s2',b.clipDuration*.6);const bRestored=capture(b)===beforeB;
    seek('s1',a.clipDuration*.8);const bStable=capture(b)===beforeB;
    seek('s1',a.clipDuration*.4);const aRestored=capture(a)===beforeA;
    return {aStable,bStable,aRestored,bRestored};
  });
}

async function main(){
  const args=process.argv.slice(2),jobs=cases();
  if(args.includes('--list')){console.log(JSON.stringify(jobs));return;}
  const out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'/tmp/thinking-orbs-native');
  if(fs.existsSync(out))throw new Error('Use a fresh output directory: '+out);
  fs.mkdirSync(out,{recursive:true});
  const before=sourceHashes(),report={total:jobs.length,results:[],groups:[]};
  const browser=await createNativeBrowser(),page=await browser.newPage();
  try{
    for(const aspect of ['16:9','9:16','1:1'])for(const brand of Object.keys(BRANDS)){
      const group=jobs.filter(j=>j.aspect===aspect&&j.brand===brand);
      const film={aspect,style:'editorial',brand:BRANDS[brand],grain:false,sparks:false,scenes:group.map(j=>j.scene)};
      assert.deepEqual(F.problems(film),[],'Film schema');
      const {plan}=await page.play(film),safe=plan.safe;
      const bounds={width:plan.width,height:plan.height,floor:plan.type.label,
        safe:{left:plan.width*safe.left,top:plan.height*safe.top,right:plan.width*(1-safe.right),bottom:plan.height*(1-safe.bottom)}};
      for(let index=0;index<group.length;index++){
        const job=group[index],id='s'+(index+1),ps=plan.scenes[index],samples=[];
        let saved;
        for(const fraction of [.36,.72]){
          await page.shoot(ps.start+ps.dur*fraction);
          const state=await snapshot(page,id,brand==='dark');
          assert.equal(state.state,job.state);assert.ok(state.painted&&state.parity,'Original painter parity: '+job.id);
          const findings=layoutFindings(state.texts,bounds);assert.deepEqual(findings,[],JSON.stringify({id:job.id,findings}));
          assert.deepEqual(state.copy,[job.scene.title,job.scene.body].filter(Boolean),'Visible content preserved');
          assert.ok(state.box.x>=bounds.safe.left-1&&state.box.y>=bounds.safe.top-1&&state.box.x+state.box.w<=bounds.safe.right+1&&state.box.y+state.box.h<=bounds.safe.bottom+1,'Orb within safe area: '+job.id);
          for(const text of state.texts)for(const r of text.inkLines){
            assert.ok(Math.min(r.x+r.w,state.box.x+state.box.w)-Math.max(r.x,state.box.x)<=2||Math.min(r.y+r.h,state.box.y+state.box.h)-Math.max(r.y,state.box.y)<=2,'Orb overlaps copy');
          }
          samples.push({fraction,seconds:state.seconds,parity:state.parity,box:state.box,texts:state.texts});saved=state;
        }
        if(index===1)await sharp(await page.screenshot({type:'png'})).resize({width:960,height:960,fit:'inside'}).png().toFile(path.join(out,`${aspect.replace(':','x')}-${brand}.png`));
        await page.shoot(ps.start+ps.dur*.94);await page.shoot(ps.start+ps.dur*.15);await page.shoot(ps.start+ps.dur*.72);
        const repeated=await snapshot(page,id,brand==='dark');
        assert.equal(repeated.pixels,saved.pixels,'Reverse seek pixels');assert.deepEqual(repeated.texts,saved.texts,'Reverse seek text');
        report.results.push({id:job.id,state:job.state,aspect,brand,parity:true,reverseExact:true,samples});
      }
      const independence=await clocks(page);assert.ok(Object.values(independence).every(Boolean),'Independent local clocks');
      const disposal=await page.evaluate(()=>{
        const last=window.__pkScenes.s9,other=window.__pkScenes.s1;
        const pixels=other.sceneRoot.querySelector('canvas').toDataURL();last.dispose();
        return !window.__pkScenes.s9&&!window.__timelines.s9&&!last.root.isConnected&&other.sceneRoot.querySelector('canvas').toDataURL()===pixels;
      });
      assert.ok(disposal,'Independent disposal');assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
      report.groups.push({aspect,brand,independence,disposal,externalRequests:page.externalRequests,errors:page.errors});
      console.log(`${aspect} ${brand}: all nine states passed`);
    }
    report.sourceStable=sourceHashes().aggregate===before.aggregate;assert.ok(report.sourceStable,'Production source changed during verification');
    report.passed=report.results.length===report.total;
  }catch(error){report.error=String(error.stack??error);process.exitCode=1;console.error(report.error);}
  finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
