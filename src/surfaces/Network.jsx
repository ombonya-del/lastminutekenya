import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { useStore, sel, setReadiness, acknowledgeAlert, acceptSOS, clearToast } from '../data/store.js'
import { Icon } from '../components/ui.jsx'
import { matchProviders } from '../lib/matching.js'
import { catLabel, catIcon, kes, untilLabel, timeAgo } from '../lib/format.js'
import { areaName } from '../lib/geo.js'
import { CHANNEL_META } from '../lib/alertEngine.js'
import { providerEarns, COMMISSION_RATE } from '../lib/pricing.js'

function useCountUp(target, ms = 900) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(target); return }
    let raf, start
    const tick = (t) => { if (!start) start = t; const p = Math.min(1, (t - start) / ms); setN(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [target])
  return n
}

function useProvider() {
  const s = useStore()
  const { providerId, live } = useApp()
  return { s, provider: sel.provider(s, providerId), providerId, live }
}

function jobsFor(s, provider) {
  return s.sosJobs
    .filter((j) => j.status !== 'resolved' && provider.categories.includes(j.category))
    .map((j) => {
      const event = sel.event(s, j.eventId)
      const ranked = matchProviders(s.providers, { category: j.category, coord: event.coord, guests: event.guests })
      return { job: j, event, match: ranked.find((r) => r.provider.id === provider.id) }
    })
}

export function NetworkShell({ onStaff }) {
  return (
    <div className="eco network">
      <header className="pub-top">
        <span className="beacon" style={{ background: 'var(--go)', boxShadow: '0 0 0 0 rgba(38,217,137,.6)' }} />
        <div>
          <div className="pub-brand">LM <span className="ke" style={{ color: 'var(--go)' }}>NETWORK</span></div>
          <div className="tagline">We save the day</div>
        </div>
        <span className="aud" style={{ marginLeft: '.5rem' }}>Providers</span>
        <div style={{ flex: 1 }} />
        <button className="pub-btn pub-btn-ghost pub-btn-sm" onClick={onStaff}><Icon name="users" size={15} /> Account</button>
      </header>
      <div className="hazard-stripe" />
      <main className="pub-main">
        <Routes>
          <Route path="/provider" element={<NetworkHome />} />
          <Route path="/provider/jobs" element={<NetworkRescues />} />
          <Route path="/provider/profile" element={<NetworkProfile />} />
          <Route path="*" element={<Navigate to="/provider" replace />} />
        </Routes>
      </main>
      <nav className="pub-nav" aria-label="Primary">
        <NavLink to="/provider" end className={({ isActive }) => (isActive ? 'active' : '')}><Icon name="spark" size={22} /> Network</NavLink>
        <NavLink to="/provider/jobs" className={({ isActive }) => (isActive ? 'active' : '')}><Icon name="alert" size={22} /> Rescues</NavLink>
        <NavLink to="/provider/profile" className={({ isActive }) => (isActive ? 'active' : '')}><Icon name="users" size={22} /> Profile</NavLink>
      </nav>
      <EcoToaster />
    </div>
  )
}

function EcoToaster() {
  const s = useStore()
  if (!s.toast) return null
  setTimeout(clearToast, 3200)
  return <div className="eco-public-toast" role="status"><span style={{ width: 10, height: 10, borderRadius: 10, background: 'var(--go)' }} />{s.toast.msg}</div>
}

function NotLinked() {
  return (
    <div className="pub-panel" style={{ textAlign: 'center', marginTop: '1.5rem', padding: '2rem 1.2rem' }}>
      <Icon name="users" size={40} style={{ color: 'var(--text-dim)' }} />
      <h2 className="anton" style={{ fontSize: '1.5rem', marginTop: '.5rem' }}>Account not linked</h2>
      <p className="pub-muted" style={{ marginTop: '.3rem' }}>Ask an admin to link your login to a provider listing under Command → Accounts.</p>
    </div>
  )
}

