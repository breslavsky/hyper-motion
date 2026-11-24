// Run pinned lint and full native checks; keep every diagnostic alongside the receipt.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildProject} from '../build.mjs';
import {components,formats} from '../catalog.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.resolve(root,'../..');
const cli=path.join(repo,'kit/node_modules/.bin/hyperframes');
const version=JSON.parse(fs.readFileSync(path.join(path.dirname(cli),'../hyperframes/package.json'))).version;
if(version!=='0.9.19')throw new Error(`Expected HyperFrames 0.9.19, found ${version}`);
if(!process.argv[2])throw new Error('Usage: node check-cli.mjs <output-directory> [case-regex]');
const output=path.resolve(process.argv[2]),filter=new RegExp(process.argv[3]??'.');
const jobs=Object.keys(components).flatMap(kind=>formats.map(aspect=>({id:`${kind}-${aspect.replace(':','x')}-base`,kind,aspect}))).filter(c=>filter.test(c.id));
if(!jobs.length)throw new Error('No CLI cases match the filter');
fs.mkdirSync(output,{recursive:true});
const results=[];let next=0;
async function run(command,args,folder){
  const started=performance.now();let stdout='',stderr='',timeout=false;
  const child=spawn(command,args,{cwd:folder,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  let hardKill;
  const timer=setTimeout(()=>{timeout=true;child.kill('SIGTERM');hardKill=setTimeout(()=>child.kill('SIGKILL'),5000);},180000);
  let exitCode;
  try{exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});}
  finally{clearTimeout(timer);clearTimeout(hardKill);}
  let json;try{json=JSON.parse(stdout);}catch{json=null;}
  return {command:[command,...args],exitCode,timeout,wallSeconds:(performance.now()-started)/1000,json,stdout,stderr};
}
function save(){fs.writeFileSync(path.join(output,'cli-results.json'),JSON.stringify({version,maxConcurrent:2,expectedCases:jobs.length,completeCases:results.length,results},null,2));}
async function worker(){
  while(next<jobs.length){
    const job=jobs[next++],project=path.join(output,'projects',job.id);
    if(fs.existsSync(path.join(project,'component-project.json')))fs.rmSync(project,{recursive:true});
    buildProject(project,{aspect:job.aspect,scenes:[{kind:job.kind,duration:4}]});
    const hashes=Object.fromEntries(['build.mjs','runtime.mjs','catalog.mjs',`scenes/${job.kind}.mjs`].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
    const lint=await run(cli,['lint','--json',project],project);
    const check=await run(cli,['check','--json','--samples','9','--budget','90s',project],project);
    results.push({...job,project,hashes,lint,check});save();
    console.log(JSON.stringify({id:job.id,lint:lint.json?.ok,check:check.json?.ok,timeout:check.timeout}));
  }
}
await Promise.all([worker(),worker()]);
if(results.some(r=>r.lint.exitCode!==0||!r.lint.json?.ok||r.check.exitCode!==0||!r.check.json?.ok))process.exitCode=1;
