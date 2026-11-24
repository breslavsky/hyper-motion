// Real browser calibration for the opt-in ellipsis fit boundary. A marker
// alone must not waive geometry; hidden source text must remain auditable.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser,sharp,sourceHashes,SOURCE} from './migration-browser.mjs';

async function installCanary(){
  const {createDom}=await import(new URL('lib/components/dom.mjs',document.baseURI));
  const {createDesignSystem}=await import(new URL('lib/components/design-system.mjs',document.baseURI));
  const dom=createDom({document}),D=createDesignSystem({S:1}),instance=window.__pkScenes.s1;
  const stage=document.createElement('div');instance.sceneRoot.append(stage);
  Object.assign(stage.style,{position:'absolute',inset:'0',background:'#102030',overflow:'hidden'});
  const label=document.createElement('div');stage.append(label);
  const text='Широкое имя файла целиком.png';
  function reset(){
    label.textContent=text;label.removeAttribute('style');label.removeAttribute('data-design-overflow');
    Object.assign(label.style,{position:'absolute',left:'100px',top:'100px',width:'150px',color:'#fff'});
    D.apply(label,'label');D.truncateLine(label);
  }
  const results=[];
  function sample(id,expectedFitBox){
    const entries=dom.textBoxes(stage);
    results.push({id,expectedFitBox,fitBoxes:entries.filter(r=>r.fitBox).length,entries,
      clientHeight:label.clientHeight,scrollHeight:label.scrollHeight,display:getComputedStyle(label).display});
  }
  reset();sample('good',true);
  reset();Object.assign(label.style,{whiteSpace:'normal',textOverflow:'clip',overflow:'visible'});sample('marker-only',false);
  reset();delete label.dataset.designOverflow;sample('missing-marker',false);
  reset();label.style.whiteSpace='normal';sample('wrapped',false);
  reset();label.style.textOverflow='clip';sample('no-ellipsis',false);
  reset();label.style.overflow='visible';sample('unclipped',false);
  reset();label.innerHTML='first<br>second';sample('two-lines',false);
  reset();label.innerHTML='first<br>second';label.style.height='48px';sample('clipped-two-lines',false);
  reset();label.style.width='0';sample('empty-width',false);
  reset();label.style.height='0';sample('empty-height',false);
  reset();label.style.overflow='clip';sample('clip-overflow',true);
  reset();label.style.left=`${instance.plan.width-40}px`;sample('outside-frame',true);
  reset();
  const ancestor=document.createElement('div');stage.append(ancestor);
  Object.assign(ancestor.style,{position:'absolute',left:'100px',top:'100px',width:'80px',height:'48px',overflow:'hidden'});
  ancestor.append(label);label.style.left='0';label.style.top='0';sample('ancestor-clip',true);
  stage.append(label);ancestor.remove();
  reset();label.style.display='flex';sample('flex-formatting',false);
  const frame=stage.getBoundingClientRect();
  window.__ellipsisFitterCanary={label,reset};
  return {results,originalText:text,frame:{left:frame.left,right:frame.right,width:frame.width}};
}

