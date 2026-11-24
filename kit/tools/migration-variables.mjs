// Native content, font, fitting and readiness regression acceptance.
// node tools/migration-variables.mjs [--out /tmp/pk-native-variables]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createNativeBrowser} from './migration-browser.mjs';

const args=process.argv.slice(2),out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'/tmp/pk-native-variables');
fs.mkdirSync(out,{recursive:true});
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;');
const unescape=value=>value.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&amp;','&');
function changeVariables(project,changes){
  const file=path.join(project,'index.html');let html=fs.readFileSync(file,'utf8');
  for(const [id,patch]of Object.entries(changes)){
    const regex=new RegExp(`(<div id="${id}"[^>]*?data-variable-values=')([^']*)(')`);
    assert.ok(regex.test(html),`Missing native host ${id}`);
    html=html.replace(regex,(_,head,data,tail)=>{
      const values=JSON.parse(unescape(data));
      for(const [key,override]of Object.entries(patch))values[key]=JSON.stringify({...JSON.parse(values[key]),...override});
      return head+escape(JSON.stringify(values))+tail;
    });
  }
  fs.writeFileSync(file,html);
}
const browser=await createNativeBrowser(),page=await browser.newPage(),results=[];
try{
  for(const aspect of ['9:16','16:9','1:1']){
    const row={id:`content-${aspect.replace(':','x')}`,errors:[]};
    try{
      await page.play({aspect,style:'editorial',brand:{name:'Variables'},scenes:[
        {type:'title',beats:4,text:'Independent components'},
        {type:'slam',beats:4,lines:['A','B']},
        {type:'typewriter',beats:4,text:'Short'},
      ]},{transformProject:project=>changeVariables(project,{s2:{content:{lines:['One','Two','Three','Four']}},s3:{content:{text:'A longer native text that fits the same fixed slot'}}})});
      await page.shoot(5.9);
      const state=await page.evaluate(async()=>{
        await window.__pkFilm.ready;
        const external=['scene','cam','display','mono','card','center','glyph'].map(cls=>{
          const node=document.createElement('div');node.className=cls;node.textContent='Other block';document.body.append(node);
          const style=getComputedStyle(node),value={cls,position:style.position,display:style.display,visibility:style.visibility,weight:style.fontWeight};node.remove();return value;
        });
        return {marks:window.__pkScenes.s2.ps.marks,rebuild:window.__pkFilm.rebuildRequired,
          ready:typeof window.__pkFilm.drawPresentation==='function',external,
          scenes:Object.values(window.__pkScenes).map(s=>({id:s.id,box:s.box,fit:s.fitted,text:s.root.innerText}))};
      });
      assert.equal(state.ready,true);assert.equal(state.marks.length,4);assert.ok(state.marks.every(Number.isFinite));
      assert.deepEqual(state.rebuild.map(s=>s.id),['s2','s3']);
      assert.ok(state.rebuild.every(s=>s.audio===true));
      assert.match(state.scenes.find(s=>s.id==='s3').text,/A longer native text/);
      assert.ok(state.scenes.every(s=>s.box&&s.fit!=='no text'),'Future native clips must measure text during construction and final fit');
      assert.ok(state.external.every(node=>node.position==='static'&&node.display==='block'&&node.visibility==='visible'&&node.weight==='400'),'Pure Kinetic CSS must not style another native block');
      assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
      const disposed=await page.evaluate(()=>{
        const film=window.__pkFilm,scene=window.__pkScenes.s3,timeline=window.__timelines.s3,time=scene.localTime;
        film.dispose();film.dispose();timeline.seek(.5,false);scene.drawAt(.25);
        return {time:scene.localTime,prior:time,scenes:Object.keys(window.__pkScenes),timelines:Object.keys(window.__timelines),stages:document.querySelectorAll('.pk-stage').length};
      });
      assert.equal(disposed.time,disposed.prior);assert.deepEqual(disposed.scenes,[]);assert.deepEqual(disposed.timelines,[]);assert.equal(disposed.stages,0);
    }catch(error){row.errors.push(error.stack??String(error));}
    results.push(row);console.log(`${row.id}: ${row.errors.length?'FAIL '+row.errors[0]:'pass'}`);
  }
  for(const font of ['Geist Mono',{family:'Custom Brand',src:'assets/brand.woff2',weight:700}]){
    const row={id:typeof font==='string'?'bundled-font':'local-font',errors:[]};
    try{
      await page.play({aspect:'16:9',style:'editorial',brand:{name:'Brand',font},scenes:[{type:'title',beats:4,text:'Native font'}]},
        {transformProject:project=>fs.copyFileSync(path.join(project,'lib/fonts/Geist-Variable.woff2'),path.join(project,'assets/brand.woff2'))});
      await page.shoot(1);
      const state=await page.evaluate(()=>{const s=window.__pkScenes.s1,node=s.root.querySelector('.display');return {
        family:s.plan.look.display.family,computed:getComputedStyle(node).fontFamily,weight:getComputedStyle(node).fontWeight,
        loaded:document.fonts.check(`700 100px ${s.plan.look.display.family}`),box:s.box,rebuild:window.__pkFilm.rebuildRequired,
      };});
      assert.ok(state.loaded&&state.box);assert.deepEqual(state.rebuild,[]);
      assert.ok(state.computed.includes(typeof font==='string'?font:'PKBrand-'));
      assert.equal(state.weight,typeof font==='string'?'900':'700');
      assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
    }catch(error){row.errors.push(error.stack??String(error));}
    results.push(row);console.log(`${row.id}: ${row.errors.length?'FAIL '+row.errors[0]:'pass'}`);
  }
}finally{await browser.close();}
const failures=results.filter(row=>row.errors.length).length;
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'pk-native-variables-v1',total:results.length,failures,results},null,2)+'\n');
if(failures)process.exitCode=1;
