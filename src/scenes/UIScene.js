// HUD — HP, 레벨, 조작법 표시
export class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UIScene' }); }

  create(data) {
    this.gameScene = data.gameScene;
    const W = this.scale.width;

    // 반투명 HUD 배경
    this.hudBg = this.add.rectangle(0, 0, W, 42, 0x000000, 0.7).setOrigin(0, 0);

    // HP 바
    this.hpLabel = this.add.text(10, 8, 'HP', { fontSize: '10px', color: '#aaa', fontFamily: 'monospace' });
    this.hpBarBg = this.add.rectangle(30, 14, 100, 8, 0x333).setOrigin(0, 0.5);
    this.hpBar = this.add.rectangle(30, 14, 100, 8, 0xe53935).setOrigin(0, 0.5);
    this.hpText = this.add.text(134, 8, '', { fontSize: '10px', color: '#ef9a9a', fontFamily: 'monospace' });

    // EXP 바
    this.expLabel = this.add.text(10, 22, 'EX', { fontSize: '10px', color: '#aaa', fontFamily: 'monospace' });
    this.expBarBg = this.add.rectangle(30, 28, 100, 4, 0x333).setOrigin(0, 0.5);
    this.expBar = this.add.rectangle(30, 28, 100, 4, 0x7e57c2).setOrigin(0, 0.5);

    // 스탯
    this.levelText = this.add.text(140, 8, '', { fontSize: '10px', color: '#ffd700', fontFamily: 'monospace' });
    this.attackText = this.add.text(140, 20, '', { fontSize: '10px', color: '#ff8a65', fontFamily: 'monospace' });
    this.goldText = this.add.text(200, 8, '', { fontSize: '10px', color: '#ffd54f', fontFamily: 'monospace' });
    this.floorText = this.add.text(200, 20, '', { fontSize: '10px', color: '#80cbc4', fontFamily: 'monospace' });

    // 조작 도움말 (하단)
    const hint = '방향키/WASD 이동   SPACE 음파 방출';
    this.hintText = this.add.text(W / 2, this.scale.height - 14, hint, {
      fontSize: '9px', color: '#546e7a', fontFamily: 'monospace',
    }).setOrigin(0.5, 1);

    // 미니맵 (오른쪽 상단)
    this.minimapGfx = this.add.graphics();
    this.minimapX = W - 90;
    this.minimapY = 4;
    this.minimapScale = 1.8;
  }

  update() {
    const gs = this.gameScene;
    if (!gs || !gs.player) return;
    const p = gs.player;

    // HP
    const hpRatio = p.hp / p.maxHp;
    this.hpBar.setDisplaySize(Math.max(0, 100 * hpRatio), 8);
    this.hpBar.setFillStyle(hpRatio > 0.5 ? 0x43a047 : hpRatio > 0.25 ? 0xfb8c00 : 0xe53935);
    this.hpText.setText(`${p.hp}/${p.maxHp}`);

    // EXP
    const expRatio = p.exp / p.expToNext;
    this.expBar.setDisplaySize(100 * expRatio, 4);

    // 스탯
    this.levelText.setText(`Lv.${p.level}`);
    this.attackText.setText(`ATK ${p.attack}`);
    this.goldText.setText(`G ${p.gold}`);
    this.floorText.setText(`B${gs.floor}F`);

    // 미니맵
    this._drawMinimap(gs);
  }

  _drawMinimap(gs) {
    const g = this.minimapGfx;
    g.clear();
    const dungeon = gs.dungeon;
    const sc = this.minimapScale;
    const ox = this.minimapX;
    const oy = this.minimapY;
    const sw = dungeon.width * sc;
    const sh = dungeon.height * sc;

    // 배경
    g.fillStyle(0x000000, 0.7);
    g.fillRect(ox - 2, oy - 2, sw + 4, sh + 4);

    const sw2 = gs.soundWave;
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        const t = dungeon.grid[y][x];
        const revealed = sw2.isTileLit(x, y) || sw2.isTileSeen(x, y);
        if (!revealed) continue;
        if (t === 0) {
          g.fillStyle(0x1a1a2e, 1);
        } else if (t === 3) {
          g.fillStyle(0xffd700, 1);
        } else {
          g.fillStyle(0x4a4a6a, 1);
        }
        g.fillRect(ox + x * sc, oy + y * sc, sc, sc);
      }
    }

    // 플레이어 점
    g.fillStyle(0x00e5ff, 1);
    g.fillRect(ox + gs.player.tx * sc - 1, oy + gs.player.ty * sc - 1, sc + 2, sc + 2);
  }
}
