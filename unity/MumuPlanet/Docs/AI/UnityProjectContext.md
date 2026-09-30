# Unity project context

## Water sanctuary direct entry (2026-09-30)

- The sandstone cliff chapter (climb, sun mirror, thaw) is retired. `BuildWaterMountain`, `WaterMountainTrial`, `WaterMountainSmoke`, `IceThawPresentation` and `check-water-mountain.ps1` are archived in `unity/legacy/water-mountain-v05` (outside Assets, with .meta). `MountainClimbController` remains compiled because `OrbitCamera`/`NavigatorPose` reference it; no scene uses it. Blender sources and exported JSON are untouched.
- `BuildWaterSanctuaryExterior.Populate` destroys the `Water mountain chapter` root (removing its elevated colliders), restores the nature it hid (its chapter-local rectangles), and rebuilds `Water sanctuary exterior` at the saved sanctuary pose (former ice-seal point 54.103, 49.617, 17.571). It hides only nature inside the building footprint or buried more than 0.3m under the raised footing (`WaterSanctuaryEntrance.ShouldHideNature`, shared with the smoke test). `BuildWaterEnding.CreateAndBuild` now calls it.
- Collision: glacier volume boxes fitted to `glacier-temple-v03.json`. Before, 14.7% of the body-height ice skin was within capsule reach of any collider; now 100% (9,837 samples, 5cm grid). Five of 1,246 box-edge cells are 0.51–0.66m from the ice. Doorway jambs and a 4.7m threshold make the arch the only opening. Players stop under it; the dark hall is not a room. Columns have capsule collision.
- `WaterSanctuaryEntrance` owns E entry (stairs-to-arch zone), return landing, completion seal, bottom prompt, and `ElevatedTraversal` within 14m. `entranceOpen` now means "visited": entry writes it once. Unreadable/newer records never block entry and are not overwritten. `QuestGuide` and `TempleEntrance` reference `WaterSanctuaryEntrance`. The weight temple stays the first quest until the player is near the sanctuary, has visited it, or finished the weight temple.
- Validation: `-mumu-water-entrance-smoke <dir> [-mumu-water-entrance-mode fresh|visited|unreadable]` (`unity/check-water-entrance.ps1`). It includes planted-failure checks for the retired-object, nature and foreign-walkable detectors. `unity/build-water-direct-entry.ps1` regenerates, builds and runs every related check.
- Status (2026-09-30 16:22–16:25 build, `unity-build.log`): regenerated and both players built. Passing: entrance 48/14/14, ending 29, water journey 11/6/7/5/3, water interior 45/46/41, exploration, quest guide 18+18, weight exterior 56, weight temple 768 + reload, temple journey (weight 18/17, twin 17/15, lever 15/13), starsail 39+4, notebook 1180×3. `build-water-direct-entry.ps1 -SkipBuild` ran all of them end to end. `check-meadow.ps1` fails its wind-determinism step ("Scene changed independently of grass wind"). It fails on the 2026-09-27 backup build too (151 px vs 126 px now; limit 100; edge pixels on the weight temple door and the player). It last passed 2026-09-21 and is excluded from the one-shot script. The license was restored by installing Unity Hub 3.22.0 (winget) and signing in: Personal, `com.unity.editor.headless`. Report: `reports/2026-09-30/water-direct-entry/REPORT.md`.
- Movement (affects every `PlanetExplorer.Step`/`StepElevated` wall contact; `StepFlatCollisions` unchanged): `SlideAlong` replaces `Vector3.ProjectOnPlane(displacement, hit.normal)`.
  - The cause: on the sphere, walls lean up to ~6° from local vertical. Projection kept a wall-ward component, and with ground snapping the capsule crept ~0.4 mm/frame into the wall. Once the capsule touched the wall, the cast ignored it and the player passed through.
  - `SlideAlong` flattens the wall normal onto the ground plane and removes only the into-wall part.
- Collision details learned by walking:
  - Glacier boxes span y -5..7.6 (centre 1.3, height 12.6). With box bottoms at y=0, edges on the east slope produced steep contact normals.
  - A foot ray that starts inside a raised walkable box ignores that box. The fix adds plinth front walls ×2 and stair side walls ×4 (steps 1–2).
- Smoke walking uses grid A* (`PlanRoute`) and nearest-point following (`FollowRoute`, which fails after 3 s without progress). It is still per-frame `Step()`, with no teleport. A straight walker could not thread the restored trees: 93.9 m and 122 detours without arriving.
- Scripts: Windows PowerShell 5.1 reads BOM-less UTF-8 as CP949, so Korean result JSON breaks `ConvertFrom-Json`. The fix is `-Encoding UTF8`, set as the default in `build-water-direct-entry.ps1`. Players started with a hidden window need `-batchmode`, likely because `runInBackground: 0` pauses them when unfocused. `check-water-journey`, `check-water-sanctuary` and `check-water-interior-v02` now pass it.
- Font: in batch runs, `BuildWaterSanctuaryExterior` logs `WATER_FONT_MISSING` listing every character, ASCII included. `TryAddCharacters` apparently cannot open the font face; not investigated. The existing static atlas already covers all current prompt and quest text, and the entrance smoke checks `characterLookupTable`. Text with new characters will fail that check until this is fixed.

## Water deity V03 textured model (2026-09-26)

- September 27 finishing pass: controlled Editor captures isolated the face/neck triangle artifacts to the original normal map, not shadows. `bake_water_deity_v03_normals.py` bakes the preserved high sculpt onto the final mesh at 2048² (+X/+Y/+Z tangent, 12px padding). `WaterDeityV03Art` requires that derived map and uses strength 1. `water-deity-v03-final.blend` is the packed final native file; previous files are preserved.
- `WaterDeityOfferingArt.Configure` assigns dedicated URP transparent/specular-preserving shell and small opaque inner core to the existing Blender droplet. No added collider, light, or runtime update; the core shares 2,560 triangles, making deity + halo + offering geometry 176,393 triangles in scene.
- `BuildWaterSanctuary.CreateReviewAndBuild` saves the scene, takes reversible normal/shadow comparisons, then builds Windows. The diagnostic never saves temporary material/light toggles. Final evidence/report: `reports/2026-09-27/water-deity-v03`.

- User explicitly approved the front concept image upload to Meshy and 40 credits. One task (`01a0db4a-7c0b-70a3-a11a-e6628be5d1bc`) succeeded; its status reported 40 consumed credits. No duplicate submission.
- Versioned sources, prompt, quality gates and native Blender evidence are in `art/water-sanctuary/v03`. V01/V02 and the original generated GLBs remain preserved.
- `prepare_water_deity_v03.py` exports actual UVs, smooth corner normals and PBR textures. Meshy's Blender glTF import left empty image placeholders; explicit file rebinding and packing fixes the native source.
- Initial game mesh: 99,053 triangles. After inspecting runtime facial facets, the Blender preparer welds seam duplicates, locally subdivides the head and projects 27,531 vertices onto the preserved 4,620,946-triangle sculpt. Final body mesh: 147,977 triangles, one material; dress stays at game density. Base colour 8192², normal and ORM 4096² are embedded. Runtime max texture size 4096 with mipmaps.
- `WaterDeityV03Art` imports the material and packed metallic R / smoothness A map, preserving source double-sided cloth/hair. Separate Blender halo and droplet add 25,856 triangles (total 173,833). `BuildWaterSanctuary` attaches all three at the existing dais. Initial runtime overexposure led to lower key/fill lighting and normal strength; the offering droplet is placed between the hands.
- `WaterSanctuarySmoke` now includes four rotation views and a face close-up, in addition to unchanged dialogue/walk checks. Visual quality is judged from runtime captures, not the concept image.
- Final September 27 Windows build exited 0; sanctuary runner exited 0 with 10 checks passed and seven reviewed runtime frames. `asset-qc.json` validates the final packed Blender file. See the V03 report for source generation, before/after comparisons, and remaining close-up sculpt detail limits.

