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

// Final rule: footprint |x|<6.9, -3<z<7.9, or buried under the footing (offline base = terrain; runtime adds ~0.15m carpet, limit 0.3 -> offline 0.15).
const ss2=t=>t*t*(3-2*t),il2=(a,b,v)=>Math.min(1,Math.max(0,(v-a)/(b-a)));
function footY2(x,z,g){const blend=Math.max(il2(6,9,Math.abs(x)),z<-3?il2(-3,-7,z):il2(7,10,z));return Math.max(g+.018,(-.015)+(g+.018+.015)*ss2(blend));}
const hideRule=l=>(Math.abs(l[0])<6.9&&l[2]>-3&&l[2]<7.9)||(Math.abs(l[0])<=9&&l[2]>=-7&&l[2]<=10&&footY2(l[0],l[2],l[1])-l[1]>.15);
for(const groupName of ['"Blender nature \\xB7 original placement"','Nature collisions']){
  const g=byName(groupName)[0];const gt=transform(g.tr);let hide=0,restore=0,newlyHidden=0,stillHidden=0,marginal=0;
  for(const c of gt.children){const t=transform(c);const go=goOf.get(t.go);const p=gt.pos.map((v,i)=>v+qrot(gt.rot,t.pos)[i]);
    const act=go.active==='1';const lc=toLocal(p,ch.pos,ch.rot),lp=toLocal(p,templePos,templeRot);const h=hideRule(lp);
    if(h)hide++;if(!act&&!h)restore++;if(act&&h)newlyHidden++;if(!act&&h)stillHidden++;
    const inFootGrid=Math.abs(lp[0])<=9&&lp[2]>=-7&&lp[2]<=10;const b=inFootGrid?footY2(lp[0],lp[2],lp[1])-lp[1]:0;if(!h&&b>.05)marginal++;}
  console.log('FINAL',groupName.slice(0,22).padEnd(23),'hidden by sanctuary',hide,'| restored (was hidden)',restore,'| newly hidden (visible on 09-27)',newlyHidden,'| kept hidden',stillHidden,'| visible but base 5-15cm under footing',marginal);
}
for(const groupName of ['"Blender nature \\xB7 original placement"','Nature collisions']){
  const g=byName(groupName)[0];const gt=transform(g.tr);const depths=[];let foot=0;
  for(const c of gt.children){const t=transform(c);const go=goOf.get(t.go);const p=gt.pos.map((v,i)=>v+qrot(gt.rot,t.pos)[i]);
    const lp=toLocal(p,templePos,templeRot);if(go.active!=='1'||!hideRule(lp))continue;
    if(Math.abs(lp[0])<6.9&&lp[2]>-3&&lp[2]<7.9){foot++;continue;}
    depths.push(footY2(lp[0],lp[2],lp[1])-lp[1]);}
  depths.sort((a,b)=>a-b);console.log('NEWLY',groupName.slice(0,20).padEnd(21),'in footprint',foot,'buried',depths.length,'depth range',depths.length?depths[0].toFixed(2)+'..'+depths[depths.length-1].toFixed(2):'-');
}
