export class TitleScene extends Phaser.Scene {
  constructor() { super({ key: 'TitleScene' }); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor('#050510');

    // 배경 픽셀 파티클
    this._createStars();

    // 타이틀
    this.add.text(W / 2, H / 2 - 80, '던전 메아리', {
      fontSize: '36px', color: '#00e5ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 - 42, 'D U N G E O N   E C H O', {
      fontSize: '13px', color: '#546e7a', fontFamily: 'monospace', letterSpacing: 4,
    }).setOrigin(0.5);

    // 설명
    const desc = [
      '빛이 없는 던전.',
      '소리만이 당신의 눈입니다.',
      '',
      'SPACE — 음파 방출로 주변을 탐색',
      '방향키 / WASD — 이동 & 전투',
      '계단(★)에 도달하면 다음 층으로',
    ];
    desc.forEach((line, i) => {
      this.add.text(W / 2, H / 2 + i * 18, line, {
        fontSize: '11px',
        color: line.startsWith('SPACE') || line.startsWith('방향') || line.startsWith('계단') ? '#80cbc4' : '#78909c',
        fontFamily: 'monospace',
      }).setOrigin(0.5);
    });

    // 시작 버튼 깜빡임
    const startTxt = this.add.text(W / 2, H / 2 + 130, '[ ENTER / 클릭으로 시작 ]', {
      fontSize: '13px', color: '#ffd700', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: startTxt, alpha: 0.2, duration: 700, yoyo: true, repeat: -1,
    });

    // 파동 애니메이션
    this._animateWave(W / 2, H / 2 - 80);

    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('GameScene', { floor: 1 }));
    this.input.on('pointerdown', () => this.scene.start('GameScene', { floor: 1 }));
  }

  _createStars() {
    const W = this.scale.width, H = this.scale.height;
    const g = this.add.graphics();
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const size = Math.random() < 0.3 ? 2 : 1;
      g.fillStyle(0x37474f, Math.random() * 0.6 + 0.1);
      g.fillRect(x, y, size, size);
    }
  }

  _animateWave(cx, cy) {
    const g = this.add.graphics().setDepth(-1);
    let r = 0;
    this.time.addEvent({
      loop: true, delay: 16,
      callback: () => {
        g.clear();
        r += 0.5;
        if (r > 120) r = 0;
        const alpha = 1 - r / 120;
        g.lineStyle(1, 0x00e5ff, alpha * 0.4);
        g.strokeCircle(cx, cy, r);
        g.lineStyle(1, 0x00e5ff, alpha * 0.2);
        g.strokeCircle(cx, cy, Math.max(0, r - 20));
      },
    });
  }
}
