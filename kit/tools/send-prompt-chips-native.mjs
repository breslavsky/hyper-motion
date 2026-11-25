// Verify the actual last letters of each projected chip in the native glass scene.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import definitions from '../source/lib/components/metadata.mjs';
import {createNativeBrowser,sharp} from './native-browser.mjs';

const out=process.argv.includes('--out')?path.resolve(process.argv[process.argv.indexOf('--out')+1]):null;
if(out)fs.mkdirSync(out,{recursive:true});
const examples=[
  {name:'sample',chips:['Продажи','Подписки']},
  {name:'long',chips:['Масштабирование','Взаимодействия CRM']},
];

async function control(page,mode){
  return page.evaluate(mode=>{
    const scene=window.__pkScenes.s1,world=scene.context.K.glass;
    const labels=[...scene.sceneRoot.querySelectorAll('.pk-pullback-chip-label')];
    for(const label of labels){
      if(mode==='unclipped'){
        label.style.setProperty('overflow','visible','important');
        label.style.setProperty('text-overflow','clip','important');
      }
    }
    world.inspect().sendWave.enabled=mode==='wave';
    scene.drawAt(scene.localTime);
    return labels.map(label=>{
      const range=label.ownerDocument.createRange();
      range.selectNodeContents(label);
      const {x,y,width,height}=range.getBoundingClientRect();
      const pill=label.closest('.pk-pullback-chip').getBoundingClientRect();
      return {name:label.textContent,x,y,width,height,pill:{x:pill.x,y:pill.y,width:pill.width,height:pill.height}};
    });
  },mode);
}

function compareText(actual,reference,width,height){
  function inkMask(pixels){
    const luma=new Float32Array(width*height);
    for(let i=0;i<luma.length;i++){
      luma[i]=.2126*pixels[i*3]+.7152*pixels[i*3+1]+.0722*pixels[i*3+2];
    }
    const sorted=luma.slice().sort();
    const cutoff=sorted[Math.floor(sorted.length*.1)]*.48+sorted[Math.floor(sorted.length*.97)]*.52;
    return luma.map(v=>v>cutoff?1:0);
  }
  const active=inkMask(actual),full=inkMask(reference);
  // Allow the subpixel difference between transformed HTML and WebGL texture
  // sampling. Compare both directions: a clipped word and added ellipsis fail.
  function coverage(mask,other,start,end){
    let count=0,found=0;
    for(let y=0;y<height;y++)for(let x=start;x<end;x++){
      if(!mask[y*width+x])continue;
      count++;
      let match=false;
      for(let yy=Math.max(0,y-2);yy<=Math.min(height-1,y+2)&&!match;yy++){
        for(let xx=Math.max(0,x-2);xx<=Math.min(width-1,x+2);xx++){
          if(other[yy*width+xx]){match=true;break;}
        }
      }
      if(match)found++;
    }
    return count>=10?found/count:0;
  }
  const start=Math.floor(width*.70);
  return {suffixRecall:coverage(full,active,start,width),suffixPrecision:coverage(active,full,start,width),
    labelRecall:coverage(full,active,0,width),labelPrecision:coverage(active,full,0,width)};
}

function focusMetrics(active,reference,width,height){
  let sumDelta=0,changed=0,sharpA=0,sharpB=0,pixels=0;
  const y=(image,i)=>.2126*image[i]+.7152*image[i+1]+.0722*image[i+2];
  for(let row=1;row<height-1;row++){
    for(let col=1;col<width-1;col++){
      const n=3*(row*width+col);
      const delta=Math.max(...[0,1,2].map(k=>Math.abs(active[n+k]-reference[n+k])));
      const laplace=image=>y(image,n-3)+y(image,n+3)+y(image,n-3*width)+y(image,n+3*width)-4*y(image,n);
      sharpA+=laplace(active)**2;sharpB+=laplace(reference)**2;
      sumDelta+=delta;if(delta>8)changed++;pixels++;
    }
  }
  return {edgeEnergy:Math.sqrt(sharpA/sharpB),meanDelta:sumDelta/pixels,shareAbove8:changed/pixels};
}

