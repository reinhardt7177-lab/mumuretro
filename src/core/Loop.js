// 게임 루프 — step(dt)와 render() 분리. step은 rAF 없이 직접 호출 가능(블라인드 검증의 핵심).
export class Loop {
  constructor(step, render) {
    this.step = step;
    this.render = render;
    this.running = false;
    this._last = 0;
    this._raf = 0;
    this.maxDt = 1 / 20;   // 탭 숨김 등으로 dt가 튈 때 클램프
    this._tick = this._tick.bind(this);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }
  _tick(now) {
    if (!this.running) return;
    let dt = (now - this._last) / 1000;
    this._last = now;
    if (dt > this.maxDt) dt = this.maxDt;
    if (dt > 0) this.step(dt);
    this.render();
    this._raf = requestAnimationFrame(this._tick);
  }
}
