// Stage a concrete reviewable source variant; this does not change src or assets.
const fs=require('node:fs'),A='art/balance-portals/v01',B='reports/2026-10-25/evidence/balance-portals';
const baseline=JSON.parse(fs.readFileSync(B+'/baseline.json'));
for(const extra of ['src/render/InteriorDirection.js','src/shrine/BalanceArt.js'])if(!baseline.files.includes(extra)){if(require('node:crypto').createHash('sha256').update(fs.readFileSync(extra)).digest('hex')!==baseline.inventory[extra])throw Error('Extra source changed before baseline: '+extra);fs.copyFileSync(extra,B+'/baseline-'+extra.replaceAll('/','__'));baseline.files.push(extra);fs.writeFileSync(B+'/baseline.json',JSON.stringify(baseline,null,2));}
const sources=Object.fromEntries(baseline.files.map(f=>[f,fs.readFileSync(B+'/baseline-'+f.replaceAll('/','__'),'utf8').replace(/\r\n/g,'\n')]));
const patches=[];function patch(file,from,to){if(!sources[file].includes(from))throw Error('Missing marker '+file+': '+from);sources[file]=sources[file].replace(from,to);patches.push({file,from,to});}
patch('src/data/balanceTemple.js','balance-temple-v06.glb','balance-temple-v07.glb');
patch('src/data/balanceTemple.js',"model: 'assets/models/balance-temple-v07.glb',","model: 'assets/models/balance-temple-v07.glb',\n  portalParts:{portal14:{width:14.74,height:8.95},portal18:{width:18.74,height:10.60}},");
patch('src/shrine/BalanceTemple.js',"let source=null;","import {installStaticRaycastTree} from '../render/StaticRaycastTree.js';\nlet source=null;");
patch('src/shrine/BalanceTemple.js','const rects=[],doors={},architectureParts=[];','const rects=[],doors={},architectureParts=[],portals=[],bodyObstacles=[];');
patch('src/shrine/BalanceTemple.js','  for(const s of rooms){',`  function addPortal(name,z){
    const part=templePart(name),spec=D.portalParts?.[name];if(!part||!spec)return null;
    part.position.z=z;scene.add(part);const cameraMeshes=[];
    part.traverse(o=>{if(o.isMesh){installStaticRaycastTree(o);cameraMeshes.push(o);}});rects.cameraOccluders.push(...cameraMeshes);
    const colliders=[],half=spec.width/2;
    const body=(x0,x1,z0,z1,minY,maxY)=>colliders.push({shape:'box',x0,x1,z0:z+z0,z1:z+z1,minY,maxY,padding:.28,escapeZ:1,balancePortal:name});
    for(const side of [-1,1]){body(side<0?-half:2.5,side<0?-2.5:half,-1.13,1.13,0,5.1);for(const front of [-1,1])body(side<0?-3.22:2.5,side<0?-2.5:3.22,front<0?-1.38:1.0,front<0?-1.0:1.38,0,5.1);}
    body(-half,half,-1.34,1.34,5.1,spec.height);bodyObstacles.push(...colliders);
    const portal={part,name,z,spec,colliders,cameraMeshes};portals.push(portal);return portal;
  }
  function leafFor(portal){const leaf=templePart('door_leaf')||new THREE.Mesh(new THREE.BoxGeometry(2.45,5,.35),m);if(portal)leaf.scale.x*=2.5/2.45;leaf.traverse(o=>{if(o.isMesh){installStaticRaycastTree(o);o.userData.balanceDoorLeaf=true;rects.cameraOccluders.push(o);}});return leaf;}
  for(const s of rooms){`);
patch('src/shrine/BalanceTemple.js',"if(s.door){const root=new THREE.Group();root.position.z=s.from-.15;scene.add(root);for(const side of [-1,1]){const leaf=templePart('door_leaf')||new THREE.Mesh(new THREE.BoxGeometry(2.45,5,.35),m);leaf.position.x=side*1.25;root.add(leaf);}doors[s.door]={mesh:root,rect:r,opened:false,amount:0};}","if(s.door){const root=new THREE.Group();root.position.z=s.from-.15;scene.add(root);const portal=addPortal('portal14',root.position.z);for(const side of [-1,1]){const leaf=leafFor(portal);leaf.position.x=side*1.25;root.add(leaf);}doors[s.door]={mesh:root,rect:r,portal,opened:false,amount:0};}");
patch('src/shrine/BalanceTemple.js',"const root=new THREE.Group();root.position.z=D.gateZ;scene.add(root);for(const side of [-1,1]){const leaf=templePart('door_leaf')||new THREE.Mesh(new THREE.BoxGeometry(2.45,5,.35),m);leaf.position.x=side*1.25;root.add(leaf);}","const root=new THREE.Group();root.position.z=D.gateZ;scene.add(root);const finalPortal=addPortal('portal18',D.gateZ);for(const side of [-1,1]){const leaf=leafFor(finalPortal);leaf.position.x=side*1.25;root.add(leaf);}");
patch('src/shrine/BalanceTemple.js',"doors.shrine={mesh:root,rect:passage,opened:false,amount:0};","doors.shrine={mesh:root,rect:passage,portal:finalPortal,opened:false,amount:0};");
patch('src/shrine/BalanceTemple.js','  for(const side of [-1,1]){const wall=', '  if(!finalPortal)for(const side of [-1,1]){const wall=');
patch('src/shrine/BalanceTemple.js','modelLoaded:!!source,architectureParts,','modelLoaded:!!source,architectureParts,portals,bodyObstacles,');
patch('src/shrine/Room.js','obstacles: [...entranceObstacles,','obstacles: [...entranceObstacles, ...(dungeon.bodyObstacles||[]),');
patch('src/shrine/Room.js',"  if(spec.id==='balance'){\n    api.obstacles.push",`  if(spec.id==='balance'){
    const resume=api.resume.bind(api);api.resume=actor=>{const result=resume(actor),old=actor.position.clone();actor._pushOut(actor.position);if(actor.position.distanceTo(old)>1e-6){actor.syncMesh();actor._camPlaced=false;}return result;};
    api.obstacles.push`);
