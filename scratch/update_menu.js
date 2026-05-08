import fs from 'fs'

async function updateMenu() {
  const url = 'https://rvxhqzaykshgygrzrtjq.supabase.co/rest/v1/items'
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2eGhxemF5a3NoZ3lncnpydGpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTMzNDcsImV4cCI6MjA5MzQ4OTM0N30.nmw6BVDoJQPFVRCMv_TvdgL8rhA9tPvFVZ7BND-94Cg'
  
  const csvPath = '/Users/hackair/BB/materials/Bombay bethak  - Cafe menu .csv'
  const fileContent = fs.readFileSync(csvPath, 'utf-8')
  
  const lines = fileContent.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const headers = lines[0].split(',')
  const records = lines.slice(1).map(line => {
    const values = line.split(',')
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = values[i]
    })
    return obj
  })

  console.log(`Read ${records.length} items from CSV.`)

  // 1. Delete existing BB Cafe items for Bhat
  console.log('Deleting existing items...')
  const delRes = await fetch(`${url}?branch_id=eq.bhat&category=eq.BB%20Cafe`, {
    method: 'DELETE',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  })

  if (!delRes.ok) {
    console.error('Error deleting items:', await delRes.text())
    return
  }
  console.log('Deleted existing items.')

  // 2. Prepare new items
  const newItems = records.map(r => ({
    branch_id: 'bhat',
    category: 'BB Cafe',
    subcategory: r.Category,
    name: r.ItemName,
    variant: r.Variant,
    price: parseFloat(r.Price) || 0,
    unit: 'piece',
    is_active: true,
    is_archived: false,
    stock_quantity: 100,
    low_stock_threshold: 10
  }))

  // 3. Batch insert
  console.log('Inserting new items...')
  const insRes = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(newItems)
  })

  if (!insRes.ok) {
    console.error('Error inserting items:', await insRes.text())
    return
  }
  console.log('Successfully inserted new items.')
}

updateMenu()
