import * as T from 'three';
import { EVAPORATION_COURT as D } from '../data/evaporationCourt.js';
import { EVAPORATION_PALETTE as P } from '../data/lighting.js';

// A short material-flow cue. Ownership, solve state and input remain with the
// existing gate; there is no simulation clock or animation lock in the save.
export function attachSeparationProcess(g,scene,api){
  const root=new T.Group();root.name='분리 과정 표시';scene.add(root);
  const particleGeo=new T.IcosahedronGeometry(.04,0),dummy=new T.Object3D();
  const materials={demag:new T.MeshStandardMaterial({color:P.iron,roughness:.75}),filtered:new T.MeshStandardMaterial({color:P.sand,roughness:.9})};
  const waterMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{clock:{value:0},water:{value:new T.Color(P.water)}},
    vertexShader:'varying vec2 uvFlow;void main(){uvFlow=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 uvFlow;uniform float clock;uniform vec3 water;void main(){float flow=.5+.5*sin(uvFlow.x*90.-clock*18.);gl_FragColor=vec4(mix(water,vec3(.7,.9,1.),flow*.22),.18+.27*pow(flow,3.));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
  waterMat.userData.outlineParameters={visible:false};
  let run=null;const canonical=api.sync.bind(api),paintGate=g._paint.bind(g),interact=g.interact.bind(g),update=g.update.bind(g);
  const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function reset(){g.fluid.position.y=D.fluidY;for(const m of api.grains.salt.children)m.scale.setScalar(1);}
  function cancel(){run=null;for(const o of [...root.children]){o.removeFromParent();if(o.userData.transientTube)o.geometry.dispose();}reset();canonical();}
  function stream(){
    if(run?.kind!=='filtered')return;
    for(const o of [...root.children])if(o.userData.transientTube){o.removeFromParent();o.geometry.dispose();}
    const a=run.start.clone(),b=new T.Vector3(g.filter.x,1.73,g.filter.z),c=new T.Vector3(g.filter.x,1.29,g.filter.z),d=new T.Vector3(g.filter.x,1.15,g.filter.z);
    const lip=b.clone().sub(a);lip.y=0;lip.normalize().multiplyScalar(D.potRadius);a.add(lip).y+=.04;
    // Straight, descending segments: a high arc would imply water flowing up.
    run.streamDown=a.y>b.y&&b.y>c.y&&c.y>d.y;
    if(!run.streamDown)return;
    for(const points of [[a,b],[c,d]]){const tube=new T.Mesh(new T.TubeGeometry(new T.LineCurve3(...points),10,.018,6,false),waterMat);tube.userData.transientTube=true;root.add(tube);}
  }
  function paint(){
    if(!run)return;const t=T.MathUtils.clamp(run.time/run.duration,0,1);waterMat.uniforms.clock.value=run.time;
    if(run.kind==='demag'||run.kind==='filtered'){
      const target=run.kind==='demag'?api.extractedIron:api.residue;target.visible=false;
      run.targets.forEach((point,i)=>{const progress=T.MathUtils.smoothstep(t*1.55-i/run.targets.length*.45,0,1),p=run.start.clone().lerp(point,progress);
        if(run.kind==='demag')p.x+=Math.sin(Math.PI*progress)*.08*Math.sin(i*3);
        dummy.position.copy(p);dummy.scale.setScalar(.85+Math.sin(i*2)*.15);dummy.updateMatrix();run.particles.setMatrixAt(i,dummy.matrix);});run.particles.instanceMatrix.needsUpdate=true;
      for(const o of root.children)if(o.userData.transientTube)o.visible=t<.85;
    }else{
      g.fluid.visible=true;g.fluid.position.y=T.MathUtils.lerp(D.fluidY,.07,t);
      for(const m of api.grains.salt.children)m.scale.setScalar(T.MathUtils.smoothstep(t,.25,1));
    }
  }
  api.sync=(...args)=>{canonical(...args);paint();};
  const process={
    get active(){return run;},root,cancel,
    correctStart(position){if(!run||run.kind==='salt')return;run.start.copy(position).add(new T.Vector3(0,D.fluidY,0));stream();paint();},
    play(kind,start){cancel();if(reduced())return;run={kind,time:0,duration:kind==='demag'?1:kind==='filtered'?1.3:1.5,start:start.clone().add(new T.Vector3(0,D.fluidY,0))};
      if(kind!=='salt'){const parts=kind==='demag'?api.extractedIron.children:api.residue.children.slice(1);run.targets=parts.map(m=>m.getWorldPosition(new T.Vector3()));run.particles=new T.InstancedMesh(particleGeo,materials[kind],parts.length);root.add(run.particles);stream();}paint();},
    update(dt,actor){if(!run)return;const p=actor.position,s=g.seg;if(reduced()||p.z<s.z0||p.z>s.z1||p.x<s.x0||p.x>s.x1){cancel();return;}run.time+=Math.max(0,dt);if(run.time>=run.duration)cancel();else paint();},
  };
  api.process=process;
  g._paint=()=>{cancel();paintGate();};
  g.interact=pos=>{const before=g.state,start=g.pot.getWorldPosition(new T.Vector3()),ok=interact(pos);if(ok&&g.state!==before&&['demag','filtered','salt'].includes(g.state))process.play(g.state,start);else if(ok)cancel();return ok;};
  g.update=(dt,actor)=>{const result=update(dt,actor);process.update(dt,actor);return result;};
  return process;
}
