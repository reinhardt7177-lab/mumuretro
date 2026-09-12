import * as THREE from 'three';
import { shuffle } from '../util/rand.js';
import { templePart } from './BalanceTemple.js';

const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.65,metalness:.25});
const gold=mat(0xb58b43),stone=mat(0xc7c5aa),teal=mat(0x216878),wood=mat(0x987044);
const glow=c=>{const m=new THREE.MeshBasicMaterial({color:c});m.userData.outlineParameters={visible:false};return m;};
export function label(text,x,y,z,size=1,parent){
  const cv=document.createElement('canvas'),width=text.length<=2?128:text.length<=5?256:512;cv.width=width;cv.height=128;
  const c=cv.getContext('2d');c.fillStyle='#102e39';c.fillRect(0,0,width,128);c.strokeStyle='#baab73';c.lineWidth=5;c.strokeRect(4,4,width-8,120);
  c.fillStyle='#fff5ce';c.font='bold '+(text.length<=2?64:48)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,width/2,67,width-16);
  const m=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv)});m.userData.outlineParameters={visible:false};
  const p=new THREE.Mesh(new THREE.PlaneGeometry(size,size*128/width),m);p.position.set(x,y,z);parent.add(p);return p;
}
const box=(w,h,d,m,x,y,z,parent)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
function crate(w,unknown,index){const g=templePart('crate')||new THREE.Group();if(!g.children.length)box(.7,.7,.7,wood,0,.35,0,g);g.scale.setScalar(unknown?[.82,1.1,.94,1.23,1][index]:1);label(unknown?['☽','◇','✦','○','△'][index]:`${w}`,0,.43,.42,.48,g);return g;}
function pad(parent,x,z,size=1){const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);const art=templePart('plinth');if(art){art.scale.set(size,.5,size);g.add(art);}else box(size*1.5,.2,size*1.5,stone,0,.1,0,g);const m=glow(0x56c9c1),ring=new THREE.Mesh(new THREE.TorusGeometry(size*.7,.035,6,32),m);ring.rotation.x=-Math.PI/2;ring.position.y=.23;g.add(ring);return {x,z,group:g,mat:m};}

class CarryTrial {
  constructor(scene,seg){this.seg=seg;this.root=new THREE.Group();scene.add(this.root);this.held=null;this.solved=false;this.stock=[];this.cells=[];this.obstacles=[];this.progressCodec={capture:()=>({version:3,fields:this.state()}),valid:s=>s?.version===3&&this.valid(s.fields),restore:s=>this.restore(s.fields)};}
  addStock(weights,unknown=false){let looks;do{looks=shuffle([0,1,2,3,4]);}while(unknown&&[3,4,5].some(n=>looks.slice(0,n).map((v,i)=>({v:[.82,1.1,.94,1.23,1][v],i})).sort((a,b)=>a.v-b.v).filter((v,i)=>v.i===i).length>Math.max(1,n-3)));const homes=shuffle(weights.map((_,i)=>i));weights.forEach((w,i)=>{const mesh=crate(w,unknown,looks[i]),home=new THREE.Vector3((homes[i]-(weights.length-1)/2)*1.9,0,this.seg.z1-4.4);this.root.add(mesh);this.stock.push({w,mesh,home,homeRank:homes[i],at:-1});});}
  near(p){let best=null,d=1.45;const offer=(kind,item,x,z)=>{const a=Math.hypot(p.x-x,p.z-z);if(a<d){d=a;best={kind,item};}};
    if(this.held===null)this.stock.forEach((b,i)=>{if(!b.mesh.visible)return;offer('stock',i,b.mesh.position.x,b.mesh.position.z);});
    if(this.held!==null)this.cells.forEach((s,i)=>{if(s.visible!==false&&!this.stock.some(b=>b.at===i))offer('cell',i,s.x,s.z);});return best;}
  interact(p){if(this.solved)return false;const n=this.near(p);if(this.held!==null){if(n?.kind==='cell'){this.stock[this.held].at=n.item;this.held=null;this.check();this.sync();return true;}this.stock[this.held].at=-1;this.held=null;this.sync();return true;}if(n?.kind==='stock'){this.held=n.item;this.stock[n.item].at=-2;this.sync();return true;}return false;}
  prompt(p){if(this.solved)return '문이 열렸다 — 안쪽으로';const n=this.near(p);if(this.held!==null)return n?.kind==='cell'?'E — 빈 칸에 놓기':'E — 상자를 원래 자리로 돌려놓기';return n?.kind==='stock'?'E — 상자 들기':this.instruction;}
  sync(){this.stock.forEach(b=>{if(b.at===-1){b.mesh.position.copy(b.home);b.mesh.rotation.y=0;}else if(b.at>=0){b.mesh.rotation.y=0;const s=this.cells[b.at];b.mesh.position.set(s.x,s.y??.25,s.z);}});}
  update(dt,actor){this.sync();if(this.held!==null&&actor){const mesh=this.stock[this.held].mesh,n=actor.body?.userData.navigator;mesh.position.copy(actor.position).addScaledVector(actor.heading,n?.53:.8);mesh.position.y=actor.position.y+(n?.89:.9);if(n)mesh.rotation.y=Math.atan2(actor.heading.x,actor.heading.z);}return {};}
  solvedBy(){return this.solved;}
  restart(){this.solved=false;this.held=null;this.stock.forEach(b=>b.at=-1);this.sync();}
  restoreSolved(v){this.solved=v;}
  state(){return {at:this.stock.map(b=>b.at),solved:this.solved};}
  valid(s){if(!s||!Array.isArray(s.at)||s.at.length!==this.stock.length||typeof s.solved!=='boolean')return false;const occupied=s.at.filter(a=>a>=0);return s.at.every(a=>Number.isInteger(a)&&a>=-2&&a<this.cells.length)&&new Set(occupied).size===occupied.length&&s.at.filter(a=>a===-2).length<=1;}
  restore(s){this.stock.forEach((b,i)=>b.at=s.at[i]);this.held=s.at.indexOf(-2);if(this.held<0)this.held=null;this.solved=s.solved;this.sync();}
}

