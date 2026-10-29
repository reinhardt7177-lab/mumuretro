const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const fixture=require('./camera-cost-fixture.cjs'),{B}=fixture,phase=process.argv[2]||'after',fault=process.argv.find(v=>v.startsWith('--fault='))?.slice(8),checks=[],comparisons=[];
const read=file=>JSON.parse(fs.readFileSync(B+'/'+file)),check=(name,pass,details)=>{checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);assert(pass,name);};
function maximumDifference(a,b){assert.equal(a.length,b.length,'matching vector/sample count');return Math.max(0,...a.map((v,i)=>Math.abs(v-b[i])));}
try{
 for(const suffix of['','-portrait','-landscape']){
  const before=read('before'+suffix+'.json'),current=read(phase+suffix+'.json');
  if(!suffix&&fault){const shot=current.rooms[0].shots[0];if(fault==='pose')shot.camera[0]+=.01;else if(fault==='mask')shot.mask.foregroundFraction+=.01;else throw Error('Unknown comparison fault');}
  check(suffix+' both tours completed with the same room and viewport scope',before.pass&&current.pass&&!current.errors.length&&JSON.stringify(before.viewport)===JSON.stringify(current.viewport)&&before.rooms.length===2&&current.rooms.length===2);
  const expectedHashes=fixture.hashes(phase);
  check(suffix+' capture used the exact intended camera implementation',Object.keys(expectedHashes).every(f=>current.costSourceHashes?.[f]===expectedHashes[f]),{phase,sourceHashes:current.costSourceHashes});
  if(before.provenance?.reusedVerifiedCapture){
   const origin=fs.readFileSync(before.provenance.file),digest=crypto.createHash('sha256').update(origin).digest('hex');
   check(suffix+' reused before capture retains its verified provenance',digest===before.provenance.sha256&&before.provenance.identicalRuntimeFiles===453,before.provenance);
  }
  let frames=0,shots=0,maxActor=0,maxCamera=0,maxQuaternion=0,maxLens=0,maxFraming=0,maxMask=0,bodyMismatches=0,transitionMismatches=0,renderMismatches=0;
  for(const room of before.rooms){
   const actual=current.rooms.find(v=>v.kind===room.kind);assert(actual,'matching room');assert.equal(room.rows.length,actual.rows.length);assert.equal(room.shots.length,actual.shots.length);
   for(let i=0;i<room.rows.length;i++){
    const a=room.rows[i],b=actual.rows[i];assert.equal(a.frame,b.frame);frames++;
    maxActor=Math.max(maxActor,maximumDifference(a.actor,b.actor));maxCamera=Math.max(maxCamera,maximumDifference(a.camera,b.camera));
    bodyMismatches+=a.body!==b.body;transitionMismatches+=a.transition?.mode!==b.transition?.mode;
   }
   for(const a of room.shots){
    const b=actual.shots.find(v=>v.id===a.id);assert(b,'matching view');shots++;
    maxActor=Math.max(maxActor,maximumDifference(a.actor,b.actor));maxCamera=Math.max(maxCamera,maximumDifference(a.camera,b.camera));
    maxQuaternion=Math.max(maxQuaternion,maximumDifference(a.quaternion,b.quaternion),maximumDifference(a.up,b.up));maxLens=Math.max(maxLens,Math.abs(a.fov-b.fov),Math.abs(a.aspect-b.aspect));
    maxFraming=Math.max(maxFraming,maximumDifference((a.framed||[]).flat(),(b.framed||[]).flat()),maximumDifference((a.bodyProjection||[]).flat(),(b.bodyProjection||[]).flat()));
    for(const key of['deviceFraction','foregroundFraction','silhouettePixels','visiblePixels','foregroundPixels'])maxMask=Math.max(maxMask,Math.abs(a.mask[key]-b.mask[key]));
    renderMismatches+=a.render['그리기호출']!==b.render['그리기호출']||a.render['삼각형']!==b.render['삼각형'];
   }
  }
  const details={suffix,frames,shots,maxActor,maxCamera,maxQuaternion,maxLens,maxFraming,maxMask,bodyMismatches,transitionMismatches,renderMismatches};comparisons.push(details);
  check(suffix+' all controller poses and continuous camera transitions match before',frames===1852&&maxActor===0&&maxCamera===0&&!bodyMismatches&&!transitionMismatches,details);
  check(suffix+' all ten rendered views preserve lens framing device pixels and geometry counts',shots===10&&maxQuaternion===0&&maxLens===0&&maxFraming===0&&maxMask===0&&!renderMismatches,details);
  // Preserve the prior geometric/GPU quality gates; this is in addition to the
  // exact trajectory comparison, not a replacement with weaker assertions.
  const file=path.resolve('tools/check-workspace-camera-views.cjs'),source=fs.readFileSync(file,'utf8').replace('reports/2026-10-26/evidence/workspace-camera',B),m=new Module(file,module),oldArgv=process.argv;
  m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));process.argv=[process.execPath,file,phase+suffix];try{m._compile(source,file);}finally{process.argv=oldArgv;}
  const quality=read(phase+suffix+'-checks.json');check(suffix+' existing body visibility and workspace readability checks all ran',quality.pass&&quality.checks.length===(suffix==='-portrait'?20:18)&&quality.checks.every(v=>v.pass),{count:quality.checks.length});
 }
}catch(e){checks.push({name:'comparison completed',pass:false,details:e.stack});console.error(e.message);process.exitCode=1;}
const result={pass:checks.every(v=>v.pass)&&comparisons.length===3,phase,fault,checks,comparisons,scope:'All 5556 controller updates and 30 views against the immediately preceding installed workspace cameras. Reused baseline photographs are explicitly identified.'};
fs.writeFileSync(B+'/'+phase+'-equivalence'+(fault?'-fault-'+fault:'')+'.json',JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;
