const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{prepare,A,B}=require('./landing-arrival-fixture.cjs');
const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','playwright')),{PNG}=require(path.join(process.env.AUDIT_NODE_MODULES||'.','pngjs'));
const phase=process.argv[2]||'after',report={phase,preparedViews:true,labPrepared:true,whiteTransitionHidden:true,shots:[],errors:[]};
fs.mkdirSync(B,{recursive:true});
function difference(a,b,indices){const sum=[0,0,0],signed=[0,0,0];for(const i of indices)for(let k=0;k<3;k++){sum[k]+=Math.abs(a.data[i+k]-b.data[i+k]);signed[k]+=a.data[i+k]-b.data[i+k];}return{samples:indices.length,meanAbs:sum.map(v=>v/indices.length),signed:signed.map(v=>v/indices.length)};}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await prepare(p,phase);
  for(const time of[.25,.8,1.7]){
    await p.evaluate(time=>arrival.advance(time),time);
    for(const[id,yaw]of[['front',0],['side',Math.PI/2],['rear',Math.PI]]){
      const shot={id:id+'-'+time,time,yaw,...await p.evaluate(y=>arrival.pose(y),yaw)};
      const mask=await p.evaluate(()=>arrival.bodyMask()),road=await p.evaluate(()=>arrival.roadPixels());await p.evaluate(()=>{game.engine.render();game.engine.render();});
      const on=PNG.sync.read(await p.screenshot({path:B+'/'+phase+'-'+shot.id+'.png',timeout:120000}));
      await p.evaluate(()=>{arrival.visibility=arrival.fx.map(o=>o.visible);for(const o of arrival.fx)o.visible=false;game.engine.render();game.engine.render();});
      const off=PNG.sync.read(await p.screenshot({path:B+'/'+phase+'-'+shot.id+'-control.png',timeout:120000}));
      await p.evaluate(()=>{arrival.fx.forEach((o,i)=>o.visible=arrival.visibility[i]);game.engine.render();game.engine.render();});
      shot.body=difference(on,off,mask);shot.road={...difference(on,off,road.pixels),patches:road.patches};shot.render=await p.evaluate(()=>__dbg.perf());report.shots.push(shot);console.log('CAPTURE '+phase+' '+shot.id+' body '+shot.body.meanAbs.map(n=>n.toFixed(2)).join('/'));
    }
  }
  const far={id:'far',...await p.evaluate(()=>arrival.pose(0,true))};
  const on=PNG.sync.read(await p.screenshot({path:B+'/'+phase+'-far.png',timeout:120000}));
  await p.evaluate(()=>{arrival.visibility=arrival.fx.map(o=>o.visible);for(const o of arrival.fx)o.visible=false;game.engine.render();game.engine.render();});
  const off=PNG.sync.read(await p.screenshot({path:B+'/'+phase+'-far-control.png',timeout:120000})),pixels=[],rect=await p.evaluate(()=>arrival.beaconRect());for(let y=rect.y0;y<=rect.y1;y++)for(let x=rect.x0;x<=rect.x1;x++)pixels.push((y*1280+x)*4);far.rect=rect;
  far.effect=difference(on,off,pixels);report.shots.push(far);await p.evaluate(()=>arrival.fx.forEach((o,i)=>o.visible=arrival.visibility[i]));
  await p.evaluate(async()=>{(await import('/src/render/Quality.js')).quality.pin('min');arrival.pose();game.engine.render();game.engine.render();});await p.screenshot({path:B+'/'+phase+'-min.png',timeout:120000});
  for(const [file,name]of[['src/world/Landing.js','Landing'],['src/boot.js','boot']]){const f=phase==='before'||phase==='legacy'?B+'/before-'+file.replaceAll('/','__'):phase==='goal'?A+'/'+name+'-preview.js':file;(report.hashes??={})[file]=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');}
  report.pass=report.shots.length===10&&!report.errors.length&&report.shots.slice(0,9).every(s=>s.body.samples>100);if(!report.pass)process.exitCode=1;
}catch(e){report.pass=false;report.failure=e.stack;console.error(e);process.exitCode=1;}finally{fs.writeFileSync(B+'/'+phase+'.json',JSON.stringify(report,null,2));await browser.close();}})();
