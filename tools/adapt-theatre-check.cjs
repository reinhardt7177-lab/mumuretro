const assert=require('node:assert/strict');
module.exports=function(name,source,adaptations){
 if(name==='check-moon-courts.cjs'){
  assert(source.includes('**/moon-courts-v02.glb'));source=source.replaceAll('**/moon-courts-v02.glb','**/moon-courts-v03.glb');
  adaptations.push('optional architecture failure targets currentv03;keep original grounding/body/216-camera assertions');
 }
 if(name==='check-twin-shadow.cjs'){
  assert(source.includes('**/twin-shadow-v01.glb'));source=source.replaceAll('**/twin-shadow-v01.glb','**/twin-shadow-v02.glb');
  adaptations.push('optional lamp failure targets currentv02;retain14 optical/save/actual-pixel checks');
 }
 return source;
};
