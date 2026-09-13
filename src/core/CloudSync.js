// Provider-independent cloud coordination. The server must authenticate the user
// and atomically compare revisions; device graphics preferences are not included.
import { parseSave } from './SaveGame.js';
export function createCloudSync({ remote }) {
  let revision, known = false, busy = false;
  const valid = raw => parseSave(raw) !== null;
  return {
    async inspect() {
      if (busy) return { status: 'busy' };
      busy = true;
      try {
        const record = await remote.read();
        if (record !== null && (!record || typeof record.revision !== 'string' || !record.revision || !valid(record.raw))) return { status: 'invalid' };
        revision = record?.revision ?? null; known = true;
        return { status: record ? 'available' : 'empty', record };
      } catch { return { status: 'offline' }; }
      finally { busy = false; }
    },
    // Upload is explicit. Inspecting a remote save never replaces local progress.
    async upload(raw) {
      if (!valid(raw)) return { status: 'invalid' };
      if (busy) return { status: 'busy' };
      if (!known) return { status: 'inspect-required' };
      busy = true;
      try {
        const result = await remote.compareAndSwap({ expectedRevision: revision, raw });
        if (result?.status === 'conflict') { known = false; return { status: 'conflict' }; }
        if (result?.status !== 'saved' || typeof result.revision !== 'string' || !result.revision) { known = false; return { status: 'unconfirmed' }; }
        revision = result.revision;
        return { status: 'saved', revision };
      } catch {
        // A timeout may occur after a server write. Read again before retrying.
        known = false; return { status: 'unconfirmed' };
      } finally { busy = false; }
    },
  };
}
