// 한 브라우저의 탐사 기록. 손상·저장 차단은 게임 실행을 막지 않는다.
export const SAVE_KEY = 'mumuplanet.progress.v1';
export const BACKUP_KEY = 'mumuplanet.progress.previous.v1';
const MAX_LENGTH = 750000;
const IDS = ['balance', 'shadow', 'sift', 'water', 'fire', 'strata'];
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const vector = value => Array.isArray(value) && value.length === 3
  && value.every(n => Number.isFinite(n) && Math.abs(n) <= 1000)
  && value.some(n => Math.abs(n) > 0.00001);

export function parseSave(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_LENGTH) return null;
  try {
    const data = JSON.parse(raw), p = data.progress;
    if (data.version !== 1 || !Number.isSafeInteger(data.savedAt) || data.savedAt <= 0
      || !object(p) || !['lab', 'planet'].includes(p.mode)
      || !object(p.lab) || !object(p.forage) || !object(p.map)
      || !object(p.notebook) || !object(p.kitchen) || !Array.isArray(p.cleared)
      || [p.lab, p.forage, p.map, p.notebook, p.kitchen].some(part => part.version !== 1)
      || !Array.isArray(p.lab.dials) || p.lab.dials.length !== 3
      || !p.lab.dials.every(n => Number.isInteger(n) && n >= 0 && n <= 9)
      || (p.lab.parcelRecovered !== undefined && typeof p.lab.parcelRecovered !== 'boolean')
      || (p.lab.hasNote && p.lab.parcelRecovered === false)
      || p.cleared.length > IDS.length || p.cleared.some(id => !IDS.includes(id))
      || new Set(p.cleared).size !== p.cleared.length
      || !vector(p.position) || !vector(p.heading)) return null;
    return data;
  } catch { return null; }
}

export function createSaveStore({ storage = () => localStorage, now = Date.now } = {}) {
  let state = 'empty';
  return {
    get status() { return state; },
    read() {
      try {
        const raw = storage().getItem(SAVE_KEY);
        const data = parseSave(raw);
        state = raw === null ? 'empty' : data ? 'ready' : 'invalid';
        return data;
      } catch { state = 'unavailable'; return null; }
    },
    write(progress) {
      try {
        const raw = JSON.stringify({ version: 1, savedAt: now(), progress });
        if (!parseSave(raw)) { state = 'invalid'; return false; }
        storage().setItem(SAVE_KEY, raw);
        state = 'ready'; return true;
      } catch { state = 'unavailable'; return false; }
    },
    // 새 탐사도 이전 기록 한 개는 남긴다. 백업 실패 시 원본을 지우지 않는다.
    archive() {
      try {
        const s = storage(), raw = s.getItem(SAVE_KEY);
        if (raw !== null) {
          if (raw.length > MAX_LENGTH) return false;
          s.setItem(BACKUP_KEY, raw);
          s.removeItem(SAVE_KEY);
        }
        state = 'empty'; return true;
      } catch { state = 'unavailable'; return false; }
    },
  };
}
