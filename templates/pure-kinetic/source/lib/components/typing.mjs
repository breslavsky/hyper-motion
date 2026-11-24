// A letter of a joining script changes its shape by its neighbours, and a
// browser shapes no further than the element a letter stands in. Each typed
// glyph is an element of its own, so Arabic would come out letter by letter,
// unjoined. A zero-width joiner beside a letter stands for the neighbour it
// joins: the element then draws the joined form by itself.
const JOINER='\u200D';
// Letters that join the one before them only, and those that join on both sides
// (ArabicShaping.txt of Unicode: joining types R, and D with the tatweel).
const JOINS_BEFORE=/[\u0622-\u0625\u0627\u0629\u062F-\u0632\u0648\u0671-\u0673\u0675-\u0677\u0688-\u0699\u06C0\u06C3-\u06CB\u06CD\u06CF\u06D2\u06D3\u06D5\u06EE\u06EF]/u;
const JOINS_BOTH=/[\u0620\u0626\u0628\u062A-\u062E\u0633-\u063F\u0640-\u0647\u0649\u064A\u066E\u066F\u0678-\u0687\u069A-\u06BF\u06C1\u06C2\u06CC\u06CE\u06D0\u06D1\u06FA-\u06FC\u06FF]/u;
const MARK=/\p{M}/u,JOINING=/[\u0600-\u06FF]/;
const ALEFS=/[\u0622\u0623\u0625\u0627]/;
const letters=cell=>[...cell].filter(ch=>!MARK.test(ch));
const joinsNext=cell=>cell!==undefined&&JOINS_BOTH.test(letters(cell).at(-1)??'');
const joinsPrevious=cell=>{
  const first=cell===undefined?'':letters(cell)[0]??'';
  return JOINS_BOTH.test(first)||JOINS_BEFORE.test(first);
};
/** A text as the cells typing reveals: a code point each, a mark with its base,
 *  and lam with the alef after it, which are one ligature. */
function clusters(text){
  const cells=[];
  for(const ch of text){
    const last=cells.at(-1);
    if(last!==undefined&&(MARK.test(ch)||(last.endsWith('\u0644')&&ALEFS.test(ch))))cells[cells.length-1]=last+ch;
    else cells.push(ch);
  }
  return cells;
}
/** A cell as its element writes it: with a joiner for each neighbour it joins. */
function joined(before,cell,after){
  if(!JOINING.test(cell))return cell;
  return (joinsNext(before)&&joinsPrevious(cell)?JOINER:'')+cell+(joinsNext(cell)&&joinsPrevious(after)?JOINER:'');
}

