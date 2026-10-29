// Reuse isolated room setup. Every seam crossing below uses the live controller.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tools/capture-fire-paving.cjs');let s=fs.readFileSync(file,'utf8');
s=s.slice(0,s.indexOf('for(const [id,camera'));
s=s.replace("B='reports/2026-10-24/evidence/fire-paving'","B='reports/2026-10-24/evidence/fire-junctions'").replace('shots:[],errors:[]','shots:[],errors:[],checks:[],realControllerMovement:true').replace("await p.locator('#title .go').click();","await p.locator('#title .go').click({noWaitAfter:true,timeout:90000});");
s+=`
const check=(name,pass,details)=>{report.checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);};
await p.evaluate(()=>{const a=game.roomActor,w=game.room.world;window.jw={rows:[],metres:0,startFalls:w.falls,tick(n=1,intent={}){for(let i=0;i<n;i++){const old=a.position.clone();game.input.setTestIntent(intent);game.step(1/60);this.metres+=old.distanceTo(a.position);this.rows.push({p:a.position.toArray(),grounded:a.grounded,floor:w.rects.floorAt(a.position.x,a.position.z,a.position.y),falls:w.falls});if(game.mode!=='room'||w.falls!==this.startFalls)throw Error('Unexpected seam fall or exit');}},walk(x,z){let n=0;while(Math.hypot(x-a.position.x,z-a.position.z)>.17&&n++<2000){a.camYaw=Math.atan2(-(x-a.position.x),-(z-a.position.z));this.tick(1,{y:1,run:true});}if(n>=2000)throw Error('Seam route blocked');this.tick(10);}};jw.walk(0,15);jw.walk(0,8);});
for(const side of [-1,1]){
 const walk=await p.evaluate(side=>{const from=jw.rows.length;for(let i=0;i<3;i++){jw.walk(side*13,8);jw.walk(side*6,8);}const rows=jw.rows.slice(from);return{frames:rows.length,positions:rows.map(r=>r.p),grounded:rows.every(r=>r.grounded),floor:rows.every(r=>r.floor===0),noVerticalDrift:rows.every(r=>Math.abs(r.p[1])<.001)};},side);
 check((side<0?'west':'east')+' seam crosses six times on zero-height support',walk.grounded&&walk.floor&&walk.noVerticalDrift&&walk.positions.some(p=>Math.abs(p[0])>12.8)&&walk.positions.some(p=>Math.abs(p[0])<6.2),{frames:walk.frames});
 const start=await p.evaluate(side=>{jw.walk(side*7.6,8);const from=jw.rows.length;game.roomActor.camYaw=side<0?Math.PI/2:-Math.PI/2;jw.tick(1,{y:1,jump:true});jw.tick(12,{y:1});game.engine.render();return{from};},side);
 await p.screenshot({path:B+'/'+(side<0?'west':'east')+'-jump.png'});
 const jump=await p.evaluate(({from,side})=>{jw.tick(35,{y:1});jw.tick(30);const rows=jw.rows.slice(from);return{frames:rows.length,airborne:rows.some(r=>!r.grounded&&r.p[1]>.3),landed:game.roomActor.grounded,end:game.roomActor.position.toArray(),supported:rows.at(-1).floor===0,peak:Math.max(...rows.map(r=>r.p[1]))};},{from:start.from,side});
 check((side<0?'west':'east')+' moving jump crosses the curved seam and lands',jump.airborne&&jump.landed&&jump.supported&&Math.abs(jump.end[0])>9.5&&Math.abs(jump.end[1])<.001,jump);
 await p.evaluate(()=>jw.walk(0,8));
}
report.movement=await p.evaluate(()=>({frames:jw.rows.length,metres:jw.metres,falls:game.room.world.falls-jw.startFalls}));
check('no browser exceptions',report.errors.length===0,report.errors);report.pass=report.checks.every(c=>c.pass);if(!report.pass)process.exitCode=1;
}catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1;console.error(e);}finally{fs.writeFileSync(B+'/walk.json',JSON.stringify(report,null,2));await browser.close();}})();
`;
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
