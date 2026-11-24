// Compiled native glass components: three formats, actual perspective, text,
// independent worlds, reverse pixels and disposal. No alternate video player.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createNativeBrowser,sharp,sourceHashes} from './native-browser.mjs';
import {measureRenderedText,layoutFindings} from './quality-layout.mjs';
import {measureDesign} from './design-audit.mjs';
import {surfaceFindings} from './surface-audit.mjs';
import definitions from '../source/lib/components/metadata.mjs';

const args=process.argv.slice(2);
const previewScale=args.includes('--preview-scale')?Number(args[args.indexOf('--preview-scale')+1]):1;
const referencePalette=args.includes('--reference-palette');
assert.ok(Number.isFinite(previewScale)&&previewScale>=.25&&previewScale<=1);
const out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'/tmp/glass-native');
if(fs.existsSync(out))throw new Error('Use a fresh output directory: '+out);
fs.mkdirSync(out,{recursive:true});
const aspects=args.includes('--quick')?['16:9']:['16:9','9:16','1:1'];
const portraitIslandBody='WorkspaceNotificationSynchronizationConfigurationIdentifier';
const examples=[
  {id:'island-static',scene:{type:'island',title:'One clear message',body:'A surface with depth.',icon:'✦',camera:'static',exit:'hold',beats:4}},
  {id:'island-orbit-collapse',scene:{type:'island',title:'Всё на своём месте',body:'Текст движется вместе со стеклом.',camera:'orbit',exit:'collapse',beats:4}},
  {id:'lens-static',scene:{type:'lens',text:'Clarity in motion.',sub:'Through real glass.',camera:'static',beats:4}},
  {id:'lens-orbit',scene:{type:'lens',text:'Сквозь стекло',sub:'Свет, глубина, движение.',camera:'orbit',beats:4}},
  {id:'glass-flow',scene:{type:'glass-flow',title:'Liquid clarity.',body:'One continuous world.',nextTitle:'Pure motion.',nextBody:'A new point of view.',beats:16}},
  {id:'ask-orbit-reply',scene:{type:'ask',text:'Book 🚀 for my Tuesday class',reply:'Booked. Tuesday is confirmed.',camera:'orbit',beats:6}},
  {id:'ask-static-prompt',scene:{type:'ask',text:'Show all upcoming classes',camera:'static',beats:6}},
  {id:'send-prompt',scene:{type:'send-prompt',text:'Plan a review with @Nook',chips:['Design','Review'],beats:8,
    timing:{type:.25,typed:3,pull:3.5,chips:[4,4.75],landed:5.75,send:6.75,sent:7.5}}},
];
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const report={schema:'pure-kinetic.glass-native.v1',scope:previewScale!==1?(args.includes('--quick')?'landscape-preview':'preview-three-formats'):args.includes('--quick')?'landscape-debug':'three-formats',previewScale,referencePalette,
  total:aspects.length*examples.length,results:[],groups:[],policy:{canvasReverse:'exact',projectionTolerance:.75,reverseGeometryTolerance:.002,renderMaxDelta:2,renderChangedShare:.0001},sourceReceipt:sourceHashes()};
const browser=await createNativeBrowser({options:{previewScale}}),page=await browser.newPage();
let testedSourceReceipt;

async function snapshot(id){
  return page.evaluate(({id,measure,design})=>{
    const instance=window.__pkScenes[id],world=instance?.context.K.glass;
    if(!world?.audit)throw new Error(`${id}: no instance-owned glass audit`);
    const canvas=instance.sceneRoot.querySelector('canvas[data-glass]');
    if(!canvas)throw new Error(`${id}: no owned glass output canvas`);
    // Pure Kinetic applies the outer scene life transform to both WebGL canvas
    // and DOM copy. Compare in the owned canvas's logical pixel coordinates.
    const rootRect=canvas.getBoundingClientRect(),sx=instance.context.K.W/rootRect.width,sy=instance.context.K.H/rootRect.height;
    const surfaces=[...instance.sceneRoot.querySelectorAll('[data-glass-surface]')].map(node=>{
      const r=node.getBoundingClientRect(),style=getComputedStyle(node);
      // Offsets are in the card's layout coordinates, independent of the camera.
      const localBox=child=>{
        let x=0,y=0;
        for(let parent=child;parent&&parent!==node;parent=parent.offsetParent){
          x+=parent.offsetLeft;y+=parent.offsetTop;
        }
        return {x,y,w:child.offsetWidth,h:child.offsetHeight};
      };
      const title=node.querySelector('.pk-glass-heading'),body=node.querySelector('.pk-glass-body'),icon=node.querySelector('.pk-glass-icon');
      const grid=title?{unit:Number(node.dataset.surfaceUnit),w:node.clientWidth,h:node.clientHeight,title:localBox(title),
        titleSize:parseFloat(getComputedStyle(title).fontSize),titleLeading:parseFloat(getComputedStyle(title).lineHeight),
        icon:icon?localBox(icon):null,body:body?localBox(body):null,
        bodyLeading:body?parseFloat(getComputedStyle(body).lineHeight):null,bodyOverflow:body?body.scrollWidth-body.clientWidth:0}:null;
      const prompt=node.querySelector('[data-typing-id="ask-prompt"]'),reply=node.querySelector('.pk-glass-ask-reply');
      const ask=prompt?{
        typed:[...prompt.querySelectorAll('[data-typing-unit]')].filter(glyph=>getComputedStyle(glyph).visibility==='visible')
          .map(glyph=>glyph.dataset.emoji??glyph.textContent).join(''),
        caretOpacity:Number(getComputedStyle(prompt.querySelector('[data-typing-caret]')).opacity),
        unit:Number(node.dataset.surfaceUnit),width:node.clientWidth,
        row:localBox(node.querySelector('.pk-glass-ask-row')),prompt:localBox(prompt),
        reply:reply?localBox(reply):null,replyStart:reply?localBox(reply.firstElementChild??reply).x:null,
      }:null;
      return {cardIndex:Number(node.dataset.glassSurface),text:node.textContent,opacity:Number(style.opacity),
        grid,ask,
        matrix:[...new DOMMatrixReadOnly(node.style.transform||style.transform).toFloat64Array()],
        rect:{x:(r.x-rootRect.x)*sx,y:(r.y-rootRect.y)*sy,w:r.width*sx,h:r.height*sy}};
    });
    return {audit:world.audit(),surfaces,canvas:canvas.toDataURL(),
      texts:(0,eval)(`(${measure})`)(instance.sceneRoot),
      design:(0,eval)(`(${design})`)(instance.sceneRoot),
      raster:instance.context.K.rasterTypography??[],
      content:instance.ps.scene};
  },{id,measure:measureRenderedText.toString(),design:measureDesign.toString()});
}

