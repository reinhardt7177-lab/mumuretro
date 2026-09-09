// 일정 압력의 순수한 얼음 모형. 받은 에너지로 먼저 0°C까지 데우고,
// 이후에는 0°C를 유지하면서 녹인다. 가열 시간은 놀이에 맞춘 장치 출력이다.
// 열 손실·다시 얼기·완전히 녹은 물의 추가 가열은 이 퍼즐의 범위 밖이다.
// https://openstax.org/books/physics/pages/11-3-phase-change-and-latent-heat
export const ICE_THERMAL = Object.freeze({
  initialC: -8, massKg: 1, heatCapacity: 2100, latentHeat: 334000,
});

export class IceThermal {
  constructor() { this.energyJ = 0; }
  get warmingEnergy() { return -ICE_THERMAL.initialC * ICE_THERMAL.massKg * ICE_THERMAL.heatCapacity; }
  get meltingEnergy() { return ICE_THERMAL.massKg * ICE_THERMAL.latentHeat; }
  get totalEnergy() { return this.warmingEnergy + this.meltingEnergy; }
  get temperatureC() {
    if (this.energyJ >= this.warmingEnergy) return 0;
    return ICE_THERMAL.initialC + this.energyJ / (ICE_THERMAL.massKg * ICE_THERMAL.heatCapacity);
  }
  get meltFraction() { return Math.max(0, Math.min(1, (this.energyJ - this.warmingEnergy) / this.meltingEnergy)); }
  get solved() { return this.energyJ >= this.totalEnergy; }
  get phase() { return this.solved ? 'water' : this.meltFraction > 0 ? 'melting' : 'ice'; }
  addPower(watts, dt) {
    if (!Number.isFinite(watts) || !Number.isFinite(dt) || watts <= 0 || dt <= 0) return;
    this.energyJ = Math.min(this.totalEnergy, this.energyJ + watts * dt);
  }
  exportState() {
    return { version: 1, energyJ: this.energyJ, temperatureC: this.temperatureC, meltFraction: this.meltFraction };
  }
  importState(data) {
    if (!data || data.version !== 1 || !Number.isFinite(data.energyJ)
      || data.energyJ < 0 || data.energyJ > this.totalEnergy) return false;
    const probe = new IceThermal(); probe.energyJ = data.energyJ;
    if (!Number.isFinite(data.temperatureC) || !Number.isFinite(data.meltFraction)
      || Math.abs(probe.temperatureC - data.temperatureC) > 1e-6
      || Math.abs(probe.meltFraction - data.meltFraction) > 1e-6) return false;
    this.energyJ = data.energyJ; return true;
  }
}

// 유한 범위의 거리 감쇠. 멀리 있는 열원은 얼음에 열을 전달하지 않는다.
export function proximityHeat(distance, radius, watts) {
  if (!Number.isFinite(distance) || distance < 0 || radius <= 0 || distance >= radius) return 0;
  return watts * (1 - (distance / radius) ** 2) ** 2;
}