## Water deity art V02 (2026-09-26)

- `tools/blender/build_water_deity_v02.py` generates a separate Blender source and material-batched JSON. Existing V01 remains preserved.
- Layered robes, articulated hands, profiled face, swept hair, crown and halo replace the primitive deity in `BuildWaterSanctuary.Create`.
- The deity-specific exporter preserves smooth corner normals and exports actual node base colours. Existing room export is unchanged.
- `BuildWaterSanctuary.CreateAndBuild` regenerates only the sanctuary and builds the existing journey scenes. Dialogue, puzzle logic and saves are unchanged.
- Static geometry: 164,564 triangles, nine material batches. Deduplicated rounded vertex/normal pairs reduce export size. No rig, cloth animation or measured performance claim.
- Sanctuary adds a 128px reflection probe captured once through the existing `TempleReflectionCapture`, for the metal ornaments.

## Water sanctuary scene (2026-09-26)

- `BuildWaterSanctuary.Create` creates a separate 12x14m scene from the Blender hall/deity JSONs. Existing explorer/camera are cloned through Editor APIs; dry aisle, perimeter and dais have colliders.
- `WaterTempleJourney` sends normal completed play and completed-save resumes to the sanctuary after 1.5 seconds. Save schema and deterministic existing smoke cases remain unchanged.
- `WaterSanctuary` implements proximity/E dialogue, debounce, notebook blocking and movement unlock. Dialogue completion is visit-local; no permanent reward, notebook completion, return or sealing yet.
- `WaterSanctuarySmoke` captures the real scene and validates the walk and conversation. An added `sanctuary-entry` journey-smoke stage exercises the real transition from a completed record.

## Cycle sanctuary refinement v09 (2026-09-25)

- `refine_water_cycle_v09.py` preserves v08 and moves the tall entrance-side boiler pipe to a buried connector and perimeter riser at X=6.5, with the upper run at Y=4.65. Unity's steam line follows the same authored route.
- Replaces thin ramp skins with 24 closed sloped stone slabs, continuous handrails and grounded stone cheeks. The old ramp renderer is hidden, not its collider. Existing incline and gallery datum remain unchanged.
- `WaterInteriorArt.Cycle` imports `cycle-hall-v09`. Static geometry is 137,676 triangles; no performance improvement is claimed.

## Cycle sanctuary Blender art v08 (2026-09-25)

- `build_water_cycle_v08.py` preserves v07 sources, reuses the glacial hall, and authors grounded gallery trim, sloped ramp paving, bronze boiler/conduits, valve wheels and the decorated sanctuary basin at the existing gameplay coordinates.
- Native `art/glacier-water-temple/interior/v08/cycle-hall-v08.blend`; static export 132,928 triangles. `WaterInteriorArt.Cycle` is called by the connected journey builder for both source and journey cycle scenes.
- Existing gate, return-bridge and collector detail assets are attached. Blockout renderers are selectively hidden; original colliders and puzzle timing remain. Same phase-water material and temple lighting as the first room.
- This is an initial art pass for the cycle room; no performance claim or final reference-quality claim.

## Final water-room guidance (2026-09-25)

- `WaterCycleRoom.Objective` derives stages from water quantities, route, valve, collector temperature and actual bridge/gate colliders. It explains reusing the four units frozen in the crossing after the remaining two fail to meet the five-unit sanctuary threshold.
- Three-line HUD shows sanctuary/crossing/recovery volumes, the immediate cause or reuse clue, and controls. No thaw instruction before permanent return support is ready.
- `WaterBraceletLab.RefreshHud` presents cycle guidance directly; cycle smoke captures use that same entry point. Puzzle conditions and save schema unchanged.

## Collection-room guidance (2026-09-25)

- `WaterCollectionRoom` derives actionable objectives from plate temperature/alignment, boiler and recovery contents, and physical bridge readiness. HUD shows collected percentage against the 3-unit unlock threshold and recoverable volume.
- The existing predicted drop line remains visible after releasing a cooled collector; hidden with notebook and after bridge latch. Alignment has both text and colour feedback.
- `WaterBraceletLab.RefreshHud` also presents collection objectives, shared with smoke captures. Mass/phase mechanics and save format are unchanged.

## First water-room guidance (2026-09-25)

- `WaterIceRoom.CurrentStep` derives first-room objectives from bracelet, physical water quantities, support readiness, recovery and door states. Completion/far-bank progress takes priority over optional water reuse.
- `WaterIceGuide` draws one reusable 48-point gold ring at the current device/safe landing; no path through an unsafe gap. Hidden during notebook/opening/completion. Built only for the first room.
- `WaterBraceletLab.RefreshHud` is shared with smoke captures; first-room power controls are hidden until acquired, with reach/blockage feedback for selected targets.
- `RestoreProgress` now explicitly resets bridge/gate transforms and colliders for false as well as true states. Save format unchanged. Added first-room regression cases for stage routing and reset; rerun journey tests.

## Glacier wall geometry v07 (2026-09-25)

- `refine_water_glacier_v07.py` preserves v04 sources, replaces only named glacial scenery with folded continuous walls and attached fracture slabs, and exports v07 halls.
- Removes rear cube-grid ice and old disconnected veining. Frost crests follow slab edges. Geometry stays outside the authored walking corridor and reaches below the floor datum; colliders unchanged.
- `WaterInteriorArt` imports the v07 static halls; latest gate ceremony and phase-front materials remain connected. Static triangles: ice 111,300; collection 152,080.

## Ice crossing phase-front presentation (2026-09-25)

- `TemplePhaseWater.shader` uses target-local Z and conserved ice fraction for a jagged advancing/receding freeze front. Liquid ripples continue with stable time; frozen areas stop rippling. No vertex displacement or particle spawning.
- `WaterBraceletTarget.Present` supplies `_IsCrossing` and `_SolidReady` from the actual support collider. Dashed amber margins indicate unsafe water/partial ice; continuous pale margins only appear when the support is enabled. Heating removes both together.
- Existing all-or-nothing support rule remains: partially frozen areas are not locally walkable. Quantities, rates and save format are unchanged.
- First-room smoke captures water, half-frozen, fully frozen and thawing states and checks presentation/support agreement. Evidence: `reports/2026-09-25/water-phase-front`.

## Water gate opening ceremony (2026-09-25)

- `WaterGateCeremony` drives local-space material glow and one-shot positional audio from the existing first-room unlock. Total two seconds: .7s stationary illumination, 1.3s eased lift; collider remains until fully open.
- `RestoreProgress` silently applies the final opened presentation; repeated interaction does not replay the cue. Notebook pause also pauses the source. Unadorned cycle-room gates retain the prior timing.
- Editor generates a deterministic 2.2s PCM clip under `Generated/WaterGateCeremony`. Four-stage screenshots and repeat/restore assertions are part of first-room smoke. Journey test now waits for the longer first gate sequence.
- PC renderer uses Forward+: both custom seal and stone shaders must include `_FORWARD_PLUS` for room bounce lights. Do not compensate for a missing lighting variant by flattening their albedo or making them fully emissive.