function checkCopyGrid(grid,{key,expectIcon,expectWrappedBody}){
  const {unit,title,body,icon}=grid,pad=16*unit,gap=12*unit;
  // DOM offsets are rounded to logical CSS pixels independently of render resolution.
  const close=(actual,expected,part)=>assert.ok(Math.abs(actual-expected)<=2,`${key}: ${part} is ${actual}, expected ${expected}`);
  assert.equal(!!icon,expectIcon,`${key}: expected icon slot`);
  close(title.y,pad,'title top inset');
  close(grid.w-title.x-title.w,pad,'title right inset');
  if(icon){
    close(icon.x,pad,'icon left inset');
    close(title.x-icon.x-icon.w,gap,'icon-to-title gap');
    close(icon.w,grid.titleSize,'icon width');
    close(icon.h,grid.titleSize,'icon height');
    close(icon.y+icon.h/2,title.y+grid.titleLeading/2,'icon centre on first title line');
  }else close(title.x,pad,'title left inset');
  if(body){
    close(body.x,title.x,'body left guide');
    close(grid.w-body.x-body.w,pad,'body right inset');
    close(body.y-title.y-title.h,gap,'title-to-body gap');
    assert.ok(grid.bodyOverflow<=1,`${key}: body fits its text column`);
    if(expectWrappedBody)assert.ok(body.h>grid.bodyLeading+1,`${key}: portrait body wraps within the column`);
  }
  const last=body??title;
  assert.ok(grid.h-last.y-last.h>=pad-2,`${key}: copy stays above the bottom inset`);
}

function checkAsk(state,ps,fraction,words,key){
  const visible=state.surfaces.filter(surface=>surface.opacity>=.75&&surface.ask);
  assert.equal(visible.length,1,`${key}: visible typing field on a projected card`);
  const {ask}=visible[0],scene=ps.scene,chars=[...scene.text],time=ps.ldur*fraction;
  const marks=definitions.ask.times(scene,ps.ldur);
  const count=Math.round(chars.length*Math.max(0,Math.min(1,(time-marks.type)/(marks.typed-marks.type))));
  assert.equal(ask.typed,chars.slice(0,count).join(''),`${key}: painted code-point prefix`);
  assert.equal(!!ask.reply,!!scene.reply,`${key}: optional answer belongs to the same card`);
  if(time<marks.typed){
    assert.ok(count>0&&count<chars.length&&ask.caretOpacity>0,`${key}: caret follows the unfinished request`);
    if(scene.reply)assert.ok(!words.includes(scene.reply.split(' ')[0]),`${key}: answer stays hidden while typing`);
    return;
  }
  assert.equal(ask.caretOpacity,0,`${key}: send hides the caret`);
  const close=(value,expected,label)=>assert.ok(Math.abs(value-expected)<=2,`${key}: ${label} is ${value}, expected ${expected}`);
  close(ask.row.x,16*ask.unit,'left inset');
  close(ask.width-ask.row.x-ask.row.w,16*ask.unit,'right inset');
  close(ask.prompt.x,52*ask.unit,'prompt column after the icon');
  if(ask.reply){
    close(ask.reply.y-ask.row.y-ask.row.h,12*ask.unit,'prompt to reply gap');
    close(ask.replyStart,ask.prompt.x,'reply text guide');
  }
}

