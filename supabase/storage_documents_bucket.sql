-- Vuei documents storage hardening
-- Review manually before running in Supabase SQL Editor.
-- Expected upload path format from the frontend after this phase:
--   <auth.uid()>/<trip_id>/documents/<filename>
--   <auth.uid()>/<trip_id>/tickets/<filename>

insert into storage.buckets (id, name, public)
values ('vuei-documents', 'vuei-documents', false)
on conflict (id) do nothing;

drop policy if exists "documents bucket select own files" on storage.objects;
drop policy if exists "documents bucket upload own files" on storage.objects;
drop policy if exists "documents bucket update own files" on storage.objects;
drop policy if exists "documents bucket delete own files" on storage.objects;

create policy "documents bucket select own files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'vuei-documents'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "documents bucket upload own files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vuei-documents'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "documents bucket update own files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vuei-documents'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'vuei-documents'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "documents bucket delete own files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vuei-documents'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[1] = auth.uid()::text
);
