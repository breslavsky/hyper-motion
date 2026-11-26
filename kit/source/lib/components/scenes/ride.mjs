// One ball rides through a row of controls under one camera, never a cut.
// The way between two poses is the shared camera's (../camera/camera.mjs), which was taken out of this scene.
// Grown from components/ui-world (one switch, one jump, one slider,
// camera poses set by hand per format): here the stops are a list, and the layout, the
// hops and the camera are worked out from it. The world is laid out at the closing view
// (zoom 1, every control inside the safe area, type at its own size); a close-up is that
// world enlarged, so nothing is ever drawn smaller than it is laid out.
import metadata from '../metadata.mjs';
import {travel} from '../camera/camera.mjs';

const clamp=(value,low=0,high=1)=>Math.max(low,Math.min(high,value));
const mix=(a,b,k)=>a+(b-a)*k;
const smooth=u=>{const k=clamp(u);return k*k*(3-2*k);};
const out=u=>1-(1-clamp(u))**3;

// Controls in rows read as written, so a hop is to a neighbour except at a row's end.
export function rideGrid(count,W,H) {
  const wide=W>H*1.25,tall=H>W*1.25;
  const cols=wide?(count<=3?count:Math.ceil(count/2)):tall?(count<=3?1:2):(count<=2?count:2);
  return {cols,rows:Math.ceil(count/cols)};
}

// Where the ball is, what each control shows and where the camera looks, at a moment.
// Pure: the same moment gives the same answer whatever was asked before.
export function rideState(model,l) {
  const {stops,times:t,overview}=model;
  const values=stops.map((stop,i)=>{
    const s=t.stops[i];
    if(stop.kind==='stepper')return s.steps.filter(at=>l>=at).length;
    if(stop.kind==='slider')return out((l-s.act.from)/(s.act.to-s.act.from))*s.value;
    if(stop.kind==='switch')return smooth((l-s.act.from)/(s.act.to-s.act.from));
    return clamp((l-s.act.from)/(s.act.to-s.act.from));
  });
  const rest=i=>stops[i].rest(values[i]);
  let ball,squash=0,hidden=0;
  const next=t.stops.findIndex(s=>l<s.land);
  const current=next<0?stops.length-1:next-1;
  if(next===0){
    // The drop that starts the ride: straight down onto the first control.
    const u=clamp((l-t.stops[0].leave)/t.hop),to=stops[0].entry;
    ball={x:to.x,y:to.y-model.drop*(1-u*u)};
  }else if(next>0&&l>=t.stops[next].leave){
    const u=(l-t.stops[next].leave)/t.hop,from=stops[next-1].rest(values[next-1]),to=stops[next].entry;
    const k=smooth(u),lift=Math.max(model.lift,Math.hypot(to.x-from.x,to.y-from.y)*.24);
    ball={x:mix(from.x,to.x,k),y:mix(from.y,to.y,k)-lift*4*u*(1-u)};
  }else ball=rest(current);
  if(current>=0){
    const s=t.stops[current],stop=stops[current];
    const since=stop.kind==='stepper'?l-(s.steps.filter(at=>l>=at).at(-1)??s.land):l-s.land;
    squash=since>=0&&since<.16?Math.sin(since/.16*Math.PI):0;
    // A stepper is bounced on: the ball leaves the key between its counts.
    if(stop.kind==='stepper'&&next!==0&&!(next>0&&l>=t.stops[next].leave)){
      const k=s.steps.findIndex((at,j)=>l>=at&&l<(s.steps[j+1]??-1));
      if(k>=0){const u=(l-s.steps[k])/(s.steps[k+1]-s.steps[k]);ball={x:ball.x,y:ball.y-model.lift*.55*4*u*(1-u)};}
    }
    // A checkbox takes the ball in: it is the tick's ink until it hops on.
    if(stop.kind==='check'&&!(next>0&&l>=t.stops[next].leave))hidden=values[current];
  }
  // The camera: the close-up of the control the ball is on, following a thumb half-way,
  // carried to the next one during the hop with a small pull-back in the air.
  // It follows a thumb half-way, as far as the control stays whole in view.
  const pose=i=>{const p=stops[i].pose,r=rest(i),slack=p.slack??0;return {x:p.x+clamp((r.x-p.x)*.5,-slack,slack),y:p.y,zoom:p.zoom};};
  let camera;
  if(next<=0&&next!==-1||current<0)camera=pose(0);
  else if(next>0&&l>=t.stops[next].leave-.08){
    const k=smooth((l-(t.stops[next].leave-.08))/(t.hop+.2)),a=pose(next-1),b=stops[next].pose;
    camera=travel(a,b,k,.1);camera.zoom=Math.max(1,camera.zoom);
  }else camera=pose(current);
  if(l>t.overview){
    const k=smooth((l-t.overview)/(t.settle-t.overview));
    camera={x:mix(camera.x,overview.x,k),y:mix(camera.y,overview.y,k),zoom:mix(camera.zoom,overview.zoom,k)};
  }
  const resting=next===0||(next>0&&l>=t.stops[next].leave)?-1:current;
  return {ball,squash,hidden,values,camera,current,resting,closing:smooth((l-t.overview)/(t.settle-t.overview))};
}

