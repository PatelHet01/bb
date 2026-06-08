/**
 * indianVoiceDictionary.js
 * 
 * Comprehensive Gujarati + Hindi → Billing Action dictionary.
 * Used by the local voice parser as an offline fallback.
 * 
 * Cached in localStorage on first load. Zero network dependency after that.
 * 
 * Coverage:
 *  - Numbers (1–1000) in Gujarati & Hindi
 *  - Quantities, fractions
 *  - Payment modes
 *  - Order actions (add, remove, clear, finalize, print)
 *  - Order types
 *  - Pack/box words
 *  - Item name synonyms & phonetic variants
 *  - Connector/joiner words (to split multi-item phrases)
 *  - Filler/noise words (to ignore)
 *  - Customer search triggers
 *  - Discount words
 */

// ─── Numbers: Gujarati & Hindi spoken forms → integer ───────────────────────
export const NUMBER_MAP = {
  // Gujarati
  'ek': 1, 'be': 2, 'tran': 3, 'char': 4, 'panch': 5,
  'chha': 6, 'saat': 7, 'aath': 8, 'nav': 9, 'das': 10,
  'agyar': 11, 'bar': 12, 'ter': 13, 'chaud': 14, 'pandhar': 15,
  'sol': 16, 'sattar': 17, 'adar': 18, 'ognis': 19, 'vis': 20,
  'ekvis': 21, 'baavis': 22, 'tevis': 23, 'chovis': 24, 'panchavis': 25,
  'chhavis': 26, 'sattavis': 27, 'aathavis': 28, 'ogatris': 29, 'tris': 30,
  'challis': 40, 'panchas': 50, 'saaath': 60, 'sitter': 70, 'eghash': 80,
  'navvu': 90, 'so': 100, 'ek so': 100, 'be so': 200, 'tran so': 300,
  'char so': 400, 'panch so': 500, 'chha so': 600, 'saat so': 700,
  'aath so': 800, 'nav so': 900, 'hazar': 1000,

  // Hindi
  'ek': 1, 'do': 2, 'teen': 3, 'chaar': 4, 'paanch': 5,
  'chhe': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
  'gyarah': 11, 'barah': 12, 'terah': 13, 'chaudah': 14, 'pandrah': 15,
  'solah': 16, 'satrah': 17, 'atharah': 18, 'unnis': 19, 'bees': 20,
  'pachees': 25, 'tees': 30, 'chalees': 40, 'pachaas': 50,
  'saath': 60, 'sattar': 70, 'assi': 80, 'nabbe': 90,
  'ek sau': 100, 'do sau': 200, 'teen sau': 300, 'char sau': 400,
  'paanch sau': 500, 'panch sau': 500, 'chhe sau': 600, 'saat sau': 700,
  'aath sau': 800, 'nau sau': 900, 'ek hazar': 1000,

  // English (already handled but kept for completeness)
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'fifteen': 15, 'twenty': 20,
  'twenty five': 25, 'thirty': 30, 'forty': 40, 'fifty': 50,
  'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
  'hundred': 100, 'thousand': 1000, 'half': 0.5,

  // Shorthand digits
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
};

// ─── Pack / Box trigger words ─────────────────────────────────────────────────
export const PACK_WORDS = new Set([
  'box', 'pack', 'packet', 'dabba', 'boxes', 'packs', 'packets',
  'peti', 'gallo', 'carton', 'cartoon', 'bundle',
]);

// ─── Connector words (split multi-item phrases on these) ─────────────────────
export const CONNECTORS = [
  'and', 'aur', 'ane', 'plus', 'ne', 'sathe', 'tatha', 'va', 'evam',
  'pachi', 'pachhi', 'tyar bad', 'ane pachi',
];

