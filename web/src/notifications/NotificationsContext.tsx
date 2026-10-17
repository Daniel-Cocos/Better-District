import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { fetchNotifications, markNotificationRead, type ReplyNotification } from '../api/notifications'
import { errorMessage } from '../api/client'

interface NotificationsState {
  items: ReplyNotification[]
  loading: boolean
  error: string | null
  refresh: () => void
  markRead: (id: number) => Promise<void>
}
const Context = createContext<NotificationsState | null>(null)

/** Mounted inside the authenticated shell, so account changes discard all notification state. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ReplyNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const reads = useRef(new Set<number>())
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  const markRead = useCallback(async (id: number) => {
    await markNotificationRead(id)
    reads.current.add(id)
    setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let polling = false
    async function poll() {
      if (polling || controller.signal.aborted || document.hidden) return
      polling = true
      setLoading(true)
      try {
        const data = await fetchNotifications(controller.signal)
        if (!controller.signal.aborted) {
          setItems(data.map((item) => reads.current.has(item.id) ? { ...item, is_read: true } : item))
          setError(null)
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(errorMessage(err, 'Couldn’t load notifications.'))
      } finally {
        polling = false
        if (!controller.signal.aborted) {
          setLoading(false)
          timer = setTimeout(poll, 10000)
        }
      }
    }
    function onVisible() { clearTimeout(timer); void poll() }
    void poll()
    document.addEventListener('visibilitychange', onVisible)
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [revision])

  return <Context.Provider value={{ items, loading, error, refresh, markRead }}>{children}</Context.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useNotifications() {
  const context = useContext(Context)
  if (!context) throw new Error('useNotifications requires NotificationsProvider')
  return context
}
