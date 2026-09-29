import { Icon, Rag, Meter, Avatar } from './ui.jsx'
import { CATEGORIES, catLabel, catIcon, kes, untilLabel, dayKE, clockKE, timeAgo } from '../lib/format.js'
import { areaName } from '../lib/geo.js'
import { scoreAssessment, CRITERIA, BAND_META } from '../lib/scorecard.js'
import { CHANNEL_META } from '../lib/alertEngine.js'

export function StatusPill({ status }) {
  const map = {
    requested: { t: 'Requested', c: 'brand' },
    assigned: { t: 'Assessor assigned', c: 'brand' },
    on_site: { t: 'On site', c: 'brand' },
    scored: { t: 'Scored', c: '' },
    new: { t: 'New', c: 'brand' },
    dispatching: { t: 'Dispatching', c: 'brand' },
    accepted: { t: 'Provider found', c: '' },
    resolved: { t: 'Resolved', c: '' },
  }
  const m = map[status] || { t: status, c: '' }
  return <span className={`chip ${m.c}`}>{m.t}</span>
}

export function ReadinessDot({ readiness }) {
  const map = { ready: ['var(--green)', 'Ready'], busy: ['var(--amber)', 'Busy'], off: ['var(--muted)', 'Offline'] }
  const [c, t] = map[readiness] || map.off
  return (
    <span className="chip" style={{ gap: '.4rem' }}>
      <span style={{ width: 8, height: 8, borderRadius: 8, background: c }} />
      {t}
    </span>
  )
}

export function EventLine({ event, now }) {
  return (
    <div className="between">
      <div className="grow">
        <div className="subtitle wrapany">{event.title}</div>
        <div className="caption wrapany">
          {catIcon(event.category)} {areaName(event.areaId)} · {event.venue}
        </div>
      </div>
      <div style={{ textAlign: 'right', flex: 'none' }}>
        <div className="chip brand mono">{untilLabel(event.startsAt, now)}</div>
        <div className="caption" style={{ marginTop: 4 }}>{dayKE(event.startsAt)} · {clockKE(event.startsAt)}</div>
      </div>
    </div>
  )
}

// Full scorecard readout used by client, admin and after an assessor submits.
export function ScorecardBlock({ assessment, event, assessor, compact }) {
  if (!assessment || assessment.status !== 'scored') return null
  const { score, band, reasons } = scoreAssessment(assessment.answers)
  const meta = BAND_META[band]
  return (
    <div className="card" style={{ borderColor: `var(--${band === 'amber' ? 'amber' : band})` }}>
      <div className="between">
        <div>
          <div className="kicker">Last Minute Scorecard</div>
          <div className="title" style={{ fontFamily: 'Lora, serif', marginTop: 2 }}>{meta.headline}</div>
        </div>
        <Rag band={band} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '.8rem', margin: '.75rem 0 .3rem' }}>
        <div style={{ fontFamily: 'Lora, serif', fontSize: '2rem', fontWeight: 700, lineHeight: 1,
          color: `var(--${band === 'amber' ? 'amber' : band})` }}>{score}</div>
        <div className="grow">
          <Meter value={score} band={band} />
          <div className="caption" style={{ marginTop: 4 }}>Readiness score · 0–100</div>
        </div>
      </div>

      {!compact && <p className="body" style={{ marginTop: '.4rem' }}>{meta.blurb}</p>}

      {reasons.length > 0 && (
        <div style={{ marginTop: '.6rem' }}>
          <div className="caption" style={{ fontWeight: 800, marginBottom: 4 }}>What the assessor flagged</div>
          <div style={{ display: 'grid', gap: '.35rem' }}>
            {reasons.map((r) => (
              <div key={r.id} className="row" style={{ gap: '.5rem', alignItems: 'center' }}>
                <span style={{ color: r.severity === 'critical' ? 'var(--red)' : 'var(--amber)' }}>
                  <Icon name="alert" size={16} />
                </span>
                <span className="body"><strong>{r.label}:</strong> {r.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!compact && assessment.notes && (
        <div className="card flat" style={{ background: 'var(--surface-2)', marginTop: '.7rem', padding: '.7rem .8rem' }}>
          <div className="caption" style={{ fontWeight: 800 }}>Assessor's note</div>
          <p className="body" style={{ margin: '.2rem 0 0' }}>{assessment.notes}</p>
        </div>
      )}

      {assessor && (
        <div className="row" style={{ marginTop: '.7rem', alignItems: 'center', borderTop: 'none' }}>
          <Avatar name={assessor.name} size={30} />
          <div className="caption grow">Assessed by <strong>{assessor.name}</strong>{assessment.visitedAt ? ` · visited ${clockKE(assessment.visitedAt)}` : ''}</div>
        </div>
      )}
    </div>
  )
}

export function ProviderRow({ provider, match, right }) {
  return (
    <div className="row">
      <Avatar name={provider.name} />
      <div className="grow">
        <div className="between">
          <div className="subtitle wrapany">{provider.name}</div>
          <span className="chip" style={{ gap: 4 }}>★ {provider.rating.toFixed(1)}</span>
        </div>
        <div className="caption wrapany" style={{ marginTop: 2 }}>
          {provider.categories.map(catLabel).join(' · ')} · {areaName(provider.areaId)}
        </div>
        {match && (
          <div className="chiprow" style={{ marginTop: 6 }}>
            <span className="chip brand">Match {match.score}</span>
            {match.reasons.slice(0, 3).map((r, i) => <span className="chip" key={i}>{r}</span>)}
          </div>
        )}
      </div>
      {right}
    </div>
  )
}

export function AlertCard({ alert, now, showProvider, onAck, action }) {
  const ch = CHANNEL_META[alert.channel] || {}
  const color = alert.likelihood === 'high' ? 'var(--red)' : alert.likelihood === 'possible' ? 'var(--amber)' : 'var(--green)'
  return (
    <div className="card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="between">
        <div className="chiprow">
          <span className="chip" style={{ color, borderColor: color }}>{ch.icon} {ch.label} alert</span>
          {showProvider && <span className="chip">{alert.providerName}</span>}
        </div>
        <span className="caption mono">{timeAgo(alert.sentAt, now)}</span>
      </div>
      <p className="body" style={{ margin: '.55rem 0 .2rem' }}>{alert.message}</p>
      <div className="between" style={{ marginTop: '.5rem' }}>
        <span className="caption">
          {areaName(alert.areaId)} · match {alert.matchScore} · {alert.km.toFixed(1)} km
        </span>
        {alert.acknowledged ? (
          <span className="chip" style={{ color: 'var(--green)', borderColor: 'var(--green)' }}>
            <Icon name="check" size={14} /> Acknowledged
          </span>
        ) : action ? action : onAck ? (
          <button className="btn btn-primary btn-sm" onClick={onAck}>I'm ready</button>
        ) : null}
      </div>
    </div>
  )
}