export function NetworkHome() {
  const { s, provider, providerId } = useProvider()
  if (!provider) return <NotLinked />
  const alerts = s.alertsLog.filter((a) => a.providerId === providerId)
  const unread = alerts.filter((a) => !a.acknowledged)
  const jobs = jobsFor(s, provider)
  const doneN = useCountUp(provider.jobsDone)

  return (
    <>
      <section className="pub-hero">
        <span className="kick"><span style={{ width: 7, height: 7, borderRadius: 7, background: '#000' }} /> {provider.name}</span>
        <h1 className="anton" style={{ fontSize: 'clamp(2.4rem,11vw,3.4rem)' }}>You are<br />the <span className="hl" style={{ color: 'var(--go)' }}>rescue.</span></h1>
        <p>Intelligence-led dispatch. We warm you up <em>before</em> the call comes — so you arrive first and win the job.</p>
      </section>

      <div className="pub-panel raise">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.04em' }}>Your status</div>
          <ReadyPill r={provider.readiness} />
        </div>
        <div className="pub-optgrid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: '.7rem' }}>
          {[['ready', 'Ready'], ['busy', 'Busy'], ['off', 'Offline']].map(([v, l]) => (
            <button key={v} className={`pub-opt ${provider.readiness === v ? 'on' : ''}`} style={{ justifyContent: 'center' }} onClick={() => setReadiness(providerId, v)}>{l}</button>
          ))}
        </div>
        <div className="pub-muted" style={{ fontSize: '.78rem', marginTop: '.5rem' }}>Ready providers are alerted first and rank higher in matches.</div>
      </div>

      <div className="pub-stats" style={{ marginTop: '.8rem' }}>
        <div className="pub-stat siren"><div className="n">{unread.length}</div><div className="l">New alerts</div></div>
        <div className="pub-stat"><div className="n">{jobs.length}</div><div className="l">Rescues you can take</div></div>
        <div className="pub-stat go"><div className="n">{doneN}</div><div className="l">Jobs delivered</div></div>
      </div>

      <div className="pub-h"><h2 className="anton">Pre-dispatch intel</h2><span className="bar" />{unread.length ? <span className="pub-chip siren">{unread.length} new</span> : null}</div>
      <p className="pub-muted" style={{ margin: '-.4rem .1rem .6rem', fontSize: '.85rem' }}>Interventions that may be needed near you. Confirm readiness — a rescue call may follow.</p>
      {alerts.length === 0 ? (
        <div className="pub-panel pub-muted" style={{ textAlign: 'center' }}>Quiet for now. We’ll ping you when something moves.</div>
      ) : alerts.map((a) => <IntelCard key={a.id} a={a} s={s} />)}

      {jobs.length > 0 && (
        <>
          <div className="pub-h"><h2 className="anton">Open rescues</h2><span className="bar" /></div>
          {jobs.slice(0, 3).map(({ job, event, match }) => <JobCard key={job.id} job={job} event={event} match={match} provider={provider} s={s} />)}
        </>
      )}
    </>
  )
}

function ReadyPill({ r }) {
  const map = { ready: ['var(--go)', 'READY'], busy: ['var(--amber)', 'BUSY'], off: ['var(--text-dim)', 'OFFLINE'] }
  const [c, t] = map[r] || map.off
  return <span className="pub-chip" style={{ color: c, borderColor: c }}><span style={{ width: 8, height: 8, borderRadius: 8, background: c }} /> {t}</span>
}

