import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

const config = {
  type: Phaser.AUTO,
  width: 640,
  height: 480,
  backgroundColor: '#050510',
  pixelArt: true,
  antialias: false,
  parent: 'game-container',
  scene: [TitleScene, GameScene, UIScene, GameOverScene],
  audio: {
    disableWebAudio: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

window.game = new Phaser.Game(config);
