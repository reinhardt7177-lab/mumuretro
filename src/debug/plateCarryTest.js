// 새로 만든 검사용 PlateGate만 받는다. 진행 중인 방의 주문·상자를 건드리지 않는다.
export function checkPlateCarry(gate) {
  const failures = [];
  let checks = 0;
  const check = (ok, label) => { checks++; if (!ok) failures.push(label); };
  const pick = (box) => {
    check(gate.interact(box.home) && gate.held === box, '바닥 상자 들기');
  };
  const release = (pos, box, label) => {
    check(gate.prompt(pos)?.startsWith('E —'), `${label}: E 안내`);
    check(gate.interact(pos) && !gate.held && !box.taken
      && box.mesh.position.equals(box.home), `${label}: 원위치 반환`);
  };
  const [box, neighbor] = gate.stock;
  pick(box);
  release(neighbor.home, box, '옆 상자 앞');
  pick(box);
  const center = { x: 0, z: gate.plates[0].z };
  release(center, box, '두 판 사이');
  // 두 판 모두 올리기 → 다시 들기 → 반환. 무게 합계와 중복 소유도 확인한다.
  for (const plate of gate.plates) {
    pick(box);
    check(gate.prompt(plate)?.startsWith('E — 판에 올리기'), '판 올리기 안내');
    check(gate.interact(plate) && !gate.held && plate.boxes.includes(box), '판에 올리기');
    check(gate.interact(plate) && gate.held === box && !plate.boxes.includes(box), '판에서 다시 들기');
    release(center, box, '판에서 회수한 상자');
    check(gate._sum(plate) === 0, '반환 뒤 판 무게 0');
  }
  // 판과 바닥 상자의 선택 범위가 겹쳐도 놓을 판을 고른다.
  pick(box);
  const plate = gate.plates[0];
  neighbor.home.set(plate.x, neighbor.home.y, plate.z + 2.4);
  const overlap = { x: plate.x, z: plate.z + 2.3 };
  check(gate.prompt(overlap)?.startsWith('E — 판에 올리기'), '겹친 범위의 판 안내');
  check(gate.interact(overlap) && !gate.held && plate.boxes.includes(box), '옆 상자가 판을 가로채지 않음');
  return { checks, failures };
}
