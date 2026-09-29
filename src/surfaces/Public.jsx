import { useState, useEffect, useRef } from 'react'
import { Routes, Route, NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { useStore, sel, requestAssessment, raiseSOS, clearToast, addToCart, setQty, clearCart, placeGiftOrder, createEvent } from '../data/store.js'
import { Icon, Turnstile, turnstileEnabled } from '../components/ui.jsx'
import { supabaseEnabled } from '../lib/supabase.js'
import { updateMyProfile } from '../lib/auth.js'
import { CATEGORIES, EVENT_TYPES, catLabel, catIcon, untilLabel, dayKE, clockKE, kes } from '../lib/format.js'
import { PRODUCTS, SHOP_CATEGORIES, productById } from '../data/shop.js'
import { SHOP_DELIVERY_FEE, ASSESSMENT_FEE } from '../lib/pricing.js'
import { areaName, AREA_LIST } from '../lib/geo.js'
import { scoreAssessment, BAND_META } from '../lib/scorecard.js'

// count-up animation for the big stats
function useCountUp(target, ms = 900) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(target); return }
    let raf, start
    const tick = (t) => {
      if (!start) start = t
      const p = Math.min(1, (t - start) / ms)
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return n
}

// ---- Shell -----------------------------------------------------------------
export function PublicShell({ onStaff }) {
  const s = useStore()
  return (
    <div className="eco public">
      <header className="pub-top">
        <span className="beacon" />
        <div>
          <div className="pub-brand">LASTMINUTE<span className="ke">KE</span></div>
          <div className="tagline">We save the day</div>
        </div>
        <span className="aud" style={{ marginLeft: '.5rem' }}>Clients</span>
        <div style={{ flex: 1 }} />
        <button className="pub-btn pub-btn-ghost pub-btn-sm" onClick={onStaff}>
          <Icon name="users" size={15} /> Staff
        </button>
      </header>
      <div className="hazard-stripe" />
      <main className="pub-main">
        <Routes>
          <Route path="/customer" element={<PublicHome />} />
          <Route path="/customer/help" element={<PublicHelp />} />
          <Route path="/customer/requests" element={<PublicRequests />} />
          <Route path="/customer/shop" element={<ShopHome />} />
          <Route path="/customer/cart" element={<ShopCart />} />
          <Route path="/customer/checkout" element={<ShopCheckout />} />
          <Route path="/customer/event/new" element={<EventCreate />} />
          <Route path="*" element={<Navigate to="/customer" replace />} />
        </Routes>
      </main>
      <PublicNav />
      <PublicToaster />
    </div>
  )
}

