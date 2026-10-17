import { create } from 'axios';
import { useSessionStore } from '../store/session';

// Android emulator's address for the host machine. Override for a physical phone.
export const api = create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const { session } = useSessionStore.getState();
  if (config.url !== '/users' && config.auth === undefined && session.status === 'authenticated') {
    config.auth = session.credentials;
  }
  return config;
});
