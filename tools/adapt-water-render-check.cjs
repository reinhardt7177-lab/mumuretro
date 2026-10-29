const assert=require('node:assert/strict');
module.exports=function(name,source,adaptations){
  if(name==='check-water-adventure.cjs'){
    const marker='&&game.room.waterCourts.loaded';assert(source.includes(marker));source=source.replace(marker,marker+'&&game.room.final.detail.loaded');adaptations.push('require real water deity LOD before all21 original actual-input assertions');
  }
  if(name==='check-water-adventure-safety.cjs'){
    const marker='await game.room.ready;';assert(source.includes(marker));source=source.replaceAll(marker,marker+'await game.room.final.heritagePromise;if(!game.room.final.detail.loaded)throw Error("Water deity detail not ready");');adaptations.push('await and require real deity LOD in each isolated save/mobile context;retain all19 assertions');
  }
  return source;
};
