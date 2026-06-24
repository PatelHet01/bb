import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { MessageCircle, Search, Plus, Trash2, X, Filter, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { computeNetBalance } from '../utils/khata'

export default function WhatsAppCRMPage() {
  const { user } = useAuthStore()
  
  const [customers, setCustomers] = useState([])
  const [ledgers, setLedgers] = useState({ khata: [], advance: [] })
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [balanceFilter, setBalanceFilter] = useState('all') // all, owes, jama, clear
  const [statementFilter, setStatementFilter] = useState('all') // all, today, date
  const [statementDate, setStatementDate] = useState('')
  
  // Templates
  const [templates, setTemplates] = useState([
    { id: 't1', name: 'Daily Summary', text: 'Hi {name},\n\nHere is your transaction summary for today at {branch}:\n\n{statement}\n\nTotal Outstanding Khata: ₹{khata_amount}\n\nThank you for visiting!' },
    { id: 't2', name: 'Khata Reminder', text: 'Hi {name}, your outstanding Khata balance at {branch} is ₹{khata_amount}. Please settle it at your earliest convenience.' },
    { id: 't3', name: 'Advance Update', text: 'Hello {name}, your current Jama (Advance) balance with {branch} is ₹{jama_amount}. Thank you for your business!' },
    { id: 't4', name: 'Promotional', text: 'Special offer for you, {name}! Visit {branch} today to get 10% off your next purchase.' }
  ])
  const [selectedTemplateId, setSelectedTemplateId] = useState('t1')
  
  // Template Management Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState({ id: '', name: '', text: '' })
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    fetchData()
    fetchCustomTemplates()
  }, [])

  async function fetchCustomTemplates() {
    try {
      const { data } = await supabase.from('system_settings').select('value').eq('key', 'whatsapp_templates').single()
      if (data && data.value && Array.isArray(data.value)) {
        setTemplates(data.value)
      }
    } catch (e) {
      console.log('No custom templates found or error:', e.message)
    }
  }

  async function saveTemplates(newTemplates) {
    setSavingSettings(true)
    try {
      const { error } = await supabase.from('system_settings').upsert({ key: 'whatsapp_templates', value: newTemplates, updated_by: user?.username || 'system' })
      if (error) throw error
      setTemplates(newTemplates)
      toast.success('Templates saved')
      setShowTemplateModal(false)
    } catch (e) {
      toast.error('Failed to save templates: ' + e.message)
    } finally {
      setSavingSettings(false)
    }
  }

  async function fetchData() {
    setLoading(true)
    try {
      const [cRes, kRes, aRes, bRes] = await Promise.all([
        supabase.from('customers').select('*').order('name'),
        supabase.from('khata_ledger').select('*'),
        supabase.from('advance_ledger').select('*'),
        supabase.from('branches').select('*')
      ])
      
      setCustomers(cRes.data || [])
      setLedgers({ khata: kRes.data || [], advance: aRes.data || [] })
      setBranches(bRes.data || [])
    } catch (e) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const enrichedCustomers = useMemo(() => {
    return customers.map(c => {
      const cKhata = ledgers.khata.filter(l => l.customer_id === c.id)
      const cAdv = ledgers.advance.filter(l => l.customer_id === c.id)
      const net = computeNetBalance(cKhata, cAdv)
      return {
        ...c,
        displayKhata: Math.max(0, net),
        displayAdv: Math.max(0, -net),
        netBalance: net,
        branchName: branches.find(b => b.id === c.branch_id)?.name || 'Unknown'
      }
    })
  }, [customers, ledgers, branches])

  const filteredCustomers = useMemo(() => {
    let result = enrichedCustomers

    if (branchFilter !== 'all') {
      result = result.filter(c => c.branch_id === branchFilter)
    }

    if (balanceFilter === 'owes') result = result.filter(c => c.displayKhata > 0)
    else if (balanceFilter === 'jama') result = result.filter(c => c.displayAdv > 0)
    else if (balanceFilter === 'clear') result = result.filter(c => c.netBalance === 0)

    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      result = result.filter(c => 
        (c.name || '').toLowerCase().includes(q) || 
        (c.mobile_number || '').includes(q)
      )
    }

    return result
  }, [enrichedCustomers, branchFilter, balanceFilter, searchTerm])

  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0]

  function generateStatement(customer) {
    let k = ledgers.khata.filter(l => l.customer_id === customer.id)
    let a = ledgers.advance.filter(l => l.customer_id === customer.id)

    if (statementFilter === 'today') {
      const today = new Date().toISOString().split('T')[0]
      k = k.filter(l => l.created_at.startsWith(today))
      a = a.filter(l => l.created_at.startsWith(today))
    } else if (statementFilter === 'date' && statementDate) {
      k = k.filter(l => l.created_at.startsWith(statementDate))
      a = a.filter(l => l.created_at.startsWith(statementDate))
    }

    const combined = [
      ...k.map(x => ({ ...x, _type: x.type === 'PAYMENT' ? 'khata_pay' : 'khata_debt' })),
      ...a.map(x => ({ ...x, _type: x.type === 'TOPUP' ? 'adv_topup' : 'adv_deduct' }))
    ].sort((x, y) => new Date(x.created_at) - new Date(y.created_at))

    if (combined.length === 0) return 'No entries found.'

    let str = ''
    combined.forEach(row => {
      const d = new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      let amt = parseFloat(row.amount)
      let note = row.reason || ''
      if (row._type === 'khata_debt') str += `${d}: -₹${amt} (${note})\n`
      if (row._type === 'khata_pay') str += `${d}: +₹${amt} (Khata Payment)\n`
      if (row._type === 'adv_topup') str += `${d}: +₹${amt} (Jama)\n`
      if (row._type === 'adv_deduct') str += `${d}: -₹${amt} (Jama Deduct)\n`
    })

    return str.trim()
  }

  function getPopulatedMessage(customer, templateText) {
    if (!templateText) return ''
    const stmt = generateStatement(customer)
    return templateText
      .replace(/{name}/g, customer.name || 'Customer')
      .replace(/{branch}/g, customer.branchName)
      .replace(/{khata_amount}/g, customer.displayKhata)
      .replace(/{jama_amount}/g, customer.displayAdv)
      .replace(/{statement}/g, stmt)
  }

  function handleSend(customer) {
    if (!customer.mobile_number) {
      toast.error('Customer has no mobile number')
      return
    }
    const msg = getPopulatedMessage(customer, activeTemplate?.text)
    let num = customer.mobile_number.replace(/\D/g, '')
    if (num.length === 10) num = '91' + num
    
    const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  function handleAddTemplate() {
    setEditingTemplate({ id: 't_' + Date.now(), name: 'New Template', text: '' })
    setShowTemplateModal(true)
  }
  
  function handleEditTemplate(t) {
    setEditingTemplate({ ...t })
    setShowTemplateModal(true)
  }

  function handleDeleteTemplate(id) {
    if (templates.length <= 1) return toast.error('You must have at least one template')
    if (window.confirm('Delete this template?')) {
      const newT = templates.filter(t => t.id !== id)
      if (selectedTemplateId === id) setSelectedTemplateId(newT[0].id)
      saveTemplates(newT)
      setShowTemplateModal(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-ink-900 dark:text-white flex items-center gap-2">
            <MessageCircle className="text-green-500" />
            WhatsApp CRM
          </h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Free click-to-chat messaging platform for your customers.</p>
        </div>
      </div>

      {/* Filters & Template Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Filters Panel */}
        <div className="lg:col-span-3 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-2xl p-4 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-ink-500 uppercase tracking-widest mb-1 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={16} />
              <input 
                type="text" 
                placeholder="Name or Mobile..." 
                className="input w-full pl-9"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="w-40">
            <label className="text-xs font-bold text-ink-500 uppercase tracking-widest mb-1 block">Branch</label>
            <select className="input w-full" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              <option value="all">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="w-40">
            <label className="text-xs font-bold text-ink-500 uppercase tracking-widest mb-1 block">Khata Filter</label>
            <select className="input w-full" value={balanceFilter} onChange={e => setBalanceFilter(e.target.value)}>
              <option value="all">All Customers</option>
              <option value="owes">Owes Money</option>
              <option value="jama">Has Advance (Jama)</option>
              <option value="clear">Clear Balance</option>
            </select>
          </div>

          <div className="w-40">
            <label className="text-xs font-bold text-ink-500 uppercase tracking-widest mb-1 block">Entries Filter</label>
            <select className="input w-full" value={statementFilter} onChange={e => setStatementFilter(e.target.value)}>
              <option value="all">Whole Khata</option>
              <option value="today">Today's Entries</option>
              <option value="date">Specific Date</option>
            </select>
          </div>

          {statementFilter === 'date' && (
            <div className="w-40">
              <label className="text-xs font-bold text-ink-500 uppercase tracking-widest mb-1 block">Custom Date</label>
              <input type="date" className="input w-full" value={statementDate} onChange={e => setStatementDate(e.target.value)} />
            </div>
          )}
        </div>

        {/* Template Panel */}
        <div className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase tracking-widest mb-1 block">Active Template</label>
            <select className="input w-full" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => handleEditTemplate(activeTemplate)} className="btn-secondary flex-1 text-xs py-2">Edit</button>
            <button onClick={handleAddTemplate} className="btn-primary flex-1 text-xs py-2 flex items-center justify-center gap-1"><Plus size={14}/> Add New</button>
          </div>
        </div>
      </div>

      {/* Customer List & Preview */}
      <div className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-2xl flex-1 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-200 dark:border-ink-800 flex justify-between items-center bg-ink-50 dark:bg-ink-950/50">
          <h2 className="font-bold text-sm text-ink-900 dark:text-white flex items-center gap-2">
            <Filter size={16} /> Customers ({filteredCustomers.length})
          </h2>
          <span className="text-xs font-medium text-ink-500 bg-white dark:bg-ink-800 px-2 py-1 rounded-md border border-ink-200 dark:border-ink-700 truncate max-w-xs">
            Template: <span className="font-bold">{activeTemplate?.name}</span>
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin w-8 h-8 border-4 border-ember border-t-transparent rounded-full" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center text-ink-400 py-10 font-medium">No customers found matching filters.</div>
          ) : (
            filteredCustomers.map(c => (
              <div key={c.id} className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-ink-200 dark:border-ink-800 hover:border-green-500/30 hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-colors group">
                <div className="md:w-1/4 flex-shrink-0">
                  <h3 className="font-bold text-ink-900 dark:text-white">{c.name}</h3>
                  <p className="text-xs text-ink-500">{c.mobile_number || 'No Mobile'}</p>
                  
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">{c.branchName}</span>
                    {c.displayKhata > 0 && <span className="text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded">Owes: ₹{c.displayKhata}</span>}
                    {c.displayAdv > 0 && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded">Jama: ₹{c.displayAdv}</span>}
                  </div>
                </div>
                
                <div className="flex-1 bg-ink-50 dark:bg-ink-950 p-3 rounded-lg border border-ink-100 dark:border-ink-800/50 relative min-h-[80px]">
                  <div className="absolute top-2 right-2 text-[10px] font-bold text-ink-400 uppercase">Preview</div>
                  <p className="text-sm text-ink-700 dark:text-ink-300 whitespace-pre-wrap pt-3 pr-14 leading-relaxed">{getPopulatedMessage(c, activeTemplate?.text)}</p>
                </div>
                
                <div className="md:w-32 flex-shrink-0 flex flex-col justify-center gap-2">
                  <button 
                    onClick={() => handleSend(c)}
                    disabled={!c.mobile_number}
                    style={{ backgroundColor: '#25D366' }}
                    className="w-full py-3 hover:brightness-95 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
                  >
                    <Share2 size={16} /> Send
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <form onSubmit={(e) => {
            e.preventDefault();
            const newT = [...templates]
            const idx = newT.findIndex(t => t.id === editingTemplate.id)
            if (idx >= 0) newT[idx] = editingTemplate
            else newT.push(editingTemplate)
            saveTemplates(newT)
            setSelectedTemplateId(editingTemplate.id)
          }} className="bg-white dark:bg-ink-900 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-slide-up">
            <div className="p-4 border-b border-ink-200 dark:border-ink-800 flex justify-between items-center bg-ink-50 dark:bg-ink-950/50">
              <h3 className="font-bold text-ink-900 dark:text-white">
                {editingTemplate.id?.startsWith('t_') ? "Add New Template" : "Edit Template"}
              </h3>
              <button type="button" onClick={() => setShowTemplateModal(false)} className="text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-ink-500 uppercase tracking-widest mb-1 block">Template Name</label>
                <input className="input w-full" value={editingTemplate.name} onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})} required placeholder="e.g. Festival Offer" />
              </div>
              <div>
                <label className="text-xs font-bold text-ink-500 uppercase tracking-widest mb-1 block">Message Body</label>
                <textarea className="input w-full h-32 py-3 resize-none font-medium" value={editingTemplate.text} onChange={e => setEditingTemplate({...editingTemplate, text: e.target.value})} required placeholder="Type your message here..." />
                <p className="text-xs text-ink-500 mt-2 font-medium">
                  Available variables: <br/>
                  <code className="text-green-600 bg-green-50 px-1 py-0.5 rounded">{`{name}`}</code>, 
                  <code className="text-green-600 bg-green-50 px-1 py-0.5 rounded ml-1">{`{branch}`}</code>, 
                  <code className="text-green-600 bg-green-50 px-1 py-0.5 rounded ml-1">{`{khata_amount}`}</code>, 
                  <code className="text-green-600 bg-green-50 px-1 py-0.5 rounded ml-1">{`{jama_amount}`}</code>,
                  <code className="text-green-600 bg-green-50 px-1 py-0.5 rounded ml-1">{`{statement}`}</code>
                </p>
              </div>
              
              {!editingTemplate.id?.startsWith('t_') && (
                 <div className="pt-4 border-t border-ink-200 dark:border-ink-800">
                   <button type="button" onClick={() => handleDeleteTemplate(editingTemplate.id)} className="w-full flex items-center justify-center gap-2 py-2 text-red-500 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg font-bold text-sm">
                     <Trash2 size={16} /> Delete Template
                   </button>
                 </div>
              )}
            </div>
            
            <div className="p-4 bg-ink-50 dark:bg-ink-950/50 flex justify-end gap-3 border-t border-ink-200 dark:border-ink-800">
              <button type="button" onClick={() => setShowTemplateModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={savingSettings} className="btn-primary min-w-[120px]">
                {savingSettings ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
