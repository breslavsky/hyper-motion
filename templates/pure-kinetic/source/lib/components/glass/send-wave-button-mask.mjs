import * as THREE from '../../vendor/three/three.module.min.js';

// The wave leaves the send button alone: the outline of its printed disc is
// cut out of the layer the wave paints, projected back onto the same plane as
// the editable DOM.
const outline=Array.from({length:48},(_,i)=>{
  const a=2*Math.PI*i/48;
  return [Math.cos(a),Math.sin(a)];
});

export function createSendWaveButtonMask(card,unit){
  const button=card.sendButton.group,face=button.children.find(part=>part.name.endsWith('-face'));
  const worldToCard=new THREE.Matrix4(),faceToCard=new THREE.Matrix4(),eye=new THREE.Vector3(),point=new THREE.Vector3();
  face.geometry.computeBoundingSphere();
  const reach=face.geometry.boundingSphere.radius;
  return function eraseButton(ctx,camera){
    if(!button.visible||button.scale.x===0)return;
    worldToCard.copy(card.group.matrixWorld).invert();
    faceToCard.multiplyMatrices(worldToCard,face.matrixWorld);
    eye.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(worldToCard);
    ctx.save();
    ctx.globalCompositeOperation='destination-out';
    ctx.fillStyle='#000';
    ctx.beginPath();
    for(let i=0;i<outline.length;i++){
      point.set(reach*outline[i][0],reach*outline[i][1],0).applyMatrix4(faceToCard);
      // Where the ray from the eye through this point of the disc meets the
      // plane of the editable DOM, in the card's logical pixels.
      const alongRay=(card.contentZ-eye.z)/(point.z-eye.z);
      const x=card.width/2+(eye.x+alongRay*(point.x-eye.x))/unit;
      const y=card.height/2-(eye.y+alongRay*(point.y-eye.y))/unit;
      if(i===0)ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
}