export class BalanceOrder extends CarryTrial {
  constructor(scene,seg){super(scene,seg);this.count=5;this.instruction='상자 3·4·5개를 고른 뒤 가벼운 순서로 놓아라';this.addStock([1,2,3,4,5],true);
    this.pads=[];for(let i=0;i<5;i++){const p=pad(this.root,(i-2)*2,seg.z0+3);label(String(i+1),0,.5,.82,.6,p.group);this.pads.push(p);this.cells.push({...p,y:.24});}
    this.scale=templePart('scale')||new THREE.Group();this.scale.position.set(0,0,(seg.z0+seg.z1)/2);this.root.add(this.scale);
    this.scaleBeam=this.scale.getObjectByName('scale_beam');this.panGroups=[this.scale.getObjectByName('pan_left'),this.scale.getObjectByName('pan_right')];
    for(const x of [-1.9,1.9])this.cells.push({x,z:this.scale.position.z,y:.7});
    this.choices=[3,4,5].map((n,i)=>{const x=(i-1)*1.4,z=seg.z1-1.8;const p=pad(this.root,x,z,.5);label(`${n}개`,x,.9,z+.25,.9,this.root);return {n,x,z,mat:p.mat};});this.select(5);this.tilt=0;this.obstacles=[{x:0,z:this.scale.position.z,r:.7}];
    this.statusLabel=label('선택한 상자를 가벼운 순서대로',0,2.1,seg.z0+1.3,4.8,this.root);
  }
  select(n){if(this.solved||![3,4,5].includes(n))return false;this.restart();this.count=n;const order=this.stock.slice(0,n).map((b,i)=>({i,key:b.homeRank})).sort((a,b)=>a.key-b.key);order.forEach((v,j)=>this.stock[v.i].home.x=(j-(n-1)/2)*2);this.stock.forEach((b,i)=>{b.mesh.visible=i<n;});this.pads.forEach((p,i)=>{p.group.visible=i<n;p.mat.color.set(0x56c9c1);this.cells[i].visible=i<n;});this.choices.forEach(c=>c.mat.color.set(c.n===n?0xffdc85:0x36938c));this.sync();return true;}
  interact(p){const c=this.choices.find(c=>Math.hypot(p.x-c.x,p.z-c.z)<.7);return c?this.select(c.n):super.interact(p);}
  orderStatus(){const active=this.stock.slice(0,this.count),placed=active.filter(b=>b.at>=0&&b.at<this.count).length;
    return this.solved?`${this.count}개 순서 성공! 중앙 문으로 이동`:`${this.count}개 도전 · ${placed}/${this.count} 배치 · ${placed===this.count?'순서가 달라요 — 저울로 다시 비교':'왼쪽 1번부터 가벼운 순서'}`;}
  prompt(p){const c=this.choices.find(c=>Math.hypot(p.x-c.x,p.z-c.z)<.7);if(c&&!this.solved)return `E — ${c.n}개로 도전 (현재 배치 초기화)`;if(this.held===null&&!this.near(p))return this.orderStatus();return super.prompt(p);}
  check(){this.solved=this.stock.slice(0,this.count).every((b,i)=>b.at===i);this.pads.forEach(p=>p.mat.color.set(this.solved?0xffd27a:0x56c9c1));
    const text=this.orderStatus();if(this.statusLabel&&text!==this.lastStatus){
      const map=this.statusLabel.material.map,cv=map.image,c=cv.getContext('2d');c.fillStyle='#102e39';c.fillRect(0,0,cv.width,cv.height);c.strokeStyle=this.solved?'#ffd27a':'#baab73';c.lineWidth=5;c.strokeRect(4,4,cv.width-8,120);c.fillStyle=this.solved?'#ffd27a':'#fff5ce';c.font='bold 30px sans-serif';c.textAlign='center';c.textBaseline='middle';
      const lines=text.split(' · ');if(lines.length>1){c.fillText(lines.slice(0,2).join(' · '),cv.width/2,44,cv.width-24);c.fillText(lines.slice(2).join(' · '),cv.width/2,88,cv.width-24);}else c.fillText(text,cv.width/2,64,cv.width-24);map.needsUpdate=true;this.lastStatus=text;
    }
  }
  update(dt,actor){
    // Reconcile the current layout as well as the last interaction event.
    // Only selected crates participate; scale pans never count as answer pads.
    this.check();
    const l=this.stock.find(b=>b.at===5)?.w||0,r=this.stock.find(b=>b.at===6)?.w||0;const target=Math.sign(l-r)*.18;this.tilt+=(target-this.tilt)*Math.min(1,dt*5);if(this.scaleBeam)this.scaleBeam.rotation.z=this.tilt;this.panGroups.forEach(p=>{if(p)p.rotation.z=-this.tilt;});for(let i=0;i<2;i++)this.cells[i+5].y=.75+(i===0?-1:1)*Math.sin(this.tilt)*1.9;return super.update(dt,actor);}
  state(){return {...super.state(),count:this.count};}
  valid(s){return super.valid(s)&&[3,4,5].includes(s.count)&&s.at.every((a,i)=>i<s.count?(a<s.count||a>=5):a===-1)&&s.solved===s.at.slice(0,s.count).every((a,i)=>a===i);}
  restore(s){this.solved=false;this.select(s.count);super.restore(s);this.pads.forEach(p=>p.mat.color.set(this.solved?0xffd27a:0x56c9c1));}
}

