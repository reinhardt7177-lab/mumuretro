# Kiro CLI 실행

이 프로젝트에서 **Claude Opus 5.5 · max effort**로 Kiro 대화를 시작하는 실행 파일입니다.

## 더블클릭으로 시작하기

프로젝트 루트의 `Start-Kiro.cmd`를 더블클릭하세요. 별도의 PowerShell 명령 입력 없이 Kiro 터미널이 열립니다. 바탕화면 바로가기에서도 같은 실행 파일을 시작할 수 있습니다.

- 작업 폴더: `D:\mumumetro`
- 모델: **Claude Opus 5.5**, 추론 강도: **max**
- 권한: `--trust-all-tools`로 Kiro 도구 전체 자동 승인
- 열린 터미널에 한국어로 작업을 요청하면 됩니다. 이 실행 파일은 Codex를 호출하지 않습니다.
- 재로그인: `D:\mumumetro\Start-Kiro.cmd --login`
- 모델 대화 없이 실행 경로와 버전 확인: `D:\mumumetro\Start-Kiro.cmd --check`

## 채팅에서 호출하기

작업 요청에 **“키로”**만 포함하면 Codex가 현재 작업의 목표와 필요한 맥락을 Kiro에 전달하고 결과를 확인합니다. 예: “키로로 해줘”, “키로 검토”, “이 작업 키로”. 영문 `Kiro`도 동일합니다. 모델은 `claude-opus-5.5`, 추론 강도는 `max`를 사용합니다. 사용 금지나 단순 질문, 트리거 규칙 수정 요청은 그 의도를 우선합니다.

이 트리거는 사용자 공통 지침 `%USERPROFILE%\.codex\AGENTS.md`에 저장했습니다. 다른 프로젝트에서도 해당 지침을 읽는 새 채팅에 적용됩니다. 기존에 열린 채팅에는 “공통 AGENTS.md를 읽고 키로를 활용해 주세요”라고 요청할 수 있습니다.

## 터미널에서 직접 실행하기

```powershell
pwsh -NoProfile -File D:\mumumetro\tools\kiro\start-kiro.ps1
```

실행 위치는 자동으로 `D:\mumumetro`가 됩니다. 사용자 요청에 따라 `--trust-all-tools`로 실행하여 Kiro의 모든 도구 호출을 자동 승인합니다. 읽기뿐 아니라 파일 생성·수정, 명령 실행, 테스트 등을 수행할 수 있습니다. Windows와 Codex 자체의 권한 제한은 그대로 적용되며, 기존 사용자 변경과 요청 범위를 보존합니다. 실행 파일이 전역 설정을 직접 수정하지는 않지만, Kiro 자체는 실행 시 선택한 effort를 다음 세션을 위해 저장할 수 있습니다.

## 처음 사용할 때

이 PC는 설치와 Google 계정 로그인을 완료했습니다. 위 실행 명령을 사용하면 됩니다.

새 PowerShell에서는 다음 명령으로도 시작할 수 있습니다. 기본 모델과 추론 강도가 저장되어 있습니다.

```powershell
cd D:\mumumetro
kiro-cli chat --effort max --trust-all-tools
```

나중에 로그인이 만료되면 `kiro-cli login`으로 다시 연결하고, `kiro-cli whoami`로 확인합니다. 사용 가능한 모델은 `kiro-cli chat --list-models --format json`으로 확인할 수 있습니다.

브라우저 인증이 열리지 않으면 `kiro-cli login --use-device-flow`를 사용할 수 있습니다. 설치 직후 명령을 찾지 못하면 PowerShell 창을 새로 열어 주세요.

## 설정 확인 상태

### 실제 코드 수정 검증 (2026-09-29)

`chat --no-interactive --effort max --trust-all-tools`로 임시 폴더의 작은 코드 수정 작업을 Kiro에 전달했습니다. Kiro가 직접 `add.cjs`를 읽고 `a - b`를 `a + b`로 수정한 뒤 `node test.cjs`를 실행했습니다. Codex도 실제 파일을 읽고 테스트를 재실행하여 `KIRO_FILE_EDIT_TEST_PASS`와 종료 코드 0을 확인했습니다. 프로젝트 코드는 변경하지 않았습니다.

따라서 Kiro 호출은 읽기나 검토에만 제한되지 않고 실제 코드 수정과 명령 실행까지 수행할 수 있습니다.

2026-09-29: 공식 Windows 설치 파일의 SHA-256과 AWS 서명을 검증한 뒤 Kiro CLI 2.25.0 설치를 완료했습니다.

- 실행 파일: `%LOCALAPPDATA%\Kiro-Cli\kiro-cli.exe`
- 사용자 설정: `%USERPROFILE%\.kiro\settings\cli.json`
- 기본 모델: `claude-opus-5.5`
- 기본 추론 강도: `chat.modelDefaults` → `claude-opus-5.5` → `output_config.effort` = `max`
- CLI의 `settings` 명령으로 위 기본값이 정상적으로 읽히는 것을 확인했습니다.

Google 계정 로그인과 모델 목록에서 `claude-opus-5.5` 제공을 확인했습니다. 프로젝트 밖의 빈 임시 폴더에서 파일 접근 없이 짧은 연결 테스트를 실행해 `KIRO_SETUP_OK` 응답을 받았습니다.

저장된 테스트 세션의 실제 메타데이터도 확인했습니다.

- `session_state.rts_model_state.model_info.model_id`: `claude-opus-5.5`
- `session_state.rts_model_state.additional_fields.overrides.output_config.effort`: `max`

CLI 2.25.0의 V2 비대화형 실행에서 `--model`에 `Method not found` 경고가 나올 수 있습니다. 이번 테스트에서는 전역 기본값이 적용되었으며, 위 세션 기록으로 요청한 모델과 추론 강도를 검증했습니다. 도구 전체 자동 승인으로 직접 실행하려면 `kiro-cli chat --effort max --trust-all-tools`을 사용하면 됩니다. 자동 승인은 실행 옵션이므로 단순히 `kiro-cli chat`만 실행한 경우에는 보장되지 않습니다.

Opus 5.5는 2026년 9월 28일부터 Pro·Pro+·Pro Max·Power 계정에 실험적으로 제공됩니다. 공식 안내의 크레딧 배율은 2.0배이며, 높은 effort는 더 많은 토큰을 사용할 수 있습니다.

- [Kiro 설치 요구사항](https://kiro.dev/docs/getting-started/installation/)
- [Opus 5.5 출시 안내](https://kiro.dev/changelog/models/claude-opus-5-5/)
- [추론 강도와 저장 방식](https://kiro.dev/docs/models/effort/)
- [CLI 명령과 인증](https://kiro.dev/docs/reference/cli-commands/)
