/**
 * voiceAI.js — Pluggable Multi-Model Voice Command Engine
 *
 * Cascade order (skips tiers with no key):
 *   Tier 1: Groq / Llama 3.1   — 14,400 req/day free, ultra-fast
 *   Tier 2: Gemini 2.0 Flash   — 1,500 req/day free, best for Indian languages
 *   Tier 3: OpenRouter          — 50+ free models via one key
 *   Tier 4: Local Parser        — offline, always works
 */

const TIMEOUT_MS = 4000;

// ─── System Prompt Builder ───────────────────────────────────────────────────
function buildSystemPrompt(inventory) {
  const inventoryList = inventory
    .filter(i => i.is_active && i.price)
    .map(i => `${i.id}|${i.name}${i.variant ? ' ' + i.variant : ''}`)
    .join('\n');

  return `You are a smart POS billing assistant for an Indian shop. You understand Gujarati, Hindi, and English mixed speech (Hinglish/Gujlish).

INVENTORY (format: id|name):
${inventoryList}

Your job: Parse the user's spoken text and return a JSON array of actions.

AVAILABLE ACTIONS:
- Add item: {"action":"ADD_ITEM","item_id":"<exact id from inventory>","qty":<number>,"pack_mode":<true if they say box/pack/dabba/packet>}
- Remove item: {"action":"REMOVE_ITEM","item_id":"<id>"}
- Set quantity: {"action":"SET_QTY","item_id":"<id>","qty":<number>}
- Clear cart: {"action":"CLEAR_CART"}
- Find customer: {"action":"FIND_CUSTOMER","query":"<name or mobile number>"}
- Set order type: {"action":"SET_ORDER_TYPE","value":"<Dine-in|Takeaway|Delivery>"}
- Set payment: {"action":"SET_PAYMENT","mode":"<CASH|UPI|CARD|KHATA|ADVANCE>","amount":<number or "remaining" or "total">}
- Set discount: {"action":"SET_DISCOUNT","type":"<FLAT|PERCENT>","value":<number>}
- Finalize bill: {"action":"FINALIZE_BILL"}
- Finalize and print: {"action":"FINALIZE_AND_PRINT"}

QUANTITY WORDS (Gujarati/Hindi/English):
ek/one/1=1, be/do/two/2=2, tran/teen/three/3=3, char/chaar/four/4=4, panch/five/5=5
chha/six/6=6, saat/seven/7=7, aath/eight/8=8, nav/nine/9=9, das/ten/10=10

PACK TRIGGER WORDS: box, pack, packet, dabba, boxes, packs, packets

PAYMENT MODES:
- Cash/rokad/nakad/naqad → CASH
- UPI/gpay/phonepay/paytm/googlepay → UPI
- Card/credit/debit → CARD
- Khata/udhar/credit/baki/baad ma/chhuta nathi → KHATA
- Advance → ADVANCE

ORDER TYPES:
- Dine-in/andar/inside/table → Dine-in
- Takeaway/parcel/bahar/outside/packet → Takeaway
- Delivery/deliver → Delivery

MATCHING RULES:
- Match items fuzzily — "chij maggi" = item containing "maggi" + "cheese" variant
- Common synonyms: chij→cheese, maska→butter, pani→water, chhas→buttermilk/chaas, mava→maavo
- "baki" or "remaining" as payment amount means the rest of the bill total
- If the user says "full amount" or "total" for a payment, use "total"
- Multiple items in one sentence separated by "aur", "ane", "and", "plus", ","

IMPORTANT: Return ONLY a valid JSON array. No explanation, no markdown, no backticks. Example:
[{"action":"ADD_ITEM","item_id":"abc-123","qty":2,"pack_mode":false},{"action":"SET_PAYMENT","mode":"CASH","amount":"total"}]`;
}

// ─── Tier 1: Groq ─────────────────────────────────────────────────────────────
async function callGroq(transcript, inventory) {
  const key = import.meta.env.VITE_GROQ_API_KEY;
  if (!key) throw new Error('No Groq key');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: buildSystemPrompt(inventory) },
        { role: 'user', content: transcript }
      ],
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) throw new Error(`Groq error: ${res.status}`);
  const data = await res.json();
  const raw = data.choices[0].message.content;
  // Groq json_object wraps in an object, extract array
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : (parsed.actions || parsed.commands || Object.values(parsed)[0]);
}

