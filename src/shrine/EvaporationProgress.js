export function evaporationProgress(g, legacy) {
  const states = ['mixed', 'demag', 'filtered', 'salt', 'lump'];
  return {
    capture: () => ({ version: 2, fields: { held: g.held, state: g.state } }),
    valid: s => !!(s && s.fields && Object.keys(s.fields).length === 2
      && typeof s.fields.held === 'boolean' && states.includes(s.fields.state)
      && (s.fields.state !== 'salt' || !s.fields.held)
      && (s.version === 2 || (s.version === undefined && legacy.valid(s)))),
    restore(s) { g.held = s.fields.held; g.state = s.fields.state; g._paint(); g.workshop.sync(); },
  };
}