/** A fixed inline layout whose paint follows a caller-owned typing clock. */
export function createTyping(K, host, {text, caret=null, unit='utf16', emojify=true, id}={}) {
  if(!['utf16','codepoint'].includes(unit))throw new Error(`Unknown typing unit: ${unit}`);
  const document=host.ownerDocument,view=document.defaultView;
  if(text!==undefined)host.textContent=String(text);
  if(caret?.parentNode)caret.remove();
  if(emojify)K.emojify(host,{semantic:true});
  if(view.getComputedStyle(host).position==='static')host.style.position='relative';
  host.dataset.typingHost='';host.dataset.typingMeasure=unit;
  if(id)host.dataset.typingId=id;
  const parts=[];let utf16=0,codepoint=0;
  const append=(node,copy,emoji=false)=>{
    const part={node,text:copy,emoji,utf16Start:utf16,codepointStart:codepoint};
    utf16+=copy.length;codepoint+=[...copy].length;
    Object.assign(part,{utf16End:utf16,codepointEnd:codepoint});
    part.start=part[unit+'Start'];part.end=part[unit+'End'];
    node.dataset.typingUnit=String(parts.length);
    // Capture each run's actual ink, including syntax colour and alpha. Using
    // text colour rather than a stacking-context opacity preserves shaping.
    const color=view.getComputedStyle(node).color;
    const values=color.match(/[\d.]+/g)?.map(Number);
    part.ink=values?.length>=3?values.slice(0,4):[0,0,0,1];
    if(part.ink.length===3)part.ink.push(1);
    parts.push(part);
  };
  const split=node=>{
    for(const child of [...node.childNodes]){
      if(child.nodeType===3){
        const cells=clusters(child.nodeValue);
        for(const [index,copy] of cells.entries()){
          const glyph=document.createElement('span');glyph.textContent=joined(cells[index-1],copy,cells[index+1]);
          node.insertBefore(glyph,child);append(glyph,copy);
        }
        child.remove();
      }else if(child.dataset?.emoji)append(child,child.dataset.emoji,true);
      else if(child.classList?.contains('emoji'))throw new Error('Typing emoji needs its original text; pass the text option');
      else if(child.nodeType===1&&!child.matches('svg,[data-typing-ignore]'))split(child);
    }
  };
  split(host);
  const full=parts.map(part=>part.text).join(''),length=unit==='utf16'?utf16:codepoint;
  // HTML drops the final empty line of preformatted text. A text-free <br>
  // reserves that line before fitting, without adding a key or changing copy.
  let terminal=null;
  if(full.endsWith('\n')&&/^(pre(?:-wrap|-line)?|break-spaces)$/.test(view.getComputedStyle(host).whiteSpace)){
    terminal=document.createElement('br');
    terminal.dataset.typingIgnore='';terminal.dataset.typingEnd='';
    terminal.setAttribute('aria-hidden','true');host.append(terminal);
  }
  let measured=false;
  if(caret){
    host.append(caret);caret.dataset.typingCaret='';
    K.set(caret,{position:'absolute',pointerEvents:'none'});
  }
  const point=(node,end,rect,scale)=>{
    // Collapse inside the text node: an element-boundary Range may have no
    // box, which would fall back to the wrong (right-hand) edge of RTL glyphs.
    const range=document.createRange(),textNode=node.firstChild;
    if(textNode?.nodeType===3){range.setStart(textNode,end?textNode.length:0);range.collapse(true);}
    else {range.selectNodeContents(node);range.collapse(!end);}
    const r=[...range.getClientRects()].find(r=>r.height>0);
    if(!r)return null;
    return {x:(r.x-rect.x)/scale.x-host.clientLeft,y:(r.y-rect.y)/scale.y-host.clientTop,h:r.height/scale.y};
  };
  function measure(){
    const rect=host.getBoundingClientRect();
    if(!(rect.width>0&&host.offsetWidth>0))return false;
    const scale={x:rect.width/host.offsetWidth,y:rect.height/(host.offsetHeight||1)||1};
    for(const part of parts){
      const r=part.node.getBoundingClientRect();
      const box={x:(r.x-rect.x)/scale.x-host.clientLeft,y:(r.y-rect.y)/scale.y-host.clientTop,w:r.width/scale.x,h:r.height/scale.y};
      part.box=box;
      part.before=point(part.node,false,rect,scale)??{x:box.x,y:box.y,h:box.h};
      part.after=point(part.node,true,rect,scale)??{x:box.x+box.w,y:box.y,h:box.h};
    }
    if(terminal){
      const r=terminal.getBoundingClientRect();
      terminal.point={x:(r.x-rect.x)/scale.x-host.clientLeft,y:(r.y-rect.y)/scale.y-host.clientTop,h:r.height/scale.y};
    }
    measured=true;return true;
  }
  function caretAt(count){
    if(!measured)measure();
    const n=Math.max(0,Math.min(length,Math.floor(count)));
    const last=parts.findLast(part=>part.end<=n),next=parts.find(part=>part.start>=n);
    if(last?.text==='\n'&&(next||terminal))return next?.before??terminal.point;
    return last?.after??parts[0]?.before??{x:0,y:0,h:parseFloat(view.getComputedStyle(host).lineHeight)||0};
  }
  function reveal(count,{fresh=1}={}){
    const n=Math.max(0,Math.min(length,Math.floor(count)));
    for(const part of parts){
      const alpha=part.end<=n?(part.end===n?Math.max(0,Math.min(1,fresh)):1):0;
      const [r,g,b,a]=part.ink;
      K.set(part.node,{visibility:alpha>0?'visible':'hidden',...(part.emoji?
        {opacity:String(alpha)}:{color:`rgba(${r},${g},${b},${a*alpha})`})});
    }
    host.dataset.typingCount=String(n);
    if(caret){
      const at=caretAt(n),height=caret.offsetHeight||parseFloat(view.getComputedStyle(caret).height)||at.h;
      K.set(caret,{left:K.px(at.x),top:K.px(at.y+(at.h-height)/2)});
    }
    return n;
  }
  return {host,parts,text:full,length,unit,reveal,measure,caretAt};
}
