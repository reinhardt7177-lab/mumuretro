// 저장 가능한 상태를 명시한다. THREE 객체나 함수를 JSON에 넣지 않고, 물건의
// 소유 관계는 고정 목록의 번호로 읽는다. 검증 단계에서는 살아 있는 장치를 만지지 않는다.
const num = (lo = -1e9, hi = 1e9) => v => Number.isFinite(v) && v >= lo && v <= hi;
const int = (lo, hi) => v => Number.isInteger(v) && num(lo, hi)(v);
const bool = v => typeof v === 'boolean';
const one = values => v => values.includes(v);
const list = (check, min, max = min) => v => Array.isArray(v) && v.length >= min && v.length <= max && v.every(check);
const unique = a => new Set(a).size === a.length;
const copy = v => JSON.parse(JSON.stringify(v));

export function deviceProgress(g, kind, scene) {
  if (g.progressCodec) return g.progressCodec;
  const fields = {}, checks = [];
  const add = (name, get, set, check) => { fields[name] = { get, set, check }; };
  const field = (obj, key, check, name = key) => add(name, () => obj[key], v => { obj[key] = v; }, check);
  const many = (pool, key, check) => pool.forEach((o, i) => field(o, key, check, `${key}.${i}`));
  const ref = (obj, key, pool, name = key, wrapped = false) => add(name,
    () => obj[key] ? pool.indexOf(wrapped ? obj[key].stock : obj[key]) : -1,
    i => { const it = pool[i]; obj[key] = it ? (wrapped ? { w: it.w, mesh: it.mesh, stock: it } : it) : null; }, int(-1, pool.length - 1));
  const refs = (obj, key, pool, name = key) => add(name, () => obj[key].map(v => pool.indexOf(v)),
    a => { obj[key] = a.map(i => pool[i]); }, v => list(int(0, pool.length - 1), 0, pool.length)(v) && unique(v));
  const permutation = (key, pool, identify) => add(key, () => g[key].map(v => pool.findIndex(p => identify(p) === identify(v))),
    a => { g[key] = a.map(i => pool[i]); }, v => list(int(0, pool.length - 1), pool.length)(v) && unique(v));
  const exclusive = names => checks.push(s => unique(names.flatMap(k => Array.isArray(s[k]) ? s[k] : s[k] < 0 ? [] : [s[k]])));
  const timed = (key = 't') => field(g, key, num(0));
  const solved = () => field(g, 'solved', bool);
  const phase = () => field(g, 'phase', one(['calm', 'fore', 'main']));

  switch (kind) {
    case 'weigh': {
      const places = [...g.pans, ...g.slots];
      ref(g, 'held', g.boxes); field(g, 'tilt', num(-1, 1)); solved();
      g.boxes.forEach((b, i) => { field(b, 'where', one(['home', 'held', 'pan', 'slot']), `where.${i}`); ref(b, 'at', places, `at.${i}`); });
      places.forEach((p, i) => ref(p, 'box', g.boxes, `box.${i}`));
      exclusive(['held', ...places.map((_, i) => `box.${i}`)]);
      checks.push(s => g.boxes.every((_, i) => {
        const p = places.findIndex((_, j) => s[`box.${j}`] === i), held = s.held === i;
        return s[`at.${i}`] === p && s[`where.${i}`] === (held ? 'held' : p < 0 ? 'home' : p < 2 ? 'pan' : 'slot');
      }));
      checks.push(s => s.solved === g.slots.every((slot, i) => g.boxes[s[`box.${i + 2}`]]?.w === slot.i + 1));
      break;
    }
    case 'plate':
      ref(g, 'held', g.stock); field(g, 'round', int(0, 3));
      field(g, 'rounds', v => list(list(int(2, 13), 2), 3)(v) && v.every(pair => {
        for (let code = 0; code < 243; code++) { let c = code; const sum = [0, 0];
          for (const b of g.stock) { const at = c % 3; c = Math.floor(c / 3); if (at < 2) sum[at] += b.w; }
          if (sum[0] === pair[0] && sum[1] === pair[1]) return true;
        } return false;
      }));
      many(g.stock, 'taken', bool);
      g.plates.forEach((p, i) => { refs(p, 'boxes', g.stock, `boxes.${i}`); field(p, 'need', int(2, 13), `need.${i}`); });
      exclusive(['held', 'boxes.0', 'boxes.1']);
      checks.push(s => g.stock.every((_, i) => s[`taken.${i}`] === (s.held === i || s['boxes.0'].includes(i) || s['boxes.1'].includes(i)))
        && g.plates.every((_, i) => s[`need.${i}`] === s.rounds[Math.min(s.round, 2)][i]));
      break;
    case 'scale': {
      ref(g, 'held', g.stock, 'held', true); many(g.stock, 'taken', bool);
      field(g, 'tilt', num(-1, 1)); field(g, 'targetTilt', num(-1, 1)); field(g, 'balanced', bool);
      const slots = g.slots.filter(s => !s.fixed);
      slots.forEach((s, i) => ref(s, 'box', g.stock, `box.${i}`, true));
      exclusive(['held', ...slots.map((_, i) => `box.${i}`)]);
      checks.push(s => g.stock.every((_, i) => s[`taken.${i}`] === (s.held === i || slots.some((_, j) => s[`box.${j}`] === i))));
      checks.push(s => { let left = 6, right = 0; slots.forEach((slot, i) => {
        const w = g.stock[s[`box.${i}`]]?.w || 0; if (slot.side < 0) left += w * slot.index; else right += w * slot.index;
      }); return s.balanced === (left === right); });
      break;
    }
    case 'shade': field(g, 'a', num(0)); field(g, 'expose', num(0, 2)); break;
    case 'mirror': many(g.mirrors, 'a', v => num(0, Math.PI * 2)(v) && Math.abs(v / (Math.PI / 4) - Math.round(v / (Math.PI / 4))) < 1e-7); field(g, 'hit', bool); break;
    case 'silhouette':
      field(g, 'held', bool); solved(); field(g, 'round', int(0, 3));
      field(g, 'answers', v => list(num(g.wallZ + 1.2, g.lampZ - 1.2), 3)(v) && unique(v));
      field(g, 'objZ', num(g.wallZ + 1.2, g.lampZ - 1.2)); field(g, 'holeW', num(0, 100));
      checks.push(s => s.solved === (s.round === 3)); break;
    case 'mirrorGod':
      field(g, 'ai', int(0, 7)); field(g, 'hi', int(0, 2)); solved();
      checks.push(s => s.solved === (s.ai === g.answer.a && s.hi === g.answer.h)); break;
    case 'sieve':
      permutation('orders', g.orders.slice(), o => o.keep.join(','));
      ref(g, 'held', g.sieves); field(g, 'fitted', int(-1, 2)); field(g, 'round', int(0, 3)); solved();
      add('mix', () => [...g.mix], a => { g.mix = new Set(a); }, v => list(int(0, 2), 0, 3)(v) && unique(v));
      exclusive(['held', 'fitted']); checks.push(s => s.solved === (s.round === 3)); break;
    case 'magnet':
      permutation('crits', g.crits.slice(), c => c.yes);
      ref(g, 'held', g.items); ref(g, 'testItem', g.items); field(g, 'testT', num(0, 1));
      field(g, 'round', int(0, 3)); solved();
      g.items.forEach((it, i) => ref(it, 'bin', g.bins, `bin.${i}`));
      g.bins.forEach((b, i) => refs(b, 'got', g.items, `got.${i}`));
      exclusive(['held', 'testItem', 'got.0', 'got.1']);
      checks.push(s => s.solved === (s.round === 3) && g.items.every((_, i) => s[`bin.${i}`] === (s['got.0'].includes(i) ? 0 : s['got.1'].includes(i) ? 1 : -1))); break;
    case 'evaporate':
      field(g, 'held', bool); field(g, 'state', one(['mixed', 'demag', 'filtered', 'salt', 'lump']));
      checks.push(s => s.state !== 'salt' || !s.held); break;
    case 'siftGod':
      ref(g, 'held', g.tools); solved();
      g.tools.forEach((t, i) => ref(t, 'used', g.mixes, `used.${i}`));
      g.mixes.forEach((m, i) => field(m, 'done', v => list(one(m.need), 0, m.need.length)(v) && unique(v)
        && (!m.order || v.every((id, k) => id === m.need[k])), `done.${i}`));
      checks.push(s => s.solved === g.mixes.every((m, i) => s[`done.${i}`].length === m.need.length)); break;
    case 'quake': phase(); timed(); break;
    case 'hexlava': ref(g, 'cur', g.tiles); many(g.tiles, 'state', one(['ok', 'sinking', 'lava'])); many(g.tiles, 't', num(0, 5)); break;
    case 'geyser': many(g.vents, 't', num(0, 10)); break;
    case 'fireGod':
      many(g.cells, 'rot', int(0, 3)); phase(); timed('pt'); field(g, 'reach', int(0, 3)); solved();
      checks.push(s => { let reach = 0; for (let i = 0; i < g.cells.length; i++) {
        const c = g.cells[i], open = c.open.map(d => (d + s[`rot.${i}`]) % 4); if (!c.need.every(d => open.includes(d))) break; reach++;
      } return s.reach === reach && s.solved === (reach === 3); }); break;
    case 'strataOrder':
      ref(g, 'held', g.fossils); solved();
      g.slots.forEach((slot, i) => ref(slot, 'got', g.fossils, `got.${i}`));
      g.fossils.forEach((f, i) => ref(f, 'slot', g.slots, `slot.${i}`));
      exclusive(['held', ...g.slots.map((_, i) => `got.${i}`)]);
      checks.push(s => g.fossils.every((_, i) => s[`slot.${i}`] === g.slots.findIndex((_, j) => s[`got.${j}`] === i))
        && s.solved === g.fossils.every((f, i) => g.slots[s[`slot.${i}`]]?.level === f.level)); break;
    case 'shaft':
      timed(); many(g.rocks, 'state', one(['off', 'tell', 'fall', 'land'])); many(g.rocks, 't', num(0, 3));
      many(g.rocks, 'x', num(g.seg.x0, g.seg.x1)); many(g.rocks, 'z', v => v === 0 || num(g.seg.z0, g.seg.z1)(v)); break;
    case 'fiveDoors':
      many(g.levers, 'ci', int(-1, 4)); solved(); checks.push(s => s.solved === g.levers.every((l, i) => l.si === s[`ci.${i}`])); break;
    case 'grand':
      ref(g, 'held', g.orbs); field(g, 'lit', int(0, 5)); field(g, 'awake', num(0, 1));
      many(g.orbs, 'placed', bool); g.altars.forEach((a, i) => ref(a, 'got', g.orbs, `got.${i}`));
      exclusive(['held', ...g.altars.map((_, i) => `got.${i}`)]);
      checks.push(s => s.lit === g.altars.filter((a, i) => s[`got.${i}`] >= 0).length
        && g.altars.every((a, i) => s[`got.${i}`] < 0 || g.orbs[s[`got.${i}`]].id === a.id)
        && g.orbs.every((_, i) => s[`placed.${i}`] === g.altars.some((a, j) => s[`got.${j}`] === i))); break;
    default: throw Error(`No progress contract for ${kind}`);
  }
  if (g.eyes?.restore) add('eyes', () => g.eyes.awake, v => g.eyes.restore(v), num(0, 1));
  const visuals = visualProgress(g, scene);
  return {
    capture: () => ({ fields: Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, copy(f.get())])), visual: visuals.capture() }),
    valid: s => !!s && !!s.fields && Object.keys(s.fields).length === Object.keys(fields).length
      && Object.entries(fields).every(([k, f]) => f.check(s.fields[k])) && checks.every(check => check(s.fields)) && visuals.valid(s.visual),
    restore(s) { for (const [k, f] of Object.entries(fields)) f.set(copy(s.fields[k])); visuals.restore(s.visual); },
  };
}

