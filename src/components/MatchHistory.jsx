import React from 'react'
import { useStore } from '../store.jsx'

export default function MatchHistory() {
  const { history, clearHistory } = useStore()

  return (
    <div className="history">
      <div className="history__head">
        <h1 className="page-title">MATCH HISTORY</h1>
        {history.length > 0 && (
          <button
            className="btn btn--danger"
            onClick={() => { if (window.confirm('Clear all match history?')) clearHistory() }}
          >CLEAR HISTORY</button>
        )}
      </div>
      {history.length === 0 && (
        <div className="empty-state">
          <p>No matches recorded yet.</p>
          <p className="empty-state__sub">Finish a fight on the versus screen and it shows up here.</p>
        </div>
      )}
      <ul className="history__list">
        {history.map((h) => (
          <li key={h.id} className="history-row">
            <span className="history-row__date">{new Date(h.at).toLocaleString()}</span>
            <span className="history-row__format">{h.teamSize}v{h.teamSize}</span>
            <span className={`history-row__team ${h.winnerSide === 0 ? 'is-winner' : ''}`}>
              {h.teams[0].map((f) => f.name).join(', ')}
            </span>
            <span className="history-row__vs">vs</span>
            <span className={`history-row__team ${h.winnerSide === 1 ? 'is-winner' : ''}`}>
              {h.teams[1].map((f) => f.name).join(', ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
