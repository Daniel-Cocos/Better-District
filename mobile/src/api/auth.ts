import { isAxiosError } from 'axios';
import { api } from './client';

type User = { email: string };

export async function signIn(email: string, password: string) {
  const credentials = { username: email.trim().toLowerCase(), password };
  const { data } = await api.get<User>('/users/me', { auth: credentials });
  return { email: data.email, credentials };
}

export async function register(email: string, password: string) {
  // Registration must not inherit credentials from a previous session.
  await api.post<User>('/users', { email: email.trim().toLowerCase(), password });
  return signIn(email, password);
}

export function authErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) return 'Something went wrong. Please try again.';
  if (!error.response) return 'Could not reach the server. Check your connection and try again.';
  if (error.response.status === 401) return 'Email or password is incorrect.';
  if (error.response.status === 409) return 'This email is already registered. Try signing in.';
  if (error.response.status === 422) return 'Check your email and password and try again.';
  return 'The server could not complete your request. Please try again.';
}