// 장치의 초기 노드 순서는 씨앗으로 재현한다. 시각 상태도 같은 계약에 포함해
// 체 위/아래 알갱이, 저울의 부모 좌표, 기울기, 점등이 재접속 직후부터 맞게 보인다.
// 정적 모델·텍스처는 저장하지 않는다. 초기값과 달라진 항목만 저장한다.
function visualProgress(g, scene) {
  const nodes = [], materials = [];
  (g.group || g.root).traverse(o => nodes.push(o));
  const mats = o => o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
  const addMat = m => { if (m?.isMaterial && !materials.includes(m)) materials.push(m); };
  nodes.forEach(o => mats(o).forEach(addMat)); Object.values(g).forEach(addMat);
  const nodeState = o => [nodes.indexOf(o.parent), ...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray(), o.visible,
    mats(o).map(m => materials.indexOf(m)), o.isLight ? o.intensity : null, o.isLight ? o.color.getHex() : null];
  const matState = m => [m.color?.getHex() ?? null, m.opacity];
  const initialNodes = nodes.map(nodeState), initialMats = materials.map(matState);
  // 모델을 개편한 뒤 옛 노드 번호를 다른 물건에 적용하지 않는다. 개편 시에는
  // 이 계약의 마이그레이션도 함께 작성해야 한다.
  let layout = 2166136261;
  for (const c of JSON.stringify([nodes.map(o => [o.type, o.geometry?.type]), initialNodes, initialMats])) {
    layout = Math.imul(layout ^ c.charCodeAt(0), 16777619) >>> 0;
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const capture = () => ({ layout, nodes: nodes.flatMap((o, i) => { const s = nodeState(o); return same(s, initialNodes[i]) ? [] : [[i, s]]; }),
    materials: materials.flatMap((m, i) => { const s = matState(m); return same(s, initialMats[i]) ? [] : [[i, s]]; }) });
  const color = v => v === null || int(0, 0xffffff)(v);
  const valid = s => {
    if (!s || s.layout !== layout || !list(v => Array.isArray(v) && v.length === 2 && int(0, nodes.length - 1)(v[0]) && Array.isArray(v[1])
      && v[1].length === 15 && int(-1, nodes.length - 1)(v[1][0]) && v[1].slice(1, 11).every(num(-10000, 10000))
      && Math.abs(Math.hypot(...v[1].slice(4, 8)) - 1) < 0.001 && bool(v[1][11])
      && list(int(0, materials.length - 1), mats(nodes[v[0]]).length)(v[1][12])
      && (v[1][13] === null || num(0, 10000)(v[1][13])) && color(v[1][14]), 0, nodes.length)(s.nodes)
      || !list(v => Array.isArray(v) && v.length === 2 && int(0, materials.length - 1)(v[0])
        && list(() => true, 2)(v[1]) && color(v[1][0]) && num(0, 1)(v[1][1]), 0, materials.length)(s.materials)
      || !unique(s.nodes.map(v => v[0])) || !unique(s.materials.map(v => v[0]))) return false;
    const parents = initialNodes.map(n => n[0]); s.nodes.forEach(([i, n]) => { parents[i] = n[0]; });
    return parents.every((_, i) => { const seen = new Set(); while (i >= 0) { if (seen.has(i)) return false; seen.add(i); i = parents[i]; } return true; });
  };
  const restore = s => {
    const ns = initialNodes.slice(), ms = initialMats.slice(); s.nodes.forEach(([i, v]) => { ns[i] = v; }); s.materials.forEach(([i, v]) => { ms[i] = v; });
    // 모두 떼고 다시 붙이면 상자 ↔ 선반/막대 이동도 순서와 관계없이 복원된다.
    nodes.forEach(o => o.removeFromParent());
    ns.forEach((v, i) => { const o = nodes[i]; (nodes[v[0]] || scene).add(o);
      o.position.fromArray(v, 1); o.quaternion.fromArray(v, 4); o.scale.fromArray(v, 8); o.visible = v[11];
      if (o.material) o.material = Array.isArray(o.material) ? v[12].map(j => materials[j]) : materials[v[12][0]];
      if (o.isLight) { o.intensity = v[13]; o.color.setHex(v[14]); }
    });
    ms.forEach((v, i) => { const m = materials[i]; if (m.color && v[0] !== null) m.color.setHex(v[0]); m.opacity = v[1]; });
  };
  return { capture, valid, restore };
}