function projectionFindings(state,tolerance=report.policy.projectionTolerance){
  const errors=[];
  for(const projected of state.audit.surfaces??[]){
    if(projected.opacity<.75)continue;
    const actual=state.surfaces.find(surface=>surface.cardIndex===projected.cardIndex);
    if(!actual){errors.push('Missing projected DOM surface '+projected.cardIndex);continue;}
    if(actual.opacity<.75){errors.push('Visible card text surface was hidden');continue;}
    if(!projected.matrix?.every(Number.isFinite)||projected.matrix.length!==16){errors.push('Non-finite projection matrix');continue;}
    // Browsers serialize CSS matrices to a limited number of significant
    // digits. The independent projected rectangle check remains subpixel.
    const matrixError=Math.max(...projected.matrix.map((v,i)=>Math.abs(v-actual.matrix[i])/Math.max(1,Math.abs(v))));
    if(matrixError>1e-5)errors.push(`DOM matrix differs from card projection by ${matrixError}`);
    const points=projected.corners??[];
    if(points.length!==4||!points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))){errors.push('Invalid projected corners');continue;}
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    const expected={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
    for(const key of ['x','y','w','h'])if(Math.abs(expected[key]-actual.rect[key])>tolerance)errors.push(`Card ${projected.cardIndex} ${key}: ${actual.rect[key]} versus ${expected[key]}`);
  }
  return errors;
}

async function pixelDifference(a,b){
  const [left,right]=await Promise.all([sharp(a).raw().toBuffer(),sharp(b).raw().toBuffer()]);
  assert.equal(left.length,right.length);let max=0,changed=0;
  for(let i=0;i<left.length;i++){const d=Math.abs(left[i]-right[i]);if(d)changed++;max=Math.max(max,d);}
  return {max,changed,share:changed/left.length};
}

// Phase-shift a striped background behind the production mesh. The recovered
// stripe position measures transmitted image displacement even when the glass
// also changes brightness through reflections, tint and edge lighting.
async function panelOpticalProbe(ps,id){
  await page.shoot(ps.start+ps.dur*.525);
  const capture=await page.evaluate(async id=>{
    const {CanvasTexture,SRGBColorSpace}=await import('/lib/vendor/three/three.module.min.js');
    const world=window.__pkScenes[id].context.K.glass,{scene,backdropScene,render}=world.inspect();
    const card=scene.children.find(node=>node.isGroup),canvas=world.canvas;
    const mesh=card.children.find(node=>node.isMesh),material=mesh.material;
    // Three's clone retains the same physical properties and geometry. It uses
    // the stock shader, giving us a separate control for the original bevel.
    const stockMaterial=material.clone();
    const original=backdropScene.background,backdrop=backdropScene.children[0],backdropVisible=backdrop.visible;
    const visible=card.visible,before=canvas.toDataURL();
    const {resolution,surfaces}=world.audit(),scale=resolution.previewScale,period=512*scale;
    const corners=surfaces[0].corners.map(p=>({x:p.x*scale,y:p.y*scale}));
    const context=canvas.getContext('2d'),result={},textures=[];
    try{
      backdrop.visible=false;
      for(const axis of ['x','y']){
        const horizontal=axis==='x',cross=horizontal?'y':'x',length=horizontal?canvas.width:canvas.height;
        const line=Math.floor(corners.reduce((sum,p)=>sum+p[cross],0)/4);
        const edges=[];
        for(let i=0;i<4;i++){
          const a=corners[i],b=corners[(i+1)%4];
          if((a[cross]>line)===(b[cross]>line))continue;
          edges.push(a[axis]+(line-a[cross])*(b[axis]-a[axis])/(b[cross]-a[cross]));
        }
        edges.sort((a,b)=>a-b);
        const pattern=document.createElement('canvas');
        pattern.width=horizontal?length:1;pattern.height=horizontal?1:length;
        const texture=new CanvasTexture(pattern);texture.colorSpace=SRGBColorSpace;
        textures.push(texture);backdropScene.background=texture;
        const ink=pattern.getContext('2d'),pixels=ink.createImageData(pattern.width,pattern.height);
        const stripes=[],stock=[],clear=[];
        function readLine(){
          const samples=context.getImageData(horizontal?0:line,horizontal?line:0,pattern.width,pattern.height).data;
          return Array.from({length},(_,i)=>samples[4*i+1]);
        }
        for(let step=0;step<4;step++){
          for(let i=0;i<length;i++){
            const gray=Math.round(160+65*Math.cos(2*Math.PI*(i+.5)/period+step*Math.PI/2));
            pixels.data.set([gray,gray,gray,255],4*i);
          }
          ink.putImageData(pixels,0,0);texture.needsUpdate=true;
          card.visible=true;mesh.material=material;render();stripes.push(readLine());
          mesh.material=stockMaterial;render();stock.push(readLine());
          card.visible=false;render();clear.push(readLine());
        }
        result[axis]={edges,stripes,stock,clear};
      }
    }finally{
      backdropScene.background=original;backdrop.visible=backdropVisible;
      card.visible=visible;mesh.material=material;render();
      for(const texture of textures)texture.dispose();
      stockMaterial.dispose();
    }
    // A traced slab has no polygons whose shader could be swapped for the stock one.
    return {result,period,scale,restored:before===canvas.toDataURL(),slab:Boolean(card.getObjectByName('liquid-slab'))};
  },id);
  assert.ok(capture.restored,'Stripe probe restores identical authored pixels');
  const measurements={};
  for(const [axis,{edges,stripes,stock,clear}] of Object.entries(capture.result)){
    assert.equal(edges.length,2,'Probe scan crosses both sides of the projected card');
    const [lo,hi]=edges,midpoint=(lo+hi)/2,rim=[],centre=[],outside=[],shaded=[],extraLeft=[],extraRight=[];
    const phase=(frames,i)=>Math.atan2(frames[3][i]-frames[1][i],frames[0][i]-frames[2][i]);
    const shiftPixels=angle=>Math.atan2(Math.sin(angle),Math.cos(angle))*capture.period/(2*Math.PI*capture.scale);
    for(let i=0;i<clear[0].length;i++){
      const panelPhase=phase(stripes,i),shift=Math.abs(shiftPixels(panelPhase-phase(clear,i)));
      const inset=Math.min(i-lo,hi-i)/capture.scale;
      if(inset>=4&&inset<=32){
        rim.push(shift);
        const extra=shiftPixels(panelPhase-phase(stock,i));
        if(i<midpoint)extraLeft.push(extra);else extraRight.push(-extra);
      }
      if(Math.abs(i-midpoint)<(hi-lo)*.08)centre.push(shift);
      // A traced pane casts a soft shadow around itself. It dims the
      // picture there and rounds its 8-bit levels, which reads as a
      // fraction of a pixel; past the shadow nothing may change at all.
      if(inset<-(capture.slab?150:25))outside.push(shift);
      else if(inset<-25)shaded.push(shift);
    }
    const percentile=(samples,p)=>samples.sort((a,b)=>a-b)[Math.floor((samples.length-1)*p)];
    // In a narrow format the pane's shadow reaches the edge of the frame.
    const rimP80=percentile(rim,.8),centreP90=percentile(centre,.9),outsideMax=outside.length?percentile(outside,1):0;
    const extraInwardP50=[percentile(extraLeft,.5),percentile(extraRight,.5)];
    measurements[axis]={rimP80,centreP90,outsideMax,extraInwardP50,unit:'logical pixels'};
    assert.ok(outsideMax<.1,`Backdrop outside panel moved by ${outsideMax} logical pixels on ${axis}`);
    if(shaded.length)assert.ok(percentile(shaded,1)<1,`Backdrop under the pane's shadow moved by ${percentile(shaded,1)} logical pixels on ${axis}`);
    assert.ok(rimP80>3&&rimP80>centreP90*2,`Edge should bend stripes more than centre on ${axis}: ${JSON.stringify(measurements[axis])}`);
    if(!capture.slab)assert.ok(extraInwardP50.every(shift=>shift>3),`Both rims must sample farther inward than the stock bevel on ${axis}: ${extraInwardP50}`);
  }
  return measurements;
}

