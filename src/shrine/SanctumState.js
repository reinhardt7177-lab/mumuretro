export const FIRE_AUDIENCE=[
 '흔들리는 곳을 살피고 받침으로 다리를 고정했구나.',
 '흐르던 용암은 공급을 끊자 굳어서 네가 걸을 길이 되었지.',
 '증기의 동력을 나누어 다리를 내리고, 승강대에 올라 이곳에 도착했다.',
 '관찰하고 바꾼 공간이 너를 이끌었다. 이 지혜를 수첩에 담아 가거라.'
];
export const createSanctumState=()=>({version:1,phase:'ready',line:0,awards:0});
export function validSanctumState(s){return !!s&&s.version===1&&['ready','audience','reward','exited'].includes(s.phase)&&Number.isInteger(s.line)&&s.line>=0&&s.line<4&&Number.isInteger(s.awards)&&s.awards===(['reward','exited'].includes(s.phase)?1:0)&&!(s.phase==='ready'&&s.line!==0)&&!(['reward','exited'].includes(s.phase)&&s.line!==3);}
export class SanctumState{
 constructor(){this.state=createSanctumState();this.rewardTime=0;this.changed=false;}
 begin(unlocked){if(!unlocked||this.state.phase!=='ready')return false;this.state.phase='audience';this.changed=true;return true;}
 next(){if(this.state.phase!=='audience')return false;if(this.state.line<3)this.state.line++;else{this.state.phase='reward';this.state.awards=1;this.rewardTime=0;}this.changed=true;return true;}
 skip(){if(this.state.phase!=='audience')return false;this.state.line=3;return this.next();}
 tick(dt){if(this.state.phase!=='reward')return false;this.rewardTime+=dt;if(this.rewardTime<1.6)return false;this.state.phase='exited';this.changed=true;return true;}
 snapshot(){return structuredClone(this.state);}
 restore(s){if(!validSanctumState(s))return false;this.state=structuredClone(s);this.rewardTime=0;this.changed=false;return true;}
}
