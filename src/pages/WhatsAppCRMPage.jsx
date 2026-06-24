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
  
  // Orders for today
  const [todaysOrders, setTodaysOrders] = useState([])

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

  // AI Generator States
  const [activeOffers, setActiveOffers] = useState([])
  const [showAi, setShowAi] = useState(false)
  const [aiTone, setAiTone] = useState('Sweet')
  const [aiLanguage, setAiLanguage] = useState('English')
  const [aiContentType, setAiContentType] = useState('Marketing / General')
  const [aiOfferId, setAiOfferId] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Custom Customer Messaging
  const [customMessages, setCustomMessages] = useState({})
  const [isGeneratingFor, setIsGeneratingFor] = useState(null)

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
      const startOfDay = new Date()
      startOfDay.setHours(0,0,0,0)

      const [cRes, kRes, aRes, bRes, oRes, offersRes] = await Promise.all([
        supabase.from('customers').select('*').order('name'),
        supabase.from('khata_ledger').select('*'),
        supabase.from('advance_ledger').select('*'),
        supabase.from('branches').select('*'),
        supabase.from('orders').select('customer_id, final_total, created_at, order_number').gte('created_at', startOfDay.toISOString()),
        supabase.from('offers').select('id, name, description, price').eq('is_active', true)
      ])
      
      setCustomers(cRes.data || [])
      setLedgers({ khata: kRes.data || [], advance: aRes.data || [] })
      setBranches(bRes.data || [])
      setTodaysOrders(oRes.data || [])
      setActiveOffers(offersRes.data || [])
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
    let o = todaysOrders.filter(l => l.customer_id === customer.id)

    const isDailySummary = activeTemplate?.id === 't1'

    if (statementFilter === 'today' || isDailySummary) {
      const startOfDay = new Date()
      startOfDay.setHours(0,0,0,0)
      const iso = startOfDay.toISOString()
      k = k.filter(l => l.created_at >= iso)
      a = a.filter(l => l.created_at >= iso)
      // o is already only today's orders
    } else if (statementFilter === 'date' && statementDate) {
      const d1 = new Date(statementDate)
      d1.setHours(0,0,0,0)
      const d2 = new Date(statementDate)
      d2.setHours(23,59,59,999)
      k = k.filter(l => l.created_at >= d1.toISOString() && l.created_at <= d2.toISOString())
      a = a.filter(l => l.created_at >= d1.toISOString() && l.created_at <= d2.toISOString())
      o = [] // ignore non-today orders for custom date for now
    }

    const combined = [
      ...k.map(x => ({ ...x, _type: x.type === 'PAYMENT' ? 'khata_pay' : 'khata_debt' })),
      ...a.map(x => ({ ...x, _type: x.type === 'TOPUP' ? 'adv_topup' : 'adv_deduct' })),
      ...o.filter(x => !k.some(kl => kl.reason?.includes(x.order_number)) && !a.some(al => al.reason?.includes(x.order_number)))
          .map(x => ({ created_at: x.created_at, amount: x.final_total, reason: `Order #${x.order_number} (Cash/UPI)`, _type: 'order_cash' }))
    ].sort((x, y) => new Date(x.created_at) - new Date(y.created_at))

    if (combined.length === 0) return 'No entries found.'

    let str = ''
    combined.forEach(row => {
      const d = new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      let amt = parseFloat(row.amount)
      let note = row.reason || ''
      if (row._type === 'khata_debt') str += `${d}: -₹${amt} (${note} - Khata)\n`
      if (row._type === 'khata_pay') str += `${d}: +₹${amt} (Khata Payment Received)\n`
      if (row._type === 'adv_topup') str += `${d}: +₹${amt} (Jama Added)\n`
      if (row._type === 'adv_deduct') str += `${d}: -₹${amt} (${note} - Jama)\n`
      if (row._type === 'order_cash') str += `${d}: ₹${amt} (${note})\n`
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
    const msg = customMessages[customer.id] || getPopulatedMessage(customer, activeTemplate?.text)
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

  async function generateTemplateWithAI() {
    const key = import.meta.env.VITE_GEMINI_API_KEY
    if (!key) return toast.error('Gemini API key is missing from environment variables (.env)')

    let offerText = ''
    if (aiContentType === 'Promotional Offer' && aiOfferId) {
      const offer = activeOffers.find(o => o.id === aiOfferId)
      if (offer) {
        offerText = `We are promoting a combo/offer: "${offer.name}" for ₹${offer.price}. Description: ${offer.description || 'No description'}. Make sure to enthusiastically mention this offer in the message.`
      }
    }

    const prompt = `You are a helpful assistant writing a WhatsApp template message for a cafe/paan shop named Bombay Bethak.
Tone: ${aiTone}
Language: ${aiLanguage}
Content Type: ${aiContentType}
${offerText}

IMPORTANT: You can optionally use any of the following variables in the text exactly as shown:
{name} - The Customer's name
{branch} - The Branch name
{khata_amount} - The amount they owe (outstanding khata)
{jama_amount} - The advance amount they have
{statement} - Their transaction history for today

Only use the variables if it makes sense for the content type. For example, if it's a Khata Reminder, use {khata_amount}. If it's a promotional message, you don't need to use {khata_amount}.
Keep it concise, formatted well for WhatsApp (use * for bolding, emojis are welcome). 
Return ONLY the final message body text. Do not include quotes, markdown blocks, or intro text.`

    setIsGenerating(true)
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`API Error: ${errText}`)
      }
      const data = await res.json()
      const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (generatedText) {
        setEditingTemplate(prev => ({ ...prev, text: generatedText.trim() }))
        toast.success('Generated successfully! ✨')
      } else {
        toast.error('AI returned empty text.')
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setIsGenerating(false)
    }
  }

  async function generateForCustomer(c) {
    const countStr = localStorage.getItem('ai_gen_count') || '0'
    let count = parseInt(countStr)
    if (count >= 15) return toast.error('You have reached the limit of 15 AI generations.')

    const key = import.meta.env.VITE_GEMINI_API_KEY
    if (!key) return toast.error('Gemini API key is missing')

    let offerText = ''
    if (aiContentType === 'Promotional Offer' && aiOfferId) {
      const offer = activeOffers.find(o => o.id === aiOfferId)
      if (offer) {
        offerText = `Promoting Combo: "${offer.name}" for ₹${offer.price}. Description: ${offer.description || 'No description'}.`
      }
    }

    const statement = generateStatement(c)

    const prompt = `You are a helpful assistant writing a WhatsApp message for a cafe/paan shop named Bombay Bethak to send directly to a specific customer.
Customer Name: ${c.name}
Branch: ${c.branchName}
Khata (Owes us): ₹${c.displayKhata}
Jama (Advance): ₹${c.displayAdv}
Today's Transaction Statement:
${statement}

Tone: ${aiTone}
Language: ${aiLanguage}
Content Type: ${aiContentType}
${offerText}

Write a deeply personalized, concise message to this specific customer based on the Content Type and their details. Use * for bolding. DO NOT use placeholder variables like {name}, insert their actual data into the text natively.
Return ONLY the final message body text. No quotes.`

    setIsGeneratingFor(c.id)
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`API Error: ${errText}`)
      }
      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (text) {
        setCustomMessages(p => ({ ...p, [c.id]: text.trim() }))
        localStorage.setItem('ai_gen_count', (count + 1).toString())
        toast.success(`Generated personalized message for ${c.name}! (${count + 1}/15)`)
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setIsGeneratingFor(null)
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

      {/* Global AI Generator Toggle */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 rounded-2xl border border-purple-100 dark:border-purple-800/50 overflow-hidden shadow-sm">
        <button type="button" onClick={() => setShowAi(!showAi)} className="w-full px-5 py-4 flex items-center justify-between font-bold text-sm text-purple-700 dark:text-purple-300 hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-colors">
          <span className="flex items-center gap-2">
            <span className="bg-purple-200 dark:bg-purple-800/50 p-1.5 rounded-lg"><MessageCircle size={16}/></span> 
            Global AI Assistant Settings
          </span>
          <span className="flex items-center gap-2">
            <span className="text-xs font-medium bg-white/50 dark:bg-black/20 px-2 py-1 rounded-md text-purple-600 dark:text-purple-400">Generations: {localStorage.getItem('ai_gen_count') || 0}/15</span>
            {showAi ? '▼' : '▶'}
          </span>
        </button>
        
        {showAi && (
          <div className="p-5 pt-0 space-y-4 border-t border-purple-100/50 dark:border-purple-800/30 mt-2">
            <p className="text-xs text-purple-600/80 dark:text-purple-400/80 font-medium">Configure tone and content. Then click "✨ AI Customize" on any customer card, or use the generator inside the Template editor.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-purple-600/70 uppercase tracking-wider block mb-1">Tone</label>
                <select className="input w-full py-2 text-sm" value={aiTone} onChange={e => setAiTone(e.target.value)}>
                  <option>Sweet & Friendly</option>
                  <option>Playful</option>
                  <option>Requestful / Polite</option>
                  <option>Urgent / Angry</option>
                  <option>Professional</option>
                  <option>Marketing Gimmick</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-purple-600/70 uppercase tracking-wider block mb-1">Language</label>
                <select className="input w-full py-2 text-sm" value={aiLanguage} onChange={e => setAiLanguage(e.target.value)}>
                  <option>English</option>
                  <option>Gujarati</option>
                  <option>Hindi</option>
                  <option>Hinglish</option>
                  <option>Gujarati + English Mix</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-purple-600/70 uppercase tracking-wider block mb-1">Content Type</label>
                <select className="input w-full py-2 text-sm" value={aiContentType} onChange={e => setAiContentType(e.target.value)}>
                  <option>Marketing / General</option>
                  <option>Promotional Offer</option>
                  <option>Khata Reminder</option>
                  <option>Festival Greeting</option>
                </select>
              </div>
            </div>

            {aiContentType === 'Promotional Offer' && (
              <div className="animate-fade-in w-full md:w-1/3">
                <label className="text-[10px] font-bold text-purple-600/70 uppercase tracking-wider block mb-1">Select Active Offer</label>
                <select className="input w-full py-2 text-sm" value={aiOfferId} onChange={e => setAiOfferId(e.target.value)}>
                  <option value="">-- Select an Offer --</option>
                  {activeOffers.map(o => (
                    <option key={o.id} value={o.id}>{o.name} - ₹{o.price}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
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
                  <p className="text-sm text-ink-700 dark:text-ink-300 whitespace-pre-wrap pt-3 pr-14 leading-relaxed">
                    {customMessages[c.id] || getPopulatedMessage(c, activeTemplate?.text)}
                  </p>
                </div>
                
                <div className="md:w-36 flex-shrink-0 flex flex-col justify-center gap-2">
                  <button 
                    onClick={() => handleSend(c)}
                    disabled={!c.mobile_number}
                    style={{ backgroundColor: '#25D366' }}
                    className="w-full py-2 hover:brightness-95 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed text-sm"
                  >
                    <Share2 size={14} /> Send
                  </button>
                  <button
                    onClick={() => generateForCustomer(c)}
                    disabled={isGeneratingFor === c.id || (aiContentType === 'Promotional Offer' && !aiOfferId)}
                    className="w-full py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50 font-bold rounded-lg text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                  >
                    {isGeneratingFor === c.id ? <div className="animate-spin w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full" /> : '✨ AI Customize'}
                  </button>
                  {customMessages[c.id] && (
                     <button onClick={() => setCustomMessages(p => { const newP = {...p}; delete newP[c.id]; return newP; })} className="text-[10px] font-bold text-ink-400 hover:text-red-500 text-center w-full mt-1">Reset to Template</button>
                  )}
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

              {/* AI Template Generation Button (Uses Global Settings) */}
              <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-800/30 flex justify-between items-center">
                <div className="text-xs text-purple-700 dark:text-purple-300">
                  <p className="font-bold mb-0.5">✨ AI Template Generator</p>
                  <p className="opacity-80">Uses Global Settings: {aiTone}, {aiLanguage}, {aiContentType}</p>
                </div>
                <button 
                  type="button" 
                  onClick={generateTemplateWithAI}
                  disabled={isGenerating || (aiContentType === 'Promotional Offer' && !aiOfferId)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGenerating ? <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> : 'Generate'}
                </button>
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
