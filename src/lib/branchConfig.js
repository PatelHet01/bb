// Master branch-category mapping for Bombay Bethak
// Source: business rules per branch type

export const BRANCH_CATEGORY_MAP = {
  gurukul: [
    'Paan & Masala',
    'Smoke Lounge',
    'Snacks',
    'Cold Drinks & Beverages',
  ],
  bhat: [
    'Paan & Masala',
    'Smoke Lounge',
    'Snacks',
    'Cold Drinks & Beverages',
    'BB Cafe',
  ],
  visat: [
    'Paan & Masala',
    'Cold Drinks & Beverages',
    'Snacks',
    'Biscuits & Packets',
    'Bread & Dairy',
  ],
}

export const BRANCH_LABELS = {
  gurukul: 'Gurukul',
  bhat: 'BB Cafe · Bhat',
  visat: 'Visat',
}

export const CATEGORY_ICONS = {
  'Paan & Masala':          '🌿',
  'Smoke Lounge':           '🚬',
  'Snacks':                 '🍟',
  'Cold Drinks & Beverages':'🥤',
  'BB Cafe':                '☕',
  'Biscuits & Packets':     '🍪',
  'Bread & Dairy':          '🥛',
}

export const ALL_BRANCHES = ['gurukul', 'bhat', 'visat']
