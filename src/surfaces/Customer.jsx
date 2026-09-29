import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { useStore, sel, requestAssessment, raiseSOS } from '../data/store.js'
import { Icon, SectionH, Empty, Rag, Turnstile, turnstileEnabled } from '../components/ui.jsx'
import { EventLine, StatusPill, ScorecardBlock } from '../components/domain.jsx'
import { CATEGORIES, catLabel, catIcon, untilLabel } from '../lib/format.js'
import { supabaseEnabled } from '../lib/supabase.js'
import { updateMyProfile } from '../lib/auth.js'

export function CustomerHome() {
  const s = useStore()
  const { clientId } = useApp()
  const myEvents = s.events.filter((e) => e.clientId === clientId)

  return (
    <>
      <section className="hero">
        <span className="kicker">When a provider goes quiet</span>
        <h1>Don't let the event die.</h1>
        <p>
          If your caterer, tent guy or DJ has gone silent hours before the big day, the Last Minute
          Network steps in — vetted providers on standby across Nairobi, ready to save the day.
        </p>
        <Link to="/customer/help" className="btn btn-primary" style={{ width: 'auto', display: 'inline-flex' }}>
          <Icon name="alert" size={18} /> Get help now
        </Link>
      </section>

      <div className="card flat" style={{ marginTop: '.8rem', display: 'flex', gap: '.7rem', alignItems: 'center' }}>
        <Icon name="home" size={22} style={{ color: 'var(--brand)' }} />
        <div className="grow">
          <div className="subtitle" style={{ fontSize: '.95rem' }}>Install LastMinuteKE</div>
          <div className="caption">Add to your home screen — works offline, one tap to raise an SOS.</div>
        </div>
      </div>

      <SectionH title="Your events" />
      {myEvents.length === 0 ? (
        <Empty icon="clock" title="No events yet">Add an event to get proactive cover.</Empty>
      ) : (
        myEvents.map((e) => {
          const a = sel.assessmentForEvent(s, e.id)
          const job = s.sosJobs.find((j) => j.eventId === e.id && j.status !== 'resolved')
          return (
            <div className="card" key={e.id}>
              <EventLine event={e} now={s.now} />
              <div className="chiprow" style={{ marginTop: '.7rem' }}>
                {a && a.status === 'scored' && <Rag band={a.band} />}
                {a && a.status !== 'scored' && <StatusPill status={a.status} />}
                {job && <span className="chip" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>Rescue active</span>}
                {!a && !job && <span className="chip">No cover yet</span>}
              </div>
              {(a || job) && (
                <Link to="/customer/requests" className="btn btn-ghost btn-sm" style={{ marginTop: '.7rem' }}>
                  View status <Icon name="chevron" size={16} />
                </Link>
              )}
            </div>
          )
        })
      )}
    </>
  )
}

