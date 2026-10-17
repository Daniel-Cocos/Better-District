import { api } from './client'
import type { CommunityIssue } from './issues'
import type { InsightJob } from './insights'

export type SeverityLevel = 1 | 2 | 3 // 3 is the most severe

export interface Severity {
  level: SeverityLevel
  reason: string
  model: string
  saw_photo: boolean // false when no vision model was available, so it judged the text alone
  generated_at: string
}

export interface Report extends CommunityIssue {
  severity: Severity | null
}

export interface Reports {
  reports: Report[]
  job: InsightJob
  pending: number // reports the model hasn't assessed yet
  folder: string // where photos can be dropped to add them as reports
  skipped: string[] // files in that folder that couldn't be read as photos
}

/** Every report; also picks up photos dropped into the folder. Never waits for the model. */
export async function fetchReports(signal?: AbortSignal): Promise<Reports> {
  const { data } = await api.get<Reports>('/admin/reports', { signal })
  return data
}

/** Starts estimating severity for unassessed reports (or all of them with `force`) in the background. */
export async function assessReports(force = false): Promise<Reports> {
  const { data } = await api.post<Reports>('/admin/reports/assess', null, { params: force ? { force: true } : undefined })
  return data
}