// ─── Noise/filler words (ignore completely) ───────────────────────────────────
export const FILLER_WORDS = new Set([
  'bhai', 'yaar', 'sir', 'boss', 'juo', 'juo ne', 'em', 'jem', 'haan',
  'haa', 'okay', 'ok', 'toh', 'to', 'na', 'ne', 'nu', 'ni', 'ma', 'me',
  'please', 'plz', 'bhai ne', 'yaar ne', 'aa', 'ae', 'e', 'le', 'de',
  'kar', 'karo', 'kari do', 'krna', 'karna', 'chahiye', 'chhe', 'che',
  'aapo', 'aap', 'aapi do', 'aapi de', 'lai do', 'lai de', 'lao',
  'lakhi lo', 'lakhi le', 'note kar', 'note karo', 'aa wala', 'wala',
  'waala', 'vala', 'valu', 'aek', 'ek dam', 'jaldi',
]);

// ─── Action words → billing actions ──────────────────────────────────────────
export const ACTION_WORDS = {
  // Remove item from cart
  REMOVE: ['kaad', 'kadh', 'hatav', 'hata', 'remove', 'delete', 'nahi', 'nai chahiye', 'cancel', 'nikalo', 'nikaal'],
  // Clear entire cart
  CLEAR: ['saaf kar', 'saaf karo', 'khali kar', 'clear kar', 'clear karo', 'sab hatav', 'sab hata', 'badhu kaad', 'reset'],
  // Finalize bill
  FINALIZE: ['bill kar', 'bill karo', 'bill banao', 'bill bano', 'complete kar', 'done', 'ho gayu', 'ho gaya', 'finish', 'submit', 'pakku kar', 'pakki'],
  // Finalize + print
  PRINT: ['print kar', 'print karo', 'chappo', 'chhapo', 'receipt', 'rasid', 'slip'],
  // Send to kitchen
  KITCHEN: ['kitchen', 'rasod', 'rasodu', 'order bhejo', 'andar bhejo'],
};

// ─── Payment mode words ───────────────────────────────────────────────────────
export const PAYMENT_WORDS = {
  CASH: [
    'cash', 'nakad', 'nakad ma', 'rokad', 'rokat', 'note', 'currency',
    'haath ma', 'hath ma', 'raju paise', 'paise', 'khullu', 'khuli',
    'change', 'paisa',
  ],
  UPI: [
    'upi', 'gpay', 'google pay', 'phonepay', 'phonepe', 'phone pe',
    'paytm', 'bhim', 'scanner', 'scan', 'qr', 'online', 'transfer',
    'net banking', 'netbanking', 'neft', 'imps', 'payment app',
    'fonpe', 'gupay', 'gpe',
  ],
  CARD: [
    'card', 'debit', 'credit', 'swipe', 'machine', 'atm', 'visa', 'mastercard',
    'rupay', 'pos', 'pos machine',
  ],
  KHATA: [
    'khata', 'khate', 'khata ma lakhi le', 'khata ma', 'udhar', 'udhaar',
    'baki', 'baaki', 'credit', 'pachhi', 'baad ma', 'bad ma',
    'aave tyare', 'avse tyare', 'pachi apashe', 'on credit',
    'hisab', 'hisaab', 'account', 'akdama nathi', 'nathi paise',
  ],
  ADVANCE: [
    'advance', 'advanc', 'advance ma thi', 'advance vaapr', 'advance vaapro',
    'advance use kar', 'advance lav', 'deposit',
  ],
};

// ─── "Remaining" / "rest of" amount words ────────────────────────────────────
export const REMAINING_WORDS = [
  'baki', 'baaki', 'remaining', 'rest', 'bachi gayo', 'bachi gayu',
  'jo bache', 'jo bacha', 'baakiltu', 'baki nu', 'baki thi',
];

