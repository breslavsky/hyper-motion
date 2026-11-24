// One CI entry point for the complete single-line policy. Native runners reuse
// their browser across a matrix; each subreport remains independently reviewable.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const scope=JSON.parse(fs.readFileSync(path.join(here,'ellipsis-scope.json')));
export const aspects=['9:16','1:1','16:9'];
const branchIds=['chart-bar','chart-line','chart-pie','chart-story-bars','chart-story-line','chart-story-donut','chart-story-progress','chart-story-donut-center','pullback-mention'];
const surfaceIds=['drag-demo','drag-short','drag-max','scan-demo','scan-max','scan-busy-only','scan-done-only'];
const fitterIds=['good','marker-only','missing-marker','wrapped','no-ellipsis','unclipped','two-lines','clipped-two-lines','empty-width','empty-height','clip-overflow','outside-frame','ancestor-clip','flex-formatting'];
const geometryCanaries=['valid','rotated','wrapping','plain-clip','tall','flex','ancestor-clip','stage-crop','stage-and-ancestor-clip'];
const caseKeys=(values,fonts)=>aspects.flatMap(aspect=>fonts?fonts.flatMap(font=>values.map(value=>`${value}|${aspect}|${font}`)):values.map(value=>`${value}|${aspect}`));

export function suiteManifest(){
  const types=scope.components.filter(component=>component.policy!=='preserved').map(component=>component.type);
  assert.equal(types.length,new Set(types).size,'Duplicate ellipsis scope');
  assert.ok(types.length,'Empty ellipsis scope');
  return {schema:'pure-kinetic.ellipsis-suite-plan.v1',aspects,types,
    comparison:{kind:'same-source-native-build',historicalBeforeAfter:false,
      contract:'Native built project timeline/audio must equal the compiler from this same source. This is build parity, not a pre-change comparison.'},
    jobs:[
      {id:'catalog-normal',kind:'catalog',font:'Geist',long:false,total:types.length*3},
      {id:'catalog-max',kind:'catalog',font:'Archivo',long:true,total:types.length*3},
      {id:'branches-ellipsis',kind:'branches',geometry:false,total:branchIds.length*3},
      {id:'branches-geometry',kind:'branches',geometry:true,total:branchIds.length*3},
      {id:'canvas',kind:'canvas',total:10},
      {id:'fitter',kind:'fitter',total:fitterIds.length,pixelControls:2},
      {id:'hud',kind:'hud',total:6},
      {id:'surface-motion',kind:'surface',total:surfaceIds.length*3*2},
    ]};
}

