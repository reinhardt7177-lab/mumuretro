import { initialPhaseState } from './WaterPhases.js';
const num=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
const int=(x,a,b)=>Number.isInteger(x)&&num(x,a,b);
const bool=x=>typeof x==='boolean';
const arr=(x,n,f)=>Array.isArray(x)&&x.length===n&&x.every(f);
const clone=x=>JSON.parse(JSON.stringify(x));
const validState=(s,kind)=>s&&int(s.heat,0,kind==='condenser'?1:2)&&int(s.align,0,2)
  &&['freeze','cool','bridgeReady','completed'].every(k=>bool(s[k]))&&['plug','water','ice','tank'].every(k=>num(s[k],0,1))
  &&(!(s.ice>0)||s.water>=.98)&&(!(s.water>0)||s.plug===0)
  &&(!(s.tank>0)||s.water>=.98&&(kind!=='restore'||s.bridgeReady))
  &&(!(s.completed)|| (kind==='bridge'?s.ice>=.98:s.tank===1));

export function attachWaterPhaseProgress(room){
  room.hasProgress=false;room.checkpoint=null;room.legacyWater=null;
  const safeCheckpoint=()=>{
    const first=room.gates.find(g=>!g.solved),seg=first?first.gate.seg:room.shrineSeg;
    return {x:0,y:0,z:seg.z1-1.1,yaw:0};
  };
  room.captureCheckpoint=()=>{room.checkpoint=safeCheckpoint();};
  room.resume=actor=>{const p=room.checkpoint||safeCheckpoint();actor.setAt(p.x,p.z,-1,0);actor.camYaw=p.yaw;};
  room.finishWater=()=>{room.gates.forEach(g=>{g.solved=true;g.gate.state={...initialPhaseState(g.gate.kind),plug:0,water:1,ice:1,tank:1,bridgeReady:true,completed:true};g.gate.paint();room.dungeon.openDoor(g.room);});room.final.active=true;room.final.progress=1;room.prize.taken=true;room.prize.group.visible=false;room.court.setBridgeProgress(1);room.court.update(0,room.gates[2].gate.valves,true);room.hasProgress=true;};
  room.exportState=()=>{
    if(!room.hasProgress)return null;room.captureCheckpoint();
    return {version:2,tier:room.runTier,solved:room.gates.map(g=>g.solved),devices:room.gates.map(g=>clone(g.gate.state)),
      final:{active:room.final.active,progress:room.final.progress},prize:{taken:room.prize.taken,drop:room.prize.drop,t:room.prize.t},
      hints:Object.fromEntries(Object.entries(room.hints).map(([k,h])=>[k,{level:h.level,t:h.t}])),checkpoint:{...room.checkpoint},legacyWater:room.legacyWater};
  };
  const migrate=old=>{
    if(!old||old.version!==1||!int(old.tier,0,5)||!arr(old.solved,3,bool)
      ||old.solved.some((v,i)=>v&&old.solved.slice(0,i).some(x=>!x)))return null;
    if(!arr(old.freeze,3,b=>b&&num(b.base,3,5.7)&&['water','freezing','ice'].includes(b.phase)&&num(b.t,0,b.phase==='freezing'?1.2:b.base))
      ||!arr(old.holes,4,h=>h&&num(Math.abs(h.x),1.5,2.9)&&num(h.z,-200,20)&&num(h.r,1.3,1.75)))return null;
    const v=old.steam,f=old.final;
    if(!v||!int(v.ti,0,2)||!arr(v.wants,3,w=>['ice','water','steam'].includes(w))||new Set(v.wants).size!==3
      ||!arr(v.filled,3,bool)||!num(v.bridge,0,1)||(v.bridge>0&&!v.filled.some(Boolean))
      ||(old.solved[2]&&!v.filled.every(Boolean))||!f||!int(f.si,0,2)||!int(f.want,0,2)||!int(f.got,0,3)||!num(f.flash,0,.8)||(f.got>0&&!old.solved[2]))return null;
    const cp=old.checkpoint,p=old.prize;
    if(!cp||!num(cp.x,-12.5,12.5)||!num(cp.y,0,3)||!num(cp.z,room.shrineSeg.z0+.5,17.5)||!num(cp.yaw,-1e9,1e9)
      ||!p||!bool(p.taken)||!num(p.drop,-1,1)||!num(p.t,0,1e9)||((p.taken||p.drop>=0)&&f.got!==3)
      ||!old.hints||!Object.keys(room.hints).every(k=>old.hints[k]&&int(old.hints[k].level,0,k==='r3'||k==='shrine'?3:2)&&num(old.hints[k].t,0,1e9)))return null;
    const devices=room.gates.map((g,i)=>{const s=initialPhaseState(g.gate.kind);if(old.solved[i])Object.assign(s,{plug:0,water:1,ice:1,tank:1,bridgeReady:true,completed:true});return s;});
    // Credit old filled valves as completed phases, and retain the entire old
    // record for traceability. Old temporary timers cannot describe new equipment.
    if(!old.solved[2]&&v.filled.some(Boolean))Object.assign(devices[2],{plug:0,water:1,ice:1,bridgeReady:true,freeze:true,tank:v.filled.filter(Boolean).length>=2?.5:0});
    const hints=Object.fromEntries(Object.entries(room.hints).map(([k,h])=>[k,{level:Math.min(old.hints[k].level,h.texts.length),t:old.hints[k].t}]));
    return {version:2,tier:old.tier,solved:old.solved,devices,final:{active:f.got===3,progress:f.got===3?1:0},prize:old.prize,hints,
      checkpoint:{x:0,y:0,z:10,yaw:0},legacyWater:clone(old)};
  };
  room.importState=input=>{
    const s=input?.version===1?migrate(input):input;
    if(!s||s.version!==2||!int(s.tier,0,5)||!arr(s.solved,3,bool)||!arr(s.devices,3,(v,i)=>validState(v,room.gates[i].gate.kind))
      ||s.solved.some((v,i)=>v!==s.devices[i].completed||(v&&s.solved.slice(0,i).some(x=>!x))))return false;
    const f=s.final,p=s.prize,cp=s.checkpoint;
    if(!f||!bool(f.active)||!num(f.progress,0,1)||(f.progress>0&&!f.active)||((f.active||f.progress>0)&&!s.solved.every(Boolean))
      ||!p||!bool(p.taken)||!num(p.drop,-1,1)||!num(p.t,0,1e9)||((p.taken||p.drop>=0)&&f.progress!==1))return false;
    if(!cp||cp.x!==0||cp.y!==0||!num(cp.z,room.shrineSeg.z0+.5,17.5)||!num(cp.yaw,-1e9,1e9))return false;
    if(!s.hints||!Object.entries(room.hints).every(([k,h])=>s.hints[k]&&int(s.hints[k].level,0,h.texts.length)&&num(s.hints[k].t,0,1e9)))return false;
    if(s.legacyWater!=null&&!migrate(s.legacyWater))return false;
    // No mutations until every field (including any legacy backup) passed.
    room.restart();room.applyTier(s.tier);room.legacyWater=s.legacyWater?clone(s.legacyWater):null;
    room.gates.forEach((g,i)=>{g.gate.state=clone(s.devices[i]);g.gate.paint();g.solved=s.solved[i];if(g.solved)room.dungeon.openDoor(g.room);});
    room.final.active=f.active;room.final.progress=f.progress;room.final.update(0);
    Object.assign(room.prize,p);room.prize.group.visible=p.drop>=0&&!p.taken;room.prize.update(0);
    for(const [k,h] of Object.entries(room.hints)){Object.assign(h,s.hints[k]);h.board.set(h.level?`힌트 ${h.level}`:'힌트',h.level?h.texts[h.level-1]:'아직 잠겨 있다',!h.level);}
    room.court.setBridgeProgress(room.gates[2].gate.state.bridgeReady?1:0);room.court.update(0,room.gates[2].gate.valves,p.taken);
    room.hasProgress=true;room.captureCheckpoint();room.dungeon.update?.(2);return true;
  };
}
