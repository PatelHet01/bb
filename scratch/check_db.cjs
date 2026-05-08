const fetch = require('node-fetch');
require('dotenv').config();

async function check() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  const tablesRes = await fetch(`${url}/rest/v1/cafe_tables?branch_id=eq.bhat&select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const tables = await tablesRes.json();
  console.log('Tables for bhat:', tables.length);

  const itemsRes = await fetch(`${url}/rest/v1/items?branch_id=eq.bhat&select=category,subcategory`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const items = await itemsRes.json();
  const cats = [...new Set(items.map(i => i.category))];
  console.log('Categories for bhat:', cats);
  
  const paanItems = items.filter(i => i.category === 'Paan');
  console.log('Paan items for bhat:', paanItems.length);
}

check();
