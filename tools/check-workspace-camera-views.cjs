const fs=require('node:fs'),B='reports/2026-10-26/evidence/workspace-camera',name=process.argv[2]||'after',r=JSON.parse(fs.readFileSync(B+'/'+name+'.json')),checks=[];
const check=(name,pass,details)=>{checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);};
check('both independent room tours completed without script errors',r.pass&&r.rooms.length===2&&!r.errors.length);
for(const room of r.rooms){
 const rows=room.rows||[],motion=rows.filter(v=>!v.initialPlacement),front=room.shots.filter(v=>['right','centre','left'].includes(v.id));
 check(room.kind+' reaches every requested approach through controller movement',room.walks.length>=9&&room.walks.every(v=>v.reached),room.walks);
 check(room.kind+' all nine independent body rays remain clear in continuous updates',rows.length>800&&rows.every(v=>v.body===3),{frames:rows.length,bad:rows.filter(v=>v.body!==3).map(v=>v.frame)});
 check(room.kind+' continuous camera path stays within18m/s without emergency relocation',motion.length>800&&motion.every(v=>v.step<=.300001&&v.transition?.mode!=='emergency'),{maxStep:Math.max(...motion.map(v=>v.step)),emergencies:motion.filter(v=>v.transition?.mode==='emergency').length});
 check(room.kind+' camera rotation remains finite and below15degrees per update',motion.every(v=>Number.isFinite(v.rotationStep)&&v.rotationStep<=Math.PI/12),{max:Math.max(...motion.map(v=>v.rotationStep))});
 check(room.kind+' full native work-device bounds stay inside the front camera',front.length===3&&front.every(v=>v.framed?.length===8&&v.framed.every(p=>Math.abs(p[0])<.965&&Math.abs(p[1])<.965&&p[2]>-1&&p[2]<1)),front.map(v=>({id:v.id,framed:v.framed})));
 check(room.kind+' front device GPU masks retain their visible surface',front.every(v=>v.mask.silhouettePixels>250&&v.mask.deviceFraction>=(room.kind==='balance'?.999:.90)),front.map(v=>({id:v.id,...v.mask})));
 check(room.kind+' three front views avoid large close foreground structure',front.every(v=>v.mask.foregroundFraction<=.15),front.map(v=>({id:v.id,foreground:v.mask.foregroundFraction})));
 if(r.viewport.width<500)check(room.kind+' portrait keeps a readable body above the lower controls',front.every(v=>v.bodyProjection?.length===2&&v.bodyProjection[0][1]>-.66&&Math.abs(v.bodyProjection[1][1]-v.bodyProjection[0][1])*r.viewport.height/2>100),front.map(v=>({id:v.id,body:v.bodyProjection})));
 const free=room.shots.filter(v=>['side','rear'].includes(v.id));
 check(room.kind+' side and rear views release the workspace look offset',free.length===2&&free.every(v=>!v.workspaceOffset||v.workspaceOffset.every(x=>Math.abs(x)<.0001)),free.map(v=>({id:v.id,offset:v.workspaceOffset})));
 if(room.kind==='sift')check('Sift retained bridge posts have matching camera and body registration',front.every(v=>v.registered?.posts>0&&v.registered.solids===v.registered.posts),front[0]?.registered);
}
const out={pass:checks.every(v=>v.pass),phase:name,checks};fs.writeFileSync(B+'/'+name+'-checks.json',JSON.stringify(out,null,2));if(!out.pass)process.exitCode=1;
