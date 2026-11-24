// Real compiled native scenes: material pixels, semantic layout, independent
// clocks, reverse seeks and disposal. Uses the same browser as the export path.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createNativeBrowser,sharp,sourceHashes} from './native-browser.mjs';
import {measureRenderedText,layoutFindings} from './quality-layout.mjs';

const args=process.argv.slice(2),out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'/tmp/metal-native');
if(fs.existsSync(out))throw new Error('Use a fresh output directory: '+out);
fs.mkdirSync(out,{recursive:true});
const variants=['silver','gold','chromatic'];
const examples=[
  {type:'title',text:'Beautifully made.',sub:'A LIQUID METAL FINISH',beats:5},
  // No island: it is a Liquid Glass scene now and takes its metal from the
  // glass world (glass-native.mjs), not from this material of the page.
  {type:'endcard',tagline:'Precision in every detail.',cta:'Discover Metal',beats:6},
];
const groups=(args.includes('--quick')?['16:9']:['16:9','9:16','1:1']).flatMap(aspect=>['dark','light'].map(theme=>({aspect,theme})));
const report={results:[],groups:[],total:groups.length*variants.length*examples.length},before=sourceHashes();
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
async function pixelDifference(a,b){
  const [left,right]=await Promise.all([sharp(a).raw().toBuffer(),sharp(b).raw().toBuffer()]);
  assert.equal(left.length,right.length);
  let max=0,changed=0;
  for(let i=0;i<left.length;i++){const delta=Math.abs(left[i]-right[i]);if(delta)changed++;max=Math.max(max,delta);}
  return {max,changed,share:changed/left.length};
}
const browser=await createNativeBrowser(),page=await browser.newPage();
async function snapshot(id){
  return page.evaluate(({id,measure})=>{
    const instance=window.__pkScenes[id],root=instance.sceneRoot,canvas=root.querySelector('canvas[data-metal]');
    const fills=[...root.querySelectorAll('.pk-metal-fill')].filter(n=>getComputedStyle(n).display!=='none');
    // Regression: a static role container can be skipped by offsetParent.
    // Its glyphs still must sample inside the sheet, not outside a no-repeat image.
    const coverage=fills.map(n=>{
      const s=getComputedStyle(n),[w,h]=s.backgroundSize.split(' ').map(parseFloat),[x,y]=s.backgroundPosition.split(' ').map(parseFloat);
      return {copy:n.textContent,w,h,x,y,valid:x<=1&&y<=1&&-x<w&&-y<h};
    });
    return {variant:canvas.dataset.metal,time:+canvas.dataset.metalTime,pixels:canvas.toDataURL(),
      material:instance.plan.look.material,coverage,surfaces:root.querySelectorAll('.pk-metal-surface').length,
      texts:(0,eval)(`(${measure})`)(root),
      body:[...root.querySelectorAll('[data-design-role="body"],[data-design-role="label"],[data-design-role="button"]')].map(n=>({text:n.textContent,metal:n.classList.contains('pk-metal-fill')}))};
  },{id,measure:measureRenderedText.toString()});
}
try{
  for(const {aspect,theme} of groups){
    const film={aspect,style:'metal',brand:{name:'Metal',font:'Geist',tokens:{background:theme==='dark'?'#101216':'#f6f7f9',foreground:theme==='dark'?'#f4f5f7':'#141821',accent:'#99b8cb'}},grain:false,sparks:false,
      scenes:variants.flatMap(metalVariant=>examples.map(scene=>({...scene,metalVariant})))};
    console.log(`Building ${aspect} ${theme}`);
    const {plan}=await page.play(film),safe=plan.safe;
    console.log(`Ready ${aspect} ${theme}`);
    const bounds={width:plan.width,height:plan.height,floor:plan.type.label,
      safe:{left:plan.width*safe.left,top:plan.height*safe.top,right:plan.width*(1-safe.right),bottom:plan.height*(1-safe.bottom)}};
    const variantPixels=[];
    for(let index=0;index<plan.scenes.length;index++){
      const ps=plan.scenes[index],id=`s${index+1}`,key=`${aspect.replace(':','x')}-${theme}-${film.scenes[index].metalVariant}-${ps.scene.type}`;
      await page.shoot(ps.start+ps.dur*.72);
      console.log(`Checking ${key}`);
      const saved=await snapshot(id),picture=await page.screenshot({type:'png'});
      assert.equal(saved.variant,film.scenes[index].metalVariant,key);
      assert.equal(saved.material.variant,saved.variant);
      assert.ok(saved.coverage.length&&saved.coverage.every(v=>v.valid),`${key}: material outside glyph bounds ${JSON.stringify(saved.coverage)}`);
      assert.ok(saved.body.every(v=>!v.metal),`${key}: body/button text must stay readable`);
      if(ps.scene.type!=='title')assert.ok(saved.surfaces>0,`${key}: material border`);
      assert.deepEqual(layoutFindings(saved.texts,bounds),[],`${key}: native text layout`);
      if(ps.scene.type==='title')variantPixels.push(saved.pixels);
      await sharp(picture).resize({width:960,height:960,fit:'inside'}).png().toFile(path.join(out,`${key}.png`));
      await page.shoot(ps.start+ps.dur*.91);const moved=await snapshot(id);
      assert.notEqual(moved.pixels,saved.pixels,`${key}: animated shader`);
      await page.shoot(ps.start+ps.dur*.1);await page.shoot(ps.start+ps.dur*.72);
      const repeated=await snapshot(id),repeatedPicture=await page.screenshot({type:'png'});
      assert.equal(repeated.pixels,saved.pixels,`${key}: shader reverse seek`);
      const difference=await pixelDifference(picture,repeatedPicture);
      // The shader texture must be byte-identical. Native transformed glyph
      // antialiasing of the two composited text layers can round a handful of
      // edge channels by 3/255 on replay. Bound both magnitude and area; never
      // accept a stale texture or moved layout (at most .01% of channels).
      if(difference.max>3||difference.share>.0001){
        fs.writeFileSync(path.join(out,`${key}-before-full.png`),picture);
        fs.writeFileSync(path.join(out,`${key}-after-full.png`),repeatedPicture);
      }
      assert.ok(difference.max<=3&&difference.share<=.0001,`${key}: rendered CSS material reverse seek ${JSON.stringify(difference)}`);
      report.results.push({id:key,variant:saved.variant,targets:saved.coverage.length,surfaces:saved.surfaces,shaderReverseExact:true,renderDifference:difference,pictureSha256:hash(picture)});
    }
    assert.equal(new Set(variantPixels).size,3,'Distinct material variants');
    const lifecycle=await page.evaluate(()=>{
      const a=window.__pkScenes.s1,b=window.__pkScenes.s3;
      a.drawAt(a.clipDuration*.6);b.drawAt(b.clipDuration*.4);
      const canvas=instance=>instance.sceneRoot.querySelector('canvas[data-metal]');
      const saved=canvas(a).toDataURL();b.drawAt(b.clipDuration*.7);
      const isolated=canvas(a).toDataURL()===saved;
      const bCanvas=canvas(b);b.dispose();a.drawAt(a.clipDuration*.6);
      return {isolated,disposed:!window.__pkScenes.s3&&!window.__timelines.s3&&!bCanvas.isConnected,otherPreserved:canvas(a).toDataURL()===saved};
    });
    assert.ok(Object.values(lifecycle).every(Boolean));assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
    report.groups.push({aspect,theme,lifecycle});console.log(`${aspect} ${theme}: ${variants.length*examples.length} native Metal cases passed`);
  }
  report.sourceStable=sourceHashes().aggregate===before.aggregate;assert.ok(report.sourceStable);
  report.passed=report.results.length===report.total;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;console.error(report.error);}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