// ─── Order type words ─────────────────────────────────────────────────────────
export const ORDER_TYPE_WORDS = {
  'Takeaway': [
    'parcel', 'takeaway', 'take away', 'bahar', 'packet', 'le javu',
    'ghare', 'ghare le javu', 'home', 'packing', 'pake', 'pack it',
    'outside', 'bahar nu', 'carry', 'carry out',
  ],
  'Dine-in': [
    'dine in', 'dinein', 'andar', 'inside', 'table', 'hall', 'beso',
    'ahiya', 'ahiya j', 'same place', 'yahan',
  ],
  'Delivery': [
    'delivery', 'deliver', 'deliver karo', 'ghar pahonchav',
    'pahonchav', 'zomato', 'swiggy', 'home delivery',
  ],
};

// ─── Discount words ───────────────────────────────────────────────────────────
export const DISCOUNT_TRIGGERS = {
  PERCENT: ['percent', 'parcent', 'tikdi', '%', 'tera', 'no discount'],
  FLAT: ['flat', 'rupiya', 'rupee', 'rs', 'kaad', 'minus', 'waat'],
};

// ─── Customer search triggers ─────────────────────────────────────────────────
export const CUSTOMER_TRIGGERS = [
  'customer', 'kastamr', 'party', 'naam', 'name', 'mobile', 'number',
  'search', 'find', 'shodh', 'kholo', 'select', 'link', 'attach',
  'rahul', 'jignesh', 'priya', 'patel', // common names (add yours)
];

