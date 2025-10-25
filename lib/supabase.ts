import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

// Singleton pattern for admin client to reduce resource waste
let supabaseAdminInstance: SupabaseClient | null = null;

/**
 * Get or create a singleton admin Supabase client
 * This prevents creating multiple client instances and improves performance
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      'getSupabaseAdmin must only be used in server-side code (API routes, server actions, middleware, or SSR). '
    );
  }
  // @coderabbitai this above error is thrrowing, what might be the issue? and how can i solve it?

  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.SUPABASE_ALLOW_DEV_ANON_FALLBACK === 'true'
    ) {
      console.warn(
        '[supabase] SUPABASE_SERVICE_ROLE_KEY missing; using anon key fallback in development (explicitly allowed via SUPABASE_ALLOW_DEV_ANON_FALLBACK)'
      );
      supabaseAdminInstance = createClient(publicSupabaseUrl as string, publicSupabaseAnonKey as string, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      return supabaseAdminInstance;
    }
    throw new Error(
      'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY. ' +
        'The admin client bypasses RLS and must only be used server-side (API routes, server actions, middleware, or SSR).'
    );
  }

  supabaseAdminInstance = createClient(publicSupabaseUrl as string, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseAdminInstance;
}

// Legacy function for backward compatibility - now uses singleton
export function createSupabaseAdmin(): SupabaseClient {
  return getSupabaseAdmin();
}

/**
 * Reset the admin client instance (useful for testing or connection issues)
 */
export function resetSupabaseAdmin(): void {
  supabaseAdminInstance = null;
}