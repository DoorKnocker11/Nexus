// Lifetime character stats: pure aggregation logic, no React / no IO.
//
// State shape: { records: { [characterId]: Record }, meta: Meta }
//   Record: { id, name, modes: { versus|team|tournament: { p, w, l, d } } }
//   Meta:   { id: '__meta__', backfilled, totals: { versus, team, tournament } }
//
// Events are emitted wherever a winner is declared:
//   { mode, winners: [{characterId, name}], losers: [{characterId, name}],
//     draw?: bool, countMatch?: bool }
// `countMatch: false` is used for individual bouts inside an elimination team
// battle — each bout credits individual win/loss, but the battle itself counts
// as one completed match.

export const META_ID = '__meta__'
export const STAT_MODES = ['versus', 'team', 'tournament']

export function emptyModes() {
  return {
    versus: { p: 0, w: 0, l: 0, d: 0 },
    team: { p: 0, w: 0, l: 0, d: 0 },
    tournament: { p: 0, w: 0, l: 0, d: 0 },
  }
}

export function emptyMeta() {
  return { id: META_ID, backfilled: false, totals: { versus: 0, team: 0, tournament: 0 } }
}

export function emptyStats() {
  return { records: {}, meta: emptyMeta() }
}

/**
 * Apply (sign=+1) or revert (sign=-1) a batch of events.
 * Returns { records, meta, changedIds } with fresh objects for anything touched.
 */
export function applyEvents(state, events, sign = 1) {
  const records = { ...state.records }
  const meta = { ...state.meta, totals: { ...state.meta.totals } }
  const changed = new Set()

  const bump = (mode, list, fields) => {
    for (const p of list) {
      if (!p || !p.characterId) continue
      const prev = records[p.characterId] || { id: p.characterId, name: p.name || '???', modes: emptyModes() }
      const rec = {
        ...prev,
        name: p.name || prev.name,
        modes: { ...prev.modes, [mode]: { ...prev.modes[mode] } },
      }
      for (const f of fields) {
        rec.modes[mode][f] = Math.max(0, rec.modes[mode][f] + sign)
      }
      records[p.characterId] = rec
      changed.add(p.characterId)
    }
  }

  for (const ev of events) {
    if (!STAT_MODES.includes(ev.mode)) continue
    if (ev.draw) {
      bump(ev.mode, [...(ev.winners || []), ...(ev.losers || [])], ['p', 'd'])
    } else {
      bump(ev.mode, ev.winners || [], ['p', 'w'])
      bump(ev.mode, ev.losers || [], ['p', 'l'])
    }
    if (ev.countMatch !== false) {
      meta.totals[ev.mode] = Math.max(0, meta.totals[ev.mode] + sign)
    }
  }
  return { records, meta, changedIds: [...changed] }
}

/** Events for one exhibition/team-battle history entry. */
export function historyEvents(h) {
  if (h.mode === 'teamBattle') {
    const events = (h.bouts || []).map((b) => ({
      mode: 'team',
      winners: [b.winnerSide === 0 ? b.a : b.b],
      losers: [b.winnerSide === 0 ? b.b : b.a],
      countMatch: false,
    }))
    events.push({ mode: 'team', winners: [], losers: [], countMatch: true })
    return events
  }
  const mode = (h.teamSize || 1) > 1 ? 'team' : 'versus'
  return [{
    mode,
    winners: h.teams[h.winnerSide],
    losers: h.teams[1 - h.winnerSide],
  }]
}

/** Event for one tournament match, or null if it shouldn't count (pending/bye/voided). */
export function tournamentEvent(t, m) {
  if (m.winner === null || m.auto || m.voided) return null
  const info = (pid) => {
    const e = t.entrants.find((x) => x.id === pid)
    return e ? { characterId: e.characterId, name: e.name } : null
  }
  if (m.winner === 'DRAW') {
    return {
      mode: 'tournament',
      winners: [info(m.p[0])].filter(Boolean),
      losers: [info(m.p[1])].filter(Boolean),
      draw: true,
    }
  }
  const w = info(m.winner)
  const l = info(m.loser)
  return { mode: 'tournament', winners: w ? [w] : [], losers: l ? [l] : [], draw: false }
}

/** Rebuild stats from scratch out of existing history + tournaments. */
export function backfillFromData(history, tournaments) {
  const events = []
  for (const h of history) events.push(...historyEvents(h))
  for (const t of tournaments) {
    for (const m of t.matches) {
      const ev = tournamentEvent(t, m)
      if (ev) events.push(ev)
    }
  }
  const result = applyEvents(emptyStats(), events)
  result.meta.backfilled = true
  return result
}

// ------------------------------------------------------------------- display

export function totalsSum(meta) {
  return STAT_MODES.reduce((s, m) => s + (meta.totals[m] || 0), 0)
}

export function modeSums(rec) {
  const sum = { p: 0, w: 0, l: 0, d: 0 }
  for (const m of STAT_MODES) {
    for (const k of ['p', 'w', 'l', 'd']) sum[k] += rec.modes[m][k]
  }
  return sum
}

export function winRate(row) {
  const decided = row.w + row.l
  return decided === 0 ? null : row.w / decided
}
