# 웹 배포와 원본 보존

## 실행과 공개 사이트

- 웹 실행 원본은 `index.html`, `fire-trial.html`, `src/`, `assets/`, `vendor/`다. Three.js 0.160.0과 로컬 importmap을 유지한다.
- `main`은 기존 GitHub–Vercel 프로젝트 `mumuretro`에 연결돼 있다. 공개 주소는 <https://mumuretro.vercel.app/>다. Git push 성공과 Vercel 배포 성공은 각각 확인한다.
- Vercel은 `vercel.json`의 `node tools/build-web.cjs`를 실행하고 `dist/`만 공개한다. 새 패키지 설치는 필요 없다. `.vercelignore`에서 빌드 도구 하나만 예외로 포함한다.
- 빌드는 정해진 `dist/`만 새로 생성한다. 그 안에는 실행 원본과 자동 생성한 `assets/release.json`만 들어간다. 교실 서버·작업 지침·보고서·Blender 원본은 공개 정적 파일에 포함하지 않는다.
- `release.json`에는 배포 커밋과 각 실행 파일의 SHA-256이 있다. 모듈은 재검증하도록 캐시 헤더를 지정한다. 사용자 로컬 저장 키와 데이터는 변경하지 않는다.

## 교실 함께하기

사용자 선택은 같은 교실 네트워크에서 최대 3명의 균형 공동 실험이다. `교실서버.cmd`를 더블클릭하고 교사·학생이 모두 그 서버 주소로 접속한다. 공개 Vercel 사이트 자체에 상시 방 서버를 설치한 구성은 아니다. 개인 탐사와 저장은 공개 사이트에서도 사용할 수 있다. 자세한 순서는 [교실 서버 안내](server/README.md)에 있다.

## GitHub에 보존하는 범위

2026-10-22 배포는 기존 로컬 백업 브랜치를 수정하지 않고, `origin/main`에서 만든 별도 작업 공간에 현재 웹 실행 파일을 복사해 준비했다. 예전 백업 브랜치와 로컬 제작 자료는 그대로 둔다.

- 현재 웹 코드·배포용 GLB·텍스처·글꼴·음원, 교실 서버, 검사·제작 스크립트와 최신 문서를 포함한다.
- 새 불 신전·시간의 수호자·팔찌의 설계·시안·편집 원본, 최근 웹 전환·기능 마감 보고서와 근거를 포함한다.
- Unity 프로젝트를 되살리지 않는다. 가벼운 이전 로직·배치·렌더 참고와 보존 해시 목록은 남긴다.
- 약 940MiB의 `art/engine-transfer/model-data/` 및 오래된 대용량 제작 실험·중복 고해상도 원본은 로컬 보관 자료다. 삭제하지 않으며 이번 웹 배포 커밋에 새로 포함하지 않는다. `preservation.json`은 로컬 보존 전체 목록이므로 GitHub 사본의 파일 목록과 같다고 가정하지 않는다. 해당 원본을 요구하는 재내보내기 도구는 로컬 보관함이 필요하다.

## 검증

```powershell
node --experimental-vm-modules tools/check-source.cjs
node tools/check-save.mjs
node tools/check-audio.cjs
node tools/build-web.cjs
```

Playwright와 Edge를 준비하고 `AUDIT_NODE_MODULES`를 지정한 뒤 다음 명령으로 **공개 파일의 해시와 실제 WebGL 모델 로드**를 확인한다. 기본 주소는 공개 Vercel이며 `AUDIT_URL`로 별도 배포/로컬 빌드를 검사할 수 있다. 개인 저장은 격리된 새 브라우저를 사용한다.

```powershell
node tools/check-published-web.cjs
```

`--break-guardian`은 검사 브라우저에서 수호자 GLB만 404로 바꾼다. 실제 모델 로드 실패를 잡아 exit 1이어야 한다. 공개 파일은 수정하지 않는다. 실제 퍼즐 완주와 저장 회귀 도구는 [검사 안내](tools/TESTING.md)에 별도로 정리했다.

설정 근거: [Vercel 정적 구성](https://vercel.com/docs/project-configuration/vercel-json), [배포 제외 설정](https://vercel.com/docs/deployments/vercel-ignore).
