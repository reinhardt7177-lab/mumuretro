import * as THREE from 'three';

const hiddenMaterials = new WeakMap();
const sourceMaterials = new WeakMap();
const batchSources = new WeakMap();
export const staticBatchSourceMaterial = mesh => sourceMaterials.get(mesh);
export const staticBatchSources = mesh => batchSources.get(mesh);

function hiddenMaterial(material) {
  let hidden = hiddenMaterials.get(material);
  if (!hidden) {
    hidden = material.clone();
    hidden.visible = false;
    hiddenMaterials.set(material, hidden);
  }
  return hidden;
}

// Parent-level visibility and movement must own every child passed here.
// Keep the original meshes as camera witnesses: aggregating their bounds must
// not turn tiny decorative leaves into new camera obstacles.
export function batchStaticChildren(parent) {
  const buckets = new Map();
  for (const mesh of parent.children) {
    if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || !mesh.visible ||
        Array.isArray(mesh.material) || !mesh.material.visible || mesh.material.transparent ||
        mesh.material.isShaderMaterial || mesh.children.length || !mesh.matrixAutoUpdate ||
        mesh.customDepthMaterial || mesh.customDistanceMaterial ||
        mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender ||
        mesh.onBeforeShadow !== THREE.Object3D.prototype.onBeforeShadow ||
        mesh.scale.x !== 1 || mesh.scale.y !== 1 || mesh.scale.z !== 1) continue;
    const geometry = mesh.geometry;
    if (!geometry.attributes.position || Object.keys(geometry.morphAttributes).length ||
        geometry.drawRange.start !== 0 || Number.isFinite(geometry.drawRange.count)) continue;
    const schema = Object.keys(geometry.attributes).sort().map(key => {
      const attribute = geometry.attributes[key];
      return `${key}:${attribute.itemSize}:${attribute.normalized}:${attribute.array?.constructor.name}`;
    }).join('|');
    if (Object.values(geometry.attributes).some(attribute => attribute.isInterleavedBufferAttribute)) continue;
    const key = [mesh.material.uuid, mesh.castShadow, mesh.receiveShadow, mesh.renderOrder,
      mesh.layers.mask, mesh.frustumCulled, schema].join(';');
    const list = buckets.get(key) || [];
    list.push(mesh); buckets.set(key, list);
  }
  let mergedCount = 0;
  for (const sources of buckets.values()) {
    if (sources.length < 2) continue;
    const parts = sources.map(mesh => {
      mesh.updateMatrix();
      return mesh.geometry.clone().applyMatrix4(mesh.matrix);
    });
    const geometry = new THREE.BufferGeometry();
    const vertices = parts.reduce((sum, part) => sum + part.attributes.position.count, 0);
    for (const key of Object.keys(parts[0].attributes)) {
      const first = parts[0].attributes[key], ArrayType = first.array.constructor;
      const values = new ArrayType(vertices * first.itemSize);
      let offset = 0;
      for (const part of parts) { values.set(part.attributes[key].array, offset); offset += part.attributes[key].array.length; }
      geometry.setAttribute(key, new THREE.BufferAttribute(values, first.itemSize, first.normalized));
    }
    const indexCount = parts.reduce((sum, part) => sum + (part.index?.count || part.attributes.position.count), 0);
    const indices = vertices > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
    let indexOffset = 0, vertexOffset = 0;
    for (const part of parts) {
      const count = part.index?.count || part.attributes.position.count;
      for (let i = 0; i < count; i++) indices[indexOffset++] = vertexOffset + (part.index ? part.index.getX(i) : i);
      vertexOffset += part.attributes.position.count;
    }
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    parts.forEach(part => part.dispose());
    const first = sources[0], batch = new THREE.Mesh(geometry, first.material);
    batch.name = 'forage_static_batch';
    batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow;
    batch.renderOrder = first.renderOrder; batch.layers.mask = first.layers.mask;
    batch.frustumCulled = first.frustumCulled;
    batch.userData.cameraOccluder = false;
    batch.userData.staticBatch = { sources: sources.length, triangles: indexCount / 3 };
    parent.add(batch);
    batchSources.set(batch, sources);
    for (const source of sources) {
      sourceMaterials.set(source, source.material);
      source.material = hiddenMaterial(source.material);
      source.userData.staticBatchWitness = true;
    }
    mergedCount++;
  }
  return mergedCount;
}
