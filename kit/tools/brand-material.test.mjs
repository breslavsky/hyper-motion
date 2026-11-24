import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSurfaceMaterial} from '../source/lib/components/glass/materials.mjs';
import {resolveBrandMetalColors} from '../source/lib/components/metal/metal.mjs';

const brands=[
  {background:'#101419',foreground:'#f3f5ef',accent:'#b9f24a',accent2:'#83d5ff'},
  {background:'#f5f5fb',foreground:'#181830',accent:'#6554ef',accent2:'#ffa4ca'},
  {background:'#fff8f0',foreground:'#2a1c17',accent:'#e85d3f',accent2:'#f2bf55'},
];
const lum=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
  .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
  .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);

test('brand metal preserves supplied roles and gives the text a contrasting body colour',()=>{
  for(const brand of [...brands,{background:'#fff',foreground:'#fff',accent:'#f00'},{background:'#000',foreground:'#000',accent:'#00f'}]){
    const colors=resolveBrandMetalColors(brand);
    assert.ok(contrast(colors.base,colors.foreground)>=4.5);
    assert.match(colors.base,/^#[\da-f]{6}$/i);
    assert.equal(colors.foreground,brand.foreground.length===4?'#'+[...brand.foreground.slice(1)].map(c=>c+c).join(''):brand.foreground);
  }
  const gray=resolveBrandMetalColors({background:'#303030',foreground:'#fff',accent:'#777'});
  for(const role of ['base','shadow','highlight','rim']){
    const hex=gray[role];assert.equal(hex.slice(1,3),hex.slice(3,5));assert.equal(hex.slice(3,5),hex.slice(5,7));
  }
  const red=resolveBrandMetalColors({background:'#800000',foreground:'#fff',accent:'#f00'});
  assert.equal(red.base.slice(3,5),red.base.slice(5,7),'The quiet centre must not add a blue or gold hue to a red brand');
  assert.ok(parseInt(red.base.slice(1,3),16)>parseInt(red.base.slice(3,5),16),'The centre keeps a subtle red cast');
  assert.ok(parseInt(red.base.slice(3,5),16)>0,'A saturated brand still has a neutral substrate');
  assert.ok(lum(gray.shadow)<lum(gray.base)&&lum(gray.base)<lum(gray.highlight));
  assert.ok(lum(gray.rim)>lum(gray.highlight),'The fallback rim remains lighter than the quiet centre');
});

test('branded Metal keeps opaque faces and the brand body colour on panels, lenses and inset controls',()=>{
  for(const brand of brands)for(const variant of ['silver','gold','chromatic']){
    const colors=resolveBrandMetalColors(brand);
    for(const shape of [{},{lens:true},{insetControl:true}]){
      const finish=createSurfaceMaterial({theme:{type:'metal',variant,branded:true},fg:brand.foreground,brand,...shape});
      assert.equal(finish.shaderPreset,'chromatic','Brand selection must not switch to an unrelated legacy metal preset');
      const surface=finish.meshMaterial;
      assert.equal('#'+surface.color.getHexString(),colors.base);
      assert.equal(surface.iridescence,0);assert.equal(surface.dispersion,0);
      assert.equal(surface.specularColor.getHexString(),'ffffff');
      assert.equal(surface.metalness,1);assert.equal(surface.transmission,0);
      assert.equal(surface.opacity,1);assert.equal(surface.transparent,false);
      assert.equal(surface.toneMapped,false);
      finish.dispose();
    }
  }
});

test('explicit Glass has no tint of its own while legacy finishes stay intact',()=>{
  for(const lens of [false,true]){
    const finish=createSurfaceMaterial({theme:{type:'glass',branded:true},lens,brand:brands[2]});
    // The traced slab shows the brand's backdrop as it is; the finish adds no colour.
    assert.equal(finish.kind,'glass');assert.equal(finish.branded,true);
    assert.equal(finish.tint,null);assert.equal(finish.material.visible,false);
    finish.dispose();
  }
  const glass=createSurfaceMaterial();
  assert.equal(glass.kind,'glass');assert.equal(glass.branded,false);assert.equal(glass.tint,null);
  const chromatic=createSurfaceMaterial({theme:{type:'metal',variant:'chromatic'},fg:'#ffffff',brand:brands[2]});
  assert.equal('#'+chromatic.material.color.getHexString(),resolveBrandMetalColors({},{foreground:'#ffffff'}).base);
  assert.equal(chromatic.shaderPreset,'chromatic');assert.equal(chromatic.material.iridescence,0);
  glass.dispose();chromatic.dispose();
});