function exact(actual,expected,message){assert.deepEqual([...actual].sort(),[...expected].sort(),message);}
export function validateChild(job,report,aggregate,manifest=suiteManifest()){
  assert.equal(report.passed,true,`${job.id}: native gate failed`);
  assert.equal(report.sourceStable,true,`${job.id}: source drift`);
  assert.equal(report.sourceReceipt?.aggregate,aggregate,`${job.id}: wrong source`);
  if(job.kind!=='branches')assert.equal(report.testedSourceReceipt?.aggregate,aggregate,`${job.id}: missing/wrong native clone`);
  for(const receipt of [report.testedSourceReceipt,report.sourceAfter].filter(Boolean))
    assert.equal(receipt.aggregate,aggregate,`${job.id}: clone/final source drift`);
  if(report.completed!==undefined)assert.equal(report.completed,job.total,`${job.id}: incomplete native matrix`);
  if(report.total!==undefined)assert.equal(report.total,job.total,`${job.id}: changed native scope`);
  if(report.failed!==undefined)assert.equal(report.failed,0);
  if(report.errors)assert.deepEqual(report.errors,[]);
  const rows=job.kind==='canvas'?report.results.rows:report.results;
  assert.equal(rows.length,job.total,`${job.id}: missing/extra cases`);
  if(['catalog','branches','surface','hud'].includes(job.kind))for(const row of rows){
    assert.equal(row.passed,true,row.id);assert.equal(row.reverseExact,true,`${row.id}: missing reverse seek proof`);
  }
  if(job.kind==='catalog'){
    exact(rows.map(row=>`${row.type}|${row.aspect}`),caseKeys(manifest.types),'Catalog scope changed');
    assert.equal(report.font,job.font);assert.equal(report.long,job.long);
    for(const row of rows){
      assert.equal(row.planUnchanged,true);assert.equal(row.findingCount,0);
      assert.ok(row.samples>=16);assert.ok(row.visibleLeaves+row.rasterLeaves>0);
    }
    if(job.long)assert.ok(rows.some(row=>row.truncatedLeaves>0),'Long matrix never truncates');
  }else if(job.kind==='branches'){
    exact(rows.map(row=>`${row.branch}|${row.aspect}`),caseKeys(branchIds),'Branch scope changed');
    for(const row of rows){
      assert.equal(row.sourceStable,true);assert.deepEqual(row.branchCoverage,[]);
      if(!job.geometry){assert.equal(row.planUnchanged,true);assert.equal(row.findingCount,0);assert.ok(row.samples>=16);}
      else {assert.deepEqual(row.layoutFindings,[]);assert.deepEqual(row.surfaceFindings,[]);assert.deepEqual(row.designFindings,[]);assert.equal(row.frames.length,5);}
    }
    if(!job.geometry)for(const row of rows.filter(row=>row.branch==='chart-story-donut-center'))
      assert.ok(row.truncatedFields.includes('callout-label'),'Center label must actually truncate');
    if(job.geometry){
      exact(Object.keys(report.nativeCalibrations??{}),branchIds,'Missing real-browser geometry controls');
      for(const calibration of Object.values(report.nativeCalibrations)){
        for(const key of ['roomDoesNotEnlarge','tinyBoundsRejected','copyPreserved','illustrationMarkerCannotHideLabels','rasterDriftDetected'])assert.equal(calibration[key],true,key);
        exact(calibration.ellipsis.map(row=>row.id),geometryCanaries,'Missing rendered ellipsis canary');
        for(const row of calibration.ellipsis){
          assert.equal(row.stylesRestored,true);
          assert.equal(row.issues.length===0,['valid','rotated'].includes(row.id),row.id);
          assert.equal(row.worldIssues.length===0,['valid','rotated','stage-crop'].includes(row.id),row.id);
        }
      }
    }
  }else if(job.kind==='fitter'){
    exact(rows.map(row=>row.id),fitterIds,'Missing geometry negative control');
    assert.equal(report.auditContractPassed,true);
    for(const row of rows){assert.equal(row.passed,true);assert.equal(row.fitBoxes>0,row.expectedFitBox);}
    exact(report.pixelControls.map(row=>row.display),['block','flex'],'Missing actual pixel negative control');
    for(const row of report.pixelControls){assert.equal(row.passed,true);assert.equal(row.ellipsisChangesPixels,row.display==='block');}
  }else if(job.kind==='canvas'){
    assert.equal(report.results.invalidWidth,true);assert.equal(report.results.tooNarrow,true);assert.equal(report.results.empty.text,'');
    exact(rows.map(row=>row.font),Array(5).fill('Geist').concat(Array(5).fill('Archivo')),'Canvas font scope');
    for(const row of rows){
      for(const flag of ['fontReady','fontUnchanged','trackingUnchanged','graphemeSafe','truncated'])assert.equal(row[flag],true,flag);
      assert.equal(row.fullText,row.expectedFullText);assert.equal(row.text,row.maximalText);
      assert.equal(row.whole.text,row.fullText);assert.equal(row.whole.truncated,false);
      assert.ok(row.measured<=row.limit&&row.width<=row.limit);
    }
  }else if(job.kind==='hud'){
    exact(rows.map(row=>`${row.name==='Nook'?'short':'long'}|${row.aspect}`),caseKeys(['short','long']),'HUD matrix');
    for(const row of rows){assert.equal(row.samples,6);if(row.name!=='Nook')assert.equal(row.truncates,true);}
  }else if(job.kind==='surface'){
    exact(rows.map(row=>`${row.case}|${row.aspect}|${row.font}`),caseKeys(surfaceIds,['Geist','Archivo']),'Dense motion scope');
    for(const row of rows){
      assert.equal(row.planUnchanged,true);assert.equal(row.findingCount,0);assert.ok(row.samples>=150);
      if(row.case==='drag-short'||row.case==='drag-max'){
        assert.equal(row.fitComparedTo,'drag-demo');assert.equal(row.projectedFontComparedTo,'drag-demo');
        assert.equal(row.filenames.expected,row.case==='drag-short'?'fit':'truncate');
        assert.ok(row.filenames.visibleSamples>0);
        assert.ok(row.case==='drag-short'?row.filenames.truncatedSamples===0:row.filenames.truncatedSamples>0);
      }
    }
  }
  return {cases:rows.length,pixelControls:report.pixelControls?.length??0};
}

