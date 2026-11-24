// Run against the built catalogue with STORYBOOK_URL=http://127.0.0.1:6009 node tests/glass-backgrounds.mjs.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';

const base = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';
const executablePath = process.env.CHROME_BIN ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser',
].find(existsSync);
const index = await (await fetch(new URL('index.json',base))).json();
const stories = Object.values(index.entries).filter(entry => entry.title.startsWith('Pure Kinetic/glass/') && entry.exportName === 'Preview');
const storyURL = (id, material) => {
  const url = new URL('iframe.html',base);
  url.search = new URLSearchParams({id,viewMode:'story',globals:'aspect:portrait;brandbook:__default__;material:'+material});
  return url.href;
};

async function ready(page, kind, filename) {
  await page.waitForFunction((kind,filename) => {
    const host = document.querySelector('pk-component-story'), player = host?.querySelector('hyperframes-player');
    if (host?.dataset.state === 'error') throw Error(host.innerText);
    const win = player?.iframeElement?.contentWindow, instance = win?.__storybookComponent?.instance;
    const background = instance?.ps.scene.background;
    return host?.dataset.state === 'ready' && win?.__renderReady && instance &&
      (kind ? instance.context.K.glassBackground?.kind === kind && (!filename || background[kind] === filename) : !background);
  }, {}, kind,filename);
}

