import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useStore, sel, assignAssessor, acceptSOS, resolveSOS, clearToast } from '../data/store.js'
import { Icon } from '../components/ui.jsx'
import { matchProviders } from '../lib/matching.js'
import { scoreAssessment, BAND_META } from '../lib/scorecard.js'
import { catLabel, catIcon, kes, untilLabel } from '../lib/format.js'
import { AREAS, areaName } from '../lib/geo.js'
import { CHANNEL_META } from '../lib/alertEngine.js'
import { supabaseEnabled } from '../lib/supabase.js'
import * as api from '../data/api.js'

const bandColor = (b) => (b === 'red' ? 'var(--red)' : b === 'amber' ? 'var(--amber)' : 'var(--go)')

export function CommandShell({ onStaff }) {
  return (
    <div className="eco command">
      <header className="pub-top">
        <span className="beacon" style={{ background: '#4da3ff', boxShadow: '0 0 0 0 rgba(77,163,255,.6)' }} />
        <div>
          <div className="pub-brand">LM <span className="ke" style={{ color: '#4da3ff' }}>COMMAND</span></div>
          <div className="tagline">We save the day</div>
        </div>
        <span className="aud" style={{ marginLeft: '.5rem' }}>Admin</span>
        <div style={{ flex: 1 }} />
        <button className="pub-btn pub-btn-ghost pub-btn-sm" onClick={onStaff}><Icon name="users" size={15} /> Account</button>
      </header>
      <div className="hazard-stripe" />
      <main className="pub-main">
        <Routes>
          <Route path="/admin" element={<CommandOverview />} />
          <Route path="/admin/scorecards" element={<CommandScorecards />} />
          <Route path="/admin/dispatch" element={<CommandDispatch />} />
          <Route path="/admin/network" element={<CommandNetwork />} />
          <Route path="/admin/accounts" element={<CommandAccounts />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
      <nav className="pub-nav" aria-label="Primary">
        <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'active' : '')}><Icon name="grid" size={21} /> Ops</NavLink>
        <NavLink to="/admin/scorecards" className={({ isActive }) => (isActive ? 'active' : '')}><Icon name="shield" size={21} /> Scores</NavLink>
        <NavLink to="/admin/dispatch" className={({ isActive }) => (isActive ? 'active' : '')}><Icon name="send" size={21} /> Dispatch</NavLink>
        <NavLink to="/admin/network" className={({ isActive }) => (isActive ? 'active' : '')}><Icon name="map" size={21} /> Map</NavLink>
        <NavLink to="/admin/accounts" className={({ isActive }) => (isActive ? 'active' : '')}><Icon name="users" size={21} /> Accts</NavLink>
      </nav>
      <EcoToaster />
    </div>
  )
}

function EcoToaster() {
  const s = useStore()
  if (!s.toast) return null
  setTimeout(clearToast, 3200)
  return <div className="eco-public-toast" role="status"><span style={{ width: 10, height: 10, borderRadius: 10, background: '#4da3ff' }} />{s.toast.msg}</div>
}

function H({ children, right }) {
  return <div className="pub-h"><h2 className="anton">{children}</h2><span className="bar" />{right}</div>
}

