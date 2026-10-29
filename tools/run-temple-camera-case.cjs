// Preserve existing play-through assertions; isolate every output directory.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const kind=process.argv[2],map={balance:'check-balance-journey.cjs',shadow:'check-shadow-journey.cjs',moon:'check-moon-camera-motion.cjs',water:'check-water-adventure.cjs',safety:'check-water-adventure-safety.cjs',chronicle:'run-sanctum-offerings-journey.cjs',separation:'check-sift-sign-camera.cjs'};
if(!map[kind])throw Error('Unknown temple camera case');
const B='reports/2026-10-24/evidence/temple-camera/'+kind;
if(['balance','shadow','water','safety','separation'].includes(kind)){
 process.argv=[process.argv[0],process.argv[1],map[kind],B];
 const wrapper=kind==='balance'?'run-balance-onboarding-case.cjs':['shadow','separation'].includes(kind)?'run-camera-check-case.cjs':'run-water-devices-case.cjs';
 const file=path.resolve('tools/'+wrapper),m=new Module(file,module);let source=fs.readFileSync(file,'utf8');
 if(kind==='balance'){
  const marker="fs.writeFileSync(path.join(dest,'executed-check.cjs'),s);";
  const from='for(const[slot,index]of observedBalanceOrder.entries()){const h=g.stock[index].home;bj.walk(5.5,3.5);';
  const to='for(const[slot,index]of observedBalanceOrder.entries()){const h=g.stock[index].home;bj.walk(5.5,game.roomActor.position.z);bj.walk(5.5,3.5);';
  if(!source.includes(marker))throw Error('Missing balance adapter marker');
  source=source.replace(marker,'replace('+JSON.stringify(from)+','+JSON.stringify(to)+',"Return via the clear side aisle after placing solid answer crates; do not cut diagonally through the scale. All15 assertions retained.");'+marker);
 }
 m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
}else{
 const file=path.resolve('tools/'+map[kind]);let s=fs.readFileSync(file,'utf8');s=s.replace(/reports\/2026-10-\d+\/evidence\/(balance-mechanisms|shadow-journey|moon-sanctum)/g,B);
 if(kind==='chronicle')s=s.replaceAll('reports/2026-10-24/evidence/sanctum-offerings/journey',B);
 if(kind==='moon')fs.mkdirSync(B,{recursive:true});
 const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
}
