// The lettering of a card as a picture for the glass under it. A wave or a
// ripple bends what is written on the pane, and a shader cannot see the page:
// the scene names what its card carries (typed text, plain text, boxes, icons,
// a caret) and gets a function for each that draws it on a canvas, in the
// card's own logical pixels, at the place and in the ink the page gives it.
// What stands still is measured once, before the card is projected into 3D;
// typed glyphs are placed by the page's layout each time they are drawn.
import {islandIconSource} from '../island-icon.mjs';
import {fontOf,svgPicture} from './scene-parts.mjs';

export function createLettering(K,root){
  const doc=root.ownerDocument,view=doc.defaultView,measures=[];
  const styleOf=node=>view.getComputedStyle(node);
  let frame={x:0,y:0,sx:1,sy:1};
  // A rectangle of the page in the card's logical pixels, from its border box.
  const local=r=>({x:(r.left-frame.x)/frame.sx,y:(r.top-frame.y)/frame.sy,w:r.width/frame.sx,h:r.height/frame.sy});
  // Where the content of `node` begins, by the layout alone: it holds while
  // the card is turned, and follows a field that scrolls its text.
  function originOf(node){
    let x=root.clientLeft,y=root.clientTop;
    for(let n=node;n&&n!==root;n=n.offsetParent){
      x+=n.offsetLeft+n.clientLeft-n.scrollLeft;y+=n.offsetTop+n.clientTop-n.scrollTop;
    }
    return {x,y};
  }
  function measure(){
    const r=root.getBoundingClientRect();
    if(!(r.width>0&&root.offsetWidth>0))return false;
    frame={x:r.left,y:r.top,sx:r.width/root.offsetWidth,sy:r.height/(root.offsetHeight||1)||1};
    for(const run of measures)run();
    return true;
  }

  // Text somebody types: every glyph up to `count`, each its own element with
  // its own ink, emoji as the pictures the kit draws them with.
  function glyphs(typing){
    const pictures=new Map();
    for(const part of typing.parts)if(part.emoji){
      const image=svgPicture(part.node.querySelector('svg'),128);
      pictures.set(part,image);K.defer(image.decode());
    }
    let font,ascent;
    return (ctx,alpha=1,count=typing.length)=>{
      if(!(alpha>0)||!typing.parts.length)return;
      font??=fontOf(styleOf(typing.host));
      ctx.save();
      // A glyph's box on the page is the font's own ascent and descent; its
      // baseline lies that ascent below the top of the box.
      ctx.font=font;ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.direction='ltr';ctx.letterSpacing='0px';
      ascent??=ctx.measureText('x').fontBoundingBoxAscent;
      const {x,y}=originOf(typing.parts[0].node.offsetParent);
      for(const part of typing.parts){
        if(part.end>count)break;
        const node=part.node,[r,g,b,a]=part.ink;
        ctx.globalAlpha=alpha*a;
        if(part.emoji)ctx.drawImage(pictures.get(part),x+node.offsetLeft,y+node.offsetTop,node.offsetWidth,node.offsetHeight);
        // The element's own text carries the joiners of a joined script.
        else{ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.fillText(node.textContent,x+node.offsetLeft,y+node.offsetTop+ascent);}
      }
      ctx.restore();
    };
  }

  // Text that stands as written: its lines, each drawn whole, so a script
  // read from right to left is shaped and ordered as on the page.
  function text(el){
    let runs=[],style,ascent;
    measures.push(()=>{
      runs=[];
      const walker=doc.createTreeWalker(el,view.NodeFilter.SHOW_TEXT),segmenter=new Intl.Segmenter(undefined,{granularity:'grapheme'});
      let run=null;
      while(walker.nextNode()){
        const node=walker.currentNode;
        for(const part of segmenter.segment(node.nodeValue)){
          const range=doc.createRange();range.setStart(node,part.index);range.setEnd(node,part.index+part.segment.length);
          const rect=[...range.getClientRects()].find(r=>r.width>0);
          if(!rect)continue;
          const box=local(rect);
          if(!run||Math.abs(run.y-box.y)>box.h*.25){run={text:part.segment,y:box.y,left:box.x,right:box.x+box.w};runs.push(run);}
          else{run.text+=part.segment;run.left=Math.min(run.left,box.x);run.right=Math.max(run.right,box.x+box.w);}
        }
      }
    });
    return (ctx,alpha=1)=>{
      if(!(alpha>0)||!runs.length)return;
      style??=styleOf(el);
      const rtl=style.direction==='rtl';
      ctx.save();
      ctx.globalAlpha=alpha;ctx.fillStyle=style.color;ctx.font=fontOf(style);ctx.letterSpacing=style.letterSpacing;
      ctx.textBaseline='alphabetic';ctx.direction=rtl?'rtl':'ltr';ctx.textAlign=rtl?'right':'left';
      ascent??=ctx.measureText('Mg').fontBoundingBoxAscent;
      for(const run of runs)ctx.fillText(run.text,rtl?run.right:run.left,run.y+ascent);
      ctx.restore();
    };
  }

  // A filled, outlined box: a chip, or the highlight of a word, which takes a
  // box on every line it runs over. `radius` in logical pixels, or 'pill'.
  function box(el,{fill=null,stroke=null,radius=0}={}){
    let rects=[];
    measures.push(()=>{rects=[...el.getClientRects()].filter(r=>r.width>0&&r.height>0).map(local);});
    return (ctx,alpha=1)=>{
      if(!(alpha>0))return;
      ctx.save();ctx.globalAlpha=alpha;
      for(const r of rects){
        const round=radius==='pill'?r.h/2:Math.min(radius,r.h/2,r.w/2);
        if(fill){ctx.beginPath();ctx.roundRect(r.x,r.y,r.w,r.h,round);ctx.fillStyle=fill;ctx.fill();}
        if(stroke){
          // A one-pixel border lies inside the box.
          ctx.beginPath();ctx.roundRect(r.x+.5,r.y+.5,r.w-1,r.h-1,Math.max(0,round-.5));
          ctx.lineWidth=1;ctx.strokeStyle=stroke;ctx.stroke();
        }
      }
      ctx.restore();
    };
  }

  // An icon of the island set, in the ink of the text beside it.
  function icon(badge){
    const image=new view.Image(),art=badge.firstElementChild;
    image.src=islandIconSource(badge.dataset.icon);K.defer(image.decode());
    let place=null,tinted=null;
    measures.push(()=>{place=local(art.getBoundingClientRect());});
    return (ctx,alpha=1)=>{
      if(!(alpha>0)||!place||!image.complete)return;
      if(!tinted){
        // The artwork is a mask: fill its shape with the ink.
        tinted=doc.createElement('canvas');tinted.width=tinted.height=256;
        const pen=tinted.getContext('2d');
        pen.fillStyle=styleOf(badge).color;pen.fillRect(0,0,256,256);
        pen.globalCompositeOperation='destination-in';pen.drawImage(image,0,0,256,256);
      }
      ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(tinted,place.x,place.y,place.w,place.h);ctx.restore();
    };
  }

  function caret(el){
    let color;
    return (ctx,alpha=1)=>{
      if(!(alpha>0))return;
      color??=styleOf(el).backgroundColor;
      const {x,y}=originOf(el.offsetParent);
      ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;
      ctx.fillRect(x+el.offsetLeft,y+el.offsetTop,el.offsetWidth,el.offsetHeight);
      ctx.restore();
    };
  }

  return {measure,glyphs,text,box,icon,caret};
}
