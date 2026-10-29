const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const A='art/arrival-coherence/v01/ground-support';
(async()=>{
 const context=vm.createContext({console,performance}),modules=new Map();
 async function load(file){if(modules.has(file))return modules.get(file);const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});modules.set(file,m);await m.link(()=>{throw Error('Unexpected import '+file)});await m.evaluate();return m;}
 const T=(await load('vendor/three/build/three.module.js')).namespace,{PlanetSurfaceIndex}=(await load(A+'/preview-src__sphere__PlanetSurfaceIndex.js')).namespace;
 const report={previewOnly:true,checks:[],cases:[]};const check=(name,pass,data)=>{report.checks.push({name,pass,data});assert.ok(pass,name);};
 let seed=301;const random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 const dirs=[];for(let i=0;i<1100;i++){const y=2*random()-1,a=2*Math.PI*random(),r=Math.sqrt(1-y*y);dirs.push(new T.Vector3(r*Math.cos(a),y,r*Math.sin(a)));}
 for(const lat of[-90,-89.999,-.000001,0,.000001,89.999,90])for(const lon of[-180,-179.999,0,179.999,180]){const a=lat*Math.PI/180,b=lon*Math.PI/180;dirs.push(new T.Vector3(Math.cos(a)*Math.cos(b),Math.sin(a),Math.cos(a)*Math.sin(b)));}
 for(const indexed of[false,true]){
  const g=indexed?new T.SphereGeometry(68,48,28):new T.IcosahedronGeometry(68,11),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const d=new T.Vector3().fromBufferAttribute(p,i).normalize(),h=4*Math.sin(d.x*7)*Math.cos(d.y*5)+2*d.z;p.setXYZ(i,d.x*(68+h),d.y*(68+h),d.z*(68+h));}
  const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.rotation.set(.12,-.08,.02);mesh.scale.set(1.02,.98,1.01);mesh.position.set(.12,-.05,.07);mesh.updateMatrixWorld(true);
  const before=Buffer.from(p.array.buffer).toString('base64'),index=new PlanetSurfaceIndex(mesh),ray=new T.Raycaster(),hits=[],errors=[],candidates=[];
  const cases=dirs.slice();
  for(const d of cases){ray.set(d.clone().multiplyScalar(100),d.clone().negate());ray.far=100;const h=ray.intersectObject(mesh,false)[0],r=index.radiusAt(d);hits.push(!!h&&Number.isFinite(r));errors.push(h?Math.abs(h.point.length()-r):Infinity);candidates.push(index.lastCandidates);}
  const started=performance.now();for(let i=0;i<60000;i++)index.radiusAt(cases[i%cases.length]);const queryMs=performance.now()-started;
  check((indexed?'indexed':'nonindexed')+' actual triangles equal independent Raycaster',hits.every(Boolean)&&Math.max(...errors)<1e-7,{samples:cases.length,maxError:Math.max(...errors)});
  // Three Raycaster can miss an exact shared vertex and hit the far side.
  // At exact vertices/edges use their unchanged world coordinate as oracle.
  const boundaryErrors=[];for(let i=0;i<Math.min(p.count-1,150);i++){const a=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld),b=new T.Vector3().fromBufferAttribute(p,i+1).applyMatrix4(mesh.matrixWorld);boundaryErrors.push(Math.abs(index.radiusAt(a)-a.length()));if(!indexed&&i%3<2){const mid=a.add(b).multiplyScalar(.5);boundaryErrors.push(Math.abs(index.radiusAt(mid)-mid.length()));}}
  check('exact world vertices and shared edges retain contact',Math.max(...boundaryErrors)<1e-6,{samples:boundaryErrors.length,maxError:Math.max(...boundaryErrors)});
  check('index never changes original terrain positions',before===Buffer.from(p.array.buffer).toString('base64'));
  report.cases.push({indexed,...index.stats,meanCandidates:candidates.reduce((a,b)=>a+b,0)/candidates.length,maxCandidates:Math.max(...candidates),queries:60000,queryMs,microsecondsPerQuery:queryMs/60});
  p.needsUpdate=true;check('position version invalidates index',!index.isCurrent());let threw=false;try{index.radiusAt(dirs[0])}catch{threw=true;}check('stale query fails explicitly',threw);index.dispose();
  const rebuilt=new PlanetSurfaceIndex(mesh);mesh.geometry=mesh.geometry.clone();check('geometry replacement invalidates index',!rebuilt.isCurrent());rebuilt.dispose();
 }
 const hole=new T.IcosahedronGeometry(68,3),a=new T.Vector3().fromBufferAttribute(hole.attributes.position,0),b=new T.Vector3().fromBufferAttribute(hole.attributes.position,1),c=new T.Vector3().fromBufferAttribute(hole.attributes.position,2),holeDirection=a.add(b).add(c).normalize();
 const arr=hole.attributes.position.array.slice(9);hole.setAttribute('position',new T.BufferAttribute(arr,3));const mesh=new T.Mesh(hole,new T.MeshBasicMaterial({side:T.DoubleSide})),index=new PlanetSurfaceIndex(mesh);
 check('missing contact is NaN, never analytic fallback',Number.isNaN(index.radiusAt(holeDirection))&&index.misses===1);
 const fullMesh=new T.Mesh(new T.IcosahedronGeometry(68,5),new T.MeshBasicMaterial({side:T.DoubleSide})),broken=new PlanetSurfaceIndex(fullMesh);broken.ids.fill(0);let mismatches=0;
 for(const d of dirs.slice(0,20))if(!Number.isFinite(broken.radiusAt(d)))mismatches++;check('corrupted index is detected by contact oracle',mismatches>0,{mismatches});
 report.pass=true;fs.writeFileSync(A+'/unit-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
