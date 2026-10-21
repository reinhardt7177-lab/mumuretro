// One conserved parcel per room. Rendering and walkable surfaces read this state.
export const WATER_PHASES = ['ice', 'liquid', 'vapour'];
export const TRANSFORM_TIME = 0.85;
export function createWaterPacket(kind, seg) {
  const cz = (seg.z0 + seg.z1) / 2;
  const pos = kind === 'cycle' ? [0, 0, cz] : [kind==='flow'?4:-4, 0, seg.z1 - 4];
  return {phase:'liquid', mass:1, pos, zone:kind === 'cycle'?'bridge':'source', held:false,
    safety:false, bonus:false, completed:false, transition:null, motion:null};
}
export function beginWaterChange(s, heating) {
  if (s.transition || s.motion || s.completed) return false;
  const i = WATER_PHASES.indexOf(s.phase), next = i + (heating ? 1 : -1);
  if (next < 0 || next > 2) return false;
  s.transition = {from:s.phase, to:WATER_PHASES[next], t:0};
  return true;
}
export function routeWater(s, to, zone, duration=1.1, via=[]) {
  s.motion = {from:[...s.pos], to:[...to], zone, t:0, duration, via};
  s.held = false;
}
export function waterMotionPoint(m, t) {
  const points=[m.from,...(m.via||[]),m.to],lengths=points.slice(1).map((p,i)=>Math.hypot(...p.map((v,k)=>v-points[i][k])));
  let distance=Math.max(0,Math.min(1,t))*lengths.reduce((a,b)=>a+b,0);
  for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]||i===lengths.length-1){const f=lengths[i]?Math.min(1,distance/lengths[i]):1;return points[i].map((v,k)=>v+(points[i+1][k]-v)*f);}distance-=lengths[i];}
  return [...m.to];
}
export function advanceWater(s, kind, seg, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const cz=(seg.z0+seg.z1)/2;
  if (s.transition) {
    const change=s.transition; change.t=Math.min(TRANSFORM_TIME,change.t+dt);
    if (change.t >= TRANSFORM_TIME) {
      s.phase=change.to; s.transition=null;
      if (s.phase!=='ice') s.held=false;
      if (s.phase==='vapour') {
        const inConduit=kind==='cycle'&&s.zone==='bowl';
        routeWater(s, inConduit?[4,4.7,cz-7.2]:[s.pos[0],s.pos[1]+3,s.pos[2]], inConduit?'collector':'cloud',1.25,
          inConduit?[[-2.9,2.7,cz-2.4],[0,4.8,cz-4]]:[]);
      } else if (s.phase==='liquid') {
        if (kind==='flow' && s.pos[1]>=1.25 && Math.abs(s.pos[0]+4.5)<2 && Math.abs(s.pos[2]-(cz+.6))<2.1) {
          routeWater(s,[-4.5,0,cz-4.2],'receiver',1.25,[[-4.5,1.55,cz-.8],[-4.5,1.2,cz-2],[-4.5,.65,cz-3.2]]);
        } else if (kind==='cycle' && change.from==='ice' && s.zone==='bridge') {
          routeWater(s,[-2.9,-1.5,cz-2.4],'bowl');
        } else if (kind==='cycle' && s.zone==='collector') {
          routeWater(s,[4,2.5,cz-9.3],'altar',.65,[[4,3.5,cz-8.2]]);
        } else if (kind==='cycle' && s.zone==='cloud') {
          routeWater(s,[0,0,cz],'bridge',.65);
        } else if (change.from==='vapour') {
          routeWater(s,[s.pos[0],Math.max(0,s.pos[1]-3),s.pos[2]],'loose',.65);
        } else if (s.zone==='held') {
          // The caller supplies the floor below the carrier before melting.
          s.zone='loose';
        }
      }
    }
  } else if (s.motion) {
    const m=s.motion; m.t=Math.min(m.duration,m.t+dt); const t=m.t/m.duration;
    s.pos=waterMotionPoint(m,t);
    if (m.t>=m.duration) {s.pos=[...m.to];s.zone=m.zone;s.motion=null;}
  }
}
export function stableWaterSnapshot(s, fallback) {
  const saved=JSON.parse(JSON.stringify(s));
  // Persist an unambiguous phase/endpoint, never a half-built collision surface.
  if (saved.motion) {saved.pos=[...saved.motion.to];saved.zone=saved.motion.zone;}
  if (saved.held) {saved.pos=[...fallback];saved.zone='loose';saved.held=false;}
  saved.transition=null;saved.motion=null;
  return saved;
}
export function validWaterPacket(s, kind, seg) {
  const zones=kind==='carry'?['source','loose','cloud','held']:kind==='flow'?['source','loose','feeder','receiver','cloud','held']:['bridge','bowl','collector','altar','cloud'];
  return !!s && WATER_PHASES.includes(s.phase) && s.mass===1 && zones.includes(s.zone)
    && Array.isArray(s.pos)&&s.pos.length===3&&s.pos.every(Number.isFinite)
    && Math.abs(s.pos[0])<=seg.x1-.6&&s.pos[1]>=-1.6&&s.pos[1]<=6
    && s.pos[2]>=seg.z0+.4&&s.pos[2]<=seg.z1-.4
    && ['held','safety','bonus','completed'].every(k=>typeof s[k]==='boolean')
    && !s.held && s.zone!=='held' && !s.transition && !s.motion
    && !(s.zone==='cloud'&&s.phase!=='vapour')
    && !(s.zone==='collector'&&s.phase!=='vapour')
    && !(s.completed&&kind==='flow'&&(s.zone!=='receiver'||s.phase!=='liquid'))
    && !(s.completed&&kind==='cycle'&&(s.zone!=='altar'||s.phase!=='liquid'));
}
