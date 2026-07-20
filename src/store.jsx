import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { idbGetAll, idbPut, idbPutMany, idbDelete, idbClear, uid } from './lib/db.js'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const DEFAULT_SETTINGS = {
  id: 'app',
  teamSize: 1,
  panelSize: 84,
  gridCols: 0, // 0 = auto
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

export function StoreProvider({ children }) {
  const [loaded, setLoaded] = useState(false)
  const [characters, setCharacters] = useState([])
  const [history, setHistory] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [chars, hist, tours, sets] = await Promise.all([
          idbGetAll('characters'),
          idbGetAll('history'),
          idbGetAll('tournaments'),
          idbGetAll('settings'),
        ])
        if (!alive) return
        setCharacters(sortChars(chars))
        setHistory(hist.sort((a, b) => b.at - a.at))
        setTournaments(tours.sort((a, b) => b.createdAt - a.createdAt))
        const appSettings = sets.find((s) => s.id === 'app')
        if (appSettings) setSettings({ ...DEFAULT_SETTINGS, ...appSettings })
      } catch (err) {
        console.error('Failed to load from IndexedDB', err)
      }
      setLoaded(true)
    })()
    return () => { alive = false }
  }, [])

  const api = useMemo(() => ({
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

    async addHistory(entry) {
      const rec = { id: uid('h'), at: Date.now(), ...entry }
      await idbPut('history', rec)
      setHistory((prev) => [rec, ...prev])
      return rec
    },

    async clearHistory() {
      await idbClear('history')
      setHistory([])
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
  }), [characters, settings])

  const value = useMemo(
    () => ({ loaded, characters, history, tournaments, settings, ...api }),
    [loaded, characters, history, tournaments, settings, api],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
