import { api, API_BASE, signalUnauthorized, tokenStore } from './client'

/** An event exactly as the app shows it, plus its comment count. */
export interface AdminEvent {
  id: number
  title: string
  description: string
  latitude: number
  longitude: number
  likes: number
  dislikes: number
  closes_at: string | null // ISO datetime in UTC
  comments: number
}

/** What an admin can set: the same fields residents see in the app. */
export interface EventInput {
  title: string
  description: string
  latitude: number
  longitude: number
  closes_at: string // ISO datetime with timezone
}

export interface EventComment {
  id: number
  event_id: number
  body: string
  user_email: string | null // null for anonymous (guest) comments
  likes: number
  dislikes: number
}

export type LiveStatus = 'connecting' | 'live' | 'reconnecting'

export async function fetchEvents(signal?: AbortSignal): Promise<AdminEvent[]> {
  const { data } = await api.get<AdminEvent[]>('/admin/events', { signal })
  return data
}

export async function createEvent(event: EventInput): Promise<AdminEvent> {
  const { data } = await api.post<AdminEvent>('/admin/events', event)
  return data
}

export async function updateEvent(id: number, event: EventInput): Promise<AdminEvent> {
  const { data } = await api.put<AdminEvent>(`/admin/events/${id}`, event)
  return data
}

export async function deleteEvent(id: number): Promise<void> {
  await api.delete(`/admin/events/${id}`)
}

/** The same public comment list the app shows. */
export async function fetchComments(eventId: number, signal?: AbortSignal): Promise<EventComment[]> {
  const { data } = await api.get<EventComment[]>(`/events/${eventId}/comments`, { signal })
  return data
}

/** Moderators can remove any resident's comment. */
export async function deleteComment(commentId: number): Promise<void> {
  await api.delete(`/admin/comments/${commentId}`)
}

/**
 * Follows the server's change stream (server-sent events). `onChange` gets the data
 * version on connect and whenever it changes. Uses fetch rather than EventSource,
 * which can't send the bearer token. Reconnects with backoff until unsubscribed.
 */
export function subscribeToChanges(onChange: (version: string) => void, onStatus: (status: LiveStatus) => void) {
  let stopped = false
  let failures = 0
  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  async function connect() {
    controller = new AbortController()
    try {
      const res = await fetch(`${API_BASE}/admin/stream`, {
        headers: { Accept: 'text/event-stream', Authorization: `Bearer ${tokenStore.get() ?? ''}` },
        signal: controller.signal,
        cache: 'no-store',
      })
      if (res.status === 401) {
        signalUnauthorized()
        return
      }
      if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`)
      failures = 0
      onStatus('live')

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value.replace(/\r\n/g, '\n')
        let end
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, end)
          buffer = buffer.slice(end + 2)
          const data = block.match(/^data: (.*)$/m)?.[1]
          if (/^event: change$/m.test(block) && data) onChange((JSON.parse(data) as { version: string }).version)
        }
      }
      // The server closes streams after a few minutes; reconnect straight away
    } catch {
      if (stopped) return
      failures += 1
      onStatus('reconnecting')
    }
    if (!stopped) timer = setTimeout(connect, failures ? Math.min(30_000, 1000 * 2 ** (failures - 1)) : 0)
  }

  onStatus('connecting')
  void connect()
  return () => {
    stopped = true
    controller?.abort()
    clearTimeout(timer)
  }
}