## Water gate emblem v06 (2026-09-25)

- `build_water_gate_v06.py` creates a separate Blender relief: dark enamel panel, gold concentric rings, large faceted water droplet, radial inlay and corner filigree. 6,864 triangles, four material batches.
- `WaterInteriorArt` imports `ice-gate-detail-v06` under the moving gate and retains parent-scale cancellation. `CorrectGateAndBuild` replaces only matching ornament children in the first-room source and journey scenes, then builds existing scenes.
- First-room smoke now also captures `gate-detail.png` from a closer camera. No gameplay conditions or colliders changed.

## Water interior material pass v05 (2026-09-24)

- Retains v04 Blender meshes, isolates generated materials/meshes in `Generated/WaterInteriorV05`.
- `TempleWeatheredStone.shader` adds procedural mineral variation and pores, with darker glossy damp areas only on upward-facing surfaces. Uses URP PBR lighting and room reflection probes.
- `TempleReflectionCapture` requests one 128px realtime probe capture after initialization, time-sliced across faces. No per-frame capture loop. Reflection represents initial surroundings; it does not track moving devices continuously.
- `TemplePhaseWater.shader` reduces the dense tiled appearance of ice cracks and adds broad internal colour variation. It remains opaque; no transparency/refraction claim.
- Room mechanics, collider layout and save format are unchanged. See `reports/2026-09-24/water-interior-v05/REPORT.md` for validation.

## Water interior grounded architecture v04 (2026-09-24)

- `tools/blender/refine_water_interior_v04.py` opens v03 and exports preserved v04 native scenes: ice 115,168 triangles; collection 152,720. Blender work replaces flat conduit ribbons with filleted bronze pipes/couplings, adds solid stair risers, gallery apron/piers, fitted lower floor, rear masonry, ornamented receiver and first-room portal relief.
- `WaterInteriorArt` uses `Generated/WaterInteriorV04`, hides matching blockout renderers (including LineRenderers), retains original colliders, and tilts only the collector visual/detail by 20 degrees. No change to water quantities, capture range, save schema or movement.
- Glacier sheets use coherent material assignment and interpolated exported normals; bronze pipe normals are also interpolated. The first draft's overlapping rear masonry was removed. `finish_water_interior_v04.py` is an idempotent cleanup of that draft; the main generator already produces the corrected layout.
- Build using `BuildWaterTempleJourney.Build` after BOTH Blender exports finish. Earlier standalone builders still generate blockouts. V04 remains a visual iteration; reference-level wet reflections and translucency are not complete.

## Water interior Blender refinement v03 (2026-09-24)

- `refine_water_interior_v03.py` opens preserved v02 native Blender scenes and produces v03 barrel vaults/skylight, continuous glacial faces, subtle stone damage, carved friezes, retaining walls and fitted gallery/stair surfaces. Geometry: ice hall 104,984 triangles; collection hall 62,704, excluding reused v02 moving accessories.
- `WaterInteriorArt` now imports v03 static halls into separate `Generated/WaterInteriorV03` assets; moving gate/bridge/collector detail remains v02. Parent-scale cancellation on the gate is retained. Gameplay colliders and save schema are unchanged.
- Stone albedo and normal textures are 512-square assets; mesh tangents are recalculated. `InteriorGlacier.shader` is separate from the exterior ice shader and renders authored interior sheets on both sides. Interior ambient lighting, three unshadowed bounce lights and mild distance fog are authored in the builder.
- Use the connected journey builder to regenerate. Old standalone blockout builders alone do not apply this art. Evidence and remaining visual differences: `reports/2026-09-24/water-interior-v03/REPORT.md`.


## Water interior reference art and collection refinement v02 (2026-09-24)

- `tools/blender/build_water_interior_v02.py` generates five native Blender sources under `art/glacier-water-temple/interior/v02` and material-batched JSON under `Models/WaterInterior`. `WaterInteriorArt` imports via Unity APIs, preserving asset GUIDs. Native geometry uses game metres/Y=0 datum; movable gate/bridge/collector detail is local to its owner.
- `BuildWaterTempleJourney.Build` regenerates base scenes, applies reference art to first/second source scenes, then creates connected copies. Regression source scenes are also packaged. Individual old room builders still regenerate unpolished blockouts; use the connected build for art. Existing campaign scenes/build settings remain separate.
- `WaterCollectionRoom.CaptureFraction` continuously models receiver overlap: full collection within .55m offset, partial between .55m and 1.05m, none beyond. Only cold boiler condensate can enter the receiver, capped at four; rejected mass goes to recovery. Existing three-unit latch and conservation remain. Flow status and landing preview explain warm/misaligned/success states. Steam endpoint follows the plate.
- `TemplePhaseWater.shader` visualizes waves/ice fracture; `_Frozen` is supplied from existing target phase state. It does not replace physical water/ice rules. Decorative meshes keep original traversal colliders, so fine visual geometry is not a new precise collision surface.
- Validation: first room 31, collection 39, cycle 35, journey/restart 32 checks. Actual game images, art iteration and limitations: `reports/2026-09-24/water-interior-v02/REPORT.md`.


## Connected water interior journey (2026-09-24)

- `BuildWaterTempleJourney.Build` creates three derived scenes (`WaterJourneyIce`, `WaterJourneyCollection`, `WaterJourneyCycle`) and an independent Windows executable. `BuildExisting` rebuilds those existing copies without regenerating geometry. Main campaign entrance/build settings remain unchanged.
- `WaterTempleJourney` owns ordered scene transitions and snapshot scheduling; each room still owns its puzzle rules. The bracelet is acquired once. Final physical exit persists the three-room completion, without implying guardian/reward/seal integration.
- `WaterJourneyStore` stores versioned device phase masses/plate coldness, rail position, stable traversal flags, route/valve and acquired state in `water-interior-journey-v1.json`. Changed snapshots save at most once per second, plus focus loss/pause/quit and before transitions. Atomic replacement keeps `.bak`; invalid/newer/incompatible records are preserved. Check total mass, finite values and device IDs before restoring.
- Unity serializes a null array as an empty array: both represent a newly entered room before its first full snapshot. `HasWater` normalizes this boundary. In-memory pending entry also allows scene progression after disk failure without redirecting to the old room.
- Restore to a safe bank/gallery, never midair or with rail input locked. A changed water state stays unchanged. This is a local Windows prototype; no campaign doorway, restart menu, final art or multiplayer is included.
- Validation launcher `unity/check-water-journey.ps1` uses a fresh isolated save and five separate game processes. See `reports/2026-09-24/water-temple-journey/REPORT.md` for results and fixture limitations.


## Water collection room (2026-09-24)

