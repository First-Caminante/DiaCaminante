import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> } | undefined;

export function getSupabaseAdmin(env?: any): SupabaseClient {
  const envProcess = typeof process !== 'undefined' && process.env ? process.env : {};
  const importEnv = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env as any) : {};

  const supabaseUrl = 
    env?.SUPABASE_URL || 
    envProcess.SUPABASE_URL || 
    importEnv.SUPABASE_URL ||
    'https://conedgbqbwoazfwspstg.supabase.co';

  const supabaseServiceKey = 
    env?.SUPABASE_SERVICE_ROLE_KEY || 
    envProcess.SUPABASE_SERVICE_ROLE_KEY || 
    importEnv.SUPABASE_SERVICE_ROLE_KEY ||
    '';

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(`Credenciales de Supabase no disponibles en runtime. URL: ${Boolean(supabaseUrl)}, KEY: ${Boolean(supabaseServiceKey)}`);
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
