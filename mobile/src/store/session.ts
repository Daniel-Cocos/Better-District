import { create } from 'zustand';

export type Credentials = { username: string; password: string };
export type Session =
  | { status: 'signedOut' }
  | { status: 'guest' }
  | { status: 'authenticated'; email: string; credentials: Credentials };

type SessionStore = {
  session: Session;
  signIn: (email: string, credentials: Credentials) => void;
  continueAsGuest: () => void;
  signOut: () => void;
};

// Basic credentials stay in memory and are cleared when leaving the session.
export const useSessionStore = create<SessionStore>((set) => ({
  session: { status: 'signedOut' },
  signIn: (email, credentials) => set({ session: { status: 'authenticated', email, credentials } }),
  continueAsGuest: () => set({ session: { status: 'guest' } }),
  signOut: () => set({ session: { status: 'signedOut' } }),
}));
