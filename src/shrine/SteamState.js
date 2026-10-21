export const STEAM={selector:[-6,-21],near:[0,-20],far:[0,-31.5],lift:[7,-31.2],upper:[7,-34.5],goal:[0,-39.1],lowerCall:[4.1,-32.1],upperCall:[9.4,-34.5],height:3.2,bridgeTime:2.2,rideTime:4};
export function createSteamState(){return {version:1,diverter:'off',bridgeLatched:false,liftLevel:'low',rodeUp:false,upperReached:false,visited:false};}
export function validSteamState(s){
 if(!s||s.version!==1||!['off','bridge','lift'].includes(s.diverter)||!['low','upper'].includes(s.liftLevel)||!['bridgeLatched','rodeUp','upperReached','visited'].every(k=>typeof s[k]==='boolean'))return false;
 if((s.rodeUp||s.liftLevel==='upper')&&!s.bridgeLatched||(s.upperReached||s.liftLevel==='upper')&&!s.rodeUp)return false;
 if(!s.visited&&(s.diverter!=='off'||s.bridgeLatched||s.liftLevel!=='low'||s.rodeUp||s.upperReached))return false;
 return true;
}
export class SteamState{
 constructor(){this.state=createSteamState();this.bridgeProgress=0;this.height=0;this.moving=false;this.destination='low';this.passenger=false;this.changed=false;}
 switchPower(){if(this.moving)return false;const s=this.state;s.diverter=s.diverter==='bridge'?'lift':'bridge';s.visited=true;this.changed=true;return true;}
 ride(boarded){if(!boarded||this.moving||!this.state.bridgeLatched||this.state.diverter!=='lift')return false;this.destination=this.state.liftLevel==='low'?'upper':'low';this.moving=true;this.passenger=true;this.changed=true;return true;}
 call(level){const s=this.state;if(!['low','upper'].includes(level)||this.moving||!s.bridgeLatched||s.diverter!=='lift'||level==='upper'&&!s.rodeUp||s.liftLevel===level)return false;this.destination=level;this.moving=true;this.passenger=false;this.changed=true;return true;}
 tick(dt){if(!Number.isFinite(dt)||dt<=0)return;const s=this.state;
  if(!s.bridgeLatched&&s.diverter==='bridge'){this.bridgeProgress=Math.min(1,this.bridgeProgress+dt/STEAM.bridgeTime);if(this.bridgeProgress===1){s.bridgeLatched=true;this.changed=true;}}
  if(this.moving){const target=this.destination==='upper'?STEAM.height:0,sign=Math.sign(target-this.height);this.height+=sign*Math.min(Math.abs(target-this.height),dt*STEAM.height/STEAM.rideTime);if(Math.abs(this.height-target)<.00001){this.height=target;this.moving=false;s.liftLevel=this.destination;if(this.destination==='upper'&&this.passenger)s.rodeUp=true;this.passenger=false;this.changed=true;}}
 }
 snapshot(){const s=structuredClone(this.state);if(!s.bridgeLatched)s.diverter='off';return s;}
 restore(s){if(!validSteamState(s))return false;this.state=structuredClone(s);this.bridgeProgress=s.bridgeLatched?1:0;this.height=s.liftLevel==='upper'?STEAM.height:0;this.moving=false;this.passenger=false;this.changed=false;return true;}
}
