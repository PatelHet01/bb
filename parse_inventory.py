import os
import re
import json

dir_path = "/Users/hackair/BB/materials/Bombay bethak "
items = []

for file in os.listdir(dir_path):
    if file.endswith('.html'):
        category_name = file.replace('.html', '').strip()
        path = os.path.join(dir_path, file)
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            rows = re.findall(r'<tr[^>]*>(.*?)</tr>', content, re.IGNORECASE | re.DOTALL)
            for row in rows:
                cols = re.findall(r'<td[^>]*>(.*?)</td>', row, re.IGNORECASE | re.DOTALL)
                cols = [re.sub(r'<[^>]+>', '', col).strip() for col in cols]
                cols = [col.replace('&nbsp;', ' ').strip() for col in cols]
                
                # We expect at least 5 columns based on the sample:
                # Category, Subcategory, Name, Size, Price
                # If there are fewer, let's just grab the last one as price, and others as name.
                if len(cols) >= 3:
                    price_text = cols[-1]
                    match = re.search(r'\d+(\.\d+)?', price_text)
                    if match:
                        price = float(match.group())
                        # If 5 cols exactly like Paan.html:
                        if len(cols) == 5:
                            cat = cols[0]
                            subcat = cols[1]
                            name = cols[2]
                            size = cols[3]
                            if size.lower() != 'regular' and size:
                                name = f"{name} {size}"
                            category_final = category_name # or use `cat`
                        else:
                            name = " ".join(cols[1:-1])
                            category_final = category_name
                            
                        if name.lower() not in ['item name', 'name', 'item', '']:
                            items.append({
                                'name': name.replace("'", "''"), 
                                'category': category_final, 
                                'price': price
                            })

# Remove duplicates if any
unique_items = []
seen = set()
for item in items:
    key = (item['name'], item['category'])
    if key not in seen:
        seen.add(key)
        unique_items.append(item)

# Generate SQL
sql = "-- Bulk Seed from HTML\nINSERT INTO items (name, category, unit, price, branch_id) VALUES\n"
values = []
for item in unique_items:
    values.append(f"('{item['name']}', '{item['category']}', 'piece', {item['price']}, 'gurukul')")
    values.append(f"('{item['name']}', '{item['category']}', 'piece', {item['price']}, 'bhat')")
    values.append(f"('{item['name']}', '{item['category']}', 'piece', {item['price']}, 'visat')")

sql += ",\n".join(values) + ";"

with open('/Users/hackair/BB/seed_master_inventory.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

print(f"Generated {len(unique_items)} unique items across 3 branches ({len(values)} total rows). Check seed_master_inventory.sql")
