// LastMinuteKenya monetization — commission-led hybrid.
// SOS is free to raise. Revenue = commission on completed rescues + flat
// assessment fee + gift-shop margin & delivery. All KES.

export const COMMISSION_RATE = 0.15 // platform's cut of a completed rescue's value
export const ASSESSMENT_FEE = 2500 // flat Site Assessor visit fee
export const SAVE_THE_DAY_FEE = 500 // optional client success fee (off by default)
export const SHOP_DELIVERY_FEE = 350 // last-mile delivery per gift order

export const commission = (jobValue) => Math.round((jobValue || 0) * COMMISSION_RATE)
export const providerEarns = (jobValue) => Math.round((jobValue || 0) * (1 - COMMISSION_RATE))
