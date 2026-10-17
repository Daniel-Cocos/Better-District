import { api, API_BASE } from './client'
// Keep in step with IssueCategory in the backend's app/models.py and the app's list
export type IssueCategory = 'pothole' | 'graffiti' | 'other'
export const ISSUE_CATEGORIES: { value: IssueCategory; label: string }[] = [
  { value: 'pothole', label: 'Potholes' },
  { value: 'graffiti', label: 'Graffiti' },
  { value: 'other', label: 'Other' },
]
export const categoryLabel = (category: IssueCategory) => ISSUE_CATEGORIES.find((c) => c.value === category)?.label ?? 'Other'
export interface CommunityIssue {
  id: number; title: string; description: string; latitude: number; longitude: number;
  status: 'submitted' | 'reviewed' | 'planned' | 'resolved'; category: IssueCategory; created_at: string;
}
export const issuePhotoUrl = (id: number) => `${API_BASE}/issues/${id}/photo`
export async function fetchIssues(signal?: AbortSignal) {
  const { data } = await api.get<CommunityIssue[]>('/admin/issues', { signal })
  return data
}