async function opticalProbe(ps,id,safeBounds){
  await page.shoot(ps.start+ps.dur*.525);
  const capture=await page.evaluate(id=>{
    const world=window.__pkScenes[id].context.K.glass,inspection=world.inspect();
    const {lens,camera,textPlane}=inspection,canvas=world.canvas,texture=world.textureCanvas;
    if(!lens||!textPlane?.material.map||textPlane.material.map.image!==texture)throw new Error('Lens text is not a real scene texture');
    // A traced lens is a quad whose shader holds its size; a polygon lens
    // is its own geometry.
    const mesh=lens.children.find(node=>node.isMesh),slab=mesh.name==='liquid-slab';
    let box;
    if(slab){
      const {uHalf,uThick}=mesh.material.uniforms,x=uHalf.value.x,y=uHalf.value.y,z=uThick.value;
      box={min:{x:-x,y:-y,z:-z},max:{x,y,z}};
    }else{mesh.geometry.computeBoundingBox();box=mesh.geometry.boundingBox;}
    const points=[],viewport=canvas.getBoundingClientRect();
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const v=mesh.position.clone().set(x,y,z).applyMatrix4(mesh.matrixWorld).project(camera);
      points.push({x:viewport.x+(v.x+1)*viewport.width/2,y:viewport.y+(1-v.y)*viewport.height/2});
    }
    const bounds={left:Math.floor(Math.min(...points.map(p=>p.x)))-8,right:Math.ceil(Math.max(...points.map(p=>p.x)))+8,
      top:Math.floor(Math.min(...points.map(p=>p.y)))-8,bottom:Math.ceil(Math.max(...points.map(p=>p.y)))+8};
    if(!lens.visible)throw new Error('Sampling requires the lens to be in view');
    // The traced shader is clear glass of one fixed index.
    return {bounds,inkPixels:world.audit().lens.textureInkPixels,transmission:slab?1:mesh.material.transmission,ior:slab?1.5:mesh.material.ior};
  },id);
  async function setOptics(lensVisible,inkVisible){
    await page.evaluate(({id,lensVisible,inkVisible})=>{
      const world=window.__pkScenes[id].context.K.glass,{lens,textPlane,render}=world.inspect();
      const texture=textPlane.material.map,source=world.textureCanvas;
      // Replace only the ink, preserving the plane, projection, material and backdrop.
      if(!inkVisible){
        const blank=document.createElement('canvas');blank.width=source.width;blank.height=source.height;
        texture.image=blank;texture.needsUpdate=true;
      }else if(texture.image!==source){texture.image=source;texture.needsUpdate=true;}
      lens.visible=lensVisible;render();
    },{id,lensVisible,inkVisible});
  }
  // Capture the final compositor frame: the native letters outside the optical
  // footprint and the bent texture inside it are painted by different layers.
  const before=Buffer.from(await page.screenshot({type:'png'}));
  let withoutLens,withoutTexture;
  try{
    await setOptics(false,true);
    withoutLens=Buffer.from(await page.screenshot({type:'png'}));
    await setOptics(true,false);
    withoutTexture=Buffer.from(await page.screenshot({type:'png'}));
  }finally{await setOptics(true,true);}
  const restored=Buffer.from(await page.screenshot({type:'png'}));
  const restoration=await pixelDifference(before,restored);
  assert.ok(restoration.max<=report.policy.renderMaxDelta&&restoration.share<=report.policy.renderChangedShare,
    'Optical inspection must restore the composed frame: '+JSON.stringify(restoration));
  assert.equal(capture.transmission,1);assert.ok(capture.ior>1);
  assert.ok(capture.inkPixels>100,'Source texture contains painted glyph pixels');
  const [{data:glass,info},clear,withoutInk]=await Promise.all([
    sharp(before).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
    sharp(withoutLens).ensureAlpha().raw().toBuffer(),
    sharp(withoutTexture).ensureAlpha().raw().toBuffer(),
  ]);
  let changedInside=0,changedOutside=0,changedInk=0,clearInk=0,transmittedInk=0;
  const inkBounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
  const b=capture.bounds;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    const index=(y*info.width+x)*4,inside=x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;
    const delta=Math.max(...[0,1,2].map(channel=>Math.abs(glass[index+channel]-clear[index+channel])));
    if(delta>2){if(inside)changedInside++;else changedOutside++;}
    // A mesh that just obscures the DOM also changes the clear lettering. Prove
    // that the glyph texture itself contributes visible light inside the lens.
    if(inside&&[0,1,2].some(channel=>glass[index+channel]-withoutInk[index+channel]>16))transmittedInk++;
    // Fixtures use explicit white ink on a dark procedural background. Changes
    // to those actual pixels prove that the lens bends the type, not only light.
    if(clear[index]>235&&clear[index+1]>235&&clear[index+2]>235){
      inkBounds.left=Math.min(inkBounds.left,x);inkBounds.right=Math.max(inkBounds.right,x);
      inkBounds.top=Math.min(inkBounds.top,y);inkBounds.bottom=Math.max(inkBounds.bottom,y);
      if(inside){clearInk++;if(delta>8)changedInk++;}
    }
  }
  assert.ok(changedInside>100,'The physical lens changes its bounded image region');
  assert.equal(changedOutside,0,'The optical comparison leaves pixels outside the lens unchanged');
  assert.ok(clearInk>100&&changedInk>15,`The lens actually affects painted type: ${changedInk}/${clearInk}`);
  assert.ok(transmittedInk>100,`No readable ink from the optical texture inside the lens: ${transmittedInk}`);
  assert.ok(inkBounds.left>=safeBounds.left-1&&inkBounds.right<=safeBounds.right+1&&inkBounds.top>=safeBounds.top-1&&inkBounds.bottom<=safeBounds.bottom+1,
    `Main/subtitle ink fits the native safe area: ${JSON.stringify(inkBounds)}`);
  return {bounds:capture.bounds,inkBounds,textureInkPixels:capture.inkPixels,changedInside,changedOutside,changedInk,clearInk,transmittedInk,restoration};
}

