// appConfig — the ONE knob that turns this single codebase into three
// stand-alone, installable PWAs. Each build sets VITE_APP=public|network|admin
// (see package.json scripts); everything below is derived from it at build time,
// so Rollup drops the code the other apps need (see App.jsx lazy shells).
//
//   public   → app.lastminutekenya.com      clients only (main dashboard)
//   network  → network.lastminutekenya.com  Last Minute Network suppliers only
//   admin    → admin.lastminutekenya.com     operations + assessors, can look
//                                            INTO the network + public surfaces
//
// Isolation is real: the network and public bundles contain no admin code and
// no knowledge of each other. Only the admin build can preview the others.

export const APP = import.meta.env.VITE_APP || 'public'

// Per-app definition. `roles` = the surfaces this build is allowed to render.
// `home` = where an authenticated (or anonymous) user of this app lands.
// `crossView` = roles the admin can hop into (empty for the isolated apps).
export const APPS = {
  public: {
    id: 'public',
    label: 'LastMinute Kenya',
    audience: 'Clients',
    roles: ['customer'],
    home: '/customer',
    crossView: [],
    // sunrise coral/gold — hopeful, "help is coming"
    theme: '#ff7a2f',
    background: '#fff8f2',
    variant: 'public',
    manifest: {
      name: 'LastMinute Kenya — We Save the Day',
      short_name: 'LastMinute',
      description:
        'When your event provider flops, we save the day. Raise an SOS, track the rescue, and shop last-minute Save-The-Day gifts.',
    },
  },
  network: {
    id: 'network',
    label: 'LMK Network',
    audience: 'Providers',
    roles: ['provider'],
    home: '/provider',
    crossView: [],
    // fresh green/teal — growth, readiness, "you are the rescue"
    theme: '#0ea678',
    background: '#f1fbf6',
    variant: 'network',
    manifest: {
      name: 'LMK Network — You Are the Rescue',
      short_name: 'LMK Network',
      description:
        'The Last Minute Network for vetted providers. Go on standby, catch pre-dispatch alerts near you, and accept rescue jobs.',
    },
  },
  admin: {
    id: 'admin',
    label: 'LMK Command',
    audience: 'Operations',
    // admin build carries admin + assessor surfaces, and can look into the others
    roles: ['admin', 'assessor', 'customer', 'provider'],
    home: '/admin',
    crossView: ['customer', 'provider'],
    // sky indigo — calm, in-control, trustworthy
    theme: '#5468ff',
    background: '#f3f5ff',
    variant: 'command',
    manifest: {
      name: 'LMK Command — Operations',
      short_name: 'LMK Command',
      description:
        'Operations for LastMinute Kenya: dispatch rescues, review Site Assessor scorecards, manage the Network, and preview every stakeholder surface.',
    },
  },
}

export const CONFIG = APPS[APP] || APPS.public

// Roles this build may ever show (used to gate routing + login).
export const ALLOWED_ROLES = CONFIG.roles
// Can this build hop into other stakeholder surfaces? (admin only)
export const CAN_CROSS_VIEW = CONFIG.crossView.length > 0

// The other two apps, for "wrong door" redirects (e.g. an admin who lands on
// the public app, or a provider who opens the client app by mistake).
export const OTHER_APPS = Object.values(APPS).filter((a) => a.id !== APP)

// Map a role to the app that owns it — so we can point people to the right PWA.
export function appForRole(role) {
  if (role === 'provider') return APPS.network
  if (role === 'admin' || role === 'assessor') return APPS.admin
  return APPS.public
}
