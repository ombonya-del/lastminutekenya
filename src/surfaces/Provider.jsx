import { useApp } from '../App.jsx'
import { useStore, sel, setReadiness, acknowledgeAlert, acceptSOS } from '../data/store.js'
import { Icon, SectionH, Empty, Stat } from '../components/ui.jsx'
import { AlertCard, ReadinessDot, ProviderRow } from '../components/domain.jsx'
import { matchProviders } from '../lib/matching.js'
import { catLabel, catIcon, kes, untilLabel } from '../lib/format.js'
import { areaName } from '../lib/geo.js'

function useProvider() {
  const s = useStore()
  const { providerId, live } = useApp()
  return { s, provider: sel.provider(s, providerId), providerId, live }
}

function NotLinked() {
  return (
    <Empty icon="users" title="Account not linked yet">
      Your provider account hasn't been linked to a catalog listing. Ask an admin to link you under Accounts.
    </Empty>
  )
}

// Jobs this provider can serve (category match, still open).
function jobsForProvider(s, provider) {
  return s.sosJobs
    .filter((j) => j.status !== 'resolved' && provider.categories.includes(j.category))
    .map((j) => {
      const event = sel.event(s, j.eventId)
      const ranked = matchProviders(s.providers, { category: j.category, coord: event.coord, guests: event.guests })
      const match = ranked.find((r) => r.provider.id === provider.id)
      return { job: j, event, match }
    })
}

export function ProviderHome() {
  const { s, provider, providerId } = useProvider()
  if (!provider) return <NotLinked />
  const alerts = s.alertsLog.filter((a) => a.providerId === providerId)
  const unread = alerts.filter((a) => !a.acknowledged)
  const jobs = jobsForProvider(s, provider)

  return (
    <>
      <div className="hero">
        <span className="kicker">Last Minute Network</span>
        <h1>{provider.name}</h1>
        <p>Intelligence-led rescue. We warm you up <em>before</em> the call comes, so you arrive first.</p>
        <div className="chiprow">
          <ReadinessDot readiness={provider.readiness} />
          <span className="chip">{provider.categories.map(catLabel).join(' · ')}</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: '.8rem' }}>
        <div className="between">
          <div className="subtitle">Your readiness</div>
          <ReadinessDot readiness={provider.readiness} />
        </div>
        <p className="caption" style={{ margin: '.3rem 0 .6rem' }}>
          Ready providers are alerted first and rank higher in matches.
        </p>
        <div className="optiongrid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          {[['ready', 'Ready'], ['busy', 'Busy'], ['off', 'Offline']].map(([v, label]) => (
            <button key={v} className={`optionbtn ${provider.readiness === v ? 'on' : ''}`}
              style={{ justifyContent: 'center' }} onClick={() => setReadiness(providerId, v)}>{label}</button>
          ))}
        </div>
      </div>

      <SectionH title="Pre-dispatch intelligence" action={unread.length ? <span className="chip brand">{unread.length} new</span> : null} />
      <p className="caption" style={{ margin: '-.3rem .2rem .5rem' }}>
        Advisory alerts about interventions that may be needed near you. Confirm readiness — a rescue call may follow.
      </p>
      {alerts.length === 0 ? (
        <Empty icon="spark" title="No alerts right now">We'll ping you when something moves in your area.</Empty>
      ) : (
        <div style={{ display: 'grid', gap: '.7rem' }}>
          {alerts.map((a) => (
            <AlertCard key={a.id} alert={a} now={s.now} onAck={() => acknowledgeAlert(a.id)} />
          ))}
        </div>
      )}

      {jobs.length > 0 && (
        <>
          <SectionH title="Open rescues you can take" />
          {jobs.slice(0, 2).map(({ job, event, match }) => (
            <JobCard key={job.id} job={job} event={event} match={match} provider={provider} s={s} />
          ))}
        </>
      )}
    </>
  )
}

