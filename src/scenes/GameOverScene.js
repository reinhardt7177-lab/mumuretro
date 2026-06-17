export class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  create(data) {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor('#050510');

    const floor = data?.floor || 1;

    this.add.text(W / 2, H / 2 - 60, 'GAME OVER', {
      fontSize: '32px', color: '#e53935', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2, `${floor}층에서 쓰러졌습니다`, {
      fontSize: '13px', color: '#78909c', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 + 24, '어둠 속의 메아리는 사라졌습니다...', {
      fontSize: '11px', color: '#546e7a', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const retry = this.add.text(W / 2, H / 2 + 80, '[ ENTER / 클릭으로 다시 시작 ]', {
      fontSize: '12px', color: '#ffd700', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.tweens.add({ targets: retry, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });

    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('TitleScene'));
    this.input.on('pointerdown', () => this.scene.start('TitleScene'));
  }
}
