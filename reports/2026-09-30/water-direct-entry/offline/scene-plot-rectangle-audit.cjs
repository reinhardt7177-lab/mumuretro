const fs=require('fs');
const text=fs.readFileSync('D:/mumumetro/unity/MumuPlanet/Assets/Mumu/Scenes/PlanetExploration.unity','utf8');
const docs=new Map();
for(const part of text.split(/\r?\n--- !u!/).slice(1)){const m=/^(\d+) &(-?\d+)/.exec(part);if(m)docs.set(m[2],{cls:+m[1],body:part});}
const field=(b,k)=>{const m=new RegExp('\\n  '+k+': ([^\\r\\n]*)').exec(b);return m?m[1]:null;};
const vec=(s)=>{const m=/x: ([-\d.eE]+), y: ([-\d.eE]+), z: ([-\d.eE]+)(?:, w: ([-\d.eE]+))?/.exec(s);return m?m.slice(1).filter(v=>v!==undefined).map(Number):null;};
const gos=[...docs.entries()].filter(([,d])=>d.cls===1).map(([id,d])=>({id,name:field(d.body,'m_Name'),active:field(d.body,'m_IsActive'),tr:(/component: \{fileID: (-?\d+)\}/.exec(d.body)||[])[1]}));
const byName=n=>gos.filter(g=>g.name===n);
function transform(id){const d=docs.get(id);if(!d)return null;const b=d.body;return{pos:vec(field(b,'m_LocalPosition')),rot:vec(field(b,'m_LocalRotation')),father:(/m_Father: \{fileID: (-?\d+)\}/.exec(b)||[])[1],children:[...b.matchAll(/- \{fileID: (-?\d+)\}/g)].map(m=>m[1]).filter(c=>docs.get(c)&&docs.get(c).cls===4),go:(/m_GameObject: \{fileID: (-?\d+)\}/.exec(b)||[])[1]};}
const goOf=new Map(gos.map(g=>[g.id,g]));
function qrot(q,v){const[x,y,z,w]=q;const ix=w*v[0]+y*v[2]-z*v[1],iy=w*v[1]+z*v[0]-x*v[2],iz=w*v[2]+x*v[1]-y*v[0],iw=-x*v[0]-y*v[1]-z*v[2];return[ix*w+iw*-x+iy*-z-iz*-y,iy*w+iw*-y+iz*-x-ix*-z,iz*w+iw*-z+ix*-y-iy*-x];}
function qmul(a,b){const[ax,ay,az,aw]=a,[bx,by,bz,bw]=b;return[aw*bx+ax*bw+ay*bz-az*by,aw*by-ax*bz+ay*bw+az*bx,aw*bz+ax*by-ay*bx+az*bw,aw*bw-ax*bx-ay*by-az*bz];}
function inv(q){return[-q[0],-q[1],-q[2],q[3]];}
const chapterGo=byName('Water mountain chapter')[0];const ch=transform(chapterGo.tr);
const templeGo=byName('Frozen water sanctuary')[0];const tt=transform(templeGo.tr);
const templePos=ch.pos.map((v,i)=>v+qrot(ch.rot,tt.pos)[i]);const templeRot=qmul(ch.rot,tt.rot);
console.log('chapter root',ch.pos.map(v=>v.toFixed(3)).join(','),'temple world',templePos.map(v=>v.toFixed(3)).join(','));
const iceLocal=[0,3.17,-.1];const ice=templePos.map((v,i)=>v+qrot(templeRot,iceLocal)[i]);console.log('former ice point',ice.map(v=>v.toFixed(3)).join(','),'(log: 54.10, 49.62, 17.57)');
const toLocal=(p,pos,rot)=>qrot(inv(rot),p.map((v,i)=>v-pos[i]));
const inChapter=l=>(l[0]>-10&&l[0]<11&&l[2]>-11&&l[2]<15)||(l[0]>=10&&l[0]<26&&l[2]>0&&l[2]<14);
const inPlot=l=>Math.abs(l[0])<8&&l[2]>-8&&l[2]<9;
for(const groupName of ['"Blender nature \\xB7 original placement"','Nature collisions']){
  const g=byName(groupName)[0];const gt=transform(g.tr);let total=0,inactive=0,inactiveInChapter=0,inactiveElsewhere=0,plot=0,plotActiveNow=0,restoreExpected=0;
  for(const c of gt.children){const t=transform(c);const go=goOf.get(t.go);const p=gt.pos.map((v,i)=>v+qrot(gt.rot,t.pos)[i]);total++;
    const act=go.active==='1';const lc=toLocal(p,ch.pos,ch.rot),lp=toLocal(p,templePos,templeRot);
    if(!act){inactive++;if(inChapter(lc))inactiveInChapter++;else inactiveElsewhere++;}
    if(inPlot(lp)){plot++;if(act)plotActiveNow++;}
    if(!act&&inChapter(lc)&&!inPlot(lp))restoreExpected++;}
  console.log(groupName.padEnd(38),'children',total,'inactive',inactive,'(in retired chapter rects',inactiveInChapter,', elsewhere',inactiveElsewhere+')','in new plot',plot,'(active now',plotActiveNow+')','expected to reappear',restoreExpected);
}

