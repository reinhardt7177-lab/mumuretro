// 몬스터 AI — 소리에 반응하고 플레이어를 추적
export const MONSTER_TYPES = {
  SLIME: {
    name: '슬라임',
    color: 0x66bb6a,
    hp: 8, attack: 3, defense: 0, exp: 4,
    speed: 800, // ms per move
    hearRange: 5,
    symbol: 'S',
  },
  SKELETON: {
    name: '스켈레톤',
    color: 0xbdbdbd,
    hp: 14, attack: 5, defense: 1, exp: 8,
    speed: 600,
    hearRange: 7,
    symbol: 'K',
  },
  BAT: {
    name: '박쥐',
    color: 0x7e57c2,
    hp: 6, attack: 4, defense: 0, exp: 5,
    speed: 400,
    hearRange: 10,
    symbol: 'B',
  },
  GOLEM: {
    name: '골렘',
    color: 0x8d6e63,
    hp: 30, attack: 8, defense: 3, exp: 20,
    speed: 1200,
    hearRange: 4,
    symbol: 'G',
  },
};

export class Monster {
  constructor(scene, tx, ty, type, soundWave) {
    this.scene = scene;
    this.soundWave = soundWave;
    this.tx = tx;
    this.ty = ty;
    this.type = type;
    this.alive = true;
    this.TILE_SIZE = scene.TILE_SIZE;

    const cfg = MONSTER_TYPES[type];
    this.name = cfg.name;
    this.hp = cfg.hp;
    this.maxHp = cfg.hp;
    this.attack = cfg.attack;
    this.defense = cfg.defense;
    this.exp = cfg.exp;
    this.speed = cfg.speed;
    this.hearRange = cfg.hearRange;
    this.color = cfg.color;

    this.lastMoveTime = Math.random() * cfg.speed;
    this.alertTarget = null; // 소리 들은 위치
    this.alertTimer = 0;
    this.state = 'idle'; // idle | alert | chase

    // 스프라이트
    this.sprite = scene.add.rectangle(
      tx * this.TILE_SIZE + this.TILE_SIZE / 2,
      ty * this.TILE_SIZE + this.TILE_SIZE / 2,
      this.TILE_SIZE - 4,
      this.TILE_SIZE - 4,
      cfg.color
    ).setDepth(8).setAlpha(0);

    this.label = scene.add.text(
      tx * this.TILE_SIZE + this.TILE_SIZE / 2,
      ty * this.TILE_SIZE + this.TILE_SIZE / 2,
      cfg.symbol,
      { fontSize: '10px', color: '#ffffff', fontFamily: 'monospace' }
    ).setOrigin(0.5).setDepth(9).setAlpha(0);
  }

  update(time, dungeon, player) {
    if (!this.alive) return;

    // 음파에 닿았는지 체크 → 소리 들음
    if (this.soundWave.isEnemyRevealed(this)) {
      // 플레이어 위치 방향으로 alert
      this.alertTarget = { tx: player.tx, ty: player.ty };
      this.alertTimer = 4000;
      this.state = 'chase';
    }

    // alert 타이머
    if (this.alertTimer > 0) {
      this.alertTimer -= this.scene.game.loop.delta;
      if (this.alertTimer <= 0) {
        this.state = 'idle';
        this.alertTarget = null;
      }
    }

    // 시야 내 플레이어 감지 (3타일 이내 + 직선상)
    const distToPlayer = Math.abs(this.tx - player.tx) + Math.abs(this.ty - player.ty);
    if (distToPlayer <= 3) {
      this.state = 'chase';
      this.alertTarget = { tx: player.tx, ty: player.ty };
      this.alertTimer = 3000;
    }

    // 이동 타이밍
    if (time - this.lastMoveTime < this.speed) return;
    this.lastMoveTime = time;

    if (this.state === 'idle') return;

    // 플레이어 바로 옆이면 공격
    if (Math.abs(this.tx - player.tx) + Math.abs(this.ty - player.ty) === 1) {
      player.takeDamage(this.attack);
      // 공격 소리 — 작은 음파
      this.soundWave.emit(this.tx, this.ty, 2, 0xff7043);
      return;
    }

    // A* 대신 간단한 그리디 이동
    const target = this.alertTarget || { tx: player.tx, ty: player.ty };
    this._moveToward(target.tx, target.ty, dungeon);
  }

  _moveToward(targetTx, targetTy, dungeon) {
    const dx = targetTx - this.tx;
    const dy = targetTy - this.ty;

    const moves = [];
    if (dx !== 0) moves.push({ dx: Math.sign(dx), dy: 0 });
    if (dy !== 0) moves.push({ dx: 0, dy: Math.sign(dy) });
    // 대각선 우회 시도
    moves.push({ dx: Math.sign(dx), dy: Math.sign(dy) });
    moves.push({ dx: -Math.sign(dx), dy: 0 });
    moves.push({ dx: 0, dy: -Math.sign(dy) });

    for (const m of moves) {
      const nx = this.tx + m.dx;
      const ny = this.ty + m.dy;
      if (dungeon.isWalkable(nx, ny) && !this._isOccupied(nx, ny)) {
        this.tx = nx;
        this.ty = ny;
        this._animateMove();
        return;
      }
    }
  }

  _isOccupied(tx, ty) {
    // 다른 몬스터와 겹침 방지 (scene에서 enemies 배열 참조)
    return this.scene.enemies?.some(e => e !== this && e.alive && e.tx === tx && e.ty === ty);
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
    // 피격 시 음파로 소리 냄 (경계 상태로 전환)
    this.soundWave.emit(this.tx, this.ty, 2, 0xffcc02);
    this.state = 'chase';
    this.alertTimer = 5000;
  }

  die() {
    this.alive = false;
    this.scene.tweens.add({
      targets: [this.sprite, this.label],
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 300,
      onComplete: () => {
        this.sprite.destroy();
        this.label.destroy();
      },
    });
    this.soundWave.emit(this.tx, this.ty, 3, 0xff5722);
  }

  _animateMove() {
    const px = this.tx * this.TILE_SIZE + this.TILE_SIZE / 2;
    const py = this.ty * this.TILE_SIZE + this.TILE_SIZE / 2;
    this.scene.tweens.add({
      targets: [this.sprite, this.label],
      x: px,
      y: py,
      duration: Math.min(this.speed * 0.7, 200),
      ease: 'Power1',
    });
  }

  updateVisibility(soundWave) {
    const visible = soundWave.isEnemyRevealed(this);
    const alpha = visible ? 1 : 0;
    if (this.sprite.alpha !== alpha) {
      this.sprite.setAlpha(alpha);
      this.label.setAlpha(alpha);
    }
  }
}