function PublicNav() {
  const s = useStore()
  const cartCount = (s.cart || []).reduce((a, c) => a + c.qty, 0)
  return (
    <nav className="pub-nav" aria-label="Primary">
      <NavLink to="/customer" end className={({ isActive }) => (isActive ? 'active' : '')}>
        <Icon name="home" size={22} /> Home
      </NavLink>
      <NavLink to="/customer/shop" className={({ isActive }) => (isActive ? 'active' : '')}>
        {cartCount ? <span className="badge" style={{ position: 'absolute', top: 6, marginLeft: 22, background: 'var(--siren)', color: '#fff', minWidth: 16, height: 16, borderRadius: 9, fontSize: '.62rem', fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 4px' }}>{cartCount}</span> : null}
        <Icon name="spark" size={22} /> Shop
      </NavLink>
      <NavLink to="/customer/help" className="cta">
        <span className="ic"><Icon name="alert" size={22} style={{ color: '#fff' }} /></span>
        SOS
      </NavLink>
      <NavLink to="/customer/requests" className={({ isActive }) => (isActive ? 'active' : '')}>
        <Icon name="clipboard" size={22} /> Status
      </NavLink>
    </nav>
  )
}

function PublicToaster() {
  const s = useStore()
  if (!s.toast) return null
  setTimeout(clearToast, 3200)
  return (
    <div className="eco-public-toast" role="status">
      <span style={{ width: 10, height: 10, borderRadius: 10, background: 'var(--siren)' }} />
      {s.toast.msg}
    </div>
  )
}

// ---- Home ------------------------------------------------------------------
export function PublicHome() {
  const s = useStore()
  const { clientId } = useApp()
  const ready = s.providers.filter((p) => p.readiness === 'ready').length
  const total = s.providers.length
  const avg = total ? Math.round(s.providers.reduce((a, p) => a + p.responseMins, 0) / total) : 0
  const readyN = useCountUp(ready)
  const jobsN = useCountUp(s.providers.reduce((a, p) => a + p.jobsDone, 0))
  const myEvents = s.events.filter((e) => e.clientId === clientId)

  return (
    <>
      <section className="pub-hero">
        <span className="kick"><span style={{ width: 7, height: 7, borderRadius: 7, background: '#000' }} /> Nairobi · live rescue network</span>
        <h1 className="anton">When they<br />flop,<br /><span className="hl">we don't.</span></h1>
        <p>Caterer vanished? Tent guy ghosting hours before the event? We deploy a vetted rescue network across Nairobi — fast.</p>
        <NavLink to="/customer/help" className="pub-sos" style={{ textDecoration: 'none' }}>
          <span className="ring"><Icon name="alert" size={26} style={{ color: '#fff' }} /></span>
          <span>
            <span className="lbl">Raise an SOS</span>
            <div className="sub">Tap here the moment it goes wrong</div>
          </span>
        </NavLink>
      </section>

      <div className="pub-stats">
        <div className="pub-stat go"><div className="n">{readyN}</div><div className="l">Providers ready now</div></div>
        <div className="pub-stat siren"><div className="n">~{avg}<span style={{ fontSize: '1rem' }}>m</span></div><div className="l">Avg response</div></div>
        <div className="pub-stat"><div className="n">{jobsN.toLocaleString()}</div><div className="l">Rescues delivered</div></div>
      </div>

      <div className="pub-ticker" style={{ marginTop: '1rem' }}>
        <div className="track">
          {[...tickerItems(s), ...tickerItems(s)].map((t, i) => (
            <span className="item" key={i}>{t}</span>
          ))}
        </div>
      </div>

      <div className="pub-h"><h2 className="anton">Your events</h2><span className="bar" /><NavLink to="/customer/event/new" className="pub-chip hazard" style={{ textDecoration: 'none' }}>+ Add</NavLink></div>
      {myEvents.length === 0 && (
        <NavLink to="/customer/event/new" className="pub-panel" style={{ display: 'block', textDecoration: 'none', color: 'inherit', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem' }}>📅</div>
          <div style={{ fontWeight: 800, marginTop: '.2rem' }}>Add your event</div>
          <div className="pub-muted" style={{ fontSize: '.83rem' }}>So we can dispatch help to the right place if it goes wrong.</div>
        </NavLink>
      )}
      {myEvents.length > 0 && (
        <>
          {myEvents.map((e) => {
            const a = sel.assessmentForEvent(s, e.id)
            const job = s.sosJobs.find((j) => j.eventId === e.id && j.status !== 'resolved')
            return (
              <div className="pub-panel" key={e.id} style={{ marginBottom: '.7rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem' }}>
                  <div className="wrapany" style={{ fontWeight: 800, fontSize: '1.05rem' }}>{e.title}</div>
                  <span className="pub-chip hazard" style={{ flex: 'none' }}>{untilLabel(e.startsAt, s.now)}</span>
                </div>
                <div className="pub-muted wrapany" style={{ fontSize: '.85rem', marginTop: 3 }}>{catIcon(e.category)} {areaName(e.areaId)} · {e.venue}</div>
                <div className="pub-chiprow" style={{ marginTop: '.6rem' }}>
                  {a && a.status === 'scored' && <span className={`pub-rag ${a.band}`}>{a.band}</span>}
                  {job && <span className="pub-chip siren">Rescue live</span>}
                  {!a && !job && <span className="pub-chip">No cover yet</span>}
                </div>
              </div>
            )
          })}
        </>
      )}

      <div className="pub-h"><h2 className="anton">How the rescue works</h2><span className="bar" /></div>
      <div className="pub-panel">
        <div className="pub-step"><div className="num anton">1</div><div><div className="t">You raise the alarm</div><div className="d">One tap. Tell us the event, the gap, the deadline.</div></div></div>
        <div className="pub-divider" />
        <div className="pub-step"><div className="num anton">2</div><div><div className="t">We alert the network</div><div className="d">The nearest capable providers get pinged instantly — before you even call.</div></div></div>
        <div className="pub-divider" />
        <div className="pub-step"><div className="num anton">3</div><div><div className="t">Someone shows up</div><div className="d">A vetted provider accepts and moves. Your event is saved.</div></div></div>
      </div>

      <div className="pub-panel raise" style={{ marginTop: '.8rem', display: 'flex', gap: '.8rem', alignItems: 'center' }}>
        <Icon name="shield" size={26} style={{ color: 'var(--hazard)', flex: 'none' }} />
        <div>
          <div style={{ fontWeight: 800 }}>Not sure your provider will deliver?</div>
          <div className="pub-muted" style={{ fontSize: '.85rem' }}>Send a Site Assessor to check in person and warm up backups. <NavLink to="/customer/help" style={{ color: 'var(--hazard)', fontWeight: 800 }}>Request one →</NavLink></div>
        </div>
      </div>
    </>
  )
}

function tickerItems(s) {
  const areas = ['Kilimani', 'Karen', 'Westlands', 'Ruaka', 'Lavington', 'Rongai']
  const cats = ['catering', 'tents', 'sound', 'decor', 'cake']
  return [
    <>🟢 Provider marked <b>READY</b> in Westlands</>,
    <>🔴 Rescue dispatched · Kilimani · catering</>,
    <>⚡ 4 providers alerted near Karen</>,
    <>🟢 <b>ACCEPTED</b> in 6 min · Lavington</>,
    <>🔴 Amber scorecard · tents · Ruaka</>,
  ]
}

// ---- Get Help --------------------------------------------------------------
export function PublicHelp() {
  const s = useStore()
  const { clientId } = useApp()
  const myEvents = s.events.filter((e) => e.clientId === clientId)
  const [mode, setMode] = useState('sos')
  const [eventId, setEventId] = useState(myEvents[0]?.id || '')
  const [category, setCategory] = useState(myEvents[0]?.category || 'catering')
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')
  const [done, setDone] = useState(null)
  const needToken = supabaseEnabled && turnstileEnabled

  const submit = () => {
    if (supabaseEnabled && (name || phone)) updateMyProfile({ name, phone })
    if (mode === 'sos') { raiseSOS({ eventId, category, note, turnstileToken: token }); setDone('sos') }
    else { requestAssessment({ eventId, concern: note, requestedBy: clientId, turnstileToken: token }); setDone('assess') }
    setNote(''); setToken('')
  }

  if (done) {
    return (
      <div className="pub-panel" style={{ textAlign: 'center', marginTop: '1.5rem', padding: '2rem 1.2rem' }}>
        <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'var(--siren)', margin: '0 auto 1rem', display: 'grid', placeItems: 'center', boxShadow: '0 10px 30px rgba(255,59,46,.5)' }}>
          <Icon name="check" size={34} style={{ color: '#fff' }} />
        </div>
        <h2 className="anton" style={{ fontSize: '2rem' }}>{done === 'sos' ? 'Network alerted' : 'Assessor deploying'}</h2>
        <p className="pub-muted" style={{ marginTop: '.5rem' }}>
          {done === 'sos' ? 'The nearest capable providers just got pinged. Track who responds under Status.' : 'A Site Assessor is heading out to inspect and warm up backups. You’ll get a Red / Amber / Green verdict.'}
        </p>
        <NavLink to="/customer/requests" className="pub-btn pub-btn-siren pub-btn-block" style={{ marginTop: '1rem' }}>Track it live</NavLink>
        <button className="pub-btn pub-btn-ghost pub-btn-block" style={{ marginTop: '.5rem' }} onClick={() => setDone(null)}>Raise another</button>
      </div>
    )
  }

  return (
    <>
      <div className="pub-h" style={{ marginTop: '.8rem' }}><h2 className="anton">Get help now</h2><span className="bar" /></div>
      <div className="pub-optgrid">
        <button className={`pub-opt ${mode === 'sos' ? 'on' : ''}`} style={{ justifyContent: 'center' }} onClick={() => setMode('sos')}><Icon name="alert" size={17} /> Provider flopped</button>
        <button className={`pub-opt ${mode === 'assess' ? 'on' : ''}`} style={{ justifyContent: 'center' }} onClick={() => setMode('assess')}><Icon name="shield" size={17} /> I have doubts</button>
      </div>

      <div className="pub-panel" style={{ marginTop: '.8rem' }}>
        <p className="pub-muted" style={{ margin: 0, fontSize: '.92rem' }}>
          {mode === 'sos' ? 'Your booked provider has gone dark. We’ll alert and dispatch a replacement immediately.' : 'Not sure they can pull it off? We send an assessor to check in person and prime backups.'}
        </p>

        {supabaseEnabled && (
          <>
            <div className="pub-field"><label>Your name</label><input className="pub-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wanjiru Kamau" /></div>
            <div className="pub-field"><label>Phone providers can call</label><input className="pub-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" /></div>
          </>
        )}

        {myEvents.length === 0 ? (
          <div className="pub-panel raise" style={{ marginTop: '.9rem' }}>
            <div style={{ fontWeight: 800 }}>No event on file yet</div>
            <div className="pub-muted" style={{ fontSize: '.85rem', marginTop: 2 }}>Add your event first so we know where to send help.</div>
            <NavLink to="/customer/event/new" className="pub-btn pub-btn-hazard pub-btn-block" style={{ marginTop: '.7rem' }}>+ Add your event</NavLink>
          </div>
        ) : (
          <>
            <div className="pub-field">
              <label>Which event?</label>
              <select className="pub-select" value={eventId} onChange={(e) => { setEventId(e.target.value); const ev = myEvents.find((x) => x.id === e.target.value); if (ev) setCategory(ev.category) }}>
                {myEvents.map((e) => <option key={e.id} value={e.id}>{e.title} · {untilLabel(e.startsAt, s.now)}</option>)}
              </select>
            </div>

            {mode === 'sos' && (
              <div className="pub-field">
                <label>What do you need?</label>
                <div className="pub-optgrid">
                  {Object.entries(CATEGORIES).map(([id, c]) => (
                    <button key={id} className={`pub-opt ${category === id ? 'on' : ''}`} onClick={() => setCategory(id)}><span>{c.icon}</span> {c.label}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="pub-field">
              <label>{mode === 'sos' ? 'Tell us the situation' : 'What worries you?'}</label>
              <textarea className="pub-textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'sos' ? 'Caterer stopped answering, 80 guests at 4pm...' : 'Tent company sounds disorganised and keeps changing the plan...'} />
            </div>

            {mode === 'sos' ? (
              <div className="pub-chip go" style={{ marginTop: '.9rem' }}>Free to raise — you only pay a provider if you accept a rescue</div>
            ) : (
              <div className="pub-panel raise" style={{ marginTop: '.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800 }}>Assessment fee</span>
                <span className="anton" style={{ fontSize: '1.3rem' }}>{kes(ASSESSMENT_FEE)}</span>
              </div>
            )}

            {needToken && <Turnstile onToken={setToken} />}

            <button className="pub-btn pub-btn-siren pub-btn-block" style={{ marginTop: '1rem' }} onClick={submit} disabled={!eventId || (needToken && !token)}>
              {mode === 'sos' ? 'Deploy the network' : `Send an assessor · ${kes(ASSESSMENT_FEE)}`}
            </button>
            <div className="pub-muted" style={{ textAlign: 'center', marginTop: '.6rem', fontSize: '.78rem' }}>Protected{needToken ? ' by anti-spam' : ''} · your details stay private until you engage a provider.</div>
          </>
        )}
      </div>
    </>
  )
}

// ---- Requests --------------------------------------------------------------
export function PublicRequests() {
  const s = useStore()
  const { clientId } = useApp()
  const ids = s.events.filter((e) => e.clientId === clientId).map((e) => e.id)
  const jobs = s.sosJobs.filter((j) => ids.includes(j.eventId))
  const assessments = s.assessments.filter((a) => ids.includes(a.eventId))

  if (!jobs.length && !assessments.length) {
    return (
      <div className="pub-panel" style={{ textAlign: 'center', marginTop: '1.5rem', padding: '2rem 1.2rem' }}>
        <Icon name="clipboard" size={40} style={{ color: 'var(--text-dim)' }} />
        <h2 className="anton" style={{ fontSize: '1.6rem', marginTop: '.5rem' }}>Nothing live yet</h2>
        <p className="pub-muted" style={{ marginTop: '.3rem' }}>Your rescues and scorecards will show up here.</p>
      </div>
    )
  }

  return (
    <>
      {jobs.length > 0 && <div className="pub-h" style={{ marginTop: '.8rem' }}><h2 className="anton">Rescues</h2><span className="bar" /></div>}
      {jobs.map((j) => {
        const event = sel.event(s, j.eventId)
        const provider = j.acceptedBy ? sel.provider(s, j.acceptedBy) : null
        return (
          <div className="pub-panel" key={j.id} style={{ marginBottom: '.7rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem' }}>
              <div style={{ fontWeight: 800 }}>{catIcon(j.category)} {catLabel(j.category)} rescue</div>
              <span className={`pub-chip ${provider ? 'go' : 'siren'}`}>{provider ? 'Provider found' : 'Dispatching'}</span>
            </div>
            <div className="pub-muted" style={{ fontSize: '.85rem', marginTop: 2 }}>{event.title}</div>
            {provider ? (
              <div className="pub-panel raise" style={{ marginTop: '.7rem', borderColor: 'var(--go)' }}>
                <div style={{ fontWeight: 800, color: 'var(--go)' }}>✅ {provider.name} is on it</div>
                <div className="pub-muted" style={{ fontSize: '.82rem' }}>{provider.lead} · {provider.phone} · ~{provider.responseMins} min away</div>
              </div>
            ) : (
              <div style={{ marginTop: '.6rem', display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 700 }}>
                <span className="beacon" style={{ width: 9, height: 9 }} /> Alerting nearby providers…
              </div>
            )}
          </div>
        )
      })}

      {assessments.length > 0 && <div className="pub-h"><h2 className="anton">Assessments</h2><span className="bar" /></div>}
      {assessments.map((a) => {
        const event = sel.event(s, a.eventId)
        if (a.status === 'scored') {
          const { score, band, reasons } = scoreAssessment(a.answers)
          const meta = BAND_META[band]
          return (
            <div className="pub-panel" key={a.id} style={{ marginBottom: '.7rem', borderColor: `var(--${band === 'amber' ? 'amber' : band === 'red' ? 'red' : 'go'})` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="pub-muted" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800 }}>Last Minute Scorecard</div>
                <span className={`pub-rag ${band}`}>{band}</span>
              </div>
              <div className="anton" style={{ fontSize: '1.5rem', marginTop: '.3rem' }}>{meta.headline}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', marginTop: '.5rem' }}>
                <div className="anton" style={{ fontSize: '2.4rem', color: `var(--${band === 'amber' ? 'amber' : band === 'red' ? 'red' : 'go'})` }}>{score}</div>
                <div className="pub-muted" style={{ fontSize: '.85rem' }}>{event.title}<br />readiness score · 0–100</div>
              </div>
            </div>
          )
        }
        return (
          <div className="pub-panel" key={a.id} style={{ marginBottom: '.7rem' }}>
            <div style={{ fontWeight: 800 }}>{event.title}</div>
            <div className="pub-muted" style={{ fontSize: '.85rem', marginTop: 2 }}>“{a.concern}”</div>
            <div style={{ marginTop: '.6rem', display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 700 }}>
              <span className="beacon" style={{ width: 9, height: 9, background: 'var(--amber)' }} /> Assessor en route…
            </div>
          </div>
        )
      })}
    </>
  )
}

// ---- Save-The-Day Gift Shop -----------------------------------------------
function cartLines(cart) {
  return (cart || []).map((c) => ({ ...c, product: productById(c.productId) })).filter((l) => l.product)
}
function cartSubtotal(cart) {
  return cartLines(cart).reduce((a, l) => a + l.product.price * l.qty, 0)
}

export function ShopHome() {
  const s = useStore()
  const [cat, setCat] = useState('all')
  const items = cat === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.category === cat)
  const count = (s.cart || []).reduce((a, c) => a + c.qty, 0)

  return (
    <>
      <section className="pub-hero" style={{ paddingBottom: '.5rem' }}>
        <span className="kick"><span style={{ width: 7, height: 7, borderRadius: 7, background: '#000' }} /> Same-day · Nairobi-wide</span>
        <h1 className="anton" style={{ fontSize: 'clamp(2.2rem,10vw,3rem)' }}>Save-the-day <span className="hl">gifts.</span></h1>
        <p>Forgot the gift? We’ll get flowers, a cake or a hamper to the door in hours.</p>
      </section>

      <div className="pub-chiprow" style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: '.3rem', marginBottom: '.6rem' }}>
        {SHOP_CATEGORIES.map((c) => (
          <button key={c.id} className={`pub-chip ${cat === c.id ? 'hazard' : ''}`} style={{ flex: 'none', cursor: 'pointer' }} onClick={() => setCat(c.id)}>{c.label}</button>
        ))}
      </div>

      <div className="shop-grid" style={{ paddingBottom: count ? '3.5rem' : 0 }}>
        {items.map((p) => (
          <div className="product" key={p.id}>
            <div className="thumb">{p.emoji}</div>
            <div className="body">
              <div className="eta">⚡ {p.eta}</div>
              <div className="nm">{p.name}</div>
              <div className="pub-muted" style={{ fontSize: '.72rem' }}>{p.blurb}</div>
              <div className="price">{kes(p.price)}</div>
              <button className="pub-btn pub-btn-siren pub-btn-sm add" style={{ width: '100%' }} onClick={() => addToCart(p.id)}>Add</button>
            </div>
          </div>
        ))}
      </div>

      {count > 0 && (
        <NavLink to="/customer/cart" className="cartbar" style={{ textDecoration: 'none' }}>
          <span><span className="qty">{count}</span> in your gift order</span>
          <span>View cart <Icon name="chevron" size={16} /></span>
        </NavLink>
      )}
    </>
  )
}

export function ShopCart() {
  const s = useStore()
  const lines = cartLines(s.cart)
  const sub = cartSubtotal(s.cart)
  if (lines.length === 0) {
    return (
      <div className="pub-panel" style={{ textAlign: 'center', marginTop: '1.5rem', padding: '2rem 1.2rem' }}>
        <div style={{ fontSize: '2.4rem' }}>🎁</div>
        <h2 className="anton" style={{ fontSize: '1.5rem', marginTop: '.3rem' }}>Your cart is empty</h2>
        <NavLink to="/customer/shop" className="pub-btn pub-btn-siren pub-btn-block" style={{ marginTop: '1rem' }}>Browse gifts</NavLink>
      </div>
    )
  }
  return (
    <>
      <div className="pub-h" style={{ marginTop: '.8rem' }}><h2 className="anton">Your gift order</h2><span className="bar" /></div>
      <div className="pub-panel">
        {lines.map((l) => (
          <div className="cart-row" key={l.productId}>
            <div style={{ fontSize: '1.8rem' }}>{l.product.emoji}</div>
            <div className="grow"><div style={{ fontWeight: 800, fontSize: '.9rem' }}>{l.product.name}</div><div className="pub-muted" style={{ fontSize: '.8rem' }}>{kes(l.product.price)}</div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
              <button className="qtybtn" onClick={() => setQty(l.productId, l.qty - 1)}>−</button>
              <span style={{ fontWeight: 800, minWidth: 18, textAlign: 'center' }}>{l.qty}</span>
              <button className="qtybtn" onClick={() => setQty(l.productId, l.qty + 1)}>+</button>
            </div>
          </div>
        ))}
      </div>
      <div className="pub-panel" style={{ marginTop: '.7rem' }}>
        <div className="summary-row"><span className="pub-muted">Subtotal</span><span>{kes(sub)}</span></div>
        <div className="summary-row"><span className="pub-muted">Delivery</span><span>{kes(SHOP_DELIVERY_FEE)}</span></div>
        <div className="summary-row total"><span>Total</span><span>{kes(sub + SHOP_DELIVERY_FEE)}</span></div>
      </div>
      <NavLink to="/customer/checkout" className="pub-btn pub-btn-siren pub-btn-block" style={{ marginTop: '.8rem' }}>Checkout · {kes(sub + SHOP_DELIVERY_FEE)}</NavLink>
    </>
  )
}

export function ShopCheckout() {
  const s = useStore()
  const lines = cartLines(s.cart)
  const sub = cartSubtotal(s.cart)
  const total = sub + SHOP_DELIVERY_FEE
  const [recipient, setRecipient] = useState('')
  const [addr, setAddr] = useState('')
  const [phone, setPhone] = useState('')
  const [msg, setMsg] = useState('')
  const [method, setMethod] = useState('mpesa')
  const [done, setDone] = useState(false)

  if (lines.length === 0 && !done) return <div className="pub-panel pub-muted" style={{ textAlign: 'center', marginTop: '1.5rem' }}>Nothing to check out. <NavLink to="/customer/shop" style={{ color: 'var(--siren)' }}>Shop →</NavLink></div>

  const pay = () => {
    placeGiftOrder({ phone, amount: total, method, items: lines, recipient, address: addr, message: msg, subtotal: sub, delivery: SHOP_DELIVERY_FEE, total })
    setDone(true)
  }
  const PAY_METHODS = [{ id: 'mpesa', label: 'M-Pesa', icon: '📲' }, { id: 'airtel', label: 'Airtel Money', icon: '📱' }, { id: 'card', label: 'Card', icon: '💳' }]

  if (done) {
    return (
      <div className="pub-panel" style={{ textAlign: 'center', marginTop: '1.5rem', padding: '2rem 1.2rem' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--go)', margin: '0 auto 1rem', display: 'grid', placeItems: 'center' }}><Icon name="check" size={32} style={{ color: '#0a0c10' }} /></div>
        <h2 className="anton" style={{ fontSize: '1.8rem' }}>{method === 'card' ? 'Almost there' : 'Check your phone'}</h2>
        <p className="pub-muted" style={{ marginTop: '.4rem' }}>
          {method === 'card'
            ? `A secure card payment of ${kes(total)} is being set up. Complete it to confirm — your gift is then dispatched.`
            : `A ${method === 'airtel' ? 'Airtel Money' : 'M-Pesa'} request for ${kes(total)} was sent to ${phone || 'your phone'}. Approve it to confirm — your gift is then dispatched.`}
        </p>
        <NavLink to="/customer/shop" className="pub-btn pub-btn-ghost pub-btn-block" style={{ marginTop: '1rem' }}>Back to shop</NavLink>
      </div>
    )
  }

  return (
    <>
      <div className="pub-h" style={{ marginTop: '.8rem' }}><h2 className="anton">Checkout</h2><span className="bar" /></div>
      <div className="pub-panel">
        <div className="pub-field"><label>Recipient name</label><input className="pub-input" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Who’s it for?" /></div>
        <div className="pub-field"><label>Delivery address</label><input className="pub-input" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Building, area, landmark" /></div>
        <div className="pub-field"><label>Gift message (optional)</label><textarea className="pub-textarea" style={{ minHeight: 60 }} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Happy birthday!" /></div>
        <div className="pub-field"><label>Pay with</label>
          <div className="pub-optgrid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            {PAY_METHODS.map((m) => (
              <button key={m.id} className={`pub-opt ${method === m.id ? 'on' : ''}`} style={{ justifyContent: 'center' }} onClick={() => setMethod(m.id)}>{m.icon} {m.label}</button>
            ))}
          </div>
        </div>
        {method !== 'card' && (
          <div className="pub-field"><label>{method === 'airtel' ? 'Airtel number' : 'M-Pesa number'}</label><input className="pub-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" /></div>
        )}
      </div>
      <div className="pub-panel" style={{ marginTop: '.7rem' }}>
        <div className="summary-row"><span className="pub-muted">Subtotal</span><span>{kes(sub)}</span></div>
        <div className="summary-row"><span className="pub-muted">Delivery</span><span>{kes(SHOP_DELIVERY_FEE)}</span></div>
        <div className="summary-row total"><span>Total</span><span>{kes(total)}</span></div>
      </div>
      <button className="pub-btn pub-btn-siren pub-btn-block" style={{ marginTop: '.8rem' }} disabled={!recipient || !addr || (method !== 'card' && !phone)} onClick={pay}>
        <span style={{ fontSize: '1.1rem' }}>{PAY_METHODS.find((m) => m.id === method)?.icon}</span> Pay {kes(total)} · {PAY_METHODS.find((m) => m.id === method)?.label}
      </button>
      <div className="pub-muted" style={{ textAlign: 'center', marginTop: '.5rem', fontSize: '.78rem' }}>
        {method === 'mpesa' ? 'You’ll get an M-Pesa STK push — confirm with your PIN.' : method === 'airtel' ? 'You’ll get an Airtel Money prompt to approve.' : 'You’ll be taken to a secure card page.'}
      </div>
    </>
  )
}

// ---- Create an event -------------------------------------------------------
export function EventCreate() {
  const navigate = useNavigate()
  const { clientId } = useApp()
  const [f, setF] = useState({ title: '', type: 'birthday', areaId: 'Kilimani', venue: '', startsAt: '', guests: 80, category: 'catering', budget: 120000, bookedProvider: '' })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const submit = () => {
    createEvent({ ...f, guests: Number(f.guests) || 0, budget: Number(f.budget) || 0, clientId })
    navigate('/customer')
  }
  const ok = f.title && f.areaId && f.startsAt
  return (
    <>
      <div className="pub-h" style={{ marginTop: '.8rem' }}><h2 className="anton">Add your event</h2><span className="bar" /></div>
      <p className="pub-muted" style={{ margin: '-.4rem .1rem .6rem', fontSize: '.85rem' }}>Tell us about the event so we know where to send help if it goes wrong.</p>
      <div className="pub-panel">
        <div className="pub-field"><label>Event name</label><input className="pub-input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Wanjiru & David — Wedding" /></div>
        <div className="pub-field"><label>Type</label>
          <select className="pub-select" value={f.type} onChange={(e) => set('type', e.target.value)}>
            {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="pub-field"><label>Area</label>
          <select className="pub-select" value={f.areaId} onChange={(e) => set('areaId', e.target.value)}>
            {AREA_LIST.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="pub-field"><label>Venue</label><input className="pub-input" value={f.venue} onChange={(e) => set('venue', e.target.value)} placeholder="Building / gardens / hall" /></div>
        <div className="pub-field"><label>Date & time</label><input className="pub-input" type="datetime-local" value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></div>
        <div className="pub-field"><label>Guests</label><input className="pub-input" type="number" value={f.guests} onChange={(e) => set('guests', e.target.value)} /></div>
        <div className="pub-field"><label>Main service booked</label>
          <select className="pub-select" value={f.category} onChange={(e) => set('category', e.target.value)}>
            {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
        </div>
        <div className="pub-field"><label>Booked provider (optional)</label><input className="pub-input" value={f.bookedProvider} onChange={(e) => set('bookedProvider', e.target.value)} placeholder="Who you’ve hired" /></div>
        <div className="pub-field"><label>Budget (KES)</label><input className="pub-input" type="number" value={f.budget} onChange={(e) => set('budget', e.target.value)} /></div>
        <button className="pub-btn pub-btn-siren pub-btn-block" style={{ marginTop: '1rem' }} disabled={!ok} onClick={submit}>Save event</button>
      </div>
    </>
  )
}
