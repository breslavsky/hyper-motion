import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {applyBrandPalette,resolveBrandStyle} from '../source/lib/components/brand-tokens.mjs';
const require=createRequire(import.meta.url),P=require('../source/lib/compiler/plan.cjs');
const film=more=>({aspect:'9:16',style:'mono',brand:{name:'Nook'},scenes:[{type:'title',beats:4,text:'Read the brand'}],...more});
const tokens={background:'#08172d',foreground:'#ffffff',accent:'#59cbff'};

test('exact brand roles set all native scene palettes without hue rotation',()=>{
  for(const aspect of ['9:16','1:1','16:9'])for(const style of Object.keys(P.looks)){
    const brand={name:'Nook',colors:['#ff7a4d','#2433ff'],tokens};
    const plan=P.compile(film({aspect,style,palette:'brand',brand,scenes:[{type:'title',beats:4,text:'Brand'},{type:'title',beats:4,text:'Other look',look:'noir'}]}));
    assert.deepEqual(new Set(Object.values(plan.palette)),new Set(Object.values(tokens)),style);
    for(const ps of plan.scenes){
      assert.deepEqual([ps.bg,ps.fg,ps.accent],Object.values(tokens));
      assert.deepEqual(new Set(Object.values(ps.palette)),new Set(Object.values(tokens)));
    }
  }
});

test('explicit scene roles win, background-only stays readable, and accent2 stays exact',()=>{
  const plan=P.compile(film({brand:{name:'Nook',tokens:{...tokens,accent2:'#fa5'}},scenes:[{type:'highlight',beats:4,text:'Test',bg:'#fef6e4',fg:'#10213a',mark:'#f55'}]}));
  assert.deepEqual([plan.scenes[0].bg,plan.scenes[0].fg,plan.scenes[0].accent],['#fef6e4','#10213a','#f55']);
  assert.equal(plan.palette.coral,'#fa5');assert.equal(plan.palette.electric,tokens.accent);
  for(const background of ['#08172d','#ffffff']){
    const p=P.compile(film({brand:{name:'Nook',tokens:{background}}}));
    assert.equal(p.scenes[0].bg,background);
    assert.notEqual(p.scenes[0].fg,background);
    assert.equal(p.palette.ink,p.scenes[0].fg);
  }
});

test('browser and compiler share one token contract and reject invalid native tokens',()=>{
  const cjs=fs.readFileSync(new URL('../source/lib/components/brand-tokens.cjs',import.meta.url),'utf8');
  const esm=fs.readFileSync(new URL('../source/lib/components/brand-tokens.mjs',import.meta.url),'utf8');
  assert.equal(cjs.slice(0,cjs.lastIndexOf('module.exports')),esm.slice(0,esm.lastIndexOf('export {')));
  const base=P.compile(film()).scenes[0],palette=P.compile(film()).palette;
  for(const bad of [null,[],{bg:'#fff'},{accent:'red'},{foreground:'#ffff'}])assert.throws(()=>resolveBrandStyle({...base,palette},bad),/brand.tokens/);
  assert.deepEqual(applyBrandPalette(palette,undefined),palette);
  assert.deepEqual(resolveBrandStyle(base,{}),base);
});


test('removing native tokens restores the original look rhythm for every scene',()=>{
  for(const style of Object.keys(P.looks)){
    const base=film({style,scenes:Array.from({length:8},()=>({type:'title',beats:4,text:'Brand'}))});
    const original=P.compile(base),branded=P.compile({...base,brand:{...base.brand,tokens}});
    for(const [i,ps]of branded.scenes.entries()){
      const restored=resolveBrandStyle(ps.brandBase,{}),expected=original.scenes[i];
      assert.deepEqual([restored.bg,restored.fg,restored.accent],[expected.bg,expected.fg,expected.accent],style+' '+i);
      assert.deepEqual(restored.palette,expected.palette??original.palette);
    }
  }
});


test('material ink is local, respects explicit choices, and review names both roles',async()=>{
  const {surfaceForeground}=await import('../source/lib/components/brand-tokens.mjs');
  const F=require('../source/lib/film.cjs'),catalog=require('../source/lib/components/catalog.json');
  const palette=P.compile(film({style:'editorial'})).palette;
  assert.equal(surfaceForeground('glass',palette.sky,palette,'#ffffff'),'#111111');
  assert.equal(surfaceForeground('glass','#080a0f',palette,'#ffffff'),'#ffffff');
  assert.equal(surfaceForeground('sky','sky',palette,'#ffffff'),'#111111');
  assert.equal(surfaceForeground('sky','#080a0f',palette,'#ffffff'),'#ffffff');
  for(const surface of ['glass','sky'])assert.equal(surfaceForeground(surface,'sky',palette,'#ffffff',{explicit:true}),'#ffffff');
  const scenes=[require('../source/lib/components/metadata.cjs').winner.sample,require('../source/lib/components/metadata.cjs').tabs.sample,{type:'endcard',beats:5,cta:'Start now'}];
  for(const scene of scenes)for(const requested of ['default','scene','brand']){
    const recipe=film({style:'editorial',brand:{name:'Nook',...(requested==='brand'?{tokens:{foreground:'#ffffff'}}:{})},scenes:[{...scene,...(requested==='scene'?{fg:'#ffffff'}:{})}]});
    const plan=P.compile(recipe),ps=plan.scenes[0],review=F.review(recipe,plan).scenes[0];
    assert.equal(ps.fg,'#ffffff','Preserve the original default foreground and parity fixtures');
    assert.equal(review.foreground,ps.fg);
    assert.equal(review.surfaceForeground,requested==='default'?'#111111':'#ffffff');
    assert.equal(review.surfaceForeground,surfaceForeground(catalog[scene.type].surface,ps.bg,ps.palette??plan.palette,ps.fg,{explicit:requested!=='default'}));
  }
});

test('review exposes implicit sky ink for every family without changing compiled foreground',()=>{
  const F=require('../source/lib/film.cjs');
  for(const scene of [{type:'title',beats:4,text:'Make space'},
    {type:'append',beats:6,base:'Make',words:['space','time']},
    {type:'typewriter',beats:6,text:'Write your next idea'}]){
    for(const requested of ['default','scene','brand']){
      const recipe=film({style:'editorial',brand:{name:'Nook',...(requested==='brand'?{tokens:{foreground:'#ffffff'}}:{})},
        scenes:[{...scene,...(requested==='scene'?{fg:'#ffffff'}:{})}]});
      const plan=P.compile(recipe),ps=plan.scenes[0],review=F.review(recipe,plan).scenes[0];
      assert.equal(ps.bg,'sky');assert.equal(ps.fg,'#ffffff');assert.equal(review.foreground,ps.fg);
      assert.equal(review.surfaceForeground,requested==='default'?'#111111':'#ffffff');
    }
  }
});
