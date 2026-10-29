const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
let code=fs.readFileSync('tools/check-strata-records-touch.cjs','utf8').replaceAll('evidence/strata-records','evidence/shaft-entry');
code=code.replace('st.walk(0,5.3);st.walk(3.9,5.3);',"const first=game.room.gates[0].gate;for(const f of first.fossils){first.interact(f.home);first.interact(first.marks.find(m=>m.slot.level===f.level));}st.tick(2);window.art=game.room.shaftEntry;window.g=game.room.gates[1].gate;g.restart();g.spawn=999;game.roomActor.setAt(0,-16.5);st.walk(-2.75,-16.5);").replace('game.room.goals.r1','game.room.goals.r2');
code=code.replace("check('no browser exceptions'",`
await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{st.walk(0,-16.5);st.walk(0,-31.7);game.roomActor.camYaw=0;game.input.setTestIntent(null);live();});
const cdp=await p.context().newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:75,y:600,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:75,y:520,id:1}]});await p.evaluate(()=>{for(let i=0;i<90;i++){game.brief.hide();live();}});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.evaluate(()=>live());
check('real touch joystick triggers and crosses sliding exit',await p.evaluate(()=>game.room.gates[1].solved&&art.progress===1&&game.roomActor.position.z<-35));
await p.evaluate(()=>game.engine.render());await p.screenshot({path:B+'/touch-door.png'});
check('no browser exceptions'`);
const file=path.resolve('tools/_shaft-entry-touch.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(code,file);
