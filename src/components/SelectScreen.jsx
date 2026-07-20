import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store.jsx'

const TEAM_SIZES = [1, 2, 3, 4, 5, 6, 7, 8]

export default function SelectScreen({ onFight }) {
  const { characters, settings, updateSettings, reorderCharacters, urlsFor } = useStore()
  const teamSize = settings.teamSize || 1
  const panelSize = settings.panelSize || 84
  const gridCols = settings.gridCols || 0

  const [teams, setTeams] = useState([Array(teamSize).fill(null), Array(teamSize).fill(null)])
  const [cursor, setCursor] = useState({ side: 0, slot: 0 })
  const [hoverId, setHoverId] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const dragId = useRef(null)

  useEffect(() => {
    setTeams([Array(teamSize).fill(null), Array(teamSize).fill(null)])
    setCursor({ side: 0, slot: 0 })
  }, [teamSize])

  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])

  const nextEmpty = (t, after) => {
    // scan side 0 slots then side 1 slots, starting just after `after`
    const order = []
    for (let s = 0; s < 2; s++) for (let i = 0; i < teamSize; i++) order.push({ side: s, slot: i })
    const startIdx = after ? order.findIndex((o) => o.side === after.side && o.slot === after.slot) + 1 : 0
    for (let k = 0; k < order.length; k++) {
      const o = order[(startIdx + k) % order.length]
      if (t[o.side][o.slot] === null) return o
    }
    return null
  }

  const assign = (charId, target) => {
    const at = target || cursor
    if (!at) return
    setTeams((prev) => {
      const next = prev.map((arr) => [...arr])
      next[at.side][at.slot] = charId
      setCursor(nextEmpty(next, at) || at)
      return next
    })
  }

  const clearSlot = (side, slot) => {
    setTeams((prev) => {
      const next = prev.map((arr) => [...arr])
      next[side][slot] = null
      return next
    })
    setCursor({ side, slot })
  }

  const randomChar = () => characters[Math.floor(Math.random() * characters.length)]?.id

  const randomSlot = () => {
    if (!characters.length) return
    assign(randomChar())
  }

  const randomAll = () => {
    if (!characters.length) return
    setTeams((prev) => {
      const next = prev.map((arr) => arr.map((v) => v === null ? randomChar() : v))
      setCursor(nextEmpty(next, null) || cursor)
      return next
    })
  }

  const clearAll = () => {
    setTeams([Array(teamSize).fill(null), Array(teamSize).fill(null)])
    setCursor({ side: 0, slot: 0 })
  }

  const full = teams.every((side) => side.every((v) => v !== null))
  const hoverChar = hoverId ? charById.get(hoverId) : null
  const cursorChar = cursor && teams[cursor.side][cursor.slot] ? charById.get(teams[cursor.side][cursor.slot]) : null
  const previewChar = hoverChar || cursorChar || null
  const previewUrls = previewChar ? urlsFor(previewChar) : {}

  // drag-to-reorder roster panels
  const onDropPanel = (targetId) => {
    const from = dragId.current
    dragId.current = null
    if (!from || from === targetId) return
    const ids = characters.map((c) => c.id)
    const fromIdx = ids.indexOf(from)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0) return
    ids.splice(toIdx, 0, ids.splice(fromIdx, 1)[0])
    reorderCharacters(ids)
  }

  const teamCount = (side, id) => teams[side].filter((v) => v === id).length

  if (!characters.length) {
    return (
      <div className="select-screen select-screen--empty">
        <div className="empty-state">
          <p>Your roster is empty.</p>
          <p className="empty-state__sub">Head to the ROSTER tab and create some fighters first.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="select-screen">
      <div className="select-topbar">
        <h1 className="select-title">CHOOSE YOUR FIGHTER{teamSize > 1 ? 'S' : ''}</h1>
        <div className="select-controls">
          <label className="select-format">
            <span>FORMAT</span>
            <select
              value={teamSize}
              onChange={(e) => updateSettings({ teamSize: Number(e.target.value) })}
            >
              {TEAM_SIZES.map((n) => <option key={n} value={n}>{n}v{n}</option>)}
            </select>
          </label>
          <button className="btn" onClick={randomSlot} disabled={full} title="Random this slot">🎲 SLOT</button>
          <button className="btn" onClick={randomAll} disabled={full} title="Random all remaining">🎲 ALL</button>
          <button className="btn" onClick={clearAll}>CLEAR</button>
          <button className="btn btn--icon" onClick={() => setShowSettings((s) => !s)} title="Grid settings">⚙</button>
        </div>
      </div>

      {showSettings && (
        <div className="grid-settings">
          <label>
            Panel size
            <input
              type="range" min="48" max="140" value={panelSize}
              onChange={(e) => updateSettings({ panelSize: Number(e.target.value) })}
            />
            <span>{panelSize}px</span>
          </label>
          <label>
            Columns
            <select value={gridCols} onChange={(e) => updateSettings({ gridCols: Number(e.target.value) })}>
              <option value={0}>Auto</option>
              {[4, 5, 6, 7, 8, 10, 12, 14, 16, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span className="grid-settings__hint">Drag panels to reorder the roster.</span>
        </div>
      )}

      <div className="select-main">
        <div className="select-preview">
          {previewChar ? (
            <>
              {previewUrls.portrait
                ? <img className="select-preview__img" src={previewUrls.portrait} alt={previewChar.name} draggable={false} />
                : <div className="select-preview__placeholder">{previewChar.name[0]?.toUpperCase()}</div>}
              <div className="select-preview__name">{previewChar.name}</div>
            </>
          ) : (
            <div className="select-preview__idle">
              <span>HOVER A FIGHTER</span>
            </div>
          )}
        </div>

        <div
          className="select-grid"
          style={gridCols
            ? { gridTemplateColumns: `repeat(${gridCols}, ${panelSize}px)` }
            : { gridTemplateColumns: `repeat(auto-fill, ${panelSize}px)` }}
        >
          {characters.map((ch) => {
            const urls = urlsFor(ch)
            const p1 = teamCount(0, ch.id)
            const p2 = teamCount(1, ch.id)
            return (
              <button
                key={ch.id}
                className={`select-panel ${p1 ? 'is-p1' : ''} ${p2 ? 'is-p2' : ''}`}
                style={{ width: panelSize, height: panelSize }}
                draggable
                onDragStart={() => { dragId.current = ch.id }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); onDropPanel(ch.id) }}
                onMouseEnter={() => setHoverId(ch.id)}
                onMouseLeave={() => setHoverId((h) => (h === ch.id ? null : h))}
                onFocus={() => setHoverId(ch.id)}
                onClick={() => assign(ch.id)}
                title={ch.name}
              >
                {urls.thumb
                  ? <img src={urls.thumb} alt={ch.name} draggable={false} />
                  : <span className="placeholder-letter">{ch.name[0]?.toUpperCase()}</span>}
                {(p1 > 0 || p2 > 0) && (
                  <span className="select-panel__badges">
                    {p1 > 0 && <em className="badge badge--p1">P1{p1 > 1 ? `×${p1}` : ''}</em>}
                    {p2 > 0 && <em className="badge badge--p2">P2{p2 > 1 ? `×${p2}` : ''}</em>}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="select-teams">
        {[0, 1].map((side) => (
          <div key={side} className={`team-row team-row--${side === 0 ? 'p1' : 'p2'}`}>
            <span className="team-row__label">{side === 0 ? 'P1' : 'P2'}</span>
            <div className="team-row__slots">
              {teams[side].map((charId, slot) => {
                const ch = charId ? charById.get(charId) : null
                const urls = ch ? urlsFor(ch) : {}
                const active = cursor && cursor.side === side && cursor.slot === slot
                return (
                  <div
                    key={slot}
                    className={`team-slot ${active ? 'is-active' : ''} ${ch ? 'is-filled' : ''}`}
                    onClick={() => setCursor({ side, slot })}
                    title={ch ? ch.name : `${side === 0 ? 'P1' : 'P2'} slot ${slot + 1}`}
                  >
                    {ch ? (
                      <>
                        {urls.thumb
                          ? <img src={urls.thumb} alt={ch.name} draggable={false} />
                          : <span className="placeholder-letter">{ch.name[0]?.toUpperCase()}</span>}
                        <button
                          className="team-slot__clear"
                          onClick={(e) => { e.stopPropagation(); clearSlot(side, slot) }}
                          title="Clear slot"
                        >×</button>
                      </>
                    ) : (
                      <span className="team-slot__num">{slot + 1}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <button
          className={`fight-btn ${full ? 'is-ready' : ''}`}
          disabled={!full}
          onClick={() => onFight(teams)}
        >
          FIGHT!
        </button>
      </div>
    </div>
  )
}
