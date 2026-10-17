import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { errorMessage } from '../api/client'
import { subscribeToChanges } from '../api/events'
import { approveComment, fetchFlaggedComments, type FlaggedComment } from '../api/moderation'

interface FlaggedCommentsState {
  /** null until the first load */
  items: FlaggedComment[] | null
  error: string | null
  refresh: () => void
  /** Keep a reported comment; it goes straight back into the app. */
  approve: (commentId: number) => Promise<void>
}
const Context = createContext<FlaggedCommentsState | null>(null)

/**
 * The review queue of reported comments. Flagging, keeping and deleting all change
 * the comments table, so the server's change stream tells us when to refetch.
 */
export function FlaggedCommentsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FlaggedComment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadRef = useRef<() => void>(() => {})

  useEffect(() => {
    let alive = true
    let inFlight = false
    let pending = false
    let version: string | null = null

    async function load() {
      if (inFlight) {
        pending = true
        return
      }
      inFlight = true
      try {
        const data = await fetchFlaggedComments()
        if (!alive) return
        setItems(data)
        setError(null)
      } catch (err) {
        if (alive) setError(errorMessage(err, 'Couldn’t load flagged comments.'))
      } finally {
        inFlight = false
        if (pending && alive) {
          pending = false
          void load()
        }
      }
    }

    loadRef.current = () => void load()
    void load()
    const unsubscribe = subscribeToChanges(
      (next) => {
        const first = version === null
        if (next === version) return
        version = next
        if (!first) void load()
      },
      () => {},
    )
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  const refresh = useCallback(() => loadRef.current(), [])
  const approve = useCallback(async (commentId: number) => {
    await approveComment(commentId)
    setItems((current) => current?.filter((item) => item.id !== commentId) ?? null)
  }, [])

  return <Context.Provider value={{ items, error, refresh, approve }}>{children}</Context.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useFlaggedComments() {
  const context = useContext(Context)
  if (!context) throw new Error('useFlaggedComments requires FlaggedCommentsProvider')
  return context
}
