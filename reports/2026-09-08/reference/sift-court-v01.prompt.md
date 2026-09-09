# 분리 사당 레퍼런스 01 — 생성 기록

- 방식: 내장 `image_gen` 도구로 새 이미지 생성.
- 용도: 구현 전 미술 목표. 실제 게임 캡처가 아니다.
- 목표 출력: [sift-court-v01.png](sift-court-v01.png)
- 확인한 자료: [기존 분리 사당 화면](../evidence/shrine-3.png), [물 사당 미술 기준](water-court-v01.png), `layouts.js`, `SiftGates.js`, `SortGate.js`, `lighting.js`의 현재 구조와 규칙.
- 위 이미지는 작업자의 방향 검토에 사용했다. 생성 도구에는 이미지 파일을 첨부하지 않고 아래 프롬프트로 새 이미지를 만들었다.

## 생성 프롬프트

```text
Use case: stylized-concept
Asset type: ONE landscape 3:2 production concept-art board, ideally 1536x1024, for the existing original browser 3D science exploration game "무무 행성". This is a visual target for a future improvement, not a screenshot of implemented features.

Primary request:
Create a cohesive, beautiful MIXTURE-SEPARATION SHRINE, an open sandstone craft courtyard floating above a warm desert mesa at late afternoon. One large hero third-person view occupies the top roughly 64% of the image, and exactly three distinct smaller supporting scenes sit in a single bottom row. Cream margin strips, clean readable Korean typography. Polished stylized 3D/cel-shaded adventure concept art with clean silhouettes, restrained hand-painted surfaces, strong warm-versus-cool color separation, and clear apparatus. It must feel inviting to explore and practical to build from reusable geometry in an indie browser game.

Environment:
A low, broad, open-air sandstone workshop on a rocky sky island, terracotta desert ridges softened in the distance, amber sunlight with cool gray-violet contact shadows. Pale cream stone faces, ochre sandstone sides, modest dark weathered wood benches, old brass tool rims, muted clay ceramics. A few sparse olive shrubs at outer edges. Simple rectangular stone portals and short colonnades frame a visible next courtyard. Repeated circular perforated-disc motifs subtly suggest sieves. Keep the functional floor flat, continuous and generous, with wide walking space around each device and clear waist-height grasp points. A small strip of simple shade cloth at one side may frame the space, but no roof hiding the sky. Scene density gets calmer toward the guardian. Avoid uniform yellow fog; separate floor, device, character and background with value and hue. No water canals, no mirror beams, no endless dungeon, no immense cathedral. Main apparatus about one explorer high.

Existing protagonist:
One small original explorer seen from behind in the hero scene, full body visible, broad-brimmed brown hat with dark hatband, olive-green expedition coat, burnt-orange scarf down the back, small brown satchel, dark boots, rounded low-polygon proportions. About 15% of hero-panel height, lower foreground, walking toward the sieve table. Consistent explorer design in the small scenes if visible. No weapons or new costumes.

Hero view "01  체 고르기":
Believable third-person gameplay camera from the entrance of the first workshop court, modestly above the explorer, not an aerial map. Main subject is ONE clearly readable sieve worktable with an open sturdy frame. EXACTLY THREE removable sieve discs in total, same diameter and material, visibly DIFFERENT mesh-hole spacing: one medium-hole disc fitted horizontally in the worktable and two unused fine/coarse discs displayed upright in a low side rack. The mesh holes are real visible openings, not filled glowing plates. Show large angular tan grains visibly retained on the fitted mesh; smaller grains visibly dropping through its openings into a shallow sloping collection chute underneath. That short visible chute leads down and forward into ONE low removable handled receiving tray in front of the table. The tray contains the smaller collected grains, distinctly below the retained material; both outputs must be visible to the explorer. The tray's handles and clear floor around it make retrieving and re-sieving plausible. Do not show rocks passing through smaller holes. Frame legs do not block the tray or walkway. A simple stone order plaque behind the table shows only abstract grain-size silhouettes and three small unfilled round progress sockets, no words or solution arrows. Passage onward visible beyond the worktable. Keep the lower foreground uncluttered.
Only one small round OPEN NOTEBOOK icon with a legible "N" key badge in the hero view's upper right. No other HUD.

Supporting panel "02  성질로 나누기":
A reachable inspection bench, a red horseshoe magnet, a small clear-sided water basin, and two receiving bins. Exactly six identical matte gray block-shaped sample objects in total: five on the bench and one partly immersed at the basin surface. All six look alike; no colored iron/wood labels, no exposed internal materials, no correct-answer color coding. The explorer brings the magnet close to one bench sample. Basin has a clear horizontal waterline so floating versus sinking can be observed during play. Two bins and an interchangeable blank criterion plaque suggest sorting by a criterion rather than fixed material names. Instruments are close enough to observe and walk between. No magic electric beam, no floating untested samples.

Supporting panel "03  거름과 증발":
A close oblique view of a small practical separation work area with a magnet stand, a lined filter funnel directly above a collecting jug, and a separate compact heating bowl on a low stone brazier; a small refill tap at one side. Make the FILTER operation easy to read: brown insoluble sand is retained on the filter lining while a narrow transparent stream falls through the funnel spout into the jug below; dissolved salt is NOT depicted as grains caught on the filter. The separate heating bowl contains a small pale deposit of salt crystals remaining after water evaporates, gentle heat shimmer above it. A portable handled mixture pot and a clear route between stations. These are separate apparatus demonstrations within the concept scene, not a diagram claiming an irreversible universal order. No arrows linking a pre-solved route. No clouds labelled water vapor, no salt evaporating into smoke, no laboratory clutter or dangerous drama.

Supporting panel "04  방법을 조합하는 신전":
A calm clean open stone sanctuary at the end of the same workshop. A modest original geometric stone guardian with two quiet eyes and a broad round perforated sieve held across its lap. In front of it EXACTLY FOUR reachable mixture bowls on separate low plinths, containing visually distinct suggested mixtures: iron pellets with sand, two grain sizes, clear brine, and sandy brine. A separate low rack holds FOUR recognizable tool silhouettes: round sieve, horseshoe magnet, filter funnel, and a small unlit portable clay brazier. Clear space to walk with a tool between rack and bowls. A small two-socket progress marker at the sandy-brine bowl suggests a two-step task without revealing the tools or their order. No giant boss, no fifth bowl, no already attached answer tools, no combat.

Text exactly, dark umber clear Korean type on cream margins; no extra words:
"무무 행성 · 분리 사당"
"비주얼 레퍼런스 01"
"01  체 고르기"
"02  성질로 나누기"
"03  거름과 증발"
"04  방법을 조합하는 신전"
"콘셉트 이미지 · 실제 게임 화면 아님"
The only other text permitted is the notebook "N" badge.
Use top header for the title and subtitle, a small concept-status line top right, each scene label aligned to its panel's cream margin. Comfortable margins, all labels legible, no text over important apparatus.

Constraints:
One hero + three supporting panels, never four equal squares. Original stylized world, consistent character and materials, physically supported apparatus and connected collecting paths. The sieve has two visible outputs and exactly three exchangeable mesh sizes. Samples in the property-testing panel are visually identical; observation supplies information. Filtering leaves sand behind and evaporation leaves salt behind. Tool and bowl shapes, not pre-highlighted answers, guide discovery. Aim for a realistic visual development target for an indie game, not photorealistic AAA advertising. No franchise logos, familiar franchise characters, neon magical circuitry, ornate gold clutter, health bars, mini-map, arrows, tutorial speech bubbles or watermarks.
```