function expectedCopy(scene,fraction){
  // Prompt glyphs are separate editable spans, verified as an exact prefix below.
  if(scene.type==='ask')return fraction>.5?[scene.reply]:[];
  if(scene.type==='send-prompt')return scene.chips;
  if(scene.type==='glass-flow')return fraction<.5?[scene.title,scene.body]:[scene.nextTitle,scene.nextBody];
  return scene.type==='island'?[scene.title,scene.body]:[scene.text,scene.sub];
}

// Measure the two camera states relative to the actual independently retimed
// scene. The early panel is deliberately wider than the frame.
async function checkPullback(ps,id){
  const beat=ps.dur/ps.scene.beats, {typed,pull,landed,send,sent}=ps.scene.timing;
  async function state(at){
    await page.shoot(ps.start+at*beat);
    return page.evaluate(id=>{
      const instance=window.__pkScenes[id],world=instance.context.K.glass;
      const node=instance.sceneRoot.querySelector('[data-typing-id="pullback-prompt"]');
      const panel=node.closest('[data-glass-surface]');
      const width=panel.getBoundingClientRect().width/world.canvas.getBoundingClientRect().width;
      const mention=panel.querySelector('.pk-pullback-mention');
      const button=world.inspect().scene.getObjectByName('ask-send-button');
      return {camera:world.audit().camera.position,count:Number(node.dataset.typingCount),width,
        suggestion:Boolean(panel.querySelector('.pk-pullback-suggestion')),
        // The alpha of the mention's highlight.
        mention:Number((getComputedStyle(mention).backgroundColor.match(/[\d.]+/g)??[])[3]??1),wave:world.inspect().sendWave.active,
        progressBar:Boolean(panel.querySelector('.pk-pullback-progress')),
        button:button.scale.x};
    },id);
  }
  const typing=await state((ps.scene.timing.type+typed)/2),close=await state(pull),wide=await state(landed);
  assert.ok(typing.count>0&&typing.count<close.count,'The close camera shows a partially typed request');
  assert.equal(close.count,[...ps.scene.text].length,'The pull starts with the complete request');
  assert.ok(close.width>wide.width*1.5,'The camera reveals the wider composer');
  assert.ok(wide.width<1&&wide.width>.35,'The whole card fits in the final frame');
  assert.ok(wide.camera[2]>close.camera[2],'The perspective camera moves back in Z');
  assert.ok(!typing.suggestion&&!wide.suggestion,'The composer opens no suggestion for a mention');
  assert.ok(typing.mention===0&&wide.mention>0,'A mention takes its highlight once it is typed whole');
  const before=await state(send),after=await state(send+.1),done=await state(sent);
  assert.ok(after.button<before.button,'The round Send button presses on its beat');
  assert.ok(!before.progressBar && !after.progressBar && !done.progressBar,'The composer has no progress bar');
  assert.ok(after.wave && !done.wave,'The send wave settles at its second beat anchor');
  assert.deepEqual(await state(pull),close,'Reverse seek restores the close-up');
  await state((landed+send)/2);
  return {closeWidth:close.width,landedWidth:wide.width,typingCount:typing.count,typedCount:close.count};
}

