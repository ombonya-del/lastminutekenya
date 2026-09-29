import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { useStore, sel, submitScorecard, assignAssessor } from '../data/store.js'
import { Icon, SectionH, Empty, Stat, Rag, Meter, Avatar } from '../components/ui.jsx'
import { EventLine, StatusPill, ScorecardBlock } from '../components/domain.jsx'
import { CRITERIA, scoreAssessment, BAND_META } from '../lib/scorecard.js'
import { untilLabel, clockKE } from '../lib/format.js'
import { areaName } from '../lib/geo.js'

function NotLinked() {
  return (
    <Empty icon="users" title="Account not linked yet">
      Your assessor account hasn't been linked. Ask an admin to link you under Accounts.
    </Empty>
  )
}

export function AssessorVisits() {
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
      <Link to={`/assessor/visit/${a.id}`} key={a.id} className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
        <EventLine event={event} now={s.now} />
        <div className="caption" style={{ marginTop: '.5rem' }}>“{a.concern}”</div>
        <div className="between" style={{ marginTop: '.6rem' }}>
          <StatusPill status={a.status} />
          <span className="chip brand">{pickable ? 'Pick up' : 'Open'} <Icon name="chevron" size={14} /></span>
        </div>
      </Link>
    )
  }

  return (
    <>
      <SectionH title="Your visits" />
      {active.length === 0 ? (
        <Empty icon="check" title="No active visits">Pick up a request below to start.</Empty>
      ) : active.map((a) => Card(a, false))}

      {unassigned.length > 0 && (
        <>
          <SectionH title="Awaiting assignment" />
          {unassigned.map((a) => Card(a, true))}
        </>
      )}

      {scored.length > 0 && (
        <>
          <SectionH title="Recently scored" />
          {scored.map((a) => {
            const event = sel.event(s, a.eventId)
            return (
              <div className="card" key={a.id}>
                <div className="between">
                  <div className="subtitle wrapany">{event.title}</div>
                  <Rag band={a.band} />
                </div>
                <div className="caption" style={{ marginTop: 2 }}>Scored {a.scoredAt ? clockKE(a.scoredAt) : ''} · {areaName(event.areaId)}</div>
              </div>
            )
          })}
        </>
      )}
    </>
  )
}