export async function run({out,source=SOURCE}={}){
  assert.ok(typeof out==='string'&&out.length,'An explicit fresh output directory is required');
  assert.ok(!fs.existsSync(out),`Output directory already exists: ${out}`);
  fs.mkdirSync(out,{recursive:true});
  const report={schema:'pure-kinetic.ellipsis-fitter-native.v1',sourceReceipt:sourceHashes(source),
    policy:{geometry:'Real DOM textBoxes; original ink and seen are retained; fitting uses the complete label rectangle.',
      pixelControl:'Compare decoded screenshot pixels for text-overflow:ellipsis versus clip in block and flex contexts.'},
    results:[],pixelControls:[],errors:[],passed:false};
  let browser;
  try{
    browser=await createNativeBrowser({source});const page=await browser.newPage();
    report.testedSourceReceipt=page.sourceHashes;
    assert.equal(report.testedSourceReceipt.aggregate,report.sourceReceipt.aggregate,'Source changed before native clone');
    await page.play({aspect:'1:1',style:'noir',grain:false,sparks:false,brand:{name:'Canary',font:'Geist'},
      scenes:[{type:'title',text:'Canary',beats:4}]});
    const measured=await page.evaluate(installCanary);
    report.results=measured.results.map(row=>({...row,passed:(row.fitBoxes>0)===row.expectedFitBox}));
    for(const row of report.results)assert.equal(row.passed,true,`Unexpected fit boundary: ${row.id}`);
    const entry=id=>report.results.find(row=>row.id===id).entries[0];
    const outside=entry('outside-frame');
    assert.ok(outside.fitBox.x+outside.fitBox.w>measured.frame.right,'Fitting must preserve the outside-frame label boundary');
    const ancestor=entry('ancestor-clip');
    assert.ok(ancestor.fitBox.w>80,'Fitting must preserve the label width beyond an ancestor clip');
    assert.ok(ancestor.seen<1,'Ancestor clipping must remain visible to audits');
    const good=entry('good');
    assert.equal(good.text,measured.originalText,'Full source text must be retained');
    assert.ok(good.seen<1,'Hidden source glyphs must remain reflected in seen');
    assert.ok(good.w>good.fitBox.w,'Raw glyph bounds must remain separate from the visible fit boundary');
    report.auditContractPassed=true;

    for(const display of ['block','flex']){
      await page.evaluate(display=>{
        const canary=window.__ellipsisFitterCanary;canary.reset();canary.label.style.display=display;
      },display);
      const ellipsis=Buffer.from(await page.screenshot());
      await page.evaluate(()=>window.__ellipsisFitterCanary.label.style.textOverflow='clip');
      const clip=Buffer.from(await page.screenshot());
      fs.writeFileSync(path.join(out,`${display}-ellipsis.png`),ellipsis);
      fs.writeFileSync(path.join(out,`${display}-clip.png`),clip);
      const [ellipsisPixels,clipPixels]=await Promise.all([ellipsis,clip].map(image=>sharp(image).ensureAlpha().raw().toBuffer()));
      const ellipsisChangesPixels=!ellipsisPixels.equals(clipPixels),expected=display==='block';
      report.pixelControls.push({display,ellipsisChangesPixels,expected,passed:ellipsisChangesPixels===expected});
      assert.equal(ellipsisChangesPixels,expected,`Unexpected painted ellipsis behavior in ${display}`);
    }
    assert.deepEqual(page.errors,[],'Native browser errors');
    assert.deepEqual(page.externalRequests,[],'Unexpected external requests');
    report.nativeReceipts=browser.receipts;
  }catch(error){
    report.errors.push(String(error.stack??error));
  }finally{
    if(browser)try{await browser.close();}catch(error){report.errors.push(String(error.stack??error));}
    report.sourceAfter=sourceHashes(source);report.sourceStable=report.sourceReceipt.aggregate===report.sourceAfter.aggregate;
    report.completed=report.results.length;report.failed=report.results.filter(row=>!row.passed).length;
    report.passed=report.errors.length===0&&report.sourceStable&&report.completed===14&&report.failed===0&&
      report.auditContractPassed===true&&report.pixelControls.length===2&&report.pixelControls.every(row=>row.passed);
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  }
  return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=name=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:undefined;
  const output=option('out');assert.ok(output&&!output.startsWith('--'),'Usage: node tools/ellipsis-fitter-native.mjs --out <fresh-directory> [--source <source-directory>]');
  const report=await run({out:path.resolve(output),source:path.resolve(option('source')??SOURCE)});
  console.log(`ellipsis fitter: ${report.completed-report.failed}/${report.completed} geometry, ${report.pixelControls.filter(row=>row.passed).length}/2 pixel controls; ${report.passed?'pass':'FAIL'}`);
  if(!report.passed){console.error(report.errors.join('\n')||'Source changed or acceptance was incomplete');process.exitCode=1;}
}
