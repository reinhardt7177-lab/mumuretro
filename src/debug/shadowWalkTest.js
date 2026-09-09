// 새 검사용 관문만 받는다. 실제 플레이 중인 등불·노출 시간은 건드리지 않는다.
export function checkShadowWalk(gate) {
  const failures = [], actor = { position: { x: gate.cx, z: gate.safeIn + 0.2 } };
  const check = (ok, label) => { if (!ok) failures.push(label); };
  let maxTipSpeed = 0, minLampGap = Infinity, maxAlignmentError = 0, visibleMisses = 0;
  for (let tier = 0; tier <= 5; tier++) {
    gate.setTier(tier);
    check(gate.speed <= 0.12 && gate.exposeMax >= 1.8, `단계 ${tier}: 조작 여유`);
  }
  for (let degree = 0; degree < 360; degree++) {
    gate.a = degree * Math.PI / 180;
    gate.update(0, actor);
    const lamp = gate._lampPos();
    for (const p of gate.pillars) {
      const dx = p.x - lamp.x, dz = p.z - lamp.z, distance = Math.hypot(dx, dz);
      minLampGap = Math.min(minLampGap, distance);
      const width = p.shadow.geometry.parameters.width, length = p.shadow.geometry.parameters.height;
      check(width >= 2.4, '그림자 폭');
      p.shadow.updateWorldMatrix(true, false);
      const point = (x, y) => p.shadow.localToWorld(p.mesh.position.clone().set(x, y, 0));
      const start = point(0, -length / 2), end = point(0, length / 2);
      const vx = end.x - start.x, vz = end.z - start.z;
      maxAlignmentError = Math.max(maxAlignmentError, Math.abs(vx * dz - vz * dx) / (length * distance));
      for (const x of [-width * 0.45, 0, width * 0.45]) {
        for (const y of [-length * 0.4, 0, length * 0.4]) {
          const v = point(x, y);
          if (!gate.inShadow(v.x, v.z, lamp)) visibleMisses++;
        }
      }
      const tipX = p.x + dx / distance * length, tipZ = p.z + dz / distance * length;
      const saved = gate.a;
      gate.a += gate.speed / 120;
      const next = gate._lampPos(); gate.a = saved;
      const nd = Math.hypot(p.x - next.x, p.z - next.z);
      maxTipSpeed = Math.max(maxTipSpeed, Math.hypot(
        p.x + (p.x - next.x) / nd * length - tipX,
        p.z + (p.z - next.z) / nd * length - tipZ) * 120);
    }
  }
  check(minLampGap >= 3, '등불이 기둥을 스침');
  check(maxTipSpeed <= 3.2, '그림자 끝이 걷기보다 빠름');
  check(maxAlignmentError < 1e-6 && visibleMisses === 0, '보이는 그림자와 안전 판정 불일치');
  // 빛에 잠깐 나가도 바로 실패하지 않고, 계속 서 있으면 여전히 발각된다.
  gate.a = 0; gate.speed = 0;
  const lamp = gate._lampPos();
  let exposed = null;
  for (let z = gate.safeOut + 0.5; z < gate.safeIn; z += 0.5) {
    for (let x = gate.seg.x0 + 0.5; x < gate.seg.x1; x += 0.5) {
      if (!gate.inShadow(x, z, lamp)) exposed = { position: { x, z } };
    }
  }
  check(!!exposed, '빛에 노출되는 구간 없음');
  if (exposed) {
    gate.reset();
    check(!gate.update(1.5, exposed).fail, '반응할 시간 부족');
    gate.update(0.7, actor);
    check(gate.expose < 0.01, '안전 구역에서 회복 안 됨');
    check(!!gate.update(1.9, exposed).fail, '빛에 계속 서 있어도 안 들킴');
  }
  gate.restart(); gate.setTier(0);
  return { failures: [...new Set(failures)], maxTipSpeed, minLampGap, maxAlignmentError, visibleMisses };
}
