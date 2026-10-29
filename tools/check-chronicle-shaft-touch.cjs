const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
let code=fs.readFileSync('tools/check-strata-records.cjs','utf8');code=code.slice(0,code.indexOf('if(fallback){const old='));
code=code.replaceAll('evidence/strata-records','evidence/chronicle-shaft-v02').replace('viewport:{width:1280,height:900}','viewport:{width:390,height:844},hasTouch:true,isMobile:true');
code+=`
await p.evaluate(()=>{const room=game.room,first=room.gates[0].gate;for(const f of first.fossils){first.interact(f.home);first.interact(first.marks.find(m=>m.slot.level===f.level));}st.tick(2);window.g=room.gates[1].gate;window.art=room.shaftArt;g.spawn=999;game.roomActor.setAt(0,g.zIn+1);game.roomActor.camYaw=0;window.start=game.roomActor.position.clone();window.live=(n=1)=>{game.input.setTestIntent(null);for(let i=0;i<n;i++){game.dialogue.close();game.brief.hide();game.step(1/60);}};live(2);});
const cdp=await p.context().newCDPSession(p);
async function stroke(dx,dy,ticks){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:75,y:600,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:75+dx,y:600+dy,id:1}]});await p.evaluate(n=>live(n),ticks);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.evaluate(()=>live(2));}
await stroke(0,-80,50);
check('real touch joystick enters the gallery from its safe entrance',await p.evaluate(()=>art.loaded&&start.z-game.roomActor.position.z>2&&game.roomActor.position.z<g.zIn));
await p.evaluate(()=>{g.restart();g.spawn=999;const a=game.roomActor.position;Object.assign(g.rocks[0],{state:'tell',t:0,x:a.x,z:a.z});g.update(0,game.roomActor);window.impact={x:a.x,z:a.z};game.engine.render();});await p.screenshot({path:B+'/touch-warning.png'});
await stroke(80,0,30);await p.evaluate(()=>live(65));
const dodge=await p.evaluate(()=>({distance:Math.hypot(game.roomActor.position.x-impact.x,game.roomActor.position.z-impact.z),z:game.roomActor.position.z,start:impact.z}));check('real lateral touch movement escapes a fixed warned impact',dodge.distance>1&&Math.abs(dodge.z-dodge.start)<.15,dodge);
for(const [width,height] of [[390,844],[844,390]]){
 await p.setViewportSize({width,height});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const view=await p.evaluate(()=>{live(2);game.engine.render();return{overflow:document.documentElement.scrollWidth>innerWidth,rects:['tcJump','tcNote','questGuide'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return{id,x:r.x,y:r.y,w:r.width,h:r.height,visible:getComputedStyle(e).display!=='none'};})};});
 check('gallery controls remain visible '+width,!view.overflow&&view.rects.every(r=>r.visible&&r.w>=40&&r.h>=40&&r.x>=0&&r.y>=0&&r.x+r.w<=width+1&&r.y+r.h<=height+1),view);
 await p.screenshot({path:B+'/touch-'+width+'.png'});
}
check('no touch browser exceptions',!r.errors.length,r.errors);r.pass=true;
}catch(e){r.pass=false;r.failure=e.stack;process.exitCode=1;console.error(e.message);}finally{fs.writeFileSync(B+'/touch.json',JSON.stringify(r,null,2));await b.close();}})();
`;
const file=path.resolve('tools/_shaft-touch.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(code,file);
