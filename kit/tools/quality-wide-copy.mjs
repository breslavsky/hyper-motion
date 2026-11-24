// Measure native variable edits before changing historical non-Latin field limits.
// The saved regression films remain English; these are native typography probes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createNativeBrowser,sharp,sourceHashes} from './native-browser.mjs';
import {maximumScene,measureRenderedText,layoutFindings,persistentFindings} from './quality-layout.mjs';

const args=process.argv.slice(2),out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'/tmp/pk-quality-wide-copy');
fs.mkdirSync(out,{recursive:true});
const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;');
const unescape=value=>value.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&amp;','&');
const browser=await createNativeBrowser(),page=await browser.newPage(),results=[];
const sourceReceipt=page.sourceHashes;
let sourceAfter=null,sourceStable=false,passed=false;
const report=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'pure-kinetic.quality-wide-copy.v1',sourceReceipt,sourceAfter,sourceStable,passed,total:48,completed:results.length,failedCases:results.filter(r=>r.errors.length).length,results},null,2)+'\n');
try{
  for(const aspect of ['9:16','1:1','16:9'])for(const font of ['Geist Mono','Archivo'])for(const style of ['editorial','grape'])for(const mode of ['phrase','unbroken']){
    const scenes=['between','flip'].map(maximumScene);
    const changes=mode==='phrase'?[{lead:'Командная работа',words:Array(3).fill('Управление задачами!')},{lead:'Работайте уверенно',words:Array(5).fill('Работайте уверенно')}]:[{lead:'Ш'.repeat(16),words:Array(3).fill('Ш'.repeat(20))},{lead:'Ш'.repeat(18),words:Array(5).fill('Ш'.repeat(18))}];
    const rows=scenes.map((scene,i)=>({id:[scene.type,aspect.replace(':','x'),font.replaceAll(' ','-'),style,mode].join('-'),aspect,font,style,mode,content:changes[i],samples:[],errors:[]}));
    let plan;
    try{({plan}=await page.play({aspect,style,brand:{name:'Nook',font},grain:false,sparks:false,scenes},{transformProject:project=>{
      const file=path.join(project,'index.html');let html=fs.readFileSync(file,'utf8');
      for(let i=0;i<changes.length;i++)html=html.replace(new RegExp(`(<div id="s${i+1}"[^>]*?data-variable-values=')([^']*)(')`),(_,head,data,tail)=>{
        const values=JSON.parse(unescape(data));values.content=JSON.stringify({...JSON.parse(values.content),...changes[i]});return head+escape(JSON.stringify(values))+tail;
      });
      fs.writeFileSync(file,html);
    }}));}catch(error){
      // A failed constructor is a failed native case too. Preserve the error
      // and finish the other formats instead of leaving a 10/48 success report.
      for(const row of rows){row.errors.push(String(error?.stack??error));results.push(row);console.log(row.id,'FAIL');}
      try{await browser.recycle();}catch(recycleError){for(const row of rows)row.errors.push(String(recycleError?.stack??recycleError));}
      report();continue;
    }
    const m=plan.safe,bounds={width:plan.width,height:plan.height,floor:plan.type.label,safe:{left:plan.width*m.left,top:plan.height*m.top,right:plan.width*(1-m.right),bottom:plan.height*(1-m.bottom)}};
    for(let i=0;i<scenes.length;i++){
      const ps=plan.scenes[i],row=rows[i];
      const read=()=>page.evaluate((id,fn)=>{
        const s=window.__pkScenes[id];return {content:s.ps.scene,rebuild:s.rebuildRequired,texts:(0,eval)(`(${fn})`)(s.sceneRoot)};
      },`s${i+1}`,measureRenderedText.toString());
      try{
        for(const fraction of [.45,.65,.85]){
          await page.shoot(ps.start+ps.dur*fraction);
          const state=await read();
          assert.equal(state.content.lead,changes[i].lead);assert.deepEqual(state.content.words,changes[i].words);
          assert.ok(state.rebuild.audio,'A native copy edit must require synchronized audio rebuild');
          assert.ok(state.texts.length,'An active native typography fixture must paint text');
          row.samples.push({fraction,texts:state.texts,findings:layoutFindings(state.texts,bounds)});
        }
        row.findings=persistentFindings(row.samples);assert.deepEqual(row.findings,[]);
        assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
        row.minimumRendered=Math.min(...row.samples.flatMap(s=>s.texts.filter(t=>!t.over).map(t=>t.renderedSize)));
        const copy=new Set([changes[i].lead,...changes[i].words]);
        row.maximumLineCount=Math.max(...row.samples.flatMap(s=>s.texts.filter(t=>copy.has(t.text)).map(t=>t.lines.length)));
        if(scenes[i].type==='between'&&aspect==='9:16'&&font==='Archivo'&&style==='editorial'&&mode==='unbroken')
          assert.ok(row.maximumLineCount>=2,'The valid wide-script fixture must retain its full copy on multiple lines');
        await page.shoot(ps.start+ps.dur*.65);
        assert.deepEqual((await read()).texts,row.samples[1].texts,'Reverse seek must reproduce the wrapped glyph geometry exactly');
        row.reverseExact=true;
      }catch(error){row.errors.push(String(error?.stack??error));}
      await sharp(await page.screenshot({type:'png'})).resize({width:640,height:640,fit:'inside'}).png().toFile(path.join(out,row.id+'.png'));
      results.push(row);report();console.log(row.id,row.errors.length?'FAIL':'pass');
    }
  }
}finally{await browser.close();}
sourceAfter=sourceHashes();sourceStable=sourceAfter.aggregate===sourceReceipt.aggregate;
passed=sourceStable&&results.length===48&&results.every(row=>row.errors.length===0);report();
if(!passed)process.exitCode=1;
