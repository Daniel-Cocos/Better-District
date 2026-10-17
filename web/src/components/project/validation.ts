import type { ProjectForm } from '../../api/projects'

export type Errors = Partial<Record<string, string>>

export const steps = [
  { key: 'basics', label: 'Basics', description: 'Title, stage, feedback dates and contact.' },
  { key: 'location', label: 'Location', description: 'Pin and radius.' },
  { key: 'documents', label: 'Documents', description: 'Files, summary, commitments and custom fields.' },
  { key: 'terms', label: 'Permanent & changeable', description: 'What is fixed and what can change.' },
  { key: 'engagement', label: 'Questions & comments', description: 'Polls, questions, surveys and comment settings.' },
] as const

/** Problems that block publishing, per step. Saving a draft never blocks. */
export function stepErrors(form: ProjectForm, step: number): Errors {
  const e: Errors = {}
  if (step === 0) {
    if (!form.title.trim()) e.title = 'Give the project a title'
    if (!form.team.trim()) e.team = 'Name the team responsible'
    if (!form.contact.trim()) e.contact = 'Add an email address or phone number'
    if (form.feedback_opens && form.feedback_closes && form.feedback_closes < form.feedback_opens)
      e.feedback_closes = 'Must be on or after the opening date'
  }
  if (step === 1 && !form.location) e.location = 'Click the map to place the project'
  if (step === 2 && !form.summary.trim()) e.summary = 'Write a summary'
  if (step === 4) {
    form.questions.forEach((q, i) => {
      if (!q.prompt.trim()) e[`question.${i}`] = 'Write the question'
      else if ((q.type === 'single_choice' || q.type === 'multiple_choice') && q.options.filter((o) => o.trim()).length < 2)
        e[`question.${i}`] = 'Add at least two options'
    })
  }
  return e
}

export const allErrors = (form: ProjectForm) => steps.map((_, i) => stepErrors(form, i))
