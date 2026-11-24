// At the valid field limits, every complete code line must remain readable and
// reach a visible page. Reverse native seeks must restore exactly the same DOM.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createNativeBrowser} from './native-browser.mjs';
import {measureRenderedText,layoutFindings} from './quality-layout.mjs';
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'/tmp/pk-native-code-pages';
fs.mkdirSync(out,{recursive:true});
const lines=Array.from({length:14},(_,i)=>`const value${String(i+1).padStart(2,'0')} = "${'unbroken_identifier_'.repeat(5)}`.slice(0,67)+'";');
const browser=await createNativeBrowser(),page=await browser.newPage(),results=[];
try{
  for(const aspect of ['9:16','1:1','16:9'])for(const font of ['Geist Mono','Geist']){
    const {plan}=await page.play({aspect,style:'editorial',music:{bpm:90},grain:false,sparks:false,brand:{name:'Code',font},scenes:[{type:'code',beats:8,title:'production_configuration.json',lines}]});
    const ps=plan.scenes[0],margin=plan.safe;
    await page.shoot(ps.dur*.9);
    const proof=await page.evaluate(fn=>{
      const measure=(0,eval)(`(${fn})`),s=window.__pkScenes.s1,win=s.root.querySelector('[data-code-pages]'),count=Number(win.dataset.codePageCount),shots=[];
      for(let target=0;target<count;target++){
        let lo=0,hi=s.duration*.85;
        if(target<count-1){for(let i=0;i<32;i++){const mid=(lo+hi)/2;s.drawAt(mid);if(Number(win.dataset.codePage)>target)hi=mid;else lo=mid;}}
        else lo=hi;
        s.drawAt(lo);shots.push({page:Number(win.dataset.codePage),at:lo,
          rows:[...s.root.querySelectorAll('[data-code-line]')].filter(row=>getComputedStyle(row).display!=='none').map(row=>({index:Number(row.dataset.codeLine),text:row.lastElementChild.textContent})),
          texts:measure(s.sceneRoot)});
      }
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),computed=getComputedStyle(s.root.querySelector('[data-code-line] span:last-child'));
      ctx.font=`${computed.fontWeight} 100px ${computed.fontFamily}`;
      const widths={family:computed.fontFamily,narrow:ctx.measureText('iiiiiiii').width,wide:ctx.measureText('WWWWWWWW').width};
      const snapshots=[];
      for(const at of [.2,.75,.45,.9,.45]){s.drawAt(s.duration*at);snapshots.push(s.sceneRoot.outerHTML);}
      return {count,shots,widths,reverseEqual:snapshots[2]===snapshots[4]};
    },measureRenderedText.toString());
    if(font==='Geist Mono')assert.ok(Math.abs(proof.widths.narrow-proof.widths.wide)<.01,'Actual loaded Mono glyph advances must be equal');
    assert.ok(proof.count>1,'Maximum input must paginate instead of shrinking');assert.ok(proof.reverseEqual,'Reverse seek must restore the page, text and caret');
    assert.deepEqual(proof.shots.map(x=>x.page),Array.from({length:proof.count},(_,i)=>i));
    const seen=new Map(proof.shots.flatMap(shot=>shot.rows.map(row=>[row.index,row.text])));
    assert.deepEqual([...seen.entries()].sort((a,b)=>a[0]-b[0]).map(x=>x[1]),lines,'Every supplied line must become fully visible');
    const bounds={width:plan.width,height:plan.height,floor:plan.type.label,safe:{left:plan.width*margin.left,top:plan.height*margin.top,right:plan.width*(1-margin.right),bottom:plan.height*(1-margin.bottom)}};
    for(const shot of proof.shots)assert.deepEqual(layoutFindings(shot.texts,bounds),[],`Complete code page ${shot.page} must be readable`);
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
    results.push({aspect,font,...proof});console.log(`${aspect}/${font}: ${proof.count} readable complete pages, reverse seek passes`);
  }
}finally{await browser.close();}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'pk-native-code-pages-v1',sourceReceipt:page.sourceHashes,results},null,2)+'\n');
