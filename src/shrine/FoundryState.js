// A bounded, resumable foundry experiment. The cooled bridge is permanent.
export const FOUNDRY={controls:[[24,7],[31,7]],rotors:[[24,2.8,5.8],[31,2.8,3.6]],valve:[35,9],anchor:[28,-8],near:[28,10],far:[28,-6],hub:[5,8],fillTime:3,coolTime:4};
const clone=s=>JSON.parse(JSON.stringify(s));
export function createFoundryState(){return {version:1,channels:[1,2],valve:false,fill:0,cooling:0,solid:false,latched:false,visited:false,returned:false};}
export function validFoundryState(s){
 if(!s||s.version!==1||!Array.isArray(s.channels)||s.channels.length!==2||s.channels.some(n=>!Number.isInteger(n)||n<0||n>3))return false;
 if(!['valve','solid','latched','visited','returned'].every(k=>typeof s[k]==='boolean')||!Number.isFinite(s.fill)||s.fill<0||s.fill>1||!Number.isFinite(s.cooling)||s.cooling<0||s.cooling>FOUNDRY.coolTime)return false;
 if(s.cooling>0&&s.fill!==1||s.solid&&(s.fill!==1||s.cooling!==FOUNDRY.coolTime)||!s.solid&&s.cooling===FOUNDRY.coolTime||s.latched&&!s.solid||s.returned&&!s.latched||s.valve&&s.cooling>0&&!s.solid)return false;
 if(!s.visited&&(s.valve||s.fill||s.cooling||s.solid||s.latched||s.returned||s.channels[0]!==1||s.channels[1]!==2))return false;
 return true;
}
export class FoundryState{
 constructor(){this.state=createFoundryState();this.changed=false;}
 get connected(){return this.state.channels.every(n=>n===0);}
 get phase(){const s=this.state;return s.latched?'latched':s.solid?'solid':s.cooling>0?'cooling':s.fill===1?'hot':s.fill>0?'filling':s.valve?'routing':'empty';}
 turn(i){const s=this.state;if(![0,1].includes(i)||s.valve)return false;s.channels[i]=(s.channels[i]+1)%4;s.visited=true;this.changed=true;return true;}
 toggle(){const s=this.state;s.valve=!s.valve;s.visited=true;if(s.valve&&!s.solid)s.cooling=0;this.changed=true;return true;}
 tick(dt){const s=this.state;if(!Number.isFinite(dt)||dt<=0||!s.visited)return;const oldFill=Math.floor(s.fill*10),oldCool=Math.floor(s.cooling*2),wasSolid=s.solid;
  if(s.valve&&this.connected&&!s.solid)s.fill=Math.min(1,s.fill+dt/FOUNDRY.fillTime);
  if(!s.valve&&s.fill===1&&!s.solid){s.cooling=Math.min(FOUNDRY.coolTime,s.cooling+dt);if(s.cooling===FOUNDRY.coolTime)s.solid=true;}
  if(oldFill!==Math.floor(s.fill*10)||oldCool!==Math.floor(s.cooling*2)||wasSolid!==s.solid)this.changed=true;
 }
 latch(){if(!this.state.solid)return false;this.state.latched=true;this.changed=true;return true;}
 recover(){this.state.valve=false;this.changed=true;}
 snapshot(){const s=clone(this.state);s.valve=false;return s;}
 restore(s){if(!validFoundryState(s))return false;this.state=clone(s);this.state.valve=false;this.changed=false;return true;}
}
