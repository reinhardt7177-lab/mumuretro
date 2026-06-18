// 힐링/구역 히어로 에셋 매니페스트. Meshy GLB(assets/env/<glb>)가 있으면 그걸, 없으면 procedural 빌더(PROP_BUILDERS[fallback]).
// height=목표 높이(월드). onWater=물 위 배치. fallback=null이면 GLB 없을 때 스킵.
export const HERO_ASSETS = {
  // ── 기존(해변/숲/들판) ──
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

  // ── M6 구역 시그니처 앵커 ──
  cabin:            { glb: 'cabin.glb',            height: 4.0, fallback: 'house' },
  lighthouse:       { glb: 'lighthouse.glb',       height: 8.0, fallback: 'bathhouse' },
  windmill:         { glb: 'windmill.glb',         height: 7.0, fallback: 'bathhouse' },
  gazebo:           { glb: 'gazebo.glb',           height: 3.6, fallback: 'pyeongsang' },
  pagoda:           { glb: 'pagoda.glb',           height: 7.0, fallback: 'bathhouse' },
  torii_gate:       { glb: 'torii_gate.glb',       height: 3.5, fallback: 'fence' },
  telescope:        { glb: 'telescope.glb',        height: 1.8, fallback: 'streetlamp' },
  barn:             { glb: 'barn.glb',             height: 4.5, fallback: 'house' },
  post_office:      { glb: 'post_office.glb',      height: 4.0, fallback: 'cornerShop' },

  // ── M6 필러 ──
  wooden_bridge:    { glb: 'wooden_bridge.glb',    height: 1.2, fallback: null, onWater: true },
  lotus:            { glb: 'lotus.glb',            height: 0.4, fallback: null, onWater: true },
  duck:             { glb: 'duck.glb',             height: 0.5, fallback: null, onWater: true },
  koi:              { glb: 'koi.glb',              height: 0.3, fallback: null, onWater: true },
  deer:             { glb: 'deer.glb',             height: 1.4, fallback: null },
  sheep:            { glb: 'sheep.glb',            height: 1.0, fallback: null },
  haystack:         { glb: 'haystack.glb',         height: 1.2, fallback: null },
  hammock:          { glb: 'hammock.glb',          height: 0.9, fallback: null },
  tent:             { glb: 'tent.glb',             height: 1.5, fallback: null },
  flower_arch:      { glb: 'flower_arch.glb',      height: 2.6, fallback: null },
  willow_tree:      { glb: 'willow_tree.glb',      height: 5.0, fallback: 'tree' },
  stone_well:       { glb: 'stone_well.glb',       height: 1.6, fallback: 'jangdokdae' },
};
