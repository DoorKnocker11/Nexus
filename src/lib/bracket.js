// Tournament engine: pure data + mutation helpers, no React.
//
// A tournament looks like:
// {
//   id, name, createdAt, format: 'single' | 'double' | 'rr',
//   entrants: [{ id, name, characterId, seed }],   // seed = index + 1
//   settings: {
//     bestOf: { default, finals, grandFinals },
//     gfReset: bool,                                // double elim bracket reset
//     rr: { double: bool, pointsWin, pointsDraw },
//   },
//   matches: [Match], status: 'active' | 'complete', championId, completedAt
// }
//
// Match slots (m.p[0], m.p[1]) hold: null (TBD), BYE, or an entrant id.

export const BYE = 'BYE'
export const DRAW = 'DRAW'

export function nextPow2(n) {
  let p = 1
  while (p < n) p *= 2
  return p
}

/** Standard bracket seed placement, e.g. 8 -> [1,8,4,5,2,7,3,6]. */
function seedPositions(size) {
  let arr = [1]
  while (arr.length < size) {
    const m = arr.length * 2
    const next = []
    for (const s of arr) next.push(s, m + 1 - s)
    arr = next
  }
  return arr
}

function makeMatch(id, bracket, round, index, bestOf) {
  return {
    id, bracket, round, index,
    p: [null, null],
    score: [0, 0],
    winner: null, loser: null,
    auto: false,          // decided automatically (bye)
    voided: false,        // match will never be played (e.g. unneeded GF reset)
    bestOf,
    next: null,           // { matchId, slot } winner destination
    nextLose: null,       // { matchId, slot } loser destination (double elim)
  }
}

export function getMatch(t, id) {
  return t.matches.find((m) => m.id === id)
}

export function winsNeeded(m) {
  return Math.ceil(m.bestOf / 2)
}

export function entrantById(t, id) {
  if (!id || id === BYE) return null
  return t.entrants.find((e) => e.id === id) || null
}

// ---------------------------------------------------------------- generation

export function createTournament({ name, format, contestants, settings }) {
  const entrants = contestants.map((c, i) => ({
    id: 'e' + (i + 1),
    name: c.name,
    characterId: c.characterId,
    seed: i + 1,
  }))
  const t = {
    id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: name || 'Untitled Tournament',
    createdAt: Date.now(),
    format,
    entrants,
    settings,
    matches: [],
    status: 'active',
    championId: null,
    completedAt: null,
  }
  if (format === 'single') genSingle(t)
  else if (format === 'double') genDouble(t)
  else genRoundRobin(t)
  autoResolveAll(t)
  checkCompletion(t)
  return t
}

function genSingle(t) {
  const n = t.entrants.length
  const size = nextPow2(Math.max(2, n))
  const rounds = Math.log2(size)
  const bo = t.settings.bestOf
  const byRound = []
  for (let r = 1; r <= rounds; r++) {
    const count = size >> r
    const arr = []
    for (let i = 0; i < count; i++) {
      arr.push(makeMatch(`W${r}-${i}`, 'W', r, i, r === rounds ? bo.finals : bo.default))
    }
    byRound.push(arr)
    t.matches.push(...arr)
  }
  for (let r = 1; r < rounds; r++) {
    byRound[r - 1].forEach((m, i) => {
      m.next = { matchId: `W${r + 1}-${i >> 1}`, slot: i & 1 }
    })
  }
  fillFirstRound(t, byRound[0], size)
}

