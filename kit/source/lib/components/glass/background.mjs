// A Glass scene owns one texture source. The preview decoder follows its
// paused timeline. Offline, HyperFrames injects its FFmpeg-decoded frame
// next to the declared input and re-dispatches hf-seek before capture.
// Media from another origin (our CDN) is asked for with CORS: without it the
// frame taints the canvas and WebGL refuses it as a texture.
const foreign=(url,doc)=>{try{return new URL(url,doc.baseURI).origin!==doc.defaultView.location.origin&&/^https?:/.test(new URL(url,doc.baseURI).protocol);}catch{return false;}};
export async function loadGlassBackground(context,id){
  const {K,ps,stage,options}=context;
  const source=ps.scene.background;
  if(!source)return null;
  const doc=stage.ownerDocument;
  const path=source.image??source.video;
  const url=options.assetUrls?.[path]??path;
  if(source.image){
    const element=doc.createElement('img');
    element.alt='';if(foreign(url,doc))element.crossOrigin='anonymous';element.src=url;
    try{await element.decode();}
    catch(error){throw new Error(`Could not decode Glass background image ${path}`,{cause:error});}
    return {kind:'image',element,width:element.naturalWidth,height:element.naturalHeight};
  }

  return loadVideoSource(context,{path,inputId:'pk-background-'+id,
    width:K.W*K.previewScale,height:K.H*K.previewScale,label:'Glass background video'});
}

// One video of a scene as a canvas that holds its frame at the scene's moment,
// cropped to cover `width` x `height`. `inputId` names the <video> the film's
// page declares for it (build.cjs), which is what HyperFrames decodes offline.
export async function loadVideoSource(context,{path,inputId,width,height,label='Scene video'}){
  const {K,stage,options}=context;
  const doc=stage.ownerDocument;
  const url=options.assetUrls?.[path]??path;
  const input=doc.getElementById(inputId);
  const declared=input?.dataset.pkBackground===path?input:null;
  const win=doc.defaultView;
  const held=declared&&win.__HF_RENDER_FRAME_VIDEO_IDS?.includes(declared.getAttribute('data-hf-render-id')||declared.id);
  const element=doc.createElement('canvas');
  element.width=Math.max(1,Math.round(width));
  element.height=Math.max(1,Math.round(height));
  const ctx=element.getContext('2d',{alpha:false});
  const abort=new AbortController();
  // A detached decoder has no independent transport. Changes to the native
  // content variable can choose a different source from the compiled input.
  const decoder=held?null:doc.createElement('video');
  let wanted=0,painted=-1,pending=null,repaint,injectedSrc;
  function blit(frame,width,height){
    const scale=Math.max(element.width/width,element.height/height);
    const w=scale*width,h=scale*height;
    ctx.drawImage(frame,(element.width-w)/2,(element.height-h)/2,w,h);
    repaint?.();
  }
  function waitFor(name){
    return new Promise((resolve,reject)=>{
      const done=()=>{
        decoder.removeEventListener(name,ready);
        decoder.removeEventListener('error',failed);
        abort.signal.removeEventListener('abort',ready);
      };
      const ready=()=>{done();resolve();};
      const failed=()=>{done();reject(new Error(`Could not decode ${label} ${path}: ${decoder.error?.message??name}`));};
      decoder.addEventListener(name,ready,{once:true});
      decoder.addEventListener('error',failed,{once:true});
      abort.signal.addEventListener('abort',ready,{once:true});
    });
  }
  function injectedFrame(){
    const frame=declared?.nextElementSibling;
    if(!frame?.classList.contains('__render_frame__')||!frame.complete||!frame.naturalWidth)return false;
    if(frame.src!==injectedSrc){
      injectedSrc=frame.src;
      blit(frame,frame.naturalWidth,frame.naturalHeight);
    }
    return true;
  }
  async function decode(){
    while(!abort.signal.aborted&&painted!==wanted){
      const time=wanted;
      if(decoder.seeking||Math.abs(decoder.currentTime-time)>1e-6){
        const ready=waitFor('seeked');
        decoder.currentTime=time;
        await ready;
      }
      if(abort.signal.aborted)return;
      painted=time;
      if(!injectedFrame())blit(decoder,decoder.videoWidth,decoder.videoHeight);
    }
  }
  function seek(time){
    if(abort.signal.aborted||injectedFrame()||held)return;
    wanted=time%decoder.duration;
    if(pending||painted===wanted)return;
    pending=decode().finally(()=>{pending=null;});
    K.waitFrame(pending);
  }
  // Timeline setters run synchronously; registered async work must finish
  // before the renderer screenshots the WebGL canvas or the widget backdrop.
  const afterSeek=event=>{
    injectedFrame();
    event.detail.waitUntil?.(Promise.resolve().then(()=>Promise.all([...context.frameWaits])));
  };
  K.onDispose(()=>{
    abort.abort();win.removeEventListener('hf-seek',afterSeek);
    if(decoder){decoder.removeAttribute('src');decoder.load();}
    repaint=null;
  });
  if(decoder){
    decoder.muted=true;decoder.playsInline=true;decoder.preload='auto';
    if(foreign(url,doc))decoder.crossOrigin='anonymous';
    const ready=waitFor('loadeddata');
    decoder.src=url;decoder.load();await ready;
    if(!Number.isFinite(decoder.duration)||decoder.duration<=0)throw new Error(`${label} has no finite duration: ${path}`);
    blit(decoder,decoder.videoWidth,decoder.videoHeight);painted=0;
  }
  win.addEventListener('hf-seek',afterSeek);
  return {kind:'video',element,width:element.width,height:element.height,seek,onRepaint(callback){repaint=callback;}};
}
