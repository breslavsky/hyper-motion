// Global UI chrome shares ellipsis without swallowing the animated sequence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createNativeBrowser,sourceHashes,SOURCE} from './native-browser.mjs';
const args=process.argv.slice(2),option=(n,d)=>args.includes(n)?args[args.indexOf(n)+1]:d;
const out=path.resolve(option('--out','/tmp/pk-ellipsis-hud')),source=path.resolve(option('--source',SOURCE));
assert.ok(!fs.existsSync(out),'Use a fresh output directory');fs.mkdirSync(out,{recursive:true});
const report={sourceReceipt:sourceHashes(source),results:[]};
const browser=await createNativeBrowser({source}),page=await browser.newPage();
report.testedSourceReceipt=page.sourceHashes;
assert.equal(report.testedSourceReceipt.aggregate,report.sourceReceipt.aggregate,'Source changed before native clone');
function read(index){
  const n=window.__pkScenes[`s${index+1}`].sceneRoot.querySelector('[data-ellipsis-field="hud.brand"]'),s=getComputedStyle(n),b=n.getBoundingClientRect();
  const sequence=n.nextElementSibling,q=sequence.getBoundingClientRect(),parent=n.parentElement.getBoundingClientRect();
  return {text:n.textContent,title:n.title,sequence:sequence.textContent,css:[s.whiteSpace,s.overflowX,s.textOverflow],
    width:n.clientWidth,scrollWidth:n.scrollWidth,height:n.clientHeight,scrollHeight:n.scrollHeight,
    gap:q.left-b.right,right:parent.right-q.right,left:b.left-parent.left};
}
try{for(const aspect of ['9:16','1:1','16:9'])for(const name of ['Nook','Широкое имя рабочего пространства '.repeat(3).trim()]){
  const row={aspect,name,errors:[]};
  try{
    const {plan}=await page.play({aspect,style:'scifi',brand:{name},scenes:[{type:'title',text:'A clear view',beats:4},{type:'title',text:'Next step',beats:4}]});
    const states=[];
    for(const ps of plan.scenes)for(const fraction of [.1,.6,.95]){
      const time=ps.start+ps.dur*fraction;await page.shoot(time);const state=await page.evaluate(read,ps.index);
      assert.equal(state.text,name.toUpperCase());assert.equal(state.title,state.text);
      assert.deepEqual(state.css,['nowrap','hidden','ellipsis']);
      assert.equal(state.sequence,`SEQ ${String(ps.index+1).padStart(2,'0')}/02`);
      assert.ok(state.gap>=0&&state.left>=-1&&state.right>=-1&&state.width>0);
      assert.ok(state.height>0&&state.scrollHeight<=state.height+1);
      states.push({time,state,index:ps.index});
    }
    for(const {time,state,index} of [...states].reverse()){await page.shoot(time);assert.deepEqual(await page.evaluate(read,index),state);}
    row.truncates=states.some(({state})=>state.scrollWidth>state.width+1);row.samples=states.length;row.reverseExact=true;
    if(name!=='Nook')assert.ok(row.truncates,'Long brand fixture must exercise actual truncation');
    assert.deepEqual(page.errors,[]);row.passed=true;
  }catch(e){row.errors.push(String(e.stack??e));row.passed=false;}
  report.results.push(row);console.log(aspect,name,row.passed?'pass':'FAIL');
}}finally{await browser.close();}
report.sourceStable=report.sourceReceipt.aggregate===sourceHashes(source).aggregate;
report.passed=report.sourceStable&&report.results.every(r=>r.passed);
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
if(!report.passed)process.exitCode=1;
