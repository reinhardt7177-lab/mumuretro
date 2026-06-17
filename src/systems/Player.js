// 플레이어 시스템 — 이동, 전투, 상태 관리
export class Player {
  constructor(scene, tx, ty, soundWave) {
    this.scene = scene;
    this.soundWave = soundWave;
    this.tx = tx; // 타일 좌표
    this.ty = ty;
    this.hp = 30;
    this.maxHp = 30;
    this.attack = 5;
    this.defense = 1;
    this.level = 1;
    this.exp = 0;
    this.expToNext = 10;
    this.gold = 0;
    this.isMoving = false;
    this.moveQueue = [];
    this.lastSoundTime = 0;
    this.soundCooldown = 300; // ms
    this.TILE_SIZE = scene.TILE_SIZE;

    // 플레이어 스프라이트 (픽셀 아트 placeholder → 나중에 에셋 교체)
    this.sprite = scene.add.rectangle(
      tx * this.TILE_SIZE + this.TILE_SIZE / 2,
      ty * this.TILE_SIZE + this.TILE_SIZE / 2,
      this.TILE_SIZE - 2,
      this.TILE_SIZE - 2,
      0x4fc3f7
    ).setDepth(10);

    // 플레이어 눈 표시
    this.eyeL = scene.add.circle(
      tx * this.TILE_SIZE + this.TILE_SIZE / 2 - 3,
      ty * this.TILE_SIZE + this.TILE_SIZE / 2 - 2,
      2, 0xffffff
    ).setDepth(11);
    this.eyeR = scene.add.circle(
      tx * this.TILE_SIZE + this.TILE_SIZE / 2 + 3,
      ty * this.TILE_SIZE + this.TILE_SIZE / 2 - 2,
      2, 0xffffff
    ).setDepth(11);
  }

  tryMove(dx, dy, dungeon, enemies) {
    if (this.isMoving) return false;

    const nx = this.tx + dx;
    const ny = this.ty + dy;

    // 적이 있으면 공격
    const target = enemies.find(e => e.tx === nx && e.ty === ny && e.alive);
    if (target) {
      this.attackEnemy(target);
      return true;
    }

    if (!dungeon.isWalkable(nx, ny)) return false;

    this.tx = nx;
    this.ty = ny;
    this._animateMove();

    // 이동 소리 — 발소리가 반향음 역할 (약한 음파)
    const now = Date.now();
    if (now - this.lastSoundTime > this.soundCooldown) {
      this.soundWave.emit(this.tx, this.ty, 3, 0x546e7a);
      if (window.playFootstep) window.playFootstep();
      this.lastSoundTime = now;
    }

    return true;
  }

  emitSound(strength = 9) {
    // SPACE: 강한 음파 방출
    this.soundWave.emit(this.tx, this.ty, strength, 0x00e5ff);
    // 시각 효과: 플레이어 깜빡임
    this.scene.tweens.add({
      targets: [this.sprite],
      alpha: 0.3,
      duration: 80,
      yoyo: true,
    });
  }

  attackEnemy(enemy) {
    const dmg = Math.max(1, this.attack - enemy.defense + Math.floor(Math.random() * 3));
    enemy.takeDamage(dmg);
    this.scene.showDamageNumber(enemy.tx, enemy.ty, dmg, '#ff4444');
    if (window.playHit) window.playHit();

    // 공격 시 적 방향으로 약한 음파
    this.soundWave.emit(this.tx, this.ty, 4, 0xff6b6b);
  }

  takeDamage(amount) {
    const actual = Math.max(1, amount - this.defense);
    this.hp = Math.max(0, this.hp - actual);
    this.scene.showDamageNumber(this.tx, this.ty, actual, '#ffeb3b');

    // 피격 깜빡임
    if (window.playPlayerHit) window.playPlayerHit();
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 60,
      yoyo: true,
      repeat: 2,
    });

    return actual;
  }

  gainExp(amount) {
    this.exp += amount;
    if (this.exp >= this.expToNext) {
      this.levelUp();
    }
  }

  levelUp() {
    this.level++;
    this.exp -= this.expToNext;
    this.expToNext = Math.floor(this.expToNext * 1.6);
    this.maxHp += 8;
    this.hp = this.maxHp;
    this.attack += 2;
    if (window.playLevelUp) window.playLevelUp();
    this.scene.showLevelUp();
  }

  _animateMove() {
    this.isMoving = true;
    const px = this.tx * this.TILE_SIZE + this.TILE_SIZE / 2;
    const py = this.ty * this.TILE_SIZE + this.TILE_SIZE / 2;

    this.scene.tweens.add({
      targets: [this.sprite, this.eyeL, this.eyeR],
      x: (obj) => {
        if (obj === this.sprite) return px;
        if (obj === this.eyeL) return px - 3;
        return px + 3;
      },
      y: (obj) => {
        if (obj === this.sprite) return py;
        if (obj === this.eyeL || obj === this.eyeR) return py - 2;
        return py;
      },
      duration: 80,
      ease: 'Power1',
      onComplete: () => { this.isMoving = false; },
    });
  }

  getPixelPos() {
    return {
      x: this.tx * this.TILE_SIZE + this.TILE_SIZE / 2,
      y: this.ty * this.TILE_SIZE + this.TILE_SIZE / 2,
    };
  }

  isDead() { return this.hp <= 0; }
}
