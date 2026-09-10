import * as T from 'three';
import { addBoard } from './Signboard.js';

const clamp=x=>T.MathUtils.clamp(x,0,1);
const material=(color,transparent=false)=>{const m=new T.MeshStandardMaterial({color,roughness:.45,metalness:.12,transparent,opacity:transparent?.65:1});m.userData.outlineParameters={visible:false};return m;};
const glow=color=>{const m=new T.MeshBasicMaterial({color});m.userData.outlineParameters={visible:false};return m;};
const V=(x,y,z)=>new T.Vector3(x,y,z);

// One simulation shared by the three lessons. Heat changes matter over time;
// interactions only configure equipment, never mark a puzzle as solved.
export function initialPhaseState(kind){return {heat:0,freeze:false,cool:false,align:0,plug:kind==='condenser'?0:1,water:kind==='condenser'?1:0,ice:0,tank:0,bridgeReady:false,completed:false};}
export function advancePhase(s,kind,dt){
  if(s.completed)return;
  const melt=kind!=='condenser'&&s.heat===1;
  if(melt)s.plug=clamp(s.plug-dt/3);
  if(s.plug===0)s.water=clamp(s.water+dt/3);
  if(kind!=='condenser'){
    if(kind==='bridge'&&s.heat===2)s.ice=clamp(s.ice-dt/2);
    else if(s.freeze&&s.water>=.98)s.ice=clamp(s.ice+dt/3);
    if(s.ice>=.98)s.bridgeReady=true;
  }
  const boil=kind==='condenser'?s.heat===1:s.heat===2;
  if(kind!=='bridge'&&boil&&s.water>=.98&&s.cool&&s.align===2&&(kind!=='restore'||s.bridgeReady))s.tank=clamp(s.tank+dt/6);
}

