# 우주 범선 Blender 원본

- 편집용: [starsail-v01.blend](starsail-v01.blend). 게임용으로 재질별 합치기를 하기 전의 원본이다.
- 게임용: [starsail-v01.glb](../../assets/models/starsail-v01.glb). 14개 메시, 14개 재질, 삼각형 30,480개, 1,416,256바이트. 외부 텍스처가 없다.
- 생성 스크립트: [build_starsail.py](../../tools/blender/build_starsail.py).

Blender 4.5.3 LTS 공식 Windows 포터블을 실제 실행해 제작했다. 시스템 설치와 파일 연결 변경은 하지 않았다. 실행 파일은 Git에서 제외된 `.integration/blender/runtime/`에 있다.

[공식 다운로드 원본](https://download.blender.org/release/Blender4.5/blender-4.5.3-windows-x64.zip)의 로컬 다운로드 SHA256은 `6B657C8BDD3A7B65B07B9E1AE17EB4BE7DD4AA23121DA7F3D3354FC2551330A7`이다. 이는 로컬 기록이며 공식 체크섬과 대조했다는 뜻은 아니다.

## 다시 생성하기

저장소 루트에서 실행한다.

```powershell
& '.integration/blender/runtime/blender-4.5.3-windows-x64/blender.exe' --background --factory-startup --python tools/blender/build_starsail.py
```

스크립트는 v01 파일을 다시 생성한다. Blender에서 직접 수정했다면 먼저 v02 같은 별도 파일로 저장하고 스크립트 출력 경로도 바꾼다. 자동 백업 `.blend1`은 Git에서 제외한다.

게임 좌표 `(x,y,z)`를 Blender `(x,-z,y)`로 변환하고 glTF의 Y-up 내보내기로 되돌린다. 갑판 높이는 게임 y=0이다. 충돌·상호작용·소포 회수 상태는 [Starsail.js](../../src/world/Starsail.js), 배치 기준은 [starsail.js](../../src/data/starsail.js)에서 관리한다.
