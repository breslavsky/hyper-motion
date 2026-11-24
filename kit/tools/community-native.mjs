// Reuse one component definition with separate content, fonts, colours and clocks.
// node tools/community-native.mjs --out /tmp/pk-community-native
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createNativeBrowser,sharp} from './migration-browser.mjs';
const require=createRequire(import.meta.url),definitions=require('../source/lib/components/metadata.cjs');
const names=['polar','letterflip','accordion','explode','scan'],aspects=['9:16','1:1','16:9'];
const args=process.argv.slice(2),out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'/tmp/pk-community-native');
fs.mkdirSync(out,{recursive:true});
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;');
const unescape=value=>value.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&amp;','&');
function brandInstances(project){
  const file=path.join(project,'index.html');let html=fs.readFileSync(file,'utf8');
  for(const [id,font,bg,fg,accent]of [['s2','Geist Mono','#141527','#ffffff','#ffca54'],['s3','Archivo','#f4f0e6','#161626','#6554e8']]){
    const regex=new RegExp(`(<div id="${id}"[^>]*?data-variable-values=')([^']*)(')`);
    assert.ok(regex.test(html));
    html=html.replace(regex,(_,head,data,tail)=>{
      const vars=JSON.parse(unescape(data));
      vars.brand=JSON.stringify({...JSON.parse(vars.brand),font});
      vars.style=JSON.stringify({...JSON.parse(vars.style),bg,fg,accent});
      return head+escape(JSON.stringify(vars))+tail;
    });
  }
  fs.writeFileSync(file,html);
}
function other(type,scene){
  if(type==='polar')return {...scene,label:'Another shape',satellites:false};
  if(type==='letterflip')return {...scene,text:'Another turn'};
  if(type==='accordion')return {...scene,items:scene.items.map((_,i)=>`Stage ${i+1}`)};
  if(type==='explode')return {...scene,title:'Another structure',layers:scene.layers.map((_,i)=>`Layer ${i+1}`)};
  return {...scene,title:'Another collection',categories:scene.categories.map((_,i)=>`Group ${i+1}`)};
}
const browser=await createNativeBrowser(),page=await browser.newPage(),results=[];
try{
  for(const type of names)for(const aspect of aspects){
    const row={id:`${type}-${aspect.replace(':','x')}`,errors:[]};
    try{
      const sample={...definitions[type].sample,in:'glide'},second=other(type,sample);
      const {plan}=await page.play({aspect,style:'noir',grain:false,sparks:false,brand:{name:'Components'},scenes:[
        {type:'title',beats:3,text:'Independent instances',in:'glide'},sample,second,{type:'endcard',beats:3,cta:'Build your next idea',in:'glide'},
      ]},{transformProject:brandInstances});
      await page.shoot(plan.scenes[1].start+plan.scenes[1].dur*.56);
      await sharp(await page.screenshot({type:'png'})).resize({width:640,height:640,fit:'inside'}).png().toFile(path.join(out,`${row.id}-first.png`));
      await page.shoot(plan.scenes[2].start+plan.scenes[2].dur*.56);
      await sharp(await page.screenshot({type:'png'})).resize({width:640,height:640,fit:'inside'}).png().toFile(path.join(out,`${row.id}-second.png`));
      row.proof=await page.evaluate(()=>{
        const a=window.__pkScenes.s2,b=window.__pkScenes.s3;
        const canonical=node=>{
          if(node.nodeType!==1)return [node.nodeType,node.nodeValue];
          const attrs=[...node.attributes].map(attr=>[attr.name,attr.name==='style'?[...node.style].sort().map(k=>[k,node.style.getPropertyValue(k)]):attr.value]).sort((x,y)=>x[0].localeCompare(y[0]));
          return [node.tagName,attrs,[...node.childNodes].map(canonical)];
        };
        const state=s=>JSON.stringify([s.localTime,canonical(s.root)]);
        const tl=id=>window.__timelines[id];
        tl('s2').seek(a.clipDuration*.3,false);tl('s3').seek(b.clipDuration*.55,false);
        const first=state(a),second=state(b);
        tl('s3').seek(b.clipDuration*.8,false);const firstUnchanged=state(a)===first;
        tl('s3').seek(b.clipDuration*.55,false);const secondRestored=state(b)===second;
        tl('s2').seek(a.clipDuration*.85,false);const secondUnchanged=state(b)===second;
        tl('s2').seek(a.clipDuration*.3,false);const firstRestored=state(a)===first;
        const before=Object.values(window.__pkScenes).map(s=>s.localTime);tl('main').seek(.7,false);
        const rootDidNotSeek=JSON.stringify(before)===JSON.stringify(Object.values(window.__pkScenes).map(s=>s.localTime));
        const host=id=>document.querySelector(`[data-composition-id="${id}"]`);
        const source=id=>host(id).dataset.compositionSrc??host(id).dataset.compositionFile;
        const ids=[...a.root.querySelectorAll('[id]'),...b.root.querySelectorAll('[id]')].map(n=>n.id);
        const texts=s=>[...s.root.querySelectorAll('*')].filter(n=>!n.closest('.deco,.ghost,svg')&&[...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim()));
        const textFonts=s=>texts(s).map(n=>getComputedStyle(n).fontFamily);
        const minimumFont=s=>Math.min(...texts(s).map(n=>parseFloat(getComputedStyle(n).fontSize)));
        return {firstUnchanged,secondUnchanged,firstRestored,secondRestored,rootDidNotSeek,
          sameDefinition:source('s2')===source('s3'),privateIds:ids.length===new Set(ids).size,
          distinctContent:JSON.stringify(a.ps.scene)!==JSON.stringify(b.ps.scene),
          firstFonts:textFonts(a),secondFonts:textFonts(b),firstColor:a.ps.accent,secondColor:b.ps.accent,
          firstMinimumFont:minimumFont(a),secondMinimumFont:minimumFont(b),labelMinimum:a.plan.type.label};
      });
      for(const flag of ['firstUnchanged','secondUnchanged','firstRestored','secondRestored','rootDidNotSeek','sameDefinition','privateIds','distinctContent'])assert.equal(row.proof[flag],true,flag);
      assert.ok(row.proof.firstFonts.length&&row.proof.firstFonts.every(font=>font.includes('Geist Mono')));
      assert.ok(row.proof.secondFonts.length&&row.proof.secondFonts.every(font=>font.includes('Archivo')));
      assert.equal(row.proof.firstColor,'#ffca54');assert.equal(row.proof.secondColor,'#6554e8');
      assert.ok(row.proof.firstMinimumFont>=row.proof.labelMinimum-.1&&row.proof.secondMinimumFont>=row.proof.labelMinimum-.1,'Semantic text must respect the shared label-size floor');
      assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
    }catch(error){row.errors.push(error.stack??String(error));}
    results.push(row);
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'pk-community-native-v1',sourceReceipt:page.sourceHashes,total:15,completed:results.length,failures:results.filter(r=>r.errors.length).length,results},null,2)+'\n');
    console.log(`${row.id}: ${row.errors.length?'FAIL '+row.errors[0]:'pass'}`);
  }
}finally{await browser.close();}
if(results.some(row=>row.errors.length))process.exitCode=1;
