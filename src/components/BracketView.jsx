import React, { useMemo, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import {
  BYE, entrantById, bracketRounds, roundName, currentRoundKeys, isPlayable, winsNeeded,
} from '../lib/bracket.js'

function MatchCard({ t, m, charById, urlsFor, onOpen, highlight }) {
  const rows = [0, 1].map((i) => {
    const pid = m.p[i]
    const e = pid && pid !== BYE ? entrantById(t, pid) : null
    const ch = e ? charById.get(e.characterId) : null
    const thumb = ch ? urlsFor(ch).thumb : null
    return {
      pid,
      name: pid === BYE ? 'BYE' : e ? e.name : '—',
      seed: e?.seed,
      thumb,
      isWinner: m.winner !== null && m.winner !== 'DRAW' && m.winner === pid,
      isLoser: m.winner !== null && m.winner !== 'DRAW' && m.winner !== pid && pid !== null,
    }
  })
  const playable = isPlayable(m)
  const done = m.winner !== null
  if (m.voided) {
    return <div className="match-card match-card--voided">not needed</div>
  }
  return (
    <div
      className={`match-card ${playable ? 'is-playable' : ''} ${done ? 'is-done' : ''} ${highlight ? 'is-current' : ''}`}
      onClick={() => onOpen(m.id)}
      title={playable ? 'Open match' : done ? 'View result' : 'Waiting on earlier matches'}
    >
      {rows.map((r, i) => (
        <div key={i} className={`match-card__row ${r.isWinner ? 'is-winner' : ''} ${r.isLoser ? 'is-loser' : ''} ${r.pid === BYE ? 'is-bye' : ''}`}>
          <span className="match-card__thumb">
            {r.thumb ? <img src={r.thumb} alt="" draggable={false} /> : <i>{r.name[0] || '?'}</i>}
          </span>
          {r.seed && <span className="match-card__seed">{r.seed}</span>}
          <span className="match-card__name">{r.name}</span>
          <span className="match-card__score">
            {m.winner === 'DRAW' ? '½'
              : m.bestOf > 1 ? m.score[i]
              : r.isWinner ? '✓' : ''}
          </span>
        </div>
      ))}
      {m.bestOf > 1 && !done && <span className="match-card__bo">Bo{m.bestOf}</span>}
    </div>
  )
}

function RoundColumn({ t, roundMatches, bracket, round, charById, urlsFor, onOpen, current, rowSpanBasis }) {
  return (
    <div className="bracket-col" style={{ minHeight: rowSpanBasis }}>
      <div className={`bracket-col__head ${current ? 'is-current' : ''}`}>
        {roundName(t, bracket, round)}
      </div>
      <div className="bracket-col__matches">
        {roundMatches.map((m) => (
          <MatchCard key={m.id} t={t} m={m} charById={charById} urlsFor={urlsFor} onOpen={onOpen} highlight={current && isPlayable(m)} />
        ))}
      </div>
    </div>
  )
}

const ROW_H = 74

export default function BracketView({ tournament, onOpenMatch }) {
  const t = tournament
  const { characters, urlsFor } = useStore()
  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])
  const [zoom, setZoom] = useState(1)
  const scroller = useRef(null)
  const panning = useRef(null)

  const groups = useMemo(() => bracketRounds(t), [t])
  const current = useMemo(() => currentRoundKeys(t), [t])

  const wbBasis = (groups.W[0]?.length || 1) * ROW_H
  const lbBasis = (groups.L[0]?.length || 1) * ROW_H

  const startPan = (e) => {
    if (e.target.closest('.match-card')) return
    const el = scroller.current
    panning.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop }
  }
  const movePan = (e) => {
    const p = panning.current
    if (!p) return
    const el = scroller.current
    el.scrollLeft = p.sl - (e.clientX - p.x)
    el.scrollTop = p.st - (e.clientY - p.y)
  }
  const endPan = () => { panning.current = null }

  const onWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    setZoom((z) => Math.min(1.5, Math.max(0.2, z * (e.deltaY > 0 ? 0.9 : 1.1))))
  }

  return (
    <div className="bracket-wrap">
      <div className="bracket-zoom">
        <button className="btn btn--small" onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.1).toFixed(2)))}>−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button className="btn btn--small" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}>+</button>
        <button className="btn btn--small" onClick={() => setZoom(1)}>100%</button>
        <span className="bracket-zoom__hint">Ctrl+scroll to zoom · drag to pan</span>
      </div>
      <div
        ref={scroller}
        className="bracket-scroller"
        onMouseDown={startPan}
        onMouseMove={movePan}
        onMouseUp={endPan}
        onMouseLeave={endPan}
        onWheel={onWheel}
      >
        <div className="bracket-canvas" style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
          <div className="bracket-section">
            {t.format === 'double' && <div className="bracket-section__label">WINNERS BRACKET</div>}
            <div className="bracket-row">
              {groups.W.map((matches, i) => (
                <RoundColumn
                  key={`W${i + 1}`} t={t} roundMatches={matches} bracket="W" round={i + 1}
                  charById={charById} urlsFor={urlsFor} onOpen={onOpenMatch}
                  current={current.has(`W${i + 1}`)} rowSpanBasis={wbBasis}
                />
              ))}
              {groups.G.map((matches, i) => (
                <RoundColumn
                  key={`G${i + 1}`} t={t} roundMatches={matches} bracket="G" round={i + 1}
                  charById={charById} urlsFor={urlsFor} onOpen={onOpenMatch}
                  current={current.has(`G${i + 1}`)} rowSpanBasis={ROW_H}
                />
              ))}
            </div>
          </div>
          {groups.L.length > 0 && (
            <div className="bracket-section">
              <div className="bracket-section__label">LOSERS BRACKET</div>
              <div className="bracket-row">
                {groups.L.map((matches, i) => (
                  <RoundColumn
                    key={`L${i + 1}`} t={t} roundMatches={matches} bracket="L" round={i + 1}
                    charById={charById} urlsFor={urlsFor} onOpen={onOpenMatch}
                    current={current.has(`L${i + 1}`)} rowSpanBasis={lbBasis}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
