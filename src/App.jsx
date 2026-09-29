import { createContext, useContext, useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Icon, Sheet, Avatar } from './components/ui.jsx'
import { useStore, clearToast } from './data/store.js'
import { supabaseEnabled } from './lib/supabase.js'
import { signInStaff, signUpStaff, signOut, onAuthChange } from './lib/auth.js'
import { whoami } from './data/api.js'
import { CONFIG, ALLOWED_ROLES, CAN_CROSS_VIEW, OTHER_APPS, appForRole } from './appConfig.js'

// ---- role + identity context ----------------------------------------------
const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

// Build flag, read literally so Vite/esbuild fold the branches below at build
// time — the false branches (and their dynamic import()s) are dropped, so the
// public and network bundles never ship admin/assessor code.
const VITE_APP = import.meta.env.VITE_APP || 'public'

// Lazy shells, gated by build. Each import() only survives in the build whose
// branch is true, which is what makes the three PWAs truly isolated.
const shellImport = {}
if (VITE_APP === 'network') {
  shellImport.provider = () => import('./surfaces/Network.jsx').then((m) => ({ default: m.NetworkShell }))
} else if (VITE_APP === 'admin') {
  shellImport.admin = () => import('./surfaces/Command.jsx').then((m) => ({ default: m.CommandShell }))
  shellImport.assessor = () => import('./surfaces/Field.jsx').then((m) => ({ default: m.FieldShell }))
  // admin can look INTO the client + provider surfaces
  shellImport.customer = () => import('./surfaces/Public.jsx').then((m) => ({ default: m.PublicShell }))
  shellImport.provider = () => import('./surfaces/Network.jsx').then((m) => ({ default: m.NetworkShell }))
} else {
  shellImport.customer = () => import('./surfaces/Public.jsx').then((m) => ({ default: m.PublicShell }))
}
const SHELLS = Object.fromEntries(Object.entries(shellImport).map(([role, loader]) => [role, lazy(loader)]))

const ROLES = {
  customer: { label: 'Client', tagline: 'Save the Day' },
  provider: { label: 'Provider', tagline: 'Last Minute Network' },
  assessor: { label: 'Assessor', tagline: 'Site Assessment' },
  admin: { label: 'Admin', tagline: 'Operations' },
}

const DEFAULT_ROLE = ALLOWED_ROLES[0]

