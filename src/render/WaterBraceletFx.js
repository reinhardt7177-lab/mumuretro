// Water-bracelet art is independent of puzzle/save state. All sizes are metres.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { quality } from './Quality.js';

const V = (x=0,y=0,z=0) => new T.Vector3(x,y,z);
const smooth = (a,b,x) => T.MathUtils.smoothstep(x,a,b);
const cool = new T.Color(0x7be1ff), warm = new T.Color(0xffc56b);
const noOutline = m => {m.userData.outlineParameters={visible:false};return m;};
const metal = (color,roughness=.32) => noOutline(new T.MeshStandardMaterial({color,metalness:.72,roughness}));
const drop = () => {const s=new T.Shape();s.moveTo(0,.037);s.bezierCurveTo(-.008,.017,-.026,.003,-.023,-.013);s.bezierCurveTo(-.020,-.041,.020,-.041,.023,-.013);s.bezierCurveTo(.026,.003,.008,.017,0,.037);return s;};
let enamelMap;
function agedEnamel(){
  if(enamelMap)return enamelMap;
  const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');
  x.fillStyle='#6faaa2';x.fillRect(0,0,c.width,c.height);let seed=197;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<1800;i++){x.fillStyle=`rgba(${rnd()>.3?'24,57,58':'175,142,85'},${.035+rnd()*.08})`;x.beginPath();x.ellipse(rnd()*512,rnd()*256,2+rnd()*11,1+rnd()*5,rnd()*Math.PI,0,Math.PI*2);x.fill();}
  enamelMap=new T.CanvasTexture(c);enamelMap.colorSpace=T.SRGBColorSpace;return enamelMap;
}
function cutGem(){
  const contour=drop().getSpacedPoints(40).slice(0,40),p=[],indices=[];
  for(const [scale,z] of [[1,0],[.70,.008],[.32,.013]])for(const v of contour)p.push(v.x*scale,(v.y+.003)*scale-.003,z);
  p.push(0,-.003,.016);
  for(let row=0;row<2;row++)for(let i=0;i<40;i++){const a=row*40+i,b=row*40+(i+1)%40;indices.push(a,b,a+40,b,b+40,a+40);}
  for(let i=0;i<40;i++)indices.push(80+i,80+(i+1)%40,120);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);const facets=g.toNonIndexed();g.dispose();facets.computeVertexNormals();return facets;
}

/** Open bronze cuff, teal enamel, raised wave engraving and a bevelled gem. */
export function buildWaterCuff(){
  const root=new T.Group();root.name='water-bracelet-cuff';
  const bronze=metal(0x97704a,.39),gold=metal(0xe0bc75,.25),patina=metal(0x619f99,.47);patina.map=agedEnamel();
  const R=.065,W=.086,start=.34,length=Math.PI*2-.68;
  const band=new T.Mesh(new T.CylinderGeometry(R,R,W,64,1,true,start,length),bronze);root.add(band);
  const lining=new T.Mesh(new T.CylinderGeometry(R-.006,R-.006,W-.005,64,1,true,start,length),patina);lining.material.side=T.DoubleSide;root.add(lining);
  const enamel=new T.Mesh(new T.CylinderGeometry(R+.0008,R+.0008,W-.018,64,1,true,start,length),patina);root.add(enamel);
  // CylinderGeometry uses x=sin(theta), z=cos(theta); the clasp gap is behind.
  root.children.forEach(m=>m.rotation.y=Math.PI);
  function strand(points,r=.0016){const curve=new T.CatmullRomCurve3(points);const mesh=new T.Mesh(new T.TubeGeometry(curve,Math.max(28,points.length*2),r,5,false),gold);root.add(mesh);return mesh;}
  for(const side of [-1,1]){
    strand(Array.from({length:65},(_,i)=>{const a=start+i*length/64+Math.PI;return V(Math.sin(a)*(R+.002),side*(W/2-.003),Math.cos(a)*(R+.002));}),.0026);
    // Two mirrored currents curve into the central droplet instead of a flat decal.
    strand(Array.from({length:55},(_,i)=>{const a=-2.64+i*5.28/54;return V(Math.sin(a)*(R+.003),side*(.013+.013*Math.sin(a*2.2)),Math.cos(a)*(R+.003));}));
    for(const a of [-2.66,2.66])strand([V(Math.sin(a)*(R+.002),-W/2,Math.cos(a)*(R+.002)),V(Math.sin(a)*(R+.002),W/2,Math.cos(a)*(R+.002))],.0025);
    const curl=[];
    for(let i=0;i<=48;i++){const t=i/48,angle=-1.2+t*6.4,r=1-t*.89,a=side*(1.12+Math.cos(angle)*.37*r),y=.003+Math.sin(angle)*.021*r;curl.push(V(Math.sin(a)*(R+.004),y,Math.cos(a)*(R+.004)));}
    strand(curl,.0019);
    // Small chased accents surround the current rather than crowd the gemstone.
    for(let i=0;i<7;i++){const a=side*(.57+i*.27),dot=new T.Mesh(new T.SphereGeometry(.0015,6,4),gold);dot.position.set(Math.sin(a)*(R+.003),-.026,Math.cos(a)*(R+.003));root.add(dot);}
  }
  const setting=new T.Mesh(new T.ExtrudeGeometry(drop(),{depth:.006,bevelEnabled:true,bevelSize:.003,bevelThickness:.002,bevelSegments:3,steps:1,curveSegments:18}),gold);
  setting.position.z=R-.004;root.add(setting);
  const gemMat=noOutline(new T.MeshPhysicalMaterial({color:0x1699ad,metalness:.08,roughness:.13,clearcoat:1,clearcoatRoughness:.08,emissive:0x1d9aab,emissiveIntensity:.20}));
  const gem=new T.Mesh(cutGem(),gemMat);
  gem.scale.set(.92,.92,1);gem.position.set(0,0,R+.005);root.add(gem);
  const emitter=new T.Object3D();emitter.name='bracelet-light-origin';emitter.position.set(0,0,R+.026);root.add(emitter);
  // Tiny engraving does not need a draw call per bead or curve.
  root.updateMatrixWorld(true);const goldParts=root.children.filter(o=>o.isMesh&&o.material===gold),pieces=goldParts.map(o=>{const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();return g.applyMatrix4(o.matrix);});
  const gilding=new T.Mesh(mergeGeometries(pieces),gold);gilding.name='raised-wave-and-gem-setting';
  for(const o of goldParts){o.removeFromParent();o.geometry.dispose();}pieces.forEach(g=>g.dispose());root.add(gilding);
  root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});
  root.userData.gem=gem;root.userData.emitter=emitter;return root;
}

