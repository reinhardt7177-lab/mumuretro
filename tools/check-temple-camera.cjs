// Assert the recorded live traversal, not only the prepared end screenshots.
const fs=require('node:fs'),assert=require('node:assert/strict');
const B='reports/2026-10-24/evidence/temple-camera',phase=process.argv[2]||'after';
const r=JSON.parse(fs.readFileSync(B+'/'+phase+'.json')),checks=[];
const check=(name,pass,details)=>{checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);};
for(const room of r.rooms){const s=room.summary;check(room.kind+' actual route is reached and all nine body rays stay clear',s.reached&&s.metres>5&&s.minVisibility===3&&s.occludedFrames===0,{frames:s.frames,metres:s.metres,minVisibility:s.minVisibility,occludedFrames:s.occludedFrames});check(room.kind+' continuous camera follow stays within 0.30m per 1/60 update',s.continuousMaxStep<.301&&room.rows.filter(row=>!row.initialPlacement&&row.actorStep<=.2).every(row=>!['emergency','unresolved'].includes(row.transition?.mode)),{maxStep:s.continuousMaxStep,relocations:s.relocations,initialPlacements:room.rows.filter(row=>row.initialPlacement).length});}
check('three isolated rooms load without browser exceptions',r.pass&&r.rooms.length===3&&!r.errors.length,r.errors);
const report={phase,pass:checks.every(c=>c.pass),checks,scope:'Actual first-court movement/orbit,not entire temple camera coverage',errors:r.errors};
fs.writeFileSync(B+'/check-'+phase+'.json',JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
