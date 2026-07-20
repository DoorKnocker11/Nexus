import React, { useMemo } from 'react'
import { useStore } from '../store.jsx'
import { DRAW, entrantById, rrStandings, bracketRounds, isPlayable } from '../lib/bracket.js'

export default function RoundRobinTable({ tournament, onOpenMatch }) {
  const t = tournament
  const { characters, urlsFor } = useStore()
  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])
  const standings = useMemo(() => rrStandings(t), [t])
  const rounds = useMemo(() => bracketRounds(t).RR, [t])

  const thumbFor = (entrantId) => {
    const e = entrantById(t, entrantId)
    const ch = e ? charById.get(e.characterId) : null
    return ch ? urlsFor(ch).thumb : null
  }

  return (
    <div className="rr-view">
      <div className="rr-standings">
        <h3 className="rr-heading">STANDINGS</h3>
        <table className="rr-table">
          <thead>
            <tr>
              <th>#</th><th className="rr-table__name">Fighter</th>
              <th>P</th><th>W</th><th>D</th><th>L</th><th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => (
              <tr key={row.entrantId} className={t.championId === row.entrantId ? 'is-champion' : ''}>
                <td>{i + 1}</td>
                <td className="rr-table__name">
                  <span className="rr-table__thumb">
                    {thumbFor(row.entrantId)
                      ? <img src={thumbFor(row.entrantId)} alt="" />
                      : <i>{row.name[0]}</i>}
                  </span>
                  {row.name}
                  {t.championId === row.entrantId && ' 👑'}
                </td>
                <td>{row.played}</td><td>{row.w}</td><td>{row.d}</td><td>{row.l}</td>
                <td className="rr-table__pts">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="rr-tiebreak-note">Tiebreakers: points → head-to-head → wins → seed</p>
      </div>

      <div className="rr-rounds">
        {rounds.map((matches, i) => (
          <div key={i} className="rr-round">
            <h4 className="rr-round__title">ROUND {i + 1}</h4>
            <div className="rr-round__matches">
              {matches.map((m) => {
                const a = entrantById(t, m.p[0]), b = entrantById(t, m.p[1])
                const done = m.winner !== null
                return (
                  <button
                    key={m.id}
                    className={`rr-match ${done ? 'is-done' : ''} ${isPlayable(m) ? 'is-playable' : ''}`}
                    onClick={() => onOpenMatch(m.id)}
                  >
                    <span className={`rr-match__p ${m.winner === m.p[0] ? 'is-winner' : ''}`}>{a?.name || '?'}</span>
                    <span className="rr-match__mid">
                      {done ? (m.winner === DRAW ? '½–½' : `${m.score[0]}–${m.score[1]}`) : 'vs'}
                    </span>
                    <span className={`rr-match__p rr-match__p--right ${m.winner === m.p[1] ? 'is-winner' : ''}`}>{b?.name || '?'}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
