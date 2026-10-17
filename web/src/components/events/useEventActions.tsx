import { useState } from 'react'
import Snackbar from '@mui/material/Snackbar'
import { deleteComment, deleteEvent, type AdminEvent } from '../../api/events'
import type { RecentComment } from '../../api/overview'
import EventFormDialog from './EventFormDialog'
import ConfirmDialog from './ConfirmDialog'
import type { LatLng } from './LocationPicker'

const SOUTHAMPTON: LatLng = [50.9097, -1.4044]

type Form = { event: AdminEvent | null; center: LatLng }
type EventToRemove = Pick<AdminEvent, 'id' | 'title' | 'comments'>
type CommentToRemove = Pick<RecentComment, 'id' | 'body' | 'user_email'>
type Removal = { kind: 'event'; event: EventToRemove } | { kind: 'comment'; comment: CommentToRemove }

interface Options {
  /** Refresh the page's data straight away (the live stream would catch up within a second anyway) */
  onChanged: () => void
  onCreated?: (event: AdminEvent) => void
  onDeleted?: (eventId: number) => void
}

/**
 * The moderation actions every page shares: add, edit and delete events, and
 * delete comments. Render `dialogs` once; call the functions from buttons.
 */
export function useEventActions({ onChanged, onCreated, onDeleted }: Options) {
  const [form, setForm] = useState<Form | null>(null)
  const [removal, setRemoval] = useState<Removal | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)

  const open = (next: Form) => {
    setFormKey((k) => k + 1) // fresh form state every time
    setForm(next)
  }

  const dialogs = (
    <>
      {form && (
        <EventFormDialog
          key={formKey}
          event={form.event}
          center={form.center}
          onClose={() => setForm(null)}
          onSaved={(saved, created) => {
            setForm(null)
            setNotice(created ? `“${saved.title}” is now in the app.` : 'Changes saved. The app shows them now.')
            onChanged()
            if (created) onCreated?.(saved)
          }}
        />
      )}
      {removal?.kind === 'event' && (
        <ConfirmDialog
          title="Delete this event?"
          confirmLabel="Delete event"
          onClose={() => setRemoval(null)}
          onConfirm={async () => {
            await deleteEvent(removal.event.id)
            setRemoval(null)
            setNotice('Event deleted. It’s gone from the app.')
            onChanged()
            onDeleted?.(removal.event.id)
          }}
        >
          “{removal.event.title}” will disappear from the app map and feed
          {removal.event.comments
            ? `, along with its ${removal.event.comments} comment${removal.event.comments === 1 ? '' : 's'} and all votes.`
            : ', along with its votes.'}{' '}
          This can’t be undone.
        </ConfirmDialog>
      )}
      {removal?.kind === 'comment' && (
        <ConfirmDialog
          title="Delete this comment?"
          confirmLabel="Delete comment"
          onClose={() => setRemoval(null)}
          onConfirm={async () => {
            await deleteComment(removal.comment.id)
            setRemoval(null)
            setNotice('Comment deleted.')
            onChanged()
          }}
        >
          {removal.comment.user_email ?? 'An anonymous resident'} wrote: “{removal.comment.body}”. It will be removed from
          the app for everyone. This can’t be undone.
        </ConfirmDialog>
      )}
      <Snackbar
        open={Boolean(notice)}
        message={notice}
        autoHideDuration={5000}
        onClose={(_, reason) => reason !== 'clickaway' && setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  )

  return {
    dialogs,
    addEvent: (center: LatLng = SOUTHAMPTON) => open({ event: null, center }),
    editEvent: (event: AdminEvent) => open({ event, center: [event.latitude, event.longitude] }),
    removeEvent: (event: EventToRemove) => setRemoval({ kind: 'event', event }),
    removeComment: (comment: CommentToRemove) => setRemoval({ kind: 'comment', comment }),
  }
}
