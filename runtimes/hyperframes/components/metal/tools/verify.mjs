// Actual-browser verification; dependencies come from pinned HyperFrames.
// Optional upstream parity: METAL_SOURCE=<metal-fx source> PAPER_SHADERS=<unpacked npm package>.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../../..');
const ROOT = path.resolve(HERE, '..');
const OUT = path.resolve(process.env.METAL_TEST_OUTPUT ?? path.join(REPO, 'qa-artifacts/metal-material'));
const require = createRequire(fs.realpathSync(path.join(REPO, 'templates/pure-kinetic/node_modules/hyperframes/package.json')));
const {default:puppeteer} = await import(require.resolve('puppeteer-core'));
const sharp = require('sharp');
const {build} = require('esbuild');
const sha = value => createHash('sha256').update(value).digest('hex');
fs.mkdirSync(OUT, {recursive:true});
const reference = Boolean(process.env.METAL_SOURCE && process.env.PAPER_SHADERS);
if (reference) {
  const source = path.resolve(process.env.METAL_SOURCE), paper = path.resolve(process.env.PAPER_SHADERS);
  const receipt = JSON.parse(fs.readFileSync(path.join(ROOT, 'vendor/INTEGRITY.json')));
  assert.equal(sha(fs.readFileSync(path.join(source, 'src/engine/presets.ts'))), receipt.library.presetsSourceSha256, 'Upstream preset source differs from pinned revision');
  assert.equal(sha(fs.readFileSync(path.join(source, 'src/engine/shaders.ts'))), receipt.library.shadersSourceSha256, 'Upstream shader source differs from pinned revision');
  assert.equal(sha(fs.readFileSync(path.join(source, 'src/engine/renderer/core.ts'))), receipt.library.rendererSourceSha256, 'Upstream renderer differs from pinned revision');
  assert.equal(sha(fs.readFileSync(path.join(source, 'src/engine/renderer/loop.ts'))), receipt.library.compositorSourceSha256, 'Upstream compositor differs from pinned revision');
  const upstreamShader = await import(path.join(paper, 'dist/shaders/liquid-metal.js'));
  assert.equal(sha(upstreamShader.liquidMetalFragmentShader), receipt.shader.fragmentSha256);
  await build({entryPoints:[path.join(source, 'src/engine/renderer/loop.ts')], outfile:path.join(OUT, 'upstream-reference.mjs'), bundle:true, format:'esm', platform:'browser', alias:{'@paper-design/shaders':path.join(paper, 'dist/index.js')}, plugins:[{
    name:'explicit-test-clock', setup(builder) {builder.onLoad({filter:/renderer\/loop\.ts$/}, async args => ({loader:'ts', resolveDir:path.dirname(args.path), contents:fs.readFileSync(args.path, 'utf8') + `\n// Test-only clock bridge: the original renderer, uniforms and compositing stay intact.\nexport function referenceAt(inst,seconds){SHARED.startMs=0;SHARED.pausedMs=0;renderSharedFrame(seconds*1000);copyShaderToInstance(inst);}\n`}));}
  }]});
}
const server = http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') {res.setHeader('content-type','text/html');res.end('<!doctype html><meta charset="utf-8"><body></body>');return;}
  const root = url.pathname.startsWith('/reference/') ? OUT : ROOT;
  const filename = path.resolve(root, decodeURIComponent(url.pathname.replace(/^\/(reference\/)?/, '')));
  if (!filename.startsWith(`${root}/`) || !fs.existsSync(filename)) {res.writeHead(404);res.end();return;}
  res.setHeader('content-type', filename.endsWith('.mjs') ? 'text/javascript' : 'application/octet-stream');
  res.end(fs.readFileSync(filename));
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const executablePath = process.env.CHROME_BIN ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(fs.existsSync);
assert.ok(executablePath, 'Set CHROME_BIN to a browser executable');
const browser = await puppeteer.launch({executablePath, headless:true, args:['--enable-webgl','--ignore-gpu-blocklist','--no-sandbox']});
const report = {upstreamComparison:reference, cases:[], checks:[], passed:false};
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror',error => errors.push(error.message));
  await page.setViewport({width:1440,height:1020,deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async reference => {
    window.material = await import('/metal.mjs');
    window.rafCalls = 0;
    window.requestAnimationFrame = () => {window.rafCalls++;return 0;};
    window.timers = 0;
    window.setInterval = window.setTimeout = () => {window.timers++;return 0;};
    if (reference) window.upstream = await import('/reference/upstream-reference.mjs');
  },reference);
  async function pixels(data) {return sharp(Buffer.from(data.split(',')[1],'base64')).ensureAlpha().raw().toBuffer();}
  for (const preset of ['silver','gold','chromatic']) for (const theme of ['dark','light']) for (const kind of ['fill','ring']) for (const seconds of [0,1.25,3.7]) {
    const data = await page.evaluate(({preset,theme,kind,seconds,reference}) => {
      const canvas=document.createElement('canvas');
      const instance=material.createMetal({canvas,width:280,height:80,preset,theme,kind,ringWidth:5});
      instance.draw(seconds);const actual=canvas.toDataURL();
      instance.draw(8);instance.draw(seconds);const reverse=canvas.toDataURL();
      const draws=window.rafCalls;
      let expected;
      if(reference){
        upstream.setSharedPreset(preset,theme);
        const original=document.createElement('canvas');
        const inst=upstream.createInstance({hostCanvas:original,cssWidth:280,cssHeight:80,cornerRadius:0,kind:'pill',shaderScale:kind==='ring'?1.6:1,ringCssPx:5,mask:kind==='fill'?(ctx,w,h)=>ctx.fillRect(0,0,w,h):null});
        upstream.referenceAt(inst,seconds);expected=original.toDataURL();upstream.destroyInstance(inst);
      }
      instance.dispose();
      return {actual,reverse,expected,draws};
    },{preset,theme,kind,seconds,reference});
    const actual = await pixels(data.actual), reverse = await pixels(data.reverse);
    assert.deepEqual(actual, reverse, `${preset}/${theme}/${kind}@${seconds} reverse seek`);
    assert.ok(actual.some((value,index)=>index%4===3&&value>0), 'Empty material');
    let changedChannels = 0, maxChannelDelta = 0;
    if(reference) {
      const expected = await pixels(data.expected);
      assert.equal(actual.length, expected.length);
      for(let i=0;i<actual.length;i++){const d=Math.abs(actual[i]-expected[i]);if(d)changedChannels++;maxChannelDelta=Math.max(maxChannelDelta,d);}
      assert.equal(changedChannels,0,`${preset}/${theme}/${kind}@${seconds}: original renderer parity`);
    }
    report.cases.push({preset,theme,kind,seconds,reverseEqual:true,upstreamEqual:reference?changedChannels===0:null,maxChannelDelta,hash:sha(actual)});
  }
  report.checks.push(await page.evaluate(() => {
    const fresh=(preset='silver',more={})=>material.createMetal({canvas:document.createElement('canvas'),width:240,height:80,preset,...more});
    const a=fresh(),b=fresh('gold'),c=fresh('chromatic');
    const rafBefore=window.rafCalls,timersBefore=window.timers;
    a.draw(1);const one=a.canvas.toDataURL();b.draw(1);c.draw(1);a.draw(1);
    if(a.canvas.toDataURL()!==one)throw Error('Interleaved variants changed an instance');
    if(new Set([one,b.canvas.toDataURL(),c.canvas.toDataURL()]).size!==3)throw Error('Variants do not differ');
    a.draw(2);if(a.canvas.toDataURL()===one)throw Error('Material does not animate');
    a.resize(320,100);a.draw(1);if(a.canvas.width!==320||a.canvas.height!==100)throw Error('Resize failed');
    a.resize(240,80);a.draw(1);if(a.canvas.toDataURL()!==one)throw Error('Resize roundtrip changed material');
    b.dispose();a.draw(1);if(a.canvas.toDataURL()!==one)throw Error('Disposal affected another instance');
    b.dispose();let rejected=false;try{b.draw(1);}catch{rejected=true;}if(!rejected)throw Error('Disposed instance still draws');
    const mask=fresh('gold',{mask:(ctx,w,h)=>{ctx.font='bold 64px sans-serif';ctx.fillText('Metal',8,64);}});mask.draw(1);
    const alpha=mask.canvas.getContext('2d').getImageData(0,0,240,80).data.filter((_,i)=>i%4===3);
    if(!alpha.some(v=>v>0)||!alpha.some(v=>v===0))throw Error('Text alpha mask failed');
    const ring=fresh('silver',{kind:'ring',radius:40,ringWidth:4});ring.draw(1);
    const ringCtx=ring.canvas.getContext('2d');
    if(ringCtx.getImageData(120,40,1,1).data[3]!==0||ringCtx.getImageData(0,0,1,1).data[3]!==0||ringCtx.getImageData(120,1,1,1).data[3]===0)throw Error('Rounded ring mask failed');
    const multiple=fresh('silver',{mask(ctx){ctx.fillRect(10,10,20,20);ctx.fillRect(50,10,20,20);}});multiple.draw(1);
    const mctx=multiple.canvas.getContext('2d');if(!mctx.getImageData(15,15,1,1).data[3]||!mctx.getImageData(55,15,1,1).data[3])throw Error('Multiple mask shapes did not form a union');
    const retina=fresh('silver',{pixelRatio:2});retina.draw(1);if(retina.canvas.width!==480||retina.canvas.height!==160)throw Error('Explicit pixel ratio was ignored');
    for(const options of [{preset:'invalid'},{theme:'auto'},{speed:-1},{strength:2},{width:NaN},{pixelRatio:0}]){
      let invalid=false;try{fresh('silver',options);}catch{invalid=true;}if(!invalid)throw Error('Invalid configuration accepted');
    }
    const many=Array.from({length:30},(_,index)=>fresh(['silver','gold','chromatic'][index%3]));
    for(const item of many)item.draw(1);
    a.draw(1);if(a.canvas.toDataURL()!==one)throw Error('Many instances exhausted WebGL contexts');
    for(const item of [...many,a,c,mask,ring,multiple,retina])item.dispose();
    const replacement=fresh();replacement.draw(1);if(replacement.canvas.toDataURL()!==one)throw Error('Fresh pool differs');replacement.dispose();
    if(window.rafCalls!==rafBefore||window.timers!==timersBefore)throw Error('Adapter scheduled background work');
    return {name:'isolation, animation, resize, text/ring masks, thirty instances, disposal and no background work',passed:true};
  }));
  await page.evaluate(async () => {
    document.body.style.cssText='margin:0;background:#07080b;color:#eee;font:16px Arial;padding:48px;display:grid;grid-template-columns:repeat(3,1fr);gap:28px';
    for(const theme of ['dark','light'])for(const preset of ['silver','gold','chromatic']){
      const card=document.createElement('div');card.style.cssText=`height:360px;border-radius:24px;padding:24px;background:${theme==='dark'?'#12141a':'#f4f2ee'};color:${theme==='dark'?'#ddd':'#222'};`;
      card.innerHTML=`<div style="font-size:13px;text-transform:uppercase;letter-spacing:3px">${preset} / ${theme}</div>`;
      const title=document.createElement('canvas');title.style.cssText='width:100%;margin-top:70px';
      const text=material.createMetal({canvas:title,width:360,height:100,preset,theme,mask(ctx){ctx.font='bold 80px Arial';ctx.fillText('Metal',12,78);}});text.draw(1.25);card.append(title);
      const button=document.createElement('div');button.style.cssText='position:relative;margin:36px 16px 0;height:56px;border-radius:28px;display:grid;place-items:center;';button.textContent='Explore';
      const border=document.createElement('canvas');border.style.cssText='position:absolute;inset:0;width:100%;height:100%;';
      button.append(border);card.append(button);document.body.append(card);
      const ring=material.createMetal({canvas:border,width:button.clientWidth,height:56,preset,theme,kind:'ring',radius:28,ringWidth:3});ring.draw(1.25);
    }
  });
  await page.screenshot({path:path.join(OUT,'gallery.png')});
  assert.deepEqual(errors,[]);
  report.passed=true;
} finally {
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,checks:report.checks.length,upstreamComparison:reference,output:OUT}));