export class TwinBalance extends CarryTrial {
  constructor(scene,seg){super(scene,seg);this.instruction='각 판의 두 칸을 채워 양쪽 무게를 같게 만들어라';this.addStock([1,2,3,4]);this.plates=[];
    for(const side of [-1,1]){const p=pad(this.root,side*3,seg.z0+5,1.6);this.plates.push(p);for(const dx of [-.6,.6]){this.cells.push({x:p.x+dx,z:p.z,y:.3});box(1.05,.07,1.2,teal,p.x+dx,.25,p.z,this.root);}
      p.bars=[];for(let i=0;i<10;i++){const m=glow(0x174047);box(.55,.13,.12,m,p.x+side*1.9,.4+i*.2,p.z-.8,this.root);p.bars.push(m);}label('두 칸',p.x,.6,p.z+1.5,1.2,this.root);
    }this.link=templePart('twin_scale');if(this.link){this.link.position.z=seg.z0+5;this.root.add(this.link);}this.sync();}
  sums(at=this.stock.map(b=>b.at)){return [0,1].map(side=>this.stock.reduce((v,b,i)=>v+(at[i]>=side*2&&at[i]<side*2+2?b.w:0),0));}
  check(){const [l,r]=this.sums();this.solved=this.stock.every(b=>b.at>=0)&&l===r;}
  update(dt,a){const sums=this.sums();this.plates.forEach((p,k)=>{p.bars.forEach((m,i)=>m.color.set(i<sums[k]?(this.solved?0xffd27a:0x77e6d6):0x174047));const offset=(sums[1-k]-sums[k])*.035;p.group.position.y=offset;for(let i=0;i<2;i++)this.cells[k*2+i].y=.3+offset;p.mat.color.set(this.solved?0xffd27a:0x56c9c1);});return super.update(dt,a);}
  valid(s){return super.valid(s)&&s.solved===(s.at.every(a=>a>=0)&&this.sums(s.at)[0]===this.sums(s.at)[1]);}
}

