// 힐링 존 히어로 에셋 매니페스트. Meshy로 만든 GLB(assets/env/<glb>)가 있으면 그걸, 없으면 procedural 빌더(PROP_BUILDERS[fallback]) 사용.
// height=목표 높이(월드). yaw=GLB 정면 보정(도). onWater=물 위 배치(보트/부두).
export const HERO_ASSETS = {
  palm_tree:        { glb: 'palm_tree.glb',        height: 5.5, fallback: 'palmTree' },
  beach_parasol:    { glb: 'beach_parasol.glb',    height: 2.8, fallback: 'parasol' },
  rowboat:          { glb: 'rowboat.glb',          height: 1.3, fallback: 'rowboat', onWater: true },
  stone_lantern:    { glb: 'stone_lantern.glb',    height: 1.7, fallback: 'lantern' },
  big_tree:         { glb: 'big_tree.glb',         height: 6.0, fallback: 'tree' },
  mushroom_cluster: { glb: 'mushroom_cluster.glb', height: 0.9, fallback: 'mushroom' },
  beach_rock:       { glb: 'beach_rock.glb',       height: 1.6, fallback: 'rock' },
  flower_bush:      { glb: 'flower_bush.glb',      height: 1.1, fallback: 'bush' },
  wooden_dock:      { glb: 'wooden_dock.glb',      height: 0.6, fallback: null, onWater: true },
  picnic_table:     { glb: 'picnic_table.glb',     height: 1.0, fallback: 'logBench' },
};