function genDouble(t) {
  const n = t.entrants.length
  const size = nextPow2(Math.max(2, n))
  const k = Math.log2(size)
  const bo = t.settings.bestOf
  const wb = []
  for (let r = 1; r <= k; r++) {
    const count = size >> r
    const arr = []
    for (let i = 0; i < count; i++) {
      arr.push(makeMatch(`W${r}-${i}`, 'W', r, i, r === k ? bo.finals : bo.default))
    }
    wb.push(arr)
    t.matches.push(...arr)
  }
  for (let r = 1; r < k; r++) {
    wb[r - 1].forEach((m, i) => {
      m.next = { matchId: `W${r + 1}-${i >> 1}`, slot: i & 1 }
    })
  }

  // Losers bracket: rounds L1..L(2k-2). For j = 1..k-1:
  //   L(2j-1) "pairing" round, L(2j) "drop" round where WB(j+1) losers enter.
  const lbRounds = []
  for (let j = 1; j <= k - 1; j++) {
    const count = size >> (j + 1)
    for (const q of [2 * j - 1, 2 * j]) {
      const arr = []
      const isLbFinal = q === 2 * (k - 1)
      for (let i = 0; i < count; i++) {
        arr.push(makeMatch(`L${q}-${i}`, 'L', q, i, isLbFinal ? bo.finals : bo.default))
      }
      lbRounds.push(arr)
      t.matches.push(...arr)
    }
  }
  for (let j = 1; j <= k - 1; j++) {
    const minor = lbRounds[2 * j - 2]
    const drop = lbRounds[2 * j - 1]
    minor.forEach((m, i) => { m.next = { matchId: `L${2 * j}-${i}`, slot: 1 } })
    if (j < k - 1) {
      drop.forEach((m, i) => { m.next = { matchId: `L${2 * j + 1}-${i >> 1}`, slot: i & 1 } })
    }
  }
  if (k >= 2) {
    wb[0].forEach((m, i) => { m.nextLose = { matchId: `L1-${i >> 1}`, slot: i & 1 } })
    for (let r = 2; r <= k; r++) {
      const count = size >> r
      const perm = dropPermutation(count, r)
      wb[r - 1].forEach((m, i) => { m.nextLose = { matchId: `L${2 * (r - 1)}-${perm[i]}`, slot: 0 } })
    }
  }

  const gf1 = makeMatch('GF1', 'G', 1, 0, bo.grandFinals)
  const gf2 = makeMatch('GF2', 'G', 2, 0, bo.grandFinals)
  t.matches.push(gf1, gf2)
  wb[k - 1][0].next = { matchId: 'GF1', slot: 0 }
  if (k >= 2) {
    lbRounds[lbRounds.length - 1][0].next = { matchId: 'GF1', slot: 1 }
  } else {
    // Two entrants: WB final loser goes straight to grand finals.
    wb[0][0].nextLose = { matchId: 'GF1', slot: 1 }
  }

  fillFirstRound(t, wb[0], size)
}

/** Shuffle drop-in order per round to avoid immediate WB rematches. */
function dropPermutation(count, wbRound) {
  const arr = []
  for (let i = 0; i < count; i++) arr.push(i)
  if (count === 1) return arr
  if (wbRound % 2 === 0) return arr.map((i) => count - 1 - i)
  return arr.map((i) => (i + count / 2) % count)
}

function fillFirstRound(t, round1, size) {
  const n = t.entrants.length
  const seeds = seedPositions(size)
  seeds.forEach((s, i) => {
    round1[i >> 1].p[i & 1] = s <= n ? t.entrants[s - 1].id : BYE
  })
}

function genRoundRobin(t) {
  const bo = t.settings.bestOf
  const ids = t.entrants.map((e) => e.id)
  if (ids.length % 2) ids.push(BYE)
  const n = ids.length
  const roundsPerCycle = n - 1
  const half = n / 2
  const cycles = t.settings.rr.double ? 2 : 1
  for (let c = 0; c < cycles; c++) {
    const arr = [...ids]
    for (let r = 0; r < roundsPerCycle; r++) {
      for (let i = 0; i < half; i++) {
        let a = arr[i], b = arr[n - 1 - i]
        if (a === BYE || b === BYE) continue
        if (c === 1) [a, b] = [b, a] // swap sides in the return leg
        const round = c * roundsPerCycle + r + 1
        const m = makeMatch(`RR${round}-${i}`, 'RR', round, i, bo.default)
        m.p = [a, b]
        t.matches.push(m)
      }
      arr.splice(1, 0, arr.pop()) // circle method rotation
    }
  }
}

// ------------------------------------------------------------- match results

function assignSlot(t, link, value) {
  const m = getMatch(t, link.matchId)
  m.p[link.slot] = value
  tryAutoResolve(t, m)
}

function tryAutoResolve(t, m) {
  if (m.winner !== null || m.voided) return
  const [a, b] = m.p
  if (a === null || b === null) return
  if (a !== BYE && b !== BYE) return
  decide(t, m, a === BYE ? b : a, true)
}

function decide(t, m, winnerVal, auto) {
  m.winner = winnerVal
  m.loser = m.p[0] === winnerVal ? m.p[1] : m.p[0]
  m.auto = auto
  if (m.next) assignSlot(t, m.next, m.winner)
  if (m.nextLose) assignSlot(t, m.nextLose, m.loser)
  afterDecide(t, m)
}

