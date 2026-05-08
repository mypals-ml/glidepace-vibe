import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        lock: {
          acquire: async (name, callback) => {
            if (typeof navigator !== 'undefined' && navigator.locks) {
              try {
                return await navigator.locks.request(name, callback);
              } catch (e) {
                console.warn('@supabase/gotrue-js: lock acquisition failed, falling back', e);
                return await callback();
              }
            }
            return await callback();
          },
        },
      },
    })
  : null;
