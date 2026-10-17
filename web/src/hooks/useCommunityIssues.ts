import { useCallback, useEffect, useState } from 'react'
import { fetchIssues, type CommunityIssue } from '../api/issues'
import { errorMessage } from '../api/client'

export function useCommunityIssues() {
  const [issues, setIssues] = useState<CommunityIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let polling = false
    async function poll() {
      if (controller.signal.aborted || polling || document.hidden) return
      polling = true
      try {
        const data = await fetchIssues(controller.signal)
        if (!controller.signal.aborted) { setIssues(data); setError(null) }
      } catch (err) { if (!controller.signal.aborted) setError(errorMessage(err, 'Couldn’t load community issues.')) }
      finally {
        polling = false
        if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(poll, 10000) }
      }
    }
    function onVisible() { clearTimeout(timer); void poll() }
    void poll()
    document.addEventListener('visibilitychange', onVisible)
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [revision])
  return { issues, loading, error, refresh }
}
