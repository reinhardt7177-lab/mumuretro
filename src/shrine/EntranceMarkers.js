import * as THREE from 'three';
import { templePart } from './BalanceTemple.js';

// Authored Blender buttresses, tucked against the entry rail. Decoration has
// no light source, so it cannot change the shadow puzzle's visual rules.
export function addEntranceMarkers(scene, spec) {
  if (spec.id === 'balance') return [];
  const entry = spec.rooms.find(r => r.id === 'entry');
  const asset = templePart(`waymark_${spec.id}`);
  if (!entry || !asset) return [];
  const materials = new Map();
  asset.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = false;
    const tint = original => {
      if (materials.has(original)) return materials.get(original);
      const m = original.clone();
      if (m.name === 'Carved limestone') m.color.set(spec.theme.stoneLite);
      if (m.name === 'Midnight teal') m.color.set(spec.theme.stoneDark);
      // The shared warm brass denotes craft, not an interactive/solved state.
      m.userData.outlineParameters = { visible: false };
      materials.set(original, m);
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(tint) : tint(o.material);
  });
  const obstacles = [];
  for (const side of [-1, 1]) {
    const marker = asset.clone(true);
    marker.name = `Entrance marker ${spec.id} ${side}`;
    marker.position.set(side * (entry.w / 2 - .28), 0, entry.to + 2);
    scene.add(marker);
    obstacles.push({ x: marker.position.x, z: marker.position.z, r: .48 });
  }
  return obstacles;
}
