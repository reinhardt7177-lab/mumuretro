// 음파 탐색 시스템 — 핵심 메카닉
// 플레이어가 소리를 내면 파동이 퍼져 주변 지형/적이 일시적으로 보임
export class SoundWaveSystem {
  constructor(scene, dungeon) {
    this.scene = scene;
    this.dungeon = dungeon;
    this.waves = [];
    // lit: 현재 밝게 보임 (timer ms), 만료 → dim
    this.litTiles = new Map();   // 'x,y' -> timer
    // seen: 한번이라도 본 타일 (영구 dim)
    this.seenTiles = new Set();
    this.revealedEnemies = new Map();
  }

  emit(originTx, originTy, strength = 8, color = 0x00ffff) {
    const wave = {
      x: originTx,
      y: originTy,
      radius: 0,
      maxRadius: strength,
      speed: 0.15,
      color,
      alpha: 0.8,
      revealed: new Set(),
    };
    this.waves.push(wave);
    if (window.playSoundWave) window.playSoundWave();
  }

  update(delta) {
    const toRemove = [];

    for (const wave of this.waves) {
      wave.radius += wave.speed * (delta / 16.67);
      wave.alpha = 0.8 * (1 - wave.radius / wave.maxRadius);

      const r = Math.ceil(wave.radius);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > wave.radius - 1.5 && dist <= wave.radius + 0.5) {
            const tx = wave.x + dx;
            const ty = wave.y + dy;
            const key = `${tx},${ty}`;
            if (!wave.revealed.has(key) && this._hasLineOfSight(wave.x, wave.y, tx, ty)) {
              wave.revealed.add(key);
              this.litTiles.set(key, 5000); // 5초 밝게
              this.seenTiles.add(key);      // 영구 기억
            }
          }
        }
      }

      if (wave.radius >= wave.maxRadius) toRemove.push(wave);
    }

    for (const w of toRemove) this.waves.splice(this.waves.indexOf(w), 1);

    // lit 타이머 감소
    for (const [key, time] of this.litTiles) {
      const newTime = time - delta;
      if (newTime <= 0) this.litTiles.delete(key);
      else this.litTiles.set(key, newTime);
    }

    // 적 reveal 타이머 감소
    for (const [enemy, time] of this.revealedEnemies) {
      const newTime = time - delta;
      if (newTime <= 0) this.revealedEnemies.delete(enemy);
      else this.revealedEnemies.set(enemy, newTime);
    }
  }

  revealEnemy(enemy, duration = 3000) {
    this.revealedEnemies.set(enemy, duration);
  }

  // 현재 밝게 보이는 타일 (음파 직후)
  isTileLit(tx, ty) {
    return this.litTiles.has(`${tx},${ty}`);
  }

  // 이전에 본 적 있는 타일 (dim)
  isTileSeen(tx, ty) {
    return this.seenTiles.has(`${tx},${ty}`);
  }

  // 하위 호환
  isTileRevealed(tx, ty) {
    return this.litTiles.has(`${tx},${ty}`) || this.seenTiles.has(`${tx},${ty}`);
  }

  isEnemyRevealed(enemy) {
    return this.revealedEnemies.has(enemy);
  }

  getTileAlpha(tx, ty) {
    const time = this.litTiles.get(`${tx},${ty}`);
    if (!time) return 0;
    return time < 800 ? time / 800 : 1;
  }

  // Bresenham 선분 알고리즘으로 시선 체크
  _hasLineOfSight(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let x = x0, y = y0;
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      if (x === x1 && y === y1) return true;
      if (x !== x0 || y !== y0) {
        const tile = this.dungeon.grid[y]?.[x];
        if (tile === 0) return false; // 벽 막힘
      }
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  getActiveWaves() {
    return this.waves;
  }
}