function JobCard({ job, event, match, provider, s }) {
  const takenByOther = job.status === 'accepted' && job.acceptedBy !== provider.id
  const mine = job.acceptedBy === provider.id
  return (
    <div className="card" style={{ borderColor: mine ? 'var(--green)' : 'var(--line)' }}>
      <div className="between">
        <div className="subtitle wrapany">{catIcon(job.category)} {catLabel(job.category)} · {areaName(event.areaId)}</div>
        <span className="chip brand mono">{untilLabel(event.startsAt, s.now)}</span>
      </div>
      <div className="caption" style={{ marginTop: 2 }}>{event.venue} · {event.guests} guests · budget {kes(event.budget)}</div>
      {job.note && <p className="body" style={{ marginTop: '.5rem' }}>{job.note}</p>}
      <div className="chiprow" style={{ marginTop: '.5rem' }}>
        {match && <span className="chip brand">Your match {match.score}</span>}
        {match && match.reasons.slice(0, 2).map((r, i) => <span className="chip" key={i}>{r}</span>)}
      </div>
      <div style={{ marginTop: '.7rem' }}>
        {mine ? (
          <div className="chip" style={{ color: 'var(--green)', borderColor: 'var(--green)' }}><Icon name="check" size={14} /> You accepted — client notified</div>
        ) : takenByOther ? (
          <div className="chip">Taken by another provider</div>
        ) : (
          <button className="btn btn-primary" onClick={() => acceptSOS(job.id, provider.id)}>Accept rescue</button>
        )}
      </div>
    </div>
  )
}

export function ProviderJobs() {
  const { s, provider } = useProvider()
  if (!provider) return <NotLinked />
  const jobs = jobsForProvider(s, provider)
  return (
    <>
      <SectionH title="Rescue board" />
      <p className="caption" style={{ margin: '-.3rem .2rem .6rem' }}>Live jobs matched to {provider.name}'s services.</p>
      {jobs.length === 0 ? (
        <Empty icon="check" title="No open rescues">You're all caught up. Stay ready.</Empty>
      ) : (
        jobs.map(({ job, event, match }) => (
          <JobCard key={job.id} job={job} event={event} match={match} provider={provider} s={s} />
        ))
      )}
    </>
  )
}

export function ProviderProfile() {
  const { s, provider, providerId, live } = useProvider()
  const { setProviderId } = useApp()
  if (!provider) return <NotLinked />
  const acked = s.alertsLog.filter((a) => a.providerId === providerId && a.acknowledged).length
  return (
    <>
      <SectionH title="Provider profile" />
      <div className="card">
        <ProviderRow provider={provider} right={<ReadinessDot readiness={provider.readiness} />} />
        <p className="body" style={{ marginTop: '.6rem' }}>{provider.blurb}</p>
        <div className="stats" style={{ marginTop: '.7rem', gridTemplateColumns: 'repeat(2,1fr)' }}>
          <Stat n={provider.jobsDone} l="Jobs done" />
          <Stat n={`★ ${provider.rating.toFixed(1)}`} l="Rating" />
          <Stat n={provider.capacity} l="Capacity" sub="max guests/units" />
          <Stat n={`${provider.responseMins}m`} l="Response" sub="typical" />
        </div>
        <div className="chiprow" style={{ marginTop: '.7rem' }}>
          {Object.entries(provider.channels).filter(([, v]) => v).map(([c]) => (
            <span className="chip" key={c}>{c}{provider.preferredChannel === c ? ' ·  preferred' : ''}</span>
          ))}
        </div>
      </div>

      {!live && (
        <>
          <SectionH title="Switch demo provider" />
          <p className="caption" style={{ margin: '-.3rem .2rem .5rem' }}>See the network from another provider's seat.</p>
          <div style={{ display: 'grid', gap: '.5rem' }}>
            {s.providers.map((p) => (
              <button key={p.id} className="card flat" onClick={() => setProviderId(p.id)}
                style={{ textAlign: 'left', cursor: 'pointer', borderColor: p.id === providerId ? 'var(--brand-2)' : 'var(--line)' }}>
                <ProviderRow provider={p} right={p.id === providerId ? <Icon name="check" size={18} style={{ color: 'var(--brand-2)' }} /> : null} />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
