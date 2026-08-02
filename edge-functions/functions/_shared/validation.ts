/**
 * Shared validation & security utilities for edge functions.
 * Import as: import { ... } from "../_shared/validation.ts";
 */

// ── Input Sanitization ──────────────────────────────────────────
export function sanitizeString(val: unknown, maxLen = 500): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

export function sanitizeEmail(val: unknown): string {
  const s = sanitizeString(val, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return '';
  return s;
}

export function sanitizeUUID(val: unknown): string {
  const s = sanitizeString(val, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return '';
  return s;
}

export function sanitizePhone(val: unknown): string {
  const s = sanitizeString(val, 20);
  // Allow digits, +, -, spaces, parens
  return s.replace(/[^\d+\-\s()]/g, '');
}

// ── Validation Helpers ──────────────────────────────────────────
export function requireFields(obj: Record<string, unknown>, fields: string[]): void {
  const missing = fields.filter(f => !obj[f] && obj[f] !== false && obj[f] !== 0);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

export function validateRole(role: string): boolean {
  return ['super_admin', 'school_admin', 'teacher', 'parent', 'student'].includes(role);
}

// ── Auth & Role Helpers ─────────────────────────────────────────
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  callingUser: { id: string; email?: string };
  supabaseUser: SupabaseClient;
  supabaseAdmin: SupabaseClient;
  roles: string[];
}

/**
 * Authenticate the caller and fetch their roles.
 * Throws on invalid/missing auth.
 */
export async function authenticateAndGetRoles(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("No authorization header");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error } = await supabaseUser.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = (roleData || []).map((r: { role: string }) => r.role);

  return {
    callingUser: { id: user.id, email: user.email },
    supabaseUser,
    supabaseAdmin,
    roles,
  };
}

export function requireRole(roles: string[], ...allowed: string[]): void {
  if (!roles.some(r => allowed.includes(r))) {
    throw new Error(`Permission denied: requires ${allowed.join(' or ')}`);
  }
}

export async function requireSchoolAccess(
  supabaseAdmin: SupabaseClient,
  userId: string,
  roles: string[],
  schoolId: string,
): Promise<void> {
  if (roles.includes('super_admin')) return;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .single();

  if (profile?.school_id !== schoolId) {
    throw new Error("Permission denied: wrong school");
  }
}

// ── CORS ────────────────────────────────────────────────────────
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function corsResponse() {
  return new Response(null, { headers: corsHeaders });
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 400) {
  // Never expose internal details — sanitize
  const safe = message.length > 300 || message.includes('\n') || message.includes('at ')
    ? 'An internal error occurred'
    : message;
  return jsonResponse({ success: false, error: safe }, status);
}

// ── File validation ─────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
]);
const ALLOWED_MEDIA_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES, 'video/mp4', 'video/webm',
]);

export function validateFileType(contentType: string, allowVideo = false): boolean {
  const types = allowVideo ? ALLOWED_MEDIA_TYPES : ALLOWED_IMAGE_TYPES;
  return types.has(contentType.toLowerCase());
}

export function validateFileSize(size: number, maxMB = 10): boolean {
  return size > 0 && size <= maxMB * 1024 * 1024;
}
