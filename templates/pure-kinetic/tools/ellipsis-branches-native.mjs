// Branches absent from the main catalog's one-scene-per-type fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {run as runCatalog} from './ellipsis-catalog-native.mjs';
import {run as runGeometry} from './catalog-design-native.mjs';
import {maximumScene} from './quality-layout.mjs';
import {SOURCE,sourceHashes} from './migration-browser.mjs';

export function branchFixtures(){
  const chart=maximumScene('chart'),story=maximumScene('chart-story');
  chart.labels=chart.labels.map(()=> 'Ш'.repeat(12));
  story.items=story.items.map(item=>({...item,label:'Ш'.repeat(20)}));
  return [
    ...['bar','line','pie'].map(kind=>({id:`chart-${kind}`,expectTruncation:true,scene:{...structuredClone(chart),kind}})),
    ...['bars','line','donut','progress'].map(kind=>({id:`chart-story-${kind}`,expectTruncation:true,...(kind==='progress'?{expectedTruncatedLeavesByAspect:{'16:9':0},expectedVisibleLeavesByAspect:{'16:9':5}}:{}),scene:{...structuredClone(story),chart:kind}})),
    {id:'chart-story-donut-center',expectTruncation:true,expectedTruncatedFields:['callout-label'],
      scene:{type:'chart-story',beats:8,chart:'donut',unit:'',items:[{label:'Ш'.repeat(20),value:1},{label:'Ш'.repeat(20),value:2}],emphasize:2}},
    {id:'pullback-mention',scene:{...maximumScene('pullback'),text:'@WorldwideWorkflow review the complete project and prepare the next release'}},
  ];
}

export function branchCoverageFindings(fixture,row){
  const findings=[];
  const exactTruncated=fixture.expectedTruncatedLeavesByAspect?.[row.aspect],exactVisible=fixture.expectedVisibleLeavesByAspect?.[row.aspect];
  if(exactTruncated!==undefined){
    if(row.truncatedLeaves!==exactTruncated)findings.push(`Expected ${exactTruncated} truncated leaves; saw ${row.truncatedLeaves}`);
  }else if(fixture.expectTruncation&&!(row.truncatedLeaves>0))findings.push('No rendered leaf actually truncated');
  if(exactVisible!==undefined&&row.visibleLeaves!==exactVisible)findings.push(`Expected ${exactVisible} visible leaves; saw ${row.visibleLeaves}`);
  for(const field of fixture.expectedTruncatedFields??[])if(!row.truncatedFields?.includes(field))
    findings.push(`Required field did not render truncation: ${field}`);
  return findings;
}

export async function run({out,source=SOURCE,baseline,aspects=['9:16','1:1','16:9'],font='Archivo',geometry=false,branches}={}){
  assert.ok(out&&!fs.existsSync(out),'Use a fresh output directory');
  assert.ok(geometry||(baseline&&fs.existsSync(path.join(baseline,'lib/compiler/plan.cjs'))),'An existing baseline source is required for plan/audio parity');
  fs.mkdirSync(out,{recursive:true});
  const allFixtures=branchFixtures(),fixtures=allFixtures.filter(f=>!branches||branches.includes(f.id));
  assert.ok(fixtures.length>0&&(!branches||branches.every(id=>allFixtures.some(f=>f.id===id))),'Unknown or empty branch selection');
  const report={schema:'pure-kinetic.ellipsis-branches-native.v1',sourceReceipt:sourceHashes(source),
    baseline,aspects,font,mode:geometry?'geometry':'ellipsis',planParityRequired:!geometry,fixtures,total:fixtures.length*aspects.length,results:[]};
  const write=()=>{
    report.completed=report.results.length;report.failed=report.results.filter(row=>!row.passed).length;
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  };
  for(const fixture of fixtures){
    const result=await (geometry?runGeometry:runCatalog)({out:path.join(out,fixture.id),source,baseline:geometry?false:baseline,aspects,font,long:true,
      types:[fixture.scene.type],sceneOverrides:{[fixture.scene.type]:fixture.scene}});
    report.results.push(...result.results.map(row=>{
      const branchCoverage=geometry?[]:branchCoverageFindings(fixture,row);
      return {...row,id:`${fixture.id}-${row.aspect.replace(':','x')}`,branch:fixture.id,sourceStable:result.sourceStable,branchCoverage,passed:row.passed&&branchCoverage.length===0};
    }));
    write();
  }
  report.sourceAfter=sourceHashes(source);report.sourceStable=report.sourceReceipt.aggregate===report.sourceAfter.aggregate;
  report.passed=report.sourceStable&&report.completed===report.total&&report.results.every(row=>row.passed&&row.sourceStable&&(geometry||row.planUnchanged));
  write();return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=name=>args.includes(`--${name}`)?args[args.indexOf(`--${name}`)+1]:undefined;
  assert.ok(option('out')&&(option('baseline')||args.includes('--geometry')),'Usage: node tools/ellipsis-branches-native.mjs --out <fresh-directory> (--baseline <source> | --geometry) [--source <source>] [--font Archivo] [--branches id,id]');
  const report=await run({out:path.resolve(option('out')),source:path.resolve(option('source')??SOURCE),
    baseline:option('baseline')?path.resolve(option('baseline')):undefined,font:option('font')??'Archivo',geometry:args.includes('--geometry'),branches:option('branches')?.split(',')});
  console.log(`${report.mode} branches: ${report.completed-report.failed}/${report.total}; ${report.passed?'pass':'FAIL'}`);
  if(!report.passed)process.exitCode=1;
}
