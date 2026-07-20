import React from 'react'

/**
 * Shared full-screen VS stage. Used by the exhibition versus screen and by
 * tournament match previews.
 *
 * sides: [{ label, fighters: [{ name, portraitUrl }], score }, ...] (2 sides)
 * winnerSide: null | 0 | 1
 * onPickSide(sideIdx): declare winner / add a game win
 */
export default function VsStage({ sides, winnerSide, onPickSide, subtitle, banner, children }) {
  return (
    <div className="vs-stage">
      {subtitle && <div className="vs-stage__subtitle">{subtitle}</div>}
      <div className="vs-stage__arena">
        {sides.map((side, i) => {
          const state = winnerSide === null ? '' : winnerSide === i ? 'is-winner' : 'is-loser'
          return (
            <React.Fragment key={i}>
              {i === 1 && <div className={`vs-stage__vs ${winnerSide !== null ? 'is-done' : ''}`}>VS</div>}
              <div
                className={`vs-side vs-side--${i === 0 ? 'left' : 'right'} ${state} ${onPickSide ? 'is-clickable' : ''}`}
                onClick={() => onPickSide && onPickSide(i)}
                title={onPickSide ? 'Click to declare a win for this side' : undefined}
              >
                <div className="vs-side__portraits" data-count={side.fighters.length}>
                  {side.fighters.map((f, j) => (
                    <div className="vs-fighter" key={j}>
                      {f.portraitUrl
                        ? <img src={f.portraitUrl} alt={f.name} draggable={false} />
                        : <div className="vs-fighter__placeholder">{f.name?.[0]?.toUpperCase() || '?'}</div>}
                    </div>
                  ))}
                </div>
                <div className="vs-side__nameplate">
                  <span className="vs-side__label">{side.label}</span>
                  <span className="vs-side__names">{side.fighters.map((f) => f.name).join(' · ')}</span>
                  {side.score !== undefined && <span className="vs-side__score">{side.score}</span>}
                </div>
              </div>
            </React.Fragment>
          )
        })}
      </div>
      {banner && <div className="vs-stage__banner"><span>{banner}</span></div>}
      {children}
    </div>
  )
}
