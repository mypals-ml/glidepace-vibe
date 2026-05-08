import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        lock: async <R>(name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
          if (typeof navigator !== 'undefined' && navigator.locks) {
            try {
              return await navigator.locks.request(name, fn);
            } catch (e) {
              console.warn('@supabase/auth-js: lock acquisition failed, falling back', e);
              return await fn();
            }
          }
          return await fn();
        },
      },
    })
  : null;
