import React, { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import VsStage from './VsStage.jsx'

/**
 * Winner-stays elimination team battle (crew battle).
 * All battle state derives from the bout list, so undo is just a pop.
 *
 * teams: [[charId...], [charId...]] — ordered lineups.
 */
function deriveBattle(lineups, bouts) {
  const idx = [0, 0] // current fighter index per side
  for (const b of bouts) idx[1 - b.winnerSide] += 1
  const winner = idx[0] >= lineups[0].length ? 1 : idx[1] >= lineups[1].length ? 0 : null
  // Current fighter's streak = trailing consecutive bouts won by that side
  // (a fighter only leaves when they lose, so trailing wins all belong to them).
  const streaks = [0, 0]
  for (let i = bouts.length - 1; i >= 0; i--) {
    const s = bouts[i].winnerSide
    if (streaks[1 - s] > 0) break
    streaks[s] += 1
    if (i > 0 && bouts[i - 1].winnerSide !== s) break
  }
  return { idx, winner, streaks }
}

export default function TeamBattleScreen({ teams, onClose }) {
  const { characters, urlsFor, addHistory, settings } = useStore()
  const [bouts, setBouts] = useState([]) // [{a: idx0, b: idx1, winnerSide}]
  const [recorded, setRecorded] = useState(false)

  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])
  const info = (charId) => {
    const ch = charById.get(charId)
    return { characterId: charId, name: ch?.name || '???', portraitUrl: ch ? urlsFor(ch).portrait : null, thumbUrl: ch ? urlsFor(ch).thumb : null }
  }

  const { idx, winner, streaks } = deriveBattle(teams, bouts)
  const teamSize = teams[0].length
  const colors = settings.teamColors || []

  const current = winner === null ? [info(teams[0][idx[0]]), info(teams[1][idx[1]])] : null

  const record = (finalBouts, winnerSide) => {
    if (recorded) return
    setRecorded(true)
    addHistory({
      mode: 'teamBattle',
      teamSize,
      teams: teams.map((team) => team.map((id) => ({ characterId: id, name: charById.get(id)?.name || '???' }))),
      winnerSide,
      bouts: finalBouts.map((b) => ({
        a: { characterId: teams[0][b.a], name: charById.get(teams[0][b.a])?.name || '???' },
        b: { characterId: teams[1][b.b], name: charById.get(teams[1][b.b])?.name || '???' },
        winnerSide: b.winnerSide,
      })),
    })
  }

  const pick = (side) => {
    if (winner !== null) return
    const bout = { a: idx[0], b: idx[1], winnerSide: side }
    const next = [...bouts, bout]
    setBouts(next)
    const after = deriveBattle(teams, next)
    if (after.winner !== null) record(next, after.winner)
  }

  const undo = () => {
    if (!bouts.length || winner !== null) return
    setBouts(bouts.slice(0, -1))
  }

  const rematch = () => { setBouts([]); setRecorded(false) }

  const close = () => {
    if (winner === null && bouts.length > 0 &&
        !window.confirm('Abandon this battle? Nothing will be recorded.')) return
    onClose()
  }

  const sides = current
    ? current.map((f, i) => ({
        label: `TEAM ${i + 1}${streaks[i] > 0 ? ` · ${streaks[i]} KO${streaks[i] > 1 ? 's' : ''}` : ''}`,
        fighters: [f],
      }))
    : null

  const survivorNames = winner !== null
    ? teams[winner].slice(idx[winner]).map((id) => charById.get(id)?.name || '???')
    : []

  return (
    <div className="versus-overlay">
      <div className="team-battle">
        <LineupTracker side={0} lineup={teams[0]} idx={idx[0]} streak={streaks[0]} color={colors[0]} info={info} winner={winner} />

        <div className="team-battle__stage">
          {winner === null ? (
            <VsStage
              key={bouts.length}
              sides={sides}
              winnerSide={null}
              onPickSide={pick}
              subtitle={`ELIMINATION ${teamSize}v${teamSize} · BOUT ${bouts.length + 1}`}
            >
              <div className="vs-stage__footer">
                <span className="vs-hint">Click a side to declare the bout winner — winner stays, loser is out</span>
                {bouts.length > 0 && <button className="btn" onClick={undo}>UNDO BOUT</button>}
                <button className="btn" onClick={close}>CANCEL</button>
              </div>
            </VsStage>
          ) : (
            <div className="battle-summary">
              <div className="vs-stage__banner battle-summary__banner">
                <span>TEAM {winner + 1} WINS!</span>
              </div>
              <div className="battle-summary__survivors">
                Survivor{survivorNames.length > 1 ? 's' : ''}: <strong>{survivorNames.join(', ')}</strong>
              </div>
              <ol className="battle-summary__bouts">
                {bouts.map((b, i) => {
                  const winName = b.winnerSide === 0 ? info(teams[0][b.a]).name : info(teams[1][b.b]).name
                  const loseName = b.winnerSide === 0 ? info(teams[1][b.b]).name : info(teams[0][b.a]).name
                  return (
                    <li key={i} className={`battle-summary__bout battle-summary__bout--t${b.winnerSide + 1}`}>
                      <span className="battle-summary__num">{i + 1}</span>
                      <strong>{winName}</strong> KO’d {loseName}
                    </li>
                  )
                })}
              </ol>
              <div className="vs-stage__footer">
                <button className="btn btn--primary" onClick={rematch}>REMATCH</button>
                <button className="btn" onClick={onClose}>BACK TO SELECT</button>
              </div>
            </div>
          )}
        </div>

        <LineupTracker side={1} lineup={teams[1]} idx={idx[1]} streak={streaks[1]} color={colors[1]} info={info} winner={winner} />
      </div>
    </div>
  )
}

function LineupTracker({ side, lineup, idx, streak, color, info, winner }) {
  return (
    <div className={`lineup lineup--t${side + 1} ${winner === side ? 'is-winning' : ''}`} style={{ '--side-color': color }}>
      <div className="lineup__title">TEAM {side + 1}</div>
      {lineup.map((charId, i) => {
        const f = info(charId)
        const state = i < idx ? 'is-out' : i === idx && winner === null ? 'is-current' : winner === side && i >= idx ? 'is-survivor' : ''
        return (
          <div key={i} className={`lineup__member ${state}`}>
            <span className="lineup__thumb">
              {f.thumbUrl ? <img src={f.thumbUrl} alt="" draggable={false} /> : <i>{f.name[0]}</i>}
            </span>
            <span className="lineup__name">{f.name}</span>
            {i === idx && winner === null && streak > 0 && (
              <span className="lineup__streak">{streak} KO{streak > 1 ? 's' : ''}</span>
            )}
            {i < idx && <span className="lineup__x">✕</span>}
          </div>
        )
      })}
    </div>
  )
}
