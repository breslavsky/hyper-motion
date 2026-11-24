// Merge explicitly ordered acceptance receipts. The last supplied result wins,
// including failures: a later failed regression must never be hidden by an old pass.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceHashes} from './migration-browser.mjs';
const args=process.argv.slice(2),outAt=args.indexOf('--out');
const output=outAt<0?'/tmp/pk-native-coverage.json':args[outAt+1];
if(outAt>=0)args.splice(outAt,2);
if(!args.length)throw new Error('Supply acceptance report paths in chronological supersession order');
const expected=JSON.parse(execFileSync(process.execPath,[path.join(path.dirname(fileURLToPath(import.meta.url)),'migration-accept.mjs'),'--extended','--list'],{encoding:'utf8'}));
const cases=new Map(),reports=[],current=sourceHashes();
for(const input of args){
  const file=path.resolve(input),report=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!report.sourceReceipt?.native?.files)throw new Error(`No native source receipt in ${file}`);
  const differences=Object.keys({...report.sourceReceipt.native.files,...current.files}).filter(name=>report.sourceReceipt.native.files[name]!==current.files[name]);
  reports.push({file,sourceReceipt:report.sourceReceipt,changesAgainstCurrent:differences,completed:report.completed,total:report.total,selection:report.selection??null});
  for(const row of report.results??[])cases.set(row.id,{...row,report:file,sourceAggregate:report.sourceReceipt.native.aggregate});
}
const selected=expected.map(entry=>cases.get(entry.id)??{id:entry.id,errors:['Case has no supplied acceptance receipt'],missing:true});
const failures=selected.filter(row=>row.errors?.length),missing=selected.filter(row=>row.missing);
const result={schema:'pk-native-coverage-v1',expected:expected.length,covered:selected.length-missing.length,passed:selected.filter(row=>!row.errors?.length).length,failed:failures.length,missing:missing.map(row=>row.id),currentSource:current,
  note:'Coverage combines explicit immutable source receipts. Later supplied results supersede earlier ones by case ID. Source differences remain listed; this is not a claim that every historical case was rerun on one final snapshot.',reports,cases:selected};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(`${result.passed}/${result.expected} passed; ${missing.length} missing; ${failures.length} failed. ${output}`);
for(const row of failures)console.log(`${row.id}: ${row.errors[0].split('\n')[0]}`);
if(failures.length)process.exitCode=1;
