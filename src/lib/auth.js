// Auth helpers.
//
// Customers do NOT use SMS OTP (Supabase's phone auth only supports Twilio /
// Vonage / MessageBird / Textlocal — poor and costly for Kenya). Instead a
// customer is signed in ANONYMOUSLY on first use — instant, no OTP, no SMS
// gateway — and their phone number is captured as a plain profile field so
// providers can call them. Providers / assessors / admin sign in with email.
//
// Requires "Anonymous sign-ins" enabled in Supabase → Authentication →
// Sign In / Providers.

import { supabase } from './supabase.js'

// Ensure there is a session. If someone already signed in with email
// (provider/assessor/admin), keep it; otherwise sign the visitor in
// anonymously as a customer. The handle_new_user trigger creates their
// profiles row with role 'customer'.
export async function ensureAnonymousSession() {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return session
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) {
    console.error('[auth] anonymous sign-in failed', error)
    return null
  }
  return data.session
}

export async function getMyProfile() {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return data ? { ...data, isAnonymous: user.is_anonymous } : null
}

// Save the customer's callback details onto their profile (name + phone).
export async function updateMyProfile({ name, phone }) {
  if (!supabase) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const patch = {}
  if (name != null) patch.name = name
  if (phone != null) patch.phone = phone
  if (Object.keys(patch).length === 0) return
  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
  if (error) console.error('[auth] profile update failed', error)
}

// Upgrade an anonymous customer to a permanent email account later, without
// losing their history (same auth.uid).
export async function linkEmail(email) {
  if (!supabase) return
  return supabase.auth.updateUser({ email })
}

// Staff (provider / assessor / admin) sign in with email + password.
// Signing in replaces any anonymous session with the real account.
export async function signInStaff(email, password) {
  if (!supabase) return { error: 'offline' }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

// Staff self-registration. The account is created as a customer (secure default)
// with an advisory `requested_role`; an admin approves it from the Accounts
// screen. If email confirmation is on, `needsConfirm` is true.
export async function signUpStaff({ name, email, password, requestedRole }) {
  if (!supabase) return { error: 'offline' }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, requested_role: requestedRole } },
  })
  const needsConfirm = !error && data?.user && !data?.session
  return { data, error, needsConfirm }
}

// After sign-out, drop back to a fresh anonymous customer session.
export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
  await ensureAnonymousSession()
}

export function onAuthChange(cb) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange(() => cb())
  return () => data.subscription.unsubscribe()
}
