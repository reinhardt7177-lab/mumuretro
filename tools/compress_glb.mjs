// 무무 행성 GLB 압축 파이프라인.
//
// 사용법: node tools/compress_glb.mjs <입력폴더> <출력폴더> [최대텍스처크기]
// 필요 패키지(전역 설치 불필요, 별도 폴더에서):
//   npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions sharp draco3dgltf
//
// 핵심: 게임의 toonify()는 baseColor(map)만 쓰고 normal/metalRough/occlusion/emissive는 버린다.
// 그런데 파일에는 2048² 노멀맵(4.9MB)이 그대로 들어 있어 다운로드·디코딩·GPU 업로드까지 하고
// 한 번도 안 쓰인다. 그래서 "안 쓰는 텍스처 제거"가 압축의 대부분을 차지한다.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, draco, textureCompress, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SRC = process.argv[2];
const DST = process.argv[3];
const MAX_TEX = Number(process.argv[4] || 512);

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });

async function run(file) {
  const doc = await io.read(path.join(SRC, file));

  // 1) 툰 셰이딩이 안 쓰는 텍스처 슬롯을 끊는다. 이게 용량의 대부분.
  let dropped = 0;
  for (const mat of doc.getRoot().listMaterials()) {
    for (const setter of ['setNormalTexture', 'setMetallicRoughnessTexture',
                          'setOcclusionTexture', 'setEmissiveTexture']) {
      const getter = setter.replace('set', 'get');
      if (mat[getter] && mat[getter]()) { mat[setter](null); dropped++; }
    }
  }

  // 2) 참조 끊긴 텍스처·머티리얼·메시 정리
  await doc.transform(dedup(), prune({ keepAttributes: false }));

  // 3) 남은 baseColor를 축소 + WebP. 툰 셰이딩엔 2048²가 과하다.
  try {
    await doc.transform(textureCompress({
      encoder: sharp, targetFormat: 'webp', resize: [MAX_TEX, MAX_TEX], quality: 82,
    }));
  } catch (e) {
    console.warn(`  (텍스처 압축 건너뜀: ${e.message})`);
  }

  // 4) 메시 Draco 압축
  await doc.transform(weld(), draco({ method: 'edgebreaker' }));

  await io.write(path.join(DST, file), doc);
  return dropped;
}

await fs.mkdir(DST, { recursive: true });
const files = (await fs.readdir(SRC)).filter(f => f.endsWith('.glb'));
let before = 0, after = 0;
for (const f of files) {
  const b = (await fs.stat(path.join(SRC, f))).size;
  let dropped = 0;
  try { dropped = await run(f); }
  catch (e) { console.error(`✖ ${f}: ${e.message}`); continue; }
  const a = (await fs.stat(path.join(DST, f))).size;
  before += b; after += a;
  console.log(`${f.padEnd(24)} ${(b/1048576).toFixed(2)}MB → ${(a/1048576).toFixed(2)}MB  (${(100*(1-a/b)).toFixed(0)}% 감소, 텍스처 ${dropped}개 제거)`);
}
console.log(`\n합계 ${(before/1048576).toFixed(1)}MB → ${(after/1048576).toFixed(1)}MB  (${(100*(1-after/before)).toFixed(0)}% 감소)`);
