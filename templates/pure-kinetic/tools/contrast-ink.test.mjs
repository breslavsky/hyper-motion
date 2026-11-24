import assert from 'node:assert/strict';
import {test} from 'node:test';
import {textOn} from '../source/lib/components/maths.mjs';
const rgb=hex=>{const h=hex.slice(1),full=h.length===3?[...h].map(c=>c+c).join(''):h;return [0,2,4].map(i=>parseInt(full.slice(i,i+2),16));};
const luminance=hex=>rgb(hex).map(v=>{const n=v/255;return n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4);}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const light=luminance(a),dark=luminance(b);return (Math.max(light,dark)+.05)/(Math.min(light,dark)+.05);};

test('solid color grid always receives the more readable of the two supported inks',()=>{
  let cases=0,minimum=Infinity;
  for(const r of [0,17,32,64,96,128,160,192,224,255])for(const g of [0,17,32,64,96,128,160,192,224,255])for(const b of [0,17,32,64,96,128,160,192,224,255]){
    const ground='#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''),chosen=textOn(ground);
    assert.ok(['#111111','#ffffff'].includes(chosen));
    const ratio=contrast(chosen,ground),best=Math.max(contrast('#111111',ground),contrast('#ffffff',ground));
    assert.ok(Math.abs(ratio-best)<1e-9,`${ground}: ${chosen} loses contrast`);
    assert.ok(ratio>=4.3,`${ground}: solid on-accent copy must exceed the large-text floor`);
    minimum=Math.min(minimum,ratio);cases++;
  }
  assert.equal(cases,1000);assert.ok(minimum>4.3);
});

test('Folio coral uses dark ink while the sky sentinel and hex forms keep their contract',()=>{
  assert.equal(textOn('#ff6a70'),'#111111');
  assert.ok(contrast('#ffffff','#ff6a70')<3);
  assert.ok(contrast(textOn('#ff6a70'),'#ff6a70')>6.7);
  assert.equal(textOn('#000000'),'#ffffff');assert.equal(textOn('#ffffff'),'#111111');
  assert.equal(textOn('sky'),'#ffffff');
  for(const hex of ['#abc','#FED','#753','#000','#fff'])assert.equal(textOn(hex),textOn('#'+hex.slice(1).split('').map(c=>c+c).join('')));
});
