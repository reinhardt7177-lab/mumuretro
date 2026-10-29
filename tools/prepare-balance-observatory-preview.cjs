const fs=require('node:fs'),A='art/balance-observatory/v01',B='reports/2026-10-25/evidence/balance-observatory',baseline=JSON.parse(fs.readFileSync(B+'/baseline.json'));
for(const f of['src/shrine/RoomActor.js','src/render/VisibleCameraFollow.js'])if(!baseline.files.includes(f)){const sha=require('node:crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');if(sha!==baseline.inventory[f])throw Error('Controller changed before baseline '+f);fs.copyFileSync(f,B+'/baseline-'+f.replaceAll('/','__'));baseline.files.push(f);fs.writeFileSync(B+'/baseline.json',JSON.stringify(baseline,null,2));}
const sources=Object.fromEntries(baseline.files.map(f=>[f,fs.readFileSync(B+'/baseline-'+f.replaceAll('/','__'),'utf8').replace(/\r\n/g,'\n')])),patches=[];
function patch(file,from,to){if(!sources[file].includes(from))throw Error('Preview marker missing '+file+': '+from);sources[file]=sources[file].replace(from,to);patches.push({file,from,to});}
patch('src/data/balanceTemple.js','balance-temple-v07.glb','balance-temple-v08.glb');
patch('src/shrine/BalanceTemple.js',"'Balance wall ashlar'].includes(m.name)","'Balance wall ashlar','Balance vault lining'].includes(m.name)");
patch('src/shrine/BalanceTemple.js','0x182b3d','0x455f6a');patch('src/shrine/BalanceTemple.js','0x182b3d','0x455f6a');
patch('src/shrine/BalanceTemple.js','HemisphereLight(0xe7efde,0x293647,1.6)','HemisphereLight(0xdce8e6,0x535642,1.9)');
patch('src/shrine/BalanceTemple.js','DirectionalLight(0xffdfab,3.1)','DirectionalLight(0xffdfab,2.7)');
patch('src/shrine/Room.js',"import { registerBalanceRecords } from './BalanceRecords.js';","import { registerBalanceRecords } from './BalanceRecords.js';\nimport { registerBalanceCourtArt } from './BalanceCourtArt.js';");
patch('src/shrine/Room.js','  registerBalanceRecords(finished);','  registerBalanceRecords(finished);\n  registerBalanceCourtArt(finished);');
patch('src/shrine/RoomActor.js','    const dist = Math.max(zone?.minDistance??3.2, Math.min(zone?.maxDistance??6.5, input.camDist*(zone?.distanceScale??1)));',`    let dist = Math.max(zone?.minDistance??3.2, Math.min(zone?.maxDistance??6.5, input.camDist*(zone?.distanceScale??1)));
    const requestedDistance=dist;
    for(const focus of this.rects.cameraApproachZones||[]){
      const near=1-THREE.MathUtils.smoothstep(Math.hypot(this.position.x-focus.x,this.position.z-focus.z),focus.near,focus.far);
      dist=Math.min(dist,THREE.MathUtils.lerp(requestedDistance,Math.min(requestedDistance,focus.distance),near));
    }`);
patch('src/shrine/RoomActor.js','    const preferredSubjectCamera=',`    let cameraMotion=null;
    if(subjectZone?.anticipateMotion){
      const previous=this._cameraMotionFoot??=this.position.clone(),motion=this._cameraSubjectMotion??=new THREE.Vector3();
      motion.subVectors(this.position,previous).setY(0);if(!this._camPlaced||!this._cameraWasAnticipating||motion.lengthSq()>.25)motion.set(0,0,0);previous.copy(this.position);cameraMotion=motion;
    }
    this._cameraWasAnticipating=!!subjectZone?.anticipateMotion;
    const preferredSubjectCamera=`);
patch('src/shrine/RoomActor.js','dt,subjectZone.halfWidth||.22);','dt,subjectZone.halfWidth||.22,cameraMotion);');
patch('src/render/VisibleCameraFollow.js','dt,halfWidth=.22){','dt,halfWidth=.22,motion=null){');
patch('src/render/VisibleCameraFollow.js','  delta.subVectors(desired,current)',`  if(motion&&motion.lengthSq()>1e-8){
    const moving=followMovingSubject(current,desired,foot,meshes,safe,blend,step,motion,halfWidth);
    if(moving)return moving;
  }
  delta.subVectors(desired,current)`);
sources['src/render/VisibleCameraFollow.js']+='\n'+fs.readFileSync(A+'/MovingCamera-preview.js','utf8');
for(const[f,body]of Object.entries(sources))fs.writeFileSync(A+'/preview-'+f.replaceAll('/','__'),body);fs.writeFileSync(A+'/patches.json',JSON.stringify(patches,null,2));console.log('OBSERVATORY_PREVIEW '+patches.length+' replacements; no product mutation');
