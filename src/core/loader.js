// 엔진을 못 읽어도 무한 로딩 대신 다시 열 수 있는 화면을 표시한다.
const load = document.getElementById('load');
let ready = false;
function showFailure(message) {
  load.replaceChildren(); load.style.display = 'flex'; load.classList.add('failed');
  load.setAttribute('role', 'alert');
  const title = document.createElement('strong'); title.textContent = '행성을 열지 못했다';
  const desc = document.createElement('p'); desc.textContent = message;
  const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '다시 열기';
  retry.addEventListener('click', () => location.reload());
  load.append(title, desc, retry);
}
const timer = setTimeout(() => {
  if (!ready) showFailure('준비가 오래 걸린다. 연결을 확인하고 다시 열어 보자. 저장된 기록은 그대로 남아 있다.');
}, 25000);
addEventListener('error', event => {
  if (!ready) showFailure('화면을 준비하지 못했다. 브라우저를 새로 열고 다시 시도해 보자.');
  console.error('[mumu]', event.error || event.message);
});
addEventListener('unhandledrejection', event => {
  console.error('[mumu]', event.reason);
  if (!ready) showFailure('준비 중 문제가 생겼다. 잠시 후 다시 열어 보자.');
});
document.getElementById('c').addEventListener('webglcontextlost', event => {
  event.preventDefault(); window.game?.save(); window.game?.loop.stop();
  showFailure('화면 연결이 잠시 끊겼다. 다른 창을 정리하고 다시 열어 보자. 마지막 저장에서 이어갈 수 있다.');
});
import('../boot.js').then(() => {
  ready = true; clearTimeout(timer); load.style.display = 'none';
}).catch(error => {
  clearTimeout(timer); console.error('[mumu boot]', error);
  showFailure('게임 파일이나 3D 화면을 준비하지 못했다. 연결과 브라우저의 그래픽 가속 설정을 확인하고 다시 열어 보자.');
});
