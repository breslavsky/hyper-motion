import assert from 'node:assert/strict';
import {test} from 'node:test';
import {odometerPosition} from '../source/lib/components/moves.mjs';

test('settled integer drums show every exact digit including long carry chains',()=>{
  for(let value=0;value<=10000;value++)for(let place=0;place<=4;place++){
    assert.ok(Math.abs(odometerPosition(value,place,0)-Math.floor(value/10**place)%10)<1e-8,`${value}/${place}`);
  }
});

test('settled decimal drums respect the lowest displayed precision and negative values',()=>{
  for(let cents=0;cents<=10000;cents++)for(const sign of [-1,1])for(let place=-2;place<=2;place++){
    const expected=Math.floor(cents/10**(place+2))%10;
    assert.ok(Math.abs(odometerPosition(sign*cents/100,place,-2)-expected)<1e-8,`${sign*cents/100}/${place}`);
  }
});

test('higher drums carry only in the final lowest-place interval',()=>{
  for(const value of [9,99,999,9999]){
    for(let place=1;place<=String(value).length;place++){
      const digit=Math.floor(value/10**place)%10;
      assert.equal(odometerPosition(value,place,0),digit);
      assert.ok(Math.abs(odometerPosition(value+.5,place,0)-(digit+.5))<1e-8);
      assert.ok(odometerPosition(value+.999,place,0)>digit+.999);
    }
  }
  assert.equal(odometerPosition(9989.9,3,0),9,'Thousands cannot carry ten units early');
});
