import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { idbGetAll, idbPut, idbPutMany, idbDelete, idbClear, uid } from './lib/db.js'
import { emptyStats, emptyMeta, applyEvents, backfillFromData, historyEvents, META_ID } from './lib/stats.js'
import { DEFAULT_TEAM_COLORS } from './lib/colors.js'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const DEFAULT_SETTINGS = {
  id: 'app',
  teamSize: 1,
  panelSize: 84,
  gridCols: 0, // 0 = auto
  teamColors: DEFAULT_TEAM_COLORS,
  pickOrder: 'alternate', // 'alternate' draft | 'sequential' (P1 team first)
}

// Object-URL cache keyed by character id + version.
const urlCache = new Map()
function urlsFor(ch) {
  if (!ch) return { thumb: null, portrait: null }
  const cached = urlCache.get(ch.id)
  if (cached && cached.v === ch.v) return cached
  if (cached) {
    if (cached.thumb) URL.revokeObjectURL(cached.thumb)
    if (cached.portrait) URL.revokeObjectURL(cached.portrait)
  }
  const entry = {
    v: ch.v,
    thumb: ch.thumb ? URL.createObjectURL(ch.thumb) : null,
    portrait: ch.portrait ? URL.createObjectURL(ch.portrait) : null,
  }
  urlCache.set(ch.id, entry)
  return entry
}
function dropUrls(id) {
  const cached = urlCache.get(id)
  if (cached) {
    if (cached.thumb) URL.revokeObjectURL(cached.thumb)
    if (cached.portrait) URL.revokeObjectURL(cached.portrait)
    urlCache.delete(id)
  }
}

function sortChars(list) {
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt)
}

function statsRowsFromStore(rows) {
  const records = {}
  let meta = null
  for (const r of rows) {
    if (r.id === META_ID) meta = r
    else records[r.id] = r
  }
  return { records, meta }
}

export function StoreProvider({ children }) {
  const [loaded, setLoaded] = useState(false)
  const [characters, setCharacters] = useState([])
  const [history, setHistory] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [stats, setStats] = useState(emptyStats())

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [chars, hist, tours, sets, statRows] = await Promise.all([
          idbGetAll('characters'),
          idbGetAll('history'),
          idbGetAll('tournaments'),
          idbGetAll('settings'),
          idbGetAll('stats'),
        ])
        if (!alive) return
        setCharacters(sortChars(chars))
        setHistory(hist.sort((a, b) => b.at - a.at))
        setTournaments(tours.sort((a, b) => b.createdAt - a.createdAt))
        const appSettings = sets.find((s) => s.id === 'app')
        if (appSettings) setSettings({ ...DEFAULT_SETTINGS, ...appSettings })

        const { records, meta } = statsRowsFromStore(statRows)
        if (!meta) {
          // First run on this data: rebuild stats from whatever already exists.
          const filled = backfillFromData(hist, tours)
          setStats(filled)
          await idbPutMany('stats', [...Object.values(filled.records), filled.meta])
        } else {
          setStats({ records, meta })
        }
      } catch (err) {
        console.error('Failed to load from IndexedDB', err)
      }
      setLoaded(true)
    })()
    return () => { alive = false }
  }, [])

  const api = useMemo(() => {
    const persistStats = (next, changedIds) => {
      const rows = changedIds.map((id) => next.records[id]).filter(Boolean)
      idbPutMany('stats', [...rows, next.meta]).catch((e) => console.error('stats persist failed', e))
    }

    const recordResults = (events) => {
      if (!events || !events.length) return
      const next = applyEvents(stats, events, 1)
      setStats({ records: next.records, meta: next.meta })
      persistStats(next, next.changedIds)
    }

    const eraseResults = (events) => {
      if (!events || !events.length) return
      const next = applyEvents(stats, events, -1)
      setStats({ records: next.records, meta: next.meta })
      persistStats(next, next.changedIds)
    }

    return {
      urlsFor,

      async saveCharacter(partial) {
        let ch
        if (partial.id) {
          ch = { ...characters.find((c) => c.id === partial.id), ...partial }
          ch.v = (ch.v || 0) + 1
        } else {
          const maxOrder = characters.reduce((m, c) => Math.max(m, c.order ?? 0), 0)
          ch = {
            id: uid('c'),
            createdAt: Date.now(),
            order: maxOrder + 1,
            v: 1,
            thumb: null,
            portrait: null,
            ...partial,
          }
        }
        await idbPut('characters', ch)
        setCharacters((prev) => {
          const idx = prev.findIndex((c) => c.id === ch.id)
          const next = idx >= 0 ? prev.map((c) => (c.id === ch.id ? ch : c)) : [...prev, ch]
          return sortChars(next)
        })
        return ch
      },

      async deleteCharacter(id) {
        await idbDelete('characters', id)
        dropUrls(id)
        setCharacters((prev) => prev.filter((c) => c.id !== id))
      },

      async reorderCharacters(orderedIds) {
        const byId = new Map(characters.map((c) => [c.id, c]))
        const updated = orderedIds
          .map((id, i) => {
            const c = byId.get(id)
            return c ? { ...c, order: i + 1 } : null
          })
          .filter(Boolean)
        await idbPutMany('characters', updated)
        setCharacters(sortChars(updated))
      },

      async updateSettings(patch) {
        const next = { ...settings, ...patch, id: 'app' }
        setSettings(next)
        await idbPut('settings', next)
      },

      /** Record a completed exhibition / team battle: history entry + stats. */
      async addHistory(entry) {
        const rec = { id: uid('h'), at: Date.now(), ...entry }
        recordResults(historyEvents(rec))
        await idbPut('history', rec)
        setHistory((prev) => [rec, ...prev])
        return rec
      },

      async clearHistory() {
        await idbClear('history')
        setHistory([])
      },

      /** Stats hooks for tournament match results (called with tournamentEvent output). */
      recordResults,
      eraseResults,

      async resetStats() {
        const next = { records: {}, meta: { ...emptyMeta(), backfilled: true } }
        await idbClear('stats')
        await idbPut('stats', next.meta)
        setStats(next)
      },

      async saveTournament(t) {
        await idbPut('tournaments', t)
        setTournaments((prev) => {
          const idx = prev.findIndex((x) => x.id === t.id)
          return idx >= 0 ? prev.map((x) => (x.id === t.id ? t : x)) : [t, ...prev]
        })
      },

      async deleteTournament(id) {
        await idbDelete('tournaments', id)
        setTournaments((prev) => prev.filter((x) => x.id !== id))
      },
    }
  }, [characters, settings, stats])

  const value = useMemo(
    () => ({ loaded, characters, history, tournaments, settings, stats, ...api }),
    [loaded, characters, history, tournaments, settings, stats, api],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