export function AssessorVisit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const s = useStore()
  const { assessorId } = useApp()
  const assessment = sel.assessment(s, id)

  const [answers, setAnswers] = useState(assessment?.answers || {})
  const [notes, setNotes] = useState(assessment?.notes || '')

  if (!assessment) return <Empty icon="alert" title="Visit not found" />
  const event = sel.event(s, assessment.eventId)
  const client = sel.client(s, assessment.requestedBy)

  const preview = scoreAssessment(answers)
  const alreadyScored = assessment.status === 'scored'

  const pickUp = () => assignAssessor(assessment.id, assessorId)

  const submit = () => {
    submitScorecard(assessment.id, answers, notes)
    navigate('/assessor')
  }

  const set = (cid, v) => setAnswers((a) => ({ ...a, [cid]: v }))

  return (
    <>
      <Link to="/assessor" className="chip" style={{ textDecoration: 'none', marginBottom: '.5rem' }}>
        <Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} /> Visits
      </Link>

      <div className="card">
        <EventLine event={event} now={s.now} />
        <div className="divider" />
        <div className="caption"><strong>Client:</strong> {client?.name} · {client?.phone}</div>
        <div className="caption"><strong>Booked:</strong> {event.bookedProvider}</div>
        <div className="card flat" style={{ background: 'var(--surface-2)', marginTop: '.6rem', padding: '.6rem .8rem' }}>
          <div className="caption" style={{ fontWeight: 800 }}>Reported concern</div>
          <p className="body" style={{ margin: '.2rem 0 0' }}>{assessment.concern}</p>
        </div>
      </div>

      {alreadyScored ? (
        <div style={{ marginTop: '.8rem' }}>
          <ScorecardBlock assessment={assessment} event={event} assessor={sel.assessor(s, assessment.assessorId)} />
        </div>
      ) : (
        <>
          {!assessment.assessorId && (
            <button className="btn btn-dark" style={{ marginTop: '.8rem' }} onClick={pickUp}>Assign this visit to me</button>
          )}

          <SectionH title="Scorecard" />
          <p className="caption" style={{ margin: '-.3rem .2rem .5rem' }}>Rate what you see and hear on site. The score and RAG band update live.</p>

          {CRITERIA.map((c) => (
            <div className="card" key={c.id} style={{ marginBottom: '.7rem' }}>
              <div className="between">
                <div className="subtitle" style={{ fontSize: '.98rem' }}>{c.label}</div>
                {c.critical && <span className="chip" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>critical</span>}
              </div>
              <div className="caption" style={{ margin: '.2rem 0 .5rem' }}>{c.help}</div>
              <div style={{ display: 'grid', gap: '.4rem' }}>
                {c.options.map((o) => (
                  <button key={o.value} className={`optionbtn ${answers[c.id] === o.value ? 'on' : ''}`} onClick={() => set(c.id, o.value)}>
                    <span style={{
                      width: 10, height: 10, borderRadius: 10, flex: 'none',
                      background: o.value === 0 ? 'var(--red)' : o.value === 1 ? 'var(--amber)' : o.value === 2 ? '#8aa' : 'var(--green)',
                    }} />
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="field">
            <label>Field notes (goes into the client's report)</label>
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="What you observed, who you spoke to, and your recommendation..." />
          </div>

          <div className="card" style={{ marginTop: '.8rem', position: 'sticky', bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 8px)' }}>
            <div className="between">
              <div>
                <div className="caption" style={{ fontWeight: 800 }}>Live band</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginTop: 2 }}>
                  <span style={{ fontFamily: 'Lora, serif', fontSize: '1.5rem', fontWeight: 700,
                    color: `var(--${preview.band === 'amber' ? 'amber' : preview.band})` }}>{preview.score}</span>
                  <Rag band={preview.band} />
                </div>
              </div>
              <div style={{ width: 120 }}><Meter value={preview.score} band={preview.band} /></div>
            </div>
            <button className="btn btn-primary" style={{ marginTop: '.7rem' }} disabled={!preview.complete} onClick={submit}>
              {preview.complete ? 'Submit scorecard & alert network' : `Rate all ${CRITERIA.length} criteria`}
            </button>
            {preview.band !== 'green' && preview.complete && (
              <p className="caption" style={{ textAlign: 'center', marginTop: '.5rem' }}>
                Submitting will {preview.band === 'red' ? 'open a rescue job and ' : ''}put nearby providers on standby.
              </p>
            )}
          </div>
        </>
      )}
    </>
  )
}

export function AssessorAccount() {
  const s = useStore()
  const { assessorId, setAssessorId, live } = useApp()
  const me = sel.assessor(s, assessorId)
  if (!me) return <NotLinked />
  const done = s.assessments.filter((a) => a.assessorId === assessorId && a.status === 'scored').length

  return (
    <>
      <SectionH title="Assessor account" />
      <div className="card">
        <div className="row" style={{ alignItems: 'center' }}>
          <Avatar name={me.name} size={48} />
          <div className="grow">
            <div className="subtitle">{me.name}</div>
            <div className="caption">Based in {areaName(me.areaId)} · {me.phone}</div>
          </div>
        </div>
        <div className="stats" style={{ marginTop: '.7rem', gridTemplateColumns: 'repeat(3,1fr)' }}>
          <Stat n={me.visits} l="Visits" />
          <Stat n={`★ ${me.rating}`} l="Rating" />
          <Stat n={done} l="This session" />
        </div>
      </div>

      {!live && (
        <>
          <SectionH title="Switch demo assessor" />
          <div style={{ display: 'grid', gap: '.5rem' }}>
            {s.assessors.map((a) => (
              <button key={a.id} className="card flat" onClick={() => setAssessorId(a.id)}
                style={{ textAlign: 'left', cursor: 'pointer', borderColor: a.id === assessorId ? 'var(--brand-2)' : 'var(--line)' }}>
                <div className="row" style={{ alignItems: 'center' }}>
                  <Avatar name={a.name} size={38} />
                  <div className="grow">
                    <div className="subtitle" style={{ fontSize: '.95rem' }}>{a.name}</div>
                    <div className="caption">{areaName(a.areaId)} · ★ {a.rating}</div>
                  </div>
                  {a.id === assessorId && <Icon name="check" size={18} style={{ color: 'var(--brand-2)' }} />}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