function afterDecide(t, m) {
  if (t.format === 'double') {
    if (m.id === 'GF1') {
      const gf2 = getMatch(t, 'GF2')
      const lbSideWon = m.winner === m.p[1]
      if (lbSideWon && t.settings.gfReset) {
        gf2.p = [m.p[0], m.p[1]]
        gf2.voided = false
      } else {
        gf2.voided = true
      }
    }
  }
  checkCompletion(t)
}

export function checkCompletion(t) {
  let championId = null
  if (t.format === 'single') {
    const final = t.matches[t.matches.length - 1]
    if (final.winner && final.winner !== BYE) championId = final.winner
  } else if (t.format === 'double') {
    const gf1 = getMatch(t, 'GF1')
    const gf2 = getMatch(t, 'GF2')
    if (gf1.winner) {
      if (gf2.voided) championId = gf1.winner
      else if (gf2.winner) championId = gf2.winner
    }
  } else {
    if (t.matches.length && t.matches.every((m) => m.winner !== null)) {
      const standings = rrStandings(t)
      if (standings.length) championId = standings[0].entrantId
    }
  }
  if (championId && championId !== BYE) {
    t.championId = championId
    t.status = 'complete'
    if (!t.completedAt) t.completedAt = Date.now()
  } else {
    t.championId = null
    t.status = 'active'
    t.completedAt = null
  }
}

export function isPlayable(m) {
  return (
    !m.voided && m.winner === null &&
    m.p[0] !== null && m.p[1] !== null && m.p[0] !== BYE && m.p[1] !== BYE
  )
}

/** Add one game win for the entrant in the given slot; decides the series when clinched. */
export function reportScore(t, matchId, slot) {
  const m = getMatch(t, matchId)
  if (!isPlayable(m)) return
  m.score[slot] += 1
  if (m.score[slot] >= winsNeeded(m)) {
    decide(t, m, m.p[slot], false)
  }
}

export function decrementScore(t, matchId, slot) {
  const m = getMatch(t, matchId)
  if (m.winner !== null || m.voided) return
  m.score[slot] = Math.max(0, m.score[slot] - 1)
}

/** Round robin only: declare a draw. */
export function reportDraw(t, matchId) {
  const m = getMatch(t, matchId)
  if (t.format !== 'rr' || !isPlayable(m)) return
  m.winner = DRAW
  m.loser = null
  m.auto = false
  checkCompletion(t)
}

export function setMatchBestOf(t, matchId, bestOf) {
  const m = getMatch(t, matchId)
  if (m.winner !== null) return
  const minNeeded = Math.max(m.score[0], m.score[1])
  if (Math.ceil(bestOf / 2) < minNeeded + 1 && minNeeded > 0) return
  m.bestOf = bestOf
}

// ----------------------------------------------------------------- resetting

function dependents(t, m) {
  const links = []
  if (m.next) links.push(m.next)
  if (m.nextLose) links.push(m.nextLose)
  if (m.id === 'GF1') links.push({ matchId: 'GF2', slot: 0 }, { matchId: 'GF2', slot: 1 })
  return links
}

/** A decided match can be reset only if nothing downstream was decided manually. */
export function canResetMatch(t, matchId) {
  const m = getMatch(t, matchId)
  if (m.winner === null && m.score[0] === 0 && m.score[1] === 0) return false
  if (m.auto) return false
  if (m.winner === null) return true // just clearing series score
  const seen = new Set()
  const walk = (mm) => {
    for (const link of dependents(t, mm)) {
      if (seen.has(link.matchId)) continue
      seen.add(link.matchId)
      const tm = getMatch(t, link.matchId)
      if (!tm) continue
      if (tm.id === 'GF2' && tm.voided) continue
      if (tm.score[0] !== 0 || tm.score[1] !== 0) return false
      if (tm.winner !== null) {
        if (!tm.auto) return false
        if (!walk(tm)) return false
      }
    }
    return true
  }
  return walk(m)
}

export function resetMatch(t, matchId) {
  const m = getMatch(t, matchId)
  if (!canResetMatch(t, matchId)) return false
  const clearDownstream = (mm) => {
    for (const link of dependents(t, mm)) {
      const tm = getMatch(t, link.matchId)
      if (!tm) continue
      if (tm.winner !== null && tm.auto) {
        clearDownstream(tm)
        tm.winner = null
        tm.loser = null
        tm.auto = false
      }
      tm.p[link.slot] = null
    }
    if (mm.id === 'GF1') {
      const gf2 = getMatch(t, 'GF2')
      gf2.voided = false
      gf2.winner = null
      gf2.loser = null
      gf2.score = [0, 0]
    }
  }
  if (m.winner !== null) clearDownstream(m)
  m.winner = null
  m.loser = null
  m.auto = false
  m.score = [0, 0]
  // GF1 reset shouldn't wipe its own slots (they come from upstream), but
  // clearDownstream on GF1 cleared GF2 which is what we want. Re-run byes in
  // case a cleared slot should re-fill (it can't: upstream results still hold).
  checkCompletion(t)
  return true
}

