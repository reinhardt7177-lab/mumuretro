// The full 16-position visibility rank. A rejected candidate is skipped only
// when its best possible remaining score is already strictly below the caller's
// comparison threshold. Winning ranks still use every body sample and position.
export function forecastVisibilityScore(position,foot,samples,desired,evaluate,minimum=-Infinity){
  let consecutive=0,total=0,blocked=false,near=Math.hypot(position.x-foot.x,position.z-foot.z);
  const distancePenalty=position.distanceTo(desired)*.02;
  for(let i=0;i<samples.length;i++){
    const future=samples[i];near=Math.min(near,Math.hypot(position.x-future.x,position.z-future.z));
    const clear=evaluate(future);total+=clear;
    if(clear===3&&!blocked)consecutive++;else blocked=true;
    if(blocked){
      // Once blocked, consecutive cannot increase; each unvisited body may
      // contribute at most 3, and the near-body penalty can only increase.
      const ceiling=consecutive*100+total+(samples.length-i-1)*3-distancePenalty-Math.max(0,1.8-near)*5;
      if(ceiling+1e-9<minimum)return -Infinity;
    }
  }
  return consecutive*100+total-distancePenalty-Math.max(0,1.8-near)*5;
}
