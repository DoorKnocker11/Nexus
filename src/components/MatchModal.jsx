import React, { useMemo } from 'react'
import { useStore } from '../store.jsx'
import VsStage from './VsStage.jsx'
import {
  BYE, DRAW, entrantById, isPlayable, winsNeeded, canResetMatch, roundName,
} from '../lib/bracket.js'

const BO_OPTIONS = [1, 3, 5, 7]

/**
 * Full-screen VS preview for a bracket / round-robin match.
 * mutate(fn) applies fn to a fresh copy of the tournament and persists it.
 */
export default function MatchModal({ tournament, matchId, mutate, onClose, actions }) {
  const { characters, urlsFor } = useStore()
  const t = tournament
  const m = t.matches.find((x) => x.id === matchId)
  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])

  if (!m) return null

  const fighterFor = (pid) => {
    if (pid === null) return { name: 'TBD', portraitUrl: null }
    if (pid === BYE) return { name: 'BYE', portraitUrl: null }
    const e = entrantById(t, pid)
    const ch = e ? charById.get(e.characterId) : null
    return { name: e?.name || '???', portraitUrl: ch ? urlsFor(ch).portrait : null, seed: e?.seed }
  }

  const isDraw = m.winner === DRAW
  const winnerSide = isDraw || m.winner === null ? null : m.p[0] === m.winner ? 0 : 1
  const playable = isPlayable(m)
  const need = winsNeeded(m)

  const sides = [0, 1].map((i) => {
    const f = fighterFor(m.p[i])
    return {
      label: f.seed ? `SEED #${f.seed}` : ' ',
      fighters: [f],
      score: m.bestOf > 1 ? `${m.score[i]}` : undefined,
    }
  })

  const banner = isDraw
    ? 'DRAW'
    : winnerSide !== null
      ? `${sides[winnerSide].fighters[0].name} WINS!`
      : null

  const subtitle = `${roundName(t, m.bracket, m.round)} · Best of ${m.bestOf}`

  const pick = (side) => {
    if (!playable) return
    mutate((tt) => actions.reportScore(tt, matchId, side))
  }

  return (
    <div className="versus-overlay" onClick={onClose}>
      <div className="versus-overlay__inner" onClick={(e) => e.stopPropagation()}>
        <VsStage
          sides={sides}
          winnerSide={winnerSide}
          onPickSide={playable ? pick : null}
          banner={banner}
          subtitle={subtitle}
        >
          {m.bestOf > 1 && (
            <div className="series-pips">
              {[0, 1].map((i) => (
                <div key={i} className={`series-pips__side ${i === 1 ? 'series-pips__side--right' : ''}`}>
                  {Array.from({ length: need }).map((_, k) => (
                    <span key={k} className={`pip ${k < m.score[i] ? 'is-on' : ''}`} />
                  ))}
                  {m.winner === null && m.score[i] > 0 && (
                    <button className="btn btn--tiny" title="Remove a game win"
                      onClick={() => mutate((tt) => actions.decrementScore(tt, matchId, i))}>−</button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="vs-stage__footer">
            {playable && <span className="vs-hint">
              {m.bestOf > 1 ? `Click a side to add a game win — first to ${need}` : 'Click a side to declare the winner'}
            </span>}
            {playable && m.winner === null && (
              <span className="bo-picker">
                {BO_OPTIONS.map((n) => (
                  <button key={n}
                    className={`btn btn--tiny ${m.bestOf === n ? 'is-on' : ''}`}
                    onClick={() => mutate((tt) => actions.setMatchBestOf(tt, matchId, n))}
                  >Bo{n}</button>
                ))}
              </span>
            )}
            {playable && t.format === 'rr' && m.bestOf === 1 && (
              <button className="btn" onClick={() => mutate((tt) => actions.reportDraw(tt, matchId))}>DECLARE DRAW</button>
            )}
            {(m.winner !== null || m.score[0] > 0 || m.score[1] > 0) && canResetMatch(t, matchId) && (
              <button className="btn btn--danger" onClick={() => {
                if (window.confirm('Reset this match result?')) mutate((tt) => actions.resetMatch(tt, matchId))
              }}>RESET MATCH</button>
            )}
            {m.winner !== null && !canResetMatch(t, matchId) && !m.auto && (
              <span className="vs-hint vs-hint--dim">Later results depend on this match — reset those first.</span>
            )}
            <button className="btn" onClick={onClose}>CLOSE</button>
          </div>
        </VsStage>
      </div>
    </div>
  )
}