// ─── Massive Item Synonym Dictionary (romanized Guj/Hindi → English) ─────────
// Format: spoken_word → canonical_english_word (matches item name/variant in DB)
export const ITEM_SYNONYMS = {
  // ── Dairy / Milk / Ice Cream ──────────────────────────────────────────────
  'doodh': 'milk', 'dudh': 'milk', 'doi': 'milk',
  'chhas': 'chaas', 'chhaas': 'chaas', 'chhachh': 'chaas',
  'buttermilk': 'chaas', 'matho': 'chaas',
  'makhan': 'butter', 'maska': 'butter', 'masaka': 'butter',
  'paneer': 'paneer', 'paner': 'paneer',
  'dahi': 'curd', 'dahii': 'curd', 'yogurt': 'curd',
  'ghee': 'ghee', 'ghi': 'ghee',
  'cream': 'cream', 'krim': 'cream',
  'milkshake': 'milkshake', 'shake': 'milkshake',
  'kulfi': 'kulfi', 'kulfee': 'kulfi',
  'icecream': 'ice cream', 'ice krim': 'ice cream',
  'chocobar': 'chocobar', 'choco bar': 'chocobar',
  'cone': 'cone', 'kone': 'cone',
  'cassata': 'cassata', 'kasata': 'cassata', 'casata': 'cassata',
  'rajbhog': 'rajbhog', 'raj bhog': 'rajbhog',

  // ── Drinks / Beverages ────────────────────────────────────────────────────
  'pani': 'water', 'paani': 'water', 'watter': 'water', 'botel': 'bottle',
  'paani ni botel': 'water bottle', 'pani botel': 'water bottle',
  'soda': 'soda', 'sado': 'soda', 'gotisoda': 'goti soda',
  'coke': 'coca cola', 'koke': 'coca cola', 'cola': 'coca cola',
  'pepsi': 'pepsi', 'pepasi': 'pepsi',
  'sprite': 'sprite', 'sprait': 'sprite', 'limbu': 'sprite',
  'fanta': 'fanta', 'phanta': 'fanta',
  'thums up': 'thums up', 'thamb up': 'thums up', 'thumbs up': 'thums up',
  'limca': 'limca', 'limka': 'limca',
  'maaza': 'maaza', 'maza': 'maaza', 'aam ras': 'maaza',
  'frooti': 'frooti', 'fruti': 'frooti', 'fruty': 'frooti', 'frutee': 'frooti',
  'slice': 'slice', 'slaice': 'slice',
  'mirinda': 'mirinda', 'miranda': 'mirinda',
  'mountain dew': 'mountain due', 'dew': 'mountain due', 'mtn dew': 'mountain due',
  'red bull': 'red bull', 'redbull': 'red bull', 'enrji': 'energy',
  'hell': 'hell energy', 'hel': 'hell energy',
  'monster': 'monster', 'manstr': 'monster',
  'chaas': 'chaas', 'mattha': 'chaas',
  'lassi': 'lassi', 'lassee': 'lassi',
  'juice': 'juice', 'joos': 'juice', 'ras': 'juice',
  'orange': 'orange', 'narnji': 'orange', 'pulpy': 'pulpy orange',
  'guava': 'guava', 'peru': 'guava',
  'lichi': 'lichi', 'lichee': 'lichi',
  'pomegranate': 'pomegranate', 'dadam': 'pomegranate',
  'coconut water': 'coconut water', 'naliyer pani': 'coconut water',
  'campa': 'campa', 'crush': 'crush', 'tropical': 'tropical crush',
  'kinley': 'kinley', 'kinle': 'kinley',
  'sting': 'sting', 'sating': 'sting',
  'thandai': 'thandai', 'thanda': 'cold',
  'amul': 'amul', 'shakti': 'shakti',
  'bournvita': 'bournvita', 'bornvita': 'bournvita', 'bornvitta': 'bournvita',
  'horlicks': 'horlicks', 'horlix': 'horlicks',

  // ── Tea / Coffee ──────────────────────────────────────────────────────────
  'chai': 'tea', 'chay': 'tea', 'chaa': 'tea',
  'masala chai': 'masala tea', 'masala chaa': 'masala tea',
  'coffee': 'coffee', 'kofi': 'coffee', 'kafi': 'coffee',
  'nescafe': 'nescafe', 'neskafe': 'nescafe', 'instant coffee': 'nescafe',
  'cold coffee': 'cold coffee', 'thanda coffee': 'cold coffee',

  // ── Cigarettes / Tobacco ──────────────────────────────────────────────────
  'cigarette': 'cigarette', 'sigret': 'cigarette', 'sigaret': 'cigarette',
  'bidi': 'bidi', 'beedi': 'bidi',
  'gold flake': 'gold flake', 'goldflek': 'gold flake', 'gf': 'gold flake',
  'black filter': 'black filter', 'blak filter': 'black filter',
  'advance': 'advance', 'advanc': 'advance',
  'capstan': 'capstan', 'kapstan': 'capstan',
  'classic': 'classic', 'klasik': 'classic',
  'navy cut': 'navy cut', 'navi cut': 'navy cut',
  'wills': 'wills', 'wil': 'wills',
  'marlboro': 'marlboro', 'malbaro': 'marlboro',
  'dunhill': 'dunhill',
  'beedi': 'bidi', 'manikchand': 'manikchand',
  'cigar': 'cigar', 'sigaar': 'cigar',

  // ── Paan / Mukhwas / Supari ───────────────────────────────────────────────
  'paan': 'paan', 'pan': 'paan',
  'supari': 'sopari', 'shupari': 'sopari', 'supaari': 'sopari',
  'sopari': 'sopari', 'sopaari': 'sopari',
  'mukhvas': 'mukhvas', 'mukhavas': 'mukhvas', 'mukhwas': 'mukhvas',
  'rajnigandha': 'rajnigandha', 'rajni': 'rajnigandha',
  'pan masala': 'pan masala', 'paan masala': 'pan masala',
  'mava': 'maavo', 'maava': 'maavo', 'mavo': 'maavo', 'mawa': 'maavo',
  'maavo': 'maavo', 'mava': 'maavo', 'tabacco': 'tobacco',
  'khaini': 'khaini', 'khaniki': 'khaini',
  'gutkha': 'gutkha', 'gutka': 'gutkha',
  'sounf': 'saunf', 'saounf': 'saunf', 'fennel': 'saunf',
  'elaichi': 'elaichi', 'elaychi': 'elaichi', 'ilaychi': 'elaichi',
  'cardamom': 'elaichi',
  'dost': 'dost supari', 'baba': 'baba sopari',
  'pulse': 'pulse', 'pass pass': 'pulse',

  // ── Snacks / Namkeen ──────────────────────────────────────────────────────
  'chips': 'chips', 'chivda': 'chivda',
  'balaji': 'balaji', 'bajali': 'balaji',
  'gathiya': 'gathiya', 'ganthiya': 'gathiya', 'ganthia': 'gathiya',
  'papdi': 'papdi', 'papdi gathiya': 'papdi gathiya',
  'sev': 'sev', 'mamra': 'mamra', 'sevmamra': 'sevmamra',
  'mirch masala': 'mirch masala', 'mirchi masala': 'mirch masala',
  'cream onion': 'cream and onion', 'cream ane onion': 'cream and onion',
  'katak batak': 'katak batak',
  'chatchaska': 'chatchaska', 'chatcha': 'chatchaska',
  'chataka pataka': 'chataka pataka',
  'kurkure': 'kurkure', 'lays': 'lays', 'bingo': 'bingo',
  'popcorn': 'popcorn', 'pop corn': 'popcorn',
  'pringles': 'pringles', 'pringle': 'pringles',
  'bhujia': 'bhujia', 'haldiram': 'haldiram',

  // ── Chocolate / Candy / Gum ───────────────────────────────────────────────
  'chocolate': 'chocolate', 'choclate': 'chocolate', 'choco': 'chocolate',
  'dairy milk': 'dairy milk', 'deri milk': 'dairy milk', 'cadbury': 'dairy milk',
  'kit kat': 'kit kat', 'kitkat': 'kit kat', 'kitat': 'kit kat',
  'five star': '5 star', '5star': '5 star',
  'munch': 'munch', 'manch': 'munch',
  'gems': 'gems', 'jems': 'gems',
  'eclairs': 'eclairs', 'ikler': 'eclairs', 'iklair': 'eclairs',
  'alpenliebe': 'alpenliebe', 'alpen': 'alpenliebe',
  'mentos': 'mantos', 'minto': 'mantos',
  'polo': 'polo',
  'tictac': 'tictac', 'tic tac': 'tictac',
  'boomer': 'boomer', 'bubble gum': 'boomer',
  'happydent': 'happydent', 'hepiden': 'happydent', 'happiden': 'happydent',
  'centerfresh': 'center fresh', 'center fresh': 'center fresh',
  'kopiko': 'kopiko',
  'pulse': 'pulse',
  'imli': 'imli', 'imlii': 'imli',
  'kachha aam': 'kachha aam', 'kacha aam': 'kachha aam',
  'mango candy': 'aam candy', 'aam candy': 'aam candy',
  'orange bar': 'orange bar',

  // ── Biscuits / Bakery ─────────────────────────────────────────────────────
  'biscuit': 'biscuit', 'biskit': 'biscuit', 'biskut': 'biscuit',
  'parle g': 'parle g', 'parleg': 'parle g',
  'bourbon': 'bourbon', 'borbon': 'bourbon',
  'marie': 'marie', 'maree': 'marie',
  'hide seek': 'hide and seek', 'hide n seek': 'hide and seek',
  'good day': 'good day',
  'khari': 'khari', 'khary': 'khari', 'khakhara': 'khakhara',
  'bread': 'bread', 'bred': 'bread', 'pav': 'pav',
  'toast': 'toast', 'tost': 'toast',
  'cake': 'cake', 'kek': 'cake',
  'puff': 'puff', 'paf': 'puff', 'paff': 'puff',
  'cream roll': 'cream roll', 'krim rol': 'cream roll',
  'waffle': 'waffle', 'wafal': 'waffle',
  'pizza base': 'pizza base',
  'burger bun': 'burger bun', 'bun': 'burger bun',

  // ── Food / Cafe Items ─────────────────────────────────────────────────────
  'maggi': 'maggi', 'megi': 'maggi', 'magi': 'maggi', 'maggifg': 'maggi',
  'noodles': 'maggi', 'nudels': 'maggi',
  'sandwich': 'sandwich', 'sandwitch': 'sandwich', 'sanwitch': 'sandwich',
  'vada pav': 'vada pav', 'vadapav': 'vada pav', 'vada': 'vada pav',
  'dabeli': 'kutchi dabeli', 'dabali': 'kutchi dabeli',
  'frankie': 'frankie', 'franky': 'frankie',
  'burger': 'burger', 'bagar': 'burger',
  'pizza': 'pizza', 'piza': 'pizza',
  'fries': 'fries', 'french fries': 'fries', 'chips': 'fries',
  'mexican fries': 'mexican fries',
  'salted fries': 'salted fries',
  'pasta': 'pasta', 'pesta': 'pasta',
  'soup': 'soup', 'sup': 'soup',
  'roll': 'roll',
  'wrap': 'wrap', 'rep': 'wrap',

  // ── Cheese (variants) ─────────────────────────────────────────────────────
  'cheese': 'cheese', 'chiz': 'cheese', 'chij': 'cheese',
  'cheez': 'cheese', 'chees': 'cheese', 'cheeze': 'cheese',

  // ── Condiments / Masala ───────────────────────────────────────────────────
  'masala': 'masala', 'ketchup': 'ketchup', 'mayo': 'mayo',
  'sauce': 'sauce', 'sos': 'sauce',
  'oregano': 'oregano', 'chilli flakes': 'chilli', 'mirchi': 'mirchi',
  'olive oil': 'olive oil', 'tel': 'oil',
  'butter': 'butter', 'jam': 'jam',

  // ── Personal Care / Medicine ──────────────────────────────────────────────
  'shampoo': 'shampoo', 'clinic plus': 'clinic plus',
  'soap': 'soap', 'sabun': 'soap',
  'vicks': 'vicks', 'vik': 'vicks',
  'eno': 'eno', 'no': 'eno',
  'hajmola': 'hajmola', 'hajmola': 'hajmola',
  'dettol': 'dettol',
  'band aid': 'band aid',
  'paracetamol': 'paracetamol',
  'sanitizer': 'sanitizer',

  // ── Household / Misc ──────────────────────────────────────────────────────
  'matchbox': 'matchbox', 'maachis': 'matchbox', 'machi': 'matchbox',
  'battery': 'cell', 'cell': 'cell', 'sel': 'cell',
  'lighter': 'lighter',
  'candle': 'candle', 'mombatti': 'candle',
  'rubber band': 'rubber band',
  'pin': 'pin',
  'pencil': 'pencil',
  'vim': 'vim', 'vim bar': 'vim',
  'surf': 'surf', 'surfexcel': 'surf excel',
  'ariel': 'ariel',
  'colgate': 'colgate', 'brush': 'toothbrush',
  'toothpaste': 'toothpaste',
};

