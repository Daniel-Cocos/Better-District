import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { api } from './client';

export type CommunityIssue = {
  id: number; title: string; description: string; latitude: number; longitude: number;
  status: 'submitted' | 'reviewed' | 'planned' | 'resolved'; created_at: string;
};
export type IssueLocation = { latitude: number; longitude: number };
export const issuePhotoUrl = (id: number) => `${api.defaults.baseURL}/issues/${id}/photo`;
export async function listIssues(signal?: AbortSignal) {
  const { data } = await api.get<CommunityIssue[]>('/issues', { signal });
  return data;
}
export async function submitIssue(title: string, description: string, location: IssueLocation, photo: ImagePickerAsset) {
  const form = new FormData();
  form.append('title', title.trim());
  form.append('description', description.trim());
  form.append('latitude', String(location.latitude));
  form.append('longitude', String(location.longitude));
  if (Platform.OS === 'web') {
    const blob = await (await fetch(photo.uri)).blob();
    form.append('photo', blob, photo.fileName ?? 'issue.jpg');
  } else {
    form.append('photo', { uri: photo.uri, name: photo.fileName ?? 'issue.jpg', type: photo.mimeType ?? 'image/jpeg' } as unknown as Blob);
  }
  const { data } = await api.post<CommunityIssue>('/issues', form, { timeout: 60000, headers: { 'Content-Type': 'multipart/form-data' } });
  return data;
}

export async function editIssue(id: number, title: string, description: string) {
  const { data } = await api.patch<CommunityIssue>(`/issues/${id}`, { title: title.trim(), description: description.trim() });
  return data;
}
export async function deleteIssue(id: number) {
  await api.delete(`/issues/${id}`);
}
