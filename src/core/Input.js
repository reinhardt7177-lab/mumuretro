// 입력 — 키보드 + 마우스 드래그(시점) + 터치 조이스틱(이동)/드래그(시점). 테스트용 intent 주입 지원.
import { clamp } from '../util/math.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.camPitch = 0.5;     // 절대 피치(라디안)
    this.camDist = 9;        // 절대 거리
    this.intent = { x: 0, y: 0, run: false, action: false, jump: false };
    this._yawDelta = 0;      // 프레임당 누적 → consumeYaw로 소비
    this._action = false;
    this._jump = false;
    this._holdJump = false;      // 모바일 점프 버튼을 누르고 있는 동안 true(활공)
    this._test = null;
    this._touchMove = { active: false, x: 0, y: 0 };

    addEventListener('keydown', e => {
      if (e.repeat) return;                 // 누르고 있어도 점프는 한 번만
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      // Space는 점프 전용. 예전엔 배달도 겸했는데 그대로 두면 뛸 때마다 배달이 나간다.
      if (e.code === 'Space') this._jump = true;
      if (e.code === 'KeyE') this._action = true;
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });

    // 마우스 드래그 = 시점 회전
    let drag = false, lx = 0, ly = 0;
    canvas.addEventListener('mousedown', e => { drag = true; lx = e.clientX; ly = e.clientY; });
    addEventListener('mouseup', () => { drag = false; });
    addEventListener('mousemove', e => {
      if (!drag) return;
      this._yawDelta -= (e.clientX - lx) * 0.005;   // 좌우 반전
      this.camPitch = clamp(this.camPitch + (e.clientY - ly) * 0.004, 0.12, 1.3);   // 상하 반전
      lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener('wheel', e => {
      this.camDist = clamp(this.camDist + e.deltaY * 0.01, 5, 20);
      e.preventDefault();
    }, { passive: false });

    this._initTouch(canvas);
  }

  // 화면 왼쪽 절반 = 이동 조이스틱, 오른쪽 절반 = 시점 드래그.
  _initTouch(canvas) {
    const move = this._touchMove;
    let moveId = null, lookId = null, ox = 0, oy = 0, llx = 0, lly = 0;
    const R = 60; // 조이스틱 반경(px)
    canvas.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth / 2 && moveId === null) {
          moveId = t.identifier; ox = t.clientX; oy = t.clientY; move.active = true; move.x = move.y = 0;
        } else if (lookId === null) {
          lookId = t.identifier; llx = t.clientX; lly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) {
          move.x = clamp(-(t.clientX - ox) / R, -1, 1);   // 좌우 반전(키보드와 일치)
          move.y = clamp(-(t.clientY - oy) / R, -1, 1);
        } else if (t.identifier === lookId) {
          this._yawDelta -= (t.clientX - llx) * 0.006;   // 좌우 반전
          this.camPitch = clamp(this.camPitch + (t.clientY - lly) * 0.005, 0.12, 1.3);   // 상하 반전
          llx = t.clientX; lly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) { moveId = null; move.active = false; move.x = move.y = 0; }
        if (t.identifier === lookId) lookId = null;
      }
    };
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
  }

  // 테스트: {x,y,run,action} 강제. null이면 해제.
  setTestIntent(i) { this._test = i; }

  consumeYaw() { const d = this._yawDelta; this._yawDelta = 0; return d; }

  // 모바일 점프 버튼 등 외부 트리거용.
  requestJump() { this._jump = true; }
  // 터치 버튼용. 키보드의 E와 같은 자리로 들어간다 —
  // 조작 경로를 둘로 나누면 한쪽만 고쳐지는 일이 반드시 생긴다.
  requestAction() { this._action = true; }
  setHoldJump(on) { this._holdJump = !!on; }

  poll() {
    if (this._test) { this.intent = { x: 0, y: 0, run: false, action: false, jump: false, jumpHeld: false, ...this._test }; return this.intent; }
    let x = 0, y = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) y += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) y -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x -= 1;   // 좌우 반전
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x += 1;    // 좌우 반전
    if (this._touchMove.active) { x += this._touchMove.x; y += this._touchMove.y; }
    x = clamp(x, -1, 1); y = clamp(y, -1, 1);
    const run = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const action = this._action; this._action = false;
    const jump = this._jump; this._jump = false;
    // 누르고 있는 상태 — 활공 판정에 쓴다(모바일 버튼은 _holdJump로 대체).
    const jumpHeld = !!this.keys['Space'] || this._holdJump;
    this.intent = { x, y, run, action, jump, jumpHeld };
    return this.intent;
  }
}
