import * as THREE from 'three';

// A static walking network, planned against the actual height field and existing
// obstacle centres. It paints soil on that field; it is not a second floor or
// an automatic movement system. The optional direct gold cue remains unchanged.
export function planWorldTrails(planet,landing,spots,scatter,forage,legends,firstTrail,spec){
  const started=performance.now(),R=planet.R,margin=spec.actorRadius+spec.bodyMargin;
  const obstacles=[...scatter.colliders.map(c=>({dir:c.dir,r:c.r})),...spots.map(s=>({dir:s.dir,r:3.5})),...forage.map(s=>({dir:s.dir,r:3.0})),...legends.map(s=>({dir:s.dir,r:2.2})),{dir:firstTrail.overlook,r:4.5},{dir:firstTrail.waterway,r:5}];
  const east=new THREE.Vector3(0,1,0).cross(landing).normalize();obstacles.push({dir:landing.clone().addScaledVector(east,6.5/R).normalize(),r:2.8});
  const buckets=new Map(),cell=.10;
  const key=(x,y,z)=>x+','+y+','+z;
  for(const o of obstacles){o.cos=Math.cos((o.r+margin)/R);const id=key(Math.floor(o.dir.x/cell),Math.floor(o.dir.y/cell),Math.floor(o.dir.z/cell));if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(o);}
  function clear(d){const x=Math.floor(d.x/cell),y=Math.floor(d.y/cell),z=Math.floor(d.z/cell);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++){const items=buckets.get(key(x+a,y+b,z+c));if(items)for(const o of items)if(d.dot(o.dir)>o.cos)return false;}return true;}
  const latN=Math.ceil(Math.PI*R/spec.nodeSpacingMetres),lonN=latN*2,count=(latN-1)*lonN;
  const dirs=new Array(count),heights=new Float32Array(count),allowed=new Uint8Array(count),costs=new Float64Array(count),previous=new Int32Array(count);costs.fill(Infinity);previous.fill(-1);
  const index=(i,j)=>(i-1)*lonN+((j%lonN+lonN)%lonN);
  for(let i=1;i<latN;i++){const la=-Math.PI/2+i*Math.PI/latN;for(let j=0;j<lonN;j++){const lo=j*Math.PI*2/lonN-Math.PI,id=index(i,j),d=new THREE.Vector3(Math.cos(la)*Math.cos(lo),Math.sin(la),Math.cos(la)*Math.sin(lo));dirs[id]=d;heights[id]=planet.heightAt(d);allowed[id]=clear(d)?1:0;}}
  function nearest(d){let best=-1,score=-2;for(let i=0;i<count;i++){if(!allowed[i])continue;const dot=d.dot(dirs[i]);if(dot>score){score=dot;best=i;}}return best;}
  const goals=spots.map((s,i)=>{const fr=planet.frameAt(planet.surfaceAt(s.dir)),facing=new THREE.Vector3(0,0,1).applyQuaternion(fr.quaternion),dir=s.dir.clone().addScaledVector(facing,4.8/R).normalize();return{id:i,dir,node:nearest(dir)};});
  const root=nearest(landing),pending=new Set(goals.map(g=>g.node)),heap=[];
  function push(id,score){let i=heap.length;heap.push({id,score});while(i){const parent=(i-1)>>1;if(heap[parent].score<=score)break;heap[i]=heap[parent];i=parent;}heap[i]={id,score};}
  function pop(){const result=heap[0],end=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].score<heap[child].score)child++;if(end.score<=heap[child].score)break;heap[i]=heap[child];i=child;}heap[i]=end;}return result;}
  const mid=new THREE.Vector3();let visited=0;costs[root]=0;push(root,0);
  while(heap.length&&pending.size){const item=pop(),id=item.id;if(item.score>costs[id])continue;visited++;pending.delete(id);const i=Math.floor(id/lonN)+1,j=id%lonN;
    for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){
      if(!di&&!dj||i+di<1||i+di>=latN)continue;const next=index(i+di,j+dj);if(!allowed[next])continue;
      const length=Math.acos(THREE.MathUtils.clamp(dirs[id].dot(dirs[next]),-1,1))*R;if(length<.01)continue;
      const slope=Math.atan2(Math.abs(heights[id]-heights[next]),length)*180/Math.PI;
      if(slope>spec.maximumPreferredSlopeDegrees)continue;
      mid.copy(dirs[id]).lerp(dirs[next],.5).normalize();if(!clear(mid))continue;
      const candidate=costs[id]+length*(1+slope*slope*.0025);
      if(candidate<costs[next]){costs[next]=candidate;previous[next]=id;push(next,candidate);}
    }
  }
  function lineClear(a,b){const angle=a.angleTo(b),n=Math.max(1,Math.ceil(angle*R/.42));let previousHeight=planet.heightAt(a);for(let i=0;i<=n;i++){mid.copy(a).lerp(b,i/n).normalize();if(!clear(mid))return false;const height=planet.heightAt(mid);if(i&&Math.atan2(Math.abs(height-previousHeight),angle*R/n)*180/Math.PI>spec.maximumPreferredSlopeDegrees)return false;previousHeight=height;}return true;}
  const routes=goals.map(g=>{
    if(!Number.isFinite(costs[g.node]))return{id:g.id,dirs:[],reachable:false};
    const list=[];for(let i=g.node;i>=0;i=previous[i]){list.push(dirs[i]);if(i===root)break;}list.reverse();list.unshift(landing.clone());if(lineClear(list.at(-1),g.dir))list.push(g.dir);
    // String pulling removes lattice zigzags while rechecking obstacle and grade.
    const result=[list[0]];for(let i=0;i<list.length-1;){let next=Math.min(list.length-1,i+20);while(next>i+1&&!lineClear(list[i],list[next]))next--;result.push(list[next]);i=next;}
    return{id:g.id,dirs:result,reachable:true,length:result.slice(1).reduce((sum,d,i)=>sum+d.angleTo(result[i])*R,0),target:g.dir};
  });
  const paint=new Map(),paintCell=.045;
  for(const r of routes)for(let i=1;i<r.dirs.length;i++){const a=r.dirs[i-1],b=r.dirs[i],n=Math.max(1,Math.ceil(a.angleTo(b)*R/.7));for(let j=0;j<=n;j++){const d=a.clone().lerp(b,j/n).normalize(),id=key(Math.floor(d.x/paintCell),Math.floor(d.y/paintCell),Math.floor(d.z/paintCell));if(!paint.has(id))paint.set(id,[]);paint.get(id).push(d);}}
  // Expand the static lookup once. Per-frame grass queries then need one cell
  // lookup, rather than building 27 string keys for every candidate tuft.
  const neighbours=new Map();for(const[id,items]of paint){const[x,y,z]=id.split(',').map(Number);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++){const k=key(x+a,y+b,z+c);if(!neighbours.has(k))neighbours.set(k,[]);neighbours.get(k).push(...items);}}
  const limit=spec.pathHalfWidth+spec.feather,cos=Math.cos(limit/R);
  function pathAt(d){const items=neighbours.get(key(Math.floor(d.x/paintCell),Math.floor(d.y/paintCell),Math.floor(d.z/paintCell)));if(!items)return 0;let best=cos;for(const p of items)best=Math.max(best,d.dot(p));return best===cos?0:1-THREE.MathUtils.smoothstep(Math.acos(Math.min(1,best))*R,spec.pathHalfWidth,limit);}
  return{routes,pathAt,clear,lineClear,stats:{nodes:count,visited,reachable:routes.filter(r=>r.reachable).length,totalLength:routes.reduce((s,r)=>s+(r.length||0),0),milliseconds:performance.now()-started}};
}