export class WaterPhaseGate {
  constructor(scene,seg,opts={},kind='bridge'){
    this.seg=seg;this.kind=kind;this.state=initialPhaseState(kind);this.time=0;this.controls=[];this.obstacles=[];
    this.group=new T.Group();this.group.name=`water-phase-${kind}`;scene.add(this.group);
    this.stone=material(0xd6d8c6);this.brass=material(0xb69a59);this.dark=material(0x243f4b);
    this.waterMat=material(0x259fc2,true);this.iceMat=material(0xaff4f1,true);this.hot=glow(0xf6a15d);this.cold=glow(0x75e1f2);
    this.z=seg.z1;const z=b=>this.z-b;
    this.box=(w,h,d,x,y,zz,m=this.stone,parent=this.group)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,zz);o.castShadow=!m.transparent;o.receiveShadow=true;parent.add(o);return o;};
    this.pipe=(a,b,m=this.brass,r=.075)=>{const delta=b.clone().sub(a),o=new T.Mesh(new T.CylinderGeometry(r,r,delta.length(),10),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());this.group.add(o);return o;};
    const control=(id,name,x,y,back)=>{
      const p=V(x,y,z(back));this.box(.48,1,.48,x,y+.5,p.z,this.dark);
      const knob=new T.Mesh(new T.TorusGeometry(.25,.06,8,20),this.brass);knob.position.set(x,y+1.15,p.z);this.group.add(knob);
      const badge=addBoard(scene,seg,-1,name,'',0xa9e7dc);badge.group.position.set(x,y+1.95,p.z);badge.group.rotation.set(0,0,0);badge.group.scale.setScalar(.48);
      const c={id,name,p,knob,badge,last:''};this.controls.push(c);return c;
    };
    if(kind==='bridge'){
      control('heat','① 가열 방향',-2.5,0,2.8);control('freeze','② 도랑 냉각',2.5,0,2.8);
    }else if(kind==='condenser'){
      control('heat','① 가열 용기',-2.8,0,2.8);control('align','② 집수판 이동',0,0,2.8);control('cool','③ 집수판 냉각',2.8,0,2.8);
    }else{
      control('heat','① 가열 방향',-2.5,0,3.4);control('freeze','② 얼음 다리 냉각',2.5,0,3.4);
      control('cool','③ 집수판 냉각',-8,3,12);control('align','④ 집수판 이동',8,3,12);
    }
    // Reservoir, visible ice plug and liquid channel.
    const sourceY=kind==='restore'?3.5:0;
    this.sourceY=sourceY;
    if(sourceY)this.box(1.1,sourceY,1.2,-2.5,sourceY/2,z(5));
    this.box(2,.35,1.8,-2.5,sourceY+.18,z(5),this.dark);
    this.sourceWater=this.box(1.7,.12,1.5,-2.5,sourceY+.44,z(5),this.waterMat);
    this.plug=this.box(.85,1,.85,-2.5,sourceY+.95,z(5),this.iceMat);
    this.plug.visible=kind!=='condenser';
    this.obstacles.push({x:-2.5,z:z(5),r:1});
    this.pipe(V(-2.5,sourceY+.5,z(5)),V(0,kind==='restore'?3.12:.5,z(kind==='restore'?16:6)),this.brass,.13);
    this.channel=this.box(kind==='restore'?4:seg.x1-seg.x0-.4,.05,kind==='restore'?2:3.5,0,.12,z(7.5),this.waterMat);
    this.bridge=this.box(kind==='restore'?4:seg.x1-seg.x0-.4,.16,kind==='restore'?2:3.5,0,.12,z(7.5),this.iceMat);
    if(kind==='condenser'){this.channel.visible=false;this.bridge.visible=false;}
    if(kind==='restore'){this.bridge.visible=false;this.channel.scale.set(3,1,2);this.channel.position.set(0,3.04,z(16));}
    if(kind==='bridge'){
      const rects=opts.dungeon.rects,i=rects.indexOf(seg);
      this.gap={...seg,z0:z(9.25),z1:z(5.75),open:false};
      rects.splice(i,1,{...seg,z0:z(5.75),open:true},this.gap,{...seg,z1:z(9.25),open:true});
    }
    this.heatBeam=this.pipe(V(-2.5,.7,z(3)),V(-2.5,.8,z(5)),this.hot,.09);
    this.coldBeam=this.pipe(V(2.5,.7,z(3)),V(0,kind==='restore'?3.1:.2,z(kind==='restore'?16:7.5)),this.cold,.07);
    this.heatBeam.geometry.dispose();this.heatBeam.geometry=new T.CylinderGeometry(.09,.09,1,10);
    this.flowDrops=Array.from({length:9},()=>{const d=new T.Mesh(new T.SphereGeometry(.07,6,5),this.cold);this.group.add(d);return d;});
    if(kind!=='bridge'){
      const upper=kind==='restore'?4.2:3.6,back=kind==='restore'?16:6;
      this.boiler=this.box(1.4,1.1,1.4,-2.5,.7,z(back),this.dark);
      this.obstacles.push({x:-2.5,z:z(back),r:.85},{x:2,z:z(back+2),r:1});
      this.boilingWater=this.box(1.15,.10,1.15,-2.5,1.28,z(back),this.waterMat);
      this.pipe(V(-2.5,1.4,z(back)),V(-2.5,upper-.35,z(back)),this.brass,.12);
      this.pipe(V(-2.5,upper-.35,z(back)),V(2,upper-.35,z(back)),this.brass,.12);
      this.collector=this.box(1.3,.15,1.4,-2,upper,z(back),this.brass);
      this.funnel=this.box(1.35,.2,1.5,2,upper-1,z(back),this.brass);
      this.pipe(V(2,upper-1,z(back)),V(2,1.5,z(back+2)),this.brass,.09);
      this.box(1.9,.3,1.9,2,.15,z(back+2),this.dark);
      for(const dx of [-.94,.94])this.box(.1,1.65,1.9,2+dx,.9,z(back+2));
      this.box(1.8,1.65,.12,2,.9,z(back+2)-.9);
      this.tank=this.box(1.65,1,1.6,2,.4,z(back+2),this.waterMat);
      this.float=this.box(1.5,.15,1.4,2,.4,z(back+2),this.brass);
      // Missed condensate is caught and returned to the supply instead of lost.
      this.box(5.4,.12,1.7,0,.18,z(back),this.dark);
      this.pipe(V(-2,.25,z(back)),V(-2.5,.25,z(5)),this.brass,.08);
      this.drops=Array.from({length:12},()=>{const d=new T.Mesh(new T.SphereGeometry(.045,6,5),this.cold);this.group.add(d);return d;});
      this.cloud=Array.from({length:6},(_,i)=>{const d=new T.Mesh(new T.SphereGeometry(.10,8,6),material(0xebfffa,true));d.position.set(-2.5,1.6+i*.22,z(back));this.group.add(d);return d;});
      this.upper=upper;this.back=back;
      this.statusBoard=addBoard(scene,seg,1,'목표 수조','',0xa9e7dc);this.statusBoard.group.position.set(2,2.3,z(back+2));this.statusBoard.group.rotation.set(0,0,0);this.statusBoard.group.scale.setScalar(.58);
    }
    this.valves=[{filled:false},{filled:false},{filled:false}];this.paint();
  }
  near(p){let best=null,distance=1.65;for(const c of this.controls){const d=p.distanceTo(c.p);if(d<distance){best=c;distance=d;}}return best;}
  controlText(c){const s=this.state;if(c.id==='heat')return this.kind==='condenser'?(s.heat?'가열 중 · 끄기':'가열 꺼짐 · 켜기'):['꺼짐 → 얼음 마개 가열','마개 가열 → '+(this.kind==='bridge'?'도랑 가열':'용기 가열'),(this.kind==='bridge'?'도랑':'용기')+' 가열 → 끄기'][s.heat];if(c.id==='align')return ['왼쪽','가운데','오른쪽 · 물받이 위'][s.align]+' → 이동';return (s[c.id]?'냉각 중 → 끄기':'냉각 꺼짐 → 켜기');}
  prompt(p){if(this.state.completed)return null;const c=this.near(p);if(c)return `E — ${c.name} · ${this.controlText(c)}`;return this.status();}
  status(){const s=this.state;if(this.kind!=='condenser'&&s.plug>0)return `얼음 마개를 가열해 물을 보내자 · 남은 얼음 ${Math.ceil(s.plug*100)}%`;
    if(s.water<.98)return `녹은 물이 도랑으로 흐르는 중 · ${Math.floor(s.water*100)}%`;
    if(this.kind==='bridge')return s.ice>=.98?'얼음 다리가 완성됐다 — 건너서 출구로':`물이 찼다 · 도랑을 냉각해 다리를 만들자 (${Math.floor(s.ice*100)}%)`;
    if(this.kind==='restore'&&!s.bridgeReady)return '도랑을 냉각해 회랑 사이 얼음 다리를 만들자';
    if((this.kind==='condenser'?s.heat!==1:s.heat!==2))return '물이 든 용기를 가열해 위쪽으로 보내자';
    if(!s.cool)return '집수판이 따뜻하다 — 냉각하면 물방울이 맺힌다';
    if(s.align!==2)return '물방울이 물받이를 빗나간다 — 집수판 위치를 옮기자';
    return `응결된 물이 수조를 채운다 · ${Math.floor(s.tank*100)}%`;
  }
  interact(p){if(this.state.completed)return false;const c=this.near(p);if(!c)return false;const s=this.state;if(c.id==='heat')s.heat=(s.heat+1)%(this.kind==='condenser'?2:3);else if(c.id==='align')s.align=(s.align+1)%3;else s[c.id]=!s[c.id];this.paint();return true;}
  update(dt,actor){advancePhase(this.state,this.kind,dt);this.time+=dt;this.paint();if(this.gap&&!this.gap.open&&actor&&actor.position.z<this.gap.z1&&actor.position.z>this.gap.z0&&actor.position.y<.3)return {fail:'다리가 녹았다 — 앞쪽 안전 발판에서 다시 냉각하자'};return {};}
  solvedBy(actor){return this.state.completed||(this.kind==='bridge'?this.state.ice>=.98&&actor.position.z<this.gap.z0-.4:this.state.tank>=1);}
  complete(){this.state.completed=true;if(this.kind==='bridge')this.state.ice=1;else this.state.tank=1;this.paint();}
  restart(){this.state=initialPhaseState(this.kind);this.paint();}
  paint(){
    const s=this.state;this.plug.scale.setScalar(Math.max(.001,s.plug));this.plug.visible=this.kind!=='condenser'&&s.plug>.001;
    if(this.kind!=='condenser'){this.channel.visible=s.water>.01&&!(this.kind==='restore'&&s.bridgeReady);this.channel.material.opacity=.15+s.water*.55;this.bridge.visible=this.kind==='bridge'&&s.ice>.01;this.bridge.scale.y=Math.max(.01,s.ice);this.iceMat.opacity=.2+s.ice*.65;}
    if(this.gap)this.gap.open=s.ice>=.98||s.completed;
    this.heatBeam.visible=s.heat>0&&!s.completed;this.coldBeam.visible=s.freeze&&!s.completed;
    const origin=V(-2.5,.7,this.z-3),end=s.heat===1&&this.kind!=='condenser'?V(-2.5,this.sourceY+.8,this.z-5):this.kind==='bridge'?V(0,.18,this.z-7.5):V(-2.5,.65,this.z-this.back);
    const beam=end.clone().sub(origin);this.heatBeam.position.copy(origin).add(end).multiplyScalar(.5);this.heatBeam.scale.y=beam.length();this.heatBeam.quaternion.setFromUnitVectors(V(0,1,0),beam.normalize());
    this.flowDrops.forEach((m,i)=>{const t=(this.time*.5+i/9)%1;m.visible=this.kind!=='condenser'&&s.plug===0&&s.water<1;m.position.copy(V(-2.5,this.sourceY+.53,this.z-5)).lerp(V(0,this.kind==='restore'?3.12:.2,this.z-(this.kind==='restore'?16:7.5)),t);});
    if(this.kind==='bridge')this.heatBeam.material.color.set(s.heat===2?0xff643f:0xf6a15d);
    this.valves[0].filled=s.bridgeReady;this.valves[1].filled=s.tank>=.5;this.valves[2].filled=s.tank>=1;
    if(this.kind==='condenser')this.valves[0].filled=s.tank>0;
    for(const c of this.controls){const text=this.controlText(c);c.knob.rotation.z=(c.id==='align'?s.align:s[c.id]?1:0)*Math.PI/3;if(text!==c.last){c.badge.set(c.name,text);c.last=text;}}
    if(this.collector){const x=-2+s.align*2;this.collector.position.x=x;this.collector.material=s.cool?this.cold:this.brass;
      this.tank.scale.y=Math.max(.015,s.tank*1.25);this.tank.position.y=.3+s.tank*.625;this.float.position.y=.32+s.tank*1.25;
      const boiling=s.water>=.98&&(this.kind==='condenser'?s.heat===1:s.heat===2),condensing=boiling&&s.cool;
      this.cloud.forEach((m,i)=>{m.visible=boiling;m.position.y=1.55+(this.time*.5+i*.24)%1.4;});
      this.drops.forEach((m,i)=>{m.visible=condensing;const t=(this.time*.75+i/12)%1;m.position.set(x+Math.sin(i*5)*.28,this.upper-.12-t*(s.align===2?.75:this.upper-.35),this.z-this.back+Math.cos(i*5)*.3);});
      const text=s.completed?'복구 완료':this.status();if(text!==this.lastStatus){this.statusBoard.set(`모인 물 ${Math.floor(s.tank*100)}%`,text);this.lastStatus=text;}
    }
  }
}
export class MeltBridge extends WaterPhaseGate {constructor(s,r,o){super(s,r,o,'bridge');}}
export class CondenseLift extends WaterPhaseGate {constructor(s,r,o){super(s,r,o,'condenser');}}
export class RestoreCourt extends WaterPhaseGate {constructor(s,r,o){super(s,r,o,'restore');}}