async function checkFocus(page,scale){
  const results=[];
  for(const phase of [.001,.01,.04]){
    await page.shoot(3+4.8*phase);
    const [label]=await control(page,'wave');
    const topEdge=await page.evaluate(()=>{
      const stage=window.__pkScenes.s1.context.K,w=stage.glass,[a,b]=w.audit().surfaces[0].corners;
      const r=w.canvas.getBoundingClientRect();
      const point=t=>({x:r.x+(a.x+t*(b.x-a.x))*r.width/stage.W,y:r.y+(a.y+t*(b.y-a.y))*r.height/stage.H});
      const p=point(.12),q=point(.35);
      return {x:p.x,y:Math.min(p.y,q.y)-7,width:q.x-p.x,height:Math.abs(q.y-p.y)+20};
    });
    const active=Buffer.from(await page.screenshot({type:'png'}));
    await control(page,'idle');
    const reference=Buffer.from(await page.screenshot({type:'png'}));
    for(const [name,b] of Object.entries({letters:label,edge:topEdge})){
      const left=Math.floor(b.x),top=Math.floor(b.y),width=Math.ceil(b.x+b.width)-left,height=Math.ceil(b.y+b.height)-top;
      const region={left,top,width,height};
      const raw=img=>sharp(img).extract(region).removeAlpha().raw().toBuffer();
      const [a,r]=await Promise.all([raw(active),raw(reference)]);
      const metrics=focusMetrics(a,r,width,height);
      results.push({scale,phase,region:name,...metrics});
      if(out&&name==='letters'){
        await Promise.all([[active,'on'],[reference,'off']].map(([img,state])=>sharp(img).extract({
          left:left-12,top:top-12,width:width+24,height:height+24,
        }).png().toFile(path.join(out,'focus-'+scale+'-'+phase+'-'+state+'.png'))));
      }
    }
  }
  return results;
}

async function check(page,example,previewScale){
  const scene={...definitions['glass-send-prompt'].sample,chips:example.chips,beats:14,timing:{typed:2.5,pull:2.75,landed:4.5,send:5,sent:13}};
  await page.play({aspect:'9:16',style:'glass',material:'glass',pace:'normal',brand:{name:'Nook'},
    music:{bpm:100},scenes:[scene]}, {options:{previewScale}});
  if(example.name==='sample'){
    const focus=await checkFocus(page,previewScale);
    console.log(JSON.stringify({focus}));
    for(const sample of focus){
      assert.ok(sample.edgeEnergy>.95&&sample.edgeEnergy<1.05&&sample.meanDelta<.75&&sample.shareAbove8<.01,
        'Premature loss of focus away from the send button: '+JSON.stringify(sample));
    }
  }
  const capture=async()=>Buffer.from(await page.screenshot({type:'png'}));
  // The band has crossed both chips. Its original shader, screen capture and
  // perspective projection are still active at this time.
  await page.shoot(3+4.8*.78);
  const labels=await control(page,'wave'),active=await capture();
  await control(page,'idle');const live=await capture();
  const uncut=await control(page,'unclipped'),reference=await capture();
  let clipped;
  if(example.name==='sample'&&previewScale===.5){
    await page.evaluate(()=>{
      const label=window.__pkScenes.s1.sceneRoot.querySelector('.pk-pullback-chip-label');
      const full=label.offsetWidth;
      // Deliberately truncate a real chip in Chromium to calibrate the suffix check.
      label.style.cssText+=';max-width:'+Math.floor(full*.8)+'px!important;display:block;white-space:nowrap;overflow:hidden!important;text-overflow:ellipsis!important';
    });
    clipped=await capture();
  }
  assert.deepEqual(labels.map(l=>l.name),example.chips);
  const stats=[];
  for(const [i,label] of uncut.entries()){
    const item=label.pill;
    assert.ok(label.x>=item.x-2&&label.x+label.width<=item.x+item.width+2,label.name+' exceeds its pill');
    const left=Math.floor(label.x)-2,top=Math.floor(label.y)-2;
    const width=Math.ceil(label.x+label.width)+2-left,height=Math.ceil(label.y+label.height)+2-top;
    const region={left,top,width,height};
    const raw=img=>sharp(img).extract(region).removeAlpha().raw().toBuffer();
    const [a,l,r]=await Promise.all([raw(active),raw(live),raw(reference)]);
    const settled=compareText(l,r,width,height),wave=compareText(a,r,width,height);
    if(i===0&&clipped){
      const negative=compareText(await raw(clipped),r,width,height);
      assert.ok(negative.suffixRecall<.85,'A deliberately ellipsized label escaped the pixel check');
    }
    stats.push({text:label.name,live:settled,wave});
    if(out){
      const images=await Promise.all([active,live,reference].map(img=>sharp(img).extract(region).png().toBuffer()));
      await sharp({create:{width,height:height*3,channels:3,background:'black'}})
        .composite(images.map((input,j)=>({input,left:0,top:j*height}))).png()
        .toFile(path.join(out,example.name+'-'+previewScale+'-'+i+'.png'));
    }
  }
  console.log(JSON.stringify({previewScale,example:example.name,stats}));
  for(const {text,live,wave} of stats){
    assert.ok(Object.values(live).every(n=>n>.97),text+' is already truncated in the live composer');
    assert.ok(Object.values(wave).every(n=>n>.89),text+' lost letters in the active wave');
  }
}

const browser=await createNativeBrowser(),page=await browser.newPage();
try{
  for(const previewScale of [.5,1])for(const example of examples)await check(page,example,previewScale);
}finally{await browser.close();}
