// Run against the built Storybook with STORYBOOK_URL=http://127.0.0.1:6009 node tests/ask-optics.mjs.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import puppeteer from 'puppeteer-core';
import definitions from '../../../templates/pure-kinetic/source/lib/components/metadata.cjs';

const executablePath = process.env.CHROME_BIN ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);

async function measureReply(page, times) {
  return page.evaluate(async ([hold, expanded]) => {
    const win = document.querySelector('hyperframes-player').iframeElement.contentWindow;
    const instance = win.__storybookComponent.instance;
    const world = instance.context.K.glass;
    const {scene, backdropScene, render} = world.inspect();
    const card = scene.children.find(node => node.isGroup);
    const {canvas} = world, {width, height} = canvas;
    const ctx = canvas.getContext('2d'), read = () => ctx.getImageData(0, 0, width, height).data;
    const draw = t => instance.drawAt(instance.ps.start - instance.clipStart + t / instance.ps.speed);
    const corners = () => world.audit().surfaces[0].corners.map(p =>
      [p.x * width / instance.context.K.W, p.y * height / instance.context.K.H]);

    draw(.58);
    const enteringCamera = world.audit().camera;
    draw(hold);
    const settledCamera = world.audit().camera;
    const original = read(), before = corners();
    draw(expanded);
    const replyCamera = world.audit().camera;
    const after = corners(), end = read();
    const digest = await crypto.subtle.digest('SHA-256', end);
    const frameHash = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2,'0')).join('');
    const top = Math.max(before[0][1], before[1][1]), left = Math.max(before[0][0], before[3][0]);
    const w = before[1][0] - before[0][0], h = before[3][1] - before[0][1];
    const quantile = (values, f) => values.sort((a,b) => a-b)[Math.floor((values.length-1)*f)];
    const samples = (x0, y0, x1, y1, fn) => {
      const result = [];
      for (let y = Math.ceil(y0); y < y1; y += 2) {
        for (let x = Math.ceil(x0); x < x1; x += 2) result.push(fn(4*(y*width+x)));
      }
      return result;
    };
    const maxDifference = (a, b, n) => Math.max(...[0,1,2].map(k => Math.abs(a[n+k]-b[n+k])));
    const outside = quantile(samples(6,6,width-6,top-8,n => maxDifference(original,end,n)),.95);

    // An unchanging stripe pattern lets the test measure *where* the lens samples
    // the backdrop independently of surface tint, lighting and DOM lettering.
    const THREE = await import(new URL('lib/vendor/three/three.module.min.js', win.location.href));
    const chart = win.document.createElement('canvas');
    chart.width = 1; chart.height = height;
    const ink = chart.getContext('2d'), texture = new THREE.CanvasTexture(chart);
    texture.colorSpace = THREE.SRGBColorSpace;
    const backdrop = backdropScene.children[0], backdropVisible = backdrop.visible;
    const saved = backdropScene.background, visible = card.visible;
    const period = 96, start = [], stop = [], bare = [];
    let lightChange;
    try {
      backdrop.visible = false;
      backdropScene.background = texture;
      ink.fillStyle = '#000';
      ink.fillRect(0,0,1,height); texture.needsUpdate = true;
      draw(hold); const firstLight = read(); draw(expanded); const lastLight = read();
      lightChange = quantile(samples(left+w*.1,top+4,left+w*.28,top+h*.40,
        n => maxDifference(firstLight,lastLight,n)),.95);

      for (let phase = 0; phase < 4; phase++) {
        for (let y=0; y<height; y++) {
          const v = Math.round(145 + 85 * Math.cos(2*Math.PI*(y+.5)/period + phase*Math.PI/2));
          ink.fillStyle = 'rgb('+v+','+v+','+v+')';
          ink.fillRect(0,y,1,1);
        }
        texture.needsUpdate = true;
        draw(hold); start.push(read());
        draw(expanded); stop.push(read());
        card.visible = false; render(); bare.push(read());
        card.visible = visible;
      }
    } finally {
      backdropScene.background = saved;
      backdrop.visible = backdropVisible;
      card.visible = visible;
      texture.dispose();
      draw(expanded);
    }
    const phase = (shots,n) => Math.atan2(shots[3][n+1]-shots[1][n+1],shots[0][n+1]-shots[2][n+1]);
    const distance = (a,b,n) => {
      const d = phase(a,n)-phase(b,n);
      return Math.abs(Math.atan2(Math.sin(d),Math.cos(d))*period/(2*Math.PI));
    };
    const drift = quantile(samples(left+w*.17,top+h*.14,left+w*.78,top+h*.40,
      n => distance(start,stop,n)),.90);
    const bottom = Math.min(after[2][1],after[3][1]);
    const bend = quantile(samples(left+w*.22,bottom-14,left+w*.78,bottom-3,
      n => distance(stop,bare,n)),.85);
    return {before,after,drift,bend,lightChange,outside,frameHash,enteringCamera,settledCamera,replyCamera};
  }, times);
}

