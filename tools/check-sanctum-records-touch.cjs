const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
let source=fs.readFileSync('tools/check-strata-records-touch.cjs','utf8').replaceAll('evidence/strata-records','evidence/sanctum-records');
source=source.replace('st.walk(0,5.3);st.walk(3.9,5.3);',"const room=game.room;for(let i=0;i<3;i++){room.gates[i].solved=true;room.dungeon.openDoor('r'+(i+1));}room.strataPortal.snap();room.shaftEntry.snap();room.archiveEntry.snap();game.roomActor.setAt(0,-60.2);st.tick();for(let i=0;i<12&&game.dialogue.active;i++)st.action();window.seenBefore=JSON.stringify(game.dialogue.exportState());st.walk(-7.7,-60.7);");
source=source.replaceAll('game.room.goals.r1','game.room.goals.shrine').replaceAll('!game.room.gates[0].gate.held','!game.room.final.held');
const file=path.resolve('tools/_sanctum-records-touch.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(source,file);
