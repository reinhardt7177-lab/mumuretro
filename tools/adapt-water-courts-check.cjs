const assert=require('node:assert/strict');
module.exports=function(name,source,adaptations){
  if(name==='check-water-adventure.cjs'){
    const marker='await game.room.final.heritagePromise;';assert(source.includes(marker));source=source.replace(marker,'await game.room.ready;'+marker);
    const condition='game.room.waterAdventure&&game.room.gates.every(g=>!g.gate.controls)';assert(source.includes(condition));source=source.replace(condition,condition+'&&game.room.waterCourts.loaded');
    adaptations.push('await the optional native architecture before actual water inputs;require native courts in the existing first assertion;retain all21 puzzle/return/save assertions and actual movement');
  }
  if(name==='check-water-adventure-safety.cjs'){
    const start='await p.evaluate(()=>{game.loop.stop();';assert(source.includes(start));source=source.replace(start,'await p.evaluate(async()=>{game.loop.stop();');
    const end='game.enterShrine(game.shrines.shrines[3]);game.dialogue.close();game.brief.hide();';assert(source.includes(end));source=source.replace(end,end+'await game.room.ready;if(!game.room.waterCourts.loaded)throw Error("Native water courts not ready");');
    adaptations.push('await and require native water courts in each fresh isolated save/mobile context;keep all19 migration/reload/touch assertions');
  }
  return source;
};