// ─── Tier 2: Gemini Flash ────────────────────────────────────────────────────
async function callGemini(transcript, inventory) {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) throw new Error('No Gemini key');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildSystemPrompt(inventory) + '\n\nUser said: ' + transcript }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
      })
    }
  );

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  let raw = data.candidates[0].content.parts[0].text.trim();
  // Strip markdown code fences if present
  raw = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(raw);
}

// ─── Tier 3: OpenRouter ──────────────────────────────────────────────────────
async function callOpenRouter(transcript, inventory) {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!key) throw new Error('No OpenRouter key');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'BB POS Voice Billing'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [
        { role: 'system', content: buildSystemPrompt(inventory) },
        { role: 'user', content: transcript }
      ],
      temperature: 0.1,
      max_tokens: 1024
    })
  });

  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
  const data = await res.json();
  let raw = data.choices[0].message.content.trim();
  raw = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  // Extract JSON array from response
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in OpenRouter response');
  return JSON.parse(match[0]);
}

// ─── Tier 4: Local Fallback (Dictionary + Fuse.js fuzzy match) ───────────────
export function localVoiceParser(transcript, inventory) {
  const {
    splitIntoPhrases, extractQuantity, normalizeWord,
    PACK_WORDS, FILLER_WORDS, ITEM_SYNONYMS, NUMBER_MAP,
    detectPaymentMode, detectOrderType, detectAction,
    REMAINING_WORDS, CUSTOMER_TRIGGERS,
  } = window.__indianDict__ || {};

  // If dictionary not yet loaded, use minimal inline fallback
  if (!window.__indianDict__) {
    return _minimalLocalParser(transcript, inventory);
  }

  const Fuse = window.__Fuse__;
  const rawText = transcript.toLowerCase().replace(/[.]/g, '').trim();
  const actions = [];

  // Check top-level action intent
  const topAction = detectAction(rawText);
  if (topAction === 'CLEAR') return [{ action: 'CLEAR_CART' }];
  if (topAction === 'FINALIZE') return [{ action: 'FINALIZE_BILL' }];
  if (topAction === 'PRINT') return [{ action: 'FINALIZE_AND_PRINT' }];

  // Check order type
  const orderType = detectOrderType(rawText);
  if (orderType) actions.push({ action: 'SET_ORDER_TYPE', value: orderType });

  // Check payment mode
  const payMode = detectPaymentMode(rawText);
  if (payMode) {
    // Try to extract amount from the text
    const numWords = rawText.split(/\s+/);
    let amount = 'total';
    for (const w of numWords) {
      if (NUMBER_MAP[w] !== undefined) { amount = NUMBER_MAP[w]; break; }
    }
    const isRemaining = REMAINING_WORDS.some(r => rawText.includes(r));
    actions.push({ action: 'SET_PAYMENT', mode: payMode, amount: isRemaining ? 'remaining' : amount });
  }

  // Check customer trigger
  if (CUSTOMER_TRIGGERS.some(t => rawText.includes(t))) {
    const query = rawText.replace(/customer|kastamr|naam|name|search|shodh|find/gi, '').trim();
    if (query.length > 2) actions.push({ action: 'FIND_CUSTOMER', query });
  }

  // Build Fuse index for item matching
  const activeItems = inventory.filter(i => i.is_active && i.price);
  const fuseIndex = Fuse ? new Fuse(activeItems, {
    keys: ['name', 'variant'],
    threshold: 0.4,
    includeScore: true,
    useExtendedSearch: false,
  }) : null;

  // Parse item phrases
  const phrases = splitIntoPhrases(rawText);
  for (const phrase of phrases) {
    if (!phrase) continue;

    // Skip if this phrase is just a payment/action
    if (detectPaymentMode(phrase) || detectAction(phrase) || detectOrderType(phrase)) continue;

    const words = phrase.split(/\s+/).filter(w => !FILLER_WORDS.has(w));
    if (!words.length) continue;

    const { qty, remaining } = extractQuantity(words);
    const itemWords = remaining.filter(w => !PACK_WORDS.has(w));
    const isPackMode = remaining.some(w => PACK_WORDS.has(w));

    if (!itemWords.length) continue;

    // Normalize words through dictionary
    const normalizedWords = itemWords.map(w => ITEM_SYNONYMS[w] || normalizeWord(w));
    const searchTerm = normalizedWords.join(' ');

    let matchedItem = null;

    if (fuseIndex) {
      const results = fuseIndex.search(searchTerm);
      if (results.length > 0 && results[0].score < 0.5) matchedItem = results[0].item;
    }

    // Manual scoring fallback if Fuse not available
    if (!matchedItem) {
      let bestScore = 0;
      for (const item of activeItems) {
        const fullName = `${item.name || ''} ${item.variant || ''}`.toLowerCase();
        let score = normalizedWords.reduce((s, w) =>
          s + (fullName.includes(w) ? 10 : w.length >= 4 && fullName.includes(w.substring(0, 4)) ? 5 : 0), 0);
        if (score > bestScore && score >= 5) { bestScore = score; matchedItem = item; }
      }
    }

    if (matchedItem) {
      actions.push({ action: 'ADD_ITEM', item_id: matchedItem.id, qty, pack_mode: isPackMode });
    }
  }

  return actions;
}

