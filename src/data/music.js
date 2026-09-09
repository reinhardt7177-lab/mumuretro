// 배포 파일이 있는 음악만 사용한다. 사당별 전용 곡이 생기면 이 표만 바꾸면 된다.
const track = (name) => `assets/audio/bgm/${name}.mp3`;

export const SCENE_MUSIC = Object.freeze({
  title: track('title'),
  lab: track('lab'),
  planet: track('planet'),
  balance: track('balance'),
  shadow: track('shadow'),
  sift: track('balance'),
  water: track('planet'),
  fire: track('balance'),
  strata: track('shadow'),
});
