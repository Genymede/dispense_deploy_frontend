'use client';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from './api';
import { createSupabaseClient } from './supabase';
import { useRouter } from 'next/navigation';

export interface AuthUser {
  id: string;        // user.id (UUID)
  email: string;     // user.email
  role_id: number;   // app_metadata.role.id
  role_name: string; // app_metadata.role.name
  departments: { id: number; name: string }[];  // app_metadata.departments
  systems: { id: number; name: string }[];      // app_metadata.systems
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true,
  login: async () => {}, logout: async () => {},
});

const PORTAL_URL = 'https://hpk-hms.site';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseClient();

    async function restoreSession() {
      try {
        // Development: ลอง localStorage token ก่อน (backend session เดิม)
        if (process.env.NODE_ENV === 'development') {
          const saved = localStorage.getItem('pharmsub_token');
          if (saved) {
            api.defaults.headers.common['Authorization'] = `Bearer ${saved}`;
            const res = await api.get<AuthUser>('/auth/me');
            setUser(res.data);
            return;
          }
        }

        // Production: decode session จาก cookie โดยตรง (middleware verify แล้ว)
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return;

        api.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`;

        const u = session.user;
        setUser({
          id:          u.id,
          email:       u.email                                            ?? '',
          role_id:     u.app_metadata?.role?.id                          ?? 0,
          role_name:   u.app_metadata?.role?.name                        ?? '',
          departments: u.app_metadata?.departments                       ?? [],
          systems:     u.app_metadata?.systems                           ?? [],
        });
      } catch {
        localStorage.removeItem('pharmsub_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();

    // ฟัง session change (refresh token, sign out จาก tab อื่น ฯลฯ)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        delete api.defaults.headers.common['Authorization'];
        window.location.href = PORTAL_URL;
        return;
      }
      if (event === 'TOKEN_REFRESHED' && session) {
        api.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirect ถ้าไม่มี user (กรณี middleware ไม่ทำงาน เช่น dev local)
  // ใช้ window.location.pathname แทน usePathname() เพื่อหลีกเลี่ยง hook call ใน SSR context
  useEffect(() => {
    if (loading) return;
    if (!user && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Development only — ใช้ username/password login กับ backend โดยตรง
  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>('/auth/login', { username, password });
    const { token: t, user: u } = res.data;
    localStorage.setItem('pharmsub_token', t);
    api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    window.location.href = PORTAL_URL;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {loading
        ? (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        )
        : children
      }
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
