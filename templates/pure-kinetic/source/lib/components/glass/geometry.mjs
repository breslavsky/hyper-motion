import * as THREE from '../../vendor/three/three.module.min.js';

/** Fixed topology makes capsule/card morphs reversible at arbitrary times. */
export function createGlassGeometry(){
  const perimeter=[],profile=[];
  const cornerX=[1,-1,-1,1],cornerY=[1,1,-1,-1];
  const clean=x=>Math.abs(x)<1e-12?0:x;
  for(let q=0;q<4;q++)for(let k=0;k<=24;k++){
    const a=(q+k/24)*Math.PI/2;
    perimeter.push({sx:cornerX[q],sy:cornerY[q],nx:clean(Math.cos(a)),ny:clean(Math.sin(a))});
  }
  for(const side of [-1,1])for(let k=0;k<=8;k++){
    const a=(side<0?k/8:1-k/8)*Math.PI/2;
    profile.push({side,radial:clean(Math.sin(a)),nz:side*clean(Math.cos(a))});
  }
  const N=perimeter.length,L=profile.length,backCenter=N*L,frontCenter=backCenter+1;
  const positions=new Float32Array((N*L+2)*3),normals=new Float32Array(positions.length),indices=[];
  for(let j=0;j<L;j++)for(let i=0;i<N;i++){
    const p=perimeter[i],f=profile[j],v=(j*N+i)*3;
    normals[v]=p.nx*f.radial;normals[v+1]=p.ny*f.radial;normals[v+2]=f.nz;
    if(j<L-1){const a=j*N+i,b=j*N+(i+1)%N,c=a+N,d=b+N;indices.push(a,b,c,b,d,c);}
  }
  normals[backCenter*3+2]=-1;normals[frontCenter*3+2]=1;
  for(let i=0;i<N;i++){
    const next=(i+1)%N;
    indices.push(backCenter,next,i,frontCenter,(L-1)*N+i,(L-1)*N+next);
  }
  const geometry=new THREE.BufferGeometry();
  const positionAttribute=new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position',positionAttribute);
  geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setIndex(indices);
  // Keep bevel and cap index ranges stable throughout the morph.
  const bevelCount=(L-1)*N*6;
  geometry.addGroup(0,bevelCount,1);
  geometry.addGroup(bevelCount,indices.length-bevelCount,0);
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),4);
  let previousW=-1,previousH=-1,previousR=-1,previousD=-1,previousB=-1;
  function update(w,h,r,d,b){
    if(w===previousW&&h===previousH&&r===previousR&&d===previousD&&b===previousB)return;
    previousW=w;previousH=h;previousR=r;previousD=d;previousB=b;
    for(let j=0;j<L;j++){
      const f=profile[j],inset=b*(1-f.radial),z=f.side*(d/2-b)+b*f.nz;
      for(let i=0;i<N;i++){
        const p=perimeter[i],v=(j*N+i)*3;
        positions[v]=p.sx*(w/2-r)+(r-inset)*p.nx;
        positions[v+1]=p.sy*(h/2-r)+(r-inset)*p.ny;
        positions[v+2]=z;
      }
    }
    positions[backCenter*3+2]=-d/2;positions[frontCenter*3+2]=d/2;
    positionAttribute.needsUpdate=true;geometry.boundingSphere.radius=Math.hypot(w,h,d)/2;
  }
  return {geometry,update,get depth(){return previousD;},get width(){return previousW;},get height(){return previousH;},get radius(){return previousR;},get bevel(){return previousB;},dispose(){geometry.dispose();}};
}
