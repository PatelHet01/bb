import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const items = [
  // Paan - Tobacco
  { name: 'Rajnigandha', variant: 'Regular', price: 10, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Rajnigandha Saffron', variant: 'Regular', price: 10, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Rajnigandha', variant: 'Regular', price: 20, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Tansen', variant: 'Regular', price: 5, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Vimal', variant: 'Regular', price: 5, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Silver', variant: 'Regular', price: 5, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Baba', variant: 'Regular', price: 5, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Baba', variant: 'Small', price: 2, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Baba Navratna', variant: 'Regular', price: 5, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Dosh', variant: 'Regular', price: 2, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Dosh Supari', variant: 'Regular', price: 2, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Bhagat', variant: 'Regular', price: 1, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'M Tobacco', variant: 'Regular', price: 10, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'RMD', variant: 'Regular', price: 10, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Double Zero Silver', variant: 'Regular', price: 6, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Double Zero', variant: 'Regular', price: 10, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Miraj', variant: 'Regular', price: 10, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Signature', variant: 'Regular', price: 10, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Signature', variant: 'Small', price: 5, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Director', variant: 'Small', price: 5, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },
  { name: 'Director', variant: 'Regular', price: 10, category: 'Paan', subcategory: 'Tobacco', branch_id: 'gurukul' },

  // Paan - Mouth Freshener
  { name: 'Variyali', variant: 'Regular', price: 1, category: 'Paan', subcategory: 'Mouth Freshener', branch_id: 'gurukul' },
  { name: 'Masala', variant: 'Regular', price: 20, category: 'Paan', subcategory: 'Mouth Freshener', branch_id: 'gurukul' },
  { name: 'Small Masala', variant: 'Regular', price: 10, category: 'Paan', subcategory: 'Mouth Freshener', branch_id: 'gurukul' },
  { name: 'Pass Pass', variant: 'Regular', price: 1, category: 'Paan', subcategory: 'Mouth Freshener', branch_id: 'gurukul' },

  // Inventory Disposables
  ...[
    'Simple Small Dish', 'Simple Big Dish', '7-in Silver Dish', '8-in Silver Dish', '9-in Silver Dish',
    'Tea Cups', 'Coffee Cups', 'Cold Coffee Glass', 'Jamun Shots Glass', 'Tissue Paper', 'Maggi Bowl',
    'Normal Spoon', 'Kata Spoon', 'White Dish', 'Plastic Small Bag', 'Plastic Big Bag', 'Silver Coil Paper',
    'Hand Gloves', '6-in White Box', 'Straw', 'Silver Box (250ml)'
  ].map(n => ({ name: n, category: 'Inventory', subcategory: 'Disposables', branch_id: 'gurukul', is_active: false }))
];

const branches = ['gurukul', 'bhat', 'visat'];
const allItems = [];
for (const b of branches) {
  for (const item of items) {
    allItems.push({ ...item, branch_id: b, is_active: item.price > 0 ? true : false, stock_quantity: 0 });
  }
}

async function seed() {
  // First we need to make sure the schema has `subcategory` and `variant` columns
  // We can do this via raw SQL or just try to insert and see if it fails
  console.log("Seeding started...");
  try {
    const { error } = await supabase.from('items').insert(allItems);
    if (error) {
      console.error("Error inserting items:", error);
    } else {
      console.log("Seeded successfully");
    }
  } catch (err) {
    console.error(err);
  }
}
seed();
