// Team color palette + helpers.

export const TEAM_COLOR_PRESETS = [
  ['#e5344a', 'Red'],
  ['#2f7ef7', 'Blue'],
  ['#22c55e', 'Green'],
  ['#eab308', 'Yellow'],
  ['#a855f7', 'Purple'],
  ['#f97316', 'Orange'],
  ['#14b8a6', 'Teal'],
  ['#ec4899', 'Pink'],
]

export const DEFAULT_TEAM_COLORS = ['#2f7ef7', '#e5344a']

/** Mix a hex color toward white, e.g. for hover/label variants. */
export function lighten(hex, amount = 0.45) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const mix = (c) => Math.round(c + (255 - c) * amount)
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