function autoResolveAll(t) {
  let changed = true
  while (changed) {
    changed = false
    for (const m of t.matches) {
      if (m.winner === null && !m.voided) {
        const before = m.winner
        tryAutoResolve(t, m)
        if (m.winner !== before) changed = true
      }
    }
  }
}

// ----------------------------------------------------------------- standings

export function rrStandings(t) {
  const rows = new Map()
  for (const e of t.entrants) {
    rows.set(e.id, { entrantId: e.id, name: e.name, seed: e.seed, played: 0, w: 0, d: 0, l: 0, points: 0 })
  }
  const { pointsWin, pointsDraw } = t.settings.rr
  for (const m of t.matches) {
    if (m.winner === null) continue
    const [a, b] = m.p
    const ra = rows.get(a), rb = rows.get(b)
    if (!ra || !rb) continue
    ra.played++; rb.played++
    if (m.winner === DRAW) {
      ra.d++; rb.d++
      ra.points += pointsDraw; rb.points += pointsDraw
    } else {
      const rw = rows.get(m.winner)
      const rl = rows.get(m.loser)
      rw.w++; rw.points += pointsWin
      rl.l++
    }
  }
  const list = [...rows.values()]
  // Sort by points, then break ties within equal-point groups by:
  // head-to-head points among the tied, then overall wins, then seed.
  list.sort((x, y) => y.points - x.points || x.seed - y.seed)
  const result = []
  let i = 0
  while (i < list.length) {
    let j = i
    while (j < list.length && list[j].points === list[i].points) j++
    const group = list.slice(i, j)
    if (group.length > 1) {
      const groupIds = new Set(group.map((g) => g.entrantId))
      const h2h = new Map(group.map((g) => [g.entrantId, 0]))
      for (const m of t.matches) {
        if (m.winner === null || m.winner === DRAW) continue
        if (groupIds.has(m.p[0]) && groupIds.has(m.p[1])) {
          h2h.set(m.winner, (h2h.get(m.winner) || 0) + 1)
        }
      }
      group.sort((x, y) =>
        (h2h.get(y.entrantId) - h2h.get(x.entrantId)) || (y.w - x.w) || (x.seed - y.seed))
    }
    result.push(...group)
    i = j
  }
  return result
}

// ------------------------------------------------------------------- display

export function bracketRounds(t) {
  const groups = { W: [], L: [], G: [], RR: [] }
  for (const m of t.matches) {
    const g = groups[m.bracket]
    if (!g[m.round - 1]) g[m.round - 1] = []
    g[m.round - 1].push(m)
  }
  for (const key of Object.keys(groups)) {
    groups[key] = groups[key].filter(Boolean)
    for (const arr of groups[key]) arr.sort((a, b) => a.index - b.index)
  }
  return groups
}

export function roundName(t, bracket, round) {
  const groups = bracketRounds(t)
  if (bracket === 'W') {
    const total = groups.W.length
    if (t.format === 'single') {
      if (round === total) return 'Grand Final'
      if (round === total - 1) return 'Semifinals'
      if (round === total - 2) return 'Quarterfinals'
      return `Round ${round}`
    }
    if (round === total) return 'Winners Final'
    if (round === total - 1) return 'Winners Semis'
    return `Winners Round ${round}`
  }
  if (bracket === 'L') {
    const total = groups.L.length
    if (round === total) return 'Losers Final'
    return `Losers Round ${round}`
  }
  if (bracket === 'G') return round === 1 ? 'Grand Final' : 'Bracket Reset'
  return `Round ${round}`
}

/** The earliest round in each bracket that still has playable matches. */
export function currentRoundKeys(t) {
  const keys = new Set()
  const best = {}
  for (const m of t.matches) {
    if (!isPlayable(m)) continue
    if (best[m.bracket] === undefined || m.round < best[m.bracket]) best[m.bracket] = m.round
  }
  for (const [b, r] of Object.entries(best)) keys.add(`${b}${r}`)
  return keys
}