// Player spawn -> doorway distance and nature objects near the plot with a footing-burial estimate.
const player=byName('Sky navigator')[0];const pt=transform(player.tr);
const doorway=templePos.map((v,i)=>v+qrot(templeRot,[0,1.12,-.45])[i]);
const ang=Math.acos(Math.min(1,pt.pos.reduce((s,v,i)=>s+v*doorway[i],0)/Math.hypot(...pt.pos)/Math.hypot(...doorway)));
console.log('spawn',pt.pos.map(v=>v.toFixed(2)).join(','),'doorway',doorway.map(v=>v.toFixed(2)).join(','),'surface distance',(ang*Math.hypot(...pt.pos)).toFixed(1),'m');
const ss=t=>t*t*(3-2*t),il=(a,b,v)=>Math.min(1,Math.max(0,(v-a)/(b-a)));
function footY(x,z,g){const blend=Math.max(il(6,9,Math.abs(x)),z<-3?il(-3,-7,z):il(7,10,z));return Math.max(g+.018,(-.015)+(g+.018+.015)*ss(blend));}
const inFoot=(x,z)=>Math.abs(x)<=9&&z>=-7&&z<=10;
let rows=[];
for(const groupName of ['"Blender nature \\xB7 original placement"','Nature collisions']){
  const g=byName(groupName)[0];const gt=transform(g.tr);
  for(const c of gt.children){const t=transform(c);const go=goOf.get(t.go);const p=gt.pos.map((v,i)=>v+qrot(gt.rot,t.pos)[i]);
    const l=toLocal(p,templePos,templeRot);if(Math.abs(l[0])>11||l[2]<-10||l[2]>12)continue;
    const buried=inFoot(l[0],l[2])?footY(l[0],l[2],l[1])-l[1]:0;
    const building=Math.abs(l[0])<6.7&&l[2]>-2.8&&l[2]<7.7;
    rows.push({grp:groupName.startsWith('N')?'col':'art',name:go.name,x:l[0],y:l[1],z:l[2],buried,building,rect:inPlot(l)});}
}
const need=r=>r.building||r.buried>.15;
const a=rows.filter(r=>r.rect&&!need(r)),b=rows.filter(r=>!r.rect&&need(r));
console.log('near-plot objects',rows.length,'| rect hides but not buried/footprint:',a.length,'| buried/footprint but rect keeps visible:',b.length);
for(const r of a)console.log('  HIDDEN-UNNEEDED',r.grp,r.name.padEnd(14),'x',r.x.toFixed(2),'y',r.y.toFixed(2),'z',r.z.toFixed(2),'buried',r.buried.toFixed(2));
for(const r of b)console.log('  VISIBLE-BURIED ',r.grp,r.name.padEnd(14),'x',r.x.toFixed(2),'y',r.y.toFixed(2),'z',r.z.toFixed(2),'buried',r.buried.toFixed(2));
