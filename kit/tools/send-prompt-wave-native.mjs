// Run with node kit/tools/send-prompt-wave-native.mjs.
// Exercise the production component in native HyperFrames, including the projected HTML ink.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createNativeBrowser,sharp} from './migration-browser.mjs';
import definitions from '../source/lib/components/metadata.mjs';

const fixture={...definitions['send-prompt'].sample,beats:14,timing:{typed:2.5,pull:2.75,landed:4.5,send:5,sent:13}};
const browser=await createNativeBrowser({options:{previewScale:.5}});
const page=await browser.newPage();
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const quantile=(values,q)=>values.sort((a,b)=>a-b)[Math.floor((values.length-1)*q)];

async function play(material,scene=fixture){
  const film={aspect:'9:16',style:'glass',material,pace:'normal',grain:false,sparks:false,
    music:{bpm:100},brand:{name:'Nook'},scenes:[scene]};
  const {plan}=await page.play(film);
  const [ps]=plan.scenes;
  const beat=ps.dur/scene.beats,{send,sent}=scene.timing;
  return fraction=>page.shoot(ps.start+(send+fraction*(sent-send))*beat);
}

// Compare the authored pixels with the exact same moment underneath the optical pass.
// The real camera, button press, cursor and live backdrop keep their time.
async function capturePair(){
  const read=async()=>sharp(await page.screenshot({type:'png'})).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const active=await read();
  const {card,button,hull,guard}=await page.evaluate(()=>{
    const scene=window.__pkScenes.s1,panel=scene.sceneRoot.querySelector('.pk-send-prompt');
    const box=node=>{const {x,y,width,height}=node.getBoundingClientRect();return {x,y,width,height};};
    if(panel.querySelector('.pk-pullback-progress'))throw new Error('Unexpected progress bar');
    if(panel.querySelector('.pk-pullback-pointer .ring'))throw new Error('A second click ring was mounted');
    const world=scene.context.K.glass,canvas=world.canvas,viewport=box(canvas);
    const {sendWave,scene:three,camera}=world.inspect();
    if(canvas.dataset.sendWave!=='distortion-waves@0.1.0')throw new Error('Missing upstream wave');
    const card=box(panel),button=box(panel.querySelector('.pk-pullback-send'));

    // Project the vertices of the button's printed disc: the wave must leave
    // the whole of it, its hover circle and the arrow, as it is.
    const lens=three.getObjectByName('ask-send-face'),positions=lens.geometry.attributes.position;
    const vertex=lens.position.clone(),points=[];
    for(let i=0;i<positions.count;i++){
      vertex.fromBufferAttribute(positions,i);
      lens.localToWorld(vertex).project(camera);
      points.push({x:viewport.x+(vertex.x+1)*viewport.width/2,y:viewport.y+(1-vertex.y)*viewport.height/2});
    }
    points.sort((a,b)=>a.x-b.x||a.y-b.y);
    const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
    function halfHull(points){
      const line=[];
      for(const point of points){
        while(line.length>=2&&cross(line.at(-2),line.at(-1),point)<=0)line.pop();
        line.push(point);
      }
      return line.slice(0,-1);
    }
    const hull=halfHull(points).concat(halfHull(points.reverse()));
    const overlay=panel.querySelector('.pk-send-wave');
    if(overlay&&!overlay.hidden){
      const inverse=new DOMMatrix(world.audit().surfaces[0].matrix).inverse();
      const logical=scene.context.K;
      const maskHull=hull.map(p=>{
        const point=inverse.transformPoint({
          x:(p.x-viewport.x)*logical.W/viewport.width,y:(p.y-viewport.y)*logical.H/viewport.height,
        });
        return {x:point.x/point.w*overlay.width/overlay.clientWidth,y:point.y/point.w*overlay.height/overlay.clientHeight};
      });
      const left=Math.floor(Math.min(...maskHull.map(p=>p.x))),top=Math.floor(Math.min(...maskHull.map(p=>p.y)));
      const width=Math.ceil(Math.max(...maskHull.map(p=>p.x)))-left,height=Math.ceil(Math.max(...maskHull.map(p=>p.y)))-top;
      const rgba=overlay.getContext('2d').getImageData(left,top,width,height).data;
      let count=0;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const p={x:left+x+.5,y:top+y+.5};
        if(!maskHull.every((a,i)=>{
          const b=maskHull[(i+1)%maskHull.length];
          return cross(a,b,p)>1.5*Math.hypot(a.x-b.x,a.y-b.y);
        }))continue;
        if(rgba[4*(y*width+x)+3]!==0)throw new Error('The optical mask painted on the send button');
        count++;
      }
      if(count<100)throw new Error('The optical mask probe missed the send button');
    }
    sendWave.enabled=false;
    scene.drawAt(scene.localTime);
    return {card,button,hull,guard:1.5*Math.max(1,viewport.width/canvas.width)};
  });
  let plain;
  try {plain=await read();}
  finally {
    await page.evaluate(()=>{
      const scene=window.__pkScenes.s1;
      scene.context.K.glass.inspect().sendWave.enabled=true;
      scene.drawAt(scene.localTime);
    });
  }
  // Check the composed screen, including the overlay and the native element
  // underneath it. A read from the 3D canvas alone would miss an overlay leak.
  const x0=Math.floor(Math.min(...hull.map(p=>p.x))),x1=Math.ceil(Math.max(...hull.map(p=>p.x)));
  const y0=Math.floor(Math.min(...hull.map(p=>p.y))),y1=Math.ceil(Math.max(...hull.map(p=>p.y)));
  let inside=0,changed=0,peak=0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const covered=hull.every((a,i)=>{
      const b=hull[(i+1)%hull.length],dx=b.x-a.x,dy=b.y-a.y;
      return dx*(y+.5-a.y)-dy*(x+.5-a.x)>guard*Math.hypot(dx,dy);
    });
    if(!covered)continue;
    inside++;
    const n=(y*active.info.width+x)*3;
    const delta=Math.max(...[0,1,2].map(c=>Math.abs(active.data[n+c]-plain.data[n+c])));
    if(delta){changed++;peak=Math.max(peak,delta);}
  }
  // Chromium may round a few composited pointer edges by one or two levels when
  // toggling the optical layer. The clear rim and the printed arrow stay sharp.
  assert.ok(inside>=100&&peak<=2&&changed/inside<.04,'Wave changed the displayed button: '+changed+'/'+inside+' pixels, max '+peak);
  return {card,button,active:active.data,plain:plain.data,width:active.info.width,height:active.info.height};
}