async function checkFlowPath(ps,id){
  const samples=[];
  for(let i=0;i<=40;i++){
    const fraction=.35+i*.0125;
    await page.shoot(ps.start+ps.dur*fraction);
    const audit=await page.evaluate(id=>window.__pkScenes[id].context.K.glass.audit(),id);
    samples.push({fraction,camera:audit.camera,cards:audit.cards});
  }
  assert.ok(samples.every(s=>s.camera.position.every(Number.isFinite)&&s.camera.quaternion.every(Number.isFinite)),'Finite camera path');
  const planeZ=samples[0].cards[0].position[2];
  assert.ok(samples[0].camera.position[2]>planeZ,'Camera begins in front of first glass');
  assert.ok(samples.at(-1).camera.position[2]<planeZ,'Camera actually passes the first glass');
  let maxAngularStep=0,maxPositionStep=0;
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1].camera,b=samples[i].camera;
    const dot=Math.min(1,Math.abs(a.quaternion.reduce((sum,v,j)=>sum+v*b.quaternion[j],0)));
    maxAngularStep=Math.max(maxAngularStep,2*Math.acos(dot));
    maxPositionStep=Math.max(maxPositionStep,Math.hypot(...a.position.map((v,j)=>v-b.position[j])));
    assert.ok(b.position[2]<=a.position[2]+1e-6,'Forward camera travel must not reset');
  }
  assert.ok(maxAngularStep<.08,`No orientation cut: ${maxAngularStep}`);
  const travel=Math.hypot(...samples[0].camera.position.map((value,i)=>value-samples.at(-1).camera.position[i]));
  const relativePositionStep=maxPositionStep/travel;
  // The world-unit scale grows with portrait height. Bound travel per sample
  // relative to this actual move, rather than imposing landscape-only units.
  assert.ok(relativePositionStep<.1,`No camera teleport: ${relativePositionStep} of the complete path`);
  return {samples: samples.length,planeZ,crossed:true,maxAngularStep,maxPositionStep,relativePositionStep};
}

async function isolation(aspect){
  const film={aspect,style:'glass',grain:false,sparks:false,brand:{name:'Independent glass'},
    scenes:[{...examples[0].scene,title:'First instance'},{...examples[0].scene,title:'Second instance',camera:'orbit'}]};
  await page.play(film);
  return page.evaluate(()=>{
    const a=window.__pkScenes.s1,b=window.__pkScenes.s2;
    const worldA=a.context.K.glass,worldB=b.context.K.glass;
    const canvas=instance=>instance.sceneRoot.querySelector('canvas[data-glass]');
    const read=instance=>JSON.stringify({audit:instance.context.K.glass.audit(),pixels:canvas(instance).toDataURL()});
    a.drawAt(a.clipDuration*.5);b.drawAt(b.clipDuration*.4);const first=read(a),second=read(b);
    b.drawAt(b.clipDuration*.7);const firstUnchanged=read(a)===first;
    b.drawAt(b.clipDuration*.4);const secondRestored=read(b)===second;
    const removed=canvas(b);b.dispose();a.drawAt(a.clipDuration*.5);
    return {distinctWorld:worldA!==worldB,firstUnchanged,secondRestored,disposed:worldB.audit().disposed,
      detached:!removed.isConnected&&!window.__pkScenes.s2&&!window.__timelines.s2,
      survivorUnchanged:read(a)===first,survivorAlive:!worldA.audit().disposed};
  });
}

