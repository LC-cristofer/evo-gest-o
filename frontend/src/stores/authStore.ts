import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'DIRETORIA' | 'RH' | 'SUPERVISOR' | 'TI' | 'FUNCIONARIO';

export interface AuthUser {
  id:      string;
  name:    string;
  email:   string;
  role:    UserRole;
  unit_id: string | null;
}

interface AuthState {
  user:                AuthUser | null;
  token:               string | null;
  refreshToken:        string | null;
  mustChangePassword:  boolean;
  isHydrated:          boolean;
  setAuth:      (user: AuthUser, token: string, refreshToken: string, mustChange?: boolean) => void;
  setToken:     (token: string) => void;
  logout:       () => void;
  setHydrated:  (v: boolean) => void;
  can:          (permission: string) => boolean;
  isRole:       (...roles: UserRole[]) => boolean;
}

const PERMISSIONS: Record<string, UserRole[]> = {
  'employees:create':  ['TI', 'RH'],
  'employees:delete':  ['TI'],
  'employees:update':  ['TI', 'RH'],
  'admissions:create': ['TI', 'RH'],
  'admissions:review': ['TI', 'RH'],
  'dashboard:general': ['TI', 'DIRETORIA', 'RH'],
  'units:manage':      ['TI', 'RH'],
  'benefits:manage':   ['TI', 'RH'],
  'users:manage':      ['TI'],
  'diario:submit':     ['FUNCIONARIO','TI','RH','SUPERVISOR','DIRETORIA'],
  'portal:view':       ['FUNCIONARIO'],
  'supervisor:team':   ['SUPERVISOR','TI','RH','DIRETORIA'],
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null, token: null, refreshToken: null, mustChangePassword: false, isHydrated: false,
      setAuth: (user, token, refreshToken, mustChange = false) =>
        set({ user, token, refreshToken, mustChangePassword: mustChange }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, token: null, refreshToken: null, mustChangePassword: false }),
      setHydrated: (v) => set({ isHydrated: v }),
      can: (permission) => {
        const role = get().user?.role;
        if (!role) return false;
        const allowed = PERMISSIONS[permission];
        return !allowed || allowed.includes(role);
      },
      isRole: (...roles) => {
        const role = get().user?.role;
        return !!role && roles.includes(role);
      },
    }),
    {
      name: 'ong-auth',
      partialize: s => ({ user: s.user, token: s.token, refreshToken: s.refreshToken, mustChangePassword: s.mustChangePassword }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    }
  )
);
