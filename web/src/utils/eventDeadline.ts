/** The app's wording for an event's deadline (mobile/src/utils/eventDeadline.ts), so both read the same. */
export function eventDeadlineLabel(closesAt: string | null, now = Date.now()): string {
  if (!closesAt) return 'Closing time not set'
  const date = new Date(closesAt)
  if (!Number.isFinite(date.getTime())) return 'Closing time not set'
  const label = date.getTime() <= now ? 'Closed / action due' : 'Closes / action due'
  const time = date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
  return `${label}: ${time}`
}

/** True while residents can still respond. */
export const isOpen = (closesAt: string | null, now = Date.now()) => !closesAt || new Date(closesAt).getTime() > now
