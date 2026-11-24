// Exact brand colors in mounted native components, including post-build edits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createNativeBrowser} from './native-browser.mjs';
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'/tmp/pk-native-brand-tokens';
fs.mkdirSync(out,{recursive:true});
const tokens={background:'#08172d',foreground:'#ffffff',accent:'#59cbff'};
const edited={background:'#123b2d',foreground:'#fff6df',accent:'#f6ad49'};
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;');
const unescape=value=>value.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&amp;','&');
function change(project,changes){
  const file=path.join(project,'index.html');let html=fs.readFileSync(file,'utf8');
  for(const [id,patch]of Object.entries(changes)){
    const re=new RegExp(`(<div id="${id}"[^>]*?data-variable-values=')([^']*)(')`);
    assert.ok(re.test(html));html=html.replace(re,(_,start,data,end)=>{
      const values=JSON.parse(unescape(data));
      for(const [key,value]of Object.entries(patch))values[key]=JSON.stringify({...JSON.parse(values[key]),...value});
      return start+escape(JSON.stringify(values))+end;
    });
  }
  fs.writeFileSync(file,html);
}
const browser=await createNativeBrowser(),page=await browser.newPage(),results=[];
try{
  for(const aspect of ['9:16','1:1','16:9']){
    const film={aspect,style:'mono',grain:false,sparks:false,brand:{name:'Nook',tokens},scenes:Array.from({length:6},(_,i)=>({type:'title',beats:4,text:'Exact brand '+(i+1),...(i===1?{bg:'#fef6e4',fg:'#10213a'}:{}),...(i===2?{look:'noir'}:{})}))};
    const {plan}=await page.play(film,{transformProject:project=>change(project,{s4:{brand:{tokens:edited}},s5:{brand:{tokens:edited},style:{bg:'#210a3c',fg:'#fefeff',accent:'#ff00ff'}},s6:{brand:{tokens:{}}}})});
    const shots=[];
    for(const ps of plan.scenes){
      await page.shoot(ps.start+ps.dur*.6);
      const state=await page.evaluate(id=>{
        const s=window.__pkScenes[id],text=s.root.querySelector('.display');
        return {id,bg:s.ps.bg,fg:s.ps.fg,accent:s.ps.accent,palette:s.plan.palette,background:getComputedStyle(s.sceneRoot).backgroundColor,textColor:getComputedStyle(text).color,rebuild:s.rebuildRequired};
      },'s'+(ps.index+1));shots.push(state);
      assert.equal(state.rebuild,null,'Color-only edits must not require an audio rebuild');
      if([0,2].includes(ps.index))assert.deepEqual([state.bg,state.fg,state.accent],Object.values(tokens));
      if(ps.index===1)assert.deepEqual([state.bg,state.fg],['#fef6e4','#10213a']);
      if(ps.index===3){assert.deepEqual([state.bg,state.fg,state.accent],Object.values(edited));assert.deepEqual(new Set(Object.values(state.palette)),new Set(Object.values(edited)));}
      if(ps.index===4)assert.deepEqual([state.bg,state.fg,state.accent],['#210a3c','#fefeff','#ff00ff']);
      if(ps.index===5)assert.deepEqual([state.bg,state.fg,state.accent],[ps.brandBase.bg,ps.brandBase.fg,ps.brandBase.accent]);
      const rgb=hex=>{const raw=hex.slice(1),full=raw.length===3?raw.replace(/./g,c=>c+c):raw;return `rgb(${[0,2,4].map(i=>parseInt(full.slice(i,i+2),16)).join(', ')})`;};
      assert.equal(state.background,rgb(state.bg),'Native background must actually paint the role');
      assert.equal(state.textColor,rgb(state.fg),'Visible title must use the exact foreground');
    }
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
    results.push({aspect,shots});console.log(aspect+': six native brand instances pass');
    // A project built before tokens were configured can receive them natively.
    await page.play({...film,brand:{name:'Nook'},scenes:[film.scenes[0]]},{transformProject:project=>change(project,{s1:{brand:{tokens:edited}}})});
    await page.shoot(1);
    const added=await page.evaluate(()=>{const s=window.__pkScenes.s1;return [s.ps.bg,s.ps.fg,s.ps.accent];});
    assert.deepEqual(added,Object.values(edited));
  }
}finally{await browser.close();}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'pk-native-brand-tokens-v1',sourceReceipt:page.sourceHashes,results},null,2)+'\n');
