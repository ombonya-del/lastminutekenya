import { useState, useEffect } from 'react'
import { useStore, sel, assignAssessor, acceptSOS, resolveSOS } from '../data/store.js'
import { Icon, SectionH, Empty, Stat, Rag, Avatar } from '../components/ui.jsx'
import { EventLine, StatusPill, ScorecardBlock, ProviderRow, AlertCard, ReadinessDot } from '../components/domain.jsx'
import { matchProviders } from '../lib/matching.js'
import { catLabel, catIcon, kes, untilLabel, timeAgo } from '../lib/format.js'
import { AREAS, areaName } from '../lib/geo.js'
import { supabaseEnabled } from '../lib/supabase.js'
import * as api from '../data/api.js'

export function AdminOverview() {
  const s = useStore()
  const openJobs = s.sosJobs.filter((j) => j.status !== 'resolved')
  const scored = s.assessments.filter((a) => a.status === 'scored')
  const atRisk = scored.filter((a) => a.band !== 'green')
  const ready = s.providers.filter((p) => p.readiness === 'ready')
  const acked = s.alertsLog.filter((a) => a.acknowledged).length

  return (
    <>
      <div className="hero">
        <span className="kicker">Operations · Saturday shift</span>
        <h1>Network command</h1>
        <p>Every scorecard, rescue and alert across Nairobi in one view.</p>
      </div>

      <div className="stats" style={{ marginTop: '.8rem' }}>
        <Stat n={openJobs.length} l="Open rescues" band={openJobs.length ? 'red' : null} sub="need a provider" />
        <Stat n={atRisk.length} l="At-risk events" band="amber" sub="amber + red" />
        <Stat n={`${ready.length}/${s.providers.length}`} l="Providers ready" band="green" />
        <Stat n={`${acked}/${s.alertsLog.length}`} l="Alerts ack'd" sub="pre-dispatch" />
      </div>

      <SectionH title="Live dispatch" action={<span className="chip brand">{openJobs.length}</span>} />
      {openJobs.length === 0 ? (
        <Empty icon="check" title="No active rescues" />
      ) : openJobs.map((j) => {
        const event = sel.event(s, j.eventId)
        const provider = j.acceptedBy ? sel.provider(s, j.acceptedBy) : null
        return (
          <div className="card" key={j.id}>
            <div className="between">
              <div className="subtitle wrapany">{catIcon(j.category)} {catLabel(j.category)} · {areaName(event.areaId)}</div>
              <StatusPill status={j.status} />
            </div>
            <div className="caption" style={{ marginTop: 2 }}>{event.title} · {untilLabel(event.startsAt, s.now)}</div>
            {provider && <div className="caption" style={{ color: 'var(--green)', marginTop: 4 }}>✅ {provider.name} accepted</div>}
          </div>
        )
      })}

      <SectionH title="Recent scorecards" />
      {scored.slice(0, 3).map((a) => {
        const event = sel.event(s, a.eventId)
        return (
          <div className="card" key={a.id}>
            <div className="between">
              <div className="grow">
                <div className="subtitle wrapany">{event.title}</div>
                <div className="caption">{areaName(event.areaId)} · score {a.score}</div>
              </div>
              <Rag band={a.band} />
            </div>
          </div>
        )
      })}
    </>
  )
}

export function AdminScorecards() {
  const s = useStore()
  return (
    <>
      <SectionH title="All scorecards & assessments" />
      {s.assessments.map((a) => {
        const event = sel.event(s, a.eventId)
        const client = sel.client(s, a.requestedBy)
        const assessor = a.assessorId ? sel.assessor(s, a.assessorId) : null
        if (a.status === 'scored') {
          return (
            <div key={a.id} style={{ marginBottom: '.8rem' }}>
              <div className="caption" style={{ margin: '0 .2rem .3rem' }}>{event.title} · {client?.name}</div>
              <ScorecardBlock assessment={a} event={event} assessor={assessor} />
            </div>
          )
        }
        return (
          <div className="card" key={a.id}>
            <EventLine event={event} now={s.now} />
            <div className="caption" style={{ marginTop: '.4rem' }}>“{a.concern}” — {client?.name}</div>
            <div className="between" style={{ marginTop: '.6rem' }}>
              <StatusPill status={a.status} />
              <AssignControl assessment={a} assessors={s.assessors} />
            </div>
          </div>
        )
      })}
    </>
  )
}

