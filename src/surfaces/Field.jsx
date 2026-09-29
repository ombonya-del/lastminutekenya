import { useState } from 'react'
import { Routes, Route, NavLink, Navigate, useParams, useNavigate, Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { useStore, sel, submitScorecard, assignAssessor, clearToast } from '../data/store.js'
import { Icon } from '../components/ui.jsx'
import { CRITERIA, scoreAssessment, BAND_META } from '../lib/scorecard.js'
import { untilLabel, clockKE, dayKE } from '../lib/format.js'
import { areaName } from '../lib/geo.js'

const bandColor = (b) => (b === 'red' ? 'var(--red)' : b === 'amber' ? 'var(--amber)' : 'var(--go)')

export function FieldShell({ onStaff }) {
  return (
    <div className="eco field">
      <header className="pub-top">
        <span className="beacon" style={{ background: '#ffb020', boxShadow: '0 0 0 0 rgba(255,176,32,.6)' }} />
        <div>
          <div className="pub-brand">LM <span className="ke" style={{ color: '#ffb020' }}>FIELD</span></div>
          <div className="tagline">We save the day</div>
        </div>
        <span className="aud" style={{ marginLeft: '.5rem' }}>Assessors</span>
        <div style={{ flex: 1 }} />
        <button className="pub-btn pub-btn-ghost pub-btn-sm" onClick={onStaff}><Icon name="users" size={15} /> Account</button>
      </header>
      <div className="hazard-stripe" />
      <main className="pub-main">
        <Routes>
          <Route path="/assessor" element={<FieldVisits />} />
          <Route path="/assessor/visit/:id" element={<FieldVisit />} />
          <Route path="/assessor/account" element={<FieldAccount />} />
          <Route path="*" element={<Navigate to="/assessor" replace />} />
        </Routes>
      </main>
      <nav className="pub-nav" aria-label="Primary">
        <NavLink to="/assessor" end className={({ isActive }) => (isActive ? 'active' : '')}><Icon name="clipboard" size={22} /> Visits</NavLink>
        <NavLink to="/assessor/account" className={({ isActive }) => (isActive ? 'active' : '')}><Icon name="users" size={22} /> Account</NavLink>
      </nav>
      <EcoToaster />
    </div>
  )
}

function EcoToaster() {
  const s = useStore()
  if (!s.toast) return null
  setTimeout(clearToast, 3200)
  return <div className="eco-public-toast" role="status"><span style={{ width: 10, height: 10, borderRadius: 10, background: '#ffb020' }} />{s.toast.msg}</div>
}

function NotLinked() {
  return (
    <div className="pub-panel" style={{ textAlign: 'center', marginTop: '1.5rem', padding: '2rem 1.2rem' }}>
      <Icon name="users" size={40} style={{ color: 'var(--text-dim)' }} />
      <h2 className="anton" style={{ fontSize: '1.5rem', marginTop: '.5rem' }}>Account not linked</h2>
      <p className="pub-muted" style={{ marginTop: '.3rem' }}>Ask an admin to link your login to an assessor under Command → Accounts.</p>
    </div>
  )
}

export function FieldVisits() {
  const s = useStore()
  const { assessorId, live } = useApp()
  if (live && !assessorId) return <NotLinked />
  const mine = s.assessments.filter((a) => a.assessorId === assessorId)
  const active = mine.filter((a) => a.status !== 'scored')
  const scored = mine.filter((a) => a.status === 'scored')
  const unassigned = s.assessments.filter((a) => !a.assessorId && a.status === 'requested')

  const Card = (a, pickable) => {
    const event = sel.event(s, a.eventId)
    return (
      <Link to={`/assessor/visit/${a.id}`} key={a.id} className="pub-panel" style={{ display: 'block', textDecoration: 'none', color: 'inherit', marginBottom: '.7rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
          <div className="wrapany" style={{ fontWeight: 800 }}>{event.title}</div>
          <span className="pub-chip hazard" style={{ flex: 'none' }}>{untilLabel(event.startsAt, s.now)}</span>
        </div>
        <div className="pub-muted" style={{ fontSize: '.82rem', marginTop: 2 }}>{areaName(event.areaId)} · {event.venue}</div>
        <div className="pub-muted" style={{ fontSize: '.85rem', marginTop: '.4rem' }}>“{a.concern}”</div>
        <div style={{ marginTop: '.6rem' }}><span className="pub-chip" style={{ color: 'var(--sig)', borderColor: 'var(--sig)' }}>{pickable ? 'Pick up' : 'Open'} <Icon name="chevron" size={13} /></span></div>
      </Link>
    )
  }

  return (
    <>
      <section className="pub-hero" style={{ paddingBottom: '.4rem' }}>
        <span className="kick"><span style={{ width: 7, height: 7, borderRadius: 7, background: '#000' }} /> Field assessment</span>
        <h1 className="anton" style={{ fontSize: 'clamp(2.2rem,10vw,3rem)' }}>Boots on<br />the <span className="hl" style={{ color: '#ffb020' }}>ground.</span></h1>
      </section>

      <div className="pub-h"><h2 className="anton">Your visits</h2><span className="bar" /></div>
      {active.length === 0 ? <div className="pub-panel pub-muted" style={{ textAlign: 'center' }}>No active visits. Pick one up below.</div> : active.map((a) => Card(a, false))}

      {unassigned.length > 0 && (<><div className="pub-h"><h2 className="anton">Awaiting assignment</h2><span className="bar" /></div>{unassigned.map((a) => Card(a, true))}</>)}

      {scored.length > 0 && (
        <>
          <div className="pub-h"><h2 className="anton">Recently scored</h2><span className="bar" /></div>
          {scored.map((a) => {
            const event = sel.event(s, a.eventId)
            return (
              <div className="pub-panel" key={a.id} style={{ marginBottom: '.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="wrapany"><div style={{ fontWeight: 800 }}>{event.title}</div><div className="pub-muted" style={{ fontSize: '.8rem' }}>{a.scoredAt ? clockKE(a.scoredAt) : ''} · {areaName(event.areaId)}</div></div>
                <span className="pub-rag" style={{ background: 'transparent', color: bandColor(a.band), border: `1.5px solid ${bandColor(a.band)}` }}>{a.band}</span>
              </div>
            )
          })}
        </>
      )}
    </>
  )
}

export function FieldVisit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const s = useStore()
  const { assessorId } = useApp()
  const assessment = sel.assessment(s, id)
  const [answers, setAnswers] = useState(assessment?.answers || {})
  const [notes, setNotes] = useState(assessment?.notes || '')

  if (!assessment) return <NotLinked />
  const event = sel.event(s, assessment.eventId)
  const client = sel.client(s, assessment.requestedBy)
  const preview = scoreAssessment(answers)
  const scored = assessment.status === 'scored'
  const set = (cid, v) => setAnswers((a) => ({ ...a, [cid]: v }))
  const submit = () => { submitScorecard(assessment.id, answers, notes); navigate('/assessor') }

  return (
    <>
      <Link to="/assessor" className="pub-chip" style={{ textDecoration: 'none', marginBottom: '.6rem' }}><Icon name="chevron" size={13} style={{ transform: 'rotate(180deg)' }} /> Visits</Link>

      <div className="pub-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
          <div className="wrapany" style={{ fontWeight: 800, fontSize: '1.05rem' }}>{event.title}</div>
          <span className="pub-chip hazard" style={{ flex: 'none' }}>{untilLabel(event.startsAt, s.now)}</span>
        </div>
        <div className="pub-muted" style={{ fontSize: '.82rem', marginTop: 2 }}>{areaName(event.areaId)} · {event.venue} · {dayKE(event.startsAt)} {clockKE(event.startsAt)}</div>
        <div className="pub-divider" />
        <div style={{ fontSize: '.85rem' }}><b>Client:</b> {client?.name} · {client?.phone}</div>
        <div style={{ fontSize: '.85rem' }}><b>Booked:</b> {event.bookedProvider}</div>
        <div className="pub-panel raise" style={{ marginTop: '.6rem', padding: '.6rem .8rem' }}>
          <div className="pub-muted" style={{ fontSize: '.72rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '.05em' }}>Reported concern</div>
          <p style={{ margin: '.2rem 0 0', fontSize: '.9rem' }}>{assessment.concern}</p>
        </div>
      </div>

      {scored ? (
        <div className="pub-panel" style={{ marginTop: '.8rem', borderColor: bandColor(assessment.band) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="pub-muted" style={{ fontSize: '.72rem', textTransform: 'uppercase', fontWeight: 800 }}>Scored</div>
            <span className="pub-rag" style={{ background: 'transparent', color: bandColor(assessment.band), border: `1.5px solid ${bandColor(assessment.band)}` }}>{assessment.band}</span>
          </div>
          <div className="anton" style={{ fontSize: '2.4rem', color: bandColor(assessment.band), marginTop: '.3rem' }}>{assessment.score}</div>
          <p style={{ fontSize: '.9rem' }}>{BAND_META[assessment.band].headline}</p>
          {assessment.notes && <p className="pub-muted" style={{ fontSize: '.85rem', marginTop: '.4rem' }}>{assessment.notes}</p>}
        </div>
      ) : (
        <>
          {!assessment.assessorId && <button className="pub-btn pub-btn-hazard pub-btn-block" style={{ marginTop: '.8rem' }} onClick={() => assignAssessor(assessment.id, assessorId)}>Assign this visit to me</button>}

          <div className="pub-h"><h2 className="anton">Scorecard</h2><span className="bar" /></div>
          <p className="pub-muted" style={{ margin: '-.4rem .1rem .6rem', fontSize: '.85rem' }}>Rate what you see on site. Score and band update live.</p>

          {CRITERIA.map((c) => (
            <div className="pub-panel" key={c.id} style={{ marginBottom: '.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '.95rem' }}>{c.label}</div>
                {c.critical && <span className="pub-chip siren">critical</span>}
              </div>
              <div className="pub-muted" style={{ fontSize: '.8rem', margin: '.2rem 0 .5rem' }}>{c.help}</div>
              <div style={{ display: 'grid', gap: '.35rem' }}>
                {c.options.map((o) => (
                  <button key={o.value} className={`pub-opt ${answers[c.id] === o.value ? 'on' : ''}`} onClick={() => set(c.id, o.value)}>
                    <span style={{ width: 10, height: 10, borderRadius: 10, flex: 'none', background: o.value === 0 ? 'var(--red)' : o.value === 1 ? 'var(--amber)' : o.value === 2 ? '#8aa' : 'var(--go)' }} />
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="pub-field">
            <label>Field notes (into the client report)</label>
            <textarea className="pub-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What you saw, who you spoke to, your recommendation..." />
          </div>

          <div className="pub-panel" style={{ marginTop: '.8rem', position: 'sticky', bottom: 'calc(76px + env(safe-area-inset-bottom) + 8px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="pub-muted" style={{ fontSize: '.7rem', textTransform: 'uppercase', fontWeight: 800 }}>Live band</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  <span className="anton" style={{ fontSize: '1.8rem', color: bandColor(preview.band) }}>{preview.score}</span>
                  <span className="pub-rag" style={{ background: 'transparent', color: bandColor(preview.band), border: `1.5px solid ${bandColor(preview.band)}` }}>{preview.band}</span>
                </div>
              </div>
            </div>
            <button className="pub-btn pub-btn-siren pub-btn-block" style={{ marginTop: '.6rem' }} disabled={!preview.complete} onClick={submit}>
              {preview.complete ? 'Submit & alert network' : `Rate all ${CRITERIA.length} criteria`}
            </button>
          </div>
        </>
      )}
    </>
  )
}

export function FieldAccount() {
  const s = useStore()
  const { assessorId, setAssessorId, live } = useApp()
  const me = sel.assessor(s, assessorId)
  if (!me) return <NotLinked />
  const done = s.assessments.filter((a) => a.assessorId === assessorId && a.status === 'scored').length
  return (
    <>
      <div className="pub-h" style={{ marginTop: '.8rem' }}><h2 className="anton">Account</h2><span className="bar" /></div>
      <div className="pub-panel">
        <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{me.name}</div>
        <div className="pub-muted" style={{ fontSize: '.85rem' }}>{areaName(me.areaId)} · {me.phone}</div>
        <div className="pub-stats" style={{ marginTop: '.7rem' }}>
          <div className="pub-stat"><div className="n">{me.visits}</div><div className="l">Visits</div></div>
          <div className="pub-stat"><div className="n">{me.rating}</div><div className="l">Rating</div></div>
          <div className="pub-stat go"><div className="n">{done}</div><div className="l">This session</div></div>
        </div>
      </div>
      {!live && (
        <>
          <div className="pub-h"><h2 className="anton">Switch demo assessor</h2><span className="bar" /></div>
          <div style={{ display: 'grid', gap: '.5rem' }}>
            {s.assessors.map((a) => (
              <button key={a.id} className="pub-panel" onClick={() => setAssessorId(a.id)} style={{ textAlign: 'left', cursor: 'pointer', borderColor: a.id === assessorId ? '#ffb020' : 'var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><div style={{ fontWeight: 800, fontSize: '.95rem' }}>{a.name}</div><div className="pub-muted" style={{ fontSize: '.8rem' }}>{areaName(a.areaId)} · ★ {a.rating}</div></div>
                {a.id === assessorId && <Icon name="check" size={18} style={{ color: '#ffb020' }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
