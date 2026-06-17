import { DungeonGenerator, TILE } from '../systems/DungeonGenerator.js';
import { SoundWaveSystem } from '../systems/SoundWave.js';
import { Player } from '../systems/Player.js';
import { Monster, MONSTER_TYPES } from '../systems/Monster.js';
import { createGameSounds } from '../SoundGenerator.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.TILE_SIZE = 20;
  }

  create(data) {
    this.floor = (data && data.floor) || 1;
    this.savedPlayerData = data && data.playerData;
    this._gameOverShown = false;
    this.cameras.main.setBackgroundColor('#0a0a0f');

    createGameSounds(this);

    this._buildDungeon();
    this._setupSound();
    this._spawnEntities();
    this._setupInput();
    this._setupCamera();
    this._setupWaveRenderer();
    this._buildHUD();

    this._showFloorBanner();
  }

  _buildDungeon() {
    const cols = 60, rows = 45;
    this.dungeon = new DungeonGenerator(cols, rows).generate();

    this.tileGraphics = this.add.graphics().setDepth(0);
    this.overlayGraphics = this.add.graphics().setDepth(5);
    this._renderDungeon();
  }

  _renderDungeon() {
    const g = this.tileGraphics;
    g.clear();
    const S = this.TILE_SIZE;

    for (let y = 0; y < this.dungeon.height; y++) {
      for (let x = 0; x < this.dungeon.width; x++) {
        const t = this.dungeon.grid[y][x];
        switch (t) {
          case TILE.WALL:
            g.fillStyle(0x1a1a2e);
            g.fillRect(x * S, y * S, S, S);
            g.fillStyle(0x16213e, 0.6);
            g.fillRect(x * S + 1, y * S + 1, S - 2, S - 2);
            break;
          case TILE.FLOOR:
            g.fillStyle(0x2d2d3f);
            g.fillRect(x * S, y * S, S, S);
            g.fillStyle(0x252535, 0.5);
            g.fillRect(x * S + 1, y * S + 1, S - 2, S - 2);
            break;
          case TILE.STAIRS_DOWN:
            g.fillStyle(0x2d2d3f);
            g.fillRect(x * S, y * S, S, S);
            g.fillStyle(0xf9a825);
            g.fillRect(x * S + 4, y * S + 4, S - 8, S - 8);
            g.fillStyle(0xffd54f);
            g.fillRect(x * S + 7, y * S + 7, S - 14, S - 14);
            break;
        }
      }
    }
  }

  _setupSound() {
    this.soundWave = new SoundWaveSystem(this, this.dungeon);
  }

  _spawnEntities() {
    const start = this.dungeon.getPlayerStart();
    this.player = new Player(this, start.x, start.y, this.soundWave);

    // 이전 층에서 내려온 경우 플레이어 스탯 복원
    if (this.savedPlayerData) {
      const d = this.savedPlayerData;
      Object.assign(this.player, {
        hp: d.hp, maxHp: d.maxHp, attack: d.attack, defense: d.defense,
        level: d.level, exp: d.exp, expToNext: d.expToNext, gold: d.gold,
      });
    }

    // 층수에 따라 몬스터 수/종류 증가
    const monsterCount = 5 + this.floor * 2;
    const spawns = this.dungeon.getMonsterSpawns(monsterCount + 3);
    const types = Object.keys(MONSTER_TYPES);

    this.enemies = spawns.slice(0, monsterCount).map((pos, i) => {
      const typeIdx = Math.min(Math.floor(i / 2 + Math.random() * 1.5 + (this.floor - 1)), types.length - 1);
      const type = types[typeIdx % types.length];
      return new Monster(this, pos.x, pos.y, type, this.soundWave);
    });

    // 아이템 배치
    this.items = [];
    this._spawnItems();
  }

  _spawnItems() {
    const S = this.TILE_SIZE;
    const itemRooms = this.dungeon.rooms.slice(2, 5);
    itemRooms.forEach(room => {
      const x = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
      const y = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
      const type = Math.random() < 0.6 ? 'potion' : 'relic';
      const color = type === 'potion' ? 0xe91e63 : 0xffd700;
      const sprite = this.add.circle(x * S + S / 2, y * S + S / 2, 4, color).setDepth(7).setAlpha(0);
      this.items.push({ tx: x, ty: y, type, sprite, collected: false });
    });
  }

  _setupInput() {
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
    });

    this.input.keyboard.on('keydown-SPACE', () => {
      this.player.emitSound(9 + this.floor);
    });

    this.moveDelay = 0;
    this.moveInterval = 140; // ms between moves
  }

  _setupCamera() {
    const S = this.TILE_SIZE;
    const mapW = this.dungeon.width * S;
    const mapH = this.dungeon.height * S;
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.8);
  }

  _setupWaveRenderer() {
    this.waveGraphics = this.add.graphics().setDepth(15);
    this.fogGraphics = this.add.graphics().setDepth(20);
  }

  _buildHUD() {
    // HUD는 UIScene이 담당 (별도 카메라)
    this.scene.launch('UIScene', { gameScene: this });
  }

  update(time, delta) {
    if (!this.player || this.player.isDead()) {
      if (!this._gameOverShown) {
        this._gameOverShown = true;
        this.time.delayedCall(500, () => this.scene.start('GameOverScene', { floor: this.floor }));
      }
      return;
    }

    this._handleMovement(time, delta);
    this.soundWave.update(delta);
    this._updateMonsters(time);
    this._updateFog();
    this._updateWaveVisuals();
    this._checkItemPickup();
    this._checkStairs();
    this._updateEnemyVisibility();
  }

  _handleMovement(time, delta) {
    if (time < this.moveDelay) return;

    const k = this.keys;
    let dx = 0, dy = 0;

    if (k.left.isDown || k.a.isDown) dx = -1;
    else if (k.right.isDown || k.d.isDown) dx = 1;
    else if (k.up.isDown || k.w.isDown) dy = -1;
    else if (k.down.isDown || k.s.isDown) dy = 1;

    if (dx !== 0 || dy !== 0) {
      const moved = this.player.tryMove(dx, dy, this.dungeon, this.enemies);
      if (moved) this.moveDelay = time + this.moveInterval;
    }
  }

  _updateMonsters(time) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      // 음파가 몬스터에 닿으면 reveal 처리
      if (this.soundWave.isTileLit(e.tx, e.ty)) {
        this.soundWave.revealEnemy(e, 3000);
      }
      e.update(time, this.dungeon, this.player);
    }
    // 죽은 몬스터 경험치
    this.enemies.filter(e => !e.alive && !e._rewarded).forEach(e => {
      e._rewarded = true;
      this.player.gainExp(e.exp);
      this.player.gold += Math.floor(Math.random() * 3) + 1;
    });
  }

  _updateFog() {
    const S = this.TILE_SIZE;
    const g = this.fogGraphics;
    g.clear();

    const cam = this.cameras.main;
    const visW = cam.width / cam.zoom;
    const visH = cam.height / cam.zoom;
    const startX = Math.max(0, Math.floor(cam.scrollX / S) - 1);
    const startY = Math.max(0, Math.floor(cam.scrollY / S) - 1);
    const endX = Math.min(this.dungeon.width, Math.ceil((cam.scrollX + visW) / S) + 1);
    const endY = Math.min(this.dungeon.height, Math.ceil((cam.scrollY + visH) / S) + 1);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const sw = this.soundWave;
        if (sw.isTileLit(x, y)) {
          // 밝게 보임 — 페이드아웃 처리
          const a = sw.getTileAlpha(x, y);
          if (a < 1) {
            g.fillStyle(0x000000, 1 - a);
            g.fillRect(x * S, y * S, S, S);
          }
          // a===1 이면 아무것도 안 그림 → 타일이 그대로 보임
        } else if (sw.isTileSeen(x, y)) {
          // 기억된 타일 — 어둡게 dim 처리
          g.fillStyle(0x000000, 0.65);
          g.fillRect(x * S, y * S, S, S);
        } else {
          // 완전한 어둠
          g.fillStyle(0x000000, 1);
          g.fillRect(x * S, y * S, S, S);
        }
      }
    }
  }

  _updateWaveVisuals() {
    const S = this.TILE_SIZE;
    const g = this.waveGraphics;
    g.clear();

    for (const wave of this.soundWave.getActiveWaves()) {
      const px = wave.x * S + S / 2;
      const py = wave.y * S + S / 2;
      const radius = wave.radius * S;

      g.lineStyle(1.5, wave.color, wave.alpha * 0.9);
      g.strokeCircle(px, py, radius);
      g.lineStyle(0.8, wave.color, wave.alpha * 0.4);
      g.strokeCircle(px, py, Math.max(0, radius - S * 0.5));
    }
  }

  _checkItemPickup() {
    const S = this.TILE_SIZE;
    for (const item of this.items) {
      if (item.collected) continue;
      if (item.tx === this.player.tx && item.ty === this.player.ty) {
        item.collected = true;
        item.sprite.destroy();
        if (window.playPickup) window.playPickup();
        if (item.type === 'potion') {
          const heal = 10 + this.floor * 2;
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
          this.showMessage(`포션 획득! +${heal} HP`, '#e91e63');
        } else {
          this.player.attack += 2;
          this.showMessage('유물 획득! 공격력 +2', '#ffd700');
        }
        this.soundWave.emit(this.player.tx, this.player.ty, 5, 0xffd700);
      }

      // 아이템 가시성
      const visible = this.soundWave.isTileRevealed(item.tx, item.ty);
      item.sprite.setAlpha(visible ? this.soundWave.getTileAlpha(item.tx, item.ty) : 0);
    }
  }

  _checkStairs() {
    const sp = this.dungeon.stairsPos;
    if (this.player.tx === sp.x && this.player.ty === sp.y) {
      this.scene.start('GameScene', { floor: this.floor + 1, playerData: this._serializePlayer() });
    }
  }

  _serializePlayer() {
    return {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      attack: this.player.attack,
      defense: this.player.defense,
      level: this.player.level,
      exp: this.player.exp,
      expToNext: this.player.expToNext,
      gold: this.player.gold,
    };
  }

  _updateEnemyVisibility() {
    for (const e of this.enemies) {
      if (e.alive) e.updateVisibility(this.soundWave);
    }
  }

  // --- UI 헬퍼 ---
  showDamageNumber(tx, ty, amount, color = '#ff4444') {
    const S = this.TILE_SIZE;
    const txt = this.add.text(
      tx * S + S / 2,
      ty * S,
      `-${amount}`,
      { fontSize: '11px', color, fontFamily: 'monospace', fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets: txt,
      y: ty * S - S * 2,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => txt.destroy(),
    });
  }

  showMessage(text, color = '#ffffff') {
    const cam = this.cameras.main;
    const cx = cam.scrollX + cam.width / 2;
    const cy = cam.scrollY + cam.height / 4;
    const txt = this.add.text(cx, cy, text, {
      fontSize: '14px', color, fontFamily: 'monospace',
      backgroundColor: '#00000088', padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: txt,
      y: cy - 30,
      alpha: 0,
      duration: 1800,
      delay: 600,
      onComplete: () => txt.destroy(),
    });
  }

  showLevelUp() {
    this.showMessage(`LEVEL UP! Lv.${this.player.level}`, '#ffd700');
    this.soundWave.emit(this.player.tx, this.player.ty, 12, 0xffd700);
  }

  _showFloorBanner() {
    const cam = this.cameras.main;
    const cx = cam.scrollX + cam.width / cam.zoom / 2;
    const cy = cam.scrollY + cam.height / cam.zoom / 2;
    const txt = this.add.text(cx, cy, `B${this.floor}F — 어둠 속으로`, {
      fontSize: '18px', color: '#00e5ff', fontFamily: 'monospace',
      backgroundColor: '#00000099', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: txt, alpha: 0,
      duration: 1000, delay: 1500,
      onComplete: () => txt.destroy(),
    });
  }
}
