import { api, API_BASE } from './client'
export interface CommunityIssue {
  id: number; title: string; description: string; latitude: number; longitude: number;
  status: 'submitted' | 'reviewed' | 'planned' | 'resolved'; created_at: string;
}
export const issuePhotoUrl = (id: number) => `${API_BASE}/issues/${id}/photo`
export async function fetchIssues(signal?: AbortSignal) {
  const { data } = await api.get<CommunityIssue[]>('/admin/issues', { signal })
  return data
}
