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

// `photos` is an ordered list of image URLs (first = cover). Empty here so the
// seed/demo falls back to the emoji; owners add real photos in the Admin → Shop
// manager, which persists them to the gift_products.photos column.
export const PRODUCTS = [
  { id: 'g_roses', name: 'Two-Dozen Red Roses', emoji: '🌹', category: 'flowers', price: 4500, eta: '2 hr', blurb: 'Hand-tied, wrapped, card included.', photos: [] },
  { id: 'g_mixed', name: 'Seasonal Mixed Bouquet', emoji: '💐', category: 'flowers', price: 3200, eta: '2 hr', blurb: 'Florist’s pick of the day.', photos: [] },
  { id: 'g_cake', name: 'Celebration Cake (1kg)', emoji: '🎂', category: 'cakes', price: 3800, eta: '3 hr', blurb: 'Vanilla or chocolate, iced message.', photos: [] },
  { id: 'g_cupcakes', name: 'Cupcake Box (12)', emoji: '🧁', category: 'cakes', price: 2600, eta: '3 hr', blurb: 'Assorted, boxed & ribboned.', photos: [] },
  { id: 'g_hamper', name: 'Deluxe Treat Hamper', emoji: '🧺', category: 'hampers', price: 6900, eta: '4 hr', blurb: 'Chocolates, nuts, preserves, tea.', photos: [] },
  { id: 'g_baby', name: 'New Baby Hamper', emoji: '🍼', category: 'hampers', price: 5400, eta: '4 hr', blurb: 'Onesie, blanket, soft toy, card.', photos: [] },
  { id: 'g_wine', name: 'Wine & Chocolate Duo', emoji: '🍷', category: 'drinks', price: 4200, eta: '3 hr', blurb: 'Red or white + truffle box.', photos: [] },
  { id: 'g_bubbly', name: 'Celebration Bubbly', emoji: '🍾', category: 'drinks', price: 3500, eta: '3 hr', blurb: 'Chilled sparkling, ready to pop.', photos: [] },
  { id: 'g_spa', name: 'Spa Day Voucher', emoji: '💆', category: 'experiences', price: 7500, eta: 'instant', blurb: 'Redeemable at partner spas.', photos: [] },
  { id: 'g_dinner', name: 'Dinner-for-Two Voucher', emoji: '🍽️', category: 'experiences', price: 8000, eta: 'instant', blurb: 'Partner restaurants, city-wide.', photos: [] },
  { id: 'g_card2', name: 'Gift Card — KES 2,000', emoji: '🎁', category: 'cards', price: 2000, eta: 'instant', blurb: 'Spend on anything in the shop.', photos: [] },
  { id: 'g_card5', name: 'Gift Card — KES 5,000', emoji: '🎁', category: 'cards', price: 5000, eta: 'instant', blurb: 'Spend on anything in the shop.', photos: [] },
]

export const MAX_PHOTOS = 5

// Seed/standalone lookup. In the running app prefer the store's live products
// (useStore -> s.products) so admin title/photo edits are reflected.
export const productById = (id) => PRODUCTS.find((p) => p.id === id)