function IntelCard({ a, s }) {
  const ch = CHANNEL_META[a.channel] || {}
  const color = a.likelihood === 'high' ? 'var(--siren)' : a.likelihood === 'possible' ? 'var(--amber)' : 'var(--go)'
  return (
    <div className="pub-panel" style={{ borderLeft: `4px solid ${color}`, marginBottom: '.7rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="pub-chip" style={{ color, borderColor: color }}>{ch.icon} {ch.label} alert</span>
        <span className="pub-muted" style={{ fontSize: '.75rem' }}>{timeAgo(a.sentAt, s.now)}</span>
      </div>
      <p style={{ margin: '.5rem 0 .3rem', fontSize: '.92rem' }}>{a.message}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.4rem' }}>
        <span className="pub-muted" style={{ fontSize: '.78rem' }}>{areaName(a.areaId)} · match {a.matchScore} · {a.km.toFixed(1)} km</span>
        {a.acknowledged
          ? <span className="pub-chip go"><Icon name="check" size={13} /> Ready</span>
          : <button className="pub-btn pub-btn-siren pub-btn-sm" onClick={() => acknowledgeAlert(a.id)}>I'm ready</button>}
      </div>
    </div>
  )
}

function JobCard({ job, event, match, provider, s }) {
  const mine = job.acceptedBy === provider.id
  const taken = job.status === 'accepted' && !mine
  return (
    <div className="pub-panel" style={{ marginBottom: '.7rem', borderColor: mine ? 'var(--go)' : 'var(--line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
        <div style={{ fontWeight: 800 }}>{catIcon(job.category)} {catLabel(job.category)} · {areaName(event.areaId)}</div>
        <span className="pub-chip hazard" style={{ flex: 'none' }}>{untilLabel(event.startsAt, s.now)}</span>
      </div>
      <div className="pub-muted" style={{ fontSize: '.82rem', marginTop: 2 }}>{event.venue} · {event.guests} guests</div>
      <div className="pub-panel raise" style={{ marginTop: '.5rem', padding: '.5rem .7rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div className="pub-muted" style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 800 }}>You keep</div><div className="anton" style={{ fontSize: '1.35rem', color: 'var(--go)' }}>{kes(providerEarns(event.budget))}</div></div>
        <div className="pub-muted" style={{ fontSize: '.72rem', textAlign: 'right' }}>Job {kes(event.budget)}<br />−{Math.round(COMMISSION_RATE * 100)}% network fee</div>
      </div>
      {job.note && <p style={{ margin: '.5rem 0 0', fontSize: '.9rem' }}>{job.note}</p>}
      <div className="pub-chiprow" style={{ marginTop: '.5rem' }}>
        {match && <span className="pub-chip go">Your match {match.score}</span>}
        {match && match.reasons.slice(0, 2).map((r, i) => <span className="pub-chip" key={i}>{r}</span>)}
      </div>
      <div style={{ marginTop: '.7rem' }}>
        {mine ? <span className="pub-chip go"><Icon name="check" size={13} /> You accepted — client notified</span>
          : taken ? <span className="pub-chip">Taken by another provider</span>
          : <button className="pub-btn pub-btn-siren pub-btn-block" onClick={() => acceptSOS(job.id, provider.id)}>Accept rescue</button>}
      </div>
    </div>
  )
}

export function NetworkRescues() {
  const { s, provider } = useProvider()
  if (!provider) return <NotLinked />
  const jobs = jobsFor(s, provider)
  return (
    <>
      <div className="pub-h" style={{ marginTop: '.8rem' }}><h2 className="anton">Rescue board</h2><span className="bar" /></div>
      {jobs.length === 0
        ? <div className="pub-panel pub-muted" style={{ textAlign: 'center' }}>No open rescues. Stay ready.</div>
        : jobs.map(({ job, event, match }) => <JobCard key={job.id} job={job} event={event} match={match} provider={provider} s={s} />)}
    </>
  )
}

export function NetworkProfile() {
  const { s, provider, providerId, live } = useProvider()
  const { setProviderId } = useApp()
  if (!provider) return <NotLinked />
  return (
    <>
      <div className="pub-h" style={{ marginTop: '.8rem' }}><h2 className="anton">Your profile</h2><span className="bar" /></div>
      <div className="pub-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{provider.name}</div>
          <ReadyPill r={provider.readiness} />
        </div>
        <div className="pub-muted" style={{ fontSize: '.85rem', marginTop: 2 }}>{provider.categories.map(catLabel).join(' · ')} · {areaName(provider.areaId)}</div>
        <p style={{ fontSize: '.9rem', marginTop: '.6rem' }}>{provider.blurb}</p>
        <div className="pub-stats" style={{ marginTop: '.7rem' }}>
          <div className="pub-stat go"><div className="n">{provider.jobsDone}</div><div className="l">Jobs done</div></div>
          <div className="pub-stat"><div className="n">{provider.rating.toFixed(1)}</div><div className="l">Rating</div></div>
          <div className="pub-stat siren"><div className="n">{provider.responseMins}<span style={{ fontSize: '1rem' }}>m</span></div><div className="l">Response</div></div>
        </div>
      </div>

      {!live && (
        <>
          <div className="pub-h"><h2 className="anton">Switch demo provider</h2><span className="bar" /></div>
          <div style={{ display: 'grid', gap: '.5rem' }}>
            {s.providers.map((p) => (
              <button key={p.id} className="pub-panel" onClick={() => setProviderId(p.id)}
                style={{ textAlign: 'left', cursor: 'pointer', borderColor: p.id === providerId ? 'var(--go)' : 'var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><div style={{ fontWeight: 800, fontSize: '.95rem' }}>{p.name}</div><div className="pub-muted" style={{ fontSize: '.8rem' }}>{p.categories.map(catLabel).join(' · ')}</div></div>
                {p.id === providerId && <Icon name="check" size={18} style={{ color: 'var(--go)' }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
