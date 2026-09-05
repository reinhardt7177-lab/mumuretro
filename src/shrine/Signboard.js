// 방마다 걸리는 판 둘 — 왼쪽 벽에 **목표**, 오른쪽 벽에 **힌트**.
//
// ★ 실사용에서 들은 말: "게임의 설명도 없고 어떤 걸 해결해야 하는지도 없다."
//   맞는 말이었다. 프롬프트는 **가까이 갔을 때** 무엇을 누를 수 있는지만 알려 준다.
//   그건 조작 안내지 목표가 아니다. 방에 들어선 아이가 가장 먼저 알아야 할 것은
//   "여기서 무엇을 해내야 하는가"인데, 그걸 말해 주는 것이 아무 데도 없었다.
//
// 힌트 판은 처음엔 꺼져 있다. 헤매는 시간이 쌓여야 켜지고, 더 헤매면 한 단계
// 더 밝아진다. **답은 절대 주지 않는다** — 어디를 봐야 하는지만 말한다.
// 답을 주면 그 순간 이 방은 문제가 아니라 버튼이 된다.
//
// 글씨는 캔버스 텍스처다. 3D에 한글을 넣는 가장 싼 방법이고,
// 폴리곤이 판 한 장뿐이라 로우폴리 예산에 영향이 없다.
import * as THREE from 'three';

const PX = 512, PY = 160;          // 텍스처 해상도
const W = 3.4, H = 1.06;           // 판 크기(u)

// 한글은 단어 단위로 자르면 줄이 들쭉날쭉해진다. 글자 수로 접는다.
function wrap(ctx, text, maxW) {
  const out = [];
  let line = '';
  for (const ch of text) {
    if (ch === '\n') { out.push(line); line = ''; continue; }
    const t = line + ch;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = ch; }
    else line = t;
  }
  if (line) out.push(line);
  return out;
}

function paint(cv, title, body, glowHex, dim) {
  const c = cv.getContext('2d');
  c.fillStyle = dim ? '#0a0f12' : '#0d1418';
  c.fillRect(0, 0, PX, PY);
  const glow = '#' + glowHex.toString(16).padStart(6, '0');
  c.strokeStyle = dim ? '#2a3238' : glow;
  c.lineWidth = 4;
  c.strokeRect(6, 6, PX - 12, PY - 12);

  c.textBaseline = 'top';
  c.fillStyle = dim ? '#3c464c' : glow;
  c.font = '600 27px "Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif';
  c.fillText(title, 24, 20);

  c.fillStyle = dim ? '#333c42' : '#dfe9ea';
  c.font = '400 24px "Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif';
  wrap(c, body, PX - 48).slice(0, 3).forEach((l, i) => c.fillText(l, 24, 62 + i * 31));
}

// side: -1이면 왼쪽 벽(방 안쪽 +x를 봄), +1이면 오른쪽 벽(−x를 봄).
// 걸어 들어오면 목표는 왼쪽에, 힌트는 오른쪽에 눈높이로 지나간다.
// 안쪽 벽에 걸면 읽는 동안 이미 관문 한가운데다.
export function addBoard(scene, seg, side, title, body, glowHex, dim = false) {
  const cv = document.createElement('canvas');
  cv.width = PX; cv.height = PY;
  paint(cv, title, body, glowHex, dim);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  mat.userData.outlineParameters = { visible: false };

  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat));
  // 뒤판 — 벽에서 살짝 띄워 두께를 준다. 판이 벽에 그려진 그림이 아니라
  // **걸린 물건**으로 보여야 "읽을 것"으로 읽힌다.
  const back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.16, H + 0.16, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x1a262c }));
  back.material.userData.outlineParameters = { visible: false };
  back.position.z = -0.07;
  g.add(back);

  g.position.set(side < 0 ? seg.x0 + 0.36 : seg.x1 - 0.36, 2.35, seg.z1 - 2.6);
  g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(g);

  return {
    group: g,
    set(t, b, d = false) { paint(cv, t, b, glowHex, d); tex.needsUpdate = true; },
  };
}