// Minimal inline parser used when dictionary hasn't loaded yet
function _minimalLocalParser(transcript, inventory) {
  const rawText = transcript.toLowerCase().replace(/[.]/g, '').trim();
  const phrases = rawText.split(/\s+(?:and|aur|ane|plus)\s+|,/);
  const qtyMap = { 'ek':1,'be':2,'tran':3,'char':4,'panch':5,'chha':6,'saat':7,'aath':8,'nav':9,'das':10,'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10 };
  const packWords = new Set(['box','pack','packet','dabba']);
  const actions = [];
  for (let phrase of phrases) {
    const words = phrase.trim().split(/\s+/);
    let qty = 1; let raw = words;
    if (qtyMap[words[0]] !== undefined) { qty = qtyMap[words[0]]; raw = words.slice(1); }
    else if (qtyMap[words[words.length-1]] !== undefined) { qty = qtyMap[words[words.length-1]]; raw = words.slice(0,-1); }
    const isPack = raw.some(w => packWords.has(w));
    const itemWords = raw.filter(w => !packWords.has(w));
    const itemName = itemWords.join(' ');
    const match = inventory.find(i => i.is_active && i.price && (`${i.name||''} ${i.variant||''}`).toLowerCase().includes(itemName));
    if (match) actions.push({ action: 'ADD_ITEM', item_id: match.id, qty, pack_mode: isPack });
  }
  return actions;
}

// ─── Main Export: processVoiceCommand ────────────────────────────────────────
/**
 * @param {string} transcript - Raw speech text
 * @param {Array} inventory   - Full items array from DB
 * @returns {{ actions: Array, tier: string }}
 */
export async function processVoiceCommand(transcript, inventory) {
  const withTimeout = (promise) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))
    ]);

  // Tier 1: Groq
  if (import.meta.env.VITE_GROQ_API_KEY) {
    try {
      const actions = await withTimeout(callGroq(transcript, inventory));
      if (Array.isArray(actions) && actions.length > 0) return { actions, tier: '⚡ Groq' };
    } catch (e) {
      console.warn('[VoiceAI] Groq failed:', e.message);
    }
  }

  // Tier 2: Gemini
  if (import.meta.env.VITE_GEMINI_API_KEY) {
    try {
      const actions = await withTimeout(callGemini(transcript, inventory));
      if (Array.isArray(actions) && actions.length > 0) return { actions, tier: '🧠 Gemini' };
    } catch (e) {
      console.warn('[VoiceAI] Gemini failed:', e.message);
    }
  }

  // Tier 3: OpenRouter
  if (import.meta.env.VITE_OPENROUTER_API_KEY) {
    try {
      const actions = await withTimeout(callOpenRouter(transcript, inventory));
      if (Array.isArray(actions) && actions.length > 0) return { actions, tier: '🔀 OpenRouter' };
    } catch (e) {
      console.warn('[VoiceAI] OpenRouter failed:', e.message);
    }
  }

  // Tier 4: Local Fallback
  console.warn('[VoiceAI] All AI tiers failed — using local parser');
  const actions = localVoiceParser(transcript, inventory);
  return { actions, tier: '📖 Offline' };
}
