// 좌표·문제 순서만 저장한다. 장식 노드 번호를 새 메시로 옮기지 않는다.
import { LAMP_SPREADS,twinTarget,twinProfile } from './TwinShadowOptics.js';
export function silhouetteProgress(g, legacy) {
  const finite = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
  const validFields = (f, modern) => !!f && typeof f.held === 'boolean' && typeof f.solved === 'boolean'
    && Number.isInteger(f.round) && f.round >= 0 && f.round <= 3 && f.solved === (f.round === 3)
    && (!modern || !f.solved || !f.held)
    && Array.isArray(f.answers) && f.answers.length === 3 && new Set(f.answers).size === 3
    && f.answers.every(z => finite(z, g.wallZ + 1.2, g.lampZ - 1.2))
    && finite(f.objZ, g.wallZ + 1.2, g.lampZ - 1.2) && finite(f.holeW, 0.01, 100)
    && Math.abs(f.holeW - g._holeAt(f.answers[Math.min(f.round, 2)])) < 1e-7
    && (!modern || finite(f.dragOffset, -g.REACH, g.REACH));
  const twinFields=f=>{
    if(!f||typeof f.held!=='boolean'||typeof f.solved!=='boolean'||!Number.isInteger(f.round)||f.round<0||f.round>2||f.solved!==(f.round===2)||(f.solved&&f.held)||!Number.isInteger(f.spanIndex)||f.spanIndex<0||f.spanIndex>2||!Array.isArray(f.answers)||new Set(f.answers).size!==3||!f.answers.every(z=>finite(z,g.wallZ+1.2,g.lampZ-1.2))||!twinProfile(f.answers,g.lampZ)||!finite(f.objZ,g.wallZ+1.2,g.lampZ-1.2)||!finite(f.dragOffset,-g.REACH,g.REACH))return false;
    const target=twinTarget(f.answers,g.lampZ,g.wallZ,f.round);if(!finite(f.holeW,.01,100)||Math.abs(f.holeW-target.size)>1e-7)return false;
    if(f.solved){const scale=(g.lampZ-g.wallZ)/(g.lampZ-f.objZ);if(Math.abs(.9*scale-target.size)>=target.size*.09||Math.abs(LAMP_SPREADS[f.spanIndex]*(scale-1)-target.offset)>=.03)return false;}
    return true;
  };
  return {
    capture: () => ({ version:g.theatre?.mode==='twin'?3:2, fields: { held: g.held, solved: g.solved, round: g.round, answers: [...g.answers],
      objZ: g.objZ, holeW: g.holeW, dragOffset: g.dragOffset,...(g.theatre?.mode==='twin'?{spanIndex:g.spanIndex}:{}) } }),
    valid: s => !!s&&(s.version===3?twinFields(s.fields):validFields(s.fields,s.version===2)&&(s.version===2||(s.version===undefined&&legacy.valid(s)))),
    restore(s) {
      const f = s.fields;g.theatre.setMode(s.version===3?'twin':'legacy');Object.assign(g, { held: f.held && !f.solved, solved: f.solved, round: f.round,
        answers: [...f.answers], objZ: f.objZ, holeW: f.holeW, dragOffset: f.dragOffset ?? 0 });
      if(s.version===3)g.spanIndex=f.spanIndex;
      g.theatre.completed = g.solved;g.theatre.lastWheelUse=false;g.theatre.resize();g.theatre.onObjective?.();
    },
  };
}