function probe({active,plain,button,card,width,height}){
  let green=0,weightedDistance=0,near=0,weightedHeight=0,outside=0,peak=0;
  let nearButton=0,distant=0;
  const radius=button.width*.115,cx=button.x+button.width/2,cy=button.y+button.height/2;
  const arrowA=[],arrowB=[];
  for(let y=0;y<height;y+=2)for(let x=0;x<width;x+=2){
    const n=3*(y*width+x);
    const diff=Math.max(Math.abs(active[n]-plain[n]),Math.abs(active[n+1]-plain[n+1]),Math.abs(active[n+2]-plain[n+2]));
    peak=Math.max(peak,diff);
    if(diff>8){
      const d=Math.hypot(x-cx,y-cy)/button.width;
      if(d<1.5)nearButton++;
      if(d>3)distant++;
    }
    const u=(x-card.x)/card.width,v=(y-card.y)/card.height;
    if(u<-.02||u>1.02||v<-.02||v>1.02)outside=Math.max(outside,diff);
    // Locate the travelling green band independently from glyph changes and edge reflections.
    const gain=(active[n+1]-plain[n+1])-.35*(active[n]-plain[n])-.55*(active[n+2]-plain[n+2])-35;
    if(u>.03&&u<.97&&v>.025&&v<.975&&gain>0){
      green+=gain;weightedDistance+=gain*Math.hypot(x-cx,y-cy)/card.height;
      if(Math.abs(x-cx)<.10*card.width){near+=gain;weightedHeight+=gain*v;}
    }
    if(Math.abs(x-cx)<radius&&Math.abs(y-cy)<radius){
      const luminance=buf=>buf[n]*.2126+buf[n+1]*.7152+buf[n+2]*.0722;
      arrowA.push(luminance(active));arrowB.push(luminance(plain));
    }
  }
  const labels=list=>{
    const lo=quantile([...list],.10),hi=quantile([...list],.90);
    return {contrast:hi-lo,bits:list.map(v=>v>(lo+hi)/2)};
  };
  const a=labels(arrowA),b=labels(arrowB);
  return {peak,outside,nearButton,distant,distance:green?weightedDistance/green:null,nearY:near?weightedHeight/near:null,arrowContrast:a.contrast,
    arrowAgreement:a.bits.filter((value,i)=>value===b.bits[i]).length/a.bits.length};
}

