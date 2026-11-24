// Generate the checked-in pilot receipt from native and CLI evidence.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {components,formats,durationRange,looks} from '../catalog.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [runDirectory,cliFile]=process.argv.slice(2);
if(!runDirectory||!cliFile)throw new Error('Usage: node summarize.mjs <accept-output> <cli-results.json>');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceNames=['build.mjs','catalog.mjs','runtime.mjs',...Object.keys(components).map(k=>`scenes/${k}.mjs`)];
const sourceHash=sha(sourceNames.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n'));
const cases=JSON.parse(fs.readFileSync(path.join(runDirectory,'cases.json')));
const native=cases.map(c=>JSON.parse(fs.readFileSync(path.join(runDirectory,'results/native',`${c.id}.json`))));
for(const r of native){assert.equal(r.passed,true,`${r.id} failed`);assert.equal(r.sourceHash,sourceHash,`${r.id} used different sources`);assert.equal(r.supplementalAudit?.passed,true,`${r.id} needs audit.mjs`);}
const cli=JSON.parse(fs.readFileSync(cliFile));
assert.equal(cli.results.length,Object.keys(components).length*formats.length);
for(const r of cli.results){
  assert.equal(r.lint.exitCode,0,r.id);assert.equal(r.lint.json.ok,true,r.id);
  assert.equal(r.check.exitCode,0,r.id);assert.equal(r.check.json.ok,true,r.id);
  for(const [file,hash] of Object.entries(r.hashes))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,`${r.id}: ${file} changed after CLI check`);
}
const warnings={};
for(const r of cli.results)for(const [section,part] of Object.entries(r.check.json))for(const f of part?.findings??[]){
  if(f.severity==='error')throw new Error(`${r.id}: unexpected ${section} error`);
  const key=`${section}:${f.severity}:${f.code}`;warnings[key]=(warnings[key]??0)+1;
}
const receipt={
  schemaVersion:1,generatedAt:new Date().toISOString(),status:'passed',hyperframes:'0.9.19',
  environment:{platform:process.platform,arch:process.arch,captureGpuModeRequested:'hardware',scope:'Local render host only; other workers and GPU drivers are not certified.'},
  sourceHash,sourceFiles:Object.fromEntries(sourceNames.map(f=>[f,sha(fs.readFileSync(path.join(root,f)))])),
  auditSha256:sha(fs.readFileSync(path.join(root,'tools/audit.mjs'))),
  matrix:{formats,variants:['4s Editorial EN','4s Loud EN','2s Editorial EN','8s Editorial EN','4s Editorial longer RU'],singleInstanceCases:cases.filter(c=>!['multi','mixed'].includes(c.variant)).length,sharedDefinitionCases:cases.filter(c=>c.variant==='multi').length,mixedFilmCases:cases.filter(c=>c.variant==='mixed').length},
  native:{passed:native.length,total:native.length,sampledFrames:native.reduce((n,r)=>n+r.samples.length,0),exactPixelRepeats:native.filter(r=>r.repeat.equal).length,
    equivalentRepeats:native.filter(r=>r.repeat.equivalent).length,maxAllowedChannelDelta:1,externalRequests:native.flatMap(r=>r.externalRequests).length,
    rasterRounding:native.filter(r=>!r.repeat.equal).map(r=>({id:r.id,maxChannelDelta:r.repeat.maxChannelDelta,changedPixels:r.repeat.changedPixels})),
    contentAndOverlapAudit:'passed'},
  cli:{lintPassed:cli.results.length,fullCheckPassed:cli.results.length,samplesPerCase:9,warnings},
  components:Object.fromEntries(Object.entries(components).map(([kind,c])=>[kind,{
    description:c.description,fields:c.fields,declaredDuration:durationRange,testedFormats:formats,testedDurationSamples:[2,4,8],testedLooks:Object.keys(looks),
    nativeCases:native.filter(r=>r.kind===kind).length,requiresWebGL2:kind==='phone3d',
    maxObservedSeekMs:Math.max(...native.filter(r=>r.kind===kind).map(r=>r.maxSeekMs)),
    limitations:kind==='chart'?['Nonnegative bars only; no line/pie/ring.']:kind==='phone3d'?['Generated screen UI only; arbitrary screen images need annotations.']:[],
  }])),
  limitations:['Character counts are input guards, not exhaustive fitted-text certificates.','Seek timings include capture-API overhead on a shared host, not a GPU benchmark.','Intentional entry frames and absent audio remain CLI warnings/information.']
};
fs.writeFileSync(path.join(root,'acceptance.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({native:receipt.native.passed,lint:receipt.cli.lintPassed,fullCheck:receipt.cli.fullCheckPassed,sourceHash}));
