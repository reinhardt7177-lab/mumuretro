// Web Audio API로 게임 사운드 생성 (외부 파일 없이 작동)
export function createGameSounds(scene) {
  const ctx = scene.sound.context || new (window.AudioContext || window.webkitAudioContext)();

  function playTone(freq, type, duration, volume, attack = 0.01, decay = 0.1) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.05);
    } catch (e) {}
  }

  // 음파 방출 소리 — 소나 핑 느낌
  window.playSoundWave = () => {
    playTone(880, 'sine', 0.8, 0.3, 0.005, 0.3);
    playTone(440, 'sine', 0.6, 0.1, 0.01, 0.5);
  };

  // 발소리
  window.playFootstep = () => {
    playTone(120 + Math.random() * 40, 'sawtooth', 0.08, 0.05, 0.001, 0.06);
  };

  // 피격
  window.playHit = () => {
    playTone(200, 'square', 0.12, 0.2, 0.001, 0.08);
    playTone(150, 'sawtooth', 0.1, 0.15, 0.001, 0.1);
  };

  // 피격 당함
  window.playPlayerHit = () => {
    playTone(180, 'square', 0.2, 0.3, 0.001, 0.15);
  };

  // 레벨업
  window.playLevelUp = () => {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 'square', 0.3, 0.2, 0.01, 0.2), i * 80);
    });
  };

  // 아이템 획득
  window.playPickup = () => {
    playTone(1047, 'sine', 0.2, 0.3, 0.005, 0.15);
    playTone(1319, 'sine', 0.2, 0.2, 0.01, 0.2);
  };
}
