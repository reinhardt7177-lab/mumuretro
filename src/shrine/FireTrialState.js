import {createFractureState,validFractureState,parseFractureState,FRACTURE_SAVE_KEY} from './FractureState.js';
import {createFoundryState,validFoundryState} from './FoundryState.js';
import {createSteamState,validSteamState} from './SteamState.js';
import {createSanctumState,validSanctumState} from './SanctumState.js';

export const FIRE_TRIAL_SAVE_KEY='mumuplanet.fire-trial.v3';
export const FIRE_TRIAL_STEAM_KEY='mumuplanet.fire-trial.v2';
export const FIRE_TRIAL_LEGACY_KEY='mumuplanet.fire-trial.v1';
export const FIRE_TRIAL_BACKUP_KEY='mumuplanet.fire-trial.previous.v3';
export const FIRE_TRIAL_BEFORE_STEAM_KEY='mumuplanet.fire-trial.before-steam.v1';
const oldCheckpoints=['entry','fractureNear','fractureFar','hub','foundryNear','foundryFar'];
export function createFireTrialState(){return {version:3,fracture:createFractureState(),foundry:createFoundryState(),steam:createSteamState(),sanctum:createSanctumState(),checkpoint:'entry'};}
function validRooms(s){
 if(!s||!validFractureState(s.fracture)||!validFoundryState(s.foundry))return false;
 const f=s.fracture,g=s.foundry;if(g.visited&&!f.returned||s.checkpoint==='fractureNear'&&!f.visited||s.checkpoint==='fractureFar'&&!f.stable||s.checkpoint==='hub'&&!f.returned||s.checkpoint==='foundryNear'&&!g.visited||s.checkpoint==='foundryFar'&&(!g.visited||!g.solid))return false;
 return true;
}
function validSteamEnvelope(s){if(!validRooms(s)||!validSteamState(s.steam)||![...oldCheckpoints,'steamNear','steamFar','steamUpper','sanctum','exited'].includes(s.checkpoint))return false;const t=s.steam;return !(t.visited&&!s.foundry.returned||s.checkpoint==='steamNear'&&!t.visited||s.checkpoint==='steamFar'&&!t.bridgeLatched||s.checkpoint==='steamUpper'&&!t.rodeUp);}
export function validFireTrialState(s){if(!validSteamEnvelope(s)||s.version!==3||!validSanctumState(s.sanctum))return false;return !((s.checkpoint==='sanctum'||s.sanctum.phase!=='ready')&&!s.steam.upperReached||s.checkpoint==='exited'&&s.sanctum.phase!=='exited'||s.sanctum.phase==='exited'&&s.checkpoint!=='exited');}
export function upgradeFireTrial(s){if(s?.version===1&&validRooms(s)&&oldCheckpoints.includes(s.checkpoint))s={...s,version:2,steam:createSteamState()};if(s?.version===2&&validSteamEnvelope(s)&&!['sanctum','exited'].includes(s.checkpoint))s={...s,version:3,sanctum:createSanctumState()};return validFireTrialState(s)?s:null;}
export function createFireTrialStore(storage=()=>localStorage){let status='empty',migrated=false,beforeSteam=null;return {
 get status(){return status;},get migrated(){return migrated;},
 read(){try{const st=storage(),raw=st.getItem(FIRE_TRIAL_SAVE_KEY);if(raw!==null){let s=null;try{s=raw.length<20000?JSON.parse(raw):null;}catch{}status=validFireTrialState(s)?'ready':'invalid';return status==='ready'?s:null;}
  for(const key of [FIRE_TRIAL_STEAM_KEY,FIRE_TRIAL_LEGACY_KEY]){const previous=st.getItem(key);if(previous!==null){let s=null;try{s=previous.length<20000?upgradeFireTrial(JSON.parse(previous)):null;}catch{}if(s){beforeSteam=previous;migrated=true;status='ready';return s;}}}
  const old=parseFractureState(st.getItem(FRACTURE_SAVE_KEY));if(!old){status='empty';return null;}const s=createFireTrialState();s.fracture=old;s.checkpoint=old.returned?'hub':old.checkpoint==='near'?'fractureNear':old.checkpoint==='far'?'fractureFar':'entry';migrated=true;status='ready';return s;
 }catch{status='unavailable';return null;}},
 write(s){if(!validFireTrialState(s))return false;try{const st=storage();if(beforeSteam!==null){let key=FIRE_TRIAL_BEFORE_STEAM_KEY,n=0;while(st.getItem(key)!==null&&st.getItem(key)!==beforeSteam)key=FIRE_TRIAL_BEFORE_STEAM_KEY+'.'+(++n);st.setItem(key,beforeSteam);beforeSteam=null;}st.setItem(FIRE_TRIAL_SAVE_KEY,JSON.stringify(s));status='ready';return true;}catch{status='unavailable';return false;}},
 archive(){try{const st=storage(),raw=st.getItem(FIRE_TRIAL_SAVE_KEY);if(raw!==null){st.setItem(FIRE_TRIAL_BACKUP_KEY,raw);st.removeItem(FIRE_TRIAL_SAVE_KEY);}beforeSteam=null;status='empty';return true;}catch{status='unavailable';return false;}}
};}
