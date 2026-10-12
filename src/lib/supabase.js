// Supabase browser client. Only the PUBLIC anon key is used here — never the
// service-role key. RLS is what protects the data; see supabase/migrations.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

// `enabled` lets the app fall back to the in-memory seed store when env is not
// set (e.g. local design work), so nothing breaks before the backend is wired.
export const supabaseEnabled = Boolean(url && anon)

// persistSession + autoRefreshToken keep you signed in on your own device for
// weeks (no re-login each visit); detectSessionInUrl lets magic-link and
// password-reset links complete when opened.
export const supabase = supabaseEnabled
  ? createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null