// Recover the sampling location from the phase of a grayscale pattern. A layer
// that merely adds coloured light cannot shift this phase or split its channels.
async function stripeProbe(){
  const frames=[],w=540,h=960,period=32;
  for(let phase=0;phase<4;phase++){
    const pixels=Buffer.alloc(w*h);
    for(let y=0;y<h;y++)pixels.fill(Math.round(145+85*Math.cos(2*Math.PI*(y+.5)/period+phase*Math.PI/2)),y*w,(y+1)*w);
    const name='assets/wave-chart-'+phase+'.png';
    await sharp(pixels,{raw:{width:w,height:h,channels:1}}).png().toFile(path.join(page.project,name));
    const seek=await play('glass',{...fixture,background:{image:name}});
    await seek(.245);
    frames.push(await capturePair());
  }
  const {card,width,height}=frames[0],scale=height/h,distance=[],rgb=[];
  for(let y=Math.ceil(card.y+card.height*.07);y<card.y+card.height*.92;y+=3){
    for(let x=Math.ceil(card.x+card.width*.18);x<card.x+card.width*.85;x+=6){
      const n=(y*width+x)*3;
      const phaseAt=(key,k)=>{
        const sin=frames[3][key][n+k]-frames[1][key][n+k],cos=frames[0][key][n+k]-frames[2][key][n+k];
        return {angle:Math.atan2(sin,cos),amplitude:Math.hypot(sin,cos)};
      };
      const shift=[];
      for(let k=0;k<3;k++){
        const a=phaseAt('active',k),b=phaseAt('plain',k);
        if(Math.min(a.amplitude,b.amplitude)<18)break;
        const d=a.angle-b.angle;
        shift.push(Math.atan2(Math.sin(d),Math.cos(d))*period*scale/(2*Math.PI));
      }
      if(shift.length===3){distance.push(Math.abs(shift[1]));rgb.push(Math.max(...shift)-Math.min(...shift));}
    }
  }
  assert.ok(distance.length>50,'Too few pixels contain the transmitted stripe signal');
  return {shift:quantile(distance,.95),split:quantile(rgb,.95)};
}