- `BuildWaterCollectionRoom` builds standalone `WaterCollectionRoom`, reusing the bracelet trial avatar/UI. Fixed layer-9 stairs reach the management gallery independently of the exit bridge. Main campaign build scenes remain unchanged.
- `WaterCollectionRoom` owns continuous collector rail movement, geometric drop alignment, float tank and latched exit bridge. Initial water mass four; three in the receiver raises the bridge. Wrong alignment/warm plate returns water to the recovery pump. Receiver is a protected target; cold preparation survives plate movement.
- `PlanetExplorer.InputLocked` defaults false and suppresses raw locomotion input while the rail is held. The collector releases this lock on E/Escape, notebook, loss of grounding/range or disable. Manual Step remains available for gravity and validation. Bracelet casting rejects locked input.
- `WaterBraceletTarget` scales water surfaces from their original bottom, keeping the basin datum fixed as volume changes; full ice support thresholds remain unchanged.
- Windows collection checks: 35 passed. Bracelet regression: 27 passed. Planet movement regression passed. Evidence and limitations: `reports/2026-09-24/water-collection-room/REPORT.md`.
- Three standalone water-room prototypes now exist; this does not imply room-to-room transitions, persistent puzzle saves, final Blender art, guardian ending or multiplayer.

## Water circulation prototype (2026-09-24)

- `BuildWaterCycleRoom` creates an independent `WaterCycleRoom` scene/executable, reusing `WaterIceRoom` crossing and return bridge. The first room stays independently buildable; default behavior is preserved when `cycle` is null.
- Six conserved units, four required for the crossing, five required to unlock the exit. `WaterCycleRoom` owns routing-pump mode, upper valve, boiler/collector/sanctum routing. Only boiler vapour can reach the sanctuary, and only with an open upper valve plus prepared cold collector. Other vapour returns to recovery; pump restores supply only.
- Ramp and gallery use authored layer-9 supports. Decorative under-ramp pillars have no collision. Upper interaction requires grounded arrival at gallery height. `WaterBraceletLab.CanReach` now considers both obstacle and support layers, allowing its own target surface.
- Sanctuary reservoir is a protected receiving target (`acceptsPower=false`), so partial success persists within the session. No new persistent save format is present.
- Windows cycle smoke: 35 passed; first-room regression: 31 passed. Evidence: `reports/2026-09-24/water-cycle-room/REPORT.md`. Key test explicitly shows two remaining units cannot solve the room, melting the bridge allows completion, and closed-valve/warm-collector failures are recoverable without mass loss.
- Functional blockout only; no deity, reward, sealing, second-room transition or campaign integration is implied.

## Water temple ice crossing (2026-09-24)

- `BuildWaterIceRoom` derives a separate `WaterIceRoom` scene from the ability trial. Independent Windows build: `Builds/WaterIceRoom/WaterIceRoom.exe`. Campaign entrance and persistent water saves remain unconnected.
- Reservoir starts with four units of ice. Melting feeds the trough; full freezing enables its authored support collider. First-room gap is five metres. No support is fabricated from the Y=0 datum.
- `PlanetExplorer.EnableFlatCollisions()` opts this scene into layer-9 support raycasts and actual falling. Existing flat and planetary movement paths remain defaults elsewhere.
- `WaterIceRoom` latches a permanent return bridge after grounded arrival, rescues falling players to the last bank without resetting water, captures vapour for a physical recovery pump, and opens the exit gate on nearby E interaction. Walking beyond the gate marks this standalone first room complete.
- Windows first-room smoke passed 31 checks, including running-jump bypass prevention, standing on ice, melting underfoot, checkpoint return, stone-bridge return, refill and exit. Existing planetary movement smoke passed using the same updated player assembly. Evidence: `reports/2026-09-24/water-ice-room` and `water-ice-movement`.
- Final visual assets and second-room scene transition are not implemented by this slice. Geometry is functional blockout, not the AI reference's finished art.

## Water bracelet ability trial (2026-09-24)

- `BuildWaterBraceletLab` creates an isolated `WaterBraceletLab` scene and separate Windows executable under `Builds/WaterBraceletLab`; main build scenes remain unchanged.
- `WaterPhaseState` owns conserved ice/liquid/vapour mass; `WaterPhasePress` locks one source phase per press and preserves partial changes on cancellation. `WaterBraceletLab` owns pickup, six-metre/LOS/input gating, collector preparation and captured-water return.
- `NavigatorPose.SetWaterAim` adds opt-in left-arm aiming; default movement and pose branches are preserved. The trial reuses flat movement: an enabled ice support collider does NOT yet imply traversable-gap integration.
- Session-only trial state, prototype geometry and flow lines. No interior campaign, persistent bracelet save, final Blender cuff, multiplayer or main entrance integration is implied.
- Windows runtime API smoke: 27 checks passed, screenshot and clean exit confirmed. `reports/2026-09-24/water-bracelet-lab-final/REPORT.md` describes validation and limitations. Use `unity/check-water-bracelet.ps1` to rerun.

This is a new, separate Unity slice of the existing Three.js game at the repository root. Preserve that game and its Blender source files. Do not conflate completing the slice with migrating the entire product.

- Editor: 6000.0.84f1; official URP 3D template; new Input System.
- Local desktop target first; WebGL target and online cooperation remain unvalidated.
- Original world coordinates are right-handed. Import positions/normals with Z reflection, rotations with (-x,-y,z,w), triangle winding reversed. Apply this once, in `BuildExploration`.
- Grounding samples the imported terrain and grass colliders, choosing the higher surface. Player feet are the actor transform origin. Visual height is 1.5 units.
- PlanetExplorer owns movement/jump state; Animator/NavigatorPose present that state. Camera movement happens in LateUpdate.
- No account, networking, cloud service, payment or online save service is enabled by this slice. Independent local completion and mid-journey records exist for the weight temple. Template package presence does not imply product integration.
- Scene generation is an explicit tool, not an auto-on-import hook. Generated scene/assets are reproducible; duplicate the scene before manual level editing.
- Runtime validation uses the explicit `-mumu-smoke <output-directory>` flag. It checks grounding, jump height/landing, authored ridge traversal, radial orientation and skin deformation; screenshots accompany the results.
- Preserve Unity-generated GUIDs. Do not hand-edit scenes or package manifests. Install dependencies through Unity Package Manager APIs when a feature actually needs them.

See `unity/README.md` for controls, migration order and scope limitations.

## Water cliff v03 (2026-09-24)

### Glacier sanctuary v02 grounding correction (2026-09-24)

- Current sanctuary art: `glacier-temple-v03.json` and `glacier-seal-v03.json`, generated by `tools/blender/build_glacier_water_temple_v03.py`. Prior v01/v02 source remains preserved. V03 refines the v02 angular ice silhouette and adds chipped surfaces, cornice details and a water emblem. Grounding remains the v02 implementation. V03 water checks (140) and movement passed; evidence is in `reports/2026-09-24/glacier-temple-v03`.
- Sanctuary has its own radial up vector. Sample the complete building plot along this normal using `PlanetSurface.RaycastTerrain`, excluding elevated colliders. `GlacierFooting` joins the level datum to terrain and samples terrain vertex colours for the outer blend. Do not restore the floating cylinder basin or mountain-root orientation.
- `IceThawPresentation` now presents a continuous radial-cutout seal using a property block; its receiver collider stays fixed until completion. Older piece fields remain for compatibility.
- Grounding evidence: perimeter error <=0.0193m, 140 water checks and basic movement passed. Ground-level front/side screenshots: `reports/2026-09-24/glacier-temple-v02`. These checks establish grounding/gameplay, not photorealistic art quality.

### Visual revision v04

