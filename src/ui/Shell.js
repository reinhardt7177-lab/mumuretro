// 화면 껍데기 배선 — 어떤 버튼이 어떤 화면을 여는가.
//
// 게임 규칙은 한 줄도 없다. 여기 있는 건 전부 "누르면 열린다/닫힌다"뿐이다.
// 그래서 화면을 하나 더 붙일 때 봐야 할 파일이 여기 하나로 끝난다 —
// 예전엔 버튼마다 boot.js 여기저기에 흩어져 있어서 붙일 때마다 좌표가 겹쳤다.
export function wireShell(deps) {
  const { codex, badges, quest, customizer, emoji, player, presence, ghosts, input,
          resumeAudio, pickup, startBGM, toggleBGM } = deps;

  // 도감 오버레이 토글 + 진행 바
  const codexOverlay = document.getElementById('codex');
  const codexBarFill = document.getElementById('codexBarFill');
  // 도감 안 탭 — 우표 / 배지
  const codexGridEl = document.getElementById('codexGrid');
  const badgeGridEl = document.getElementById('badgeGrid');
  const badgeCountEl = document.getElementById('badgeCount');
  function showCodexTab(which) {
    if (!codexGridEl || !badgeGridEl) return;
    const stamps = which === 'stamps';
    codexGridEl.style.display = stamps ? 'grid' : 'none';
    badgeGridEl.style.display = stamps ? 'none' : 'grid';
    document.querySelectorAll('#codexTabs .tab').forEach(t =>
      t.classList.toggle('on', t.dataset.tab === which));
    if (!stamps) badges.renderInto(badgeGridEl);
  }
  document.querySelectorAll('#codexTabs .tab').forEach(t =>
    t.addEventListener('click', () => showCodexTab(t.dataset.tab)));

  // ── ☰ 메뉴 ───────────────────────────────────────────────────────────────
  // 도감·꾸미기·소리·조작법은 "가끔 여는 것"이라 상시 버튼일 이유가 없었다.
  // 상시로 남는 건 지금 할 일(parcel)과 어디로 가나(지도)뿐이다.
  const menuSheet = document.getElementById('menuSheet');
  const closeMenu = () => menuSheet.classList.remove('show');
  document.getElementById('menuBtn').addEventListener('click', (e) => {
    e.stopPropagation(); menuSheet.classList.toggle('show');
  });
  // 메뉴 밖 아무 데나 누르면 닫힌다. 캔버스를 누르면 곧 시점 드래그가 시작되므로
  // 열린 채로 남아 있으면 시야를 가린 채 따라다닌다.
  addEventListener('pointerdown', (e) => {
    if (menuSheet.classList.contains('show') && !e.target.closest('#topRight')) closeMenu();
  });
  // 메뉴 항목은 누르면 무언가를 열기 때문에, 열자마자 메뉴가 남아 있으면 그 위를 덮는다.
  document.querySelectorAll('#menuSheet .mi').forEach(m => m.addEventListener('click', closeMenu));

  const openCodex = () => {
    codex.renderInto(codexGridEl);
    if (badgeCountEl) badgeCountEl.textContent = `${badges.count()}/${badges.total()}`;
    showCodexTab('stamps');
    if (codexBarFill) codexBarFill.style.width = (codex.total() ? (codex.count() / codex.total() * 100) : 0) + '%';
    codexOverlay.classList.add('show');
  };
  const closeCodex = () => codexOverlay.classList.remove('show');
  document.getElementById('codexBtn').addEventListener('click', openCodex);
  document.getElementById('codexClose').addEventListener('click', closeCodex);
  addEventListener('keydown', e => { if (e.code === 'KeyC') (codexOverlay.classList.contains('show') ? closeCodex() : openCodex()); });

  // ── 지도 · 할 일 ──
  document.getElementById('questBtn').addEventListener('click', () => quest.toggle());
  document.getElementById('questClose').addEventListener('click', () => quest.hide());
  addEventListener('keydown', e => { if (e.code === 'KeyM') quest.toggle(); });

  // 꾸미기 오버레이 토글
  const czOverlay = document.getElementById('customize');
  const openCz = () => { customizer.buildUI(document.getElementById('czControls')); czOverlay.classList.add('show'); };
  const closeCz = () => czOverlay.classList.remove('show');
  document.getElementById('customizeBtn').addEventListener('click', openCz);
  document.getElementById('czClose').addEventListener('click', closeCz);

  // 이모지 — 평소엔 💬 하나로 접혀 있고 누를 때만 펼친다.
  const emoteRow = document.getElementById('emoteRow');
  const emoteToggle = document.getElementById('emoteToggle');
  if (emoteToggle && emoteRow) emoteToggle.addEventListener('click', () => emoteRow.classList.toggle('show'));

  // 플레이어 이모지 보내기 → 머리 위 이모지 + 가까운 유령이 손 흔들기로 답함
  // #emotes 전체가 아니라 #emoteRow만 훑는다 — 펼침 버튼에는 data-e가 없어서
  // 같이 잡히면 undefined 이모지를 띄운다.
  document.querySelectorAll('#emoteRow button').forEach(b => {
    b.addEventListener('click', () => {
      resumeAudio();
      emoji.spawn(player.position, player.up, b.dataset.e, { size: 1.5, life: 2.6 });
      pickup();
      const gid = presence.sendEmote(player.position);
      if (gid) { const gm = ghosts.get(gid); if (gm) setTimeout(() => emoji.spawn(gm.position, gm.up, '👋', { life: 2.2 }), 350); }
    });
  });

  // 첫 사용자 제스처에 오디오 활성화 + BGM 시작(브라우저 자동재생 정책)
  const _wake = () => { resumeAudio(); startBGM('assets/audio/bgm_village.mp3'); removeEventListener('pointerdown', _wake); removeEventListener('keydown', _wake); };
  addEventListener('pointerdown', _wake); addEventListener('keydown', _wake);

  // 모바일 점프 버튼 — 탭 지연/중복을 피하려고 touchend에서 preventDefault 후 직접 트리거.
  const jumpBtn = document.getElementById('jumpBtn');
  if (jumpBtn) {
    const doJump = (e) => { if (e) e.preventDefault(); resumeAudio(); input.requestJump(); };
    jumpBtn.addEventListener('click', doJump);
    // 누르고 있으면 활공 — touchstart에서 점프, 유지 동안 hold, 떼면 해제.
    jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); doJump(); input.setHoldJump(true); }, { passive: false });
    const releaseJump = () => input.setHoldJump(false);
    jumpBtn.addEventListener('touchend', (e) => { e.preventDefault(); releaseJump(); }, { passive: false });
    jumpBtn.addEventListener('touchcancel', releaseJump);
  }

  // BGM 음소거 토글 — 아이콘만 바꾼다. 행(row) 전체를 갈아치우면 "소리" 글자가 지워진다.
  const muteBtn = document.getElementById('muteBtn');
  const muteIconEl = document.getElementById('muteIcon');
  if (muteBtn) muteBtn.addEventListener('click', () => {
    const on = toggleBGM();
    if (muteIconEl) muteIconEl.textContent = on ? '🔊' : '🔇';
  });

  // 조작법 — 30초 뒤 CSS로 알아서 사라진다. 여기서 다시 부르거나 치운다.
  const hintEl = document.getElementById('hint');
  const helpBtn = document.getElementById('helpBtn');
  if (helpBtn && hintEl) helpBtn.addEventListener('click', () => hintEl.classList.toggle('pin'));

  return { openCodex, closeCodex };
}
