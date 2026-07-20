import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import CharacterEditor from './CharacterEditor.jsx'

export default function RosterManager() {
  const { characters, tournaments, deleteCharacter, urlsFor } = useStore()
  const [editing, setEditing] = useState(null) // null | 'new' | character

  const remove = async (ch) => {
    const activeTours = tournaments.filter(
      (t) => t.status === 'active' && t.entrants.some((e) => e.characterId === ch.id),
    )
    let msg = `Delete ${ch.name}? This cannot be undone.`
    if (activeTours.length) {
      msg = `⚠ ${ch.name} is competing in ${activeTours.length} active tournament${activeTours.length > 1 ? 's' : ''} (${activeTours.map((t) => t.name).join(', ')}).\n\nThe tournament keeps their name but loses their images. Delete anyway?`
    }
    if (window.confirm(msg)) await deleteCharacter(ch.id)
  }

  return (
    <div className="roster">
      <div className="roster__head">
        <h1 className="page-title">ROSTER</h1>
        <div className="roster__meta">{characters.length} fighter{characters.length === 1 ? '' : 's'}</div>
        <button className="btn btn--primary" onClick={() => setEditing('new')}>+ NEW FIGHTER</button>
      </div>

      {characters.length === 0 && (
        <div className="empty-state">
          <p>No fighters yet.</p>
          <p className="empty-state__sub">Create your first character — add a name, a square thumbnail and a full-body portrait.</p>
        </div>
      )}

      <div className="roster__grid">
        {characters.map((ch) => {
          const urls = urlsFor(ch)
          return (
            <div key={ch.id} className="roster-card">
              <div className="roster-card__img">
                {urls.thumb
                  ? <img src={urls.thumb} alt={ch.name} draggable={false} />
                  : <span className="placeholder-letter">{ch.name[0]?.toUpperCase() || '?'}</span>}
              </div>
              <div className="roster-card__name" title={ch.name}>{ch.name}</div>
              <div className="roster-card__actions">
                <button className="btn btn--small" onClick={() => setEditing(ch)}>Edit</button>
                <button className="btn btn--small btn--danger" onClick={() => remove(ch)}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <CharacterEditor
          character={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
