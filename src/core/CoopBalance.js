// Bind live server state to an existing balance room. Personal saving must be
// paused by the caller while this binding is active (multiple simultaneous carries).
export function bindCoopBalance(room,id,send){
 const devices=[...room.gates.map(g=>g.gate),room.final],originals=devices.map(g=>({interact:g.interact,check:g.check}));let snapshot=null;
 devices.forEach((g,stage)=>{g.check=()=>{g.solved=!!snapshot?.stages[stage].solved;};g.interact=p=>{
  if(!snapshot||snapshot.stages[stage].solved)return false;
  const choice=g.choices?.find(c=>Math.hypot(p.x-c.x,p.z-c.z)<.7);
  const control=g.controls?.find(c=>Math.hypot(p.x-c.x,p.z-c.z)<.85);
  const n=g.near(p),held=snapshot.stages[stage].owners.indexOf(id);let command;
  if(choice)command={type:'count',value:choice.n};
  else if(control)command={type:'pivot',value:control.d};
  else if(held>=0)command={type:n?.kind==='cell'?'place':'drop',box:held,cell:n?.item};
  else if(n?.kind==='stock')command={type:'pick',box:n.item};
  if(!command)return false;send({...command,stage});return true;
 };});
 return {apply(next){if(snapshot&&next.revision<snapshot.revision)return;snapshot=next;devices.forEach((g,i)=>{const s=next.stages[i];if(i===0&&g.count!==next.count){g.solved=false;g.select(next.count);}if(i===2)g.pivot=next.pivot;g.stock.forEach((b,j)=>{b.at=s.at[j];b.mesh.visible=(i!==0||j<next.count)&&(!s.owners[j]||s.owners[j]===id);});g.held=s.owners.indexOf(id);if(g.held<0)g.held=null;g.solved=s.solved;g.sync();});},dispose(){devices.forEach((g,i)=>Object.assign(g,originals[i]));}};
}