try{
  for(const material of ['glass','dark-glass','metal']){
    const seek=await play(material),samples=[],repeat=[];
    const canvasHash=async()=>digest(await page.evaluate(()=>{
      const s=window.__pkScenes.s1,overlay=s.sceneRoot.querySelector('.pk-send-wave');
      return s.context.K.glass.canvas.toDataURL()+(overlay?.getBoundingClientRect().width&&getComputedStyle(overlay).visibility==='visible'?overlay.toDataURL():'');
    }));
    for(const phase of [-.04,.04,.08,.15,.16,.18,.195,.24,.28,.60,.80,1.04]){
      await seek(phase);const pair=await capturePair();
      samples.push({phase,...probe(pair)});
      if([-.04,.18,1.04].includes(phase))repeat.push({phase,canvas:await canvasHash(),shot:pair.active});
    }
    for(const idle of [samples[0],samples.at(-1)])assert.equal(idle.peak,0,material+' changes the picture outside send…sent');
    const moving=samples.filter(row=>row.phase>0&&row.phase<=.40&&row.peak>15);
    assert.ok(moving.length>=3,material+' has too few visibly different wave phases');
    const at=phase=>samples.find(row=>row.phase===phase);
    for(const phase of [.04,.08]){
      const {nearButton,distant}=at(phase);
      assert.ok(nearButton>=10&&distant===0,`${material} onset ${phase}: ${nearButton} changed samples near the button, ${distant} beyond three button widths`);
    }
    assert.ok(at(.15).nearY>at(.195).nearY+.17,material+' wave must travel toward the upper edge above the button');
    assert.ok(at(.28).distance>at(.16).distance+.30,material+' front must expand away from the button');
    for(const row of moving){
      assert.equal(row.outside,0,material+' wave leaks beyond the composer');
      assert.ok(row.arrowAgreement>.91&&row.arrowContrast>18,material+' loses the sharp button glyph');
    }
    for(const {phase,canvas,shot} of repeat){
      await seek(phase);
      assert.equal(await canvasHash(),canvas,material+' shader output changed on reverse seek');
      // Chromium may round a few fractional DOM text edges by one level when relayering.
      const again=await sharp(await page.screenshot({type:'png'})).removeAlpha().raw().toBuffer();
      let peak=0,changed=0;
      for(let i=0;i<shot.length;i+=3){
        const delta=Math.max(Math.abs(again[i]-shot[i]),Math.abs(again[i+1]-shot[i+1]),Math.abs(again[i+2]-shot[i+2]));
        if(delta){changed++;peak=Math.max(peak,delta);}
      }
      assert.ok(peak<=2&&changed/(shot.length/3)<.0001,material+' DOM drifted on reverse seek: '+changed+' pixels, max '+peak);
    }
    assert.deepEqual(page.errors,[]);
    console.log(JSON.stringify({material,
      frontYAtButtonColumn:[at(.15).nearY,at(.195).nearY],
      frontDistanceFromButton:[at(.16).distance,at(.28).distance],
      minimumGlyphAgreement:Math.min(...moving.map(sample=>sample.arrowAgreement)),
    }));
  }
  // Both scenes share GPU resources, but neither one's screen or switch belongs to the other.
  await page.play({aspect:'9:16',style:'glass',material:'glass',brand:{name:'Nook'},music:{bpm:100},
    scenes:[fixture,{...fixture,text:'Another source',chips:[],in:'cut'}]});
  const isolated=await page.evaluate(()=>{
    const a=window.__pkScenes.s1,b=window.__pkScenes.s2;
    const inWave=scene=>scene.drawAt(scene.ps.start-scene.clipStart+scene.ps.dur*.68);
    inWave(a);
    const read=instance=>instance.context.K.glass.canvas.toDataURL()+instance.sceneRoot.querySelector('.pk-send-wave')?.toDataURL();
    const source=read(a);
    inWave(b);
    const unchanged=read(a)===source;
    b.context.K.glass.inspect().sendWave.enabled=false;
    inWave(a);
    return unchanged&&a.context.K.glass.inspect().sendWave.enabled&&read(a)===source;
  });
  assert.ok(isolated,'Another instance changed the first composer’s wave');
  const optics=await stripeProbe();
  console.log(JSON.stringify({transmittedStripes:optics}));
  assert.ok(optics.shift>1,'The wave does not bend the uploaded backdrop');
  assert.ok(optics.split>.25,'The wave does not displace the RGB channels independently');
} finally {await browser.close();}
