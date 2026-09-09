import * as THREE from 'three';

// 항해 고리에서 행성의 가까운 표면까지 이어지는 빛. 진행 저장과 충돌에는 참여하지 않는다.
export function buildStarRoute(scene,gimbal,planet) {
  const root=new THREE.Group();root.name='행성으로 향하는 항로의 빛';scene.add(root);
  const start=gimbal.position.clone(),direction=planet.position.clone().sub(start).normalize();
  const end=planet.position.clone().addScaledVector(direction,-9.4),length=start.distanceTo(end);
  const uniforms={time:{value:0},strength:{value:.18},head:{value:1},motion:{value:1}};
  const makeBeam=(radius,alpha)=>{
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      uniforms:{...uniforms,alpha:{value:alpha}},
      vertexShader:`varying float along;void main(){along=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying float along;uniform float time,strength,head,motion,alpha;
      void main(){float packet=pow(max(0.,sin((along*7.-time*.8)*6.283185)),14.)*motion;
      float leading=1.-smoothstep(head-.025,head+.005,along);
      float brightness=(.36+packet*.64)*strength*leading;
      gl_FragColor=vec4(mix(vec3(.15,.75,1.),vec3(.8,1.,.95),packet),brightness*alpha);}`});
    mat.userData.outlineParameters={visible:false};
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,1,10,1,true),mat);
    beam.position.copy(start).lerp(end,.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);beam.scale.y=length;
    beam.userData.sky=true;beam.userData.cameraNonSolid=true;root.add(beam);return beam;
  };
  makeBeam(.055,1);makeBeam(.2,.23);makeBeam(.46,.07);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');
  const grad=ctx.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'white');grad.addColorStop(.14,'#c0ffff');grad.addColorStop(.4,'rgba(65,210,255,.5)');grad.addColorStop(1,'rgba(50,180,255,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
  const map=new THREE.CanvasTexture(canvas),glows=[];
  for(const [point,size] of [[start,1.7],[end,3.4]]){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,color:0x8cefff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));sprite.position.copy(point);sprite.scale.setScalar(size);sprite.userData.sky=true;root.add(sprite);glows.push(sprite);}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let wasOpen=false,reveal=1;
  const update=(dt,open)=>{
    if(open&&!wasOpen)reveal=reduced.matches?1:0;
    wasOpen=open;reveal=Math.min(1,reveal+dt/1.6);
    uniforms.time.value+=dt;uniforms.motion.value=reduced.matches?0:1;
    uniforms.strength.value=open?1:.24;uniforms.head.value=open?reveal:1;
    glows[0].material.opacity=open?.8:.22;glows[1].material.opacity=open?reveal*.8:.15;
  };
  update(0,false);return {root,start,end,uniforms,update};
}
