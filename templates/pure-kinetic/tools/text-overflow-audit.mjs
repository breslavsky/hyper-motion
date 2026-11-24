// Shared QA contract for intentionally truncated single-line text.
// No browser or package imports: used by all native text audits.
// An overflow marker is a request for an ellipsis contract, never permission to
// ignore clipping. The native collector measures the CSS, the complete one-line
// box and its ancestor clip separately from the unabridged Range text.
export function ellipsisIssues(text,{allowStageCrop=false}={}){
  const e=text.ellipsis;if(!e)return [];
  const issues=[],box=r=>r&&[r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.w>0&&r.h>0;
  const inside=(a,b)=>a.x>=b.x-1&&a.y>=b.y-1&&a.x+a.w<=b.x+b.w+1&&a.y+a.h<=b.y+b.h+1;
  if(e.marker!=='ellipsis'||e.whiteSpace!=='nowrap'||e.textOverflow!=='ellipsis'||
    !['hidden','clip'].includes(e.overflowX)||!['block','inline-block','flow-root'].includes(e.display))issues.push('css');
  if(e.lineCount!==1||!Number.isFinite(e.lineHeight)||e.lineHeight<=0||
    !Number.isFinite(e.paddingY)||!Number.isFinite(e.clientHeight)||Math.abs(e.clientHeight-e.paddingY-e.lineHeight)>1||
    !Number.isFinite(e.clientWidth)||e.clientWidth<=0||!Number.isFinite(e.scrollHeight)||e.scrollHeight>e.clientHeight+1)issues.push('one-line-footprint');
  // Older catalogue receipts omit capacity; newer generic collectors measure
  // the actual ellipsis glyph so a one-pixel clipping window cannot pass.
  if(e.ellipsisWidth!==undefined||e.paddingX!==undefined){
    if(!Number.isFinite(e.ellipsisWidth)||e.ellipsisWidth<=0||!Number.isFinite(e.paddingX)||e.paddingX<0||
      e.clientWidth-e.paddingX<e.ellipsisWidth-1)issues.push('no-room-for-ellipsis');
  }
  // Horizontal ellipsis never authorizes clipping glyph ink above or below its
  // line. New collectors measure this locally so rotated hidden tails do not
  // look like vertical clipping in the screen-space axis-aligned rectangle.
  if(e.verticalSeen!==undefined&&(!Number.isFinite(e.verticalSeen)||e.verticalSeen<.98))issues.push('vertical-ink-clipped');
  // A declared camera move can crop the stage, but cannot crop the label inside
  // its own card/control. Both clips are measured from actual ancestor CSS.
  const clip=allowStageCrop?e.ancestorClip:e.enclosingClip;
  if(!box(e.viewport)||!box(clip)||!inside(e.viewport,clip))issues.push('viewport-clipped');
  const outsideStage=allowStageCrop&&box(e.viewport)&&box(e.frame)&&!inside(e.viewport,e.frame);
  if(!Array.isArray(text.paintedLines)||(!outsideStage&&!text.paintedLines.some(r=>box(r)))||
    text.paintedLines.some(r=>box(r)&&(!box(e.viewport)||!inside(r,e.viewport))))issues.push('painted-bounds');
  return issues;
}
export function ellipsisViewportText(text,options){
  if(!text.ellipsis||ellipsisIssues(text,options).length)return text;
  // Retain the full structural viewport for frame/safe-area checks, including
  // the browser-generated ellipsis absent from DOM Range glyph measurements.
  // Collisions below still use the actual clipped paint; role/font checks keep
  // their original measured values and the complete source copy.
  return {...text,seen:1,inkLines:[text.ellipsis.viewport]};
}
export function ellipsisFindings(texts,options){
  return texts.flatMap(text=>{
    const issues=ellipsisIssues(text,options);
    return issues.length?[{kind:'invalid-ellipsis',id:text.id,text:text.text,issues}]:[];
  });
}