export class WaterAwakening {
  constructor(scene,seg,theme){this.seg=seg;this.progress=0;this.active=false;this.altar=V(0,0,seg.z1-4);this.prizePos=V(0,0,seg.z1-3);this.obstacles=[{x:0,z:seg.z0+5,r:2}];
    this.group=new T.Group();scene.add(this.group);this.mat=material(theme.glow,true);
    this.god=new T.Mesh(new T.IcosahedronGeometry(1.6,1),this.mat);this.god.position.set(0,3,seg.z0+5);this.group.add(this.god);
    this.ring=new T.Mesh(new T.TorusGeometry(2.2,.09,8,36),glow(0xb2ebec));this.ring.position.copy(this.god.position);this.group.add(this.ring);
    const altar=new T.Mesh(new T.CylinderGeometry(.9,1.1,1,16),material(0x315664));altar.position.copy(this.altar).y=.5;this.group.add(altar);
    this.board=addBoard(scene,seg,-1,'다시 흐르는 성소','복구한 물의 흐름을 제단에 전하자',theme.glow);this.board.group.position.set(0,2,seg.z1-4);this.board.group.rotation.set(0,0,0);
  }
  get solved(){return this.progress>=1;}
  prompt(p){return this.solved?null:this.active?'얼음 → 물 → 수증기 → 물 · 같은 물이 성소를 깨운다':p.distanceTo(this.altar)<2?'E — 복구한 성소 깨우기':'성소의 제단으로 다가가자';}
  interact(p){if(this.active||p.distanceTo(this.altar)>=2)return false;this.active=true;return true;}
  update(dt){if(this.active)this.progress=clamp(this.progress+dt/4);this.god.rotation.y+=dt*.35;this.ring.rotation.z+=dt*.15;this.mat.color.set(this.solved?0xffd27a:this.progress<.33?0xbfe4f5:this.progress<.66?0x3d8fc4:0xdfeef4);const text=this.solved?'물이 다시 흐른다 — 지혜의 구슬을 받자':this.active?['얼음이 녹아 물이 흐른다','가열된 물이 수증기가 된다','차가운 곳에서 물방울로 모인다'][Math.min(2,Math.floor(this.progress*3))]:'복구한 물의 흐름을 제단에 전하자';if(text!==this.text){this.board.set('다시 흐르는 성소',text);this.text=text;}}
  solvedBy(){return this.solved;}
  restart(){this.active=false;this.progress=0;this.update(0);}
}