async function measureSend(page, send) {
  const iframe = await page.evaluateHandle(() => document.querySelector('hyperframes-player').iframeElement);
  const frame = await iframe.asElement().contentFrame();
  await iframe.dispose();
  return frame.evaluate(async send => {
    const win = window;
    const THREE = await import(new URL('lib/vendor/three/three.module.min.js',win.location.href));
    const {instance} = win.__storybookComponent;
    const {canvas,inspect} = instance.context.K.glass, {scene,camera,render} = inspect();
    const button = scene.getObjectByName('ask-send-button'), face = button?.getObjectByName('ask-send-face');
    const lens = button?.getObjectByName('ask-send-lens'), slot = instance.sceneRoot.querySelector('.pk-glass-ask-send');
    // The send action is a glyph printed on the pane, with no lens over it.
    if (!slot || !face?.isMesh) throw new Error('Missing native send button or its layout slot');
    const draw = t => instance.drawAt(instance.ps.start-instance.clipStart+t/instance.ps.speed);
    const ctx = canvas.getContext('2d');
    const project = p => {
      p.project(camera);
      return {x:(1+p.x)*canvas.width/2, y:(1-p.y)*canvas.height/2};
    };
    // x and y from -1 to 1 across the button's printed disc.
    face.geometry.computeBoundingSphere();
    const reach = face.geometry.boundingSphere.radius;
    const onLens = (x,y) => face.localToWorld(face.position.clone().set(x*reach, y*reach, 0));
    const screen = (x,y) => project(onLens(x,y));
    const alignment = time => {
      draw(time);
      const rect = slot.getBoundingClientRect(), viewport = canvas.getBoundingClientRect();
      const anchor = project(button.getWorldPosition(button.position.clone()));
      const dx = viewport.x+anchor.x/canvas.width*viewport.width-(rect.left+rect.width/2);
      const dy = viewport.y+anchor.y/canvas.height*viewport.height-(rect.top+rect.height/2);
      return Math.hypot(dx,dy)/rect.width;
    };
    const slotError = [send,send+.11,send+.55].map(alignment);
    draw(send);
    const scale = button.scale.x, pressed = send+.11;
    draw(pressed);
    const pressedRatio = button.scale.x/scale, pressedPixels = canvas.toDataURL();
    draw(send+.55); draw(pressed);
    const reverse = pressedPixels === canvas.toDataURL();
    draw(send);
    const r = Math.abs(screen(1,0).x-screen(-1,0).x)/2;
    const c = screen(0,0), x0 = Math.floor(c.x-r*1.4), y0 = Math.floor(c.y-r*1.4);
    const size = Math.ceil(r*2.8)+1, read = () => ctx.getImageData(x0,y0,size,size).data;
    const index = (x,y) => {
      const p = screen(x,y);
      return 4*((Math.floor(p.y)-y0)*size+Math.floor(p.x)-x0);
    };
    const image = read();
    const light = (x,y) => {
      const n = index(x,y);
      return [0.2126,0.7152,0.0722].reduce((sum,w,i) => {
        const v = image[n+i]/255;
        return sum + w*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
      },0);
    };
    const median = values => values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
    // Look across the projected shaft centreline. Perspective and refraction
    // can move this narrow stem by a pixel relative to the top of the lens.
    const contrast = median([-.12,-.2,-.28].map(y => {
      const surround = (light(-.29,y)+light(.29,y))/2;
      return Math.max(...[-1,0,1].map(dx => {
        const ink = light(dx/r,y);
        return (Math.max(ink,surround)+.05)/(Math.min(ink,surround)+.05);
      }));
    }));
    const print = face.material.map.image, pixels = print.getContext('2d').getImageData(0,0,print.width,print.height).data;
    let first = print.height, last = -1;
    for(let y=0;y<print.height;y++){
      const i=4*(y*print.width+Math.floor(print.width/2));
      if(Math.max(...[0,1,2].map(k=>Math.abs(pixels[i+k]-pixels[k])))<64)continue;
      first=Math.min(first,y);last=Math.max(last,y);
    }
    // The print covers the whole disc, which fills the layout slot.
    const glyphHeight = (last-first+1)/print.height;
    return {slotError,pressedRatio,reverse,contrast,glyphHeight,lens:Boolean(lens)};
  },send);
}

