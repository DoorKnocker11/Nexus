import React, { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import BracketView from './BracketView.jsx'
import RoundRobinTable from './RoundRobinTable.jsx'
import MatchModal from './MatchModal.jsx'
import * as bracket from '../lib/bracket.js'

const FORMAT_LABELS = { single: 'Single Elimination', double: 'Double Elimination', rr: 'Round Robin' }

export default function TournamentView({ tournament, onBack }) {
  const { characters, urlsFor, saveTournament } = useStore()
  const t = tournament
  const [openMatchId, setOpenMatchId] = useState(null)

  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])

  const mutate = (fn) => {
    const copy = structuredClone(t)
    fn(copy)
    saveTournament(copy)
  }

  const champion = t.championId ? bracket.entrantById(t, t.championId) : null
  const champChar = champion ? charById.get(champion.characterId) : null
  const champUrls = champChar ? urlsFor(champChar) : {}

  const played = t.matches.filter((m) => m.winner !== null && !m.auto && !m.voided).length
  const total = t.matches.filter((m) => !m.voided && !(m.auto && m.winner !== null)).length

  return (
    <div className="tour-view">
      <div className="tour-view__head">
        <button className="btn" onClick={onBack}>← Tournaments</button>
        <div className="tour-view__titles">
          <h1 className="page-title">{t.name}</h1>
          <span className="tour-view__meta">
            {FORMAT_LABELS[t.format]} · {t.entrants.length} fighters · {played}/{total} matches played
            {t.format !== 'rr' && ` · Bo${t.settings.bestOf.default}${t.settings.bestOf.finals !== t.settings.bestOf.default ? `, finals Bo${t.settings.bestOf.finals}` : ''}`}
          </span>
        </div>
        {t.status === 'complete' && <span className="tour-view__complete">COMPLETE</span>}
      </div>

      {champion && (
        <div className="champion-banner">
          <div className="champion-banner__glow" />
          {champUrls.portrait && <img className="champion-banner__img" src={champUrls.portrait} alt={champion.name} />}
          <div className="champion-banner__text">
            <span className="champion-banner__label">CHAMPION</span>
            <span className="champion-banner__name">{champion.name}</span>
          </div>
        </div>
      )}

      {t.format === 'rr'
        ? <RoundRobinTable tournament={t} onOpenMatch={setOpenMatchId} />
        : <BracketView tournament={t} onOpenMatch={setOpenMatchId} />}

      {openMatchId && (
        <MatchModal
          tournament={t}
          matchId={openMatchId}
          mutate={mutate}
          actions={bracket}
          onClose={() => setOpenMatchId(null)}
        />
      )}
    </div>
  )
}
