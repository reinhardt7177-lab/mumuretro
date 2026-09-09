# 빛과 그림자 레퍼런스 01 — 생성 기록

- 방식: 내장 `image_gen` 도구로 새 이미지 생성.
- 용도: 구현 전 미술 목표. 실제 게임 캡처가 아니다.
- 출력: [shadow-court-v01.png](shadow-court-v01.png)
- 작업자가 확인한 자료: [기존 그림자 사당 캡처](../evidence/shrine-2.png), [물 사당 미술 기준](water-court-v01.png), `layouts.js`와 `ShadowGates.js`의 퍼즐 구조.
- 위 이미지는 방향 파악에 사용했으며 생성 도구에는 이미지 파일을 첨부하지 않았다. 기존 탐험가 복장과 공간 규칙은 아래 프롬프트에 명시했다.
- 최초 시안의 빛줄기가 거울을 직선으로 통과해 보였으므로, 내장 도구로 두 차례 부분 수정했다. 수정에는 직전 시안 PNG를 입력했다. 최종 선택본은 위 출력 파일이며, 비교용 시안도 별도 파일로 보존했다.
- [두 차례 부분 수정 프롬프트](shadow-court-v01.edits.md)를 별도 보관했다.

## 최초 생성 프롬프트

```text
Use case: stylized-concept
Asset type: ONE landscape 3:2 production concept-art board for the existing browser 3D science exploration game "무무 행성". This is a proposed visual reference, clearly labelled as concept art, not an implemented game screenshot.

Primary request:
Create a beautiful, cohesive NIGHTTIME LIGHT-AND-SHADOW SHRINE, an approachable cel-shaded indie adventure environment with a large dominant third-person mirror-puzzle view occupying about 64% of the board, and three supporting scene panels in a single bottom row. Tasteful warm ivory margin strips, elegant legible Korean typography, clear hierarchy. The board should have the inviting exploration, clean shapes, rich color separation, atmospheric depth and readable mechanisms of a premium stylized adventure, yet look practical to build from reusable meshes for a browser game. It belongs to the same imaginative world as a pale limestone water courtyard, but this shrine has a distinct moonlit indigo and warm lamplight identity.

Environment and style:
An intimate roof-open stone sanctuary at blue hour/night, with a visible deep ultramarine sky and a low pale moon through the arches, distant blue mountain silhouettes, a few grouped olive-green leaves at outer wall joints. Warm ivory limestone faces, dark slate floors with broad clean joints, muted old brass instrument hardware and restrained amber light. Heavy simple chamfered stone shapes, open arches, a modest broken circular roof ring, generous walkable floor, carefully controlled painterly texture. Strong crisp readable gameplay shadows against a softly lit cool environment. Real depth, soft bounce light and restrained haze; avoid black unreadable surfaces. Architecture about two to three explorer heights, human-scale apparatus within arm's reach. No water courtyards or turquoise canals.

Existing protagonist identity:
A single small original explorer, seen from behind: broad-brimmed brown adventurer hat with dark hatband, short olive green explorer coat/clothes, burnt orange scarf trailing down the back, small brown satchel, dark boots, simple rounded low-polygon proportions. No swords, shields, elf ears or copied franchise characters. In the hero panel the explorer stands at lower left/center, full body visible and about 13% of the panel height, looking into the room. Camera behind and modestly above the explorer at a believable third-person gameplay distance, not a distant aerial view.

Hero panel, "01  거울로 잇는 빛":
An inviting mirror gallery seen from its entrance, with a clear flat central walking plane and spacious passages around the apparatus. Three separate broad flat silver mirrors on waist-height brass-and-stone swivel pedestals, visibly adjustable by a simple hand lever at each base. One controlled warm-white horizontal light beam comes from a fixed wall aperture and is redirected across all three mirror faces toward one circular amber receiver on the far wall beside the passage onward. A single continuous readable polygonal ray path, changing direction ONLY at the reflective plane of a mirror; no arbitrary beam forks, no laser spaghetti, no beams passing through opaque walls. Arrange the mirrors and receiver so they are spatially plausible and individually readable in perspective. The thin bright beam cores have restrained warm bloom, at matching apparatus height, and remain visually separate from subtle moonlight on the architecture. Keep the floor unmarked by route arrows and do not print puzzle solutions. Frame the far passage with a graceful open stone arch. Architectural edges catch cool blue light while the active mechanisms glow warm gold.
Only one tiny round open-notebook icon with an "N" key badge at the upper right of the hero view; no other HUD.

Three supporting panels, same world, materials, protagonist and night lighting:
02: Shadow-stepping corridor. One elevated slowly orbiting instrument lamp and four broad stone columns cast definite long connected shadow shapes on a single readable flat floor. The small explorer is standing safely INSIDE one clearly dark column shadow. The mechanism lamp is the obvious cause of the light/shadow pattern. Show a clear exit beyond the columns. No lit floor arrows or magic footprints.
03: Shadow-size experiment, close third-person view. One point-like warm lamp behind a small movable solid block on a low waist-accessible trolley/pedestal, and one flat upright receiving screen ahead. A single enlarged sharply bounded shadow of the block is cast on the screen, adjacent to or overlapping a simple thin target square outline. The spatial ordering lamp -> block -> screen must be obvious, and the shadow must be larger than the block because the block is nearer the lamp. A single continuous floor guide rail may clarify forward/back movement, but no arrows or numbers. No duplicate ghost blocks or contradictory multiple shadows.
04: Final shadow sanctuary. A modest seated original geometric stone guardian under a partial round roof, its clear long silhouette cast onto the floor by ONE adjustable lamp. Two separate reachable waist-height controls beside the approach: one simple circular rotation dial and one vertical three-stop height slider. A subtly outlined target silhouette on the floor makes the goal legible. Warm light, cool shadows and calm architecture. No giant boss, combat or new mechanics.

Text, exactly these labels in clean dark-indigo Korean type on the ivory margins, no other text except the N badge:
"무무 행성 · 빛과 그림자"
"비주얼 레퍼런스 01"
"01  거울로 잇는 빛"
"02  그림자가 길이 되는 회랑"
"03  거리에 따라 달라지는 그림자"
"04  빛의 방향과 높이"
"콘셉트 이미지 · 실제 게임 화면 아님"

Constraints:
Exactly one large hero view and three smaller bottom views, not four equal squares. Coherent buildable stylized 3D art direction. Keep each puzzle visually distinct and original. Prioritize readable silhouettes, source-to-shadow relationships, physically connected light paths and approachable levers. No lore text, numbers or text beyond the specified labels. No extra characters, monsters, combat UI, health hearts, collectible clutter, neon cyan fantasy circuitry, ornate golden filigree, unreachable controls, immense cathedral, photorealistic AAA surface detail, washed-out gray fog, brand logos or watermarks.
```