const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
function luminous(fragment){return noOutline(new T.ShaderMaterial({uniforms:{color:{value:cool.clone()},alpha:{value:0},time:{value:0}},vertexShader:vertex,fragmentShader:`uniform vec3 color;uniform float alpha;uniform float time;varying vec2 vUv;${fragment}`,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false}));}
function glow(){const m=luminous(`void main(){float r=length(vUv-.5)*2.;float a=exp(-r*r*5.)*(1.-smoothstep(.6,1.,r));gl_FragColor=vec4(color,a*alpha);}`);return new T.Mesh(new T.PlaneGeometry(1,1),m);}

export class WaterBraceletFx {
  constructor(){
    this.root=new T.Group();this.root.name='water-bracelet-effects';this.root.visible=false;
    this.cuff=buildWaterCuff();this.cuff.visible=false;
    this.handGlow=glow();this.handGlow.scale.setScalar(.25);this.root.add(this.handGlow);
    this.hitGlow=glow();this.hitGlow.scale.setScalar(.8);this.root.add(this.hitGlow);
    this.ring=new T.Mesh(new T.PlaneGeometry(2.7,2.7),luminous(`void main(){float r=length(vUv-.5)*2.;float ring=exp(-pow((r-.76)*44.,2.));float inner=exp(-pow((r-.67)*65.,2.))*.23;gl_FragColor=vec4(color,(ring+inner)*alpha);}`));
    this.ring.rotation.x=-Math.PI/2;this.root.add(this.ring);
    this.ripples=[0,1].map(()=>{const m=new T.Mesh(new T.PlaneGeometry(1,1),luminous(`void main(){float r=length(vUv-.5)*2.;float a=exp(-pow((r-.72)*26.,2.));gl_FragColor=vec4(color,a*alpha);}`));m.rotation.x=-Math.PI/2;this.root.add(m);return m;});
    this.ribbon=new T.Mesh(this.makeRibbon(),luminous(`void main(){float edge=abs(vUv.y-.5)*2.;float mist=exp(-edge*edge*5.)*.19;float core=exp(-edge*edge*90.)*.7;float taper=smoothstep(0.,.055,vUv.x)*(1.-smoothstep(.91,1.,vUv.x));float flow=.88+.12*sin(vUv.x*23.-time*6.);gl_FragColor=vec4(mix(color,vec3(1.),core*.46),(mist+core)*taper*flow*alpha);}`));
    this.ribbon.frustumCulled=false;this.root.add(this.ribbon);
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(32*3),3));geometry.setAttribute('seed',new T.Float32BufferAttribute(Array.from({length:32},(_,i)=>i/32),1));geometry.setAttribute('fade',new T.Float32BufferAttribute(new Float32Array(32),1));
    const particles=noOutline(new T.ShaderMaterial({uniforms:{color:{value:cool.clone()},alpha:{value:0},size:{value:1}},vertexShader:`attribute float seed;attribute float fade;uniform float size;varying float vSeed;varying float vFade;void main(){vSeed=seed;vFade=fade;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*(.7+seed*.7)/max(.4,-p.z),1.,12.);}`,fragmentShader:`uniform vec3 color;uniform float alpha;varying float vSeed;varying float vFade;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(color,exp(-r*r*5.)*(1.-smoothstep(.4,1.,r))*alpha*vFade*(.45+vSeed*.5));}`,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
    this.particles=new T.Points(geometry,particles);this.particles.frustumCulled=false;this.root.add(this.particles);
    this.source=V();this.end=V();this.direction=V();this.side=V();this.normal=V();this.view=V();this.point=V();this.goal=V();
    this.ray=new T.Raycaster();this.age=10;this.amount=0;this.select=0;this.pose={weight:0,target:V()};this.lastSerial=0;this.trial=null;
    this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  }
  makeRibbon(){const positions=[],uvs=[],indices=[];for(let i=0;i<=24;i++){positions.push(0,0,0,0,0,0);uvs.push(i/24,0,i/24,1);if(i<24){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);return g;}
  bind(body){
    if(this.body===body)return;
    if(this.body)delete this.body.userData.waterCasting;
    this.cuff.removeFromParent();this.cuff.position.set(0,0,0);this.cuff.quaternion.identity();this.cuff.scale.setScalar(1);
    this.body=body;body.updateWorldMatrix(true,true);
    const bones=body.userData.navigator?.bones;
    if(bones?.LeftHand){
      // The cuff source is enlarged for inspection/pickup; fit it to the bare wrist.
      this.cuff.scale.setScalar(.58);
      const hand=body.worldToLocal(bones.LeftHand.getWorldPosition(V())),fore=body.worldToLocal(bones.LeftForeArm.getWorldPosition(V()));
      const axis=hand.clone().sub(fore).normalize(),front=V(1,0,.22).addScaledVector(axis,-V(1,0,.22).dot(axis)).normalize();
      this.cuff.position.copy(hand).addScaledVector(axis,-.028);this.cuff.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(axis.clone().cross(front).normalize(),axis,front));
      body.add(this.cuff);body.updateWorldMatrix(true,true);bones.LeftHand.attach(this.cuff);
    }else{const fore=body.userData.armL?.userData.lower;if(!fore)return;fore.add(this.cuff);this.cuff.position.set(0,-.235,0);}
    body.userData.waterCasting=this.pose;
  }
  settleGem(){this.cuff.userData.gem.material.emissive.copy(cool);this.cuff.userData.gem.material.emissiveIntensity=.20;}
  hide(){this.root.visible=false;this.cuff.visible=false;this.pose.weight=0;this.amount=this.select=0;this.age=10;this.trial=null;this.settleGem();}
  update(dt,room,actor,camera,blocked=false){
    if(!room?.waterAdventure||!room.bracelet){this.hide();return;}
    this.bind(actor.body);this.cuff.visible=true;
    if(this.root.parent!==room.scene)room.scene.add(this.root);
    if(blocked){this.root.visible=false;this.pose.weight=0;this.amount=0;this.age=10;this.settleGem();return;}
    const trial=room.activeTrial(actor),changed=this.trial!==trial;
    if(changed){this.trial=trial;this.age=10;this.amount=0;this.select=0;this.lastSerial=trial?.castSerial||0;}
    if(!trial){this.root.visible=false;this.pose.weight=0;return;}
    this.goal.copy(trial.braceletPoint(actor));
    if(this.lastSerial!==trial.castSerial){this.lastSerial=trial.castSerial;this.age=trial.state.transition?0:10;this.heating=trial.castHeating;this.end.copy(this.goal);}
    const reduced=this.reducedMotion.matches;
    this.age+=dt;
    const envelope=smooth(0,.20,this.age)*(1-smooth(.67,1.12,this.age));
    const eligible=trial.target(actor),casting=this.age<1.12&&eligible;
    this.amount=this.age<1.12?T.MathUtils.damp(this.amount,casting?envelope:0,casting?20:12,dt):0;
    if(this.amount<.001)this.amount=0;
    this.pose.weight=T.MathUtils.damp(this.pose.weight,casting?.94:0,casting?10:14,dt);
    actor.body.updateWorldMatrix(true,true);
    this.pose.target.copy(this.goal);actor.body.worldToLocal(this.pose.target);
    this.pose.target.sub(V(.18,1.10,0)).normalize().multiplyScalar(.49).add(V(.18,1.10,0));
    this.pose.target.x=T.MathUtils.clamp(this.pose.target.x,-.08,.55);this.pose.target.y=T.MathUtils.clamp(this.pose.target.y,.72,1.38);this.pose.target.z=Math.max(.16,this.pose.target.z);
    this.cuff.userData.emitter.getWorldPosition(this.source);
    this.end.lerp(this.goal,1-Math.exp(-dt*25));
    this.direction.copy(this.end).sub(this.source);const distance=this.direction.length();this.direction.normalize();
    // The wrist can sit behind an obstacle even if the gameplay head-ray is clear.
    this.ray.set(this.source,this.direction);this.ray.near=.04;this.ray.far=Math.max(.04,distance-.35);
    if(this.amount>.001&&this.ray.intersectObjects(room.world.dungeon.occluders,false).length)this.amount=0;
    const color=this.age<1.3?(this.heating?warm:cool):cool;
    this.select=T.MathUtils.damp(this.select,eligible&&!trial.state.motion?1:0,12,dt);
    this.ring.position.copy(trial.packetPoint);this.ring.position.y=trial.state.pos[1]+.045;
    this.ring.material.uniforms.color.value.copy(cool).lerp(new T.Color(0xffdb92),.48);this.ring.material.uniforms.alpha.value=this.select*.32;
    this.root.visible=this.select>.001||this.amount>.001;
    for(const m of [this.ribbon,this.handGlow,this.hitGlow,this.particles,...this.ripples])m.visible=this.amount>.001;
    this.ring.visible=this.select>.001;
    this.cuff.userData.gem.material.emissive.copy(color);this.cuff.userData.gem.material.emissiveIntensity=.20+this.amount*.9;
    this.handGlow.position.copy(this.source);this.hitGlow.position.copy(this.end);
    for(const m of [this.handGlow,this.hitGlow]){m.quaternion.copy(camera.quaternion);m.material.uniforms.color.value.copy(color);m.material.uniforms.alpha.value=this.amount*(m===this.handGlow?.48:.22);}
    this.view.copy(camera.position).sub(this.source).normalize();this.side.crossVectors(this.direction,this.view).normalize();if(this.side.lengthSq()<.01)this.side.set(1,0,0);this.normal.crossVectors(this.side,this.direction).normalize();
    const pos=this.ribbon.geometry.attributes.position;
    for(let i=0;i<=24;i++){const t=i/24,arc=Math.sin(t*Math.PI),r=.105*(.65+.35*arc);
      this.point.copy(this.source).lerp(this.end,t).addScaledVector(this.normal,reduced?0:Math.sin(t*9-this.age*4)*arc*.025);
      for(let j=0;j<2;j++)pos.setXYZ(i*2+j,this.point.x+this.side.x*r*(j?1:-1),this.point.y+this.side.y*r*(j?1:-1),this.point.z+this.side.z*r*(j?1:-1));
    }pos.needsUpdate=true;this.ribbon.material.uniforms.alpha.value=this.amount*.82;this.ribbon.material.uniforms.color.value.copy(color);this.ribbon.material.uniforms.time.value=reduced?0:this.age*(this.heating?1:-1);
    const pp=this.particles.geometry.attributes.position,low=['low','min'].includes(quality.name),count=reduced?0:low?12:32;
    this.particles.geometry.setDrawRange(0,count);this.particles.material.uniforms.alpha.value=this.amount*.62;this.particles.material.uniforms.color.value.copy(color);this.particles.material.uniforms.size.value=camera.projectionMatrix.elements[5]*innerHeight*.015;
    const fade=this.particles.geometry.attributes.fade;
    for(let i=0;i<count;i++){const travel=(i/count+this.age*.56)%1,t=this.heating?travel:1-travel,angle=i*2.399+this.age*.9,r=Math.sin(t*Math.PI)*(.025+(i%4)*.018);
      fade.setX(i,smooth(0,.12,t)*(1-smooth(.86,1,t)));
      this.point.copy(this.source).lerp(this.end,t).addScaledVector(this.side,Math.cos(angle)*r).addScaledVector(this.normal,Math.sin(angle)*r);pp.setXYZ(i,this.point.x,this.point.y,this.point.z);
    }pp.needsUpdate=true;fade.needsUpdate=true;
    this.ripples.forEach((m,i)=>{const t=T.MathUtils.clamp((this.age-.14-i*.15)/.95,0,1);m.position.copy(this.end);m.position.y+=.015;m.scale.setScalar(.4+t*1.8);m.material.uniforms.color.value.copy(color);m.material.uniforms.alpha.value=this.amount*(1-t)*.20;});
  }
}
