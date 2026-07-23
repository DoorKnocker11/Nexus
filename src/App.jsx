import React, { useState } from 'react'
import { useStore } from './store.jsx'
import SelectScreen from './components/SelectScreen.jsx'
import VersusScreen from './components/VersusScreen.jsx'
import TeamBattleScreen from './components/TeamBattleScreen.jsx'
import RosterManager from './components/RosterManager.jsx'
import TournamentList from './components/TournamentList.jsx'
import MatchHistory from './components/MatchHistory.jsx'
import CharacterDatabase from './components/CharacterDatabase.jsx'
import { DEFAULT_TEAM_COLORS, lighten } from './lib/colors.js'

const TABS = [
  ['select', 'CHARACTER SELECT'],
  ['tournament', 'TOURNAMENT'],
  ['database', 'DATABASE'],
  ['roster', 'ROSTER'],
  ['history', 'HISTORY'],
]

export default function App() {
  const { loaded, settings } = useStore()
  const [tab, setTab] = useState('select')
  const [versus, setVersus] = useState(null) // { teams: [[charId], [charId]], key }

  if (!loaded) {
    return <div className="app-loading"><span>LOADING…</span></div>
  }

  const colors = settings.teamColors || DEFAULT_TEAM_COLORS
  const themeVars = {
    '--p1': colors[0],
    '--p1-2': lighten(colors[0]),
    '--p2': colors[1],
    '--p2-2': lighten(colors[1]),
  }

  const isTeamBattle = versus && versus.teams[0].length > 1

  return (
    <div className="app" style={themeVars}>
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
        {tab === 'database' && <CharacterDatabase />}
        {tab === 'roster' && <RosterManager />}
        {tab === 'history' && <MatchHistory />}
      </main>

      {versus && !isTeamBattle && (
        <VersusScreen
          key={versus.key}
          teams={versus.teams}
          onClose={() => setVersus(null)}
          onRematch={() => setVersus({ teams: versus.teams, key: Date.now() })}
        />
      )}
      {versus && isTeamBattle && (
        <TeamBattleScreen
          key={versus.key}
          teams={versus.teams}
          onClose={() => setVersus(null)}
        />
      )}
    </div>
  )
}