export function CustomerHelp() {
  const s = useStore()
  const { clientId } = useApp()
  const myEvents = s.events.filter((e) => e.clientId === clientId)
  const [mode, setMode] = useState('sos') // 'sos' | 'assess'
  const [eventId, setEventId] = useState(myEvents[0]?.id || '')
  const [category, setCategory] = useState(myEvents[0]?.category || 'catering')
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')
  const [done, setDone] = useState(null)

  const needToken = supabaseEnabled && turnstileEnabled

  const submit = () => {
    // Live mode: save the caller's name/phone onto their (anonymous) profile so
    // providers have a callback number. No effect in seed mode.
    if (supabaseEnabled && (name || phone)) updateMyProfile({ name, phone })
    if (mode === 'sos') {
      raiseSOS({ eventId, category, note, turnstileToken: token })
      setDone('sos')
    } else {
      requestAssessment({ eventId, concern: note, requestedBy: clientId, turnstileToken: token })
      setDone('assess')
    }
    setNote('')
    setToken('')
  }

  if (done) {
    return (
      <div className="card pad-lg" style={{ textAlign: 'center', marginTop: '1rem' }}>
        <div className="avatar" style={{ background: 'var(--green)', margin: '0 auto .6rem', width: 52, height: 52 }}>
          <Icon name="check" size={26} style={{ color: '#fff' }} />
        </div>
        <h2 className="title" style={{ fontFamily: 'Lora, serif' }}>
          {done === 'sos' ? 'Network alerted' : 'Assessor on the way'}
        </h2>
        <p className="body" style={{ marginTop: '.4rem' }}>
          {done === 'sos'
            ? 'We have pinged the nearest capable providers. You will see who responds under Requests.'
            : 'A Site Assessor will visit, talk to everyone, and send you a Red / Amber / Green scorecard.'}
        </p>
        <Link to="/customer/requests" className="btn btn-primary" style={{ marginTop: '.8rem' }}>
          Track it <Icon name="chevron" size={18} />
        </Link>
        <button className="btn btn-ghost" style={{ marginTop: '.5rem' }} onClick={() => setDone(null)}>
          Raise another
        </button>
      </div>
    )
  }

  return (
    <>
      <SectionH title="How can we help?" />
      <div className="optiongrid">
        <button className={`optionbtn ${mode === 'sos' ? 'on' : ''}`} onClick={() => setMode('sos')}>
          <Icon name="alert" size={18} /> Provider flopped
        </button>
        <button className={`optionbtn ${mode === 'assess' ? 'on' : ''}`} onClick={() => setMode('assess')}>
          <Icon name="shield" size={18} /> I have doubts
        </button>
      </div>

      <div className="card" style={{ marginTop: '.8rem' }}>
        <p className="body" style={{ margin: 0 }}>
          {mode === 'sos'
            ? 'Your booked provider has gone dark or can’t deliver. We’ll alert and dispatch a replacement immediately.'
            : 'You are not sure your provider can pull it off. We’ll send a Site Assessor to check in person and warm up backups just in case.'}
        </p>

        {supabaseEnabled && (
          <>
            <div className="field">
              <label>Your name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wanjiru Kamau" />
            </div>
            <div className="field">
              <label>Phone providers can call</label>
              <input className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0720 111 222" />
            </div>
          </>
        )}

        <div className="field">
          <label>Which event?</label>
          <select className="select" value={eventId} onChange={(e) => {
            setEventId(e.target.value)
            const ev = myEvents.find((x) => x.id === e.target.value)
            if (ev) setCategory(ev.category)
          }}>
            {myEvents.map((e) => (
              <option key={e.id} value={e.id}>{e.title} · {untilLabel(e.startsAt, s.now)}</option>
            ))}
          </select>
        </div>

        {mode === 'sos' && (
          <div className="field">
            <label>What do you need?</label>
            <div className="optiongrid">
              {Object.entries(CATEGORIES).map(([id, c]) => (
                <button key={id} className={`optionbtn ${category === id ? 'on' : ''}`} onClick={() => setCategory(id)}>
                  <span>{c.icon}</span> {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <label>{mode === 'sos' ? 'Tell us the situation' : 'What worries you?'}</label>
          <textarea
            className="textarea"
            placeholder={mode === 'sos'
              ? 'e.g. Caterer stopped answering, 80 guests arriving at 4pm...'
              : 'e.g. Tent company sounded disorganised and keeps changing the plan...'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {needToken && <Turnstile onToken={setToken} />}

        <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={submit} disabled={!eventId || (needToken && !token)}>
          {mode === 'sos' ? 'Raise SOS to the network' : 'Request a Site Assessor'}
        </button>
        <p className="caption" style={{ textAlign: 'center', marginTop: '.6rem' }}>
          Protected by RLS{needToken ? ' + anti-spam' : ''} · we never share your details until you engage a provider.
        </p>
      </div>
    </>
  )
}

export function CustomerRequests() {
  const s = useStore()
  const { clientId } = useApp()
  const myEventIds = s.events.filter((e) => e.clientId === clientId).map((e) => e.id)
  const myAssessments = s.assessments.filter((a) => myEventIds.includes(a.eventId))
  const myJobs = s.sosJobs.filter((j) => myEventIds.includes(j.eventId))

  if (myAssessments.length === 0 && myJobs.length === 0) {
    return <Empty icon="clipboard" title="Nothing here yet">Requests and scorecards will show up here.</Empty>
  }

  return (
    <>
      {myJobs.length > 0 && <SectionH title="Rescue jobs" />}
      {myJobs.map((j) => {
        const event = sel.event(s, j.eventId)
        const provider = j.acceptedBy ? sel.provider(s, j.acceptedBy) : null
        return (
          <div className="card" key={j.id}>
            <div className="between">
              <div className="subtitle wrapany">{catIcon(j.category)} {catLabel(j.category)} rescue</div>
              <StatusPill status={j.status} />
            </div>
            <div className="caption" style={{ marginTop: 2 }}>{event.title}</div>
            {provider ? (
              <div className="card flat" style={{ background: 'var(--green-bg)', marginTop: '.7rem', padding: '.7rem .8rem' }}>
                <div className="subtitle" style={{ fontSize: '.95rem' }}>✅ {provider.name} is on it</div>
                <div className="caption">{provider.lead} · {provider.phone} · ~{provider.responseMins} min away</div>
              </div>
            ) : (
              <p className="body" style={{ marginTop: '.5rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                <span className="live" /> Alerting nearby providers…
              </p>
            )}
          </div>
        )
      })}

      {myAssessments.length > 0 && <SectionH title="Assessments" />}
      {myAssessments.map((a) => {
        const event = sel.event(s, a.eventId)
        const assessor = a.assessorId ? sel.assessor(s, a.assessorId) : null
        if (a.status === 'scored') {
          return <div key={a.id} style={{ marginBottom: '.8rem' }}><ScorecardBlock assessment={a} event={event} assessor={assessor} /></div>
        }
        return (
          <div className="card" key={a.id}>
            <div className="between">
              <div className="subtitle wrapany">{event.title}</div>
              <StatusPill status={a.status} />
            </div>
            <div className="caption" style={{ marginTop: 2 }}>“{a.concern}”</div>
            <p className="body" style={{ marginTop: '.5rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
              <span className="live" style={{ background: 'var(--amber)' }} />
              {assessor ? `${assessor.name} is heading to the venue…` : 'Assigning a Site Assessor…'}
            </p>
          </div>
        )
      })}
    </>
  )
}
