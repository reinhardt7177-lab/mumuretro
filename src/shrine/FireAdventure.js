import * as THREE from 'three';
import {buildFireTrial} from './FireTrial.js';
import {createFireTrialState,validFireTrialState} from './FireTrialState.js';
import {FOUNDRY} from './FoundryState.js';

// The main game owns its reward/save; the workshop preview owns a separate save.
// A synchronous shell lets the existing save reader validate before assets arrive.
export function buildFireAdventure(spec,seed,buildLegacy){
 const scene=new THREE.Scene();scene.userData.lookProfile='fire';scene.background=new THREE.Color(spec.theme.bg);
 let pending=createFireTrialState(),legacyFire=null,world=null;
 const prize={taken:false,drop:-1,t:0,group:new THREE.Group()};
 const dungeon={rects:[],open:false,rectOf(){return null;},segmentAt(){return null;},openDoor(){},resetDoors(){}};
 const final={get held(){return world?.held;},get solved(){return world?.sanctum.awarded||false;}};
 const api={spec,seed,scene,dungeon,prize,final,gates:[],goals:{},hints:{},obstacles:[],runTier:0,hasProgress:false,fireAdventure:true,loading:true,error:null,
  get world(){return world;},applyTier(t){api.runTier=t;},restart(){pending=createFireTrialState();world?.restore(pending);prize.taken=false;},
  captureCheckpoint(actor){if(world&&actor)pending=world.snapshot(actor);},
  resume(actor){if(world)world.resume(actor);},
  exportState(actor){if(!api.hasProgress)return null;api.captureCheckpoint(actor);return {version:3,id:'fire',seed,tier:api.runTier,trial:structuredClone(pending),prize:{taken:prize.taken},legacyFire:structuredClone(legacyFire)};},
  importState(s){
   if(!s||s.id!=='fire'||s.seed!==seed||!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isInteger(s.tier)||s.tier<0||s.tier>5)return false;
   let next,original=null;
   if(s.version===1){
    const old=buildLegacy();if(!old.importState(s))return false;
    next=createFireTrialState();original=structuredClone(s);
    if(s.solved[0]){Object.assign(next.fracture,{stable:true,latched:true,visited:true,returned:true,checkpoint:'hub'});next.fracture.braces.forEach((b,i)=>b.slot=i);next.checkpoint='hub';}
    if(s.solved[1]){Object.assign(next.foundry,{channels:[0,0],fill:1,cooling:FOUNDRY.coolTime,solid:true,latched:true,visited:true,returned:true});next.checkpoint='hub';}
    if(s.solved[2]){Object.assign(next.steam,{diverter:'lift',bridgeLatched:true,liftLevel:'upper',rodeUp:true,upperReached:true,visited:true});next.checkpoint='steamUpper';}
    if(s.prize.taken){next.sanctum={version:1,phase:'exited',line:3,awards:1};next.checkpoint='exited';}
   }else if(s.version===3){
    if(!validFireTrialState(s.trial)||typeof s.prize?.taken!=='boolean'||s.prize.taken!==(s.trial.sanctum.phase==='exited'))return false;
    if(s.legacyFire!=null){const old=buildLegacy();if(!old.importState(s.legacyFire))return false;original=structuredClone(s.legacyFire);}
    next=structuredClone(s.trial);
   }else return false;
   if(!validFireTrialState(next))return false;
   pending=next;legacyFire=original;prize.taken=s.prize.taken;api.runTier=s.tier;api.hasProgress=true;api.migratedFire=s.version===1;world?.restore(pending);return true;
  },
  finishLegacy(){const old=buildLegacy();old.finishLegacy();old.applyTier(api.runTier);api.importState(old.exportState(null));},
  // Commit the exit and the reward atomically before the main game's save runs.
  finishReward(actor){if(!world?.sanctum.exited||prize.taken)return false;pending=world.snapshot(actor);prize.taken=true;return true;},
 };
 api.ready=buildFireTrial().then(w=>{world=w;scene.add(w.scene);dungeon.rects=w.rects;api.obstacles=w.obstacles;world.restore(pending);api.loading=false;return api;}).catch(e=>{api.loading=false;api.error=e;console.error('[fire] asset load failed',e);return api;});
 return api;
}