function roleFromPath(pathname) {
  const seg = pathname.split('/')[1]
  return ALLOWED_ROLES.includes(seg) ? seg : DEFAULT_ROLE
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [switcher, setSwitcher] = useState(false)
  const [login, setLogin] = useState(false)
  const [previewRole, setPreviewRole] = useState(null)

  // Demo identities (seed mode only — switchable in the UI).
  const [demoProviderId, setDemoProviderId] = useState('p_savanna')
  const [demoAssessorId, setDemoAssessorId] = useState('a_atieno')

  // Live identity (from Supabase whoami).
  const [identity, setIdentity] = useState(null)
  const [authReady, setAuthReady] = useState(!supabaseEnabled)

  useEffect(() => {
    if (!supabaseEnabled) return
    let alive = true
    const load = () =>
      whoami().then((w) => {
        if (alive) {
          setIdentity(w)
          setAuthReady(true)
        }
      })
    load()
    const off = onAuthChange(load)
    return () => {
      alive = false
      off()
    }
  }, [])

  const realRole = supabaseEnabled ? identity?.role || 'customer' : roleFromPath(location.pathname)
  // Preview is an admin-only power; ignore it in the isolated apps.
  const effectivePreview = CAN_CROSS_VIEW && previewRole && previewRole !== 'admin' ? previewRole : null
  const role = effectivePreview || realRole

  // Live mode: someone whose role this app doesn't serve reached the wrong door.
  const wrongDoor = supabaseEnabled && identity && !ALLOWED_ROLES.includes(realRole)

  // The owner lens (persistent Command/Client/Network switcher) adds a top strip
  // in the admin build only — offset the sticky headers underneath it.
  useEffect(() => {
    const on = CAN_CROSS_VIEW && authReady && !wrongDoor
    document.body.classList.toggle('owner-lens', on)
    return () => document.body.classList.remove('owner-lens')
  }, [authReady, wrongDoor])

  // Keep the URL on a route this build actually owns (unless previewing).
  useEffect(() => {
    if (wrongDoor) return
    const seg = location.pathname.split('/')[1]
    const target = effectivePreview || (supabaseEnabled ? realRole : roleFromPath(location.pathname))
    if (!ALLOWED_ROLES.includes(seg)) {
      navigate(CONFIG.home, { replace: true })
    } else if (supabaseEnabled && !effectivePreview && seg !== realRole && ALLOWED_ROLES.includes(realRole)) {
      navigate('/' + realRole, { replace: true })
    }
  }, [identity, realRole, effectivePreview, location.pathname, wrongDoor])

  const ctx = useMemo(
    () => ({
      role,
      live: supabaseEnabled,
      providerId: supabaseEnabled ? identity?.providerId : demoProviderId,
      assessorId: supabaseEnabled ? identity?.assessorId : demoAssessorId,
      clientId: supabaseEnabled ? identity?.uid : 'c_wanjiru',
      setProviderId: setDemoProviderId,
      setAssessorId: setDemoAssessorId,
    }),
    [role, identity, demoProviderId, demoAssessorId]
  )

  if (!authReady) {
    return (
      <div className={`eco ${CONFIG.variant}`}>
        <div className="empty" style={{ paddingTop: '40vh', textAlign: 'center' }}>
          <Icon name="clock" size={40} />
          <div className="pub-muted" style={{ marginTop: '.4rem' }}>Connecting…</div>
        </div>
      </div>
    )
  }

  if (wrongDoor) {
    return <WrongDoor role={realRole} onSignOut={async () => { setPreviewRole(null); await signOut() }} />
  }

  const openStaff = () => setSwitcher(true)
  const Shell = SHELLS[role] || SHELLS[DEFAULT_ROLE]

  return (
    <AppCtx.Provider value={ctx}>
      <Suspense fallback={<ShellFallback />}>
        {Shell ? <Shell onStaff={openStaff} /> : <ShellFallback />}
      </Suspense>

      {switcher && !supabaseEnabled && (
        <AccountMenu seed identity={null} role={role} realRole={realRole}
          onPreview={(r) => { setSwitcher(false); setPreviewRole(r === realRole ? null : r); navigate('/' + r) }}
          onSignIn={() => { setSwitcher(false); setLogin(true) }}
          onSignOut={() => setSwitcher(false)}
          onClose={() => setSwitcher(false)} />
      )}
      {switcher && supabaseEnabled && (
        <AccountMenu identity={identity} role={role} realRole={realRole}
          onSignIn={() => { setSwitcher(false); setLogin(true) }}
          onSignOut={async () => { setSwitcher(false); setPreviewRole(null); await signOut() }}
          onPreview={(r) => { setSwitcher(false); setPreviewRole(r === realRole ? null : r); navigate('/' + r) }}
          onClose={() => setSwitcher(false)} />
      )}

      {CAN_CROSS_VIEW && (
        <OwnerLens
          active={effectivePreview || 'admin'}
          onPick={(r) => { setPreviewRole(r); navigate('/' + (r === 'admin' ? realRole : r)) }}
        />
      )}
      {login && <StaffLogin onClose={() => setLogin(false)} />}
    </AppCtx.Provider>
  )
}

