import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createNativeBrowser,sourceHashes,SOURCE} from './native-browser.mjs';
const args=process.argv.slice(2),value=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const out=path.resolve(value('--out','/tmp/pk-canvas-ellipsis')),source=path.resolve(value('--source',SOURCE));
assert.ok(!fs.existsSync(out),'Use a fresh output directory');fs.mkdirSync(out,{recursive:true});
const report={sourceReceipt:sourceHashes(source),results:[],errors:[]},browser=await createNativeBrowser({source}),page=await browser.newPage();
report.testedSourceReceipt=page.sourceHashes;
try{
  assert.equal(report.testedSourceReceipt.aggregate,report.sourceReceipt.aggregate,'Source changed before native clone');
  await page.play({aspect:'1:1',style:'noir',brand:{name:'Test'},scenes:[{type:'title',text:'Test',beats:3}]});
  report.results=await page.evaluate(async()=>{
    const {truncateCanvasLine}=await import(new URL('lib/components/design-system.mjs',document.baseURI));
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=700;
    const g=canvas.getContext('2d'),rows=[];g.fillStyle='#101820';g.fillRect(0,0,900,700);
    const copies=['Worldwide workflow management','Широкое имя файла целиком.png','Cafe\u0301 au lait review','Family 👩‍👩‍👧‍👦 workspace','🇩🇪 Berlin workspace'];
    const loadedFonts={};
    for(const font of ['Geist','Archivo']){
      const faces=await document.fonts.load(`500 36px "${font}"`,copies.join(' '));
      loadedFonts[font]=faces.map(face=>({family:face.family,status:face.status,unicodeRange:face.unicodeRange}));
    }
    await document.fonts.ready;
    let y=55;
    for(const font of ['Geist','Archivo'])for(const fullText of copies){
      g.font=`500 36px "${font}"`;g.letterSpacing='0.09px';const originalFont=g.font,originalTracking=g.letterSpacing;
      const width=230,result=truncateCanvasLine(g,fullText,width),whole=truncateCanvasLine(g,fullText,1800);
      const clusters=[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(fullText)].map(x=>x.segment);
      const prefixes=clusters.map((_,i)=>clusters.slice(0,i+1).join(''));
      const maximalPrefix=['',...prefixes].filter(prefix=>g.measureText(prefix+'…').width<=width).at(-1);
      g.fillStyle='#f6f6ef';g.fillText(result.text,30,y);y+=62;
      rows.push({font,expectedFullText:fullText,limit:width,...result,measured:g.measureText(result.text).width,whole,
        fontReady:document.fonts.check(originalFont,fullText),fontUnchanged:g.font===originalFont,trackingUnchanged:g.letterSpacing===originalTracking,
        maximalText:maximalPrefix+'…',graphemeSafe:!result.truncated||result.text==='…'||prefixes.includes(result.text.slice(0,-1))});
    }
    let invalidWidth=false,tooNarrow=false;try{truncateCanvasLine(g,'text',0);}catch{invalidWidth=true;}
    try{truncateCanvasLine(g,'text',1);}catch{tooNarrow=true;}
    const empty=truncateCanvasLine(g,'',100);
    window.__canvasEllipsisProof=canvas;
    return {rows,invalidWidth,tooNarrow,empty,loadedFonts};
  });
  for(const [font,faces]of Object.entries(report.results.loadedFonts))assert.ok(faces.length&&faces.every(face=>face.status==='loaded'),`${font}: expected loaded font faces`);
  for(const r of report.results.rows){assert.ok(r.truncated&&r.text.endsWith('…'));assert.ok(r.width<=230&&r.measured<=230);
    assert.ok(r.graphemeSafe&&r.fontReady&&r.fontUnchanged&&r.trackingUnchanged);
    assert.equal(r.fullText,r.expectedFullText);assert.equal(r.text,r.maximalText);
    assert.equal(r.whole.text,r.expectedFullText);assert.equal(r.whole.truncated,false);}
  assert.ok(report.results.invalidWidth&&report.results.tooNarrow);assert.equal(report.results.empty.text,'');
  const png=await page.evaluate(()=>window.__canvasEllipsisProof.toDataURL('image/png').split(',')[1]);
  fs.writeFileSync(path.join(out,'native-canvas.png'),Buffer.from(png,'base64'));
  assert.deepEqual(page.errors,[]);
  assert.deepEqual(page.externalRequests,[]);
}catch(e){report.errors.push(String(e.stack??e));}finally{await browser.close();}
report.sourceStable=report.sourceReceipt.aggregate===sourceHashes(source).aggregate;report.passed=report.errors.length===0&&report.sourceStable;
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('canvas ellipsis',report.passed?'pass':'FAIL');
if(!report.passed)process.exitCode=1;
