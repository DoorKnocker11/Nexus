import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { TEAM_COLOR_PRESETS, DEFAULT_TEAM_COLORS } from '../lib/colors.js'

const TEAM_SIZES = [1, 2, 3, 4, 5, 6, 7, 8]

export default function SelectScreen({ onFight }) {
  const { characters, settings, updateSettings, reorderCharacters, urlsFor } = useStore()
  const teamSize = settings.teamSize || 1
  const panelSize = settings.panelSize || 84
  const gridCols = settings.gridCols || 0
  const teamColors = settings.teamColors || DEFAULT_TEAM_COLORS
  const pickOrder = settings.pickOrder || 'alternate'

  const [teams, setTeams] = useState([Array(teamSize).fill(null), Array(teamSize).fill(null)])
  const [cursor, setCursor] = useState({ side: 0, slot: 0 })
  const [lastPick, setLastPick] = useState([null, null]) // charId each side's preview locks to
  const [hoverId, setHoverId] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const dragId = useRef(null)      // roster grid reorder
  const dragSlot = useRef(null)    // lineup reorder {side, slot}

  useEffect(() => {
    setTeams([Array(teamSize).fill(null), Array(teamSize).fill(null)])
    setCursor({ side: 0, slot: 0 })
    setLastPick([null, null])
  }, [teamSize])

  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])

  const nextEmpty = (t, after) => {
    const order = []
    if (pickOrder === 'sequential') {
      // fill P1's team completely, then P2's
      for (let s = 0; s < 2; s++) for (let i = 0; i < teamSize; i++) order.push({ side: s, slot: i })
    } else {
      // alternating draft: P1 slot 1, P2 slot 1, P1 slot 2, …
      for (let i = 0; i < teamSize; i++) for (let s = 0; s < 2; s++) order.push({ side: s, slot: i })
    }
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
    setLastPick((prev) => {
      const next = [...prev]
      next[at.side] = charId
      return next
    })
  }

  const clearSlot = (side, slot) => {
    setTeams((prev) => {
      const next = prev.map((arr) => [...arr])
      const removed = next[side][slot]
      next[side][slot] = null
      setLastPick((lp) => {
        if (lp[side] !== removed) return lp
        const fallback = next[side].find((v) => v !== null) || null
        const out = [...lp]
        out[side] = fallback
        return out
      })
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
      setLastPick([next[0].filter(Boolean).at(-1) || null, next[1].filter(Boolean).at(-1) || null])
      return next
    })
  }

  const clearAll = () => {
    setTeams([Array(teamSize).fill(null), Array(teamSize).fill(null)])
    setCursor({ side: 0, slot: 0 })
    setLastPick([null, null])
  }

  // lineup drag-to-reorder within a team
  const dropOnSlot = (side, slot) => {
    const from = dragSlot.current
    dragSlot.current = null
    if (!from || from.side !== side || from.slot === slot) return
    setTeams((prev) => {
      const next = prev.map((arr) => [...arr])
      const list = next[side]
      const [moved] = list.splice(from.slot, 1)
      list.splice(slot, 0, moved)
      return next
    })
  }

  const full = teams.every((side) => side.every((v) => v !== null))
  const hoverChar = hoverId ? charById.get(hoverId) : null

  const previewCharFor = (side) => {
    if (cursor && cursor.side === side && hoverChar) return hoverChar
    const locked = lastPick[side] ? charById.get(lastPick[side]) : null
    if (locked) return locked
    if (cursor && cursor.side === side && teams[side][cursor.slot]) return charById.get(teams[side][cursor.slot])
    return null
  }

  // roster grid drag-to-reorder
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

  const setColor = (side, color) => {
    const next = [...teamColors]
    next[side] = color
    updateSettings({ teamColors: next })
  }

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
          <button className="btn btn--icon" onClick={() => setShowSettings((s) => !s)} title="Grid & team settings">⚙</button>
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
          <label>
            Pick order
            <select value={pickOrder} onChange={(e) => updateSettings({ pickOrder: e.target.value })}>
              <option value="alternate">Alternating draft (P1, P2, P1…)</option>
              <option value="sequential">P1 team first, then P2</option>
            </select>
          </label>
          {[0, 1].map((side) => (
            <div key={side} className="color-row">
              <span className="color-row__label" style={{ color: teamColors[side] }}>P{side + 1} COLOR</span>
              {TEAM_COLOR_PRESETS.map(([c, name]) => (
                <button
                  key={c}
                  className={`swatch ${teamColors[side] === c ? 'is-on' : ''}`}
                  style={{ background: c }}
                  title={name}
                  onClick={() => setColor(side, c)}
                />
              ))}
              <input
                type="color"
                className="swatch swatch--custom"
                value={teamColors[side]}
                title="Custom color"
                onChange={(e) => setColor(side, e.target.value)}
              />
            </div>
          ))}
          <span className="grid-settings__hint">
            Drag grid panels to reorder the roster{teamSize > 1 ? ' · drag lineup slots to set bout order' : ''}.
          </span>
        </div>
      )}

      <div className="select-main">
        <SidePreview side={0} char={previewCharFor(0)} color={teamColors[0]} active={cursor?.side === 0} urlsFor={urlsFor} />

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

        <SidePreview side={1} char={previewCharFor(1)} color={teamColors[1]} active={cursor?.side === 1} urlsFor={urlsFor} />
      </div>

      <div className="select-teams">
        {[0, 1].map((side) => (
          <div key={side} className={`team-row team-row--${side === 0 ? 'p1' : 'p2'}`}>
            <span className="team-row__label">P{side + 1}</span>
            <div className="team-row__slots">
              {teams[side].map((charId, slot) => {
                const ch = charId ? charById.get(charId) : null
                const urls = ch ? urlsFor(ch) : {}
                const active = cursor && cursor.side === side && cursor.slot === slot
                return (
                  <div
                    key={slot}
                    className={`team-slot ${active ? 'is-active' : ''} ${ch ? 'is-filled' : ''}`}
                    draggable={!!ch && teamSize > 1}
                    onDragStart={() => { dragSlot.current = { side, slot } }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); dropOnSlot(side, slot) }}
                    onClick={() => setCursor({ side, slot })}
                    title={ch
                      ? `${ch.name}${teamSize > 1 ? ` — bout order #${slot + 1} (drag to reorder)` : ''}`
                      : `P${side + 1} slot ${slot + 1}`}
                  >
                    {teamSize > 1 && <span className="team-slot__order">{slot + 1}</span>}
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
      {teamSize > 1 && (
        <p className="select-elim-note">
          Team battles run as winner-stays elimination: slot 1 fights first, the winner stays on. Drag slots to set your lineup order.
        </p>
      )}
    </div>
  )
}

function SidePreview({ side, char, color, active, urlsFor }) {
  const urls = char ? urlsFor(char) : {}
  return (
    <div
      className={`select-preview select-preview--s${side + 1} ${active ? 'is-picking' : ''}`}
      style={{ '--side-color': color }}
    >
      <div className="select-preview__tag">P{side + 1}</div>
      {char ? (
        <>
          {urls.portrait
            ? <img key={char.id} className="select-preview__img" src={urls.portrait} alt={char.name} draggable={false} />
            : <div className="select-preview__placeholder">{char.name[0]?.toUpperCase()}</div>}
          <div className="select-preview__name">{char.name}</div>
        </>
      ) : (
        <div className="select-preview__idle">
          <span>{active ? 'PICKING…' : 'WAITING'}</span>
        </div>
      )}
    </div>
  )
}
