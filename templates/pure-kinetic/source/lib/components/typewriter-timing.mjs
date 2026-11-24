// Canonical typewriter action schedule, shared by the picture and audio compiler.
// tools/sync-typewriter-timing.cjs generates the equivalent browser module.
function typewriterTiming(scene,duration){
  const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  const then=scene.then&&!scene.erase&&!/\s$/.test(scene.text)&&! /^[\s,.;:!?…]/.test(scene.then)?` ${scene.then}`:(scene.then??'');
  const textUnits=[...scene.text],thenUnits=[...then];
  const finalUnits=(scene.erase?textUnits.slice(0,Math.max(0,textUnits.length-scene.erase)):textUnits).concat(thenUnits);
  const finalText=finalUnits.join('');
  const times=[];let t=.15;
  textUnits.forEach((ch,i)=>{t+=.035+hash(i*3.7+1)*.04+(/[\s,.]/.test(ch)?.05:0);times.push(t);});
  const typedEnd=t,eraseStart=typedEnd+.35,eraseEnd=eraseStart+(scene.erase??0)*.03;
  t=eraseEnd+.15;
  const thenTimes=[];
  thenUnits.forEach((ch,i)=>{t+=.04+hash(i*5.1+9)*.04+(/[\s,.]/.test(ch)?.05:0);thenTimes.push(t);});
  const total=t||typedEnd,scale=Math.min(1,duration*.85/Math.max(.1,total));
  const events=[...times.map(at=>({at:at*scale,action:'key'})),
    ...Array.from({length:Math.min(scene.erase??0,textUnits.length)},(_,i)=>({at:(eraseStart+(i+1)*.03)*scale,action:'erase'})),
    ...thenTimes.map(at=>({at:at*scale,action:'key'}))];
  return {then,finalText,textUnits,thenUnits,finalUnits,times,typedEnd,eraseStart,eraseEnd,thenTimes,total,scale,events};
}
export {typewriterTiming};
