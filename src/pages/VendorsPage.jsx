import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  Plus, Search, X, Edit2, Trash2, Package, ShoppingCart, CheckCircle, Clock, Ban
} from 'lucide-react'

const VENDOR_CATEGORIES = ['General', 'Grocery', 'Packaging', 'Dairy', 'Beverages', 'Tobacco', 'Cleaning', 'Other']

const STATUS_STYLE = {
  draft:     { label: 'Draft',     cls: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400' },
  ordered:   { label: 'Ordered',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  received:  { label: 'Received',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

export default function VendorsPage() {
  const { branchId, role, user } = useAuthStore()
  const isSuperAdmin = role === 'super_admin'
  const isAdmin = isSuperAdmin || role === 'admin'

  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [ledger, setLedger] = useState([])
  const [ledgerTab, setLedgerTab] = useState('ledger') // ledger | items | orders

  // Vendor form
  const [showVendorForm, setShowVendorForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', contact: '', category: 'General', notes: '' })
  const [saving, setSaving] = useState(false)

  // Payment recording form (replaces ledger entry form)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: '', mode: 'CASH', remarks: '', created_at: '', amount_cash: '', amount_upi: '' })
  const [editingLedgerId, setEditingLedgerId] = useState(null)

  // Items tagged to vendor
  const [vendorItems, setVendorItems] = useState([])

  // Purchase Orders
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [allItems, setAllItems] = useState([]) // all inventory items for this branch
  const [showPOForm, setShowPOForm] = useState(false)
  const [editingPO, setEditingPO] = useState(null) // PO being edited (draft only)
  const [poForm, setPOForm] = useState({ invoice_ref: '', payment_mode: 'CREDIT', amount_paid: '', notes: '', created_at: '', amount_paid_cash: '', amount_paid_upi: '' })
  const [poLines, setPOLines] = useState([{ item_id: '', quantity: '', unit_price: '', searchText: '' }])
  const [activeLineSearchIdx, setActiveLineSearchIdx] = useState(null)

  const [expandedPO, setExpandedPO] = useState(null)
  const [roundOff, setRoundOff] = useState(true)

  // Link items to vendor
  const [showLinkItem, setShowLinkItem] = useState(false)
  const [linkItemId, setLinkItemId] = useState('')
  const [linkCategoryId, setLinkCategoryId] = useState('')

  useEffect(() => { fetchVendors() }, [branchId])

  async function fetchVendors() {
    setLoading(true)
    let q = supabase.from('vendors').select('*').eq('is_active', true).order('name')
    if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`)
    const { data } = await q
    setVendors(data || [])
    setLoading(false)
  }

  // Full open — resets tab to ledger
  async function viewVendor(v) {
    setSelectedVendor(v)
    setLedgerTab('ledger')
    setShowPOForm(false)
    setExpandedPO(null)
    await refreshVendorData(v)
  }

  // Refresh data only — preserves current tab & UI state
  async function refreshVendorData(v) {
    const target = v || selectedVendor
    if (!target) return
    const [lRes, ivRes, poRes, allRes] = await Promise.all([
      supabase.from('vendor_ledger').select('*').eq('vendor_id', target.id).order('created_at', { ascending: false }),
      supabase.from('item_vendor').select('item_id').eq('vendor_id', target.id),
      supabase.from('vendor_purchase_orders').select('*, vendor_purchase_items(*, items(name, unit, units_per_box))').eq('vendor_id', target.id).order('created_at', { ascending: false }),
      supabase.from('items').select('id, name, category, unit, stock_quantity, units_per_box, price').eq('branch_id', target.branch_id || branchId || 'gurukul').eq('is_active', true).order('name'),
    ])
    setLedger(lRes.data || [])
    setPurchaseOrders(poRes.data || [])
    const allItemsList = allRes.data || []
    setAllItems(allItemsList)
    // Two-step items fetch: get IDs from item_vendor, then match from allItems
    const linkedIds = new Set((ivRes.data || []).map(r => r.item_id))
    setVendorItems(allItemsList.filter(it => linkedIds.has(it.id)))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Vendor name required')
    setSaving(true)
    try {
      if (editingId) {
        const { data, error } = await supabase.from('vendors').update({
          name: form.name, contact: form.contact, category: form.category, notes: form.notes
        }).eq('id', editingId).select().single()
        if (error) throw error
        setVendors(prev => prev.map(v => v.id === editingId ? { ...v, ...data } : v))
        if (selectedVendor?.id === editingId) setSelectedVendor(sv => ({ ...sv, ...data }))
        toast.success('Vendor updated')
      } else {
        const { data, error } = await supabase.from('vendors').insert({
          branch_id: branchId || null,
          name: form.name, contact: form.contact, category: form.category, notes: form.notes,
          is_active: true
        }).select().single()
        if (error) throw error
        setVendors(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success('Vendor added')
      }
      setShowVendorForm(false)
      setEditingId(null)
      setForm({ name: '', contact: '', category: 'General', notes: '' })
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(v) {
    if (!window.confirm(`Delete vendor "${v.name}"? This cannot be undone.`)) return
    try {
      if (!v.id) throw new Error("Vendor ID is missing! Schema might be corrupt.")
      const { data, error } = await supabase.from('vendors').update({ is_active: false }).eq('id', v.id).select().single()
      if (error) throw error
      setVendors(prev => prev.filter(vv => vv.id !== v.id))
      if (selectedVendor?.id === v.id) setSelectedVendor(null)
      toast.success('Vendor removed')
    } catch (e) {
      toast.error('Failed to delete: ' + e.message)
    }
  }

  function startEdit(v, e) {
    e?.stopPropagation()
    if (!v.id) {
      toast.error("Error: Vendor ID is missing. Cannot edit.")
      return
    }
    setForm({ name: v.name, contact: v.contact || '', category: v.category || 'General', notes: v.notes || '' })
    setEditingId(v.id)
    setShowVendorForm(true)
  }

  function handleEditPaymentClick(l) {
    const d = new Date(l.created_at)
    const localDateStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    
    let parsedMode = 'CASH'
    let parsedRemarks = l.reference || ''
    if (l.reference && (l.reference.startsWith('CASH') || l.reference.startsWith('UPI'))) {
      const parts = l.reference.split(' - ')
      parsedMode = parts[0]
      parsedRemarks = parts.slice(1).join(' - ')
    }
    
    setEditingLedgerId(l.id)
    setPaymentForm({
      amount: String(l.amount),
      mode: parsedMode,
      remarks: parsedRemarks,
      created_at: localDateStr,
      amount_cash: '',
      amount_upi: ''
    })
    setShowPaymentForm(true)
  }

  async function handleAddPayment(e) {
    e.preventDefault()
    const amt = paymentForm.mode === 'SPLIT'
      ? (parseFloat(paymentForm.amount_cash) || 0) + (parseFloat(paymentForm.amount_upi) || 0)
      : parseFloat(paymentForm.amount)
    if (!amt || amt <= 0) return toast.error('Enter valid amount')

    const currentPaymentAmt = editingLedgerId ? Number(ledger.find(l => l.id === editingLedgerId)?.amount || 0) : 0
    const maxAllowed = vendorBalance + currentPaymentAmt
    if (amt > maxAllowed) {
      toast.error(`Payment amount cannot exceed outstanding balance of ₹${maxAllowed.toFixed(2)}`)
      return
    }

    setSaving(true)
    try {
      const payloadBase = {
        vendor_id: selectedVendor.id,
        branch_id: branchId || selectedVendor.branch_id,
        type: 'PAYMENT',
        created_by: String(user.id).startsWith('hardcoded') ? null : user.id,
        recorded_by: user.username
      }
      if (paymentForm.created_at) {
        payloadBase.created_at = new Date(paymentForm.created_at).toISOString()
      }

      if (paymentForm.mode === 'SPLIT') {
        const cashAmt = parseFloat(paymentForm.amount_cash) || 0
        const upiAmt = parseFloat(paymentForm.amount_upi) || 0

        if (cashAmt > 0) {
          const refString = paymentForm.remarks.trim() ? `CASH - ${paymentForm.remarks.trim()}` : 'CASH'
          const { data, error } = await supabase.from('vendor_ledger').insert({
            ...payloadBase,
            amount: cashAmt,
            reference: refString
          }).select().single()
          if (error) throw error
          setLedger(prev => [data, ...prev])
        }

        if (upiAmt > 0) {
          const refString = paymentForm.remarks.trim() ? `UPI - ${paymentForm.remarks.trim()}` : 'UPI'
          const { data, error } = await supabase.from('vendor_ledger').insert({
            ...payloadBase,
            amount: upiAmt,
            reference: refString
          }).select().single()
          if (error) throw error
          setLedger(prev => [data, ...prev])
        }

        toast.success('Payments recorded')
      } else {
        const refString = paymentForm.remarks.trim()
          ? `${paymentForm.mode} - ${paymentForm.remarks.trim()}`
          : paymentForm.mode

        const payload = {
          ...payloadBase,
          amount: amt,
          reference: refString
        }

        if (editingLedgerId) {
          const { data, error } = await supabase.from('vendor_ledger').update(payload).eq('id', editingLedgerId).select().single()
          if (error) throw error
          setLedger(prev => prev.map(l => l.id === editingLedgerId ? data : l))
          toast.success('Payment updated')
        } else {
          const { data, error } = await supabase.from('vendor_ledger').insert(payload).select().single()
          if (error) throw error
          setLedger(prev => [data, ...prev])
          toast.success('Payment recorded')
        }
      }

      setShowPaymentForm(false)
      setEditingLedgerId(null)
      setPaymentForm({ amount: '', mode: 'CASH', remarks: '', created_at: '', amount_cash: '', amount_upi: '' })
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function deleteLedgerEntry(id) {
    if (!id || id === 'null') {
      toast.error(`Cannot delete: Entry ID is missing or invalid (${id})`)
      return
    }
    const entry = ledger.find(l => l.id === id)
    if (!entry) {
      toast.error('Entry not found')
      return
    }
    if (entry.type !== 'PAYMENT') {
      toast.error('Only payment entries can be deleted')
      return
    }
    if (!confirm('Delete this payment entry?')) return

    console.log("Deleting id:", id)
    const { error } = await supabase.from('vendor_ledger').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Payment deleted')
      setLedger(prev => prev.filter(l => l.id !== id))
    }
  }

  // ---- Purchase Order Functions ----
  const poTotal = useMemo(() => poLines.reduce((s, l) => s + (parseFloat(l.quantity)||0)*(parseFloat(l.unit_price)||0), 0), [poLines])

  function addPOLine() { setPOLines(p => [...p, { item_id: '', quantity: '', unit_price: '', searchText: '' }]) }
  function removePOLine(i) { setPOLines(p => p.filter((_, idx) => idx !== i)) }
  function updatePOLine(i, field, val) { setPOLines(p => p.map((l, idx) => idx === i ? { ...l, [field]: val } : l)) }

  // Weighted average CP + Dish cascade
  async function applyWeightedCostPrice(itemId, purchasedQty, purchaseUnitPrice) {
    const { data: itm } = await supabase.from('items').select('stock_quantity, cost_price, item_type').eq('id', itemId).single()
    if (!itm) return
    const existQty = itm.stock_quantity || 0
    const existCP = itm.cost_price || 0
    const newCP = existQty <= 0
      ? purchaseUnitPrice
      : ((existQty * existCP) + (purchasedQty * purchaseUnitPrice)) / (existQty + purchasedQty)
    await supabase.from('items').update({ cost_price: parseFloat(newCP.toFixed(4)) }).eq('id', itemId)
    // If raw material → cascade CP to all linked dishes
    if (itm.item_type === 'RAW_MATERIAL') {
      const { data: links } = await supabase.from('item_ingredients').select('item_id').eq('ingredient_item_id', itemId)
      for (const link of (links || [])) {
        const { data: allIngs } = await supabase.from('item_ingredients').select('quantity_per_unit, ingredient_item_id').eq('item_id', link.item_id)
        if (!allIngs?.length) continue
        const { data: ingItems } = await supabase.from('items').select('id, cost_price').in('id', allIngs.map(i => i.ingredient_item_id))
        const dishCP = allIngs.reduce((sum, ing) => {
          const ingItem = (ingItems || []).find(i => i.id === ing.ingredient_item_id)
          return sum + ((ingItem?.cost_price || 0) * ing.quantity_per_unit)
        }, 0)
        await supabase.from('items').update({ cost_price: parseFloat(dishCP.toFixed(4)) }).eq('id', link.item_id)
      }
    }
  }

  async function handleCreatePO(e, receiveNow) {
    e.preventDefault()
    const validLines = poLines.filter(l => l.item_id && parseFloat(l.quantity) > 0)
    if (!validLines.length) { toast.error('Add at least one item'); return }
    if (!poForm.notes || !poForm.notes.trim()) {
      toast.error('Remarks are required')
      return
    }
    const subtotal = validLines.reduce((s, l) => s + (parseFloat(l.quantity)||0)*(parseFloat(l.unit_price)||0), 0)
    const total = roundOff ? Math.round(subtotal) : subtotal
    const amtPaid = poForm.payment_mode === 'CREDIT'
      ? 0
      : poForm.payment_mode === 'SPLIT'
        ? (parseFloat(poForm.amount_paid_cash) || 0) + (parseFloat(poForm.amount_paid_upi) || 0)
        : (parseFloat(poForm.amount_paid) || 0)
    if (poForm.payment_mode !== 'CREDIT' && amtPaid > total) {
      toast.error('Amount paid cannot exceed total amount')
      return
    }
    setSaving(true)
    try {
      const newStatus = receiveNow ? 'received' : 'draft'
      const customDate = poForm.created_at ? new Date(poForm.created_at).toISOString() : undefined

      const { data: po, error: poErr } = await supabase.from('vendor_purchase_orders').insert({
        vendor_id: selectedVendor.id,
        branch_id: selectedVendor.branch_id || branchId || 'gurukul',
        status: newStatus,
        total_amount: total,
        amount_paid: amtPaid,
        payment_mode: poForm.payment_mode,
        invoice_ref: poForm.invoice_ref || null,
        notes: poForm.notes || null,
        received_at: receiveNow ? (customDate || new Date().toISOString()) : null,
        recorded_by: user.username,
        ...(customDate && { created_at: customDate })
      }).select().single()
      if (poErr) throw poErr

      await supabase.from('vendor_purchase_items').insert(
        validLines.map(l => ({ purchase_order_id: po.id, item_id: l.item_id, quantity: parseFloat(l.quantity), unit_price: parseFloat(l.unit_price)||0 }))
      )

      if (receiveNow) {
        for (const l of validLines) {
          const { data: itm } = await supabase.from('items').select('stock_quantity, units_per_box, cost_price').eq('id', l.item_id).single()
          const qBefore = itm?.stock_quantity || 0
          const unitsPerBox = itm?.units_per_box || 1
          const qChange = parseFloat(l.quantity) * unitsPerBox
          const unitPricePerUnit = (parseFloat(l.unit_price) || 0) / unitsPerBox
          await applyWeightedCostPrice(l.item_id, qChange, unitPricePerUnit)
          await supabase.rpc('increment_stock', { p_item_id: l.item_id, p_amount: qChange })
          await supabase.from('inventory_log').insert({ item_id: l.item_id, branch_id: po.branch_id, action: 'PURCHASE_IN', qty_before: qBefore, qty_change: qChange, qty_after: qBefore + qChange, reference_type: 'vendor_purchase_order', reference_id: po.id, recorded_by: user.username, ...(customDate && { created_at: customDate }) })
        }
        // Auto vendor ledger entries
        const remarksSuffix = poForm.notes ? ` - ${poForm.notes.trim()}` : ''
        const poRef = poForm.invoice_ref ? `PO ${po.id.slice(0,8)} (${poForm.invoice_ref})` : `PO ${po.id.slice(0,8)}`
        const purchaseRef = `${poRef}${remarksSuffix}`
        await supabase.from('vendor_ledger').insert({ vendor_id: selectedVendor.id, branch_id: po.branch_id, type: 'PURCHASE', amount: total, reference: purchaseRef, recorded_by: user.username, ...(customDate && { created_at: customDate }) })
        
        if (poForm.payment_mode === 'SPLIT') {
          const cashAmt = parseFloat(poForm.amount_paid_cash) || 0
          const upiAmt = parseFloat(poForm.amount_paid_upi) || 0
          if (cashAmt > 0) {
            await supabase.from('vendor_ledger').insert({
              vendor_id: selectedVendor.id,
              branch_id: po.branch_id,
              type: 'PAYMENT',
              amount: cashAmt,
              reference: poForm.invoice_ref ? `CASH - ${poForm.invoice_ref}` : `CASH - PO ${po.id.slice(0,8)}`,
              recorded_by: user.username,
              ...(customDate && { created_at: customDate })
            })
          }
          if (upiAmt > 0) {
            await supabase.from('vendor_ledger').insert({
              vendor_id: selectedVendor.id,
              branch_id: po.branch_id,
              type: 'PAYMENT',
              amount: upiAmt,
              reference: poForm.invoice_ref ? `UPI - ${poForm.invoice_ref}` : `UPI - PO ${po.id.slice(0,8)}`,
              recorded_by: user.username,
              ...(customDate && { created_at: customDate })
            })
          }
        } else {
          if (amtPaid > 0) {
            await supabase.from('vendor_ledger').insert({
              vendor_id: selectedVendor.id,
              branch_id: po.branch_id,
              type: 'PAYMENT',
              amount: amtPaid,
              reference: poForm.invoice_ref ? `${poForm.payment_mode} - ${poForm.invoice_ref}` : `${poForm.payment_mode} - PO ${po.id.slice(0,8)}`,
              recorded_by: user.username,
              ...(customDate && { created_at: customDate })
            })
          }
        }
      }

      toast.success(receiveNow ? 'Purchase received & stock updated!' : 'Draft purchase order saved')
      setShowPOForm(false)
      setPOForm({ invoice_ref: '', payment_mode: 'CREDIT', amount_paid: '', notes: '', created_at: '', amount_paid_cash: '', amount_paid_upi: '' })
      setPOLines([{ item_id: '', quantity: '', unit_price: '', searchText: '' }])
      await refreshVendorData()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function markAsReceived(po) {
    if (!window.confirm('Mark this order as received? This will update inventory stock.')) return
    setSaving(true)
    try {
      const { data: lines } = await supabase.from('vendor_purchase_items').select('*, items(stock_quantity, units_per_box, cost_price)').eq('purchase_order_id', po.id)
      for (const l of (lines || [])) {
        const qBefore = l.items?.stock_quantity || 0
        const unitsPerBox = l.items?.units_per_box || 1
        const qChange = l.quantity * unitsPerBox
        const unitPricePerUnit = (l.unit_price || 0) / unitsPerBox
        await applyWeightedCostPrice(l.item_id, qChange, unitPricePerUnit)
        await supabase.rpc('increment_stock', { p_item_id: l.item_id, p_amount: qChange })
        await supabase.from('inventory_log').insert({ item_id: l.item_id, branch_id: po.branch_id, action: 'PURCHASE_IN', qty_before: qBefore, qty_change: qChange, qty_after: qBefore + qChange, reference_type: 'vendor_purchase_order', reference_id: po.id, recorded_by: user.username })
      }
      await supabase.from('vendor_purchase_orders').update({ status: 'received', received_at: new Date().toISOString() }).eq('id', po.id)
      
      const remarksSuffix = po.notes ? ` - ${po.notes.trim()}` : ''
      const poRef = po.invoice_ref ? `PO ${po.id.slice(0,8)} (${po.invoice_ref})` : `PO ${po.id.slice(0,8)}`
      const purchaseRef = `${poRef}${remarksSuffix}`
      await supabase.from('vendor_ledger').insert({ vendor_id: po.vendor_id, branch_id: po.branch_id, type: 'PURCHASE', amount: po.total_amount, reference: purchaseRef, recorded_by: user.username })
      
      if (po.payment_mode === 'SPLIT') {
        if (po.amount_paid > 0) {
          await supabase.from('vendor_ledger').insert({
            vendor_id: po.vendor_id, branch_id: po.branch_id,
            type: 'PAYMENT', amount: po.amount_paid,
            reference: po.invoice_ref ? `SPLIT - ${po.invoice_ref}` : `SPLIT - PO ${po.id.slice(0,8)}`,
            recorded_by: user.username
          })
        }
      } else {
        if (po.amount_paid > 0) {
          await supabase.from('vendor_ledger').insert({ vendor_id: po.vendor_id, branch_id: po.branch_id, type: 'PAYMENT', amount: po.amount_paid, reference: po.invoice_ref ? `${po.payment_mode} - ${po.invoice_ref}` : `${po.payment_mode} - PO ${po.id.slice(0,8)}`, recorded_by: user.username })
        }
      }
      toast.success('Stock updated & ledger entries created!')
      await refreshVendorData()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function cancelPO(po) {
    if (!window.confirm('Cancel this purchase order?')) return
    await supabase.from('vendor_purchase_orders').update({ status: 'cancelled' }).eq('id', po.id)
    await refreshVendorData()
  }

  async function deletePO(po) {
    const isReceived = po.status === 'received'
    const msg = isReceived
      ? 'Delete this received purchase order? Stock already added will be REVERSED. Are you sure?'
      : 'Delete this purchase order? This cannot be undone.'
    if (!window.confirm(msg)) return
    setSaving(true)
    try {
      // If received, reverse the stock increment
      if (isReceived) {
        const { data: lines } = await supabase.from('vendor_purchase_items')
          .select('*, items(stock_quantity, units_per_box)').eq('purchase_order_id', po.id)
        for (const l of (lines || [])) {
          const upb = l.items?.units_per_box || 1
          const qReverse = l.quantity * upb
          await supabase.rpc('decrement_stock', { p_item_id: l.item_id, p_amount: qReverse })
          await supabase.from('inventory_log').insert({
            item_id: l.item_id, branch_id: po.branch_id, action: 'MANUAL_ADJUST',
            qty_before: l.items?.stock_quantity || 0, qty_change: -qReverse,
            qty_after: Math.max(0, (l.items?.stock_quantity || 0) - qReverse),
            reference_type: 'vendor_purchase_order', reference_id: po.id,
            recorded_by: user.username
          })
        }
        // Remove auto-created ledger entries tied to this PO
        await supabase.from('vendor_ledger')
          .delete()
          .eq('vendor_id', po.vendor_id)
          .like('reference', `%${po.id.slice(0,8)}%`)
      }
      // Delete line items then order
      await supabase.from('vendor_purchase_items').delete().eq('purchase_order_id', po.id)
      await supabase.from('vendor_purchase_orders').delete().eq('id', po.id)
      toast.success(isReceived ? 'Purchase deleted & stock reversed' : 'Purchase deleted')
      await refreshVendorData()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  // Create ledger entries for a received PO that somehow missed them
  async function syncPOLedger(po) {
    setSaving(true)
    try {
      const remarksSuffix = po.notes ? ` - ${po.notes.trim()}` : ''
      const poRef = po.invoice_ref ? `PO ${po.id.slice(0,8)} (${po.invoice_ref})` : `PO ${po.id.slice(0,8)}`
      const purchaseRef = `${poRef}${remarksSuffix}`
      await supabase.from('vendor_ledger').insert({
        vendor_id: po.vendor_id, branch_id: po.branch_id,
        type: 'PURCHASE', amount: po.total_amount,
        reference: purchaseRef,
        recorded_by: user.username
      })
      if (po.payment_mode === 'SPLIT') {
        if (po.amount_paid > 0) {
          await supabase.from('vendor_ledger').insert({
            vendor_id: po.vendor_id, branch_id: po.branch_id,
            type: 'PAYMENT', amount: po.amount_paid,
            reference: po.invoice_ref ? `SPLIT - ${po.invoice_ref}` : `SPLIT - PO ${po.id.slice(0,8)}`,
            recorded_by: user.username
          })
        }
      } else {
        if (po.amount_paid > 0) {
          await supabase.from('vendor_ledger').insert({
            vendor_id: po.vendor_id, branch_id: po.branch_id,
            type: 'PAYMENT', amount: po.amount_paid,
            reference: po.invoice_ref ? `${po.payment_mode} - ${po.invoice_ref}` : `${po.payment_mode} - PO ${po.id.slice(0,8)}`,
            recorded_by: user.username
          })
        }
      }
      toast.success('Ledger entries created')
      await refreshVendorData()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  function startEditPO(po) {
    setEditingPO(po)
    const localDateStr = po.created_at ? new Date(new Date(po.created_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
    const isSplit = po.payment_mode === 'SPLIT'
    setPOForm({
      invoice_ref: po.invoice_ref || '',
      payment_mode: po.payment_mode || 'CREDIT',
      amount_paid: po.amount_paid || '',
      notes: po.notes || '',
      created_at: localDateStr,
      amount_paid_cash: isSplit ? String(Number(po.amount_paid) / 2) : '',
      amount_paid_upi: isSplit ? String(Number(po.amount_paid) / 2) : ''
    })
    setPOLines((po.vendor_purchase_items || []).map(li => ({
      id: li.id,
      item_id: li.item_id,
      quantity: String(li.quantity),
      unit_price: String(li.unit_price),
      searchText: li.items?.name || ''
    })))
    setShowPOForm(true)
    setExpandedPO(null)
  }

  async function handleUpdatePO(e) {
    e.preventDefault()
    const validLines = poLines.filter(l => l.item_id && parseFloat(l.quantity) > 0)
    if (!validLines.length) { toast.error('Add at least one item'); return }
    if (!poForm.notes || !poForm.notes.trim()) {
      toast.error('Remarks are required')
      return
    }
    const subtotal = validLines.reduce((s, l) => s + (parseFloat(l.quantity)||0)*(parseFloat(l.unit_price)||0), 0)
    const total = roundOff ? Math.round(subtotal) : subtotal
    const amtPaid = poForm.payment_mode === 'CREDIT'
      ? 0
      : poForm.payment_mode === 'SPLIT'
        ? (parseFloat(poForm.amount_paid_cash) || 0) + (parseFloat(poForm.amount_paid_upi) || 0)
        : (parseFloat(poForm.amount_paid) || 0)
    if (poForm.payment_mode !== 'CREDIT' && amtPaid > total) {
      toast.error('Amount paid cannot exceed total amount')
      return
    }
    setSaving(true)
    try {
      const customDate = poForm.created_at ? new Date(poForm.created_at).toISOString() : undefined
      await supabase.from('vendor_purchase_orders').update({
        total_amount: total,
        amount_paid: amtPaid,
        payment_mode: poForm.payment_mode,
        invoice_ref: poForm.invoice_ref || null,
        notes: poForm.notes || null,
        ...(customDate && { created_at: customDate })
      }).eq('id', editingPO.id)
      // Replace all line items
      await supabase.from('vendor_purchase_items').delete().eq('purchase_order_id', editingPO.id)
      await supabase.from('vendor_purchase_items').insert(
        validLines.map(l => ({ purchase_order_id: editingPO.id, item_id: l.item_id, quantity: parseFloat(l.quantity), unit_price: parseFloat(l.unit_price)||0 }))
      )
      toast.success('Purchase order updated')
      setShowPOForm(false)
      setEditingPO(null)
      setPOForm({ invoice_ref: '', payment_mode: 'CREDIT', amount_paid: '', notes: '', created_at: '', amount_paid_cash: '', amount_paid_upi: '' })
      setPOLines([{ item_id: '', quantity: '', unit_price: '', searchText: '' }])
      await refreshVendorData()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function linkCategoryToVendor() {
    if (!linkCategoryId) { toast.error('Select a category'); return }
    const unlinkedInCat = allItems.filter(it => it.category === linkCategoryId && !vendorItems.find(v => v.id === it.id))
    if (!unlinkedInCat.length) { toast('All items in this category are already linked'); return }
    setSaving(true)
    try {
      const rows = unlinkedInCat.map(it => ({
        item_id: it.id,
        vendor_id: selectedVendor.id,
        branch_id: selectedVendor.branch_id || branchId || 'gurukul'
      }))
      const { error } = await supabase.from('item_vendor').insert(rows)
      if (error) throw error
      toast.success(`${unlinkedInCat.length} item${unlinkedInCat.length > 1 ? 's' : ''} in "${linkCategoryId}" linked`)
      setLinkCategoryId('')
      await refreshVendorData()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function linkItemToVendor() {
    if (!linkItemId) { toast.error('Select an item'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('item_vendor').insert({
        item_id: linkItemId,
        vendor_id: selectedVendor.id,
        branch_id: selectedVendor.branch_id || branchId || 'gurukul'
      })
      if (error) throw error
      toast.success('Item linked to vendor')
      setLinkItemId('')
      await refreshVendorData()  // preserve Items tab
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function unlinkItemFromVendor(itemId) {
    if (!window.confirm('Unlink this item from vendor?')) return
    const { error } = await supabase.from('item_vendor').delete().eq('item_id', itemId).eq('vendor_id', selectedVendor.id)
    if (error) toast.error(error.message)
    else { toast.success('Item unlinked'); await refreshVendorData() }
  }

  // Compute vendor balance: PURCHASE = amount owed to vendor (debit), PAYMENT = paid
  const vendorBalance = useMemo(() =>
    ledger.reduce((s, l) =>
      l.type === 'PURCHASE' ? s + Number(l.amount) : s - Number(l.amount)
    , 0)
  , [ledger])

  const totalSpent = useMemo(() =>
    ledger.filter(l => l.type === 'PAYMENT').reduce((s, l) => s + Number(l.amount), 0)
  , [ledger])

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.contact || '').includes(search) ||
    (v.category || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-6rem)] animate-fade-in">
      {/* Left: Vendor List */}
      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-950/30 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-ink-900 dark:text-white tracking-tight">Vendors</h1>
              <p className="text-sm text-ink-500 mt-0.5">{vendors.length} active vendors</p>
            </div>
            {isAdmin && (
              <button onClick={() => { setShowVendorForm(!showVendorForm); setEditingId(null); setForm({ name: '', contact: '', category: 'General', notes: '' }) }}
                className="btn-primary px-4 py-2">
                <Plus size={15} /> Add Vendor
              </button>
            )}
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input className="input pl-9 w-full" placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Add/Edit form */}
        {showVendorForm && (
          <div className="p-4 bg-ember/5 border-b border-ember/20 animate-slide-up">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-black text-ember uppercase tracking-widest">{editingId ? 'Edit Vendor' : 'New Vendor'}</span>
              <button onClick={() => { setShowVendorForm(false); setEditingId(null) }} className="text-ink-400 hover:text-ink-700"><X size={14}/></button>
            </div>
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Vendor Name *</label>
                <input className="input" required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Supplier Co." autoFocus />
              </div>
              <div>
                <label className="label">Contact / Phone</label>
                <input className="input" value={form.contact} onChange={e => setForm(p => ({...p, contact: e.target.value}))} placeholder="9876543210" />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}>
                  {VENDOR_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <input className="input" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Optional notes" />
              </div>
              <div className="sm:col-span-2 flex gap-2 justify-end">
                <button type="button" onClick={() => setShowVendorForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : (editingId ? 'Update' : 'Add Vendor')}</button>
              </div>
            </form>
          </div>
        )}

        {/* Vendor list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? Array(5).fill(0).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)
            : filtered.length === 0 ? <p className="text-center py-12 text-ink-400 text-sm">No vendors found</p>
            : filtered.map(v => (
              <button key={v.id} onClick={() => viewVendor(v)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3
                  ${selectedVendor?.id === v.id ? 'border-ember bg-ember/5' : 'border-transparent hover:bg-ink-50 dark:hover:bg-ink-800 hover:border-ink-200 dark:hover:border-ink-700'}`}>
                <div className="w-10 h-10 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center font-black text-ink-600 dark:text-ink-400 text-lg shrink-0">
                  {v.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink-900 dark:text-white truncate">{v.name}</div>
                  <div className="text-xs text-ink-500 flex gap-2 mt-0.5">
                    <span className="badge-default text-[9px]">{v.category}</span>
                    {v.contact && <span className="font-mono">{v.contact}</span>}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={e => startEdit(v, e)} className="p-1.5 text-ink-400 hover:text-ember hover:bg-ember/10 rounded-lg transition-colors"><Edit2 size={14}/></button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(v) }} className="p-1.5 text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={14}/></button>
                  </div>
                )}
              </button>
            ))
          }
        </div>
      </div>

      {/* Right: Vendor Ledger Panel */}
      {selectedVendor && (
        <div className="md:w-[480px] flex flex-col bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm shrink-0 animate-slide-in-right">
          {/* Header */}
          <div className="p-5 bg-ink-900 text-white border-b border-ink-800 relative">
            <button onClick={() => setSelectedVendor(null)} className="absolute top-4 right-4 p-2 bg-ink-800 hover:bg-red-500 rounded-full transition-colors"><X size={14}/></button>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center font-black text-2xl">{selectedVendor.name[0]}</div>
              <div>
                <h2 className="font-black text-xl">{selectedVendor.name}</h2>
                <div className="flex gap-2 mt-1 text-xs text-white/60">
                  <span className="bg-white/10 px-2 py-0.5 rounded">{selectedVendor.category}</span>
                  {selectedVendor.contact && <span>{selectedVendor.contact}</span>}
                </div>
              </div>
            </div>
            {/* Balance summary */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-white/10 p-3 rounded-xl">
                <div className="text-[10px] text-white/50 uppercase tracking-widest mb-1">Outstanding</div>
                <div className={`font-black text-lg ${vendorBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>₹{Math.abs(vendorBalance).toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-white/10 p-3 rounded-xl">
                <div className="text-[10px] text-white/50 uppercase tracking-widest mb-1">Paid</div>
                <div className="font-black text-lg text-emerald-400">₹{totalSpent.toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-white/10 p-3 rounded-xl">
                <div className="text-[10px] text-white/50 uppercase tracking-widest mb-1">Items</div>
                <div className="font-black text-lg text-white">{vendorItems.length}</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-ink-200 dark:border-ink-800 px-2">
            {[['ledger','Ledger'],['orders','Purchases'],['items','Items']].map(([tab, label]) => (
              <button key={tab} onClick={() => setLedgerTab(tab)}
                className={`px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${ledgerTab === tab ? 'border-ember text-ember' : 'border-transparent text-ink-500 hover:text-ink-900 dark:hover:text-white'}`}>
                {label}
              </button>
            ))}
            {isAdmin && ledgerTab === 'ledger' && vendorBalance > 0 && (
              <button onClick={() => { setEditingLedgerId(null); setPaymentForm({ amount: '', mode: 'CASH', remarks: '', created_at: '', amount_cash: '', amount_upi: '' }); setShowPaymentForm(!showPaymentForm); }} className="ml-auto px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors">
                Record Payment
              </button>
            )}
            {isAdmin && ledgerTab === 'orders' && (
              <button onClick={() => { setShowPOForm(p => !p); setPOLines([{ item_id: '', quantity: '', unit_price: '', searchText: '' }]); setPOForm({ invoice_ref: '', payment_mode: 'CREDIT', amount_paid: '', notes: '', created_at: '', amount_paid_cash: '', amount_paid_upi: '' }) }} className="ml-auto px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors">
                + New Purchase
              </button>
            )}
          </div>

          {/* Payment recording form */}
          {showPaymentForm && (
            <form onSubmit={handleAddPayment} className="p-4 bg-ink-50 dark:bg-ink-950/30 border-b border-ink-200 dark:border-ink-800 space-y-3 animate-slide-up">
              <div className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                {editingLedgerId ? 'Edit Payment' : 'Record Payment'}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {paymentForm.mode === 'SPLIT' ? (
                  <>
                    <div>
                      <label className="label">Amount Cash (₹) *</label>
                      <input type="number" min="0.01" step="0.01" required className="input text-sm font-bold" value={paymentForm.amount_cash} onChange={e => setPaymentForm(p => ({...p, amount_cash: e.target.value}))} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="label">Amount UPI / Online (₹) *</label>
                      <input type="number" min="0.01" step="0.01" required className="input text-sm font-bold" value={paymentForm.amount_upi} onChange={e => setPaymentForm(p => ({...p, amount_upi: e.target.value}))} placeholder="0.00" />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="label">Amount (₹) *</label>
                    <input type="number" min="0.01" step="0.01" required className="input text-sm font-bold" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({...p, amount: e.target.value}))} placeholder="0.00" />
                  </div>
                )}
                <div>
                  <label className="label">Payment Mode *</label>
                  <select className="input text-sm" value={paymentForm.mode} onChange={e => setPaymentForm(p => ({...p, mode: e.target.value}))}>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    {!editingLedgerId && <option value="SPLIT">Split (Cash + UPI)</option>}
                  </select>
                </div>
                <div>
                  <label className="label">Remarks</label>
                  <input className="input text-sm" value={paymentForm.remarks} onChange={e => setPaymentForm(p => ({...p, remarks: e.target.value}))} placeholder="Reference or notes" />
                </div>
                <div>
                  <label className="label">Date (Optional)</label>
                  <input type="datetime-local" className="input text-sm" value={paymentForm.created_at} onChange={e => setPaymentForm(p => ({...p, created_at: e.target.value}))} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowPaymentForm(false); setEditingLedgerId(null); }} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700">{saving ? '…' : (editingLedgerId ? 'Update Payment' : 'Record Payment')}</button>
              </div>
            </form>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-ink-50 dark:bg-ink-950">

            {/* LEDGER TAB */}
            {ledgerTab === 'ledger' && (
              ledger.length === 0
                ? <p className="text-center py-10 text-ink-400 text-sm">No ledger entries yet</p>
                : ledger.map(l => (
                  <div key={l.id} className="group bg-white dark:bg-ink-900 p-3 rounded-xl border border-ink-200 dark:border-ink-800 flex items-center justify-between gap-3 transition-all hover:border-ink-300 dark:hover:border-ink-700">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          l.type === 'PURCHASE' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                          l.type === 'PAYMENT' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          'bg-ink-100 text-ink-600'
                        }`}>{l.type}</span>
                        {l.reference && <span className="text-xs text-ink-500 font-medium">{l.reference}</span>}
                      </div>

                      {/* Remarks Display */}
                      {(() => {
                        let remarkText = ''
                        if (l.type === 'PURCHASE') {
                          // Try to find PO notes matching this PO reference
                          const poShortId = l.reference?.match(/PO\s+([a-f0-9]{8})/i)?.[1]
                          const match = poShortId ? purchaseOrders.find(po => po.id.slice(0,8) === poShortId) : null
                          remarkText = match?.notes || ''
                          
                          // Fallback to text after " - " if stored in reference
                          if (!remarkText && l.reference?.includes(' - ')) {
                            remarkText = l.reference.split(' - ').slice(1).join(' - ')
                          }
                        } else if (l.type === 'PAYMENT') {
                          if (l.reference?.includes(' - ')) {
                            remarkText = l.reference.split(' - ').slice(1).join(' - ')
                          } else {
                            remarkText = l.reference || ''
                          }
                        }
                        
                        return remarkText ? (
                          <p className="text-xs text-ink-500 mt-2 bg-ink-50 dark:bg-ink-950/40 p-2 border-l-2 border-ink-300 dark:border-ink-700 rounded-r-lg whitespace-normal">
                            <strong className="text-ink-600 dark:text-ink-400">Remarks: </strong>
                            {remarkText}
                          </p>
                        ) : null
                      })()}

                      <div className="text-[10px] text-ink-400 mt-1 font-bold">{new Date(l.created_at).toLocaleString('en-IN')}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`font-black text-base tabular-nums ${l.type === 'PURCHASE' ? 'text-red-500' : 'text-emerald-500'}`}>
                        {l.type === 'PURCHASE' ? '+' : '-'}₹{Number(l.amount).toLocaleString('en-IN')}
                      </div>
                      {l.type === 'PAYMENT' && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => handleEditPaymentClick(l)} className="p-1 text-ink-400 hover:text-ember"><Edit2 size={12}/></button>
                          <button onClick={() => deleteLedgerEntry(l.id)} className="p-1 text-ink-400 hover:text-red-500"><Trash2 size={12}/></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
            )}

            {/* PURCHASE ORDERS TAB */}
            {ledgerTab === 'orders' && (
              <div className="space-y-3">
                {/* Create PO Form */}
                {showPOForm && (
                  <div className="bg-white dark:bg-ink-900 rounded-xl border border-emerald-300 dark:border-emerald-800 p-4 space-y-3 animate-slide-up">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                        {editingPO ? `Edit Purchase Order · ${editingPO.invoice_ref || editingPO.id.slice(0,8)}` : 'New Purchase Order'}
                      </span>
                      <button onClick={() => { setShowPOForm(false); setEditingPO(null) }}><X size={14} className="text-ink-400" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Invoice / Bill Ref</label>
                        <input className="input text-sm" value={poForm.invoice_ref} onChange={e => setPOForm(p => ({...p, invoice_ref: e.target.value}))} placeholder="e.g. INV-001" />
                      </div>
                      <div>
                        <label className="label">Date (Optional)</label>
                        <input type="datetime-local" className="input text-sm" value={poForm.created_at} onChange={e => setPOForm(p => ({...p, created_at: e.target.value}))} />
                      </div>
                      <div>
                        <label className="label">Payment Mode</label>
                        <select className="input text-sm" value={poForm.payment_mode} onChange={e => setPOForm(p => ({...p, payment_mode: e.target.value}))}>
                          <option value="CREDIT">Credit (Owe Vendor)</option>
                          <option value="PARTIAL">Partial (Part-Pay)</option>
                          <option value="CASH">Cash (Paid Now)</option>
                          <option value="UPI">UPI (Paid Now)</option>
                          <option value="SPLIT">Split (Cash + UPI)</option>
                        </select>
                      </div>
                      {poForm.payment_mode !== 'CREDIT' && poForm.payment_mode !== 'SPLIT' && (
                        <div>
                          <label className="label">Amount Paid (₹)</label>
                          <input type="number" min="0" step="0.01" className="input text-sm font-bold" value={poForm.amount_paid} onChange={e => setPOForm(p => ({...p, amount_paid: e.target.value}))} placeholder="0.00" />
                        </div>
                      )}
                      {poForm.payment_mode === 'SPLIT' && (
                        <>
                          <div>
                            <label className="label">Amount Paid Cash (₹)</label>
                            <input type="number" min="0" step="0.01" className="input text-sm font-bold" value={poForm.amount_paid_cash || ''} onChange={e => setPOForm(p => ({...p, amount_paid_cash: e.target.value}))} placeholder="0.00" />
                          </div>
                          <div>
                            <label className="label">Amount Paid UPI (₹)</label>
                            <input type="number" min="0" step="0.01" className="input text-sm font-bold" value={poForm.amount_paid_upi || ''} onChange={e => setPOForm(p => ({...p, amount_paid_upi: e.target.value}))} placeholder="0.00" />
                          </div>
                        </>
                      )}
                      {poForm.payment_mode === 'PARTIAL' && (
                        <div className="col-span-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-2.5 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-bold">
                          Outstanding Credit (Owed to Vendor): ₹{((roundOff ? Math.round(poTotal) : poTotal) - (parseFloat(poForm.amount_paid) || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                        </div>
                      )}
                      {poForm.payment_mode === 'SPLIT' && (
                        <div className="col-span-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-2.5 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-bold">
                          Total Paid: ₹{((parseFloat(poForm.amount_paid_cash) || 0) + (parseFloat(poForm.amount_paid_upi) || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                          <br />
                          Outstanding Credit (Owed to Vendor): ₹{((roundOff ? Math.round(poTotal) : poTotal) - ((parseFloat(poForm.amount_paid_cash) || 0) + (parseFloat(poForm.amount_paid_upi) || 0))).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                        </div>
                      )}
                      {poForm.payment_mode === 'PARTIAL' && (
                        <div className="col-span-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-2.5 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-bold">
                          Outstanding Credit (Owed to Vendor): ₹{(poTotal - (parseFloat(poForm.amount_paid) || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                        </div>
                      )}
                      <div className="col-span-2">
                        <label className="label">Remarks <span className="text-red-500">*</span></label>
                        <textarea rows={3} required className="input text-sm w-full" value={poForm.notes} onChange={e => setPOForm(p => ({...p, notes: e.target.value}))} placeholder="Required remarks..." />
                      </div>
                    </div>
                    {/* Line Items */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_80px_80px_28px] gap-1 text-[10px] font-black text-ink-400 uppercase px-1">
                        <span>Item</span><span>Qty</span><span>Price/Unit</span><span/>
                      </div>
                      {poLines.map((line, i) => (
                        <div key={i} className="grid grid-cols-[1fr_80px_80px_28px] gap-1 items-center">
                          {line.item_id ? (
                            <div className="flex items-center justify-between bg-ink-100 dark:bg-ink-800 text-xs px-2 py-1.5 rounded-lg border border-ink-300 dark:border-ink-700 max-w-[250px]">
                              <span className="truncate font-bold text-ink-900 dark:text-white">
                                {(() => {
                                  const item = allItems.find(it => it.id === line.item_id)
                                  if (!item) return ''
                                  const upb = item.units_per_box || 1
                                  return `${item.name} (${upb > 1 ? `box of ${upb}` : item.unit})`
                                })()}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  updatePOLine(i, 'item_id', '')
                                  updatePOLine(i, 'searchText', '')
                                }}
                                className="text-ink-400 hover:text-red-500 ml-1 flex-shrink-0"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="relative">
                              <input
                                type="text"
                                className="input text-xs w-full"
                                placeholder="Type to search item..."
                                value={line.searchText || ''}
                                onChange={e => {
                                  updatePOLine(i, 'searchText', e.target.value)
                                  setActiveLineSearchIdx(i)
                                }}
                                onFocus={() => setActiveLineSearchIdx(i)}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setActiveLineSearchIdx(current => current === i ? null : current)
                                  }, 200)
                                }}
                              />
                              {activeLineSearchIdx === i && line.searchText && (
                                <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-lg shadow-lg">
                                  {(() => {
                                    const searchVal = (line.searchText || '').toLowerCase()
                                    const matched = allItems.filter(it => {
                                      const alreadySelected = poLines.some((pl, plIdx) => plIdx !== i && pl.item_id === it.id)
                                      return !alreadySelected && it.name.toLowerCase().includes(searchVal)
                                    })
                                    
                                    if (matched.length === 0) {
                                      return <div className="p-2 text-xs text-ink-400 text-center">No items found</div>
                                    }
                                    
                                    return matched.map(it => {
                                      const upb = it.units_per_box || 1
                                      return (
                                        <button
                                          key={it.id}
                                          type="button"
                                          onClick={() => {
                                            updatePOLine(i, 'item_id', it.id)
                                            updatePOLine(i, 'searchText', it.name)
                                            setActiveLineSearchIdx(null)
                                          }}
                                          className="w-full text-left px-3 py-2 text-xs hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-900 dark:text-white border-b border-ink-100 dark:border-ink-800 last:border-b-0"
                                        >
                                          {it.name} ({upb > 1 ? `box of ${upb}` : it.unit}) — stock: {it.stock_quantity}
                                        </button>
                                      )
                                    })
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                          {(() => {
                            const selItem = allItems.find(it => it.id === line.item_id)
                            const upb = selItem?.units_per_box || 1
                            const boxes = parseFloat(line.quantity) || 0
                            return (
                              <div className="flex flex-col gap-0.5">
                                <input
                                  type="number"
                                  min="0.001"
                                  step="any"
                                  className="input text-xs text-center"
                                  placeholder={upb > 1 ? 'Boxes' : 'Qty'}
                                  value={line.quantity}
                                  onChange={e => updatePOLine(i, 'quantity', e.target.value)}
                                  disabled={!line.item_id}
                                />
                                {upb > 1 && boxes > 0 && <span className="text-[9px] text-amber-600 text-center font-bold">{boxes}×{upb}={boxes*upb} {selItem.unit}s</span>}
                              </div>
                            )
                          })()}
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input text-xs text-center"
                            placeholder={(() => { const s = allItems.find(it => it.id === line.item_id); return s?.units_per_box > 1 ? '₹/box' : '₹/unit' })()}
                            value={line.unit_price}
                            onChange={e => updatePOLine(i, 'unit_price', e.target.value)}
                            disabled={!line.item_id}
                          />
                          <button onClick={() => removePOLine(i)} className="text-ink-400 hover:text-red-500"><X size={13}/></button>
                        </div>
                      ))}
                      <button onClick={addPOLine} className="text-xs text-emerald-600 font-bold hover:underline">+ Add item</button>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-ink-100 dark:border-ink-800">
                      <div className="flex flex-col gap-0.5">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-ink-600 dark:text-ink-400">
                          <input
                            type="checkbox"
                            className="rounded border-ink-300 text-ember focus:ring-ember"
                            checked={roundOff}
                            onChange={e => setRoundOff(e.target.checked)}
                          />
                          Smart Round Off
                        </label>
                        {roundOff ? (
                          <div className="text-[10px] text-ink-400">
                            Subtotal: ₹{poTotal.toFixed(2)} · Diff: ₹{(Math.round(poTotal) - poTotal).toFixed(2)}
                          </div>
                        ) : null}
                      </div>
                      <span className="font-black text-ink-900 dark:text-white">
                        Total: ₹{(roundOff ? Math.round(poTotal) : poTotal).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                      </span>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-ink-100 dark:border-ink-800">
                      {editingPO ? (
                        <button type="button" onClick={handleUpdatePO} disabled={saving} className="btn-primary text-xs">{saving ? '…' : 'Update Order'}</button>
                      ) : (
                        <>
                          <button type="button" onClick={e => handleCreatePO(e, false)} disabled={saving} className="btn-secondary text-xs">{saving ? '…' : 'Save Draft'}</button>
                          <button type="button" onClick={e => handleCreatePO(e, true)} disabled={saving} className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700">{saving ? '…' : '✓ Receive Now'}</button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* PO List */}
                {purchaseOrders.length === 0 && !showPOForm && (
                  <p className="text-center py-10 text-ink-400 text-sm">No purchase orders yet. Click &ldquo;+ New Purchase&rdquo; to begin.</p>
                )}
                {purchaseOrders.map(po => {
                  const st = STATUS_STYLE[po.status] || STATUS_STYLE.draft
                  const isExpanded = expandedPO === po.id
                  return (
                    <div key={po.id} className="bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 overflow-hidden">
                      <button className="w-full p-3 flex items-center gap-3 text-left hover:bg-ink-50 dark:hover:bg-ink-800" onClick={() => setExpandedPO(isExpanded ? null : po.id)}>
                        <Package size={15} className="text-ink-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                            {po.invoice_ref && <span className="text-xs text-ink-500 font-mono">{po.invoice_ref}</span>}
                          </div>
                          <div className="text-[10px] text-ink-400 mt-0.5">{new Date(po.created_at).toLocaleString('en-IN')} · {po.payment_mode}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-black text-ink-900 dark:text-white">₹{Number(po.total_amount).toLocaleString('en-IN')}</div>
                          {po.amount_paid > 0 && <div className="text-[10px] text-emerald-500">Paid ₹{Number(po.amount_paid).toLocaleString('en-IN')}</div>}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-2 border-t border-ink-100 dark:border-ink-800 pt-2">
                          {(po.vendor_purchase_items || []).map(li => {
                            const upb = li.items?.units_per_box || 1
                            const totalUnits = li.quantity * upb
                            return (
                              <div key={li.id} className="flex justify-between text-xs">
                                <span className="text-ink-700 dark:text-ink-300">
                                  {li.items?.name}
                                  {upb > 1
                                    ? <span className="text-ink-400"> ×{li.quantity} box{li.quantity !== 1 ? 'es' : ''} <span className="text-amber-600">= {totalUnits} {li.items?.unit}s</span></span>
                                    : <span className="text-ink-400"> ×{li.quantity} {li.items?.unit}</span>
                                  }
                                </span>
                                <span className="font-bold tabular-nums">₹{(li.quantity * li.unit_price).toFixed(2)}</span>
                              </div>
                            )
                          })}
                          {isAdmin && (
                            <div className="flex gap-2 pt-2 flex-wrap">
                              {/* Edit — always allowed; received orders warn about stock */}
                              <button onClick={() => startEditPO(po)} className="px-3 py-1.5 text-xs font-bold text-amber-600 border border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"><Edit2 size={12} className="inline mr-1"/>Edit</button>

                              {/* Mark Received — only for draft/ordered */}
                              {(po.status === 'draft' || po.status === 'ordered') && (
                                <button onClick={() => markAsReceived(po)} disabled={saving} className="flex-1 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors">
                                  {saving ? '…' : '✓ Mark Received'}
                                </button>
                              )}

                              {/* Cancel — draft/ordered only */}
                              {(po.status === 'draft' || po.status === 'ordered') && (
                                <button onClick={() => cancelPO(po)} className="px-3 py-1.5 text-xs font-bold text-red-500 border border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">Cancel</button>
                              )}

                              {/* Delete — all statuses */}
                              <button onClick={() => deletePO(po)} disabled={saving} className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg transition-colors"><Trash2 size={12} className="inline mr-1"/>Delete</button>
                            </div>
                          )}
                          {po.status === 'received' && (() => {
                            // Check if this PO already has ledger entries
                            const poRef = po.invoice_ref || `PO ${po.id.slice(0,8)}`
                            const hasLedger = ledger.some(l => l.reference && l.reference.includes(poRef.split(' ').pop()))
                            return (
                              <div className="flex items-center justify-between pt-1">
                                <p className="text-[10px] text-emerald-600 font-bold">✓ Stock updated {po.received_at ? `· ${new Date(po.received_at).toLocaleDateString('en-IN')}` : ''}</p>
                                {!hasLedger && isAdmin && (
                                  <button onClick={() => syncPOLedger(po)} disabled={saving} className="text-[10px] font-bold text-blue-600 hover:underline px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200">
                                    {saving ? '…' : '↑ Sync to Ledger'}
                                  </button>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ITEMS TAB */}
            {ledgerTab === 'items' && (
              <div className="space-y-3">
                {isAdmin && (
                  <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 p-3 space-y-3">
                    <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Link items to this vendor</p>

                    {/* Link by Category */}
                    <div>
                      <p className="text-[10px] text-ink-500 mb-1.5">By Category <span className="text-amber-600">(links all items in category at once)</span></p>
                      <div className="flex gap-2">
                        <select className="input text-xs flex-1" value={linkCategoryId} onChange={e => setLinkCategoryId(e.target.value)}>
                          <option value="">Select category…</option>
                          {[...new Set(allItems.map(it => it.category))].sort().map(cat => {
                            const total = allItems.filter(it => it.category === cat).length
                            const linked = vendorItems.filter(it => it.category === cat).length
                            return <option key={cat} value={cat}>{cat} ({linked}/{total} linked)</option>
                          })}
                        </select>
                        <button onClick={linkCategoryToVendor} disabled={saving || !linkCategoryId} className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-50 transition-colors">{saving ? '…' : 'Link All'}</button>
                      </div>
                    </div>

                    {/* Link single item */}
                    <div>
                      <p className="text-[10px] text-ink-500 mb-1.5">By Item</p>
                      <div className="flex gap-2">
                        <select className="input text-xs flex-1" value={linkItemId} onChange={e => setLinkItemId(e.target.value)}>
                          <option value="">Select item to link…</option>
                          {allItems.filter(it => !vendorItems.find(v => v.id === it.id)).map(it => (
                            <option key={it.id} value={it.id}>{it.name} ({it.unit}) — stock: {it.stock_quantity}</option>
                          ))}
                        </select>
                        <button onClick={linkItemToVendor} disabled={saving || !linkItemId} className="btn-primary text-xs px-4 disabled:opacity-50">{saving ? '…' : '+ Link'}</button>
                      </div>
                    </div>
                  </div>
                )}
                {vendorItems.length === 0
                  ? <p className="text-center py-8 text-ink-400 text-sm">No items linked yet. Use the selectors above to link items.</p>
                  : (() => {
                    // Group by category
                    const groups = {}
                    vendorItems.forEach(it => {
                      if (!groups[it.category]) groups[it.category] = []
                      groups[it.category].push(it)
                    })
                    return Object.entries(groups).map(([cat, items]) => (
                      <div key={cat} className="space-y-1.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest">{cat} <span className="text-ink-300">· {items.length}</span></span>
                          {isAdmin && (
                            <button onClick={async () => {
                              if (!window.confirm(`Unlink all ${items.length} items in "${cat}" from this vendor?`)) return
                              setSaving(true)
                              try {
                                await supabase.from('item_vendor').delete()
                                  .in('item_id', items.map(i => i.id))
                                  .eq('vendor_id', selectedVendor.id)
                                toast.success(`${items.length} items unlinked`)
                                await refreshVendorData()
                              } catch(e) { toast.error(e.message) }
                              finally { setSaving(false) }
                            }} className="text-[10px] font-bold text-red-400 hover:text-red-600 hover:underline">
                              Unlink all
                            </button>
                          )}
                        </div>
                        {items.map(item => (
                          <div key={item.id} className="group bg-white dark:bg-ink-900 p-3 rounded-xl border border-ink-200 dark:border-ink-800 flex justify-between items-center">
                            <div>
                              <div className="font-bold text-sm text-ink-900 dark:text-white">{item.name}</div>
                              <div className="text-[10px] text-ink-500">{item.unit}{item.units_per_box > 1 ? ` · box of ${item.units_per_box}` : ''}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="font-black text-ink-900 dark:text-white">₹{item.price}</div>
                                <div className="text-[10px] text-ink-400">Stock: {item.stock_quantity}</div>
                              </div>
                              {isAdmin && (
                                <button onClick={() => unlinkItemFromVendor(item.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                                  <Trash2 size={13}/>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  })()
                }
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
