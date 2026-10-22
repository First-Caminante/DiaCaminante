import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> } | undefined;

const envProcess = (typeof process !== 'undefined' && process.env ? process.env : {}) as Record<string, string | undefined>;
const importEnv = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}) as Record<string, any>;

const SUPABASE_URL = 
  envProcess.SUPABASE_URL || 
  importEnv.SUPABASE_URL || 
  '';

const SUPABASE_SERVICE_ROLE_KEY = 
  envProcess.SUPABASE_SERVICE_ROLE_KEY || 
  importEnv.SUPABASE_SERVICE_ROLE_KEY || 
  '';

const SUPABASE_ANON_KEY = 
  envProcess.SUPABASE_ANON_KEY || 
  importEnv.SUPABASE_ANON_KEY || 
  '';

/**
 * Singleton client for backend Hono API routes.
 * Uses SUPABASE_SERVICE_ROLE_KEY to avoid RLS blocks.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Standard client for anon operations.
 */
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: false,
    },
  }
);

/**
 * Helper to get a Supabase client with optional runtime environment overrides
 * (useful in Cloudflare Pages runtime context).
 */
export function getSupabaseAdmin(customEnv?: Record<string, any>): SupabaseClient {
  const url = customEnv?.SUPABASE_URL || SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = customEnv?.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
