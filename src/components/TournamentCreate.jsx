import React, { useMemo, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { createTournament } from '../lib/bracket.js'

const MAX_CONTESTANTS = 200
const BO_OPTIONS = [1, 3, 5, 7]

export default function TournamentCreate({ onCreated, onCancel }) {
  const { characters, urlsFor, saveTournament } = useStore()
  const [name, setName] = useState('')
  const [format, setFormat] = useState('single')
  const [selected, setSelected] = useState([]) // characterIds, selection order
  const [seeding, setSeeding] = useState('ordered') // ordered | random | manual
  const [seedOrder, setSeedOrder] = useState(null)  // characterIds when manual
  const [randomN, setRandomN] = useState(8)
  const [boDefault, setBoDefault] = useState(1)
  const [boFinals, setBoFinals] = useState(3)
  const [boGrand, setBoGrand] = useState(5)
  const [gfReset, setGfReset] = useState(true)
  const [rrDouble, setRrDouble] = useState(false)
  const [pointsWin, setPointsWin] = useState(3)
  const [pointsDraw, setPointsDraw] = useState(1)
  const [error, setError] = useState('')
  const dragIdx = useRef(null)

  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const toggle = (id) => {
    setSeedOrder(null)
    setSelected((prev) => prev.includes(id)
      ? prev.filter((x) => x !== id)
      : prev.length >= MAX_CONTESTANTS ? prev : [...prev, id])
  }

  const addAll = () => {
    setSeedOrder(null)
    setSelected(characters.slice(0, MAX_CONTESTANTS).map((c) => c.id))
  }

  const addRandomN = () => {
    setSeedOrder(null)
    const n = Math.min(randomN, characters.length, MAX_CONTESTANTS)
    const pool = [...characters.map((c) => c.id)]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]]
    }
    setSelected(pool.slice(0, n))
  }

  const clearSel = () => { setSelected([]); setSeedOrder(null) }

  // Manual seeding list (defaults to roster order of the selection)
  const rosterOrdered = useMemo(
    () => characters.filter((c) => selectedSet.has(c.id)).map((c) => c.id),
    [characters, selectedSet],
  )
  const manualList = seedOrder || rosterOrdered

  const moveSeed = (from, to) => {
    const list = [...manualList]
    list.splice(to, 0, list.splice(from, 1)[0])
    setSeedOrder(list)
  }

  const create = async () => {
    if (selected.length < 2) { setError('Pick at least 2 contestants.'); return }
    let orderedIds
    if (seeding === 'manual') orderedIds = manualList
    else if (seeding === 'random') {
      orderedIds = [...rosterOrdered]
      for (let i = orderedIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [orderedIds[i], orderedIds[j]] = [orderedIds[j], orderedIds[i]]
      }
    } else orderedIds = rosterOrdered

    const contestants = orderedIds.map((id) => ({
      characterId: id,
      name: charById.get(id)?.name || '???',
    }))
    const t = createTournament({
      name: name.trim() || `${format === 'rr' ? 'Round Robin' : format === 'double' ? 'Double Elim' : 'Single Elim'} — ${contestants.length} fighters`,
      format,
      contestants,
      settings: {
        bestOf: { default: boDefault, finals: boFinals, grandFinals: boGrand },
        gfReset,
        rr: { double: rrDouble, pointsWin, pointsDraw },
      },
    })
    await saveTournament(t)
    onCreated(t.id)
  }

  return (
    <div className="tour-create">
      <div className="tour-create__head">
        <h1 className="page-title">NEW TOURNAMENT</h1>
        <button className="btn" onClick={onCancel}>← Back</button>
      </div>

      <div className="tour-create__form">
        <label className="field">
          <span className="field__label">Tournament name</span>
          <input className="field__input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NEXUS Championship" maxLength={60} />
        </label>

        <div className="field">
          <span className="field__label">Format</span>
          <div className="seg">
            {[['single', 'Single Elimination'], ['double', 'Double Elimination'], ['rr', 'Round Robin']].map(([v, label]) => (
              <button key={v} className={`seg__btn ${format === v ? 'is-on' : ''}`} onClick={() => setFormat(v)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">
            Contestants — {selected.length}/{Math.min(characters.length, MAX_CONTESTANTS)} selected
            {selected.length >= MAX_CONTESTANTS && ' (max 200)'}
          </span>
          <div className="tour-create__selactions">
            <button className="btn btn--small" onClick={addAll}>Add all</button>
            <span className="tour-create__randn">
              <button className="btn btn--small" onClick={addRandomN}>Random</button>
              <input type="number" min="2" max={MAX_CONTESTANTS} value={randomN}
                onChange={(e) => setRandomN(Math.max(2, Math.min(MAX_CONTESTANTS, Number(e.target.value) || 2)))} />
            </span>
            <button className="btn btn--small" onClick={clearSel}>Clear</button>
          </div>
          <div className="tour-create__grid">
            {characters.map((ch) => {
              const urls = urlsFor(ch)
              const on = selectedSet.has(ch.id)
              return (
                <button key={ch.id} className={`select-panel select-panel--pick ${on ? 'is-picked' : ''}`} onClick={() => toggle(ch.id)} title={ch.name}>
                  {urls.thumb
                    ? <img src={urls.thumb} alt={ch.name} draggable={false} />
                    : <span className="placeholder-letter">{ch.name[0]?.toUpperCase()}</span>}
                  {on && <span className="select-panel__check">✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="field">
          <span className="field__label">Seeding</span>
          <div className="seg">
            {[['ordered', 'Roster order'], ['random', 'Random shuffle'], ['manual', 'Manual']].map(([v, label]) => (
              <button key={v} className={`seg__btn ${seeding === v ? 'is-on' : ''}`} onClick={() => setSeeding(v)}>{label}</button>
            ))}
          </div>
          {seeding === 'manual' && (
            <ul className="seed-list">
              {manualList.map((id, i) => {
                const ch = charById.get(id)
                return (
                  <li
                    key={id}
                    className="seed-list__item"
                    draggable
                    onDragStart={() => { dragIdx.current = i }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragIdx.current !== null && dragIdx.current !== i) moveSeed(dragIdx.current, i)
                      dragIdx.current = null
                    }}
                  >
                    <span className="seed-list__seed">#{i + 1}</span>
                    <span className="seed-list__name">{ch?.name || '???'}</span>
                    <span className="seed-list__grip">⠿ drag</span>
                  </li>
                )
              })}
              {manualList.length === 0 && <li className="seed-list__empty">Select contestants first.</li>}
            </ul>
          )}
        </div>

        {format !== 'rr' && (
          <div className="field field--row">
            <label>Best of (default)
              <select value={boDefault} onChange={(e) => setBoDefault(Number(e.target.value))}>
                {BO_OPTIONS.map((n) => <option key={n} value={n}>Bo{n}</option>)}
              </select>
            </label>
            <label>{format === 'double' ? 'Winners/Losers finals' : 'Finals'}
              <select value={boFinals} onChange={(e) => setBoFinals(Number(e.target.value))}>
                {BO_OPTIONS.map((n) => <option key={n} value={n}>Bo{n}</option>)}
              </select>
            </label>
            {format === 'double' && (
              <>
                <label>Grand finals
                  <select value={boGrand} onChange={(e) => setBoGrand(Number(e.target.value))}>
                    {BO_OPTIONS.map((n) => <option key={n} value={n}>Bo{n}</option>)}
                  </select>
                </label>
                <label className="check">
                  <input type="checkbox" checked={gfReset} onChange={(e) => setGfReset(e.target.checked)} />
                  Bracket reset (losers-side winner forces a second grand final)
                </label>
              </>
            )}
          </div>
        )}

        {format === 'rr' && (
          <div className="field field--row">
            <label>Best of (per match)
              <select value={boDefault} onChange={(e) => setBoDefault(Number(e.target.value))}>
                {BO_OPTIONS.map((n) => <option key={n} value={n}>Bo{n}</option>)}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={rrDouble} onChange={(e) => setRrDouble(e.target.checked)} />
              Double round robin (everyone plays twice)
            </label>
            <label>Points per win
              <input type="number" min="0" max="10" value={pointsWin} onChange={(e) => setPointsWin(Number(e.target.value) || 0)} />
            </label>
            <label>Points per draw
              <input type="number" min="0" max="10" value={pointsDraw} onChange={(e) => setPointsDraw(Number(e.target.value) || 0)} />
            </label>
            <span className="field__hint">Tiebreakers: points → head-to-head → wins → seed. Draws only available in Bo1.</span>
          </div>
        )}

        {error && <p className="editor-error">{error}</p>}
        <div className="tour-create__actions">
          <button className="btn btn--primary btn--big" onClick={create} disabled={selected.length < 2}>
            CREATE TOURNAMENT
          </button>
        </div>
      </div>
    </div>
  )
}
