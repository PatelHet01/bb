import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { ArrowLeftRight, Download, Plus, RefreshCw, Send, X, TrendingUp, TrendingDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { logAudit, AUDIT_ACTIONS } from '../lib/auditLogger'


export default function InternalLedgerPage() {
  const { user, branchId, role } = useAuthStore()
  const { currentSession } = useSessionStore()

  const [activeForm, setActiveForm] = useState('b2b') // default B2B first
  const [usersList, setUsersList] = useState([])
  const [branchesList, setBranchesList] = useState([])
  
  // Form states
  const [amount, setAmount] = useState('')
  const [purpose, setPurpose] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [fromUser, setFromUser] = useState('')
  const [toUser, setToUser] = useState('')
  const [fromBranch, setFromBranch] = useState('')
  const [toBranch, setToBranch] = useState('')

  // Split details
  const [splitCash, setSplitCash] = useState(0)
  const [splitUpi, setSplitUpi] = useState(0)
  const [splitBank, setSplitBank] = useState(0)

  // Edit states
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [editPurpose, setEditPurpose] = useState('')
  const [editPaymentMethod, setEditPaymentMethod] = useState('CASH')
  const [editReferenceNo, setEditReferenceNo] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editFromBranch, setEditFromBranch] = useState('')
  const [editToBranch, setEditToBranch] = useState('')
  const [editFromUser, setEditFromUser] = useState('')
  const [editToUser, setEditToUser] = useState('')
  const [editStatus, setEditStatus] = useState('confirmed')
  const [editSplitCash, setEditSplitCash] = useState(0)
  const [editSplitUpi, setEditSplitUpi] = useState(0)
  const [editSplitBank, setEditSplitBank] = useState(0)

  const [loading, setLoading] = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(true)
  const [ledger, setLedger] = useState([])
  const [branchBalances, setBranchBalances] = useState([])
  const [selectedPair, setSelectedPair] = useState(null)
  const [pairTransactions, setPairTransactions] = useState([])
  const [modalLoading, setModalLoading] = useState(false)

  // Helper functions for serializing/deserializing split payment details
  function serializePaymentMethod(method, splits) {
    if (method === 'SPLIT') {
      return `SPLIT: CASH=${splits.cash}, UPI=${splits.upi}, BANK_TRANSFER=${splits.bank}`
    }
    return method
  }

  function deserializePaymentMethod(val) {
    if (val && val.startsWith('SPLIT:')) {
      const parts = val.replace('SPLIT:', '').split(',')
      const splits = { cash: 0, upi: 0, bank: 0 }
      parts.forEach(part => {
        const [k, v] = part.trim().split('=')
        if (k === 'CASH') splits.cash = parseFloat(v) || 0
        if (k === 'UPI') splits.upi = parseFloat(v) || 0
        if (k === 'BANK_TRANSFER') splits.bank = parseFloat(v) || 0
      })
      return { method: 'SPLIT', splits }
    }
    return { method: val || 'CASH', splits: { cash: 0, upi: 0, bank: 0 } }
  }

  const transactionTypeOptions = useMemo(() => {
    const options = [
      { id: 'b2b', label: 'Business → Business' },
      { id: 'p2b', label: 'Personal → Business' },
    ]
    if (role === 'super_admin') {
      options.push({ id: 'p2p', label: 'Personal → Personal' })
    }
    return options
  }, [role])

  const displayedPairs = useMemo(() => {
    const list = []
    if (!branchesList || branchesList.length === 0) return list

    if (branchId) {
      const otherBranches = branchesList.filter(b => b.id !== branchId)
      otherBranches.forEach(ob => {
        const key = [branchId, ob.id].sort().join('||')
        const balData = branchBalances.find(p => [p.aId, p.bId].sort().join('||') === key)
        list.push({
          b1: branchesList.find(b => b.id === branchId),
          b2: ob,
          balData: balData || { aId: [branchId, ob.id].sort()[0], bId: [branchId, ob.id].sort()[1], aToB: 0, bToA: 0 }
        })
      })
    } else {
      // Super admin sees all pairs
      for (let i = 0; i < branchesList.length; i++) {
        for (let j = i + 1; j < branchesList.length; j++) {
          const b1 = branchesList[i]
          const b2 = branchesList[j]
          const key = [b1.id, b2.id].sort().join('||')
          const balData = branchBalances.find(p => [p.aId, p.bId].sort().join('||') === key)
          list.push({
            b1,
            b2,
            balData: balData || { aId: [b1.id, b2.id].sort()[0], bId: [b1.id, b2.id].sort()[1], aToB: 0, bToA: 0 }
          })
        }
      }
    }
    return list
  }, [branchesList, branchId, branchBalances])



  // Filters
  const [filterType, setFilterType] = useState('all')
  const [filterBranch, setFilterBranch] = useState('all')

  useEffect(() => {
    fetchUsers()
    fetchBranches()
    fetchLedger()
    fetchBranchBalances()
  }, [branchId])

  // Split calculations
  useEffect(() => {
    if (paymentMethod === 'SPLIT') {
      const total = parseFloat(amount) || 0
      setSplitCash(total)
      setSplitUpi(0)
      setSplitBank(0)
    }
  }, [paymentMethod])

  useEffect(() => {
    if (editPaymentMethod === 'SPLIT') {
      const total = parseFloat(editAmount) || 0
      const currentSum = parseFloat(editSplitCash || 0) + parseFloat(editSplitUpi || 0) + parseFloat(editSplitBank || 0)
      if (Math.abs(currentSum - total) > 0.01) {
        setEditSplitCash(total)
        setEditSplitUpi(0)
        setEditSplitBank(0)
      }
    }
  }, [editPaymentMethod])

  const handleSplitCashChange = (val) => {
    const total = parseFloat(amount) || 0
    const num = Math.min(total, Math.max(0, parseFloat(val) || 0))
    setSplitCash(num)
    
    const remaining = total - num
    const b = parseFloat(splitBank) || 0
    const newUpi = remaining - b
    if (newUpi >= 0) {
      setSplitUpi(Math.round(newUpi * 100) / 100)
    } else {
      setSplitUpi(0)
      setSplitBank(Math.round(remaining * 100) / 100)
    }
  }

  const handleSplitUpiChange = (val) => {
    const total = parseFloat(amount) || 0
    const num = Math.min(total, Math.max(0, parseFloat(val) || 0))
    setSplitUpi(num)
    
    const remaining = total - num
    const c = parseFloat(splitCash) || 0
    const newBank = remaining - c
    if (newBank >= 0) {
      setSplitBank(Math.round(newBank * 100) / 100)
    } else {
      setSplitBank(0)
      setSplitCash(Math.round(remaining * 100) / 100)
    }
  }

  const handleSplitBankChange = (val) => {
    const total = parseFloat(amount) || 0
    const num = Math.min(total, Math.max(0, parseFloat(val) || 0))
    setSplitBank(num)
    
    const remaining = total - num
    const u = parseFloat(splitUpi) || 0
    const newCash = remaining - u
    if (newCash >= 0) {
      setSplitCash(Math.round(newCash * 100) / 100)
    } else {
      setSplitCash(0)
      setSplitUpi(Math.round(remaining * 100) / 100)
    }
  }

  const handleEditSplitCashChange = (val) => {
    const total = parseFloat(editAmount) || 0
    const num = Math.min(total, Math.max(0, parseFloat(val) || 0))
    setEditSplitCash(num)
    
    const remaining = total - num
    const b = parseFloat(editSplitBank) || 0
    const newUpi = remaining - b
    if (newUpi >= 0) {
      setEditSplitUpi(Math.round(newUpi * 100) / 100)
    } else {
      setEditSplitUpi(0)
      setEditSplitBank(Math.round(remaining * 100) / 100)
    }
  }

  const handleEditSplitUpiChange = (val) => {
    const total = parseFloat(editAmount) || 0
    const num = Math.min(total, Math.max(0, parseFloat(val) || 0))
    setEditSplitUpi(num)
    
    const remaining = total - num
    const c = parseFloat(editSplitCash) || 0
    const newBank = remaining - c
    if (newBank >= 0) {
      setEditSplitBank(Math.round(newBank * 100) / 100)
    } else {
      setEditSplitBank(0)
      setEditSplitCash(Math.round(remaining * 100) / 100)
    }
  }

  const handleEditSplitBankChange = (val) => {
    const total = parseFloat(editAmount) || 0
    const num = Math.min(total, Math.max(0, parseFloat(val) || 0))
    setEditSplitBank(num)
    
    const remaining = total - num
    const u = parseFloat(editSplitUpi) || 0
    const newCash = remaining - u
    if (newCash >= 0) {
      setEditSplitCash(Math.round(newCash * 100) / 100)
    } else {
      setEditSplitCash(0)
      setEditSplitUpi(Math.round(remaining * 100) / 100)
    }
  }

  const handleEditTotalAmountChange = (val) => {
    setEditAmount(val)
    const total = parseFloat(val) || 0
    if (editPaymentMethod === 'SPLIT') {
      const u = parseFloat(editSplitUpi || 0)
      const b = parseFloat(editSplitBank || 0)
      const newCash = total - u - b
      if (newCash >= 0) {
        setEditSplitCash(Math.round(newCash * 100) / 100)
      } else {
        setEditSplitCash(0)
        const newUpi = total - b
        if (newUpi >= 0) {
          setEditSplitUpi(Math.round(newUpi * 100) / 100)
        } else {
          setEditSplitUpi(0)
          setEditSplitBank(Math.round(total * 100) / 100)
        }
      }
    }
  }

  function openEditTransaction(t) {
    setEditingTransaction(t)
    setEditAmount(String(t.amount))
    setEditPurpose(t.purpose || '')
    setEditReferenceNo(t.reference_no || '')
    setEditNotes(t.notes || '')
    setEditStatus(t.status || 'confirmed')
    
    const { method, splits } = deserializePaymentMethod(t.payment_method)
    setEditPaymentMethod(method)
    setEditSplitCash(splits.cash)
    setEditSplitUpi(splits.upi)
    setEditSplitBank(splits.bank)
    
    setEditFromBranch(t.from_entity_type === 'BRANCH' ? t.from_entity_id : '')
    setEditToBranch(t.to_entity_type === 'BRANCH' ? t.to_entity_id : '')
    setEditFromUser(t.from_entity_type === 'USER' ? t.from_entity_id : '')
    setEditToUser(t.to_entity_type === 'USER' ? t.to_entity_id : '')
  }

  async function handleDeleteTransaction(id) {
    if (!window.confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return
    }
    
    try {
      const { data: txn, error: fetchErr } = await supabase
        .from('internal_ledger')
        .select('*')
        .eq('id', id)
        .single()
        
      if (fetchErr) throw fetchErr
      
      const { error } = await supabase
        .from('internal_ledger')
        .delete()
        .eq('id', id)
        
      if (error) throw error
      
      toast.success('Transaction deleted successfully!')
      
      logAudit({
        branchId: txn?.branch_id || branchId,
        actor: user,
        action: AUDIT_ACTIONS.LEDGER_TRANSACTION,
        entityType: 'ledger',
        entityId: id,
        entityLabel: `Delete ${txn?.transaction_type?.replace(/_/g, ' ')}: ${txn?.from_entity_name} → ${txn?.to_entity_name} - ₹${txn?.amount}`
      })
      
      fetchLedger()
      fetchBranchBalances()
      if (selectedPair) {
        handleCardClick(selectedPair.b1.id, selectedPair.b2.id)
      }
    } catch (err) {
      toast.error('Failed to delete: ' + err.message)
    }
  }

  async function handleUpdateLedger(e) {
    e.preventDefault()
    if (!editingTransaction) return
    
    const finalAmount = parseFloat(editAmount)
    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    
    try {
      let payload = {
        amount: finalAmount,
        purpose: editPurpose,
        payment_method: serializePaymentMethod(editPaymentMethod, { cash: editSplitCash, upi: editSplitUpi, bank: editSplitBank }),
        reference_no: editReferenceNo,
        notes: editNotes,
        status: editStatus
      }
      
      if (editingTransaction.transaction_type === 'PERSONAL_TO_BUSINESS') {
        const uRec = usersList.find(u => u.id === editFromUser)
        const bRec = branchesList.find(b => b.id === editToBranch)
        if (!editFromUser || !editToBranch) {
          toast.error('Please fill required fields')
          return
        }
        payload.from_entity_id = editFromUser
        payload.from_entity_name = uRec?.username || 'User'
        payload.to_entity_id = editToBranch
        payload.to_entity_name = bRec?.name || 'Branch'
      } else if (editingTransaction.transaction_type === 'BUSINESS_TO_BUSINESS') {
        const bFromRec = branchesList.find(b => b.id === editFromBranch)
        const bToRec = branchesList.find(b => b.id === editToBranch)
        if (!editFromBranch || !editToBranch) {
          toast.error('Please fill required fields')
          return
        }
        payload.from_entity_id = editFromBranch
        payload.from_entity_name = bFromRec?.name || 'Branch From'
        payload.to_entity_id = editToBranch
        payload.to_entity_name = bToRec?.name || 'Branch To'
      } else if (editingTransaction.transaction_type === 'PERSONAL_TO_PERSONAL') {
        const uFromRec = usersList.find(u => u.id === editFromUser)
        const uToRec = usersList.find(u => u.id === editToUser)
        if (!editFromUser || !editToUser) {
          toast.error('Please fill required fields')
          return
        }
        payload.from_entity_id = editFromUser
        payload.from_entity_name = uFromRec?.username || 'User From'
        payload.to_entity_id = editToUser
        payload.to_entity_name = uToRec?.username || 'User To'
      }
      
      const { error } = await supabase
        .from('internal_ledger')
        .update(payload)
        .eq('id', editingTransaction.id)
        
      if (error) throw error
      
      toast.success('Transaction updated successfully!')
      
      logAudit({
        branchId: editingTransaction.branch_id || branchId,
        actor: user,
        action: AUDIT_ACTIONS.LEDGER_TRANSACTION,
        entityType: 'ledger',
        entityId: editingTransaction.id,
        entityLabel: `Edit ${editingTransaction.transaction_type?.replace(/_/g, ' ')}: ${payload.from_entity_name} → ${payload.to_entity_name} - ₹${payload.amount}`,
        diff: {
          before: {
            amount: editingTransaction.amount,
            purpose: editingTransaction.purpose,
            payment_method: editingTransaction.payment_method,
            from_entity_id: editingTransaction.from_entity_id,
            to_entity_id: editingTransaction.to_entity_id,
            status: editingTransaction.status
          },
          after: payload
        }
      })
      
      setEditingTransaction(null)
      fetchLedger()
      fetchBranchBalances()
      if (selectedPair) {
        handleCardClick(selectedPair.b1.id, selectedPair.b2.id)
      }
    } catch (err) {
      toast.error('Failed to update: ' + err.message)
    }
  }

  async function fetchUsers() {
    // Exclude device-registered accounts (contain '_device_' in username)
    const { data } = await supabase
      .from('users')
      .select('id, username, full_name, role')
      .eq('is_active', true)
      .not('username', 'like', '%_device_%')
      .order('full_name')
    if (data) setUsersList(data)
  }

  async function fetchBranches() {
    const { data } = await supabase.from('branches').select('id, name')
    if (data) setBranchesList(data)
  }

  async function fetchBranchBalances() {
    // Fetch all confirmed B2B transactions
    const { data } = await supabase
      .from('internal_ledger')
      .select('from_entity_id, from_entity_name, to_entity_id, to_entity_name, amount')
      .eq('transaction_type', 'BUSINESS_TO_BUSINESS')
      .eq('status', 'confirmed')

    if (!data || data.length === 0) { setBranchBalances([]); return }

    // Build pair map
    const pairMap = {}
    data.forEach(t => {
      const a = t.from_entity_id, b = t.to_entity_id
      if (!a || !b || a === b) return
      // canonical key: smaller id first
      const key = [a, b].sort().join('||')
      if (!pairMap[key]) pairMap[key] = {
        aId: [a,b].sort()[0], bId: [a,b].sort()[1],
        aName: '', bName: '',
        aToB: 0, bToA: 0
      }
      if (a < b) pairMap[key].aToB += Number(t.amount)
      else       pairMap[key].bToA += Number(t.amount)
      // capture names
      if (t.from_entity_id === [a,b].sort()[0]) pairMap[key].aName = t.from_entity_name
      else pairMap[key].bName = t.from_entity_name
      if (t.to_entity_id === [a,b].sort()[0]) pairMap[key].aName = t.to_entity_name
      else pairMap[key].bName = t.to_entity_name
    })

    setBranchBalances(Object.values(pairMap))
  }

  async function handleCardClick(b1Id, b2Id) {
    const b1 = branchesList.find(b => b.id === b1Id) || { id: b1Id, name: b1Id.toUpperCase() }
    const b2 = branchesList.find(b => b.id === b2Id) || { id: b2Id, name: b2Id.toUpperCase() }
    setSelectedPair({ b1, b2 })
    setModalLoading(true)
    
    try {
      const { data, error } = await supabase
        .from('internal_ledger')
        .select('*, users!created_by(username)')
        .eq('transaction_type', 'BUSINESS_TO_BUSINESS')
        .or(`from_entity_id.eq.${b1Id},to_entity_id.eq.${b1Id}`)
        .order('created_at', { ascending: false })
        
      if (error) throw error
      
      const filtered = (data || []).filter(t => 
        (t.from_entity_id === b1Id && t.to_entity_id === b2Id) ||
        (t.from_entity_id === b2Id && t.to_entity_id === b1Id)
      )
      
      setPairTransactions(filtered)
    } catch (e) {
      toast.error('Failed to fetch transaction details: ' + e.message)
    } finally {
      setModalLoading(false)
    }
  }


  async function fetchLedger() {
    setLedgerLoading(true)
    let q = supabase
      .from('internal_ledger')
      .select('*, users!created_by(username)')
      .order('created_at', { ascending: false })

    if (role !== 'super_admin') {
      const b = branchId || 'gurukul'
      q = q.eq('branch_id', b)
    }

    const { data, error } = await q
    if (!error) {
      setLedger(data || [])
    }
    setLedgerLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    const finalAmount = parseFloat(amount)
    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast.error('Please enter a valid amount')
      setLoading(false)
      return
    }

    const targetBranch = branchId || 'gurukul'

    try {
      let payload = {
        amount: finalAmount,
        purpose,
        payment_method: serializePaymentMethod(paymentMethod, { cash: splitCash, upi: splitUpi, bank: splitBank }),
        reference_no: referenceNo,
        notes,
        branch_id: targetBranch,
        session_id: currentSession?.id || null,
        created_by: user?.id && !String(user.id).startsWith('hardcoded') ? user.id : null
      }

      if (activeForm === 'p2b') {
        const uRec = usersList.find(u => u.id === fromUser)
        const bRec = branchesList.find(b => b.id === toBranch)
        if (!fromUser || !toBranch) {
          toast.error('Please fill required fields')
          setLoading(false)
          return
        }
        payload = {
          ...payload,
          transaction_type: 'PERSONAL_TO_BUSINESS',
          from_entity_type: 'USER',
          from_entity_id: fromUser,
          from_entity_name: uRec?.username || 'User',
          to_entity_type: 'BRANCH',
          to_entity_id: toBranch,
          to_entity_name: bRec?.name || 'Branch',
          status: 'confirmed'
        }
      } else if (activeForm === 'b2b') {
        const bFromRec = branchesList.find(b => b.id === fromBranch)
        const bToRec = branchesList.find(b => b.id === toBranch)
        if (!fromBranch || !toBranch) {
          toast.error('Please fill required fields')
          setLoading(false)
          return
        }
        payload = {
          ...payload,
          transaction_type: 'BUSINESS_TO_BUSINESS',
          from_entity_type: 'BRANCH',
          from_entity_id: fromBranch,
          from_entity_name: bFromRec?.name || 'Branch From',
          to_entity_type: 'BRANCH',
          to_entity_id: toBranch,
          to_entity_name: bToRec?.name || 'Branch To',
          notes,
          status: 'confirmed'
        }
      } else if (activeForm === 'p2p') {
        const uFromRec = usersList.find(u => u.id === fromUser)
        const uToRec = usersList.find(u => u.id === toUser)
        if (!fromUser || !toUser) {
          toast.error('Please fill required fields')
          setLoading(false)
          return
        }
        payload = {
          ...payload,
          transaction_type: 'PERSONAL_TO_PERSONAL',
          from_entity_type: 'USER',
          from_entity_id: fromUser,
          from_entity_name: uFromRec?.username || 'User From',
          to_entity_type: 'USER',
          to_entity_id: toUser,
          to_entity_name: uToRec?.username || 'User To',
          status: 'confirmed'
        }
      }

      const { error } = await supabase.from('internal_ledger').insert(payload)
      if (error) throw error

      toast.success('Internal ledger transaction recorded successfully!')
      logAudit({
        branchId: targetBranch,
        actor: user,
        action: AUDIT_ACTIONS.LEDGER_TRANSACTION,
        entityType: 'ledger',
        entityLabel: `${payload.transaction_type?.replace(/_/g, ' ') || 'Ledger Tx'}: ${payload.from_entity_name || ''} → ${payload.to_entity_name || ''} - ₹${payload.amount}`
      })

      
      // Reset forms
      setAmount('')
      setPurpose('')
      setPaymentMethod('CASH')
      setReferenceNo('')
      setNotes('')
      setFromUser('')
      setToUser('')
      setFromBranch('')
      setToBranch('')
      setSplitCash(0)
      setSplitUpi(0)
      setSplitBank(0)

      fetchLedger()
      fetchBranchBalances()
      if (selectedPair) {
        handleCardClick(selectedPair.b1.id, selectedPair.b2.id)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id) {
    try {
      const { error } = await supabase
        .from('internal_ledger')
        .update({ status: 'confirmed', approved_by: user?.id && !String(user.id).startsWith('hardcoded') ? user.id : null })
        .eq('id', id)
      if (error) throw error
      toast.success('Transaction approved!')
      
      const txn = ledger.find(l => l.id === id)
      logAudit({
        branchId: txn?.branch_id || branchId,
        actor: user,
        action: AUDIT_ACTIONS.LEDGER_TRANSACTION,
        entityType: 'ledger',
        entityId: id,
        entityLabel: txn 
          ? `Approve B2B: ${txn.from_entity_name} → ${txn.to_entity_name} - ₹${txn.amount}`
          : `Approve Transaction ID: ${id}`
      })

      fetchLedger()
      fetchBranchBalances()
      if (selectedPair) {
        handleCardClick(selectedPair.b1.id, selectedPair.b2.id)
      }

    } catch (e) {
      toast.error(e.message)
    }
  }

  function exportToCSV() {
    const headers = ['Date,Type,From,To,Amount,Purpose,Method,Status,Recorded By\n']
    const rows = ledger.map(l => {
      const date = new Date(l.created_at).toLocaleDateString('en-IN')
      return `"${date}","${l.transaction_type}","${l.from_entity_name}","${l.to_entity_name}",${l.amount},"${l.purpose || ''}","${l.payment_method}","${l.status}","${l.users?.username || 'System'}"`
    })
    const blob = new Blob([headers.concat(rows.join('\n'))], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('href', url)
    a.setAttribute('download', `BB_Internal_Ledger_${new Date().toISOString().split('T')[0]}.csv`)
    a.click()
  }

  const filteredLedger = ledger.filter(l => {
    if (filterType !== 'all' && l.transaction_type !== filterType) return false
    if (filterBranch !== 'all' && l.branch_id !== filterBranch) return false
    return true
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-ink-900 dark:text-white tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="text-ember" /> Internal Ledger
          </h1>
          <p className="text-sm font-semibold text-ink-500 mt-1 uppercase tracking-widest">Inter-Branch & Staff Financial Ledger</p>
        </div>
        <button onClick={exportToCSV} className="btn-secondary flex items-center gap-2 py-2.5 px-4 font-bold text-xs">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Branch Balance Cards */}
      {displayedPairs.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-3">Branch-to-Branch Net Balances</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedPairs.map((pair, idx) => {
              const isB1Smaller = pair.b1.id < pair.b2.id
              const sent = isB1Smaller ? pair.balData.aToB : pair.balData.bToA
              const received = isB1Smaller ? pair.balData.bToA : pair.balData.aToB
              const net = sent - received
              const settled = Math.abs(net) < 1
              const toTake = net > 0

              return (
                <div
                  key={idx}
                  onClick={() => handleCardClick(pair.b1.id, pair.b2.id)}
                  className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 p-5 shadow-sm hover:scale-[1.02] hover:border-ember/40 cursor-pointer transition-all duration-200 relative group overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-black text-ink-700 dark:text-ink-200 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="text-ember font-black">{pair.b1.name}</span>
                      <span className="text-ink-300">↔</span>
                      <span className="text-ink-600 dark:text-ink-400">{pair.b2.name}</span>
                    </p>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      settled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' :
                      toTake ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30'
                    }`}>
                      {settled ? '✓ Settled' : toTake ? 'To Take' : 'To Give'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-ink-500">
                      <span>Sent to {pair.b2.name}:</span>
                      <span className="font-bold text-ink-900 dark:text-white">₹{Number(sent).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-ink-500">
                      <span>Received from {pair.b2.name}:</span>
                      <span className="font-bold text-ink-900 dark:text-white">₹{Number(received).toLocaleString('en-IN')}</span>
                    </div>

                    <div className="border-t border-ink-100 dark:border-ink-800 pt-2.5 mt-2 flex justify-between items-center">
                      <span className="font-black text-ink-500 uppercase tracking-widest text-[9px]">
                        {settled ? 'Net Flow' : toTake ? 'To Take (Credit)' : 'To Give (Debit)'}
                      </span>
                      <span className={`text-base font-black flex items-center gap-1 ${
                        settled ? 'text-emerald-600' :
                        toTake ? 'text-emerald-600 dark:text-emerald-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {!settled && (toTake ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
                        ₹{Math.abs(Math.round(net)).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-ember scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side Form */}
        <div className="md:col-span-2 bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 p-6 space-y-6 shadow-sm">
          <div>
            <label className="label">Transaction Type</label>
            <select
              className="select w-full"
              value={activeForm}
              onChange={e => {
                setActiveForm(e.target.value)
                // Reset fields
                setAmount('')
                setPurpose('')
              }}
            >
              {transactionTypeOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeForm === 'p2b' && (
                <>
                  <div>
                    <label className="label">From User (Staff/Partner)</label>
                    <select
                      required
                      className="select w-full"
                      value={fromUser}
                      onChange={e => setFromUser(e.target.value)}
                    >
                      <option value="">Select User</option>
                      {usersList.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name || u.username} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">To Branch</label>
                    <select
                      required
                      className="select w-full"
                      value={toBranch}
                      onChange={e => setToBranch(e.target.value)}
                    >
                      <option value="">Select Branch</option>
                      {branchesList.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeForm === 'b2b' && (
                <>
                  <div>
                    <label className="label">From Branch</label>
                    <select
                      required
                      className="select w-full"
                      value={fromBranch}
                      onChange={e => setFromBranch(e.target.value)}
                    >
                      <option value="">Select Branch</option>
                      {branchesList.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">To Branch</label>
                    <select
                      required
                      className="select w-full"
                      value={toBranch}
                      onChange={e => setToBranch(e.target.value)}
                    >
                      <option value="">Select Branch</option>
                      {branchesList.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeForm === 'p2p' && (
                <>
                  <div>
                    <label className="label">From User</label>
                    <select
                      required
                      className="select w-full"
                      value={fromUser}
                      onChange={e => setFromUser(e.target.value)}
                    >
                      <option value="">Select User</option>
                      {usersList.map(u => (
                        <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">To User</label>
                    <select
                      required
                      className="select w-full"
                      value={toUser}
                      onChange={e => setToUser(e.target.value)}
                    >
                      <option value="">Select User</option>
                      {usersList.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name || u.username} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="input w-full font-black text-lg"
                  value={amount}
                  onChange={e => {
                    const val = e.target.value
                    setAmount(val)
                    const total = parseFloat(val) || 0
                    if (paymentMethod === 'SPLIT') {
                      const u = parseFloat(splitUpi || 0)
                      const b = parseFloat(splitBank || 0)
                      const newCash = total - u - b
                      if (newCash >= 0) {
                        setSplitCash(Math.round(newCash * 100) / 100)
                      } else {
                        setSplitCash(0)
                        const newUpi = total - b
                        if (newUpi >= 0) {
                          setSplitUpi(Math.round(newUpi * 100) / 100)
                        } else {
                          setSplitUpi(0)
                          setSplitBank(Math.round(total * 100) / 100)
                        }
                      }
                    }
                  }}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="label">Payment Mode</label>
                <select
                  className="select w-full"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="SPLIT">Split Payment</option>
                </select>
              </div>
            </div>

            {paymentMethod === 'SPLIT' && (
              <div className="p-4 bg-ink-50 dark:bg-ink-950 border border-ink-200 dark:border-ink-800 rounded-2xl space-y-3">
                <p className="text-[10px] font-black text-ink-500 uppercase tracking-widest">Split Details (Must sum to ₹{parseFloat(amount) || 0})</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-ink-400 block mb-1">Cash (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input w-full py-1.5 px-3 text-sm font-semibold"
                      value={splitCash || ''}
                      onChange={e => handleSplitCashChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-ink-400 block mb-1">UPI (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input w-full py-1.5 px-3 text-sm font-semibold"
                      value={splitUpi || ''}
                      onChange={e => handleSplitUpiChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-ink-400 block mb-1">Bank Transfer (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input w-full py-1.5 px-3 text-sm font-semibold"
                      value={splitBank || ''}
                      onChange={e => handleSplitBankChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Purpose / Description</label>
                <input
                  type="text"
                  required
                  className="input w-full"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  placeholder="Why this transfer?"
                />
              </div>
              <div>
                <label className="label">Reference No. (optional)</label>
                <input
                  type="text"
                  className="input w-full"
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  placeholder="UPI Ref / Bank Txn ID"
                />
              </div>
            </div>



            <div>
              <label className="label">General Notes (optional)</label>
              <textarea
                rows="2"
                className="input w-full"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional audit details..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 font-black text-sm"
            >
              <Plus size={16} /> Record Transaction
            </button>
          </form>
        </div>

        {/* Right Info Column */}
        <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 p-6 space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-black text-ink-900 dark:text-white uppercase tracking-wider text-xs mb-3">Audit Details</h3>
            <div className="text-xs text-ink-500 space-y-2 leading-relaxed">
              <p>
                <strong>Personal → Business:</strong> Tracks cash or UPI deposits from staff or partners into the business bank/cash drawer (e.g. initial funding, settlement of cash).
              </p>
              <p>
                <strong>Business → Business:</strong> Inter-branch stock settlements, cash transfers, or petty cash redistribution.
              </p>
              <p>
                <strong>Personal → Personal:</strong> Mutual staff settlements recorded purely for system balance transparency.
              </p>
            </div>
          </div>
          <div className="p-3 bg-ink-50 dark:bg-ink-950 rounded-2xl border border-ink-100 dark:border-ink-800 text-xs font-bold text-ink-400">
            🔒 Double-entry ledger audit details cannot be modified or deleted. Always confirm before recording.
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="font-black text-ink-900 dark:text-white flex items-center gap-2">
            Ledger Entries
          </h2>
          <div className="flex gap-2">
            <select
              className="select text-xs py-1 px-2.5"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="PERSONAL_TO_BUSINESS">Personal → Business</option>
              <option value="BUSINESS_TO_BUSINESS">Business → Business</option>
              <option value="PERSONAL_TO_PERSONAL">Personal → Personal</option>
            </select>
            {role === 'super_admin' && (
              <select
                className="select text-xs py-1 px-2.5"
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
              >
                <option value="all">All Branches</option>
                {branchesList.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <button onClick={fetchLedger} className="text-ink-500 hover:text-ink-700 p-1.5 hover:bg-ink-100 dark:hover:bg-ink-800 rounded-lg">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {ledgerLoading ? (
          <div className="py-16 text-center text-ink-400 animate-pulse font-bold">Loading ledger...</div>
        ) : filteredLedger.length === 0 ? (
          <div className="py-16 text-center text-ink-400 font-bold">No matching ledger entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-ink-50 dark:bg-ink-950 text-ink-500 text-[10px] font-black uppercase tracking-widest border-b border-ink-100 dark:border-ink-800">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">From</th>
                  <th className="px-6 py-3">To</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Purpose</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {filteredLedger.map(l => (
                  <tr key={l.id} className="hover:bg-ink-50/50 dark:hover:bg-ink-950/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-ink-500 font-bold">
                      {new Date(l.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-ink-700 dark:text-ink-300">
                      {l.transaction_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-ink-900 dark:text-white">
                      {l.from_entity_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-ink-900 dark:text-white">
                      {l.to_entity_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-black text-emerald-600 dark:text-emerald-400">
                      ₹{Number(l.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-xs text-ink-500 font-semibold max-w-xs truncate" title={l.purpose}>
                      {l.purpose} {l.reference_no && `[Ref: ${l.reference_no}]`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        l.status === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-right space-x-2">
                      {l.status === 'pending_approval' && role === 'super_admin' && (
                        <button
                          onClick={() => handleApprove(l.id)}
                          className="px-2.5 py-1 bg-emerald-500 text-white font-black rounded-lg hover:bg-emerald-600 active:scale-95 shadow-sm mr-1"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => openEditTransaction(l)}
                        className="px-2 py-1 text-ember hover:text-ember-600 font-black uppercase text-[10px] bg-ember/10 rounded-lg hover:bg-ember/20 active:scale-95 transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTransaction(l.id)}
                        className="px-2 py-1 text-red-600 hover:text-red-700 font-black uppercase text-[10px] bg-red-50 dark:bg-red-950/20 rounded-lg hover:bg-red-100 active:scale-95 transition-all"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {selectedPair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-ink-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-ink-100 dark:border-ink-800 overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 flex justify-between items-center bg-ink-50/50 dark:bg-ink-950/30">
              <div>
                <h3 className="font-black text-ink-900 dark:text-white flex items-center gap-2 text-base">
                  <ArrowLeftRight size={18} className="text-ember" />
                  Transfer History: {selectedPair.b1.name} ↔ {selectedPair.b2.name}
                </h3>
                <p className="text-[10px] text-ink-500 font-bold uppercase tracking-wider mt-0.5">
                  Detailed view of branch B2B ledger flow
                </p>
              </div>
              <button
                onClick={() => setSelectedPair(null)}
                className="p-1.5 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 dark:hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {modalLoading ? (
                <div className="py-20 text-center font-black text-ink-400 animate-pulse uppercase tracking-widest text-sm">
                  Fetching transaction logs...
                </div>
              ) : pairTransactions.length === 0 ? (
                <div className="py-20 text-center text-ink-400 space-y-2">
                  <ArrowLeftRight size={32} className="mx-auto opacity-30" />
                  <p className="font-black uppercase tracking-widest text-sm">No transaction records found</p>
                  <p className="text-xs text-ink-300">Confirmed B2B transfers will appear here</p>
                </div>
              ) : (
                <div className="border border-ink-100 dark:border-ink-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-ink-50 dark:bg-ink-950 text-ink-500 font-black uppercase tracking-widest border-b border-ink-100 dark:border-ink-800">
                          <th className="px-4 py-2.5">Date</th>
                          <th className="px-4 py-2.5">From → To</th>
                          <th className="px-4 py-2.5 text-center">Type (Flow)</th>
                          <th className="px-4 py-2.5">Amount</th>
                          <th className="px-4 py-2.5">Purpose & Status</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                        {pairTransactions.map(t => {
                          const isSentFromB1 = t.from_entity_id === selectedPair.b1.id
                          const flowLabel = isSentFromB1 ? 'To Take' : 'To Give'
                          const flowColor = isSentFromB1
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50'
                            : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50'

                          return (
                            <tr key={t.id} className="hover:bg-ink-50/50 dark:hover:bg-ink-950/20 transition-colors">
                              {/* Date */}
                              <td className="px-4 py-3 whitespace-nowrap text-ink-500 font-bold">
                                {new Date(t.created_at).toLocaleDateString('en-IN')}
                              </td>

                              {/* Direction */}
                              <td className="px-4 py-3 whitespace-nowrap font-bold text-ink-700 dark:text-ink-300">
                                {t.from_entity_name} → {t.to_entity_name}
                              </td>

                              {/* Flow Tag */}
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${flowColor}`}>
                                  {flowLabel}
                                </span>
                              </td>

                              {/* Amount */}
                              <td className={`px-4 py-3 whitespace-nowrap font-black text-sm ${
                                isSentFromB1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                              }`}>
                                {isSentFromB1 ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN')}
                              </td>

                              {/* Details */}
                              <td className="px-4 py-3">
                                <p className="font-semibold text-ink-600 dark:text-ink-400 truncate max-w-[150px]" title={t.purpose}>
                                  {t.purpose}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className={`text-[8px] font-black uppercase px-1.5 rounded-full ${
                                    t.status === 'confirmed'
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                                  }`}>
                                    {t.status}
                                  </span>
                                  {t.users?.username && (
                                    <span className="text-[9px] text-ink-400">by @{t.users.username}</span>
                                  )}
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                                <button
                                  onClick={() => openEditTransaction(t)}
                                  className="text-ember hover:text-ember-600 font-black uppercase text-[10px] px-2 py-1 bg-ember/10 rounded-lg hover:bg-ember/20 active:scale-95 transition-all"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteTransaction(t.id)}
                                  className="text-red-600 hover:text-red-700 font-black uppercase text-[10px] px-2 py-1 bg-red-50 dark:bg-red-950/20 rounded-lg hover:bg-red-100 active:scale-95 transition-all"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-ink-50 dark:bg-ink-950/50 border-t border-ink-100 dark:border-ink-800 flex justify-end">
              <button
                onClick={() => setSelectedPair(null)}
                className="btn-secondary px-5 py-2 text-xs font-bold"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-ink-900 rounded-3xl w-full max-w-lg shadow-2xl border border-ink-100 dark:border-ink-800 overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 flex justify-between items-center bg-ink-50/50 dark:bg-ink-950/30">
              <div>
                <h3 className="font-black text-ink-900 dark:text-white text-base">
                  Edit Transaction
                </h3>
                <p className="text-[10px] text-ink-500 font-bold uppercase tracking-wider mt-0.5">
                  Type: {editingTransaction.transaction_type.replace(/_/g, ' ')}
                </p>
              </div>
              <button
                onClick={() => setEditingTransaction(null)}
                className="p-1.5 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-ink-600 dark:hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateLedger} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Entities Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editingTransaction.transaction_type === 'PERSONAL_TO_BUSINESS' && (
                  <>
                    <div>
                      <label className="label">From User</label>
                      <select
                        required
                        className="select w-full"
                        value={editFromUser}
                        onChange={e => setEditFromUser(e.target.value)}
                      >
                        <option value="">Select User</option>
                        {usersList.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.full_name || u.username} ({u.role})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">To Branch</label>
                      <select
                        required
                        className="select w-full"
                        value={editToBranch}
                        onChange={e => setEditToBranch(e.target.value)}
                      >
                        <option value="">Select Branch</option>
                        {branchesList.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {editingTransaction.transaction_type === 'BUSINESS_TO_BUSINESS' && (
                  <>
                    <div>
                      <label className="label">From Branch</label>
                      <select
                        required
                        className="select w-full"
                        value={editFromBranch}
                        onChange={e => setEditFromBranch(e.target.value)}
                      >
                        <option value="">Select Branch</option>
                        {branchesList.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">To Branch</label>
                      <select
                        required
                        className="select w-full"
                        value={editToBranch}
                        onChange={e => setEditToBranch(e.target.value)}
                      >
                        <option value="">Select Branch</option>
                        {branchesList.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {editingTransaction.transaction_type === 'PERSONAL_TO_PERSONAL' && (
                  <>
                    <div>
                      <label className="label">From User</label>
                      <select
                        required
                        className="select w-full"
                        value={editFromUser}
                        onChange={e => setEditFromUser(e.target.value)}
                      >
                        <option value="">Select User</option>
                        {usersList.map(u => (
                          <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">To User</label>
                      <select
                        required
                        className="select w-full"
                        value={editToUser}
                        onChange={e => setEditToUser(e.target.value)}
                      >
                        <option value="">Select User</option>
                        {usersList.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.full_name || u.username} ({u.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Amount and Mode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input w-full font-black text-lg"
                    value={editAmount}
                    onChange={e => handleEditTotalAmountChange(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Payment Mode</label>
                  <select
                    className="select w-full"
                    value={editPaymentMethod}
                    onChange={e => setEditPaymentMethod(e.target.value)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="SPLIT">Split Payment</option>
                  </select>
                </div>
              </div>

              {/* Split inputs */}
              {editPaymentMethod === 'SPLIT' && (
                <div className="p-4 bg-ink-50 dark:bg-ink-950 border border-ink-200 dark:border-ink-800 rounded-2xl space-y-3">
                  <p className="text-[10px] font-black text-ink-500 uppercase tracking-widest">Split Details (Must sum to ₹{parseFloat(editAmount) || 0})</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-ink-400 block mb-1">Cash (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input w-full py-1.5 px-3 text-sm font-semibold"
                        value={editSplitCash || ''}
                        onChange={e => handleEditSplitCashChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-ink-400 block mb-1">UPI (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input w-full py-1.5 px-3 text-sm font-semibold"
                        value={editSplitUpi || ''}
                        onChange={e => handleEditSplitUpiChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-ink-400 block mb-1">Bank (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input w-full py-1.5 px-3 text-sm font-semibold"
                        value={editSplitBank || ''}
                        onChange={e => handleEditSplitBankChange(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Purpose and Reference */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Purpose</label>
                  <input
                    type="text"
                    required
                    className="input w-full"
                    value={editPurpose}
                    onChange={e => setEditPurpose(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Reference No.</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={editReferenceNo}
                    onChange={e => setEditReferenceNo(e.target.value)}
                  />
                </div>
              </div>

              {/* Status (Super Admin only) */}
              {role === 'super_admin' && (
                <div>
                  <label className="label">Status</label>
                  <select
                    className="select w-full"
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="pending_approval">Pending Approval</option>
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="label">Notes</label>
                <textarea
                  rows="2"
                  className="input w-full"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-ink-100 dark:border-ink-800">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="btn-secondary px-5 py-2 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-5 py-2 text-xs font-black"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

