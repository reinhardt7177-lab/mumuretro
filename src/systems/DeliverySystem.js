// 배달 루프 — 실패/타이머 없음. 최근접 미배달 수령인을 다음 목표로 자동 배정, 근접 시 배달.
import { makeRNG } from '../util/math.js';
import { PARCEL_KINDS } from '../data/parcels.js';

export class DeliverySystem {
  constructor(planet, recipients, opts = {}) {
    this.planet = planet;
    this.recipients = recipients;     // [{id, name, pos:Vector3, dir:Vector3}]
    this.completed = new Set();
    this.current = null;
    this.onDeliver = opts.onDeliver || (() => {});
    this.onAssign = opts.onAssign || (() => {});
    this.deliverRange = opts.deliverRange ?? 4.5;   // 월드 단위(집 근처)
    const rng = makeRNG(opts.seed ?? 99);
    for (const r of this.recipients) r.parcel = PARCEL_KINDS[Math.floor(rng() * PARCEL_KINDS.length)];
  }

  get deliverAngle() { return this.deliverRange / this.planet.R; }
  remaining() { return this.recipients.filter(r => !this.completed.has(r.id)); }
  allDone() { return this.remaining().length === 0; }

  // 가장 가까운 미배달 수령인을 현재 목표로.
  assignNearest(playerPos) {
    const rem = this.remaining();
    if (!rem.length) { this.current = null; this.onAssign(null); return null; }
    let best = rem[0], bd = Infinity;
    for (const r of rem) { const d = playerPos.angleTo(r.pos); if (d < bd) { bd = d; best = r; } }
    this.current = best; this.onAssign(best); return best;
  }

  inRange(playerPos) { return !!this.current && playerPos.angleTo(this.current.pos) < this.deliverAngle; }

  // 배달 시도 → 성공 시 수령인 반환, 다음 자동 배정.
  tryDeliver(playerPos) {
    if (!this.inRange(playerPos)) return null;
    const r = this.current;
    this.completed.add(r.id);
    this.onDeliver(r);
    this.assignNearest(playerPos);
    return r;
  }
}
