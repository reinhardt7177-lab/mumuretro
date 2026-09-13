// Server-owned puzzle state. Client commands cannot submit solved flags.
function createBalance(){return {revision:0,count:3,pivot:2,stages:[{at:Array(5).fill(-1),owners:Array(5).fill(null),solved:false},{at:Array(4).fill(-1),owners:Array(4).fill(null),solved:false},{at:Array(2).fill(-1),owners:Array(2).fill(null),solved:false}]};}
function releaseBalance(state,id){let changed=false;for(const s of state.stages)s.owners.forEach((owner,i)=>{if(owner===id){s.owners[i]=null;s.at[i]=-1;changed=true;}});if(changed)state.revision++;}
function commandBalance(state,id,c){
 if(!c||!Number.isInteger(c.stage)||c.stage<0||c.stage>2)return 'invalid';
 const s=state.stages[c.stage];if(s.solved||state.stages.slice(0,c.stage).some(s=>!s.solved))return 'locked';
 if(c.type==='count'){
  if(c.stage!==0||![3,4,5].includes(c.value)||s.owners.some(Boolean)||s.at.some(v=>v!==-1))return 'busy';state.count=c.value;
 }else if(c.type==='pivot'){
  if(c.stage!==2||![-1,1].includes(c.value))return 'invalid';state.pivot=Math.max(1,Math.min(5,state.pivot+c.value));
 }else{
  const i=c.box,limit=c.stage===0?state.count:s.at.length;if(!Number.isInteger(i)||i<0||i>=limit)return 'invalid';
  if(c.type==='pick'){if(s.owners[i]||state.stages.some(s=>s.owners.includes(id)))return 'owned';s.owners[i]=id;s.at[i]=-2;}
  else if(c.type==='place'){if(s.owners[i]!==id)return 'owner';const cells=c.stage===0?[...Array(state.count).keys(),5,6]:[...Array(c.stage===1?4:6).keys()];if(!cells.includes(c.cell)||s.at.includes(c.cell))return 'occupied';s.at[i]=c.cell;s.owners[i]=null;}
  else if(c.type==='drop'){if(s.owners[i]!==id)return 'owner';s.at[i]=-1;s.owners[i]=null;}
  else return 'invalid';
 }
 const a=s.at;if(c.stage===0)s.solved=a.slice(0,state.count).every((v,i)=>v===i);
 if(c.stage===1){const sums=[0,0];a.forEach((v,i)=>{if(v>=0)sums[Math.floor(v/2)]+=i+1;});s.solved=a.every(v=>v>=0)&&sums[0]===sums[1];}
 if(c.stage===2){const arms=a.map(v=>v+.5-state.pivot);s.solved=a.every(v=>v>=0)&&arms[0]*arms[1]<0&&Math.abs(2*arms[0]+6*arms[1])<1e-6;}
 state.revision++;return null;
}
module.exports={createBalance,releaseBalance,commandBalance};