// Persistent owner switcher — Admin app only. Command, plus the fully-working
// Client and Network apps, one tap away and visible at all times.
function OwnerLens({ active, onPick }) {
  const items = [
    ['admin', 'Command'],
    ['customer', 'Client app'],
    ['provider', 'Network app'],
  ]
  return (
    <div className="owner-lens-bar">
      <span className="oll"><span className="oll-dot" /> Owner lens</span>
      <div className="oll-seg" role="tablist" aria-label="Switch app">
        {items.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={active === k} className={active === k ? 'on' : ''} onClick={() => onPick(k)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ShellFallback() {
  return (
    <div className={`eco ${CONFIG.variant}`}>
      <div className="empty" style={{ paddingTop: '40vh', textAlign: 'center' }}>
        <Icon name="clock" size={36} />
        <div className="pub-muted" style={{ marginTop: '.4rem' }}>Loading…</div>
      </div>
    </div>
  )
}

// Someone signed in whose role this PWA doesn't serve → point them to the right app.
function WrongDoor({ role, onSignOut }) {
  const target = appForRole(role)
  return (
    <div className={`eco ${CONFIG.variant}`}>
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '4rem 1.4rem', textAlign: 'center' }}>
        <div className="beacon" style={{ margin: '0 auto 1.2rem' }} />
        <h1 className="anton" style={{ fontSize: '2rem', marginBottom: '.6rem' }}>Wrong door</h1>
        <p className="pub-muted" style={{ lineHeight: 1.55 }}>
          You're signed in as <strong>{ROLES[role]?.label || role}</strong>. That role lives on the
          {' '}<strong>{target.label}</strong> app.
        </p>
        <a className="pub-btn pub-btn-siren" style={{ marginTop: '1.4rem', background: CONFIG.theme, boxShadow: 'none' }}
           href={`https://${target.id === 'public' ? 'app' : target.id}.lastminutekenya.com`}>
          Go to {target.label}
        </a>
        <button className="pub-btn pub-btn-ghost" style={{ marginTop: '.6rem' }} onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  )
}

function AccountMenu({ seed, identity, role, realRole, onSignIn, onSignOut, onPreview, onClose }) {
  const isGuest = !identity?.email
  const canPreview = CAN_CROSS_VIEW && (seed || realRole === 'admin')
  return (
    <Sheet title="Account" onClose={onClose}>
      <div className="card flat" style={{ display: 'flex', alignItems: 'center', gap: '.8rem' }}>
        <Avatar name={identity?.email || CONFIG.label} />
        <div className="grow">
          <div className="subtitle wrapany">{identity?.email || (seed ? 'Demo session' : 'Guest (anonymous)')}</div>
          <div className="caption">{CONFIG.label} · <strong>{CONFIG.audience}</strong></div>
        </div>
      </div>

      {canPreview && (
        <>
          <div className="caption" style={{ fontWeight: 800, margin: '.9rem .1rem .4rem' }}>Look into a surface</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '.5rem' }}>
            {[['admin', 'Command'], ['customer', 'Client app'], ['provider', 'Network app']].map(([k, label]) => (
              <button key={k} className={`btn btn-ghost btn-sm ${k === role ? 'on' : ''}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => onPreview(k)}>{label}</button>
            ))}
          </div>
          <div className="caption" style={{ margin: '.4rem .1rem 0' }}>See the client and provider apps as they do. Only Command can do this.</div>
        </>
      )}

      {/* isolated apps: point staff to their own PWA rather than logging in here */}
      {!CAN_CROSS_VIEW && VITE_APP === 'public' && (
        <div style={{ marginTop: '.9rem' }}>
          <div className="caption" style={{ fontWeight: 800, margin: '0 .1rem .4rem' }}>Are you a provider or staff?</div>
          {OTHER_APPS.map((a) => (
            <a key={a.id} className="btn btn-ghost" style={{ marginTop: '.4rem', textDecoration: 'none' }}
               href={`https://${a.id === 'public' ? 'app' : a.id}.lastminutekenya.com`}>
              Open {a.label} →
            </a>
          ))}
        </div>
      )}

      {/* network app: providers sign in here */}
      {!CAN_CROSS_VIEW && VITE_APP === 'network' && isGuest && !seed && (
        <button className="btn btn-dark" style={{ marginTop: '.8rem' }} onClick={onSignIn}>
          <Icon name="users" size={18} /> Provider sign in / register
        </button>
      )}

      {/* admin app: staff sign in */}
      {CAN_CROSS_VIEW && isGuest && !seed && (
        <button className="btn btn-dark" style={{ marginTop: '.8rem' }} onClick={onSignIn}>
          <Icon name="users" size={18} /> Staff sign in
        </button>
      )}

      {!seed && (
        <button className="btn btn-ghost" style={{ marginTop: '.5rem' }} onClick={onSignOut}>
          {isGuest ? 'Reset session' : 'Sign out'}
        </button>
      )}
    </Sheet>
  )
}

function StaffLogin({ onClose }) {
  const [mode, setMode] = useState('in') // 'in' | 'up'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // On the network app only providers register; on the admin app, assessors too.
  const [requestedRole, setRequestedRole] = useState(VITE_APP === 'network' ? 'provider' : 'assessor')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null) // 'confirm' | 'created'

  const rolesForSignup = VITE_APP === 'network' ? [['provider', 'spark', 'Provider']] : [['assessor', 'clipboard', 'Assessor']]

  const submit = async () => {
    setBusy(true)
    setErr('')
    if (mode === 'in') {
      const { error } = await signInStaff(email, password)
      setBusy(false)
      if (error) setErr(typeof error === 'string' ? error : error.message)
      else onClose()
    } else {
      const { error, needsConfirm } = await signUpStaff({ name, email, password, requestedRole })
      setBusy(false)
      if (error) setErr(typeof error === 'string' ? error : error.message)
      else setDone(needsConfirm ? 'confirm' : 'created')
    }
  }

  if (done) {
    return (
      <Sheet title="Request sent" onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '.5rem 0 .3rem' }}>
          <div className="avatar" style={{ background: 'var(--go)', margin: '0 auto .6rem', width: 48, height: 48 }}>
            <Icon name="check" size={24} style={{ color: '#fff' }} />
          </div>
          <div className="subtitle">Account created</div>
          <p className="body" style={{ marginTop: '.4rem' }}>
            {done === 'confirm'
              ? 'Check your email to confirm the address, then an admin will grant your access.'
              : `Thanks${name ? ', ' + name : ''}. An admin will review and grant your ${requestedRole} access shortly.`}
          </p>
          <button className="btn btn-primary" style={{ marginTop: '.9rem' }} onClick={onClose}>Done</button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={mode === 'in' ? 'Sign in' : 'Request access'} onClose={onClose}>
      <div className="optiongrid" style={{ marginBottom: '.4rem' }}>
        <button className={`optionbtn ${mode === 'in' ? 'on' : ''}`} style={{ justifyContent: 'center' }} onClick={() => { setMode('in'); setErr('') }}>Sign in</button>
        <button className={`optionbtn ${mode === 'up' ? 'on' : ''}`} style={{ justifyContent: 'center' }} onClick={() => { setMode('up'); setErr('') }}>Request access</button>
      </div>
      <p className="caption" style={{ marginTop: 0 }}>
        {mode === 'in'
          ? (VITE_APP === 'network' ? 'For Last Minute Network providers.' : 'For admins and Site Assessors.')
          : (VITE_APP === 'network' ? 'Providers: register here. An admin approves before you go live.' : 'Assessors: register here. An admin approves before you get access.')}
      </p>

      {mode === 'up' && (
        <>
          <div className="field">
            <label>Name / business name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={VITE_APP === 'network' ? 'e.g. Savanna Fresh Caterers' : 'e.g. Atieno O.'} />
          </div>
          {rolesForSignup.length > 1 && (
            <div className="field">
              <label>I'm signing up as</label>
              <div className="optiongrid">
                {rolesForSignup.map(([r, ic, lbl]) => (
                  <button key={r} className={`optionbtn ${requestedRole === r ? 'on' : ''}`} onClick={() => setRequestedRole(r)}>
                    <Icon name={ic} size={16} /> {lbl}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="field">
        <label>Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="field">
        <label>Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'up' ? 'At least 6 characters' : ''} />
      </div>
      {err && <p className="caption" style={{ color: 'var(--red)', marginTop: '.5rem' }}>{err}</p>}
      <button className="btn btn-primary" style={{ marginTop: '1rem' }}
        disabled={busy || !email || !password || (mode === 'up' && !name)} onClick={submit}>
        {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
      </button>
    </Sheet>
  )
}