function AssignControl({ assessment, assessors }) {
  const [val, setVal] = useState(assessment.assessorId || '')
  if (assessment.assessorId) {
    const who = assessors.find((a) => a.id === assessment.assessorId)
    return <span className="chip">Assessor: {who?.name}</span>
  }
  return (
    <div style={{ display: 'flex', gap: '.4rem' }}>
      <select className="select" style={{ padding: '.35rem .5rem', width: 'auto', fontSize: '.82rem' }}
        value={val} onChange={(e) => setVal(e.target.value)}>
        <option value="">Assign…</option>
        {assessors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <button className="btn btn-dark btn-sm" disabled={!val} onClick={() => assignAssessor(assessment.id, val)}>Go</button>
    </div>
  )
}

export function AdminDispatch() {
  const s = useStore()
  const openJobs = s.sosJobs.filter((j) => j.status !== 'resolved')

  return (
    <>
      <SectionH title="Dispatch board" />
      {openJobs.length === 0 ? <Empty icon="check" title="No open rescues" /> : openJobs.map((j) => {
        const event = sel.event(s, j.eventId)
        const ranked = matchProviders(s.providers, { category: j.category, coord: event.coord, guests: event.guests }).slice(0, 3)
        return (
          <div className="card" key={j.id}>
            <div className="between">
              <div className="subtitle wrapany">{catIcon(j.category)} {catLabel(j.category)} · {areaName(event.areaId)}</div>
              <StatusPill status={j.status} />
            </div>
            <div className="caption" style={{ marginTop: 2 }}>{event.title} · {event.guests} guests · {untilLabel(event.startsAt, s.now)}</div>
            {j.note && <p className="body" style={{ marginTop: '.4rem' }}>{j.note}</p>}
            <div className="divider" />
            <div className="caption" style={{ fontWeight: 800, marginBottom: '.4rem' }}>Top matched providers</div>
            {ranked.map((m) => (
              <ProviderRow key={m.provider.id} provider={m.provider} match={m}
                right={j.acceptedBy === m.provider.id
                  ? <span className="chip" style={{ color: 'var(--green)', borderColor: 'var(--green)' }}>Accepted</span>
                  : <button className="btn btn-dark btn-sm" onClick={() => acceptSOS(j.id, m.provider.id)}>Dispatch</button>} />
            ))}
            {j.acceptedBy && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: '.7rem' }} onClick={() => resolveSOS(j.id)}>Mark resolved</button>
            )}
          </div>
        )
      })}

      <SectionH title="Pre-dispatch alert log" action={<span className="chip brand">{s.alertsLog.length}</span>} />
      <p className="caption" style={{ margin: '-.3rem .2rem .6rem' }}>Advisory alerts fired to warm up the network before rescue calls land.</p>
      <div style={{ display: 'grid', gap: '.7rem' }}>
        {s.alertsLog.map((a) => <AlertCard key={a.id} alert={a} now={s.now} showProvider />)}
      </div>
    </>
  )
}

