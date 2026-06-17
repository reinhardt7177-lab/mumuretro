# 무무 행성 집배원 (Mumu Planet Postman)

작은 구형 행성을 도는 **잔잔한 우체부 탐험 게임**. 어느 방향으로 걸어도 행성을 한 바퀴 돌아 제자리로 옵니다. 1980~90년대 한국 동네 정서 + 해변·숲·꽃밭 힐링 공간. [Messenger by Abeto](https://messenger.abeto.co/)에서 영감.

**▶ 플레이:** https://reinhardt7177-lab.github.io/mumuretro/

## 조작
- **이동** WASD / 방향키 · **달리기** Shift
- **시점** 마우스 드래그 · **줌** 휠
- **배달** E (또는 배달 프롬프트 탭)
- **도감** C · **꾸미기** 👕 · **음소거** 🔊 · **이모지** 우하단 버튼
- 모바일: 왼쪽 절반 이동 / 오른쪽 절반 시점

## 특징
- **구면 보행** — 대원(great-circle)·쿼터니언 평행수송, 극점 통과에도 안정
- **툰 셰이딩 + 외곽선**, 낮↔노을↔밤 글로벌 틴트(컬러 아틀라스)
- **밀집 한국 레트로 동네** — 주택가·상가·학교·숲을 구 전체에 배치, 수평선 컬링으로 최적화
- **배달 루프** — 비콘+화살표 네비, 우표 도감(localStorage)
- **주민·유령 메신저(가짜 멀티 프레즌스)·3D 이모지** — 멀티플레이 seam(`PresenceSource`) 내장
- **캐릭터 커스터마이즈** (머리·자켓·바지·신발·모자)
- **힐링 존** — 해변(물결 바다)·숲(연못·모닥불)·꽃밭, [Meshy AI](https://www.meshy.ai/) 3D 모델 + 절차 생성 혼합
- 잔잔한 BGM

## 로컬 실행
빌드 불필요(Three.js는 CDN importmap). 정적 서버만 띄우면 됩니다:

```bash
python tools/serve.py 5500
# → http://localhost:5500/
```

## 기술
- [Three.js](https://threejs.org/) r160 (CDN), 순수 ES 모듈, 빌드 시스템 없음
- 구조: `src/{core,world,rendering,entities,systems,data,util}/`
- 3D 에셋: [Meshy AI](https://www.meshy.ai/) text-to-3D (`tools/meshy_gen.py`, 키는 `MESHY_API_KEY` 환경변수로만 — 저장소 미포함)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
