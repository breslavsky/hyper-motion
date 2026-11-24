import {WaveRenderer} from '../../vendor/distortion-waves/renderer.mjs';
import {
  PALETTES,defaultStyle,duration,makeParticles,newFront,particleAt,rimLumps,waveFront,
} from '../../vendor/distortion-waves/model.mjs';

// Scene hosts may coexist and seek independently. Each copies the output
// immediately, so they can share the original GPU programs and screen textures.
const renderers=new WeakMap();

function borrowRenderer(doc){
  let shared=renderers.get(doc);
  if(!shared){
    const canvas=doc.createElement('canvas');
    shared={canvas,renderer:new WaveRenderer(canvas,{alpha:true}),refs:0};
    renderers.set(doc,shared);
  }
  shared.refs++;
  return shared;
}

// tune changes the upstream style after the defaults here, in virtual points.
export function createSendWave({document,width,height,radius,source,tune=null}){
  // Match the upstream controller's automatic CSS-pixel to virtual-point scale.
  const scale=Math.max(.6,Math.min(2.2,Math.sqrt(width*height/(393*852))));
  const w=width/scale,h=height/scale;
  const button={};
  function setSource(from){Object.assign(button,{x:from.x/scale,y:from.y/scale,w:from.w/scale,h:from.h/scale});}
  setSource(source);
  const style=defaultStyle('vertical');
  style.palette=PALETTES.green;
  // Keep the pre-launch glow at the button while the surrounding text stays live.
  style.pull=0;
  style.cornerRadius=radius/scale;
  style.hairlineWidth/=Math.sqrt(scale);
  style.particleSize/=Math.sqrt(scale);
  tune?.(style);
  const particles=makeParticles(style),dots={data:new Float32Array(particles.length*3),count:0};
  const front=newFront(),spot={x:0,y:0,a:0},total=duration(style);
  const frame={floor:0,gain:1,round:true,same:true};
  const pixelsW=Math.max(1,Math.round(width)),pixelsH=Math.max(1,Math.round(height));
  let shared=null,disposed=false;

  function available(){
    if(disposed)return false;
    shared??=borrowRenderer(document);
    return !shared.renderer.lost;
  }

  return {
    get available(){return available();},
    // The wave may leave another place of the same surface.
    setSource,
    draw(progress,captureScreen){
      if(!(progress>0&&progress<1)||!available())return null;
      const {canvas,renderer}=shared;
      if(canvas.width!==pixelsW)canvas.width=pixelsW;
      if(canvas.height!==pixelsH)canvas.height=pixelsH;
      waveFront(progress,button,w,h,style,null,front);
      // Glow, rim and particles draw directly over the live DOM. Only a
      // moving optical lens needs a fresh screen and its blur textures.
      if(front.energy>0||front.gravity>0)renderer.setScreen(captureScreen(),w,h,style.blur);
      else renderer.setSize(w,h);
      dots.count=0;
      for(const particle of particles){
        particleAt(particle,front,button,style,spot);
        if(spot.a<=.002)continue;
        const i=dots.count++*3;
        dots.data[i]=spot.x;
        dots.data[i+1]=spot.y;
        dots.data[i+2]=Math.floor(particle.size*10)+Math.min(spot.a,.999);
      }
      renderer.render(front,style,rimLumps(progress*total,w,h,style.cornerRadius,style.rimPulse),dots,frame);
      return canvas;
    },
    dispose(){
      if(disposed)return;
      disposed=true;
      if(!shared||--shared.refs)return;
      shared.renderer.dispose();
      // The detached pooled canvas is never remounted.
      if(shared.renderer.ok)shared.canvas.getContext('webgl2').getExtension('WEBGL_lose_context')?.loseContext();
      renderers.delete(document);
    },
  };
}