// ─── Transliteration Variants (common romanized Gujarati phonetics) ──────────
// The mic with en-IN can output these variants for the same word
export const PHONETIC_VARIANTS = {
  // Numbers
  'ek': ['aek', 'eek', 'eck'],
  'be': ['bae', 'bay', 'bey'],
  'tran': ['traan', 'tren', 'trun'],
  'char': ['chaar', 'chhaar', 'chor'],
  'panch': ['paanch', 'pancha', 'panc'],
  'chha': ['cha', 'chhah', 'chah'],
  'saat': ['sat', 'saaat'],
  'aath': ['aat', 'aate'],
  'nav': ['naav', 'naw'],
  'das': ['daas', 'duss'],

  // Payment
  'nakad': ['nakd', 'naakad', 'nakadu'],
  'rokad': ['rokd', 'roakd'],
  'khata': ['khatta', 'khaata', 'khate'],
  'udhar': ['udhaar', 'udhaaru', 'udar'],
  'gpay': ['gupay', 'gpe', 'g pay', 'googlepay'],
  'phonepe': ['phonepay', 'fonpe', 'phone pay', 'fone pe'],

  // Items
  'maavo': ['maavo', 'mavo', 'mawa', 'maava', 'mava', 'maav'],
  'sopari': ['supari', 'sopaari', 'shupari', 'soopari'],
  'gathiya': ['ganthiya', 'ganthia', 'gathia'],
  'chaas': ['chhas', 'chhaas', 'chhachh', 'chach'],
};