try{
  for(const aspect of aspects){
    console.log(`Building native glass: ${aspect}`);
    const cases=examples.map(entry=>aspect==='9:16'&&entry.id==='island-static'
      ?{...entry,scene:{...entry.scene,title:'Everything you need in one place',body:portraitIslandBody}}:entry);
    const film={aspect,style:'glass',grain:false,sparks:false,pace:'normal',
      brand:{name:'Glass',font:'Geist',tokens:referencePalette?{foreground:'#ffffff'}:{background:'#101828',foreground:'#ffffff',accent:'#6366f1',accent2:'#ff6b35'}},
      scenes:cases.map(entry=>({...entry.scene,in:'cut'}))};
    const {plan}=await page.play(film);testedSourceReceipt??=page.sourceHashes;
    const bounds={width:plan.width,height:plan.height,floor:plan.type.label,
      safe:{left:plan.width*plan.safe.left,top:plan.height*plan.safe.top,right:plan.width*(1-plan.safe.right),bottom:plan.height*(1-plan.safe.bottom)}};
    for(let index=0;index<cases.length;index++){
      const entry=cases[index],ps=plan.scenes[index],id=`s${index+1}`,key=`${entry.id}-${aspect.replace(':','x')}`;
      const row={id:key,case:entry.id,aspect,passed:false,samples:[],reverseExact:true};
      report.results.push(row);
      const fractions={'glass-flow':[.32,.88],ask:[.25,.85],'send-prompt':[.78,.95]}[entry.scene.type]??[.45,.62];
      for(const fraction of fractions){
        const time=ps.start+ps.dur*fraction;await page.shoot(time);
        const state=await snapshot(id),picture=Buffer.from(await page.screenshot({type:'png'}));
        fs.writeFileSync(path.join(out,'latest-frame.png'),picture);
        fs.writeFileSync(path.join(out,'latest-state.json'),JSON.stringify({key,fraction,...state,canvas:hash(state.canvas)},null,2)+'\n');
        assert.equal(state.audit.disposed,false,key);
        if(state.audit.resolution){
          assert.equal(state.audit.resolution.previewScale,previewScale);
          assert.equal(state.audit.resolution.width,Math.round(plan.width*previewScale));
          assert.equal(state.audit.resolution.height,Math.round(plan.height*previewScale));
        }
        assert.deepEqual(projectionFindings(state),[],`${key}: projected text attachment`);
        const words=state.texts.map(text=>text.text).join(' ');
        for(const copy of expectedCopy(entry.scene,fraction).filter(Boolean))assert.ok(words.includes(copy),`${key}: visible copy ${copy}`);
        assert.deepEqual(layoutFindings(state.texts,bounds),[],`${key}: readable native text`);
        assert.deepEqual(surfaceFindings(state.design),[],`${key}: semantic card surface spacing`);
        if(entry.scene.type==='lens'){
          // Glass, clear or smoked, traces its lens; metal covers the lettering.
          assert.equal(state.audit.lens?.mechanism,state.audit.cards[0].finish.kind==='metal'?'opaque-metal':'traced-slab');
          assert.equal(state.audit.lens.text,entry.scene.text);
          assert.equal(state.audit.lens.textureReady,true);
          assert.ok(state.audit.lens.textureWidth>0&&state.audit.lens.textureHeight>0,'A raster text source exists');
          assert.ok(state.audit.lens.sourceFont,'Texture uses the fitted native font');
          assert.ok(state.raster.length&&state.raster.every(text=>text.size>=bounds.floor-.5),'Raster type retains the native readable font floor');
        }else{
          assert.ok(state.audit.surfaces.some(s=>s.opacity>=.75),'A projected text surface is visible');
          assert.ok(state.design.surfaces.some(surface=>surface.kind==='card'&&surface.visible),'Projected copy uses a semantic card surface');
          if(entry.scene.type==='ask')checkAsk(state,ps,fraction,words,key);
          else if(entry.scene.type==='send-prompt'){
            assert.ok(state.surfaces.some(surface=>surface.opacity>=.75&&surface.text.includes(entry.scene.text)),
              `${key}: editable prompt is attached to the projected panel`);
          }
          else for(const surface of state.surfaces.filter(s=>s.opacity>=.75)){
            checkCopyGrid(surface.grid,{key:`${key} card ${surface.cardIndex}`,expectIcon:!!entry.scene.icon,expectWrappedBody:entry.scene.body===portraitIslandBody});
          }
        }
        await page.shoot(ps.start+ps.dur*.96);await page.shoot(ps.start+ps.dur*.08);await page.shoot(time);
        const repeated=await snapshot(id),repeatedPicture=Buffer.from(await page.screenshot({type:'png'}));
        assert.deepEqual(repeated.audit,state.audit,`${key}: absolute world state after reverse seek`);
        assert.equal(repeated.canvas,state.canvas,`${key}: glass output canvas pixels after reverse seek`);
        assert.deepEqual(repeated.surfaces.map(({rect,...surface})=>surface),state.surfaces.map(({rect,...surface})=>surface),`${key}: exact DOM projection matrix after reverse seek`);
        const geometryDrift=Math.max(0,...state.surfaces.flatMap((surface,i)=>Object.keys(surface.rect).map(key=>Math.abs(surface.rect[key]-repeated.surfaces[i].rect[key]))));
        assert.ok(geometryDrift<=report.policy.reverseGeometryTolerance,`${key}: DOM projection geometry after reverse seek ${geometryDrift}`);
        const difference=await pixelDifference(picture,repeatedPicture);
        if(difference.max>report.policy.renderMaxDelta||difference.share>report.policy.renderChangedShare){
          fs.writeFileSync(path.join(out,`${key}-${fraction}-forward.png`),picture);
          fs.writeFileSync(path.join(out,`${key}-${fraction}-reverse.png`),repeatedPicture);
        }
        assert.ok(difference.max<=report.policy.renderMaxDelta&&difference.share<=report.policy.renderChangedShare,`${key}: compositor reverse pixels ${JSON.stringify(difference)}`);
        await sharp(picture).resize({width:960,height:960,fit:'inside'}).png().toFile(path.join(out,`${key}-${fraction}.png`));
        row.samples.push({fraction,time,texts:state.texts.length,projectionCount:state.audit.surfaces.length,projectionFindings:0,layoutFindings:0,surfaceFindings:0,
          canvasSha256:hash(state.canvas),pictureSha256:hash(picture),renderDifference:difference,lens:state.audit.lens,camera:state.audit.camera,
          cards:state.audit.cards,geometryDrift});
      }
      if(entry.scene.camera){
        const cameraTravel=Math.hypot(...row.samples[0].camera.position.map((v,i)=>v-row.samples[1].camera.position[i]));
        if(entry.scene.camera==='static')assert.equal(cameraTravel,0,'Static camera stays stationary');
        else assert.ok(cameraTravel>.001,'Orbit camera actually moves');
        row.cameraTravel=cameraTravel;
      }
      if(entry.scene.exit==='collapse'){
        await page.shoot(ps.start+ps.dur*.95);const closed=(await snapshot(id)).audit;
        const width=row.samples.at(-1).cards[0].width;
        assert.ok(closed.cards[0].width<width*.6,'Reverse morph returns to a capsule');
        assert.ok(closed.cards[0].position[0]>0,'Collapsed capsule exits the frame');
        assert.ok(closed.surfaces.every(surface=>surface.opacity===0),'Copy leaves before the capsule exit');
        row.collapse={width:closed.cards[0].width,openWidth:width,x:closed.cards[0].position[0],copyHidden:true};
        await page.shoot(ps.start+ps.dur*.62);
      }
      if(entry.scene.type==='glass-flow')row.path=await checkFlowPath(ps,id);
      if(entry.scene.type==='send-prompt')row.pullback=await checkPullback(ps,id);
      if(entry.scene.type==='lens')row.optics=await opticalProbe(ps,id,bounds.safe);
      if(entry.id==='island-static'||entry.id==='ask-static-prompt')row.panelOptics=await panelOpticalProbe(ps,id);
      // Calibrate attachment checks against a detached caption, then restore.
      if(entry.scene.type!=='lens'){
        const sampled=await snapshot(id);
        if(sampled.surfaces.length){
          const cardIndex=sampled.audit.surfaces.find(surface=>surface.opacity>=.75)?.cardIndex;
          assert.notEqual(cardIndex,undefined,'A visible surface calibrates the attachment audit');
          const original=await page.evaluate(({id,cardIndex})=>{
            const node=window.__pkScenes[id].sceneRoot.querySelector(`[data-glass-surface="${cardIndex}"]`);
            const style=node.getAttribute('style');
            node.style.transform=`translateX(12px) ${node.style.transform}`;
            return style;
          },{id,cardIndex});
          assert.ok(projectionFindings(await snapshot(id)).length,'Detached text must fail projection audit');
          await page.evaluate(({id,cardIndex,style})=>{
            const node=window.__pkScenes[id].sceneRoot.querySelector(`[data-glass-surface="${cardIndex}"]`);
            if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);
          },{id,cardIndex,style:original});
          const restored=await snapshot(id);
          assert.deepEqual(restored.surfaces.map(s=>s.matrix),sampled.surfaces.map(s=>s.matrix),'Negative control restores the authored projection matrix');
          assert.deepEqual(projectionFindings(restored),[],'Restored caption remains attached to its card');
          row.detachedTextRejected=true;
        }
      }
      row.passed=true;console.log(`Passed ${key}`);
    }
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
    const lifecycle=await isolation(aspect);
    assert.ok(Object.values(lifecycle).every(Boolean),`${aspect}: ${JSON.stringify(lifecycle)}`);
    report.groups.push({aspect,lifecycle});
  }
}catch(error){report.error=String(error.stack??error);process.exitCode=1;console.error(report.error);}
finally{
  await browser.close();
  report.testedSourceReceipt=testedSourceReceipt??page.sourceHashes;
  report.sourceAfter=sourceHashes();
  report.sourceStable=report.sourceAfter.aggregate===report.sourceReceipt.aggregate&&report.testedSourceReceipt.aggregate===report.sourceReceipt.aggregate;
  report.completed=report.results.filter(row=>row.passed).length;report.failed=report.results.filter(row=>!row.passed).length;
  report.passed=!report.error&&report.completed===report.total&&report.sourceStable;
  if(!report.passed)process.exitCode=1;
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
}
