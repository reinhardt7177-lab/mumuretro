// First fire-temple prototype. No dependency on the main game or its save key.
export const FRACTURE_SAVE_KEY='mumuplanet.fire-fracture.v1';
export const FRACTURE_BACKUP_KEY='mumuplanet.fire-fracture.previous.v1';
export const FRACTURE={centre:-28,pit:[-3,3],bridgeWidth:3.6,lowBridge:-1.25,testTime:1.5,
  spawns:[[-32,9],[-24,9]],sockets:[[-29.4,4.3],[-26.6,4.3]],bench:[-28,10.8],anchor:[-28,-8],entry:[0,27],near:[-28,10],far:[-28,-6],hub:[-5,8]};
const clone=v=>JSON.parse(JSON.stringify(v));
const safePosition=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=-36.8&&p[0]<=-19.2&&p[1]>=4.1&&p[1]<=12.6;
export function createFractureState(){return {version:1,braces:FRACTURE.spawns.map(pos=>({slot:null,pos:[...pos]})),stable:false,latched:false,visited:false,returned:false,checkpoint:'entry'};}
export function validFractureState(s){
  if(!s||s.version!==1||!Array.isArray(s.braces)||s.braces.length!==2||!['stable','latched','visited','returned'].every(k=>typeof s[k]==='boolean')||!['entry','near','far','hub'].includes(s.checkpoint))return false;
  if(s.braces.some(b=>!b||!(b.slot===null||b.slot===0||b.slot===1)||!safePosition(b.pos)))return false;
  const occupied=s.braces.filter(b=>b.slot!==null).map(b=>b.slot);
  if(new Set(occupied).size!==occupied.length||s.stable&&occupied.length!==2||s.latched&&!s.stable||s.returned&&!s.latched||s.checkpoint==='far'&&!s.stable||s.checkpoint==='hub'&&!s.returned)return false;
  if(!s.visited&&(occupied.length||s.stable||s.latched||s.returned||s.checkpoint==='near'||s.checkpoint==='far'))return false;
  return true;
}
export function parseFractureState(raw){if(typeof raw!=='string'||raw.length>12000)return null;try{const s=JSON.parse(raw);return validFractureState(s)?clone(s):null;}catch{return null;}}
export function createFractureStore(storage=()=>localStorage){let status='empty';return {
  get status(){return status;},
  read(){try{const raw=storage().getItem(FRACTURE_SAVE_KEY),s=parseFractureState(raw);status=raw===null?'empty':s?'ready':'invalid';return s;}catch{status='unavailable';return null;}},
  write(s){if(!validFractureState(s)){status='invalid';return false;}try{storage().setItem(FRACTURE_SAVE_KEY,JSON.stringify(s));status='ready';return true;}catch{status='unavailable';return false;}},
  archive(){try{const st=storage(),raw=st.getItem(FRACTURE_SAVE_KEY);if(raw!==null){st.setItem(FRACTURE_BACKUP_KEY,raw);st.removeItem(FRACTURE_SAVE_KEY);}status='empty';return true;}catch{status='unavailable';return false;}}
};}

export class FractureState {
  constructor(){this.state=createFractureState();this.held=null;this.testing=false;this.testT=0;this.testPassed=false;this.testResult=null;this.changed=false;}
  get seated(){return this.state.braces.filter(b=>b.slot!==null).length;}
  get phase(){return this.state.latched?'latched':this.testing?'testing':this.state.stable?'stable':this.seated?'braced':'loose';}
  pick(id){const b=this.state.braces[id];if(!b||this.held!==null||this.testing||this.state.latched)return false;this.state.stable=false;b.slot=null;this.held=id;this.changed=true;return true;}
  seat(slot){if(this.held===null||this.testing||this.state.braces.some(b=>b.slot===slot)||!(slot===0||slot===1))return false;this.state.braces[this.held].slot=slot;this.held=null;this.changed=true;return true;}
  drop(pos){if(this.held===null||!safePosition(pos))return false;const b=this.state.braces[this.held];b.pos=[...pos];b.slot=null;this.held=null;this.changed=true;return true;}
  test(){if(this.testing||this.held!==null||this.state.latched)return false;this.testing=true;this.testT=0;this.testPassed=this.seated===2;this.testResult=null;return true;}
  tick(dt){if(!this.testing)return;this.testT=Math.min(FRACTURE.testTime,this.testT+dt);if(this.testT>=FRACTURE.testTime){this.testing=false;this.state.stable=this.testPassed;this.testResult=this.testPassed?'stable':'unbraced';this.changed=true;}}
  latch(){if(!this.state.stable||this.testing||this.held!==null)return false;this.state.latched=true;this.state.checkpoint='far';this.changed=true;return true;}
  recover(){this.held=null;this.testing=false;this.testT=0;this.testResult=null;this.changed=true;}
  snapshot(){return clone(this.state);}
  restore(s){if(!validFractureState(s))return false;this.state=clone(s);this.held=null;this.testing=false;this.testT=0;this.testResult=null;this.changed=false;return true;}
}
