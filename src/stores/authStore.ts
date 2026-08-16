import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

/**
 * Auth state for the Express/JWT backend.
 *
 * Tokens live in IndexedDB (via idb-keyval) rather than localStorage.
 * Because IndexedDB is async, the store rehydrates asynchronously — read
 * `hydrated` before deciding a user is logged out, otherwise a refresh will
 * briefly look unauthenticated. `src/lib/api.ts` reads tokens straight off
 * this store's in-memory state, which is synchronous once hydrated.
 *
 * NOTE: this store does not replace AuthContext, which is still Supabase-
 * backed. Both exist during the migration; AuthContext is a separate task.
 */

export interface AuthUser {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';
  schoolId: string | null;
  school?: {
    name: string;
    subdomain: string;
    logo: string | null;
    primaryColor: string;
  } | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  /** False until IndexedDB rehydration finishes. */
  hydrated: boolean;

  /** Called after a successful POST /auth/login. */
  setAuth: (payload: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  /** Called after a successful POST /auth/refresh -- refresh() now rotates
   *  the refresh token on every call (real rotation, not a reusable
   *  30-day token), so both must be replaced together, not just the
   *  access token. */
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

// idb-keyval adapter matching zustand's StateStorage interface.
const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet(name)) ?? null,
  setItem: async (name, value) => { await idbSet(name, value); },
  removeItem: async (name) => { await idbDel(name); },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hydrated: false,

      setAuth: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'ost-auth',
      storage: createJSONStorage(() => idbStorage),
      // `hydrated` is runtime-only — never persist it, or a stale `true`
      // would be restored before rehydration actually completes.
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        useAuthStore.setState({ hydrated: true });
        void state;
      },
    },
  ),
);

/** Non-reactive accessors for use outside React (e.g. axios interceptors). */
export const getAccessToken = () => useAuthStore.getState().accessToken;
export const getRefreshToken = () => useAuthStore.getState().refreshToken;
