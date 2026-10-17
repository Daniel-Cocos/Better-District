import { api } from './client'
import type { SiteLocation, Stage } from './overview'

export type QuestionType = 'single_choice' | 'multiple_choice' | 'short_text' | 'rating'
export type Demographic = 'age_range' | 'postcode_area' | 'gender' | 'ethnicity' | 'disability' | 'connection'

export interface Question {
  type: QuestionType
  prompt: string
  options: string[]
  required: boolean
}

export interface CustomField {
  label: string
  value: string
}

export interface EngagementSettings {
  default_questions: boolean
  custom_comments: boolean
  comment_replies: boolean
  demographics: Demographic[]
}

/** Everything the 5-step wizard collects; mirrors ProjectForm in the backend. */
export interface ProjectForm {
  // 1. Basics
  title: string
  stage: Stage
  feedback_opens: string | null // YYYY-MM-DD
  feedback_closes: string | null
  team: string
  contact: string
  // 2. Location
  location: SiteLocation | null
  ward: string | null
  // 3. Documents
  document_ids: string[]
  summary: string
  commitments: string
  custom_fields: CustomField[]
  // 4. Permanent and changeable
  permanent: string[]
  changeable: string[]
  // 5. Questions and comments
  questions: Question[]
  engagement: EngagementSettings
}

export interface ProjectDocument {
  id: string
  name: string
  size: number
  content_type: string
}

export interface Draft {
  id: number
  form: ProjectForm
  documents: ProjectDocument[]
  updated_at: string
}

export interface Project extends ProjectForm {
  event_id: number
  documents: ProjectDocument[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export const emptyProject = (): ProjectForm => ({
  title: '',
  stage: 'proposal',
  feedback_opens: null,
  feedback_closes: null,
  team: '',
  contact: '',
  location: null,
  ward: null,
  document_ids: [],
  summary: '',
  commitments: '',
  custom_fields: [],
  permanent: [],
  changeable: [],
  questions: [],
  engagement: {
    default_questions: true,
    custom_comments: true,
    comment_replies: true,
    demographics: [],
  },
})

export async function fetchDraft(id: number) {
  const { data } = await api.get<Draft>(`/admin/drafts/${id}`)
  return data
}

export async function saveDraft(form: ProjectForm, id?: number) {
  const { data } = id ? await api.put<Draft>(`/admin/drafts/${id}`, form) : await api.post<Draft>('/admin/drafts', form)
  return data
}

export async function publishProject(form: ProjectForm, draftId?: number) {
  const { data } = await api.post<Project>('/admin/projects', { ...form, draft_id: draftId ?? null })
  return data
}

export async function uploadDocument(file: File, onProgress?: (fraction: number) => void) {
  const body = new FormData()
  body.append('file', file)
  const { data } = await api.post<ProjectDocument>('/admin/uploads', body, {
    timeout: 120_000,
    onUploadProgress: (e) => e.total && onProgress?.(e.loaded / e.total),
  })
  return data
}

/** Fetches a document with the admin token and opens it in a new tab. */
export async function openDocument(doc: ProjectDocument) {
  const { data } = await api.get<Blob>(`/admin/uploads/${doc.id}`, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