export class LeverSix extends CarryTrial {
  constructor(scene,seg){super(scene,seg);this.instruction='두 추를 지지대 양쪽에 놓고 지지대 위치를 바꿔 수평을 맞춰라';this.addStock([2,6]);this.pivot=2;this.originZ=seg.z1-9;this.tilt=0;
    this.beam=templePart('lever')||new THREE.Group();this.root.add(this.beam);this.fulcrum=templePart('fulcrum')||new THREE.Group();this.root.add(this.fulcrum);
    for(let i=0;i<6;i++){this.cells.push({x:(i-2.5)*1.4,z:this.originZ,y:1.4});label(String(i+1),(i-2.5)*1.4,1.15,this.originZ+.45,.65,this.root);}
    this.controls=[-1,1].map((d,i)=>{const x=(i===0?-1:1)*1.25,z=this.originZ+2;pad(this.root,x,z,.5);label(d<0?'◀ 지지대':'지지대 ▶',x,.85,z+.2,1.6,this.root);return {d,x,z};});this.prizePos=new THREE.Vector3(0,0,-59);this.godZ=-59;this.doorProgress=0;this.eventStarted=false;this.sync();}
  torques(at=this.stock.map(b=>b.at),pivot=this.pivot){let l=0,r=0;this.stock.forEach((b,i)=>{if(at[i]<0)return;const arm=(at[i]+.5)-pivot;if(arm<0)l+=b.w*-arm;else r+=b.w*arm;});return [l,r];}
  check(){const [l,r]=this.torques();this.solved=this.stock.every(b=>b.at>=0)&&l>0&&r>0&&Math.abs(l-r)<1e-6;}
  interact(p){if(this.solved)return false;const c=this.controls.find(c=>Math.hypot(p.x-c.x,p.z-c.z)<.85);if(c){this.pivot=Math.max(1,Math.min(5,this.pivot+c.d));this.check();return true;}return super.interact(p);}
  prompt(p){if(this.solved)return '마지막 문이 열린다 — 안쪽의 신에게 다가가라';const c=this.controls.find(c=>Math.hypot(p.x-c.x,p.z-c.z)<.85);return c?`E — 지지대를 ${c.d<0?'왼쪽':'오른쪽'}으로 (현재 ${this.pivot}·${this.pivot+1}번 칸 사이)`:super.prompt(p);}
  update(dt,a){const [l,r]=this.torques(),target=this.solved?0:Math.max(-.18,Math.min(.18,(l-r)*.025));this.tilt+=(target-this.tilt)*Math.min(1,dt*5);const px=(this.pivot-3)*1.4;this.beam.position.set(px,1.2,this.originZ);this.beam.rotation.z=this.tilt;this.beam.children.forEach(o=>{if(o.userData.initialX===undefined)o.userData.initialX=o.position.x;o.position.x=o.userData.initialX-px;});this.fulcrum.position.set(px,0,this.originZ);this.cells.forEach((s,i)=>{const arm=(i-2.5)*1.4-px;s.x=px+Math.cos(this.tilt)*arm;s.y=1.37+Math.sin(this.tilt)*arm;});return super.update(dt,a);}
  restart(){super.restart();this.pivot=2;this.doorProgress=0;this.eventStarted=false;}
  state(){return {...super.state(),pivot:this.pivot};}
  valid(s){if(!super.valid(s)||!Number.isInteger(s.pivot)||s.pivot<1||s.pivot>5)return false;const [l,r]=this.torques(s.at,s.pivot);return s.solved===(s.at.every(a=>a>=0)&&l>0&&r>0&&l===r);}
  restore(s){this.pivot=s.pivot;super.restore(s);}
}
