// Native composite font families must paint their bundled glyphs, not fall back.
// node tools/quality-fonts.mjs --out /tmp/pk-quality-fonts
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNativeBrowser} from './migration-browser.mjs';

const args=process.argv.slice(2),out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'/tmp/pk-quality-fonts');
fs.mkdirSync(out,{recursive:true});
const fonts={
  'Geist':{latin:'Geist-Variable.woff2',cyrillic:'Geist-Variable.woff2',arabic:'cairo-arabic-normal.woff2'},
  'Geist Mono':{latin:'GeistMono-Variable.woff2',cyrillic:'GeistMono-Variable.woff2',arabic:'cairo-arabic-normal.woff2'},
  'Archivo':{latin:'Archivo-Variable.woff2',cyrillic:'onest-cyrillic-normal.woff2',arabic:'cairo-arabic-normal.woff2'},
  'Instrument Serif':{latin:'InstrumentSerif-Regular.woff2',cyrillic:'lora-cyrillic-normal.woff2',arabic:'amiri-arabic-normal-400.woff2'},
};
const samples={latin:'Wim',cyrillic:'Ширина',arabic:'مرحبا'};
const browser=await createNativeBrowser(),page=await browser.newPage(),results=[];
const fontReceipt=Object.fromEntries([...new Set(Object.values(fonts).flatMap(Object.values))].sort().map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(page.project,'lib/fonts',file))).digest('hex')]));
try{
  await page.play({aspect:'1:1',style:'editorial',brand:{name:'Nook'},scenes:[{type:'title',text:'Fonts stay on brand',beats:3}]});
  for(const [family,files]of Object.entries(fonts))for(const [script,text]of Object.entries(samples))for(const weight of family==='Instrument Serif'?[400]:[400,700]){
    const row=await page.evaluate(async(family,script,text,file,weight)=>{
      const alias=`QualityDirect${family.replaceAll(' ','')}${script}${weight}`;
      const face=new FontFace(alias,`url(lib/fonts/${file})`,{weight:String(weight),...(family==='Archivo'?{stretch:'62% 125%'}:{})});
      await face.load();document.fonts.add(face);
      await document.fonts.load(`${weight} 64px "${family}"`,text);
      const measure=name=>{
        const c=document.createElement('canvas').getContext('2d');c.font=`${weight} 64px "${name}"`;
        const m=c.measureText(text);return {width:m.width,left:m.actualBoundingBoxLeft,right:m.actualBoundingBoxRight,ascent:m.actualBoundingBoxAscent,descent:m.actualBoundingBoxDescent};
      };
      return {family,script,text,file,weight,native:measure(family),direct:measure(alias)};
    },family,script,text,files[script],weight);
    row.errors=[];
    for(const key of Object.keys(row.native))if(Math.abs(row.native[key]-row.direct[key])>.01)row.errors.push(`${key}: native ${row.native[key]} != bundled ${row.direct[key]}`);
    results.push(row);console.log(family,script,weight,row.errors.length?'FAIL':'pass');
  }
  assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
}finally{
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'pure-kinetic.quality-fonts.v1',sourceReceipt:page.sourceHashes,fontReceipt,total:21,completed:results.length,failedCases:results.filter(r=>r.errors.length).length,results},null,2)+'\n');
  await browser.close();
}
if(results.some(r=>r.errors.length))process.exitCode=1;
