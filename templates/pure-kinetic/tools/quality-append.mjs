// A rolling word's mask must contain the loaded font, including its descenders.
// node tools/quality-append.mjs --out /tmp/pk-quality-append
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createNativeBrowser,sharp,sourceHashes} from './migration-browser.mjs';
import {samples,maximumScene,measureRenderedText,layoutFindings} from './quality-layout.mjs';

const args=process.argv.slice(2),out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'/tmp/pk-quality-append');
fs.mkdirSync(out,{recursive:true});
const browser=await createNativeBrowser(),page=await browser.newPage(),results=[];
let sourceAfter=null,sourceStable=false,passed=false;
const report=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'pure-kinetic.quality-append.v1',sourceReceipt:page.sourceHashes,sourceAfter,sourceStable,passed,total:18,completed:results.length,failedCases:results.filter(r=>r.errors.length).length,results},null,2)+'\n');
const maximum={...maximumScene('append'),base:'Worldwide growth',words:['Typography display','Worldwide workflow','Big glyphs display','Quickly paging now','Keeping glyphs fit','Bringing joy daily'],beats:14};
// A max-count fixture needs enough time to hold each word after its entrance.
// This checks spatial limits, not whether short default durations are readable.
const contents={sample:samples().get('append'),max:maximum};

async function read(){
  return page.evaluate(fn=>{
    const root=window.__pkScenes.s1.sceneRoot;
    const encode=node=>node.nodeType!==Node.ELEMENT_NODE?[node.nodeType,node.nodeValue]:[node.tagName,[...node.attributes].map(a=>[a.name,a.name==='style'?[...node.style].sort().map(k=>[k,node.style.getPropertyValue(k)]):a.value]).sort((a,b)=>a[0].localeCompare(b[0])),[...node.childNodes].map(encode)];
    return {texts:(0,eval)(`(${fn})`)(root),boxes:window.texts(),dom:JSON.stringify(encode(root))};
  },measureRenderedText.toString());
}

try{
  for(const aspect of ['9:16','1:1','16:9'])for(const font of [null,'Geist Mono','Archivo'])for(const [content,scene]of Object.entries(contents)){
    const row={id:`append-${aspect.replace(':','x')}-${font?.replaceAll(' ','-')??'default'}-${content}`,aspect,font,content,scene,errors:[],samples:[]};
    try{
      const film={aspect,style:'editorial',brand:{name:'Nook',...(font?{font}:{})},grain:false,sparks:false,scenes:[scene]};
      const {plan}=await page.play(film),ps=plan.scenes[0],m=plan.safe;
      const bounds={width:plan.width,height:plan.height,floor:plan.type.label,safe:{left:plan.width*m.left,top:plan.height*m.top,right:plan.width*(1-m.right),bottom:plan.height*(1-m.bottom)}};
      for(let i=0;i<scene.words.length;i++){
        const local=ps.marks[i]+.38,at=ps.start+local/ps.speed;
        assert.ok(local<(ps.marks[i+1]??ps.ldur)-.06,'Fixture must sample a settled word before its exit');
        await page.shoot(at);
        const state=await read(),findings=layoutFindings(state.texts,bounds);
        row.samples.push({word:i,at,texts:state.texts,boxes:state.boxes,findings});
        assert.deepEqual(state.texts.map(t=>t.text).sort(),[scene.base,scene.words[i]].sort(),'The current word and base must both be visible');
        assert.deepEqual(findings,[],'Every settled word must fit at the rendered font floor');
        const wordBox=state.boxes.find(t=>t.text===scene.words[i]);
        assert.ok(wordBox?.seen>.98,'The complete font line box must fit the rolling mask');
      }
      const at=row.samples.at(-1).at;
      await page.shoot(at);const before=await read();
      await page.shoot(ps.start+ps.dur*.94);await page.shoot(ps.start+ps.dur*.12);await page.shoot(at);
      assert.deepEqual(await read(),before,'Reverse seek must reconstruct exact DOM and text geometry');
      assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
      row.reverseExact=true;
      row.minimumRendered=Math.min(...row.samples.flatMap(s=>s.texts.map(t=>t.renderedSize)));
      await sharp(await page.screenshot({type:'png'})).resize({width:640,height:640,fit:'inside'}).png().toFile(path.join(out,row.id+'.png'));
    }catch(error){
      row.errors.push(String(error?.stack??error));
      // A rejected native build can close Chrome. Keep that failure, then
      // give later cases their own browser instead of cascading disconnects.
      try{await browser.recycle();}catch(recycleError){row.errors.push(String(recycleError?.stack??recycleError));}
    }
    results.push(row);report();console.log(row.id,row.errors.length?'FAIL':'pass');
  }
}finally{await browser.close();}
sourceAfter=sourceHashes();sourceStable=sourceAfter.aggregate===page.sourceHashes.aggregate;
passed=sourceStable&&results.length===18&&results.every(r=>r.errors.length===0);report();
if(!passed)process.exitCode=1;
