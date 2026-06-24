import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit2, Check, X, Tag, Search, Minus } from 'lucide-react'

export default function OffersPage() {
  const { branchId, role } = useAuthStore()
  const [offers, setOffers] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ id: null, name: '', description: '', price: '', is_active: true })
  const [offerItems, setOfferItems] = useState([]) // [{ item_id, quantity, name, variant }]
  
  // Search state for adding items to combo
  const [itemSearch, setItemSearch] = useState('')

  // Siren Audio Refs
  const audioCtxRef = useRef(null)
  const oscRef = useRef(null)
  const intervalRef = useRef(null)

  function startSiren() {
    if (audioCtxRef.current) return // already playing
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = ctx
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    
    osc.type = 'square'
    osc.frequency.setValueAtTime(400, ctx.currentTime)
    
    // Siren modulation effect
    let high = true
    intervalRef.current = setInterval(() => {
      if (oscRef.current) {
        oscRef.current.frequency.setValueAtTime(high ? 800 : 400, ctx.currentTime)
        high = !high
      }
    }, 400)

    gainNode.gain.setValueAtTime(0.05, ctx.currentTime) // reasonable volume
    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    osc.start()
    oscRef.current = osc
  }

  function stopSiren() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (oscRef.current) {
      try { oscRef.current.stop() } catch (e) {}
      oscRef.current.disconnect()
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close()
    }
    audioCtxRef.current = null
    oscRef.current = null
    intervalRef.current = null
  }

  // Cost Price Enforcement State
  const [missingCpItem, setMissingCpItem] = useState(null)
  const [newCpValue, setNewCpValue] = useState('')

  // AI Combo State
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiStrategy, setAiStrategy] = useState('Profit')
  const [isAiGenerating, setIsAiGenerating] = useState(false)

  const [isGeneratingImage, setIsGeneratingImage] = useState(null)
  const [editCpItem, setEditCpItem] = useState(null)
  
  const [postGenOffer, setPostGenOffer] = useState(null)
  const [selectedImgModel, setSelectedImgModel] = useState('gpt-image-1.5')

  useEffect(() => {
    fetchData()

    const filter = (branchId && branchId !== 'All Branches') ? `branch_id=eq.${branchId}` : undefined
    const chan = supabase.channel('offers_page_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offer_items' }, () => fetchData())
      .subscribe()
    
    return () => supabase.removeChannel(chan)
  }, [branchId])

  async function fetchData() {
    setLoading(true)
    const targetBranch = branchId || 'gurukul'
    
    // Fetch Items for searching
    const { data: dbItems } = await supabase.from('items').select('id, name, variant, price, cost_price, stock_quantity, category')
      .eq('branch_id', targetBranch)
      .eq('is_active', true)
      .eq('item_type', 'SELLABLE')
    setItems(dbItems || [])

    // Fetch Offers & Offer Items
    let q = supabase.from('offers').select('*, offer_items(*, items(name, variant, cost_price))')
    if (branchId && branchId !== 'All Branches') {
      q = q.or(`branch_id.eq.${branchId},branch_id.is.null`)
    }
    const { data: dbOffers } = await q
    setOffers(dbOffers || [])
    
    setLoading(false)
  }

  function handleEdit(o) {
    setForm({ id: o.id, name: o.name, description: o.description || '', price: o.price, is_active: o.is_active })
    setOfferItems((o.offer_items || []).map(oi => ({
      item_id: oi.item_id,
      quantity: oi.quantity,
      name: oi.items?.name,
      variant: oi.items?.variant,
      cost_price: oi.items?.cost_price || 0
    })))
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setForm({ id: null, name: '', description: '', price: '', is_active: true })
    setOfferItems([])
    setItemSearch('')
    setShowForm(false)
  }

  function addOfferItem(item) {
    if (!item.cost_price || item.cost_price <= 0 || item.cost_price < (0.30 * item.price)) {
      setMissingCpItem(item)
      setNewCpValue('')
      startSiren()
      return
    }

    setOfferItems(prev => {
      const exists = prev.find(p => p.item_id === item.id)
      if (exists) {
        return prev.map(p => p.item_id === item.id ? { ...p, quantity: p.quantity + 1 } : p)
      }
      return [...prev, { item_id: item.id, quantity: 1, name: item.name, variant: item.variant, cost_price: item.cost_price || 0, price: item.price || 0 }]
    })
    setItemSearch('') // Clear search after picking
  }

  async function handleSaveCp() {
    if (!newCpValue || parseFloat(newCpValue) <= 0) return toast.error('Enter a valid Cost Price')
    const cp = parseFloat(newCpValue)
    
    setLoading(true)
    const { error } = await supabase.from('items').update({ cost_price: cp }).eq('id', missingCpItem.id)
    setLoading(false)
    
    if (error) return toast.error('Failed to update Cost Price')
    
    // Update local items array
    setItems(prev => prev.map(i => i.id === missingCpItem.id ? { ...i, cost_price: cp } : i))
    
    // Add to offer
    addOfferItem({ ...missingCpItem, cost_price: cp })
    setMissingCpItem(null)
    stopSiren()
    toast.success('Cost price saved and item added')
  }

  async function saveInlineCp() {
    if (!newCpValue || parseFloat(newCpValue) <= 0) return toast.error('Enter a valid Cost Price')
    const cp = parseFloat(newCpValue)
    
    setLoading(true)
    const { error } = await supabase.from('items').update({ cost_price: cp }).eq('id', editCpItem.id)
    setLoading(false)
    
    if (error) return toast.error('Failed to update Cost Price')
    
    setItems(prev => prev.map(i => i.id === editCpItem.id ? { ...i, cost_price: cp } : i))
    
    toast.success('Cost price updated globally!')
    setEditCpItem(null)
    setNewCpValue('')
    fetchData()
  }

  async function generateSocialPost(offer, modelId) {
    const count = parseInt(localStorage.getItem('bb_image_gen_count') || '0')
    if (count >= 5) {
      return toast.error('You have reached the maximum limit of 5 image generations.')
    }

    setIsGeneratingImage(offer.id)
    setPostGenOffer(null) // close modal
    try {
      if (!window.puter) throw new Error("AI is initializing. Please wait a moment.")
      
      toast.loading(`Generating image with ${modelId}...`, { id: 'img-gen' })
      
      const itemList = offer.offer_items?.map(oi => `- ${oi.quantity}x ${oi.items?.name} ${oi.items?.variant || ''}`).join('\n') || ''

      const optimizedPrompt = `You are an expert food advertising creative director.
Create a premium Instagram promotional post for Bombay Bethak.

Offer Name: ${offer.name}
Offer Price: ₹${offer.price}
Offer Description: ${offer.description || 'Delicious food'}

Items Included:
${itemList}

CRITICAL REQUIREMENTS:
1. VISUAL COMPOSITION
* Show ALL listed items from the combo prominently.
* Every item in the combo must be visible.
* Create a rich, abundant composition that highlights the value of the combo.
* Arrange food professionally like a restaurant advertisement.
* Use premium plating and presentation.
* Create depth and visual hierarchy.

2. ADVERTISING STYLE
* Commercial food photography.
* Restaurant marketing campaign style.
* Luxury food advertisement.
* Premium Indian cafe and restaurant branding.
* Similar quality to Zomato, Swiggy, Starbucks and premium restaurant ads.
* Cinematic lighting.
* Warm tones.
* Mouth-watering food styling.
* High realism.

3. TYPOGRAPHY SPACE
* Reserve clean space for text overlays.
* Keep composition balanced.
* Ensure title and pricing can be clearly displayed.
* Avoid placing important food elements behind text areas.

4. BRANDING
* Place logo elegantly in a corner.
* Keep branding premium and subtle.

5. OFFER FOCUS
* Make the combo appear irresistible and high value.
* Visually communicate savings and abundance.
* Showcase all included products.
* Highlight the complete meal experience.

6. OUTPUT QUALITY
* Square Instagram post.
* 1080x1080 composition.
* Ultra realistic.
* Commercial advertising quality.
* Sharp details.
* Professional food photography.

ADDITIONAL CONTEXT:
Generate an actual advertisement, not a menu card and not a simple food photo. The result should immediately look like a social media campaign creative designed by a professional restaurant marketing agency.

NEGATIVE INSTRUCTIONS:
Do not generate generic stock photos.
Do not show only one item when multiple items exist.
Do not crop food items.
Do not create empty backgrounds.
Do not generate low-quality typography.
Do not make the image look AI-generated.
Do not create cluttered layouts.`
      
      // Determine provider from model to be safe, though puter can infer
      let provider = undefined
      if (modelId.includes('gpt') || modelId.includes('dall')) provider = 'openai-image-generation'
      else if (modelId.includes('gemini') || modelId.includes('nano-banana')) provider = 'gemini'
      else if (modelId.includes('flux') || modelId.includes('lucid')) provider = 'replicate-image-generation'
      else if (modelId.includes('grok')) provider = 'xai'

      let imgElement;
      try {
        imgElement = await window.puter.ai.txt2img(optimizedPrompt, {
          provider,
          model: modelId,
          ratio: { w: 1, h: 1 }
        })
      } catch (e) {
        console.warn(`Primary model ${modelId} failed:`, e)
        toast.loading(`Model ${modelId} unavailable. Trying fallback...`, { id: 'img-gen' })
        
        try {
          // Fallback 1: Free GPT Image
          imgElement = await window.puter.ai.txt2img(optimizedPrompt, {
            provider: 'openai-image-generation',
            model: 'gpt-image-1',
            ratio: { w: 1, h: 1 }
          })
        } catch (e2) {
          console.warn("Fallback 1 failed:", e2)
          // Fallback 2: Flux Schnell
          imgElement = await window.puter.ai.txt2img(optimizedPrompt, {
            provider: 'replicate-image-generation',
            model: 'flux-schnell',
            ratio: { w: 1, h: 1 }
          })
        }
      }
      
      toast.loading('Applying Bombay Bethak Logo and Text...', { id: 'img-gen' })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const width = 1080
      const height = 1080
      canvas.width = width
      canvas.height = height

      ctx.drawImage(imgElement, 0, 0, width, height)

      const gradient = ctx.createLinearGradient(0, height * 0.4, 0, height)
      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(0.5, 'rgba(0,0,0,0.6)')
      gradient.addColorStop(1, 'rgba(0,0,0,0.95)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)

      const logoImg = new Image()
      logoImg.crossOrigin = "Anonymous"
      logoImg.src = "/assets/logo.png"
      
      await new Promise((resolve) => {
        logoImg.onload = () => {
          const logoWidth = 180
          const logoHeight = (logoImg.height / logoImg.width) * logoWidth
          ctx.drawImage(logoImg, (width - logoWidth) / 2, 60, logoWidth, logoHeight)
          resolve()
        }
        logoImg.onerror = resolve
      })

      // Title Rendering Logic Update
      ctx.textAlign = 'center'
      ctx.shadowColor = 'rgba(0,0,0,0.8)'
      ctx.shadowBlur = 15

      // Subtitle: Special Combo Offer
      ctx.font = 'bold 36px Montserrat, sans-serif'
      ctx.fillStyle = '#fcd34d' // amber-300
      ctx.letterSpacing = '4px' // Canvas API doesn't support letterSpacing directly in all browsers, but we'll stick to standard
      ctx.fillText('SPECIAL COMBO OFFER', width / 2, height - 280)

      // Large Combo Title
      ctx.fillStyle = '#ffffff'
      ctx.font = '900 85px "Playfair Display", serif'
      
      // Auto-wrap title if too long
      const words = offer.name.toUpperCase().split(' ')
      let line = ''
      let y = height - 180
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' '
        const metrics = ctx.measureText(testLine)
        if (metrics.width > width - 100 && n > 0) {
          ctx.fillText(line, width / 2, y)
          line = words[n] + ' '
          y += 90 // line height
        } else {
          line = testLine
        }
      }
      ctx.fillText(line, width / 2, y)

      // Large Price Highlight
      ctx.font = '900 130px Montserrat, sans-serif'
      ctx.fillStyle = '#10b981' // emerald-500
      ctx.shadowBlur = 20
      ctx.fillText(`₹${offer.price}`, width / 2, y + 130)

      // Optional Profit Badge
      const totalCost = offer.offer_items?.reduce((sum, oi) => sum + ((oi.items?.cost_price || 0) * oi.quantity), 0) || 0
      const profit = offer.price - totalCost
      if (profit > 0) {
        ctx.font = 'bold 24px Montserrat, sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.shadowBlur = 5
        ctx.beginPath()
        ctx.roundRect((width / 2) + 160, y + 50, 180, 40, 20)
        ctx.fillStyle = '#ef4444' // red-500 badge
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.fillText('MEGA SAVINGS', (width / 2) + 250, y + 78)
      }

      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `BB_${offer.name.replace(/\s+/g, '_')}_Post.png`
      link.href = dataUrl
      link.click()

      localStorage.setItem('bb_image_gen_count', (count + 1).toString())
      toast.success('Social Media Post Generated & Downloaded!', { id: 'img-gen' })

    } catch (err) {
      console.error(err)
      toast.error('Failed to generate image: ' + err.message, { id: 'img-gen' })
    } finally {
      setIsGeneratingImage(null)
    }
  }

  function updateOfferItemQty(item_id, delta) {
    setOfferItems(prev => prev.map(p => p.item_id === item_id ? { ...p, quantity: p.quantity + delta } : p).filter(p => p.quantity > 0))
  }

  async function saveOffer(e) {
    e.preventDefault()
    if (!form.name || !form.price) return toast.error('Enter name and price')
    if (offerItems.length === 0) return toast.error('Add at least one item to the combo')

    setLoading(true)
    const payload = {
      name: form.name,
      description: form.description,
      offer_type: 'COMBO_BUNDLE',
      price: parseFloat(form.price),
      is_active: form.is_active,
      branch_id: branchId === 'All Branches' ? null : branchId
    }

    try {
      let offerId = form.id
      if (offerId) {
        // Update existing
        const { error: updateError } = await supabase.from('offers').update(payload).eq('id', offerId)
        if (updateError) throw updateError
        // Clear old offer items
        await supabase.from('offer_items').delete().eq('offer_id', offerId)
      } else {
        // Create new
        const { data, error: insertError } = await supabase.from('offers').insert(payload).select()
        if (insertError) throw insertError
        if (!data || data.length === 0) throw new Error('Offer created but database returned no ID. Please refresh the page.')
        offerId = data[0].id
      }

      // Insert new offer items
      const { error: itemsError } = await supabase.from('offer_items').insert(
        offerItems.map(oi => ({
          offer_id: offerId,
          item_id: oi.item_id,
          quantity: oi.quantity
        }))
      )
      if (itemsError) throw itemsError

      toast.success(form.id ? 'Offer updated!' : 'Offer created!')
      resetForm()
      fetchData()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function deleteOffer(id) {
    if (!window.confirm('Delete this offer?')) return
    await supabase.from('offers').delete().eq('id', id)
    toast.success('Offer deleted')
    fetchData()
  }

  async function toggleActive(o) {
    await supabase.from('offers').update({ is_active: !o.is_active }).eq('id', o.id)
    setOffers(p => p.map(x => x.id === o.id ? { ...x, is_active: !o.is_active } : x))
  }

  const filteredSearchItems = itemSearch.trim() ? items.filter(i => 
    i.name.toLowerCase().includes(itemSearch.toLowerCase()) || 
    (i.variant || '').toLowerCase().includes(itemSearch.toLowerCase())
  ).slice(0, 10) : []

  async function generateAiCombo() {
    const groqKey = import.meta.env.VITE_GROQ_API_KEY
    const orKey = import.meta.env.VITE_OPENROUTER_API_KEY
    
    if (!groqKey && !orKey) return toast.error('No AI API keys configured')

    if (items.length === 0) return toast.error('No items available for generation')

    setIsAiGenerating(true)
    
    // STRICT INVENTORY FILTERING FOR AI:
    // 1. Must have valid CP (>= 30% of SP)
    // 2. Must be profitable (CP < SP)
    // 3. Must ONLY be Cafe Menu or Beverages (no tobacco, cigarettes, paan, etc)
    const validItems = items.filter(i => {
      if (!i.cost_price || i.cost_price <= 0) return false
      if (i.cost_price >= i.price) return false // Prevent selling at a loss
      if (i.cost_price < (0.30 * i.price)) return false // Enforce 30% rule
      
      const cat = (i.category || '').toLowerCase()
      // Only allow Cafe and Beverages
      if (!cat.includes('cafe') && !cat.includes('beverage') && !cat.includes('drink') && !cat.includes('snack')) {
        return false
      }
      return true
    })
    if (validItems.length < 2) {
      setIsAiGenerating(false)
      return toast.error('Need at least 2 items with Cost Prices filled in the inventory to generate combos.')
    }

    const itemsData = validItems.map(i => `ID: ${i.id} | Name: ${i.name} ${i.variant || ''} | Sell Price: ₹${i.price} | Cost Price: ₹${i.cost_price}`).join('\n')

    let strategyText = ''
    if (aiStrategy === 'Profit') strategyText = 'Focus STRICTLY on items with the absolute highest profit margins (Sell Price minus Cost Price). Your goal is to maximize the margin for the business. Ensure the combo price leaves a massive margin.'
    else if (aiStrategy === 'Satisfaction') strategyText = 'Focus on classic, high-satisfaction pairings (e.g., Burger + Fries + Coke, or Chai + Samosa) that customers love.'
    else strategyText = 'Create a clearance combo to move stock. Combine popular items with random add-ons.'

    const prompt = `You are an AI assistant for a cafe/paan shop.
Your task is to generate a single new Combo Offer based on the following available inventory:

${itemsData}

STRATEGY: ${strategyText}

RULES:
1. Select 2 to 4 items from the list above. DO NOT invent items or IDs.
2. Determine an appropriate discounted combo price (lower than the sum of individual sell prices, but higher than the sum of cost prices to ensure some profit).
3. Provide a catchy name and a short marketing description.
4. Output EXACTLY valid JSON matching this structure:
{
  "name": "Combo Name",
  "description": "Short description",
  "price": 199,
  "items": [
    { "item_id": "...", "quantity": 1 }
  ]
}
No markdown formatting or extra text. ONLY raw JSON.`

    // Auto-switching Free Models List
    const freeModels = [
      { id: localStorage.getItem('lastWorkingAiModel'), provider: localStorage.getItem('lastWorkingAiProvider') }, // Memory from previous success
      { id: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
      { id: 'meta-llama/llama-3.2-3b-instruct:free', provider: 'openrouter' },
      { id: 'nvidia/nemotron-3-nano-30b-a3b:free', provider: 'openrouter' },
      { id: 'llama-3.3-70b-versatile', provider: 'groq' } // Final reliable fallback
    ].filter(m => m.id && ((m.provider === 'groq' && groqKey) || (m.provider === 'openrouter' && orKey)))

    let data = null
    let usedModel = null

    for (const modelDef of freeModels) {
      try {
        const url = modelDef.provider === 'groq' 
          ? 'https://api.groq.com/openai/v1/chat/completions' 
          : 'https://openrouter.ai/api/v1/chat/completions'
          
        const authKey = modelDef.provider === 'groq' ? groqKey : orKey

        const res = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authKey}`
          },
          body: JSON.stringify({ 
            model: modelDef.id,
            messages: [{ role: 'user', content: prompt }]
          })
        })
        
        if (!res.ok) continue // Move to next model if failed
        
        const resData = await res.json()
        if (resData?.choices?.[0]?.message?.content) {
           data = resData
           usedModel = modelDef
           break // Success! Stop looping.
        }
      } catch (e) {
        continue // Network error, try next
      }
    }

    try {
      if (!data) throw new Error('All AI models failed or were rate-limited.')

      // Save successful model to memory
      localStorage.setItem('lastWorkingAiModel', usedModel.id)
      localStorage.setItem('lastWorkingAiProvider', usedModel.provider)

      let text = data?.choices?.[0]?.message?.content || ''
      text = text.replace(/```json/g, '').replace(/```/g, '').trim()
      
      const parsed = JSON.parse(text)
      
      const newOfferItems = parsed.items.map(pi => {
        const fullItem = items.find(i => i.id === pi.item_id)
        if (!fullItem) return null
        return {
          item_id: fullItem.id,
          quantity: pi.quantity,
          name: fullItem.name,
          variant: fullItem.variant,
          cost_price: fullItem.cost_price || 0,
          price: fullItem.price || 0
        }
      }).filter(Boolean)

      let finalPrice = parsed.price
      const totalGeneratedCP = newOfferItems.reduce((acc, oi) => acc + (oi.cost_price * oi.quantity), 0)
      if (finalPrice <= totalGeneratedCP) {
        // AI Hallucinated a loss-making price, auto-correct to 20% profit margin
        finalPrice = Math.ceil(totalGeneratedCP * 1.2)
      }

      setForm({ id: null, name: parsed.name, description: parsed.description || '', price: finalPrice, is_active: true })
      setOfferItems(newOfferItems)
      setShowAiModal(false)
      setShowForm(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      toast.success(`AI Combo Generated using ${usedModel.id.split('/')[1] || usedModel.id}!`)
    } catch (e) {
      console.error(e)
      toast.error('Failed to generate AI combo: ' + e.message)
    } finally {
      setIsAiGenerating(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <Tag className="text-indigo-500" />
            Combos & Offers
          </h1>
          <p className="text-sm font-bold text-zinc-500 mt-1">Manage bundled discounts shown on POS.</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> <span className="hidden sm:inline">Create Combo</span>
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border-2 border-indigo-500/20 p-6 animate-slide-up">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black">{form.id ? 'Edit Combo Offer' : 'New Combo Offer'}</h2>
            <button onClick={resetForm} className="text-zinc-400 hover:text-red-500"><X size={20}/></button>
          </div>
          
          {!form.id && (
            <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/50 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-bold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-2">✨ AI Auto-Generate</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <select className="input flex-1 py-2 text-sm" value={aiStrategy} onChange={e => setAiStrategy(e.target.value)}>
                  <option value="Profit">Strategy: Maximize Profit</option>
                  <option value="Satisfaction">Strategy: Maximize Satisfaction</option>
                  <option value="Clearance">Strategy: Clear Old Stock</option>
                </select>
                <button 
                  type="button"
                  onClick={generateAiCombo} 
                  disabled={isAiGenerating}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex justify-center items-center gap-2 whitespace-nowrap shadow-sm"
                >
                  {isAiGenerating ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : 'Generate Offer'}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={saveOffer} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Offer Name *</label>
                <input className="input w-full" value={form.name} onChange={e=>setForm(p=>({...p, name: e.target.value}))} placeholder="e.g. Burger Combo" required autoFocus/>
              </div>
              <div>
                <label className="label">Combo Price (₹) *</label>
                <input type="number" min="0" step="0.5" className="input w-full font-black text-indigo-600" value={form.price} onChange={e=>setForm(p=>({...p, price: e.target.value}))} placeholder="0" required/>
              </div>
              <div className="md:col-span-2 flex justify-between items-end gap-4">
                <div className="flex-1">
                  <label className="label">Description (Optional)</label>
                  <input className="input w-full" value={form.description} onChange={e=>setForm(p=>({...p, description: e.target.value}))} placeholder="e.g. Buy 1 Burger get 1 Coke Free"/>
                </div>
                {/* Profit Display for Reference */}
                <div className="w-1/3 min-w-[120px] bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 text-center">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Combo Profit</p>
                  <p className={`text-lg font-black ${parseFloat(form.price) - offerItems.reduce((s,i) => s + (i.cost_price * i.quantity), 0) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-500'}`}>
                    ₹{(parseFloat(form.price || 0) - offerItems.reduce((s,i) => s + ((i.cost_price || 0) * i.quantity), 0)).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50 dark:bg-zinc-800/50">
              <label className="label mb-2 block text-indigo-600 dark:text-indigo-400">Search & Add Items to this Combo *</label>
              
              {/* Custom Search Bar Request */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 text-zinc-400" size={18} />
                <input 
                  type="text" 
                  className="input w-full pl-10 border-indigo-200 dark:border-indigo-800 focus:ring-indigo-500" 
                  placeholder="Search inventory to add items..." 
                  value={itemSearch} 
                  onChange={(e) => setItemSearch(e.target.value)} 
                />
                {filteredSearchItems.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xl rounded-xl z-50 overflow-hidden">
                    {filteredSearchItems.map(item => (
                      <button 
                        key={item.id} 
                        type="button"
                        onClick={() => addOfferItem(item)}
                        className="w-full text-left px-4 py-2 text-sm font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex justify-between items-center"
                      >
                        <span>{item.name} <span className="text-[10px] text-zinc-500 normal-case">{item.variant}</span></span>
                        <span className="text-emerald-600">₹{item.price}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Items */}
              {offerItems.length > 0 ? (
                <div className="space-y-2">
                  {offerItems.map((oi, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{oi.name}</p>
                        {oi.variant && <p className="text-[10px] font-bold text-zinc-500">{oi.variant}</p>}
                        <p className="text-[10px] font-semibold text-zinc-400 mt-0.5">SP: ₹{oi.price || 0} | CP: ₹{oi.cost_price || 0}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                          <button type="button" onClick={() => updateOfferItemQty(oi.item_id, -1)} className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><Minus size={14}/></button>
                          <span className="w-8 text-center text-sm font-black">{oi.quantity}</span>
                          <button type="button" onClick={() => updateOfferItemQty(oi.item_id, 1)} className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><Plus size={14}/></button>
                        </div>
                        <button type="button" onClick={() => setOfferItems(p => p.filter(x => x.item_id !== oi.item_id))} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end gap-4 p-2 mt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Total SP: <span className="text-zinc-900 dark:text-white">₹{offerItems.reduce((acc, oi) => acc + ((oi.price || 0) * oi.quantity), 0).toFixed(2)}</span></p>
                    <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Total CP: <span className="text-zinc-900 dark:text-white">₹{offerItems.reduce((acc, oi) => acc + ((oi.cost_price || 0) * oi.quantity), 0).toFixed(2)}</span></p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
                  <p className="text-xs font-bold text-zinc-400">No items added to combo yet.</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center border-t border-zinc-200 dark:border-zinc-800 pt-4 mt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-500" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Active Offer</span>
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : form.id ? 'Update Offer' : 'Save Combo Offer'}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Offers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {offers.map(o => {
          const totalCost = o.offer_items?.reduce((sum, oi) => sum + ((oi.items?.cost_price || 0) * oi.quantity), 0) || 0
          const profit = o.price - totalCost
          return (
          <div key={o.id} className={`card p-4 transition-all ${!o.is_active ? 'opacity-60 grayscale' : 'border border-indigo-100 dark:border-indigo-900/30 shadow-md'}`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-black text-lg text-zinc-900 dark:text-white leading-tight">{o.name}</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{o.description}</p>
              </div>
              <div className="text-right">
                <span className="font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg text-sm block">₹{o.price}</span>
                <span className={`text-[10px] font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'} mt-1 block`}>Profit: ₹{profit.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="mt-4 mb-4 space-y-1">
              {o.offer_items?.map(oi => (
                <div key={oi.id} className="flex justify-between items-center text-xs border-b border-zinc-100 dark:border-zinc-800/50 pb-1">
                  <div>
                    <span className="font-bold text-zinc-600 dark:text-zinc-400">{oi.quantity}x {oi.items?.name}</span>
                    <span className="text-[9px] text-zinc-400 ml-1">{oi.items?.variant}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">CP: ₹{oi.items?.cost_price || 0}</span>
                    <button onClick={() => { setEditCpItem({id: oi.item_id, name: oi.items?.name, variant: oi.items?.variant}); setNewCpValue(oi.items?.cost_price || ''); }} className="text-indigo-400 hover:text-indigo-600"><Edit2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <button onClick={() => toggleActive(o)} className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded ${o.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-500'}`}>
                {o.is_active ? 'Active' : 'Inactive'}
              </button>
              <div className="flex gap-2 items-center">
                <button onClick={() => setPostGenOffer(o)} disabled={isGeneratingImage === o.id} className="p-1.5 text-xs font-bold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded flex items-center gap-1 disabled:opacity-50">
                  {isGeneratingImage === o.id ? 'Generating...' : '✨ Insta Post'}
                </button>
                <button onClick={() => handleEdit(o)} className="p-1.5 text-zinc-400 hover:text-indigo-500 bg-zinc-50 dark:bg-zinc-800 rounded"><Edit2 size={14}/></button>
                <button onClick={() => deleteOffer(o.id)} className="p-1.5 text-zinc-400 hover:text-red-500 bg-zinc-50 dark:bg-zinc-800 rounded"><Trash2 size={14}/></button>
              </div>
            </div>
          </div>
          )
        })}
        {offers.length === 0 && !loading && (
          <div className="text-center py-12 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl col-span-full">
            <Tag className="mx-auto text-zinc-300 mb-4" size={48} />
            <h3 className="text-lg font-black text-zinc-400 mb-2">No Combos Found</h3>
            <p className="text-sm text-zinc-500">Create bundle offers to boost sales.</p>
          </div>
        )}
      </div>

      {/* CP Enforcement Modal */}
      {missingCpItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-slide-up border border-red-200 dark:border-red-900/50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-red-600 flex items-center gap-2">Missing Cost Price</h3>
              <button onClick={() => { setMissingCpItem(null); stopSiren(); }} className="text-zinc-400 hover:text-red-500"><X size={20}/></button>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              You must enter a Cost Price for <strong className="text-zinc-900 dark:text-white">{missingCpItem.name} {missingCpItem.variant || ''}</strong> before adding it to a combo. This ensures accurate profit calculations.
            </p>
            <label className="label mb-2 block">Cost Price (₹)</label>
            <input 
              type="number" 
              className="input w-full mb-6" 
              value={newCpValue} 
              onChange={e => {
                setNewCpValue(e.target.value);
                stopSiren(); // Stop siren as soon as admin starts typing
              }}
              placeholder="e.g. 50"
              autoFocus
            />
            <button 
              onClick={handleSaveCp} 
              disabled={loading}
              className="w-full btn-primary py-3 flex justify-center items-center gap-2"
            >
              {loading ? 'Saving...' : 'Save & Add Item'}
            </button>
          </div>
        </div>
      )}

      {/* Inline CP Edit Modal */}
      {editCpItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-slide-up border border-indigo-200 dark:border-indigo-900/50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-indigo-600 flex items-center gap-2">Edit Cost Price</h3>
              <button onClick={() => setEditCpItem(null)} className="text-zinc-400 hover:text-red-500"><X size={20}/></button>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Update CP for <strong className="text-zinc-900 dark:text-white">{editCpItem.name} {editCpItem.variant || ''}</strong> globally.
            </p>
            <label className="label mb-2 block">Cost Price (₹)</label>
            <input 
              type="number" 
              className="input w-full mb-6" 
              value={newCpValue} 
              onChange={e => setNewCpValue(e.target.value)}
              placeholder="e.g. 50"
              autoFocus
            />
            <button 
              onClick={saveInlineCp} 
              disabled={loading}
              className="w-full btn-primary py-3 flex justify-center items-center gap-2"
            >
              {loading ? 'Saving...' : 'Update Cost Price'}
            </button>
          </div>
        </div>
      )}

      {/* Social Media Generator Modal */}
      {postGenOffer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-slide-up border border-purple-200 dark:border-purple-900/50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-purple-600 flex items-center gap-2">✨ Create Insta Post</h3>
              <button onClick={() => setPostGenOffer(null)} className="text-zinc-400 hover:text-red-500"><X size={20}/></button>
            </div>
            
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Select an AI Image Model to generate a stunning background for <strong className="text-zinc-900 dark:text-white">{postGenOffer.name}</strong>.
            </p>
            
            <label className="label mb-2 block text-zinc-700 dark:text-zinc-300">AI Image Model</label>
            <select 
              className="input w-full mb-6 font-semibold"
              value={selectedImgModel}
              onChange={e => setSelectedImgModel(e.target.value)}
            >
              <optgroup label="OpenAI">
                <option value="gpt-image-1.5">GPT Image 1.5</option>
                <option value="dall-e-3">DALL-E 3</option>
                <option value="gpt-image-1">GPT Image 1</option>
              </optgroup>
              <optgroup label="Google">
                <option value="gemini-2.5-flash-image-preview">Gemini 2.5 Flash</option>
                <option value="gemini">Gemini Default</option>
                <option value="nano-banana-2">Nano Banana 2</option>
              </optgroup>
              <optgroup label="Flux & Others">
                <option value="flux-schnell">FLUX 1 Schnell</option>
                <option value="flux-2-klein-9b-base">FLUX 2 Klein</option>
                <option value="grok-2-image">Grok 2 Image</option>
                <option value="lucid-origin">Leonardo Lucid Origin</option>
              </optgroup>
            </select>
            
            <button 
              onClick={() => generateSocialPost(postGenOffer, selectedImgModel)} 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-sm"
            >
              Generate & Download
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
