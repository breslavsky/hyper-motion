// Actual music.py output, native visible keys and stale audio mark acceptance.
// node tools/migration-typewriter-audio.mjs [--out /tmp/pk-typewriter-audio]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createNativeBrowser,TEMPLATE,sourceHashes} from './migration-browser.mjs';
import {typewriterTiming} from '../source/lib/components/typewriter-timing.mjs';

const run=promisify(execFile),args=process.argv.slice(2);
const out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'/tmp/pk-typewriter-audio');
const root=path.resolve(TEMPLATE,'../..'),python=process.env.PK_PYTHON??path.join(root,'.venv/bin/python');
fs.mkdirSync(out,{recursive:true});
const traceScript=String.raw`
import hashlib, json, runpy, subprocess, sys
from pathlib import Path
import numpy as np
from soundtrack import Track, sync_point
source=Path(sys.argv[1]); trace=Path(sys.argv[2]); placed=[]; original=Track.add
def recording_add(self,audio,**options):
    placed.append({"at":options.get("at"),"sync":options.get("sync","start"),
        "syncSeconds":sync_point(audio,options.get("sync","start")),
        "gainDb":options.get("gain_db",0),"bus":options.get("bus","fx"),"sampleSeconds":audio.shape[-1]/48000})
    return original(self,audio,**options)
Track.add=recording_add
try:
    namespace=runpy.run_path(str(source/"music.py"),run_name="__main__")
finally:
    Track.add=original
audio=source/"assets/music.m4a"
decoded=subprocess.run(["ffmpeg","-v","error","-i",str(audio),"-f","f32le","-ac","2","-ar","48000","pipe:1"],capture_output=True,check=True).stdout
pcm=np.frombuffer(decoded,dtype=np.float32).reshape(-1,2)
peak=float(np.max(np.abs(pcm))) if pcm.size else 0
active=np.flatnonzero(np.max(np.abs(pcm),axis=1)>1e-6)
result={"placed":placed,"kept":namespace["thinned"](namespace["plan"]["cues"]),
    "peak":peak,"rms":float(np.sqrt(np.mean(pcm.astype(np.float64)**2))),
    "decodedSeconds":len(pcm)/48000,"activeFrames":len(active),
    "firstActive":float(active[0]/48000) if len(active) else None,
    "lastActive":float(active[-1]/48000) if len(active) else None,
    "sha256":hashlib.sha256(audio.read_bytes()).hexdigest(),
    "mark":json.loads((source/"assets/music.json").read_text())["film"]}
trace.write_text(json.dumps(result,indent=2)+"\n")
`;
const scenes=[
  {id:'short',text:'Hi.'},
  {id:'long',text:'A longer sentence, with spaces and punctuation.'},
  {id:'erase',text:'We ship slowly',erase:6,then:'fast.'},
  {id:'muted',text:'We ship slowly',erase:6,then:'fast.',mute:true},
  {id:'emoji',text:'Go 🚀',erase:1,then:'✨🎉'},
];
const sourceReceipt=sourceHashes(),browser=await createNativeBrowser(),page=await browser.newPage(),results=[];
assert.equal(page.sourceHashes.aggregate,sourceReceipt.aggregate,'Native page must use the recorded source');
const report={schema:'pk-typewriter-audio-v1',sourceReceipt,pageSourceReceipt:page.sourceHashes,total:scenes.length,results};
const writeReport=()=>{
  report.completed=results.length;report.failures=results.filter(result=>result.errors.length).length;
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
};
try{
  for(const entry of scenes){
    const row={id:entry.id,errors:[]};
    try{
      const {id,mute,...content}=entry;
      // Remove the generic opening tick: a nonzero render must come from keys.
      const scene={type:'typewriter',beats:8,...content,sound:{mapping:{tick:false},...(mute?{mute:true}:{})}};
      const film={aspect:'9:16',style:'editorial',pace:'normal',brand:{name:'Typing'},music:{track:'none',kit:'tech',bpm:120},scenes:[scene]};
      const {plan}=await page.play(film),ps=plan.scenes[0],schedule=typewriterTiming(scene,ps.ldur);
      const audioEvents=plan.audioEvents;
      assert.ok(audioEvents.every(event=>event.kind==='type'),'Only typing sounds are enabled');
      assert.deepEqual(audioEvents.map(event=>event.t),mute?[]:schedule.events.map(event=>event.at/ps.speed));
      const visible=[];
      const currentText=()=>page.evaluate(()=>{
        const line=window.__pkScenes.s1.root.querySelector('.cam .bold');
        const semantic=node=>node.nodeType===Node.TEXT_NODE?node.nodeValue:
          node.dataset.emoji??[...node.childNodes].map(semantic).join('');
        const opacity=node=>{let value=1;for(let p=node;p&&p!==line.parentElement;p=p.parentElement){const style=getComputedStyle(p);if(style.visibility==='hidden'||style.display==='none')return 0;value*=Number(style.opacity);}return value;};
        const layer=[...line.querySelectorAll('[data-typewriter-layout]')].find(node=>opacity(node)>.5);
        if(layer)return [...layer.querySelectorAll('[data-typewriter-unit]')].filter(node=>{
          const color=getComputedStyle(node).color,alpha=/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(color)??/\/\s*([\d.]+)\s*\)$/.exec(color);
          return opacity(node)*(node.matches('[data-emoji]')||node.querySelector('[data-emoji]')?1:alpha?Number(alpha[1]):1)>0;
        }).map(semantic).join('');
        return semantic(line.children[0])+semantic(line.children[1]);
      });
      for(const [index,event]of schedule.events.entries()){
        const time=event.at/ps.speed,epsilon=.0001;
        await page.shoot(time-epsilon);const before=await currentText();
        await page.shoot(time+epsilon);const after=await currentText();
        const delta=[...after].length-[...before].length;
        assert.ok(![...before,...after].some(unit=>/^[\uD800-\uDFFF]$/.test(unit)),`${id} must never expose a lone surrogate`);
        assert.equal(delta,event.action==='erase'?-1:1,`${id} action ${index} at ${time}: ${before} -> ${after}`);
        visible.push({action:event.action,time,before,after});
      }
      await page.shoot(ps.dur*.99);assert.equal(await currentText(),schedule.finalText);
      let emoji=null;
      if(id==='emoji'){
        emoji=await page.evaluate(()=>{
          const instance=window.__pkScenes.s1,line=instance.root.querySelector('.cam .bold');
          const visible=node=>{let value=1;for(let p=node;p&&p!==line.parentElement;p=p.parentElement){const style=getComputedStyle(p);if(style.visibility==='hidden'||style.display==='none')return false;value*=Number(style.opacity);}return value>0;};
          const before=[...line.querySelectorAll('[data-emoji]')].filter(visible);
          instance.drawAt(instance.localTime);
          const after=[...line.querySelectorAll('[data-emoji]')].filter(visible);
          return {symbols:after.map(node=>node.dataset.emoji),allSvg:after.every(node=>Boolean(node.querySelector('svg path'))),
            stableNodes:before.length===after.length&&before.every((node,index)=>node===after[index]),
            rawPictographs:/\p{Extended_Pictographic}/u.test(line.textContent)};
        });
        assert.deepEqual(emoji.symbols,['✨','🎉']);
        assert.equal(emoji.allSvg,true,'Every typed emoji must use the bundled SVG asset');
        assert.equal(emoji.stableNodes,true,'Repeating a frame must preserve identical SVG nodes');
        assert.equal(emoji.rawPictographs,false,'No platform emoji font remains in dynamic text');
        await page.screenshot({path:path.join(out,'emoji-final.png')});
      }
      assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
      const summary=JSON.parse((await run(process.execPath,[path.join(page.project,'lib/film.cjs'),'plan'],{cwd:page.project})).stdout);
      const markerFile=path.join(page.project,'assets/music.json');
      const previousMark=fs.existsSync(markerFile)?JSON.parse(fs.readFileSync(markerFile,'utf8')).film:null;
      if(id==='long')assert.notEqual(previousMark,summary.mark,'Changed text must invalidate the preceding actual soundtrack');
      const trace=path.join(out,`${id}-audio-trace.json`);
      await run(python,['-c',traceScript,page.project,trace],{
        env:{...process.env,PYTHONPATH:path.join(root,'core/sound'),HARNESS_SOUNDS:path.join(root,'sounds')},
        timeout:300000,maxBuffer:4*1024*1024,
      });
      const audio=JSON.parse(fs.readFileSync(trace,'utf8'));
      assert.equal(audio.mark,summary.mark);
      assert.equal(audio.placed.length,audio.kept.length);
      assert.deepEqual(audio.placed.map(event=>event.at),audio.kept.map(event=>event.t));
      assert.ok(audio.kept.every(event=>audioEvents.some(candidate=>Math.abs(candidate.t-event.t)<1e-12)),'Every mixed key belongs to a visible action');
      assert.ok(Math.abs(audio.decodedSeconds-plan.duration)<.05,'AAC output must match the fixed native slot');
      if(mute){assert.equal(audio.peak,0);assert.equal(audio.rms,0);assert.equal(audio.activeFrames,0);assert.deepEqual(audio.placed,[]);}
      else{assert.ok(audio.peak>1e-4&&audio.rms>1e-6);assert.ok(audio.placed.length>0);}
      const output=path.join(out,`${id}.m4a`);fs.copyFileSync(path.join(page.project,'assets/music.m4a'),output);
      fs.writeFileSync(path.join(out,`${id}-film.json`),JSON.stringify(film,null,2)+'\n');
      Object.assign(row,{actions:visible,scheduledAudioEvents:audioEvents.length,mixedEvents:audio.placed.length,
        audio,emoji,previousMark,staleBeforeRender:previousMark!==summary.mark,output});
    }catch(error){row.errors.push(error.stack??String(error));}
    results.push(row);
    writeReport();
    console.log(`${entry.id}: ${row.errors.length?'FAIL '+row.errors[0]:`${row.actions.length} visible actions / ${row.scheduledAudioEvents} scheduled / ${row.mixedEvents} mixed, peak ${row.audio.peak}`}`);
  }
}finally{await browser.close();}
report.sourceAfter=sourceHashes();report.sourceStable=report.sourceAfter.aggregate===sourceReceipt.aggregate;
report.passed=report.sourceStable&&report.completed===report.total&&report.failures===0;
writeReport();
assert.notEqual(results.find(row=>row.id==='short').audio?.sha256,results.find(row=>row.id==='long').audio?.sha256,'Different text lengths must produce distinct actual audio');
if(!report.passed)process.exitCode=1;
