// Current water-temple entry point. The old mechanics' checks are preserved
// in check-water-court-v1.cjs for use against the pre-v2 revision only.
const {spawnSync}=require('node:child_process'),path=require('node:path');
for(const file of ['check-water-phases.cjs','check-water-phases-mobile.cjs']){
  const result=spawnSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
