-- Enable realtime for tables
begin;
  -- Remove if already exists (safe approach for supabase_realtime publication)
  -- Actually, standard way in Supabase:
  alter publication supabase_realtime add table items;
  alter publication supabase_realtime add table customers;
  alter publication supabase_realtime add table orders;
commit;
