const assert=require('node:assert/strict');
module.exports=function(name,source,adaptations){
 if(name==='check-theatre-readability.cjs'){
  const baseline="fs.readFileSync(OUT+'/before/report.json','utf8')",signature="signature:()=>[api.mode,g.round,g.objZ,g.spanIndex,...g.answers].join('/')";
  assert(source.includes(baseline)&&source.includes(signature));
  source=source.replace(baseline,"fs.readFileSync('reports/2026-10-23/evidence/theatre-readability/before/report.json','utf8')");
  source=source.replace(signature,"signature:()=>[api.mode,g.round,g.objZ,g.spanIndex,g.held,api.workshop?.revision||0,...g.answers].join('/')");
  adaptations.push('read historical unchanged crank arm-length baseline without writing it;cache fault targets current held/asset-revision signature;retain48 real workviews and all eight assertions');
 }
 if(['check-shadow-journey.cjs','check-twin-play.cjs'].includes(name)){
  const marker=name==='check-twin-play.cjs'?'act(){this.tick(1,{action:true});this.tick(1);}':'act(){this.tick(1,{action:true});this.tick();}';assert(source.includes(marker));
  const method="walkCart(x,z){const g=game.room.gates[2].gate,round=g.round,a=game.roomActor;let n=0;while(g.held&&g.round===round&&Math.hypot(a.position.x-x,a.position.z-z)>.045&&n++<1800){a.camYaw=Math.atan2(-(x-a.position.x),-(z-a.position.z));this.tick(1,{y:1});}if(n>=1800)throw Error('Cart input blocked before completion');this.tick(2);},";
  source=source.replace(marker,method+marker);
  if(name==='check-shadow-journey.cjs'){const from='sj.walk(handle.x,g.theatre.target().position+g.dragOffset);';assert(source.includes(from));source=source.replace(from,'sj.walkCart(handle.x,g.theatre.target().position+g.dragOffset);');}
  else{for(const from of['tp.walk(handle.x,target+offset);','tp.walk(handle.x,target+g.dragOffset);']){assert(source.includes(from));source=source.replace(from,from.replace('tp.walk(','tp.walkCart('));}}
  adaptations.push('actual cart input stops when the controller releases it on stage completion;do not walk through the newly solid released handle. Width-only phase still reaches its target;all original round/door/save assertions retained.');
 }
 return source;
};
