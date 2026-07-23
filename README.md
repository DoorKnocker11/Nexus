# NEXUS ARENA — Character Select & Tournament Bracket

A fighting-game-style character select screen and tournament bracket manager that runs entirely in your browser. Build a roster with your own artwork, run exhibition matches from 1v1 up to 8v8, and manage full tournaments — single elimination, double elimination (with losers bracket and grand finals bracket reset) and round robin — for up to 200 contestants.

**Everything is stored locally in your browser via IndexedDB** (images as blobs), so your roster, match history and tournaments survive page refreshes. No backend, no login, no uploads.

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`).

Production build:

```bash
npm run build     # outputs static site to dist/
npm run preview   # serve the production build locally
```

## Deploying to Cloudflare Pages

This is a fully static single-page app with no server-side code.

- **Build command:** `npm run build`
- **Output directory:** `dist`

The app uses in-app view state (no client-side routing), so no `_redirects` file is needed — there are no deep links to rewrite. User-uploaded images live in each visitor's own browser (IndexedDB) and are never part of the build.

## Features

### Roster & Character Select
- Create / edit / delete characters, each with a name, a square thumbnail (auto-cropped) and a full-body portrait (aspect ratio preserved). Upload via file picker or drag-and-drop; upload one image and the other is derived automatically.
- Fighting-game select screen with **dual previews**: Player 1's portrait preview on the left, Player 2's on the right, roster grid between them. The side that's currently picking follows your hover; the other side stays locked to its pick. Adjustable panel size and column count (⚙), drag panels to reorder the roster, scales to 100+ characters.
- **Team colors**: pick each side's color from an 8-color preset palette or a custom color picker (in the ⚙ menu). The color themes that side's preview, slot frames, lineup tracker, VS screen and victory highlights, and persists.
- Team formats from 1v1 to 8v8, with per-slot picking, "random this slot" and "random all". Picks fill in alternating draft order (P1, P2, P1, …) by default; a ⚙ setting switches back to filling P1's whole team first.
- 1v1: VS screen with facing portraits — click a side to declare the winner, with a victory animation.
- **2v2–8v8 run as winner-stays elimination battles** (crew battle style): drag your team slots to set the lineup order, then the battle plays out as sequential 1v1 bouts — the winner stays on, the loser is eliminated, until one team is wiped out. Side trackers show both lineups with eliminated fighters crossed out and the current streak holder highlighted ("3 KOs"), with an undo-bout button and a bout-by-bout results summary at the end.
- All completed fights are recorded to the HISTORY tab (elimination battles include the full bout log).

### Character Database
- The DATABASE tab shows lifetime stats for every fighter, aggregated across all modes: times played, wins, losses, win rate, and share of all appearances. Sortable columns, search filter, and a total-completed-matches counter across the whole app.
- Click a fighter for their portrait plus a per-mode breakdown (versus / team battle / tournament).
- Stats update automatically whenever a winner is declared anywhere (only completed matches count; abandoned battles don't). In old-style team results every team member gets credit; in elimination battles wins/losses are tracked per individual bout. Tournament byes never count.
- Stats persist in IndexedDB, survive history clearing and tournament deletion, and are backfilled once from any pre-existing match history. "Reset all stats" (with confirmation) lives on the Database page.

### Tournaments
- Up to 200 contestants drawn from your roster (multi-select, **Add all**, **Random N**).
- **Single elimination**, **double elimination** (winners/losers brackets, grand finals with optional bracket reset) and **round robin** (single or double, configurable points per win/draw, standings with points → head-to-head → wins → seed tiebreakers).
- Seeding: roster order, random shuffle, or manual drag-to-seed. Byes are handled automatically for non-power-of-2 fields.
- Best-of-N series (Bo1/Bo3/Bo5/Bo7) with separate settings for finals and grand finals, plus a per-match override inside any open match.
- Every match is decided manually: opening a match shows a full 1v1 VS screen; click a side to score a game win until the series is clinched. Mis-clicks can be undone, and a match can be fully reset as long as no later manual result depends on it.
- Zoomable, pannable bracket view (Ctrl+scroll to zoom, drag to pan) that stays readable at 200 entrants, with the current round highlighted and a champion celebration at the end.
- Save any number of tournaments; resume or delete them from the TOURNAMENT tab.

### Edge cases handled
- Odd contestant counts get automatic byes (cascading correctly through both brackets in double elim).
- Deleting a character who is in an active tournament warns you first (the tournament keeps the name, loses the images).
- Duplicate character names are allowed, with a warning.

## Code layout

```
src/
  lib/
    db.js         IndexedDB wrapper (characters, history, tournaments, settings, stats)
    images.js     Thumbnail auto-crop + portrait downscaling
    bracket.js    Tournament engine (generation, byes, series scoring, resets, standings)
    stats.js      Lifetime stats aggregation (events, backfill, totals)
    colors.js     Team color presets + helpers
  store.jsx       App-wide state + persistence + object-URL cache for images
  components/
    RosterManager.jsx / CharacterEditor.jsx / ImageDrop.jsx
    SelectScreen.jsx
    VsStage.jsx / VersusScreen.jsx / TeamBattleScreen.jsx
    MatchHistory.jsx / CharacterDatabase.jsx
    TournamentList.jsx / TournamentCreate.jsx / TournamentView.jsx
    BracketView.jsx / RoundRobinTable.jsx / MatchModal.jsx
```
