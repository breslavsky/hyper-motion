// Create a small, source-verified receipt from the retained raw QA and exports.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const SOURCE=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(process.argv[2]??'/tmp/pk-ui-world-prototype');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const summary=read('qa/summary.json');
for(const [file,expected] of Object.entries(summary.sourceHashes))if(hash(path.join(SOURCE,file))!==expected)throw new Error(`Stale evidence: ${file}`);
const cases=summary.native.map(c=>read(`qa/${c.id}.json`));
const cli=read('qa/cli-results.json');
const audio=read('render-audio-verification.json');
const videos=read('video-verification.json');
for(const [format,video] of Object.entries(videos))if(hash(path.join(root,`ui-world-${format}.mp4`))!==video.sha256)throw new Error(`Changed video: ${format}`);
const nodeLog=fs.readFileSync(path.join(root,'qa/node-tests.txt'),'utf8');
const nodeTests=Number([...nodeLog.matchAll(/tests (\d+)/g)].at(-1)?.[1]);
if(!summary.passed||!audio.summary.passed||!nodeTests||!/fail 0/.test(nodeLog))throw new Error('Incomplete or failed checks');
const repeats=cases.flatMap(c=>c.repeat);
const receipt={schemaVersion:1,date:'2026-11-21',hyperframes:summary.hyperframes,sourceHashes:summary.sourceHashes,
  checks:{nodeTests,nativeCases:cases.length,nativePassed:cases.filter(c=>c.passed).length,
    cliProjects:cli.length,cliPassed:summary.cli.filter(c=>c.passed).length,
    repeatFrames:repeats.length,repeatPixelExact:repeats.filter(r=>r.pixelExact&&r.stateEqual).length,
    semanticEventsPerFormat:cases[0].events.length,sameEvents:summary.sameEvents,
    externalRequests:cases.reduce((n,c)=>n+c.externalRequests.length,0),
    minActiveLabelPx:Object.fromEntries(cases.filter(c=>c.baseline).map(c=>[c.aspect,
      Math.min(...c.samples.flatMap(s=>s.audit.texts.filter(t=>t.active&&t.visible&&t.opacity>.1).map(t=>t.fontSize)))]))},
  retainedCliFindings:cli.map(c=>({id:c.id,findings:c.check.json.layout.findings.map(f=>({code:f.code,severity:f.severity,text:f.text??null}))})),
  audio:audio.summary,videos,
  limits:['Six-second family-specific recipe; arbitrary actions and durations are not implemented.',
    'Camera poses are art-directed for three formats, not solved automatically.',
    'Active actor and labels are audited; inactive world elements may be intentionally off-canvas.',
    'Two widgets and one actor; no multi-actor physics, obstacle routing or complete language/font coverage.'],
  evidence:{native:'qa/*.json',cli:'qa/cli-results.json',audio:'render-audio-verification.json',video:'video-verification.json'},
};
fs.writeFileSync(path.join(SOURCE,'acceptance.json'),`${JSON.stringify(receipt,null,2)}\n`);
fs.writeFileSync(path.join(root,'acceptance.json'),`${JSON.stringify(receipt,null,2)}\n`);
console.log(JSON.stringify({checks:receipt.checks,audioPassed:audio.summary.passed}));
