// Save-The-Day Gift Shop — curated last-minute gifts, dispatched same-day across
// Nairobi. Prices are retail (KES, margin baked in). `eta` is the promise.
// Maps to a `gift_products` table in Supabase (see migration 0006).

export const SHOP_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'flowers', label: 'Flowers' },
  { id: 'cakes', label: 'Cakes' },
  { id: 'hampers', label: 'Hampers' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'experiences', label: 'Experiences' },
  { id: 'cards', label: 'Gift Cards' },
]

export const PRODUCTS = [
  { id: 'g_roses', name: 'Two-Dozen Red Roses', emoji: '🌹', category: 'flowers', price: 4500, eta: '2 hr', blurb: 'Hand-tied, wrapped, card included.' },
  { id: 'g_mixed', name: 'Seasonal Mixed Bouquet', emoji: '💐', category: 'flowers', price: 3200, eta: '2 hr', blurb: 'Florist’s pick of the day.' },
  { id: 'g_cake', name: 'Celebration Cake (1kg)', emoji: '🎂', category: 'cakes', price: 3800, eta: '3 hr', blurb: 'Vanilla or chocolate, iced message.' },
  { id: 'g_cupcakes', name: 'Cupcake Box (12)', emoji: '🧁', category: 'cakes', price: 2600, eta: '3 hr', blurb: 'Assorted, boxed & ribboned.' },
  { id: 'g_hamper', name: 'Deluxe Treat Hamper', emoji: '🧺', category: 'hampers', price: 6900, eta: '4 hr', blurb: 'Chocolates, nuts, preserves, tea.' },
  { id: 'g_baby', name: 'New Baby Hamper', emoji: '🍼', category: 'hampers', price: 5400, eta: '4 hr', blurb: 'Onesie, blanket, soft toy, card.' },
  { id: 'g_wine', name: 'Wine & Chocolate Duo', emoji: '🍷', category: 'drinks', price: 4200, eta: '3 hr', blurb: 'Red or white + truffle box.' },
  { id: 'g_bubbly', name: 'Celebration Bubbly', emoji: '🍾', category: 'drinks', price: 3500, eta: '3 hr', blurb: 'Chilled sparkling, ready to pop.' },
  { id: 'g_spa', name: 'Spa Day Voucher', emoji: '💆', category: 'experiences', price: 7500, eta: 'instant', blurb: 'Redeemable at partner spas.' },
  { id: 'g_dinner', name: 'Dinner-for-Two Voucher', emoji: '🍽️', category: 'experiences', price: 8000, eta: 'instant', blurb: 'Partner restaurants, city-wide.' },
  { id: 'g_card2', name: 'Gift Card — KES 2,000', emoji: '🎁', category: 'cards', price: 2000, eta: 'instant', blurb: 'Spend on anything in the shop.' },
  { id: 'g_card5', name: 'Gift Card — KES 5,000', emoji: '🎁', category: 'cards', price: 5000, eta: 'instant', blurb: 'Spend on anything in the shop.' },
]

export const productById = (id) => PRODUCTS.find((p) => p.id === id)