export function CommandOverview() {
  const s = useStore()
  const openJobs = s.sosJobs.filter((j) => j.status !== 'resolved')
  const scored = s.assessments.filter((a) => a.status === 'scored')
  const atRisk = scored.filter((a) => a.band !== 'green')
  const ready = s.providers.filter((p) => p.readiness === 'ready').length
  const acked = s.alertsLog.filter((a) => a.acknowledged).length

  return (
    <>
      <section className="pub-hero" style={{ paddingBottom: '.6rem' }}>
        <span className="kick"><span style={{ width: 7, height: 7, borderRadius: 7, background: '#000' }} /> Operations · live</span>
        <h1 className="anton" style={{ fontSize: 'clamp(2.3rem,10vw,3.1rem)' }}>Network <span className="hl" style={{ color: '#4da3ff' }}>command</span></h1>
      </section>

      <div className="pub-stats" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        <div className="pub-stat siren"><div className="n">{openJobs.length}</div><div className="l">Open rescues</div></div>
        <div className="pub-stat" style={{ borderColor: atRisk.length ? 'var(--amber)' : 'var(--line)' }}><div className="n" style={{ color: 'var(--amber)' }}>{atRisk.length}</div><div className="l">At-risk events</div></div>
        <div className="pub-stat go"><div className="n">{ready}<span style={{ fontSize: '1.1rem' }}>/{s.providers.length}</span></div><div className="l">Providers ready</div></div>
        <div className="pub-stat"><div className="n" style={{ color: '#4da3ff' }}>{acked}<span style={{ fontSize: '1.1rem' }}>/{s.alertsLog.length}</span></div><div className="l">Alerts ack'd</div></div>
      </div>

      <H right={openJobs.length ? <span className="pub-chip siren">{openJobs.length}</span> : null}>Live dispatch</H>
      {openJobs.length === 0 ? <div className="pub-panel pub-muted" style={{ textAlign: 'center' }}>No active rescues.</div> : openJobs.map((j) => {
        const event = sel.event(s, j.eventId)
        const provider = j.acceptedBy ? sel.provider(s, j.acceptedBy) : null
        return (
          <div className="pub-panel" key={j.id} style={{ marginBottom: '.6rem', borderLeft: `4px solid ${provider ? 'var(--go)' : 'var(--siren)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
              <div style={{ fontWeight: 800 }}>{catIcon(j.category)} {catLabel(j.category)} · {areaName(event.areaId)}</div>
              <span className={`pub-chip ${provider ? 'go' : 'siren'}`}>{provider ? 'Accepted' : 'Dispatching'}</span>
            </div>
            <div className="pub-muted" style={{ fontSize: '.82rem', marginTop: 2 }}>{event.title} · {untilLabel(event.startsAt, s.now)}{provider ? ` · ✅ ${provider.name}` : ''}</div>
          </div>
        )
      })}

      <H>Recent scorecards</H>
      {scored.slice(0, 4).map((a) => {
        const event = sel.event(s, a.eventId)
        return (
          <div className="pub-panel" key={a.id} style={{ marginBottom: '.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontWeight: 800 }} className="wrapany">{event.title}</div><div className="pub-muted" style={{ fontSize: '.8rem' }}>{areaName(event.areaId)} · score {a.score}</div></div>
            <span className="pub-rag" style={{ background: 'transparent', color: bandColor(a.band), border: `1.5px solid ${bandColor(a.band)}` }}>{a.band}</span>
          </div>
        )
      })}
    </>
  )
}

export function CommandScorecards() {
  const s = useStore()
  return (
    <>
      <H>Scorecards</H>
      {s.assessments.map((a) => {
        const event = sel.event(s, a.eventId)
        const client = sel.client(s, a.requestedBy)
        const assessor = a.assessorId ? sel.assessor(s, a.assessorId) : null
        if (a.status === 'scored') {
          const { score, band, reasons } = scoreAssessment(a.answers)
          return (
            <div className="pub-panel" key={a.id} style={{ marginBottom: '.7rem', borderColor: bandColor(band) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="pub-muted" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800 }}>Scorecard</div>
                <span className="pub-rag" style={{ background: 'transparent', color: bandColor(band), border: `1.5px solid ${bandColor(band)}` }}>{band}</span>
              </div>
              <div className="wrapany" style={{ fontWeight: 800, marginTop: '.2rem' }}>{event.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', marginTop: '.4rem' }}>
                <div className="anton" style={{ fontSize: '2.2rem', color: bandColor(band) }}>{score}</div>
                <div className="pub-muted" style={{ fontSize: '.82rem' }}>{BAND_META[band].headline}<br />{client?.name}{assessor ? ` · by ${assessor.name}` : ''}</div>
              </div>
              {reasons.length > 0 && <div className="pub-muted" style={{ fontSize: '.82rem', marginTop: '.5rem' }}>Flags: {reasons.map((r) => r.label).join(', ')}</div>}
            </div>
          )
        }
        return (
          <div className="pub-panel" key={a.id} style={{ marginBottom: '.7rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
              <div className="wrapany" style={{ fontWeight: 800 }}>{event.title}</div>
              <span className="pub-chip">{a.status}</span>
            </div>
            <div className="pub-muted" style={{ fontSize: '.82rem', marginTop: 2 }}>“{a.concern}” — {client?.name}</div>
            <AssignRow assessment={a} assessors={s.assessors} />
          </div>
        )
      })}
    </>
  )
}

function AssignRow({ assessment, assessors }) {
  const [val, setVal] = useState(assessment.assessorId || '')
  if (assessment.assessorId) {
    const who = assessors.find((a) => a.id === assessment.assessorId)
    return <div className="pub-muted" style={{ fontSize: '.82rem', marginTop: '.5rem' }}>Assessor: {who?.name}</div>
  }
  return (
    <div style={{ display: 'flex', gap: '.4rem', marginTop: '.6rem' }}>
      <select className="pub-select" style={{ padding: '.45rem .5rem', fontSize: '.85rem' }} value={val} onChange={(e) => setVal(e.target.value)}>
        <option value="">Assign assessor…</option>
        {assessors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <button className="pub-btn pub-btn-hazard pub-btn-sm" disabled={!val} onClick={() => assignAssessor(assessment.id, val)}>Go</button>
    </div>
  )
}

export function CommandDispatch() {
  const s = useStore()
  const openJobs = s.sosJobs.filter((j) => j.status !== 'resolved')
  return (
    <>
      <H>Dispatch board</H>
      {openJobs.length === 0 ? <div className="pub-panel pub-muted" style={{ textAlign: 'center' }}>No open rescues.</div> : openJobs.map((j) => {
        const event = sel.event(s, j.eventId)
        const ranked = matchProviders(s.providers, { category: j.category, coord: event.coord, guests: event.guests }).slice(0, 3)
        return (
          <div className="pub-panel" key={j.id} style={{ marginBottom: '.7rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
              <div style={{ fontWeight: 800 }}>{catIcon(j.category)} {catLabel(j.category)} · {areaName(event.areaId)}</div>
              <span className={`pub-chip ${j.acceptedBy ? 'go' : 'siren'}`}>{j.acceptedBy ? 'Accepted' : 'Dispatching'}</span>
            </div>
            <div className="pub-muted" style={{ fontSize: '.82rem', marginTop: 2 }}>{event.title} · {event.guests} guests · {untilLabel(event.startsAt, s.now)}</div>
            {j.note && <p style={{ fontSize: '.88rem', margin: '.4rem 0 0' }}>{j.note}</p>}
            <div className="pub-divider" />
            <div className="pub-muted" style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800, marginBottom: '.5rem' }}>Top matches</div>
            {ranked.map((m) => (
              <div key={m.provider.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.5rem', padding: '.35rem 0' }}>
                <div className="wrapany"><div style={{ fontWeight: 700, fontSize: '.9rem' }}>{m.provider.name}</div><div className="pub-muted" style={{ fontSize: '.76rem' }}>match {m.score} · {m.km.toFixed(1)} km · ★ {m.provider.rating}</div></div>
                {j.acceptedBy === m.provider.id
                  ? <span className="pub-chip go">Accepted</span>
                  : <button className="pub-btn pub-btn-siren pub-btn-sm" onClick={() => acceptSOS(j.id, m.provider.id)}>Dispatch</button>}
              </div>
            ))}
            {j.acceptedBy && <button className="pub-btn pub-btn-ghost pub-btn-sm" style={{ marginTop: '.6rem' }} onClick={() => resolveSOS(j.id)}>Mark resolved</button>}
          </div>
        )
      })}

      <H right={<span className="pub-chip" style={{ color: '#4da3ff', borderColor: '#4da3ff' }}>{s.alertsLog.length}</span>}>Alert log</H>
      {s.alertsLog.map((a) => {
        const ch = CHANNEL_META[a.channel] || {}
        const color = a.likelihood === 'high' ? 'var(--siren)' : a.likelihood === 'possible' ? 'var(--amber)' : 'var(--go)'
        return (
          <div className="pub-panel" key={a.id} style={{ marginBottom: '.6rem', borderLeft: `4px solid ${color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
              <span className="pub-chip" style={{ color, borderColor: color }}>{ch.icon} {ch.label}</span>
              <span className="pub-muted wrapany" style={{ fontSize: '.78rem' }}>{a.providerName}</span>
            </div>
            <p className="pub-muted" style={{ fontSize: '.82rem', margin: '.4rem 0 0' }}>{areaName(a.areaId)} · {catLabel(a.category)} · match {a.matchScore} · <b style={{ color: a.acknowledged ? 'var(--go)' : 'var(--text-dim)' }}>{a.acknowledged ? 'ack' : a.status}</b></p>
          </div>
        )
      })}
    </>
  )
}

export function CommandNetwork() {
  const s = useStore()
  return (
    <>
      <H>Coverage map</H>
      <CoverageMap providers={s.providers} events={s.events} />
      <H right={<span className="pub-chip">{s.providers.length}</span>}>Providers</H>
      {s.providers.map((p) => (
        <div className="pub-panel" key={p.id} style={{ marginBottom: '.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="wrapany"><div style={{ fontWeight: 800, fontSize: '.92rem' }}>{p.name}</div><div className="pub-muted" style={{ fontSize: '.78rem' }}>{p.categories.map(catLabel).join(' · ')} · {areaName(p.areaId)}</div></div>
          <span className="pub-chip" style={{ color: p.readiness === 'ready' ? 'var(--go)' : p.readiness === 'busy' ? 'var(--amber)' : 'var(--text-dim)' }}>{p.readiness}</span>
        </div>
      ))}
    </>
  )
}

function CoverageMap({ providers, events }) {
  const pts = [...providers.map((p) => ({ ...p.base, kind: 'p' })), ...events.map((e) => ({ ...e.coord, kind: 'e' }))]
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const W = 100, H = 76, pad = 8
  const x = (lng) => pad + ((lng - minLng) / (maxLng - minLng || 1)) * (W - 2 * pad)
  const y = (lat) => pad + ((maxLat - lat) / (maxLat - minLat || 1)) * (H - 2 * pad)
  return (
    <div className="pub-panel" style={{ padding: '.7rem' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Coverage map">
        <rect x="0" y="0" width={W} height={H} rx="4" fill="var(--bg-2)" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(p.lng)} cy={y(p.lat)} r={p.kind === 'e' ? 2.6 : 2} fill={p.kind === 'e' ? 'var(--siren)' : '#4da3ff'} />
            {p.kind === 'e' && <circle cx={x(p.lng)} cy={y(p.lat)} r="5" fill="none" stroke="var(--siren)" strokeWidth="0.6" opacity="0.6" />}
          </g>
        ))}
      </svg>
      <div className="pub-chiprow" style={{ marginTop: '.6rem' }}>
        <span className="pub-chip"><span style={{ width: 8, height: 8, borderRadius: 8, background: '#4da3ff' }} /> Providers</span>
        <span className="pub-chip"><span style={{ width: 8, height: 8, borderRadius: 8, background: 'var(--siren)' }} /> Live events</span>
      </div>
    </div>
  )
}

const ROLE_OPTS = ['customer', 'provider', 'assessor', 'admin']

export function CommandAccounts() {
  if (!supabaseEnabled) {
    return (
      <>
        <H>Accounts</H>
        <div className="pub-panel pub-muted" style={{ textAlign: 'center', padding: '2rem 1.2rem' }}>
          <Icon name="users" size={36} style={{ color: 'var(--text-dim)' }} />
          <div className="anton" style={{ fontSize: '1.3rem', marginTop: '.5rem', color: 'var(--text)' }}>Live only</div>
          <p style={{ marginTop: '.3rem' }}>Promote sign-ups and link provider/assessor logins once Supabase is connected.</p>
        </div>
      </>
    )
  }
  return <AccountsLive />
}

function AccountsLive() {
  const [profiles, setProfiles] = useState([])
  const [providers, setProviders] = useState([])
  const [assessors, setAssessors] = useState([])
  const [msg, setMsg] = useState('')
  const reload = () => Promise.all([api.listProfiles(), api.fetchProvidersAdmin(), api.fetchAssessorsAdmin()]).then(([p, pr, as]) => { setProfiles(p); setProviders(pr); setAssessors(as) })
  useEffect(() => { reload() }, [])
  const emailFor = (id) => profiles.find((p) => p.id === id)?.email
  const changeRole = async (id, role) => { try { await api.setProfileRole(id, role); setMsg('Role updated'); reload() } catch (e) { setMsg(e.message) } }
  const link = async (kind, rowId, email) => {
    const prof = await api.findProfileByEmail(email)
    if (!prof) return setMsg(`No sign-up for ${email}`)
    kind === 'p' ? await api.linkProviderAccount(rowId, prof.id) : await api.linkAssessorAccount(rowId, prof.id)
    setMsg(`Linked ${email}`); reload()
  }
  return (
    <>
      <H>Accounts</H>
      {msg && <div className="pub-panel" style={{ marginBottom: '.6rem', padding: '.6rem .8rem', fontWeight: 700, fontSize: '.85rem' }}>{msg}</div>}

      <H right={<span className="pub-chip">{profiles.length}</span>}>Sign-ups</H>
      {profiles.map((p) => {
        const pending = p.requested_role && p.role === 'customer'
        return (
          <div className="pub-panel" key={p.id} style={{ marginBottom: '.5rem', borderColor: pending ? '#4da3ff' : 'var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', alignItems: 'center' }}>
              <div className="wrapany"><div style={{ fontWeight: 800, fontSize: '.9rem' }}>{p.name || p.email || 'Anonymous'}</div><div className="pub-muted" style={{ fontSize: '.78rem' }}>{p.email ? p.email + ' · ' : ''}{p.role}</div></div>
              <select className="pub-select" style={{ width: 'auto', padding: '.35rem .5rem', fontSize: '.82rem' }} value={p.role} onChange={(e) => changeRole(p.id, e.target.value)}>
                {ROLE_OPTS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {pending && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.5rem' }}>
                <span className="pub-chip" style={{ color: '#4da3ff', borderColor: '#4da3ff' }}>wants: {p.requested_role}</span>
                <button className="pub-btn pub-btn-siren pub-btn-sm" onClick={() => changeRole(p.id, p.requested_role)}>Approve as {p.requested_role}</button>
              </div>
            )}
          </div>
        )
      })}

      <H right={<span className="pub-chip">{providers.length}</span>}>Provider accounts</H>
      {providers.map((pr) => (
        <div className="pub-panel" key={pr.id} style={{ marginBottom: '.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
            <div className="wrapany" style={{ fontWeight: 800, fontSize: '.9rem' }}>{pr.name}</div>
            {pr.profile_id ? <span className="pub-chip go">{emailFor(pr.profile_id) || 'linked'}</span> : <span className="pub-chip">unlinked</span>}
          </div>
          <div className="pub-muted" style={{ fontSize: '.78rem', marginTop: 2 }}>{areaName(pr.area)}</div>
          <LinkRow onLink={(email) => link('p', pr.id, email)} linked={!!pr.profile_id} />
        </div>
      ))}

      <H right={<span className="pub-chip">{assessors.length}</span>}>Assessor accounts</H>
      {assessors.map((a) => (
        <div className="pub-panel" key={a.id} style={{ marginBottom: '.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
            <div className="wrapany" style={{ fontWeight: 800, fontSize: '.9rem' }}>{a.name}</div>
            {a.profile_id ? <span className="pub-chip go">{emailFor(a.profile_id) || 'linked'}</span> : <span className="pub-chip">unlinked</span>}
          </div>
          <LinkRow onLink={(email) => link('a', a.id, email)} linked={!!a.profile_id} />
        </div>
      ))}
    </>
  )
}

function LinkRow({ onLink, linked }) {
  const [email, setEmail] = useState('')
  return (
    <div style={{ display: 'flex', gap: '.4rem', marginTop: '.5rem' }}>
      <input className="pub-input" style={{ padding: '.45rem .6rem', fontSize: '.85rem' }} type="email" placeholder={linked ? 'Re-link email' : "Account holder's email"} value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="pub-btn pub-btn-hazard pub-btn-sm" disabled={!email} onClick={() => { onLink(email); setEmail('') }}>{linked ? 'Re-link' : 'Link'}</button>
    </div>
  )
}
