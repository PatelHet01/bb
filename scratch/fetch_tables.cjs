const fetch = require('node-fetch');
require('dotenv').config();

async function check() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  const res = await fetch(`${url}/rest/v1/cafe_tables?branch_id=eq.bhat&select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

check();