export function AdminNetwork() {
  const s = useStore()
  return (
    <>
      <SectionH title="Coverage map" />
      <NetworkMap providers={s.providers} events={s.events} />

      <SectionH title={`Providers (${s.providers.length})`} />
      {s.providers.map((p) => (
        <div className="card" key={p.id}><ProviderRow provider={p} right={<ReadinessDot readiness={p.readiness} />} /></div>
      ))}

      <SectionH title={`Assessors (${s.assessors.length})`} />
      {s.assessors.map((a) => (
        <div className="card" key={a.id}>
          <div className="row" style={{ alignItems: 'center' }}>
            <Avatar name={a.name} size={38} />
            <div className="grow">
              <div className="subtitle" style={{ fontSize: '.95rem' }}>{a.name}</div>
              <div className="caption">{areaName(a.areaId)} · {a.visits} visits · ★ {a.rating}</div>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

// A lightweight bespoke scatter "map" of the service area — no tiles, just the
// relative geography of providers (navy) and live events (orange).
function NetworkMap({ providers, events }) {
  const pts = [...providers.map((p) => ({ ...p.base, kind: 'p', label: p.name })),
    ...events.map((e) => ({ ...e.coord, kind: 'e', label: e.title }))]
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const W = 100, H = 78, pad = 8
  const x = (lng) => pad + ((lng - minLng) / (maxLng - minLng || 1)) * (W - 2 * pad)
  const y = (lat) => pad + ((maxLat - lat) / (maxLat - minLat || 1)) * (H - 2 * pad)

  return (
    <div className="card" style={{ padding: '.8rem' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Coverage map of providers and events">
        <rect x="0" y="0" width={W} height={H} rx="4" fill="var(--surface-2)" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(p.lng)} cy={y(p.lat)} r={p.kind === 'e' ? 2.6 : 2}
              fill={p.kind === 'e' ? 'var(--brand-2)' : 'var(--brand)'} opacity={p.kind === 'e' ? 1 : 0.85} />
            {p.kind === 'e' && <circle cx={x(p.lng)} cy={y(p.lat)} r="5" fill="none" stroke="var(--brand-2)" strokeWidth="0.6" opacity="0.6" />}
          </g>
        ))}
      </svg>
      <div className="chiprow" style={{ marginTop: '.6rem' }}>
        <span className="chip"><span style={{ width: 8, height: 8, borderRadius: 8, background: 'var(--brand)' }} /> Providers</span>
        <span className="chip"><span style={{ width: 8, height: 8, borderRadius: 8, background: 'var(--brand-2)' }} /> Live events</span>
      </div>
    </div>
  )
}

// ---- Accounts (admin): promote sign-ups & link catalog rows to logins -------
const ROLE_OPTS = ['customer', 'provider', 'assessor', 'admin']

export function AdminAccounts() {
  if (!supabaseEnabled) {
    return (
      <>
        <SectionH title="Accounts" />
        <Empty icon="users" title="Available once Supabase is connected">
          This screen promotes people who sign up to provider, assessor or admin, and links
          provider/assessor listings to their login. It needs the live backend — set your env
          and it activates here.
        </Empty>
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

  const reload = () =>
    Promise.all([api.listProfiles(), api.fetchProvidersAdmin(), api.fetchAssessorsAdmin()]).then(
      ([p, pr, as]) => {
        setProfiles(p)
        setProviders(pr)
        setAssessors(as)
      }
    )
  useEffect(() => { reload() }, [])

  const emailFor = (profileId) => profiles.find((p) => p.id === profileId)?.email

  const changeRole = async (id, role) => {
    try { await api.setProfileRole(id, role); setMsg('Role updated'); reload() }
    catch (e) { setMsg('Could not update role: ' + e.message) }
  }
  const linkProvider = async (providerId, email) => {
    const prof = await api.findProfileByEmail(email)
    if (!prof) return setMsg(`No sign-up found for ${email}`)
    await api.linkProviderAccount(providerId, prof.id)
    setMsg(`Linked ${email}`); reload()
  }
  const linkAssessor = async (assessorId, email) => {
    const prof = await api.findProfileByEmail(email)
    if (!prof) return setMsg(`No sign-up found for ${email}`)
    await api.linkAssessorAccount(assessorId, prof.id)
    setMsg(`Linked ${email}`); reload()
  }

  return (
    <>
      <SectionH title="Accounts" />
      {msg && (
        <div className="card flat" style={{ background: 'var(--surface-2)', marginBottom: '.6rem' }}>
          <span className="caption" style={{ fontWeight: 700 }}>{msg}</span>
        </div>
      )}

      <SectionH title={`Sign-ups (${profiles.length})`} />
      <p className="caption" style={{ margin: '-.3rem .2rem .5rem' }}>Promote a person to a role. Everyone starts as a customer.</p>
      {profiles.map((p) => {
        const pending = p.requested_role && p.role === 'customer'
        return (
          <div className="card" key={p.id} style={pending ? { borderColor: 'var(--brand-2)' } : null}>
            <div className="row" style={{ alignItems: 'center' }}>
              <Avatar name={p.name || p.email || 'Guest'} size={36} />
              <div className="grow">
                <div className="subtitle wrapany" style={{ fontSize: '.92rem' }}>{p.name || p.email || 'Anonymous'}</div>
                <div className="caption wrapany">{p.email ? p.email + ' · ' : ''}role: {p.role}</div>
              </div>
              <select className="select" style={{ width: 'auto', padding: '.35rem .5rem', fontSize: '.82rem' }}
                value={p.role} onChange={(e) => changeRole(p.id, e.target.value)}>
                {ROLE_OPTS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {pending && (
              <div className="between" style={{ marginTop: '.6rem' }}>
                <span className="chip" style={{ color: 'var(--brand-2-ink)', borderColor: 'var(--brand-2)' }}>
                  requested: {p.requested_role}
                </span>
                <button className="btn btn-primary btn-sm" onClick={() => changeRole(p.id, p.requested_role)}>
                  Approve as {p.requested_role}
                </button>
              </div>
            )}
          </div>
        )
      })}

      <SectionH title={`Provider accounts (${providers.length})`} />
      {providers.map((pr) => (
        <div className="card" key={pr.id}>
          <div className="between">
            <div className="subtitle wrapany" style={{ fontSize: '.95rem' }}>{pr.name}</div>
            {pr.profile_id
              ? <span className="chip" style={{ color: 'var(--green)', borderColor: 'var(--green)' }}><Icon name="check" size={13} /> {emailFor(pr.profile_id) || 'linked'}</span>
              : <span className="chip">unlinked</span>}
          </div>
          <div className="caption" style={{ marginTop: 2 }}>{areaName(pr.area)} · {(pr.categories || []).map(catLabel).join(', ')}</div>
          <LinkByEmail onLink={(email) => linkProvider(pr.id, email)} linked={!!pr.profile_id} />
        </div>
      ))}

      <SectionH title={`Assessor accounts (${assessors.length})`} />
      {assessors.map((a) => (
        <div className="card" key={a.id}>
          <div className="between">
            <div className="subtitle wrapany" style={{ fontSize: '.95rem' }}>{a.name}</div>
            {a.profile_id
              ? <span className="chip" style={{ color: 'var(--green)', borderColor: 'var(--green)' }}><Icon name="check" size={13} /> {emailFor(a.profile_id) || 'linked'}</span>
              : <span className="chip">unlinked</span>}
          </div>
          <div className="caption" style={{ marginTop: 2 }}>{areaName(a.area)}</div>
          <LinkByEmail onLink={(email) => linkAssessor(a.id, email)} linked={!!a.profile_id} />
        </div>
      ))}
    </>
  )
}

function LinkByEmail({ onLink, linked }) {
  const [email, setEmail] = useState('')
  return (
    <div style={{ display: 'flex', gap: '.4rem', marginTop: '.6rem' }}>
      <input className="input" style={{ padding: '.45rem .6rem', fontSize: '.85rem' }}
        type="email" placeholder={linked ? 'Re-link to another email' : "Account holder's email"}
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn btn-dark btn-sm" disabled={!email} onClick={() => { onLink(email); setEmail('') }}>
        {linked ? 'Re-link' : 'Link'}
      </button>
    </div>
  )
}
