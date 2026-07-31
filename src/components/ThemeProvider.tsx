import { useEffect, createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase to two sources:
//
// 1. Platform theme (fallback for super admin / no school / pre-login) —
//    GET /api/settings/theme. Public, no auth — this provider mounts above
//    AuthProvider in App.tsx.
//
// 2. School theme — GET /auth/me directly, NOT useAuth(). ThemeProvider
//    sits ABOVE AuthProvider in App.tsx's tree (wraps BrowserRouter, which
//    is where AuthProvider lives), so it is not a descendant and calling
//    useAuth() here would read no context, not real auth state. /auth/me
//    already returns the full School row (Prisma's `school: true` include),
//    so this reads primaryColor/accentColor straight from it. 401 pre-login
//    is expected and just means "no school theme yet" — falls through to
//    the platform theme below, not an error.
//
// Note: TenantContext.applyTenantBranding() also writes --primary/--accent,
// from the (Express-backed) subdomain resolve. On a subdomain both run and
// whichever resolves last wins — unchanged from before this migration,
// still worth reconciling separately.
// ─────────────────────────────────────────────────────────────────────────

interface AuthMeResponse {
  user: {
    school?: { primaryColor?: string | null; accentColor?: string | null } | null;
  };
}

interface ThemeColors {
  primary_color: string;
  accent_color: string;
}

const ThemeContext = createContext<ThemeColors | null>(null);
export const useThemeColors = () => useContext(ThemeContext);

function hexToHSL(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function darken(hex: string, amount: number): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  const r = Math.max(0, parseInt(result[1], 16) - amount);
  const g = Math.max(0, parseInt(result[2], 16) - amount);
  const b = Math.max(0, parseInt(result[3], 16) - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function lighten(hex: string, amount: number): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  const r = Math.min(255, parseInt(result[1], 16) + amount);
  const g = Math.min(255, parseInt(result[2], 16) + amount);
  const b = Math.min(255, parseInt(result[3], 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function applyTheme(primary: string, accent: string) {
  const root = document.documentElement;
  const primaryHSL = hexToHSL(primary);
  const accentHSL = hexToHSL(accent);

  if (primaryHSL) {
    root.style.setProperty('--primary', primaryHSL);
    const hoverHex = darken(primary, 20);
    const mutedHex = lighten(primary, 200);
    if (hoverHex) root.style.setProperty('--primary-hover', hexToHSL(hoverHex)!);
    if (mutedHex) root.style.setProperty('--primary-muted', hexToHSL(mutedHex)!);
    root.style.setProperty('--ring', primaryHSL);
    const sidebarPrimaryHex = lighten(primary, 40);
    if (sidebarPrimaryHex) root.style.setProperty('--sidebar-primary', hexToHSL(sidebarPrimaryHex)!);
  }

  if (accentHSL) {
    root.style.setProperty('--accent', accentHSL);
    const hoverHex = darken(accent, 20);
    const mutedHex = lighten(accent, 200);
    if (hoverHex) root.style.setProperty('--accent-hover', hexToHSL(hoverHex)!);
    if (mutedHex) root.style.setProperty('--accent-muted', hexToHSL(mutedHex)!);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Fetch platform-level theme (fallback for super admin / no school)
  const { data: platformTheme } = useQuery({
    queryKey: ['system-settings', 'theme-colors'],
    queryFn: async () => {
      const { data } = await api.get<{ theme: ThemeColors }>('/settings/theme');
      return data.theme;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch the current user's school colors directly — can't use useAuth()
  // here, see the migration note above.
  const { data: schoolTheme } = useQuery({
    queryKey: ['school-theme-colors'],
    queryFn: async (): Promise<ThemeColors | null> => {
      const { data } = await api.get<AuthMeResponse>('/auth/me');
      const s = data.user.school;
      if (!s?.primaryColor || !s?.accentColor) return null;
      return { primary_color: s.primaryColor, accent_color: s.accentColor };
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // School colors take priority over platform colors
  const activeTheme: ThemeColors | null = schoolTheme || platformTheme || null;

  useEffect(() => {
    if (!activeTheme) return;
    applyTheme(activeTheme.primary_color, activeTheme.accent_color);
  }, [activeTheme]);

  return (
    <ThemeContext.Provider value={activeTheme}>
      {children}
    </ThemeContext.Provider>
  );
}
