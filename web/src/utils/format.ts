const rtf = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })
const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

/** Parses API timestamps; SQLite's "YYYY-MM-DD HH:MM:SS" has no zone but is UTC. */
export function parseTimestamp(value: string) {
  const iso = value.includes('T') ? value : value.replace(' ', 'T')
  return new Date(/(?:[zZ]|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`)
}

/** "12 minutes ago", "yesterday", "in 4 days" */
export function relativeTime(timestamp: string, now = Date.now()) {
  const diff = parseTimestamp(timestamp).getTime() - now
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms || unit === 'minute') {
      const value = Math.round(diff / ms)
      return value === 0 ? 'just now' : rtf.format(value, unit)
    }
  }
  return ''
}

/** Whole days from today until an ISO date (negative if past). */
export function daysUntil(isoDate: string, now = new Date()) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const [y, m, d] = isoDate.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86_400_000)
}

export const formatNumber = (n: number) => new Intl.NumberFormat('en-GB').format(n)

export function greeting(date = new Date()) {
  const h = date.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
