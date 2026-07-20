import React, { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import VsStage from './VsStage.jsx'

/** Exhibition versus screen for the character select flow. */
export default function VersusScreen({ teams, onClose, onRematch }) {
  const { characters, urlsFor, addHistory } = useStore()
  const [winnerSide, setWinnerSide] = useState(null)

  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])

  const sides = teams.map((team, i) => ({
    label: i === 0 ? 'PLAYER 1' : 'PLAYER 2',
    fighters: team.map((id) => {
      const ch = charById.get(id)
      return { name: ch?.name || '???', portraitUrl: ch ? urlsFor(ch).portrait : null }
    }),
  }))

  const pick = (side) => {
    if (winnerSide !== null) return
    setWinnerSide(side)
    addHistory({
      mode: 'exhibition',
      teamSize: teams[0].length,
      teams: teams.map((team) => team.map((id) => ({
        characterId: id,
        name: charById.get(id)?.name || '???',
      }))),
      winnerSide: side,
    })
  }

  const winnerNames = winnerSide !== null ? sides[winnerSide].fighters.map((f) => f.name).join(' & ') : ''
  const banner = winnerSide === null
    ? null
    : teams[0].length === 1 ? `${winnerNames} WINS!` : `${sides[winnerSide].label} WINS!`

  return (
    <div className="versus-overlay">
      <VsStage sides={sides} winnerSide={winnerSide} onPickSide={winnerSide === null ? pick : null} banner={banner}>
        <div className="vs-stage__footer">
          {winnerSide === null ? (
            <span className="vs-hint">Click a side to declare the winner</span>
          ) : (
            <>
              <button className="btn btn--primary" onClick={onRematch}>REMATCH</button>
              <button className="btn" onClick={onClose}>BACK TO SELECT</button>
            </>
          )}
          {winnerSide === null && <button className="btn" onClick={onClose}>CANCEL</button>}
        </div>
      </VsStage>
    </div>
  )
}