Latest cliff visual revision is **v05**: `art/water-temple-mountain/v05/design-spec.json` defines seven 12-point horizontal sections used by both `tools/blender/plan_water_mountain_v05.py` and `build_water_mountain_v05.py`. One closed asymmetric body replaces broad stacked terraces; rear/west erosion and embedded ribs are visual additions. Six orthographic renders, 12 orbit renders, blueprint, native .blend and review HTML accompany it. `ImportArt` now reads `water-mountain-v05.json`; v04 altar/head and v03 traversal collisions remain preserved. 48,850 visual triangles; no open/nonmanifold edges in the main body. Water smoke: 133 checks plus movement passed. See v05/DESIGN.md for limits and evidence.

- `tools/blender/build_water_mountain_v04.py` opens the preserved v03 native source, replaces block courses with continuous eroded surfaces and exports v04 cliff, solar altar and movable mirror separately. Source/reference/renders: `art/water-temple-mountain/DESIGN-v04.md`. The generated concept is a target, not a screenshot.
- `BuildWaterMountain.ImportArt` preserves mesh assets and imports normals, planar UVs and material batches. Recalculate outward normals before export: Blender renders backfaces while Unity culls them. The old cliff renderers are hidden, with their traversal collision retained; do not duplicate collisions for visual decoration.
- V04 visual triangle counts: cliff 98,130, altar 5,144, mirror 5,676. Performance on classroom hardware has not been measured. Windows water smoke passes 133 checks plus ordinary movement; final captures under `reports/2026-09-24/cliff-art-v04-final`.

- Ice thaw: `IceThawPresentation` animates 56 doorway pieces from center outward and a local warm rim, plus bounded water ribbons over the foundation edge. `WaterMountainTrial` retains a full-size sunlight receiver until completion; never shrink that collider with the visuals. Completion uses the existing local entrance record and a cancellable camera reveal. `BuildWaterMountain` faces the temple's local -Z doorway toward the mirror (positive X/Z forward rotation), avoiding the former rear-wall occlusion. Report: `reports/2026-09-24/ICE_THAW_PRESENTATION.md`.

- Summit discovery: `WaterMountainTrial.TryDiscoverSummit` triggers only after completed summit mantle, grounded arrival near the mirror, and no open notebook/ice completion. Once per scene visit; no new save schema. `OrbitCamera` owns a 3.2-second mirror-to-sanctuary reveal; movement, RMB, Escape, notebook or component disable cancel it without disabling player movement. Mirror interaction cancels it before taking camera ownership. Windows water smoke passes 128 checks; movement regression passes. Evidence: `reports/2026-09-24/SUMMIT_DISCOVERY.md`.

- The approved reference is option 1 in `art/water-temple-mountain/cliff-options-v03.png`: warm layered sandstone. The rejected v02 and its source are preserved. Detailed scope and coordinates: `art/water-temple-mountain/DESIGN-v03.md`.
- `tools/blender/build_water_mountain_v03.py` exports material-batched geometry and typed `anchors` together. `BuildWaterMountain` reads those anchors rather than maintaining a second coordinate table. Generated rock meshes provide collision; the smooth authored path guides narrow shelf grounding. Regeneration cleans the previous colliders and standalone frozen sanctuary.
- `MountainClimbController` owns hang/mantle/leap/checkpoint state. Gap leap requires up-right direction and at least 0.35 seconds preparation; releasing Space attempts it. No upper timeout. Wrong direction/short preparation visibly misses and restores the last visited checkpoint. Middle checkpoint requires grounded arrival. Normal locomotion remains in `PlanetExplorer`.
- Elevated locomotion ignores walkable slope normals for wall blocking and allows a clear 0.32m capsule step, while the existing ground-rise rule still prevents climbing tall walls. This branch is opt-in for the mountain.
- Only the exterior and mirror/ice interaction are part of this slice. No water interior scene or full-body contact IK is implied.

### Climb contact presentation (2026-09-24)

- `MountainClimbController` caches hand contacts on the rock face and searches nearby foot purchases on first use of each hold. Root hanging position follows those hand contacts. Feet beyond the navigator's reach remain free on overhangs instead of stretching toward a distant wall.
- `NavigatorPose` applies two-bone hand/foot contact corrections after its base pose, using the existing reflected-FBX-safe local rotation solve. Palm axes are cached from the imported pose; toes face the rock. The imported rig has no individual finger bones, so there is no independent finger curling or full-body collision IK.
- Ordinary reaches stagger the hands; airborne leaps fade contact correction in near the catch. Mantles pull upward before moving over the lip, over 0.9 seconds. Release, missed jumps and finished mantles clear the contact pose.
- Verified Windows evidence: `reports/2026-09-24/climb-contact-v03/result.json` (107 checks, including contact error and repeated-solve drift); `climb-contact-exploration/result.json` passes the existing locomotion checks. Measured stable wrist error at eight sampled holds is at most 0.018m; this is joint-target error, not a guarantee of finger-surface contact throughout motion.

## Weight temple mid-journey persistence

- `TempleJourney` writes `temple-journey-v1.json` independently of the permanent `temple-completion-v1.json` seal. Scene, difficulty, slot/floor positions and lever fulcrum are checkpointed on mutations. Carry-in-progress resumes from the last stable placement; the actor respawns at the room entrance.
- The shipped `StarsailIntro` resumes a departed voyage directly into an unfinished room. Leaving to the planet and re-entering the door resumes the same room. A completed seal overrides an old journey; successful guardian completion marks the journey inactive.
- Corrupt/newer journey records are preserved, not overwritten. `-mumu-journey-file` isolates tests; an existing `-mumu-progress-file` also derives an isolated journey path. `unity/check-temple-journey.ps1` runs three separate Windows processes and `unity/check-temple.ps1` still exercises the complete temple and seal reload.

## Starsail opening

- The first Windows build scene is now `StarsailIntro`, followed by `PlanetExploration` and the three weight rooms. Do not put the ship geometry in the planet scene. The original web ship remains intact.
- `tools/blender/export_unity_starsail.py` reads preserved `art/starsail/starsail-v02.blend` and exports a Unity FBX plus material palette. `BuildStarsailIntro.Create` clones the current navigator/camera into a flat-deck scene, instantiates the 14-batch Blender ship, and creates a bounded deck, parcel, stars and distant planet through Unity Editor APIs.
- `StarsailIntro` owns the starboard winch, recovered parcel, notebook read/close, three separate stern dials, and departure. The notebook carries the web rule `3 · 5 · ?`, third digit = first two summed; dials turn 0–9 and only `3 · 5 · 8` unlocks the helm. Its visible TMP digits face the player and the closest dial wins within its reach radius. `NotebookUI.SetAvailable(false)` prevents reading before finding the parcel. Existing opt-in smoke flags bypass the ship to preserve their planet entry point.
- The pre-recovery parcel hangs beyond the starboard rail from a three-point cable and small outboard boom. `StarsailIntro` keeps the cable attached while the parcel bobs and during retrieval, then hides it on deck. `BuildStarsailIntro.Create` owns the generated rig and parcel visuals. `StarsailSmoke` captures the side view and checks the cable connection.
- `StarsailProgressStore` uses a separate version-1 file (`Application.persistentDataPath/starsail-intro-v1.json`) and records parcel, reading, dials, solution and departure. A completed voyage resumes on PlanetExploration after process relaunch. `-mumu-intro-file` redirects validation; `-mumu-ship-preview` replays without modifying the saved record. Unknown/corrupt records are preserved. `-mumu-ship-smoke` and `-mumu-ship-resume-smoke` validate full play and relaunch. The completed temple record still belongs to `TempleCompletionStore`; neither account nor remote saving is used.