// Build reverse lookup from phonetic variants
export const PHONETIC_LOOKUP = {};
Object.entries(PHONETIC_VARIANTS).forEach(([canonical, variants]) => {
  variants.forEach(v => { PHONETIC_LOOKUP[v] = canonical; });
});

// ─── Helper: normalize a single word using all dictionaries ──────────────────
export function normalizeWord(word) {
  const w = word.toLowerCase().trim();
  if (PHONETIC_LOOKUP[w]) return PHONETIC_LOOKUP[w];
  if (ITEM_SYNONYMS[w]) return ITEM_SYNONYMS[w];
  return w;
}

// ─── Helper: normalize full transcript ───────────────────────────────────────
export function normalizeTranscript(transcript) {
  return transcript
    .toLowerCase()
    .split(/\s+/)
    .map(normalizeWord)
    .join(' ');
}

// ─── Helper: split transcript into phrases on connector words ────────────────
export function splitIntoPhrases(text) {
  const connectorRegex = new RegExp(
    `\\s+(?:${CONNECTORS.join('|')})\\s+|,`,
    'gi'
  );
  return text.split(connectorRegex).map(p => p.trim()).filter(Boolean);
}

// ─── Helper: extract quantity from beginning or end of word array ─────────────
export function extractQuantity(words) {
  if (!words.length) return { qty: 1, remaining: words };
  
  // Try multi-word numbers first (e.g., "panch sau" = 500)
  if (words.length >= 2) {
    const twoWord = `${words[0]} ${words[1]}`;
    if (NUMBER_MAP[twoWord] !== undefined) {
      return { qty: NUMBER_MAP[twoWord], remaining: words.slice(2) };
    }
    const lastTwo = `${words[words.length - 2]} ${words[words.length - 1]}`;
    if (NUMBER_MAP[lastTwo] !== undefined) {
      return { qty: NUMBER_MAP[lastTwo], remaining: words.slice(0, -2) };
    }
  }
  
  // Single word quantity at start
  if (NUMBER_MAP[words[0]] !== undefined) {
    return { qty: NUMBER_MAP[words[0]], remaining: words.slice(1) };
  }
  // Single word quantity at end
  if (NUMBER_MAP[words[words.length - 1]] !== undefined) {
    return { qty: NUMBER_MAP[words[words.length - 1]], remaining: words.slice(0, -1) };
  }
  
  return { qty: 1, remaining: words };
}

// ─── Helper: detect payment mode from phrase ─────────────────────────────────
export function detectPaymentMode(text) {
  const t = text.toLowerCase();
  for (const [mode, words] of Object.entries(PAYMENT_WORDS)) {
    if (words.some(w => t.includes(w))) return mode;
  }
  return null;
}

// ─── Helper: detect order type ────────────────────────────────────────────────
export function detectOrderType(text) {
  const t = text.toLowerCase();
  for (const [type, words] of Object.entries(ORDER_TYPE_WORDS)) {
    if (words.some(w => t.includes(w))) return type;
  }
  return null;
}

// ─── Helper: detect action ────────────────────────────────────────────────────
export function detectAction(text) {
  const t = text.toLowerCase();
  for (const [action, words] of Object.entries(ACTION_WORDS)) {
    if (words.some(w => t.includes(w))) return action;
  }
  return null;
}

// ─── Helper: check if word is a remaining/baki indicator ────────────────────
export function isRemainingWord(word) {
  return REMAINING_WORDS.includes(word.toLowerCase());
}
