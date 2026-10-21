import { createWaterPacket, validWaterPacket } from './WaterAdventureState.js';
const clone=v=>JSON.parse(JSON.stringify(v));
const num=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
const int=(v,a,b)=>Number.isInteger(v)&&num(v,a,b);
const bool=v=>typeof v==='boolean';
const arr=(v,n,test)=>Array.isArray(v)&&v.length===n&&v.every(test);
const ordered=v=>arr(v,3,bool)&&!v.some((done,i)=>done&&v.slice(0,i).some(x=>!x));
function validCommon(s,room){const p=s?.prize,f=s?.final;
  return int(s?.tier,0,5)&&ordered(s.solved)&&p&&bool(p.taken)&&num(p.drop,-1,1)&&num(p.t,0,1e9)
    &&f&&bool(f.active)&&num(f.progress,0,1)&&!(f.progress>0&&!f.active)&&!((f.active||f.progress>0)&&!s.solved.every(Boolean))
    &&!((p.taken||p.drop>=0)&&f.progress!==1)&&s.hints&&Object.entries(room.hints).every(([k,h])=>s.hints[k]&&int(s.hints[k].level,0,h.texts.length)&&num(s.hints[k].t,0,1e9));
}
function validOld(s,room){
  if(s?.version===2){
    const kinds=['bridge','condenser','restore'];
    const valid=arr(s.devices,3,(d,i)=>d&&int(d.heat,0,i===1?1:2)&&int(d.align,0,2)
      &&['freeze','cool','bridgeReady','completed'].every(k=>bool(d[k]))&&['plug','water','ice','tank'].every(k=>num(d[k],0,1))
      &&!(d.ice>0&&d.water<.98)&&!(d.water>0&&d.plug!==0)
      &&!(d.tank>0&&(d.water<.98||(kinds[i]==='restore'&&!d.bridgeReady)))
      &&!(d.completed&&(i===0?d.ice<.98:d.tank!==1)))
      &&ordered(s.solved)&&s.devices.every((d,i)=>d.completed===s.solved[i]);
    const c=s.checkpoint;
    return valid&&validCommon(s,room)&&c&&c.x===0&&c.y===0&&num(c.z,-140,17.5)&&num(c.yaw,-1e9,1e9)
      &&(s.legacyWater==null||s.legacyWater.version===1&&validOld(s.legacyWater,room));
  }
  if(s?.version!==1||!int(s.tier,0,5)||!ordered(s.solved))return false;
  const f=s.final,p=s.prize,c=s.checkpoint,v=s.steam;
  return arr(s.freeze,3,d=>d&&num(d.base,3,5.7)&&['water','freezing','ice'].includes(d.phase)&&num(d.t,0,d.phase==='freezing'?1.2:d.base))
    &&arr(s.holes,4,d=>d&&num(Math.abs(d.x),1.5,2.9)&&num(d.z,-200,20)&&num(d.r,1.3,1.75))
    &&v&&int(v.ti,0,2)&&arr(v.wants,3,w=>['ice','water','steam'].includes(w))&&new Set(v.wants).size===3&&arr(v.filled,3,bool)&&num(v.bridge,0,1)
    &&!(v.bridge>0&&!v.filled.some(Boolean))&&!(s.solved[2]&&!v.filled.every(Boolean))
    &&f&&int(f.si,0,2)&&int(f.want,0,2)&&int(f.got,0,3)&&num(f.flash,0,.8)&&!(f.got>0&&!s.solved[2])
    &&p&&bool(p.taken)&&num(p.drop,-1,1)&&num(p.t,0,1e9)&&!((p.taken||p.drop>=0)&&f.got!==3)
    &&c&&num(c.x,-13,13)&&num(c.y,0,3)&&num(c.z,-140,17.5)&&num(c.yaw,-1e9,1e9)
    &&s.hints&&Object.keys(room.hints).every(k=>s.hints[k]&&int(s.hints[k].level,0,3)&&num(s.hints[k].t,0,1e9));
}
function completedPacket(g){const s=createWaterPacket(g.kind,g.seg),c=(g.seg.z0+g.seg.z1)/2;s.completed=true;
  if(g.kind==='carry'){s.phase='ice';s.zone='loose';s.pos=[0,0,g.ledge.z+2.8];}
  if(g.kind==='flow'){s.zone='receiver';s.pos=[-4.5,0,c-4.2];}
  if(g.kind==='cycle'){s.safety=true;s.zone='altar';s.pos=[4,2.5,c-9.3];}
  return s;
}
export function attachWaterAdventureProgress(room){
  room.hasProgress=false;room.checkpoint=null;room.legacyWater=null;room.migratedWater=false;
  const safeCheckpoint=()=>{const first=room.gates.find(g=>!g.solved),seg=first?first.gate.seg:room.shrineSeg;return {x:0,y:0,z:seg.z1-1.3,yaw:0};};
  room.captureCheckpoint=()=>{room.checkpoint=safeCheckpoint();};
  room.resume=actor=>{const p=room.checkpoint||safeCheckpoint();actor.setAt(p.x,p.z,-1,p.y);actor.camYaw=p.yaw;};
  room.finishWater=()=>{room.world.bracelet=true;for(const g of room.gates){g.solved=true;g.gate.state=completedPacket(g.gate);g.gate.paint();room.dungeon.openDoor(g.room);}room.dungeon.update(2);room.final.active=true;room.final.progress=1;room.prize.taken=true;room.prize.group.visible=false;room.hasProgress=true;};
  room.exportState=()=>{if(!room.hasProgress)return null;room.captureCheckpoint();return {version:3,tier:room.runTier,bracelet:room.world.bracelet,
    solved:room.gates.map(g=>g.solved),devices:room.gates.map(g=>g.gate.snapshot()),final:{active:room.final.active,progress:room.final.progress},
    prize:{taken:room.prize.taken,drop:room.prize.drop,t:room.prize.t},hints:Object.fromEntries(Object.entries(room.hints).map(([k,h])=>[k,{level:h.level,t:h.t}])),
    checkpoint:{...room.checkpoint},legacyWater:room.legacyWater?clone(room.legacyWater):null};};
  room.importState=input=>{
    let s=input,migrated=false;
    if(input?.version===1||input?.version===2){
      if(!validOld(input,room))return false;
      const done=input.version===1?input.final.got===3:input.final.progress===1;
      s={version:3,tier:input.tier,bracelet:input.solved.some(Boolean),solved:[...input.solved],
        devices:room.gates.map((g,i)=>input.solved[i]?completedPacket(g.gate):createWaterPacket(g.gate.kind,g.gate.seg)),
        final:{active:done,progress:done?1:0},prize:clone(input.prize),hints:Object.fromEntries(Object.entries(room.hints).map(([k,h])=>[k,{level:Math.min(h.texts.length,input.hints[k].level),t:input.hints[k].t}])),
        checkpoint:{x:0,y:0,z:10,yaw:0},legacyWater:clone(input)};migrated=true;
    }
    if(!s||s.version!==3||!validCommon(s,room)||!bool(s.bracelet)||s.solved.some(Boolean)&&!s.bracelet
      ||!arr(s.devices,3,(v,i)=>validWaterPacket(v,room.gates[i].gate.kind,room.gates[i].gate.seg))
      ||s.devices.some((v,i)=>v.completed!==s.solved[i])
      ||!s.bracelet&&s.devices.some((v,i)=>{const initial=createWaterPacket(room.gates[i].gate.kind,room.gates[i].gate.seg);return v.phase!=='liquid'||v.safety||v.bonus||v.zone!==initial.zone||v.pos.some((p,k)=>p!==initial.pos[k]);})
      ||!(s.final.progress===0||s.final.progress===1)||s.final.active!==(s.final.progress===1)
      ||s.legacyWater!=null&&!validOld(s.legacyWater,room))return false;
    const cp=s.checkpoint;if(!cp||cp.x!==0||cp.y!==0||!num(cp.z,room.shrineSeg.z0+.5,17.5)||!num(cp.yaw,-1e9,1e9))return false;
    // Reject all malformed data before touching live geometry, doors or prizes.
    const saved=clone(s);room.restart();room.applyTier(saved.tier);room.world.bracelet=saved.bracelet;
    room.legacyWater=saved.legacyWater;room.migratedWater=migrated;
    room.gates.forEach((g,i)=>{g.gate.state=saved.devices[i];g.gate.paint();g.solved=saved.solved[i];if(g.solved)room.dungeon.openDoor(g.room);});room.dungeon.update(2);
    room.final.active=saved.final.active;room.final.progress=saved.final.progress;Object.assign(room.prize,saved.prize);room.prize.group.visible=room.prize.drop>=0&&!room.prize.taken;room.prize.update(0);
    for(const [k,h] of Object.entries(room.hints)){Object.assign(h,saved.hints[k]);h.board.set(h.level?`힌트 ${h.level}`:'물의 기록',h.level?h.texts[h.level-1]:'팔찌의 힌트 버튼으로 펼치기',!h.level);}
    room.hasProgress=true;room.captureCheckpoint();return true;
  };
}
