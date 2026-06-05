import { supabase } from './supabase'

/**
 * Log an audit event silently. Never throws — main actions are unaffected.
 * @param {object} opts
 * @param {string} opts.branchId
 * @param {object} opts.actor   — { id, username, full_name, role }
 * @param {string} opts.action  — e.g. 'ORDER_CREATED'
 * @param {string} opts.entityType — 'order'|'expense'|'inventory'|'salary'|'session'|'ledger'|'cash'
 * @param {string|number} opts.entityId
 * @param {string} opts.entityLabel — human-readable, e.g. "Order #1042 · ₹340"
 * @param {object} [opts.diff]      — before/after for edits
 * @param {object} [opts.metadata]  — any extra data
 */
export async function logAudit({
  branchId,
  actor,
  action,
  entityType,
  entityId,
  entityLabel,
  diff,
  metadata,
}) {
  try {
    const isReal = actor?.id && !String(actor.id).startsWith('hardcoded')
    await supabase.from('audit_logs').insert({
      branch_id:    branchId   || null,
      actor_id:     isReal ? actor.id : null,
      actor_name:   actor?.full_name || actor?.username || 'System',
      actor_role:   actor?.role || 'unknown',
      action:       action,
      entity_type:  entityType || null,
      entity_id:    entityId != null ? String(entityId) : null,
      entity_label: entityLabel || null,
      diff:         diff     || null,
      metadata:     metadata || null,
    })
  } catch (e) {
    // Silent — never break the main user action
    console.warn('[Audit] log failed silently:', e?.message)
  }
}

// ─── Action constants ─────────────────────────────────────────────────────────
export const AUDIT_ACTIONS = {
  // Orders / Billing
  ORDER_CREATED:          'ORDER_CREATED',
  ORDER_CANCELLED:        'ORDER_CANCELLED',
  ORDER_DISCOUNT_APPLIED: 'ORDER_DISCOUNT_APPLIED',
  // Expenses
  EXPENSE_ADDED:          'EXPENSE_ADDED',
  EXPENSE_DELETED:        'EXPENSE_DELETED',
  // Inventory
  ITEM_ADDED:             'ITEM_ADDED',
  ITEM_EDITED:            'ITEM_EDITED',
  ITEM_DELETED:           'ITEM_DELETED',
  // Salary
  SALARY_MARKED_PAID:     'SALARY_MARKED_PAID',
  // Sessions
  SESSION_OPENED:         'SESSION_OPENED',
  SESSION_CLOSED:         'SESSION_CLOSED',
  // Ledger
  LEDGER_TRANSACTION:     'LEDGER_TRANSACTION',
  // Cash
  CASH_COUNT_RECORDED:    'CASH_COUNT_RECORDED',
}
