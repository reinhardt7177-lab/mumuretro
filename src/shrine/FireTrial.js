import * as T from 'three';
import {buildFireFracture} from './FireFracture.js';
import {buildFireFoundry} from './FireFoundry.js';
import {validFireTrialState} from './FireTrialState.js';
import {FRACTURE} from './FractureState.js';
import {FOUNDRY} from './FoundryState.js';
import {buildFireSteam} from './FireSteam.js';
import {STEAM} from './SteamState.js';
import {buildFireSanctum} from './FireSanctum.js';

// Composition keeps the tested first-room mechanics available for regression checks.
export async function buildFireTrial(){
 const [first,foundry,steam,sanctum]=await Promise.all([buildFireFracture(),buildFireFoundry(),buildFireSteam(),buildFireSanctum()]);first.scene.add(foundry.root,steam.root,sanctum.root);first.nextSign.visible=false;
 const oldFloor=first.rects.floorAt,rects=[...first.rects,...foundry.rects,...steam.rects,...sanctum.rects],obstacles=[...first.obstacles,...foundry.obstacles,...steam.obstacles,...sanctum.obstacles];rects.floorAt=(x,z,y=0)=>z<-40.1&&y>2.8?3.2:Math.abs(x)<13&&z<-10.4?steam.floorAt(x,z,y):x>18?foundry.floorAt(x,z):oldFloor(x,z);rects.ceilingAt=steam.ceilingAt;rects.cameraOccluders=[...first.rects.cameraOccluders,...foundry.cameraOccluders,...steam.cameraOccluders,...sanctum.cameraOccluders];rects.cameraLiftZones=[...first.rects.cameraLiftZones,foundry.rects[1],steam.rects[1],sanctum.rects[1]];rects.cameraLookHeightZones=[{...foundry.rects[1],lookHeight:2.05},{...sanctum.rects[1],lookHeight:1.65}];
 const active=actor=>actor.position.x>18;
 const inSteam=a=>a.position.z<-17&&Math.abs(a.position.x)<13;
 const contains=(x,z,y=0)=>sanctum.exited?Math.abs(x)<3.5&&z>22&&z<33:first.contains(x,z)||foundry.contains(x,z)&&(x<15.4||first.mechanics.state.returned&&foundry.gateOpen>.98)||steam.contains(x,z,y)&&(z>-13.9||foundry.mechanics.state.returned&&steam.gateOpen>.98)||steam.mechanics.state.upperReached&&sanctum.contains(x,z,y);
 function animate(dt,actor){if(!sanctum.frozen&&!sanctum.exited){first.animate(dt,actor);foundry.animate(dt,actor,first.mechanics.state.returned);steam.animate(dt,actor,foundry.mechanics.state.returned);}steam.futureGate.position.y=3.2+(steam.mechanics.state.upperReached?4.3:0);sanctum.animate(dt,actor,[first.mechanics.state.returned,foundry.mechanics.state.returned,steam.mechanics.state.upperReached]);}
 function checkpoint(actor){const x=actor.position.x,z=actor.position.z;if(inSteam(actor)&&steam.mechanics.state.visited)return steam.checkpoint(actor);if(x>18&&foundry.mechanics.state.visited)return foundry.mechanics.state.solid&&z<-4?'foundryFar':'foundryNear';if(x<-18&&first.mechanics.state.visited)return first.mechanics.state.stable&&z<-4?'fractureFar':'fractureNear';return first.mechanics.state.returned?'hub':first.mechanics.state.visited?'fractureNear':'entry';}
 function snapshot(actor){return {version:3,fracture:first.mechanics.snapshot(),foundry:foundry.mechanics.snapshot(),steam:steam.mechanics.snapshot(),sanctum:sanctum.mechanics.snapshot(),checkpoint:sanctum.exited?'exited':actor.position.z<-40.1||sanctum.frozen?'sanctum':checkpoint(actor)};}
 let savedCheckpoint='entry';
 function restore(s){if(!validFireTrialState(s))return false;first.mechanics.restore(s.fracture);foundry.mechanics.restore(s.foundry);steam.mechanics.restore(s.steam);sanctum.mechanics.restore(s.sanctum);savedCheckpoint=s.checkpoint;return true;}
 function resume(actor){const p={entry:FRACTURE.entry,fractureNear:FRACTURE.near,fractureFar:FRACTURE.far,hub:steam.mechanics.state.visited?[0,-8]:foundry.mechanics.state.returned?FOUNDRY.hub:FRACTURE.hub,foundryNear:FOUNDRY.near,foundryFar:FOUNDRY.far,steamNear:STEAM.near,steamFar:STEAM.far,steamUpper:STEAM.upper,sanctum:[0,-48.5],exited:FRACTURE.entry}[savedCheckpoint];actor.setAt(...p,savedCheckpoint.endsWith('Far')?1:-1,['steamUpper','sanctum'].includes(savedCheckpoint)?3.2:0);animate(0,actor);}
 function target(actor){return steam.mechanics.state.upperReached?sanctum.target():foundry.mechanics.state.returned?steam.target():first.mechanics.state.returned?foundry.target():first.target(actor);}
 function guidePoints(actor){const p=actor.position,t=target(actor).point,points=[p.clone().add(new T.Vector3(0,.10,0))],add=(x,z,y=.10)=>points.push(new T.Vector3(x,y,z));
  if(p.x<-18&&t.x>=-18){if(p.z<-3){add(-28,-4);add(-28,4);}add(-28,8);add(-20,8);add(-10,8);}
  if(p.x>18&&t.x<=18){if(p.z<-3){add(28,-4);add(28,4);}add(28,8);add(20,8);add(10,8);}
  if(p.z>12&&Math.abs(p.x)<5)add(0,8);
  if(t.z<-17&&Math.abs(t.x)<13){if(p.z>=-17){add(0,-8);add(0,-19);}if(steam.mechanics.moving){add(7,-31.2,steam.mechanics.height+.1);return points;}if(t.y>2.7&&p.y<2.7){if(p.z>-30){add(0,-23);add(0,-31.2);}const q=steam.mechanics.state.liftLevel==='upper'?STEAM.lowerCall:STEAM.lift;add(q[0],q[1]);return points;}if(t.y>2.7){if(p.z>-33)add(7,-34.5,3.3);if(p.z>-37)add(0,-35.5,3.3);}else if(t.z<-30&&p.z>-30){add(0,-23);add(0,-31.2);}else if(p.z<-30&&t.z>-24){add(0,-31.2);add(0,-23);}points.push(t.clone().add(new T.Vector3(0,.1,0)));return points;}
  if(t.x<-18&&p.x>=-18){if(p.x>-8)add(-8,8);add(-20,8);}
  if(t.x>18&&p.x<=18){if(p.x<8)add(8,8);add(20,8);}
  for(const side of [-1,1]){const centre=side*28,inWing=p.x*side>18,toWing=t.x*side>18;if(!toWing)continue;if(t.z<-3&&(!inWing||p.z>3)){add(centre,4.2);add(centre,-4.2);}else if(inWing&&p.z<-3&&t.z>3){add(centre,-4.2);add(centre,4.2);}}
  points.push(t.clone().setY(.10));return points;
 }
 return {...first,foundry,steam,sanctum,rects,obstacles,contains,animate,snapshot,restore,resume,target,guidePoints,
  afterMove(actor){first.afterMove(actor);foundry.afterMove(actor);steam.afterMove(actor);},
  interact(actor){if(sanctum.frozen||actor.position.z<-40.1)return sanctum.interact(actor);return inSteam(actor)&&foundry.mechanics.state.returned?steam.interact(actor):active(actor)&&first.mechanics.state.returned?foundry.interact(actor):first.interact(actor);},
  recover(actor){if(sanctum.frozen||sanctum.exited)return;if(actor.position.z<-40.1){actor.setAt(0,-48.5,-1,3.2);return;}return inSteam(actor)?steam.recover(actor):active(actor)?foundry.recover(actor):first.recover(actor);},
  get falls(){return first.falls+foundry.falls+steam.falls;},get held(){return first.held;},get message(){return steam.message||foundry.message||first.message;},
  get dirty(){return first.mechanics.changed||foundry.mechanics.changed||steam.mechanics.changed||sanctum.mechanics.changed;},clearDirty(){first.mechanics.changed=foundry.mechanics.changed=steam.mechanics.changed=sanctum.mechanics.changed=false;},
  prompt(actor){return actor.position.z<-40.1?sanctum.prompt(actor):inSteam(actor)?steam.prompt(actor):active(actor)?foundry.prompt(actor):first.prompt(actor);},
  hint(actor){return steam.mechanics.state.upperReached?'상층 통로 북쪽의 전당으로 들어가 수호자에게 말을 걸어 보자.':foundry.mechanics.state.returned?steam.hint():first.mechanics.state.returned?foundry.hint():first.hint();},
  record(actor){if(sanctum.awarded)return '받침으로 다리를 고정하고, 용암을 굳혀 길을 만들었다. 증기의 동력을 나누어 상층 전당에 도착했다. 불꽃 수호자가 건넨 지혜를 이 수첩에 남긴다.';if(steam.mechanics.state.visited)return steam.record();if(active(actor)||foundry.mechanics.state.visited)return foundry.record();const s=first.mechanics.state;return s.latched?'두 받침으로 고정하고 시험했다. 다리를 건너 잠그자 오른쪽 주조실 문이 열렸다.':s.stable?'시험을 마치자 다리가 안정되었다. 이제 건너편에서 잠가야 한다.':first.mechanics.seated?'받침을 끼운 쪽의 움직임이 줄었다. 반대쪽과 시험 결과를 더 살펴보자.':'빈 고정구와 받침이 보인다. 시험 손잡이로 어느 부분이 움직이는지 살펴보자.';},
  stages(){const f=first.mechanics.state,s=foundry.mechanics.state,t=steam.mechanics.state;return s.returned?[['동력',t.diverter!=='off'],['잠금',t.bridgeLatched],['탑승',t.rodeUp],['도착',t.upperReached]]:f.returned?[['연결',foundry.mechanics.connected],['채우기',s.fill===1],['굳히기',s.solid],['횡단',s.latched]]:[['관찰',f.visited],['고정',first.mechanics.seated===2],['시험',f.stable],['횡단',f.latched]];},
  completion(){return sanctum.exited?4:steam.mechanics.state.upperReached?3:foundry.mechanics.state.returned&&!steam.mechanics.state.visited?2:first.mechanics.state.returned&&!foundry.mechanics.state.visited?1:0;},
  setLow(on){foundry.setLow(on);steam.setLow(on);sanctum.setLow(on);}
 };
}