patch('src/render/InteriorDirection.js',`  return Object.entries(room.dungeon.doors).map(([id,d])=>({id,
    point:new THREE.Vector3((d.rect.x0+d.rect.x1)/2,room.dungeon.rects.floorAt?.(0,d.rect.z1+doorFrontOffset)??0,d.rect.z1+doorFrontOffset),
    yaw:0,halfWidth:(d.rect.x1-d.rect.x0)/2,read:()=>!!d.opened}));`, `  return Object.entries(room.dungeon.doors).map(([id,d])=>{
    // Deep balance pockets own their grounded jamb. Keep the solved signal,
    // rendered marker and capsule body together in front of that stone.
    const frontZ=d.portal?d.mesh.position.z+1.55:d.rect.z1+doorFrontOffset;
    return{id,point:new THREE.Vector3((d.rect.x0+d.rect.x1)/2,room.dungeon.rects.floorAt?.(0,frontZ)??0,frontZ),
      yaw:0,halfWidth:(d.rect.x1-d.rect.x0)/2,read:()=>!!d.opened};});`);
patch('src/shrine/BalanceRecords.js','models:[],colliders:[],cameraMeshes:[]','models:[],batches:[],colliders:[],cameraMeshes:[]');
patch('src/shrine/BalanceRecords.js','    for(const p of placements){','    const materials=new Map();\n    for(const p of placements){');
patch('src/shrine/BalanceRecords.js',"o.material=o.material.clone();o.material.envMapIntensity=.7;o.material.userData.outlineParameters={visible:false};o.castShadow=o.receiveShadow=true;installStaticRaycastTree(o);r.cameraMeshes.push(o);", "if(!materials.has(o.material)){const mat=o.material.clone();mat.envMapIntensity=.7;mat.userData.outlineParameters={visible:false};materials.set(o.material,mat);}o.material=materials.get(o.material);o.castShadow=o.receiveShadow=true;");
patch('src/shrine/BalanceRecords.js','    room.obstacles.push(...r.colliders);',`    // Six stationary stands use the exact original world surfaces in shared batches.
    // Text faces stay in their board groups so current goals/hints remain mutable.
    const buckets=new Map();r.batchGroup=new T.Group();r.batchGroup.name='Balance repeated records';
    for(const root of r.models){root.updateWorldMatrix(true,true);root.traverse(m=>{if(m.isMesh){const key=m.geometry.uuid+':'+m.material.uuid;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(m);}});}
    for(const originals of buckets.values()){
      const first=originals[0],mesh=new T.InstancedMesh(first.geometry,first.material,originals.length);mesh.name='Balance record batch '+first.material.name;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;
      originals.forEach((m,i)=>mesh.setMatrixAt(i,m.matrixWorld));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();installStaticRaycastTree(mesh);
      r.batchGroup.add(mesh);r.batches.push({mesh,originals});r.cameraMeshes.push(mesh);
    }
    room.scene.add(r.batchGroup);for(const root of r.models)root.visible=false;
    room.obstacles.push(...r.colliders);`);
patch('src/shrine/BalanceArt.js','const camera=[...room.dungeon.architectureParts.flatMap(meshes),...roots.flatMap(meshes),...stock];',`// Keep the still-visible weight bars and original answer pads in the same
    // camera surface query as the native mechanisms and all selectable crates.
    const camera=[...room.dungeon.architectureParts.flatMap(meshes),...[order.root,twin.root,lever.root].flatMap(meshes).filter(m=>!excluded.has(m))];`);
for(const[f,body]of Object.entries(sources))fs.writeFileSync(A+'/preview-'+f.replaceAll('/','__'),body);
fs.writeFileSync(A+'/patches.json',JSON.stringify(patches,null,2));console.log('PORTAL_PREVIEW '+patches.length+' replacements; no product mutation');
