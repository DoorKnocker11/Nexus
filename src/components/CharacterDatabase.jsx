import React, { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { STAT_MODES, modeSums, totalsSum, winRate, emptyModes } from '../lib/stats.js'

const MODE_LABELS = { versus: 'Versus (1v1)', team: 'Team Battle', tournament: 'Tournament' }
const COLUMNS = [
  ['name', 'Fighter'],
  ['p', 'Played'],
  ['w', 'Wins'],
  ['l', 'Losses'],
  ['rate', 'Win %'],
  ['share', 'Played %'],
]

function pct(x, digits = 1) {
  return `${(x * 100).toFixed(digits)}%`
}

export default function CharacterDatabase() {
  const { characters, stats, resetStats, urlsFor } = useStore()
  const [sort, setSort] = useState({ key: 'p', dir: -1 })
  const [query, setQuery] = useState('')
  const [detailId, setDetailId] = useState(null)

  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])

  const rows = useMemo(() => {
    // Union of the live roster and every character that has recorded stats
    // (keeps rows for deleted characters, flagged as such).
    const ids = new Set([...characters.map((c) => c.id), ...Object.keys(stats.records)])
    const list = []
    let totalAppearances = 0
    for (const id of ids) {
      const rec = stats.records[id]
      const ch = charById.get(id)
      const sums = rec ? modeSums(rec) : { p: 0, w: 0, l: 0, d: 0 }
      totalAppearances += sums.p
      list.push({
        id,
        name: ch?.name || rec?.name || '???',
        deleted: !ch,
        ...sums,
        rate: winRate(sums),
        modes: rec ? rec.modes : emptyModes(),
      })
    }
    for (const r of list) r.share = totalAppearances ? r.p / totalAppearances : 0
    return list
  }, [characters, stats, charById])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : [...rows]
    const { key, dir } = sort
    filtered.sort((a, b) => {
      if (key === 'name') return dir * a.name.localeCompare(b.name)
      const av = key === 'rate' ? (a.rate ?? -1) : a[key]
      const bv = key === 'rate' ? (b.rate ?? -1) : b[key]
      return dir * (av - bv) || a.name.localeCompare(b.name)
    })
    return filtered
  }, [rows, sort, query])

  const clickSort = (key) => {
    setSort((s) => s.key === key ? { key, dir: -s.dir } : { key, dir: key === 'name' ? 1 : -1 })
  }

  const totalMatches = totalsSum(stats.meta)
  const detail = detailId ? shown.find((r) => r.id === detailId) || rows.find((r) => r.id === detailId) : null
  const detailChar = detail ? charById.get(detail.id) : null
  const detailUrls = detailChar ? urlsFor(detailChar) : {}

  return (
    <div className="database">
      <div className="database__head">
        <h1 className="page-title">DATABASE</h1>
        <div className="database__total">
          <span className="database__total-num">{totalMatches}</span>
          <span className="database__total-label">
            completed matches
            {totalMatches > 0 && (
              <em> · {stats.meta.totals.versus} versus · {stats.meta.totals.team} team · {stats.meta.totals.tournament} tournament</em>
            )}
          </span>
        </div>
        <input
          className="field__input database__search"
          placeholder="Search fighters…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="btn btn--danger"
          onClick={() => {
            if (window.confirm('Reset ALL lifetime stats? Match history and tournaments are kept, but every fighter’s record starts from zero. This cannot be undone.')) {
              resetStats()
            }
          }}
        >RESET ALL STATS</button>
      </div>

      {rows.length === 0 && (
        <div className="empty-state">
          <p>No fighters yet.</p>
          <p className="empty-state__sub">Stats appear here automatically as soon as matches are played.</p>
        </div>
      )}

      {rows.length > 0 && (
        <table className="db-table">
          <thead>
            <tr>
              {COLUMNS.map(([key, label]) => (
                <th
                  key={key}
                  className={`db-table__th ${key === 'name' ? 'db-table__th--name' : ''}`}
                  onClick={() => clickSort(key)}
                >
                  {label}{sort.key === key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const ch = charById.get(r.id)
              const urls = ch ? urlsFor(ch) : {}
              return (
                <tr key={r.id} className="db-table__row" onClick={() => setDetailId(r.id)}>
                  <td className="db-table__name">
                    <span className="rr-table__thumb">
                      {urls.thumb ? <img src={urls.thumb} alt="" /> : <i>{r.name[0]}</i>}
                    </span>
                    {r.name}
                    {r.deleted && <em className="db-table__deleted"> (deleted)</em>}
                  </td>
                  <td>{r.p}</td>
                  <td className="db-table__w">{r.w}</td>
                  <td className="db-table__l">{r.l}</td>
                  <td>{r.rate === null ? '—' : pct(r.rate, 0)}</td>
                  <td>{r.p === 0 ? '—' : pct(r.share)}</td>
                </tr>
              )
            })}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="db-table__empty">No fighters match “{query}”.</td></tr>
            )}
          </tbody>
        </table>
      )}

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetailId(null)}>
          <div className="modal db-detail" onClick={(e) => e.stopPropagation()}>
            <div className="db-detail__left">
              {detailUrls.portrait
                ? <img className="db-detail__portrait" src={detailUrls.portrait} alt={detail.name} />
                : <div className="db-detail__placeholder">{detail.name[0]?.toUpperCase()}</div>}
            </div>
            <div className="db-detail__right">
              <h2 className="modal__title">{detail.name}{detail.deleted ? ' (deleted)' : ''}</h2>
              <div className="db-detail__summary">
                {detail.p} played · {detail.w}W {detail.l}L{detail.d ? ` ${detail.d}D` : ''}
                {detail.rate !== null && ` · ${pct(detail.rate, 0)} win rate`}
                {detail.p > 0 && ` · ${pct(detail.share)} of all appearances`}
              </div>
              <table className="db-mode-table">
                <thead>
                  <tr><th>Mode</th><th>P</th><th>W</th><th>L</th><th>D</th><th>Win %</th></tr>
                </thead>
                <tbody>
                  {STAT_MODES.map((m) => {
                    const row = detail.modes[m]
                    const rate = winRate(row)
                    return (
                      <tr key={m}>
                        <td className="db-mode-table__mode">{MODE_LABELS[m]}</td>
                        <td>{row.p}</td><td>{row.w}</td><td>{row.l}</td><td>{row.d}</td>
                        <td>{rate === null ? '—' : pct(rate, 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="modal__actions">
                <button className="btn" onClick={() => setDetailId(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