async function measure(page,time) {
  if (time !== undefined) {
    await page.evaluate(t => {const player=document.querySelector('hyperframes-player');player.pause();player.seek(t);},time);
    await page.waitForFunction(t=>Math.abs(document.querySelector('hyperframes-player').iframeElement.contentWindow.__storybookComponent.instance.localTime-t)<.001,{},time);
  }
  return page.evaluate(async () => {
    const player = document.querySelector('hyperframes-player'); player.pause();
    const win = player.iframeElement.contentWindow, instance = win.__storybookComponent.instance;
    const {K,frameWaits,options} = instance.context;
    await Promise.all([...frameWaits]);
    const {element,kind} = K.glassBackground, ref=instance.ps.scene.background[kind];
    const src=options.assetUrls?.[ref] ?? ref;
    let source=element;
    if (kind==='video') {
      // Decode a second copy at the actual HyperFrames playhead. This also
      // detects a background canvas that changed to the wrong frame on a seek.
      source=win.document.createElement('video'); source.muted=true;source.preload='auto';
      const loaded=new Promise((resolve,reject)=>{source.onloadeddata=resolve;source.onerror=reject;});
      source.src=src;await loaded;
      const seeked=new Promise(resolve=>source.onseeked=resolve);
      source.currentTime=instance.localTime%source.duration;await seeked;
    }
    const width=source.videoWidth||source.naturalWidth, height=source.videoHeight||source.naturalHeight;
    const optical = K.glass, canvas = optical?.canvas;
    const reference = win.document.createElement('canvas');
    reference.width = canvas?.width ?? 270; reference.height = canvas?.height ?? 480;
    const ctx = reference.getContext('2d'), scale = Math.max(reference.width/width,reference.height/height);
    ctx.drawImage(source,(reference.width-width*scale)/2,(reference.height-height*scale)/2,width*scale,height*scale);
    const w = reference.width, h = Math.ceil(reference.height*.06);
    // A close camera can carry the refracting rim across the top strip.
    // Sample the exposed side of the frame for a comparison to unfiltered media.
    const corners = optical?.audit().surfaces.flatMap(surface => surface.corners) ?? [];
    const top = Math.min(...corners.map(point => point.y));
    const bottom = K.H - Math.max(...corners.map(point => point.y));
    const y = corners.length && bottom > top ? reference.height - h : 0;
    const get = source => source.getContext('2d').getImageData(0,y,w,h).data;
    const referencePixels = get(reference);
    if (!optical && kind==='video') ctx.drawImage(element,0,0,reference.width,reference.height);
    const actual=optical?get(canvas):get(reference);
    let diff=0, samples=0;
    for (let n=0; n<actual.length; n+=20) {
      for (let i=0; i<3; i++) {diff+=Math.abs(actual[n+i]-referencePixels[n+i]);samples++;}
    }
    const mediaBox = element.getBoundingClientRect(), frame = instance.root.getBoundingClientRect();
    const file=source.currentSrc||source.src;
    if(kind==='video'){source.removeAttribute('src');source.load();}
    return {kind,ref,file,coverError:diff/samples,
      attached:optical?optical.inspect().backdropScene.children[0].material.map.image === element :
        element.isConnected && win.getComputedStyle(element).objectFit === 'cover' && mediaBox.width>=frame.width && mediaBox.height>=frame.height,
      pixels:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', actual))).join(',')};
  });
}

async function uploadStripeChart(page) {
  // A real PNG File follows the same picker, blob and image-decoder path as a screenshot.
  await page.$eval('.pk-background input[type=file]',async input => {
    const canvas=document.createElement('canvas'); canvas.width=1080; canvas.height=1920;
    const ctx=canvas.getContext('2d');
    for (let x=0;x<canvas.width;x++) {
      const value=Math.round(135+80*Math.sin(2*Math.PI*x/64));
      ctx.fillStyle=`rgb(${value},${value},${value})`; ctx.fillRect(x,0,1,canvas.height);
    }
    const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const transfer=new DataTransfer();transfer.items.add(new File([png],'Screen #1.png',{type:'image/png'}));
    input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await ready(page,'image','assets/Screen%20%231.png');
}

async function imageRefraction(page) {
  const uploaded=await measure(page,1.2);
  assert.ok(uploaded.file.startsWith('blob:') && uploaded.coverError<5);
  return page.evaluate(() => {
    const instance=document.querySelector('hyperframes-player').iframeElement.contentWindow.__storybookComponent.instance;
    const world=instance.context.K.glass, {scene,render}=world.inspect(), canvas=world.canvas;
    const card=scene.children.find(node=>node.isGroup), ctx=canvas.getContext('2d');
    const {corners}=world.audit().surfaces[0], k=canvas.width/instance.context.K.W;
    const left=corners[0].x*k, width=(corners[1].x-corners[0].x)*k;
    const y=Math.round((corners[0].y+corners[3].y)*k/2);
    const scan=()=>ctx.getImageData(0,y,canvas.width,1).data;
    const front=scan();card.visible=false;render();const bare=scan();card.visible=true;render();
    const shiftAt=(from,to)=>{
      let best=0,high=-Infinity;
      for (let shift=-12;shift<=12;shift++) {
        let xx=0, yy=0, xy=0,sx=0,sy=0,n=0;
        for(let x=Math.round(left+width*from);x<left+width*to;x++) {
          const a=front[x*4], b=bare[(x+shift)*4];
          xx+=a*a; yy+=b*b; xy+=a*b; sx+=a; sy+=b; n++;
        }
        const score=(xy-sx*sy/n)/Math.sqrt((xx-sx*sx/n)*(yy-sy*sy/n));
        if(score>high){ high=score; best=shift; }
      }
      return {shift:best,correlation:high};
    };
    return [shiftAt(.14,.34),shiftAt(.66,.86)];
  });
}

const browser = await puppeteer.launch({executablePath,headless:true,
  args:['--enable-webgl','--ignore-gpu-blocklist','--no-sandbox']});
try {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.setViewport({width:1100,height:840});
  assert.equal(stories.length,8);
  for (const story of stories) {
    const type = story.title.split('/').at(-1);
    await page.goto(storyURL(story.id,'glass'));
    await ready(page);
    for (const kind of ['image','video']) {
      await page.select('.pk-background select',kind);
      await ready(page,kind);
      const first = await measure(page,.7);
      assert.ok(first.attached,`${type}: ${kind} must be the real scene backdrop`);
      assert.ok(first.coverError<13,`${type}: ${kind} colour/crop error ${first.coverError}`);
      if (kind==='video') {
        const second = await measure(page,1.4), back = await measure(page,.7);
        assert.ok(second.coverError<13,`${type}: wrong video frame ${second.coverError}`);
        assert.notEqual(second.pixels,first.pixels,type+' video must change the rendered backdrop');
        assert.equal(back.pixels,first.pixels,type+' reverse seek must restore the same decoded frame');
      }
    }
    await page.select('.pk-background select','component'); await ready(page);
    console.log(type+' image, video, reverse and reset passed');
  }
  await page.goto(storyURL('pure-kinetic-glass-ask--preview','dark-glass')); await ready(page);
  const mediaFile = fileURLToPath(new URL('../public/pk/assets/glass-street.mp4',import.meta.url));
  await (await page.$('.pk-background input[type=file]')).uploadFile(mediaFile);
  await ready(page,'video','assets/glass-street.mp4');
  const uploaded = await measure(page,.8);
  assert.ok(uploaded.file.startsWith('blob:') && uploaded.attached && uploaded.coverError<13);
  await page.evaluate(()=>document.querySelector('hyperframes-player').play());
  await page.waitForFunction(()=>document.querySelector('hyperframes-player').currentTime>.95);
  await page.evaluate(()=>document.querySelector('hyperframes-player').seek(1.7));
  await page.waitForFunction(()=>document.querySelector('hyperframes-player').iframeElement.contentWindow.__storybookComponent.instance.localTime>=1.7);
  await page.evaluate(()=>document.querySelector('hyperframes-player').pause());
  const afterPlayingSeek = await measure(page);
  assert.ok(afterPlayingSeek.coverError<13,'a seek during playback must refresh the video under glass');
  assert.ok(!(await page.$eval('.pk-recipe pre',el=>el.textContent)).includes('blob:'));
  await page.select('.pk-background select','component'); await ready(page);
  console.log('local video upload, portable recipe and reset passed');
  for (const material of ['glass','dark-glass']) {
    await page.goto(storyURL('pure-kinetic-glass-ask--preview',material)); await ready(page);
    await uploadStripeChart(page);
    const [left,right] = await imageRefraction(page);
    assert.ok(left.shift*right.shift<0 && Math.min(left.correlation,right.correlation)>.7,
      material+' must transmit the uploaded pattern and bend its two sides in opposite directions: '+JSON.stringify([left,right]));
    console.log(material+' uploaded screenshot refraction in preview pixels',left.shift,right.shift);
  }
  // Storybook can recreate its preview iframe during navigation. The selected
  // file belongs to this example and remains available when it is reopened.
  const managerURL=new URL(base);managerURL.searchParams.set('path','/story/materials-ask--glass');
  await page.goto(managerURL.href);
  const preview=async ()=>(await page.waitForSelector('#storybook-preview-iframe')).contentFrame();
  let frame=await preview();await ready(frame);
  await (await frame.$('.pk-background input[type=file]')).uploadFile(mediaFile);
  await ready(frame,'video','assets/glass-street.mp4');
  await page.click('#materials-ask--dark-glass');
  frame=await preview();await frame.waitForFunction(()=>document.querySelector('hyperframes-player')?.iframeElement.contentWindow.__storybookComponent?.film.material==='dark-glass');
  await ready(frame);
  await page.click('#materials-ask--glass');
  frame=await preview();await ready(frame,'video','assets/glass-street.mp4');
  assert.ok((await measure(frame,.7)).file.startsWith('blob:'));
  await frame.select('.pk-background select','component');await ready(frame);
  console.log('uploaded file is scoped to one story and survives navigation');
} finally {
  await browser.close();
}
