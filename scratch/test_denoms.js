import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://lujndihscuupkggeslyb.supabase.co' // we can find it in config/env
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

// Let's read from the env or config first if needed.
console.log('Fetching supabase config...')
