-- Vuei schema consistency patch for hotel vouchers
-- Review manually before running in Supabase SQL Editor.
-- Adds the persisted document linkage already used by runtime code.

alter table public.trip_hotels
  add column if not exists document_id uuid references public.documents(id) on delete set null;

create index if not exists trip_hotels_document_id_idx
  on public.trip_hotels (document_id);