## Quest guide and local chart

- `QuestGuide` reads ship chapter or planet temple completion, never changes puzzle state. The top card toggles guidance with the local `Mumu.QuestGuide.Enabled` preference (off by default). Ship targets are winch, parcel, course console, helm; planet target is the actual temple entry point. Interior rooms keep their puzzle HUD; the guide does not draw through locked gates.
- One URP particle system draws 96 soft sparks from explorer to target. The planet route samples `PlanetSurface.Point` at 32 points only when the player has moved .65m or the target changes, then interpolates the 96 spark positions; intervening frames reuse cached surface positions. Notebook/modal or disabled movement clears the effect. The arrow uses camera-relative direction and distance is approximate walking distance.
- `BuildNotebook.AddMap` upgrades existing notebook scenes to four pages without regenerating terrain or temple content. The fourth page is a **nearby landmark chart**, with saved landing origin, live player marker and temple marker. It does not claim to be the web game's full map. Ship and interior rooms display an availability note.
- `Mumu.Editor.BuildQuestGuide.CreateAndBuild` upgrades existing planet/temple notebook scenes, adds planet guidance, regenerates the ship scene, then builds Windows. `-mumu-guide-smoke` tests 1440×900 and 960×540 via `unity/check-quest-guide.ps1`.

## Navigator pose regression notes

- Procedural limb targets must originate at the actual joint and follow a direction using the measured bone length. Absolute actor-space elbow coordinates previously lifted the arms sideways after import/scaling.
- For evaluated skin height and grounding, use `SkinnedMeshRenderer.BakeMesh(mesh, true)` before transforming vertices through the renderer transform. The default scale handling produced incorrect measurements in this rig.
- `NavigatorRigAudit.FixAndBuild` normalizes the existing scene, records source/corrected joint measurements, and builds without regenerating the world. `Run` alone is diagnostic.
- The Windows smoke now verifies resting arms, non-accumulating corrections, evaluated height/feet and jump knee bends. On 2026-09-20 all 34 checks passed; front/side idle and side jump screenshots were inspected under `reports/2026-09-20/unity-rig` at the repository root.

## Locomotion continuity regression

- Navigator.fbx contains a zero-frame idle with no animation curves. Its reported clip length of 1 is misleading: damped transitions back to idle caused BlendTree normalized time to reach 1e11 and locomotion to freeze when restarting.
- `BuildExploration.EnsureIdleClip` records the imported model's local joint transforms as explicit constant keys at 0 and 1 seconds. Use this generated idle in the movement tree; setting only clip metadata is insufficient. Preserve original FBX assets.
- `LocomotionAudit.FixAndBuild` applies the targeted controller repair and checks repeated stop/turn/restart cycles before building. Windows smoke also measures sustained leg motion and bounded animation time across these transitions; a one-frame skin deformation check is insufficient.
- The corrected Windows build passed all 54 checks on 2026-09-20. Evidence: `reports/2026-09-20/unity-sliding` (baseline/fixed audits, locomotion windows, result JSON and inspected screenshots).

## Weight temple first room

- `WeightTemple.unity` is a separate generated flat scene reached through `TempleEntrance` near the planet spawn. PlanetExplorer's optional flatGround handles the room; null retains spherical movement. OrbitCamera reads the explorer's Up vector for both modes.
- `BalanceOrderState` owns box location and the selected 3/4/5 completion rule. `BalanceRoom` owns E/Q interaction, UI, scale/door presentation and carry attachment; NavigatorPose solves two arms to box grips without changing locomotion clips.
- All three weight puzzle rooms and the audience/escape/seal flow are implemented below. Puzzle room and layout progress now use a separate local journey record; temple completion remains its own permanent seal record. The first notebook UI reads completion. The other web notebook sections and networking remain unported.
- Blender FBX children retain their conversion transforms. Wrap parts with unit-scale Unity pivots before attaching grips; create fresh Unity-oriented pivots for the scale beam and pans. Do not overwrite imported local rotations with gameplay angles.
- TMP essentials import asynchronously. `BuildWeightTemple.RunBatch` waits for the resources and exits the batch process itself. `unity/build.ps1` rebuilds exploration, then this temple and the Windows player. Do not pass `-quit` to the RunBatch step.
- NanumGothic is embedded under Mumu/Fonts with its OFL license; the UI uses a static TMP atlas containing authored strings. Expand/rebake the atlas if adding new glyphs.
- Final Windows checks on 2026-09-20: 164 temple checks and 54 exploration checks passed. Evidence and reviewed screenshots live under `reports/2026-09-20/unity-weight-temple`. Restart explicitly returns the player to the entrance so a newly closed door cannot trap them.

## Weight temple second room

- `BalanceRoom` transitions to `TwinBalanceTemple` only after its solved gate is fully open and the player walks beyond z=11.9. The existing gate traversal checks at z=11.3 remain valid; the expanded smoke then crosses the scene transition explicitly.
- `TwinBalanceState` owns four distinct boxes of mass 1,2,3,4 and four cells (two per side). Both counts must be two and sums equal. Picking clears the original cell immediately; duplicate carry/occupied placement fail without mutation. Success locks the layout until restart.
- `TwinBalanceRoom` binds the same E/Q carry pose, moves pans toward weight-dependent heights, fills ten light segments per side, and opens the physical door after completion. Reset releases carry, clears meters and respawns before the gate. This room has no account/save/network state.
- `BuildTwinTemple.Create` derives a separate generated scene from room one, retaining its lights, HUD and corrected navigator. It replaces the first trial with Blender hall_twin, plinth/crate assets, twin frame decoration and two moving pans. `BuildWeightTemple.CreateAndBuild` generates both rooms before the Windows build. Export Blender parts first with `tools/blender/export_unity_balance.py`.
- `TwinTempleValidation`, called by the opt-in TempleSmoke, tests all 24 permutations, full/partial/wrong placements, physical correction by dropping/swapping boxes, meter updates, pan heights, gate collision/traversal and UI reset. TwinBalanceRoom now loads LeverBalanceTemple beyond z=11.9 after its solved gate is fully open, matching the first-room boundary.
- Windows build and all 345 combined first/second-room checks passed on 2026-09-21. Entry, incorrect balance and solved screenshots were inspected. Evidence: `reports/2026-09-21/unity-twin-temple`; report: `reports/2026-09-21/UNITY_TWIN_TEMPLE.md`.

## Final six-cell lever room