export async function run({out,source=path.resolve(here,'../source')}={}){
  assert.ok(out&&!fs.existsSync(out),'An explicit fresh output directory is required');fs.mkdirSync(out,{recursive:true});
  const {sourceHashes}=await import('./native-browser.mjs');
  const manifest=suiteManifest(),report={schema:'pure-kinetic.ellipsis-suite-native.v1',...manifest,
    sourceReceipt:sourceHashes(source),results:[],passed:false};
  report.schema='pure-kinetic.ellipsis-suite-native.v1';
  const write=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  write();
  for(const job of manifest.jobs){
    const directory=path.join(out,job.id),row={id:job.id,report:`${job.id}/report.json`,passed:false};
    try{
      let child;
      if(job.kind==='catalog')child=await (await import('./ellipsis-catalog-native.mjs')).run({out:directory,source,baseline:source,types:manifest.types,aspects,font:job.font,long:job.long});
      else if(job.kind==='branches'){
        child=await (await import('./ellipsis-branches-native.mjs')).run({out:directory,source,baseline:source,aspects,geometry:job.geometry});
        if(job.geometry){
          child.nativeCalibrations=Object.fromEntries(branchIds.map(id=>[id,JSON.parse(fs.readFileSync(path.join(directory,id,'report.json'))).calibration]));
          fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify(child,null,2)+'\n');
        }
      }else if(job.kind==='fitter')child=await (await import('./ellipsis-fitter-native.mjs')).run({out:directory,source});
      else if(job.kind==='surface')child=await (await import('./surface-motion-regressions-native.mjs')).run({out:directory,source,baseline:source,aspects});
      else {
        const filename=job.kind==='canvas'?'canvas-ellipsis-native.mjs':'ellipsis-hud-native.mjs';
        const processResult=spawnSync(process.execPath,[path.join(here,filename),'--out',directory,'--source',source],{encoding:'utf8',timeout:300000});
        fs.writeFileSync(path.join(out,`${job.id}.log`),(processResult.stdout??'')+(processResult.stderr??''));
        assert.equal(processResult.status,0,`${filename}: ${processResult.error??processResult.stderr}`);
        child=JSON.parse(fs.readFileSync(path.join(directory,'report.json')));
      }
      Object.assign(row,validateChild(job,child,report.sourceReceipt.aggregate,manifest),{passed:true});
    }catch(error){row.error=String(error.stack??error);}
    report.results.push(row);write();console.log(`${job.id}: ${row.passed?'PASS':row.error}`);
  }
  report.sourceAfter=sourceHashes(source);report.sourceStable=report.sourceAfter.aggregate===report.sourceReceipt.aggregate;
  report.completed=report.results.length;report.total=manifest.jobs.length;
  report.cases=report.results.reduce((sum,row)=>sum+(row.cases??0),0);
  report.passed=report.sourceStable&&report.completed===report.total&&report.results.every(row=>row.passed);
  write();return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),value=name=>args.includes(`--${name}`)?args[args.indexOf(`--${name}`)+1]:undefined;
  if(args.includes('--list'))console.log(JSON.stringify(suiteManifest()));
  else {
    assert.ok(value('out')&&!value('out').startsWith('--'),'Usage: node tools/ellipsis-suite-native.mjs --out <fresh-directory> [--source <source-directory>]');
    const report=await run({out:path.resolve(value('out')),...(value('source')?{source:path.resolve(value('source'))}:{})});
    if(!report.passed)process.exitCode=1;
  }
}
