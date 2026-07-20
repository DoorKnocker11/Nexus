import React, { useState } from 'react'
import { useStore } from './store.jsx'
import SelectScreen from './components/SelectScreen.jsx'
import VersusScreen from './components/VersusScreen.jsx'
import RosterManager from './components/RosterManager.jsx'
import TournamentList from './components/TournamentList.jsx'
import MatchHistory from './components/MatchHistory.jsx'

const TABS = [
  ['select', 'CHARACTER SELECT'],
  ['tournament', 'TOURNAMENT'],
  ['roster', 'ROSTER'],
  ['history', 'HISTORY'],
]

export default function App() {
  const { loaded } = useStore()
  const [tab, setTab] = useState('select')
  const [versus, setVersus] = useState(null) // { teams: [[charId], [charId]], key }

  if (!loaded) {
    return <div className="app-loading"><span>LOADING…</span></div>
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">NEXUS<span>ARENA</span></div>
        <nav className="app-tabs">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              className={`app-tab ${tab === id ? 'is-active' : ''}`}
              onClick={() => setTab(id)}
            >{label}</button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {tab === 'select' && <SelectScreen onFight={(teams) => setVersus({ teams, key: Date.now() })} />}
        {tab === 'tournament' && <TournamentList />}
        {tab === 'roster' && <RosterManager />}
        {tab === 'history' && <MatchHistory />}
      </main>

      {versus && (
        <VersusScreen
          key={versus.key}
          teams={versus.teams}
          onClose={() => setVersus(null)}
          onRematch={() => setVersus({ teams: versus.teams, key: Date.now() })}
        />
      )}
    </div>
  )
}
