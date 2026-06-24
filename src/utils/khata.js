/**
 * khata.js — Unified Khata Balance Calculation
 *
 * Single source of truth used by:
 *   - CustomersPage (admin)
 *   - MyBethakDashboard (customer portal)
 *   - BillingPage (POS balance display)
 *
 * DB layout (unchanged, Option A):
 *   khata_ledger.type  = 'CREDIT' | 'PAYMENT' | 'ADJUSTMENT'
 *   advance_ledger.type = 'TOPUP' | 'DEDUCTION' | 'REFUND'
 *
 * Formula:
 *   khataRaw  = Σ(CREDIT) - Σ(PAYMENT + ADJUSTMENT)
 *   advRaw    = Σ(TOPUP)  - Σ(DEDUCTION + REFUND)
 *   net       = khataRaw - advRaw
 *
 *   net > 0  → customer owes shop   (show RED  -₹net)
 *   net < 0  → shop owes customer   (show GREEN +₹|net|)
 *   net = 0  → all clear
 */

/**
 * Compute net balance from raw ledger rows.
 * @param {Array} khataRows  — rows from khata_ledger
 * @param {Array} advRows    — rows from advance_ledger
 * @returns {number}          — positive = owes, negative = jama/advance
 */
export function computeNetBalance(khataRows = [], advRows = []) {
  const khataRaw = khataRows.reduce((s, l) =>
    l.type === 'CREDIT' ? s + Number(l.amount) : s - Number(l.amount), 0)
  const advRaw = advRows.reduce((s, l) =>
    l.type === 'TOPUP' ? s + Number(l.amount) : s - Number(l.amount), 0)
  return khataRaw - advRaw
}

/**
 * Build a unified, chronologically-sorted ledger timeline
 * merging both khata_ledger and advance_ledger rows.
 *
 * Each entry gets:
 *   _color   : 'red' | 'green'
 *   _prefix  : '-' | '+'
 *   _label   : human-readable string
 *   _source  : 'khata' | 'advance'
 *   _netEffect: number (positive = increases debt, negative = decreases debt)
 *
 * Perspective: SHOP (admin view)
 *   RED   (-) = customer owes more / credit was given
 *   GREEN (+) = customer paid / advance deposited
 *
 * @param {Array} khataRows
 * @param {Array} advRows
 * @returns {Array} merged & sorted unified ledger entries
 */
export function buildUnifiedLedger(khataRows = [], advRows = []) {
  const khataEntries = khataRows.map(l => {
    const isCreditGiven = l.type === 'CREDIT'
    return {
      ...l,
      _source: 'khata',
      _color: isCreditGiven ? 'red' : 'green',
      _prefix: isCreditGiven ? '-' : '+',
      _label: isCreditGiven ? 'Credit Given' : l.type === 'PAYMENT' ? 'Payment Received' : 'Adjustment',
      _netEffect: isCreditGiven ? Number(l.amount) : -Number(l.amount),
    }
  })

  const advEntries = advRows.map(l => {
    const isJama = l.type === 'TOPUP'
    return {
      ...l,
      _source: 'advance',
      _color: isJama ? 'green' : 'red',
      _prefix: isJama ? '+' : '-',
      _label: isJama ? 'Jama / Advance' : 'Advance Used',
      _netEffect: isJama ? -Number(l.amount) : Number(l.amount),
    }
  })

  return [...khataEntries, ...advEntries]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

/**
 * Compute net balance from an already-merged unified ledger array.
 * Useful for running balance calculations on the timeline.
 */
export function computeRunningBalances(unifiedEntries) {
  // Sort ascending for running balance
  const ascending = [...unifiedEntries].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  let running = 0
  const withBal = ascending.map(entry => {
    running += entry._netEffect
    return { ...entry, _runningBal: running }
  })
  // Return in descending order (newest first) for display
  return withBal.reverse()
}

/**
 * Compute per-branch net balances for branch breakdown display.
 * @param {Array} khataRows
 * @param {Array} advRows
 * @param {Array} branches — [{id, name}] from branches table
 * @returns {Array} [{id, name, net, khata, advance}]
 */
export function computeBranchBalances(khataRows = [], advRows = [], branches = []) {
  const allBranchIds = new Set([
    ...khataRows.map(l => l.branch_id),
    ...advRows.map(l => l.branch_id),
  ])

  return Array.from(allBranchIds).map(bid => {
    const branchObj = branches.find(b => b.id === bid)
    const branchName = branchObj
      ? branchObj.name
      : bid ? (bid.charAt(0).toUpperCase() + bid.slice(1)) : 'Global'

    const kList = khataRows.filter(l => l.branch_id === bid)
    const aList = advRows.filter(l => l.branch_id === bid)

    const khataRaw = kList.reduce((s, l) => l.type === 'CREDIT' ? s + +l.amount : s - +l.amount, 0)
    const advRaw = aList.reduce((s, l) => l.type === 'TOPUP' ? s + +l.amount : s - +l.amount, 0)
    const net = khataRaw - advRaw

    return {
      id: bid || 'global',
      name: branchName,
      net,                        // positive = owes, negative = jama
      khata: Math.max(0, net),    // legacy compat display
      advance: Math.max(0, -net), // legacy compat display
    }
  }).filter(b => b.net !== 0 || b.khata > 0 || b.advance > 0)
}