export function createFamily(K) {
  const definition={...metadata.ride,build({p,cam,fg,accent,bg}){
    const s=p.scene,errors=this.validate(s);
    if(errors.length)throw new Error(`ride: ${errors.join('; ')}`);
    const {W,H,S,safe,el,set,px,alpha,mixHex,textOn}=K;
    const len=p.ldur??p.dur,t=this.times(s,len,p.beatLen);
    const hex=(a,b,k)=>`#${mixHex(a,b,k).match(/\d+/g).slice(0,3).map(v=>Number(v).toString(16).padStart(2,'0')).join('')}`;
    const control=hex(bg,fg,.14),quiet=hex(bg,fg,.5),onAccent=textOn(accent);
    const rect=(node,x,y,w,h)=>set(node,{position:'absolute',left:px(x),top:px(y),width:px(w),height:px(h)});
    const world=el('div','',cam);world.dataset.rideWorld='';
    set(world,{position:'absolute',left:'0',top:'0',width:px(W),height:px(H),transformOrigin:'0 0'});

    const gap=K.design.space(2);
    const title=s.title?el('div','bold',world,s.title):null;
    if(title){
      title.dataset.rideTitle='';rect(title,safe.x,safe.y,safe.w,0);set(title,{height:'auto',color:fg,textAlign:'center'});
      K.design.fitSize(title,safe.w,Math.min(safe.h*.2,K.design.type('sceneTitle').lineHeight*2),'sceneTitle');
    }
    const titleH=title?title.offsetHeight+gap*3:0;
    // Names are whole lines and rows never overlap. The layout is the first that holds both:
    // the names in their own role with as many controls in a row as the frame suggests, then
    // fewer in a row, then the same again in the smaller label role.
    const bubbleH=K.design.type('label').lineHeight+K.design.space(1);
    const measure=role=>s.stops.map(stop=>{
      const probe=el('span','bold',world,stop.label);K.design.apply(probe,role);
      set(probe,{position:'absolute',whiteSpace:'nowrap'});const width=probe.scrollWidth;probe.remove();return width;
    });
    const layoutFor=(role,cols)=>{
      const labelH=K.design.type(role).lineHeight,widths=measure(role);
      const rows=Math.ceil(s.stops.length/cols),cellW=safe.w/cols,roomH=(safe.h-titleH)/rows;
      // One ball for the whole ride, sized by the tightest cell.
      // A control takes about half the safe width at most, also when it stands alone in its
      // row: the close-up then has somewhere to go, and the closing view shows the whole.
      const r=Math.max(16*S,labelH*.5,Math.min(52*S,cellW*.085,safe.w*.042,(roomH-labelH-gap*3)*.17));
      const wide=(stop,i)=>stop.kind==='check'?r*3+gap+widths[i]:stop.kind==='button'?widths[i]+r*2.4:widths[i];
      const tall=stop=>stop.kind==='switch'?r*2.5+gap+labelH:stop.kind==='slider'?r*2+gap*1.7+labelH+bubbleH
        :stop.kind==='button'?r*5.1:stop.kind==='check'?r*3:r*4.7+gap+labelH;
      const fits=s.stops.every((stop,i)=>wide(stop,i)<=cellW*.94)&&Math.max(...s.stops.map(tall))+gap<=roomH;
      return {role,labelH,widths,cols,rows,cellW,roomH,r,fits};
    };
    const preferred=rideGrid(s.stops.length,W,H).cols;
    let layout;
    search:for(const role of ['controlLabel','label'])for(let cols=preferred;cols>=1;cols--){
      layout=layoutFor(role,cols);if(layout.fits)break search;
    }
    const {role,labelH,widths,cols,rows,cellW,r}=layout,nameW=cellW*.94;
    const controlW=Math.min(cellW*.84,r*13,safe.w*.54);
    // The title and the rows are one block in the middle of the frame.
    const cellH=Math.min(layout.roomH,r*11+labelH*2);
    const top=safe.y+(safe.h-titleH-cellH*rows)/2+titleH;
    if(title)set(title,{top:px(top-titleH)});
    const ink=(node,name=role)=>{K.design.apply(node,name);set(node,{whiteSpace:'nowrap'});return node;};

    // A switch and a slider have a thumb of their own, the ball's twin: the ball lands
    // on it and is it while it rests there, so the control is whole before and after.
    const knob=parent=>{
      const node=el('div','',parent);
      set(node,{position:'absolute',left:px(-r),top:px(-r),width:px(r*2),height:px(r*2),borderRadius:'50%',background:fg,
        boxShadow:`0 ${px(4*S)} ${px(10*S)} ${alpha(fg,.2)}`});
      return node;
    };
    const place=(node,x,y,here)=>set(node,{transform:`translate(${px(x)},${px(y)})`,opacity:here?'0':'1'});
    const stops=s.stops.map((stop,i)=>{
      const row=Math.floor(i/cols),inRow=i%cols,last=row===rows-1?s.stops.length-row*cols:cols;
      // A short last row is centred; odd rows run back, so the ride snakes.
      const col=row%2?last-1-inRow:inRow,x0=safe.x+(safe.w-last*cellW)/2;
      const cx=x0+(col+.5)*cellW,cy=top+(row+.5)*cellH+(stop.kind==='stepper'?-labelH*.2:stop.kind==='slider'?0:labelH*.3);
      const node=el('div','',world);node.dataset.rideStop=`${i}:${stop.kind}`;
      set(node,{position:'absolute',left:'0',top:'0'});
      const label=(text,x,y,w,align='center')=>{
        const line=el('div','bold',node,text);rect(line,x,y,w,labelH);
        set(line,{height:'auto',color:fg,textAlign:align});return ink(line);
      };
      const made={kind:stop.kind,value:t.stops[i].value,node,cx,cy};
      if(stop.kind==='switch'){
        const tw=r*4.6,th=r*2.5,x=cx-tw/2,track=el('div','',node);
        rect(track,x,cy-th/2,tw,th);set(track,{borderRadius:px(th/2)});
        label(stop.label,cx-nameW/2,cy-th/2-gap-labelH,nameW);
        const off={x:x+th/2,y:cy},on={x:x+tw-th/2,y:cy},thumb=knob(node);
        Object.assign(made,{entry:off,rest:v=>({x:mix(off.x,on.x,v),y:cy}),box:{w:tw,h:th+gap+labelH},top:cy-th/2-gap-labelH,bottom:cy+th/2,
          draw(v,here){set(track,{background:mixHex(control,accent,v)});place(thumb,mix(off.x,on.x,v),cy,here);}});
      }else if(stop.kind==='slider'){
        // The track is shorter than the control by the thumb at each end, so the ball stays inside it.
        const L=controlW-r*2,th=Math.max(6*S,r*.42),x=cx-L/2,track=el('div','',node),fill=el('div','',node);
        rect(track,x,cy-th/2,L,th);set(track,{borderRadius:px(th/2),background:control});
        rect(fill,x,cy-th/2,0,th);set(fill,{borderRadius:px(th/2),background:accent});
        label(stop.label,cx-nameW/2,cy-r-gap-labelH,nameW);
        const bubble=el('div','bold',node,'0');K.design.apply(bubble,'label');
        const bw=K.design.type('label').lineHeight*2.2,bh=bubbleH;
        // The value hangs under the thumb, so the name above needs one line only.
        rect(bubble,0,cy+r+gap*.7,bw,bh);
        set(bubble,{display:'flex',alignItems:'center',justifyContent:'center',color:onAccent,background:accent,borderRadius:px(bh/2),whiteSpace:'nowrap'});
        const thumb=knob(node);
        Object.assign(made,{entry:{x,y:cy},rest:v=>({x:x+L*v/100,y:cy}),box:{w:L+r*2,h:r*2+gap*1.7+labelH+bh},level:true,top:cy-r-gap-labelH,bottom:cy+r+gap*.7+bh,
          draw(v,here,live){
            place(thumb,x+L*v/100,cy,here);
            set(fill,{width:px(L*v/100)});bubble.textContent=String(Math.round(v));
            set(bubble,{left:px(x+L*v/100-bw/2),opacity:live.toFixed(4),transform:`scale(${(.8+.2*live).toFixed(4)})`});
          }});
      }else if(stop.kind==='button'){
        const bw=Math.min(nameW,Math.max(controlW*.86,widths[i]+r*2.4)),bh=r*3.1,key=el('div','',node);
        rect(key,cx-bw/2,cy-bh/2,bw,bh);set(key,{borderRadius:px(bh/2),display:'flex',alignItems:'center',justifyContent:'center',transformOrigin:'50% 50%'});
        const text=el('div','bold',key,stop.label);ink(text);
        const on={x:cx,y:cy-bh/2-r};
        Object.assign(made,{entry:on,rest:()=>on,box:{w:bw,h:bh+r*2},top:cy-bh/2-r*2,bottom:cy+bh/2,
          draw(v){
            // Pressed on the landing, then it stays the film's colour: done.
            const press=Math.sin(Math.min(1,v)*Math.PI);
            set(key,{background:mixHex(control,accent,Math.min(1,v*3)),transform:`scale(${(1-.06*press).toFixed(4)})`});
            set(text,{color:v>.17?onAccent:fg});
          }});
      }else if(stop.kind==='check'){
        const side=r*3,rowW=Math.min(nameW,side+gap+widths[i]),x=cx-rowW/2,box=el('div','',node);
        rect(box,x,cy-side/2,side,side);set(box,{borderRadius:px(K.design.radius(2)),boxSizing:'border-box',border:`${px(Math.max(2,3*S))} solid ${quiet}`});
        box.innerHTML=`<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M5.5 12.5l4.2 4.2 8.8-9" fill="none" stroke="${onAccent}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`;
        const tick=box.querySelector('path');
        label(stop.label,x+side+gap,cy-labelH/2,rowW-side-gap,'left');
        const centre={x:x+side/2,y:cy};
        Object.assign(made,{entry:centre,rest:()=>centre,box:{w:rowW,h:side},top:cy-side/2,bottom:cy+side/2,
          draw(v){
            set(box,{background:mixHex(bg,accent,Math.min(1,v*2.5)),borderColor:mixHex(quiet,accent,Math.min(1,v*2.5))});
            tick.setAttribute('stroke-dashoffset',(1-out((v-.25)/.75)).toFixed(4));
          }});
      }else{
        const d=r*2.7,rowW=Math.min(controlW,r*12),x=cx-rowW/2;
        const key=sign=>{
          const node2=el('div','bold',node,sign);rect(node2,sign==='+'?x+rowW-d:x,cy-d/2,d,d);
          set(node2,{borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:fg,background:control,transformOrigin:'50% 50%'});
          K.design.apply(node2,role);return node2;
        };
        key('−');const plus=key('+');
        const count=el('div','bold',node,'0');rect(count,x+d,cy-labelH/2,rowW-d*2,labelH);
        set(count,{textAlign:'center',color:fg,whiteSpace:'nowrap'});K.design.apply(count,role);
        label(stop.label,cx-nameW/2,cy+d/2+gap,nameW);
        const on={x:x+rowW-d/2,y:cy-d/2-r};
        Object.assign(made,{entry:on,rest:()=>on,box:{w:rowW,h:d+r*2+gap+labelH},nameUnder:true,top:cy-d/2-r*2,bottom:cy+d/2+gap+labelH,
          draw(v,here,beatAge){
            count.textContent=String(v);
            const kick=beatAge>=0&&beatAge<.18?Math.sin(beatAge/.18*Math.PI):0;
            set(plus,{background:mixHex(control,accent,v?1:0),color:v?onAccent:fg,transform:`scale(${(1-.08*kick).toFixed(4)})`});
            set(count,{transform:`scale(${(1+.14*kick).toFixed(4)})`});
          }});
      }
      // The close-up: the control with room around it, never smaller than the layout.
      const wide=Math.max(made.box.w,stop.kind==='button'||stop.kind==='check'?0:widths[i]);
      made.left=cx-wide/2;made.right=cx+wide/2;
      // The close-up: the whole control, its name and the ball on it, in the middle of the
      // safe area with room around; never smaller than the layout.
      const spanW=made.right-made.left,spanH=made.bottom-made.top,zoom=clamp(Math.min(safe.w*.86/spanW,safe.h*.46/spanH),1,2.7);
      made.pose={x:(made.left+made.right)/2,y:(made.top+made.bottom)/2,zoom,slack:Math.max(0,(safe.w/zoom-spanW)/2-2)};
      return made;
    });

    const ball=el('div','',world);ball.dataset.rideBall='';
    set(ball,{position:'absolute',left:px(-r),top:px(-r),width:px(r*2),height:px(r*2),borderRadius:'50%',background:fg,
      boxShadow:`0 ${px(6*S)} ${px(16*S)} ${alpha(fg,.28)}`,transformOrigin:'50% 100%',zIndex:'5'});
    // The camera looks at the middle of the safe area: at zoom 1 the world is where it was laid out.
    const eye={x:safe.x+safe.w/2,y:safe.y+safe.h/2};
    // The closing view: the title and every control, as large as the safe area takes them
    // whole, and never smaller than the layout.
    let titleW=0;
    if(title){
      const font=getComputedStyle(title),probe=el('span','bold',world,s.title);
      set(probe,{position:'absolute',whiteSpace:'nowrap',fontSize:font.fontSize,fontFamily:font.fontFamily,fontWeight:font.fontWeight,letterSpacing:font.letterSpacing});
      titleW=Math.min(safe.w,probe.scrollWidth);probe.remove();
    }
    const left=Math.min(eye.x-titleW/2,...stops.map(stop=>stop.left)),right=Math.max(eye.x+titleW/2,...stops.map(stop=>stop.right));
    const upper=title?top-titleH:Math.min(...stops.map(stop=>stop.top)),lower=Math.max(...stops.map(stop=>stop.bottom));
    const whole={x:(left+right)/2,y:(upper+lower)/2,zoom:clamp(Math.min(safe.w/(right-left),safe.h/(lower-upper))*.92,1,1.8)};
    const model={stops,times:t,overview:whole,drop:Math.max(H*.5,400*S),lift:Math.max(70*S,r*3.2)};

    return l=>{
      const state=rideState(model,l),{camera}=state;
      set(world,{opacity:out(l/.25).toFixed(4),
        transform:`translate(${px(eye.x-camera.x*camera.zoom)},${px(eye.y-camera.y*camera.zoom)}) scale(${camera.zoom.toFixed(5)})`});
      // A control the frame would cut stands back, dim, until it is whole inside the safe
      // area: the eye stays on the one the ball is on, and no name is ever seen cut.
      const sx=x=>eye.x+(x-camera.x)*camera.zoom,sy=y=>eye.y+(y-camera.y)*camera.zoom,band=Math.min(W,H)*.012;
      stops.forEach((stop,i)=>{
        const inside=Math.min(sx(stop.left)-safe.x,safe.x+safe.w-sx(stop.right),sy(stop.top)-safe.y,safe.y+safe.h-sy(stop.bottom));
        set(stop.node,{opacity:(.22+.78*smooth(1+(inside+.5)/band)).toFixed(4)});
        const st=t.stops[i],value=state.values[i],here=state.resting===i;
        if(stop.kind==='slider')stop.draw(value,here,smooth((l-st.land)/.2));
        else if(stop.kind==='stepper')stop.draw(value,here,l-(st.steps.filter(at=>l>=at).at(-1)??Infinity));
        else stop.draw(value,here);
      });
      const squash=state.squash*.18;
      set(ball,{opacity:(1-state.hidden).toFixed(4),
        transform:`translate(${px(state.ball.x)},${px(state.ball.y)}) scale(${(1+squash*.6).toFixed(4)},${(1-squash).toFixed(4)})`});
      if(title)set(title,{opacity:state.closing.toFixed(4),transform:`translateY(${px((1-state.closing)*-12*S)})`});
    };
  }};
  return {sceneFactories:{ride:given=>definition.build(given)}};
}
