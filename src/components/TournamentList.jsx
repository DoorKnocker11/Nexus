import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import TournamentCreate from './TournamentCreate.jsx'
import TournamentView from './TournamentView.jsx'
import { entrantById } from '../lib/bracket.js'

const FORMAT_LABELS = { single: 'Single Elim', double: 'Double Elim', rr: 'Round Robin' }

export default function TournamentList() {
  const { tournaments, characters, deleteTournament } = useStore()
  const [view, setView] = useState({ mode: 'list' }) // list | create | open:id

  if (view.mode === 'create') {
    return (
      <TournamentCreate
        onCreated={(id) => setView({ mode: 'open', id })}
        onCancel={() => setView({ mode: 'list' })}
      />
    )
  }

  if (view.mode === 'open') {
    const t = tournaments.find((x) => x.id === view.id)
    if (t) return <TournamentView tournament={t} onBack={() => setView({ mode: 'list' })} />
  }

  return (
    <div className="tour-list">
      <div className="tour-list__head">
        <h1 className="page-title">TOURNAMENTS</h1>
        <button
          className="btn btn--primary"
          onClick={() => setView({ mode: 'create' })}
          disabled={characters.length < 2}
          title={characters.length < 2 ? 'Add at least 2 characters to your roster first' : undefined}
        >+ NEW TOURNAMENT</button>
      </div>

      {tournaments.length === 0 && (
        <div className="empty-state">
          <p>No tournaments yet.</p>
          <p className="empty-state__sub">
            {characters.length < 2
              ? 'Add at least two fighters to your roster, then create a bracket.'
              : 'Create one — single elim, double elim or round robin, up to 200 fighters.'}
          </p>
        </div>
      )}

      <ul className="tour-list__items">
        {tournaments.map((t) => {
          const champ = t.championId ? entrantById(t, t.championId) : null
          const played = t.matches.filter((m) => m.winner !== null && !m.auto && !m.voided).length
          const total = t.matches.filter((m) => !m.voided && !(m.auto && m.winner !== null)).length
          return (
            <li key={t.id} className="tour-item">
              <button className="tour-item__main" onClick={() => setView({ mode: 'open', id: t.id })}>
                <span className="tour-item__name">{t.name}</span>
                <span className="tour-item__meta">
                  {FORMAT_LABELS[t.format]} · {t.entrants.length} fighters · {played}/{total} played
                  {' · '}{new Date(t.createdAt).toLocaleDateString()}
                </span>
                <span className={`tour-item__status ${t.status === 'complete' ? 'is-complete' : ''}`}>
                  {t.status === 'complete' ? `👑 ${champ?.name || 'Complete'}` : 'IN PROGRESS'}
                </span>
              </button>
              <button
                className="btn btn--danger btn--small"
                onClick={() => { if (window.confirm(`Delete tournament “${t.name}”?`)) deleteTournament(t.id) }}
              >Delete</button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
