import { useEffect, useRef } from 'react'
import { initials, hueFor } from '../lib/format.js'

// ---- Cloudflare Turnstile --------------------------------------------------
export const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
export const turnstileEnabled = Boolean(turnstileSiteKey)

export function Turnstile({ onToken }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!turnstileEnabled) return
    let widgetId
    const render = () => {
      if (window.turnstile && ref.current && !ref.current.dataset.rendered) {
        ref.current.dataset.rendered = '1'
        widgetId = window.turnstile.render(ref.current, {
          sitekey: turnstileSiteKey,
          callback: (t) => onToken(t),
          'error-callback': () => onToken(''),
          'expired-callback': () => onToken(''),
        })
      }
    }
    if (!document.getElementById('cf-turnstile-script')) {
      const sc = document.createElement('script')
      sc.id = 'cf-turnstile-script'
      sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      sc.async = true
      sc.defer = true
      sc.onload = render
      document.head.appendChild(sc)
    } else render()
    const iv = setInterval(render, 300)
    return () => {
      clearInterval(iv)
      try { widgetId && window.turnstile?.remove(widgetId) } catch {}
    }
  }, [])
  if (!turnstileEnabled) return null
  return <div ref={ref} style={{ marginTop: '.7rem' }} />
}

// ---- Icons (inline, stroke-based, theme-friendly) --------------------------
const P = {
  home: 'M3 10.5 12 4l9 6.5M5 9.5V20h14V9.5',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M9.5 20a2.5 2.5 0 0 0 5 0',
  clipboard: 'M9 4h6v2H9zM7 5H5v15h14V5h-2M9 11h6M9 15h4',
  shield: 'M12 3 5 6v6c0 4 3 6.5 7 8 4-1.5 7-4 7-8V6z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  users: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 3-5 6-5s6 2 6 5M17 11a3 3 0 1 0 0-6M16 15c3 0 6 2 6 5',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14',
  alert: 'M12 4 2 20h20L12 4ZM12 10v5M12 18h.01',
  plus: 'M12 5v14M5 12h14',
  check: 'M4 12.5 9 17.5 20 6.5',
  x: 'M6 6l12 12M18 6 6 18',
  phone: 'M4 5c0 9 6 15 15 15l1-4-5-2-2 2c-2-1-4-3-5-5l2-2-2-5z',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  chevron: 'M9 6l6 6-6 6',
  pin: 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12ZM12 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  send: 'M4 12 20 4l-6 16-2.5-6.5L4 12Z',
  file: 'M7 3h7l4 4v14H7zM14 3v4h4',
}
export function Icon({ name, size = 22, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d={P[name] || P.home} />
    </svg>
  )
}

// ---- RAG badge -------------------------------------------------------------
export function Rag({ band, children }) {
  const label = { red: 'Red', amber: 'Amber', green: 'Green' }[band] || band
  return (
    <span className={`rag ${band}`}>
      <span className="dot" />
      {children || label}
    </span>
  )
}

// ---- Meter -----------------------------------------------------------------
export function Meter({ value, band }) {
  const color = band ? `var(--${band === 'amber' ? 'amber' : band})` : 'var(--brand)'
  return (
    <div className="meter" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.max(4, value)}%`, background: color }} />
    </div>
  )
}

// ---- Avatar ----------------------------------------------------------------
export function Avatar({ name, size = 40 }) {
  return (
    <div className="avatar" style={{ background: hueFor(name), width: size, height: size }}>
      {initials(name)}
    </div>
  )
}

// ---- Stat tile -------------------------------------------------------------
export function Stat({ n, l, sub, band }) {
  return (
    <div className="stat">
      <div className="n" style={band ? { color: `var(--${band === 'amber' ? 'amber' : band})` } : null}>{n}</div>
      <div className="l">{l}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

// ---- Bottom sheet ----------------------------------------------------------
export function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        <div className="sheet-h">
          <h2 className="subtitle" style={{ fontFamily: 'Lora, serif' }}>{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" size={22} /></button>
        </div>
        {children}
        {footer && <div style={{ marginTop: '1rem' }}>{footer}</div>}
      </div>
    </div>
  )
}

// ---- Empty state -----------------------------------------------------------
export function Empty({ icon = 'check', title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={40} />
      <div className="subtitle" style={{ marginTop: '.3rem' }}>{title}</div>
      {children && <p className="caption" style={{ marginTop: '.2rem' }}>{children}</p>}
    </div>
  )
}

// ---- Section header --------------------------------------------------------
export function SectionH({ title, action }) {
  return (
    <div className="section-h">
      <h2>{title}</h2>
      {action}
    </div>
  )
}