const browser = await puppeteer.launch({executablePath,headless:true,
  args:['--enable-webgl','--ignore-gpu-blocklist','--no-sandbox']});
try {
  for (const [material,camera] of [['glass','static'],['dark-glass','static'],['metal','static'],['dark-glass','orbit']]) {
    const page = await browser.newPage();
    try {
      await page.setViewport({width:1100,height:820});
      const origin = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';
      const url = new URL('iframe.html',origin.endsWith('/') ? origin : origin + '/');
      url.search = new URLSearchParams({id:'pure-kinetic-glass-ask--variant-camera-'+camera,viewMode:'story',
        globals:'aspect:portrait;brandbook:__default__;material:'+material});
      await page.goto(url.href);
      await page.waitForFunction(() => document.querySelector('hyperframes-player')?.iframeElement?.contentWindow?.__renderReady === true);
      const {scene,duration,playerWidth} = await page.evaluate(() => {
        const player=document.querySelector('hyperframes-player');player.pause(); player.removeAttribute('controls');
        const i=player.iframeElement.contentWindow.__storybookComponent.instance;
        return {scene:i.ps.scene,duration:i.ps.ldur,playerWidth:player.getBoundingClientRect().width};
      });
      assert.equal(scene.camera,camera);
      const {reply,send} = definitions.ask.times(scene,duration);
      const button = await measureSend(page,send);
      console.log(material,camera,'send',JSON.stringify(button));
      assert.ok(button.slotError.every(v=>v<.03),'3D button must follow the projected layout slot throughout the send and reply');
      assert.ok(Math.abs(button.pressedRatio-.86)<.01 && button.reverse,'Reverse seek must restore the same pressed frame');
      assert.ok(button.contrast>=3,'The native arrow must remain legible on the rendered button');
      assert.ok(button.glyphHeight>.3 && button.glyphHeight<.5,'The smaller arrow should occupy less than half the button height');
      assert.equal(button.lens,false,'The send action is printed on the pane, with no lens of its own');
      const times = [reply,reply+.32];
      const base = await measureReply(page,times);
      await page.setViewport({width:570,height:520});
      await page.waitForFunction(w => Math.abs(document.querySelector('hyperframes-player').getBoundingClientRect().width-w)>30,{},playerWidth);
      const resized = await measureReply(page,times);
      const {frameHash,enteringCamera,settledCamera,replyCamera,...metrics}=base;
      assert.equal(frameHash, resized.frameHash, material+' changed the authored frame when the preview resized');
      for (const key of ['position','quaternion']) {
        assert.ok(settledCamera[key].every((v,j) => Math.abs(v-replyCamera[key][j]) < 1e-10),
          'The camera should hold while the panel reveals the answer');
      }
      if(camera==='orbit')assert.notDeepEqual(enteringCamera,settledCamera,'The entry should retain its orbit');
      console.log(material,camera,JSON.stringify(metrics));
      assert.ok(Math.hypot(...base.before[0].map((v,j)=>v-base.after[0][j])) < 1,material+' moved the top corner');
      assert.ok(base.after[2][1]-base.before[2][1]>20,material+' did not extend the lower edge');
      assert.ok(base.outside <= 1,material+' moved the backdrop behind the static camera');
      if (material !== 'metal') {
        assert.ok(base.drift <= 1,material+' displaced stationary stripes in the existing upper face');
        assert.ok(base.lightChange <= 3,material+' moved the upper reflection as the reply opened');
        assert.ok(base.bend >= 2,material+' lost refraction at the new lower edge');
      }
    } finally {await page.close();}
  }
} finally {await browser.close();}