- `LeverBalanceState` ports `src/shrine/BalanceTrials.js: LeverSix`: masses 2 and 6, slots 0..5, pivot gaps 1..5 (initial 2). Integer doubled arm lengths preserve exact half-cell distances; both weights must be placed with positive equal powers on opposite sides. The 150 distinct placements across the five gaps contain eight solutions. No empty or partial solution, duplicate ownership or occupied-slot overwrite is allowed.
- `LeverBalanceRoom` reuses E/Q carry interactions and NavigatorPose; nearby front controls shift the support one gap. The support slides along a rail and the fresh Unity pivot rotates the preserved Blender beam without overwriting FBX conversion transforms. Slots, numerals and placed boxes rotate together. Distance units are cell spacings, not world metres (one spacing is 1.4m).
- `BuildLeverTemple.Create` copies the generated first-room shell to a separate scene, replaces only that copy's first trial with Blender hall_lever/lever/fulcrum, and retains the corrected navigator, camera, input, lighting, gate and HUD. Export the additional parts using Blender `tools/blender/export_unity_balance.py -- --lever-only`. The full temple build now creates all three scenes and includes LeverBalanceTemple in the Windows build.
- The lever gate opens only after the two torques balance. Reset releases carry, closes the gate, resets support/tilt and respawns before it. Manual planet return remains available until the guardian encounter starts; the audience then owns completion and automatic return.
- TempleSmoke traverses first -> second -> lever, then runs LeverTempleValidation and returns to the planet. The lever suite uses an independent centre-of-mass oracle for all layouts and physically tests carry, support shift, wrong balance, drop/re-pick, correct balance, gate traversal and UI reset. Opt-in `-mumu-lever-preview` opens the last room directly for review; it is not a save/resume feature.
- Final Windows build and all 733 combined temple checks passed. Player-view, entry overview, incorrect-balance and solved screenshots were reviewed under `reports/2026-09-21/unity-lever-temple-final`; report: `UNITY_LEVER_TEMPLE.md`. Control labels have dark backing tablets. Overview capture cameras stay inside the walls to avoid shooting through the front columns; the separate player-view capture uses the actual OrbitCamera.

## Guardian encounter and completion persistence

- `BuildTempleAudience.PopulateRoom` extends only the generated lever scene with Blender v04 `guardian`, a connected stone audience hall and one combined halo mesh. It reuses the existing font/UI helpers and adds no packages or realtime lights. `PopulateExterior` adds the inactive gold seal and arrival flash. Both are included in the full temple generators; `CreateAndBuild` targets the saved exterior plus lever scene.
- `TempleAudience` starts only after the lever is solved, its gate is open, and the grounded player approaches the guardian. It owns four dialogue lines (4.5 seconds each, or E/Space/UI next), debounces input, temporarily disables player/camera control and blocks reset/manual return. The final line commits completion, fades to gold and automatically loads PlanetExploration; existing entrance return-position handling is retained.
- `TempleCompletionStore` stores version 1, balanceCompleted and a lesson in `Application.persistentDataPath/temple-completion-v1.json`. This is completion-only saving, not puzzle-layout/notebook migration. Writes use a temporary file and replacement backup; unreadable/newer records remain untouched and completion then lasts only for the session. `TempleProgress` clears its runtime cache at SubsystemRegistration.
- `TempleEntrance` shows the completion seal, refuses both normal and direct entry once completed, and fades the arrival flash. An uncompleted temple retains the animated door/return/re-entry flow.
- `-mumu-progress-file <absolute-path>` isolates validation/preview records from real player progress. `check-temple.ps1` validates all three rooms and the encounter, then starts a fresh process with `-mumu-seal-smoke` to verify disk restoration and blocked entry. `check-exterior.ps1` also uses a fresh uncompleted record.
- On 2026-09-21 the Windows build, 762 combined temple checks, separate-process seal reload, and 56 uncompleted exterior/door regression checks passed. Actual audience approach/dialogue and sealed entrance screenshots were inspected. Evidence: `reports/2026-09-21/unity-temple-audience` and `unity-audience-exterior-regression`; report: `UNITY_TEMPLE_AUDIENCE.md`; build log: `tmp/unity-audience-build.log`.

## Equilibrium deity art replacement

- The original v04 guardian remains preserved but is no longer instantiated. `BuildTempleAudience` calls `BuildBalanceDeity.Create` for a separate Blender model based on `art/balance-deity/concept-v01.png` (AI concept). `blender-sculpture-v01.png` is the actual Cycles render; do not present the concept as game output.
- `tools/blender/build_balance_deity_v01.py` authors curved layered stone robes, an elongated mask, crown, articulated static gauntlets, suspended balance dishes/crystals, and concentric halo. It saves an editable native .blend and exports FBX plus evaluated JSON with corner normals in game Y-up/-Z-forward coordinates. That conversion is a rotation, so triangle winding stays unchanged.
- `BuildBalanceDeity` preserves generated mesh/material GUIDs and imports six material batches (90,300 triangles); it rejects more than 100,000 triangles or eight batches. The Blender source has 252 editable objects, not 252 game renderers. It introduces no new shader, packages, realtime lights or particle systems.
- The old floating ball and separate segmented wall halo are replaced by the modeled scale/halo and a small faceted blessing. Dialogue camera framing now includes the crown and both balance pans. Puzzle authority, trigger radius, dialogue text and completion save schema are unchanged. This is a static sculpture, not a new humanoid rig.
- Rebuild with `BuildLeverTemple.CreateAndBuild`; first/second rooms and exterior remain saved. Report: `reports/2026-09-21/UNITY_BALANCE_DEITY.md`; source/reproduction: `art/balance-deity/README.md`.
- Final dialogue camera stays at (3.25,3.9,13.3) inside the hall, looks at (0,2.9,20.8), and eases to FOV 56; restore the previous FOV on disable. Pulling back through z=12.6 at x=3.5 hides the deity behind the shoulder wall. Validation now checks mask line of sight and both pan/crown viewport bounds in addition to manual screenshot review. Final 766 checks and separate-process seal restoration passed; evidence: `reports/2026-09-21/unity-balance-deity-framing`, log: `tmp/unity-deity-framing-build.log`.

## Sanctuary exterior

- `BuildTempleExterior.Populate` replaces only the generated TempleEntrance children and retains HUD references. Its site is 9m forward and 6.5m left of the saved spawn, beside the existing ridge trail so the full building does not obstruct exploration. Orientation follows radial gravity and the entrance root uses unit scale. Full weight-temple regeneration calls the same builder.
- Blender source: `art/temple-exterior/weight-sanctuary-v01.blend`; generator: `tools/blender/build_temple_exterior_v01.py`. Evaluated mesh data is batched into six materials (12,236 triangles); FBX is also retained as an interchange asset. Unity creates Mesh/Material assets via Editor APIs.
- Blender-to-game `(x,z,-y)` is a rotation with positive determinant: preserve triangle order. Reversing it produces inward faces despite outward normals. The exterior smoke checks this and screenshots the actual imported rendering.
- Ground-following paving samples PlanetSurface; no new grounding surfaces are injected into the radial movement controller. Simplified layer-8 colliders block the side foundations, piers, rear wall and door. Entry is possible only within the front approach rectangle through `TempleEntrance.TryEnter`; existing `Enter` remains available to explicit temple validation.
- `-mumu-exterior-smoke <output>` validates appearance, budget, collision, physical approach, entry and return. The smoke persists across scene changes and guards against a duplicate run on return.
- Final exterior smoke passed 32 checks; the unchanged exploration smoke passed all 54 after moving the building off the ridge route. Evidence: `reports/2026-09-21/unity-temple-exterior-final` and `unity-exterior-movement-final`; report: `reports/2026-09-21/UNITY_TEMPLE_EXTERIOR.md`. Paving uses 4x4 subdivisions per tile to follow non-planar terrain without large intersections.
- Batch recovery: wait for the exact owned Unity process to exit before restarting. After a forced stop, a stale `Temp/UnityLockfile` may prevent reopening. Remove that single temporary file only after checking that no Unity process has this project open and successfully opening the file exclusively. Never stop unrelated project processes or clear the whole Temp/Library to work around this.

## Hinged sanctuary door (v02)

