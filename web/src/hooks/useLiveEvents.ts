import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api/client'
import { fetchEvents, subscribeToChanges, type AdminEvent, type LiveStatus } from '../api/events'

/**
 * Every event the app shows, kept current by the server's change stream, so
 * residents' votes and comments (and other admins' edits) appear as they happen.
 * `newIds` marks events that appeared after the page opened.
 */
export function useLiveEvents() {
  const [events, setEvents] = useState<AdminEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<LiveStatus>('connecting')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [newIds, setNewIds] = useState<ReadonlySet<number>>(new Set())
  const reloadRef = useRef<() => void>(() => {})

  useEffect(() => {
    let alive = true
    let known: Set<number> | null = null
    let version: string | null = null
    // Changes can land faster than a fetch; run one at a time and catch up afterwards
    let inFlight = false
    let pending = false

    async function load() {
      if (inFlight) {
        pending = true
        return
      }
      inFlight = true
      try {
        const data = await fetchEvents()
        if (!alive) return
        const previous = known
        const added = previous ? data.filter((e) => !previous.has(e.id)) : []
        if (added.length) setNewIds((ids) => new Set([...ids, ...added.map((e) => e.id)]))
        known = new Set(data.map((e) => e.id))
        setEvents(data)
        setError(null)
        setUpdatedAt(new Date())
      } catch (err) {
        if (alive) setError(errorMessage(err, 'Couldn’t load events.'))
      } finally {
        inFlight = false
        if (pending && alive) {
          pending = false
          void load()
        }
      }
    }

    reloadRef.current = () => void load()
    void load()
    const unsubscribe = subscribeToChanges((next) => {
      // Every (re)connect announces the current version; only refetch when it moved
      const first = version === null
      if (next === version) return
      version = next
      if (!first) void load()
    }, setStatus)

    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  const reload = useCallback(() => reloadRef.current(), [])

  return { events, error, status, updatedAt, newIds, reload }
}
