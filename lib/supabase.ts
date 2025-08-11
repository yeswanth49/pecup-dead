import { createClient } from '@supabase/supabase-js';

// Validate public env vars explicitly
const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const missingPublicEnvVars: string[] = [];
if (!publicSupabaseUrl) missingPublicEnvVars.push('NEXT_PUBLIC_SUPABASE_URL');
if (!publicSupabaseAnonKey) missingPublicEnvVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (missingPublicEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missingPublicEnvVars.join(', ')}. ` +
      'These are required to initialize the public Supabase client.'
  );
}

export const supabase = createClient(publicSupabaseUrl as string, publicSupabaseAnonKey as string);

// Server-only factory for an admin Supabase client (uses service role key)
export function createSupabaseAdmin() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'createSupabaseAdmin must only be used in server-side code (API routes, server actions, middleware, or SSR). '
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[supabase] SUPABASE_SERVICE_ROLE_KEY missing; using anon key fallback in development');
      return createClient(publicSupabaseUrl as string, publicSupabaseAnonKey as string);
    }
    throw new Error(
      'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY. ' +
        'The admin client bypasses RLS and must only be used server-side (API routes, server actions, middleware, or SSR).'
    );
  }

  return createClient(publicSupabaseUrl as string, serviceRoleKey);
}