- `tools/blender/build_temple_door_v02.py` loads the preserved v01 Blender source and replaces only the flat portal and its stationary roundel. It saves `weight-sanctuary-v02.blend`, FBX and `exterior-v02.json`. Native left/right hinge parents retain editable detail; evaluated JSON meshes are hinge-local, grouped by leaf and material. Full exterior plus doors is 19,692 triangles / 13 batches (paving/text additional).
- `BuildTempleExterior` now consumes v02, creates separate hinge transforms at x=±1.28, z=1.55, and configures `SanctuaryDoor`. Never merge the moving leaves into the static building. Preserve positive face winding and the off-trail building site.
- `TempleEntrance` guards repeated entry, requires grounded proximity, stores the return position before disabling movement, and animates both leaves inward to 94° over 1.45 seconds plus a .25-second hold. Only then does it load WeightTemple. The threshold collider remains active during this controlled transition. Returning reloads closed doors and restores the player; OnDisable restores input if the opening is interrupted.
- Exterior smoke additionally checks leaf rotation, delayed scene transition, movement lock, return state, re-entry and captures half-open/open frames. TempleSmoke's existing Enter hook uses the same animation.
- Windows validation passed 56 exterior/door checks, 345 puzzle checks and 54 unchanged movement checks. Actual closed, half-open and fully-open captures were reviewed. Evidence: `reports/2026-09-21/unity-temple-door{,-puzzles,-movement}`; report: `UNITY_TEMPLE_DOOR.md`. Build log: `tmp/unity-temple-door-final-build.log`.

## Blender explorer notebook

- `BuildNotebook` adds a persistent visible book-icon/N launcher to the saved exploration and three temple scenes. It binds the current scene's player, orbit, entrance and audience without rebuilding their content. Full exploration/temple generators also call Populate; inherited notebook references are rebound after deriving later rooms. `RefreshFontAndBuild` rebakes new Korean characters before runtime-only text changes are built.
- Native source: `art/explorer-notebook/explorer-notebook-v01.blend`; generator: `tools/blender/build_explorer_notebook_v01.py`. Evaluated JSON has 6,852 triangles in six book/leaf material batches. The turn leaf has 850 vertices and its origin is the spine. Preserve original web notebook and all older Blender sources.
- `NotebookPresentation` shows the model through an orthographic URP camera at an isolated stage 1,200 units below the scene on reserved layer 31. The normal game camera's 240-unit far clip excludes the stage. Only the notebook camera sees layer 31; do not put unrelated content on this layer. RenderTexture is 1240x820 and released on close; the camera stops rendering. Only a page turn changes the leaf vertices, with cached arrays and a 0.58-second bend/rotation. The original mesh asset is never mutated at runtime.
- `NotebookUI` overlays crisp Korean TMP text on the paper; ink hides during a turn and fades back in. It has journal, experiment notes, controls and a local landmark chart; the web full map/foraging/cooking pages remain unported. Journal contents derive from the existing version-1 completion state; reading never changes that file. In the ship scene, it becomes available only after opening the parcel and presents the three-number course clue.
- Modal ownership: remember player/orbit enabled state, animator speed, and other Canvas enabled states, then restore exactly on close/disable. The book hides background HUDs, guards E/Q/reset/exit in each puzzle, and blocks entrance/audience activation. It cannot open during entrance animation or guardian dialogue. Scene unload/closing mid-turn must clear the static input lock. Avoid Time.timeScale and do not drop a held crate when opening.
- UI uses CanvasScaler Expand to keep the entire book visible across aspect ratios. N and Esc close; arrow keys and real pointer buttons turn. `NotebookSmoke` is installed only with `-mumu-notebook-smoke`; it checks actual input, raycast ordering, layout/glyph coverage, paper pixels, carry preservation, modal cancellation and scene transitions. Explicitly render the book camera before the synchronous batchmode screenshot, then render the main camera.
- Reproduction: `unity/check-notebook.ps1` runs isolated uncompleted/completed records at 1440x900, 960x540 and 1920x868. TempleAudienceValidation additionally checks that the real guardian completion unlocks the notebook record. Report: `reports/2026-09-21/UNITY_NOTEBOOK.md`.

## Wind meadow

### Cliff camera and contextual guidance (2026-09-24)

- `BuildWaterMountain` wires the existing `OrbitCamera` to `MountainClimbController`; hanging frames the player and next grip from outside the wall. Manual right-button orbit suspends assistance for two seconds. Existing camera collision remains active.
- Water mission text is parented under one contextual panel, hidden away from the water area and during notebook input lock. `TempleEntrance` suppresses its unrelated weight-temple prompt while that water context is active.
- Leap preparation shares `PrepareLeap` between input and validation; the HUD shows normalized 0.35-second preparation, using a left-pivot scaled Image (no sprite dependency).
- Windows build and 119 water checks passed; existing movement passed; quest guide passed 18 checks at each of two resolutions. Report: `reports/2026-09-24/CLIMB_CAMERA_AND_GUIDANCE.md`.

- Grass is OFF by default after the user's performance report. `MeadowGrass` persists `Mumu.Meadow.Visible` in PlayerPrefs, applies visibility immediately, and skips distance culling while off. `MeadowSettingsUI` provides a top-right uGUI button and G shortcut. Only foliage renderers are disabled; terrain/collision remain active. Mesh assets stay loaded; this is not a streaming/memory-release feature.
- `BuildMeadowSettings.CreateAndBuild` adds the UI to the saved exploration scene without regenerating foliage. `BuildMeadow.Populate` also adds the UI for full regeneration. The existing Korean font atlas receives the required glyphs. MeadowSmoke validates UI raycasting/clicks, disabled renderers, saved preference reload and wind-on frames, and restores the user's original preference in finally.

- `BuildMeadow.Populate` adds deterministic grass to the first exploration region (40 m chord radius from spawn). It samples the authored carpet and rejects submerged/bare path triangles, nature colliders and the temple approach. It does not replace terrain or its colliders.
- `Mumu/Meadow Wind` moves blade tips with spatially coherent wind; UV.y squared keeps roots fixed. Broad advected noise, small ripples and individual flutter are combined. Forward and depth passes share deformation and feather clipping. One material, double-sided blades, no per-blade objects or Update methods.
- Generated meshes use 6 m chunks with expanded bounds. `MeadowGrass` culls distant chunks every 0.2 seconds; the shader shrinks blades smoothly between 27 and 36 m. Grass receives shadows but does not cast them.
- `BuildMeadow.CreateAndBuild` updates only grass in the existing exploration scene and builds Windows. The full `BuildExploration.Create` also calls Populate. Preserve the existing rig/controller and temple scene.
- `unity/check-meadow.ps1` runs an explicit opt-in rendered check: root/tip weights, collision-free grass, shader support, different wind-time frames and deterministic repeat. This is not a frame-rate benchmark.
- Meadow leaf shapes now come from Blender: `tools/blender/build_meadow_leaves_v01.py` saves the .blend and exports FBX plus `Models/Meadow/leaf-profiles.json`. BuildMeadow consumes this evaluated mesh data; FBX is the interchange asset. Preserve the native source under `art/meadow-leaves`.
- UV2 stores card coordinates/type and stem height; UV1 remains the shared world root. Type 2 is a Blender leaf with 19 vertices (six folded cross-sections + tip); type 0 is a 7-vertex pampas stem; type 1 is its optional 8-vertex feather cross. Only type 1 uses feather clipping. Preserve these semantics in generation, shader and smoke checks.




