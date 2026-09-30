const fs=require('fs');
const d=JSON.parse(fs.readFileSync('D:/mumumetro/unity/MumuPlanet/Assets/Mumu/Models/WaterMountain/glacier-temple-v03.json','utf8'));
// Colliders from BuildWaterSanctuaryExterior (sanctuary-local x/z rectangles), plus unchanged stone walls.
const boxes=[
  [-3.6,-2.3,0,4.8],[2.3,3.6,0,4.8],[-2.85,2.85,4.5,4.8]];
const R=0.285; // capsule radius 0.25 + cast skin 0.035: closest a player centre gets to a face
function dist(x,z,b){const dx=Math.max(b[0]-x,0,x-b[1]),dz=Math.max(b[2]-z,0,z-b[3]);return Math.hypot(dx,dz);}
function nearest(x,z){return Math.min(...boxes.map(b=>dist(x,z,b)));}
// Sample ice triangles (body height 0.05..1.8m) densely; each sample is a point of the visible ice skin.
let total=0,inside=0,withinR=0,outside=[];const seen=new Set();
for(const m of d.meshes){if(!/ice|frost/i.test(m.material))continue;const v=m.vertices,t=m.triangles;
 for(let i=0;i<t.length;i+=3){const p=[t[i],t[i+1],t[i+2]].map(j=>[v[j*3],v[j*3+1],v[j*3+2]]);
  for(let a=0;a<=6;a++)for(let b=0;b<=6-a;b++){const c=6-a-b;const x=(p[0][0]*a+p[1][0]*b+p[2][0]*c)/6,y=(p[0][1]*a+p[1][1]*b+p[2][1]*c)/6,z=(p[0][2]*a+p[1][2]*b+p[2][2]*c)/6;
   if(y<0.05||y>1.8)continue;const key=(x*20|0)+','+(z*20|0);if(seen.has(key))continue;seen.add(key);total++;
   const n=nearest(x,z);if(n===0)inside++;else if(n<=R)withinR++;else outside.push([x,z,n]);}}}
outside.sort((a,b)=>b[2]-a[2]);
console.log('ice skin samples at body height (5cm grid):',total);
console.log('inside a collider:',inside,' within capsule reach of a face (<=0.285m):',withinR,' further out:',outside.length);
console.log('share the player body cannot overlap: '+(100*(inside+withinR)/total).toFixed(1)+'%');
console.log('largest gaps (sanctuary-local x,z -> distance to nearest collider):');
for(const o of outside.slice(0,8))console.log('  ',o[0].toFixed(2),o[1].toFixed(2),'->',o[2].toFixed(2)+'m');
const bins={};for(const o of outside){const k=o[2]<.5?'0.29-0.5':o[2]<.75?'0.5-0.75':'>=0.75';bins[k]=(bins[k]||0)+1;}console.log('gap histogram',JSON.stringify(bins));
// Invisible wall check: box area farther than 0.5m from any ice/stone skin sample (coarse 0.25m grid).
const skin=[...seen].map(k=>k.split(',').map(Number).map(n=>n/20));
let far=0,cells=0;for(const b of []){for(let x=b[0]+.125;x<b[1];x+=.25)for(let z=b[2]+.125;z<b[3];z+=.25){cells++;// is this cell near the boundary of the box (outer 0.3m band) and far from any skin?
  const edge=Math.min(x-b[0],b[1]-x,z-b[2],b[3]-z);if(edge>.3)continue;let m=1e9;for(const s of skin){const dd=Math.hypot(s[0]-x,s[1]-z);if(dd<m)m=dd;if(m<.5)break;}if(m>=.5)far++;}}
console.log('glacier box boundary cells farther than 0.5m from any ice skin:',far,'of',cells,'box cells');

