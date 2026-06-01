insert into storage.buckets (id, name, public)
values ('vuei-documents', 'vuei-documents', false)
on conflict (id) do nothing;

create policy "documents bucket select own files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'vuei-documents'
);

create policy "documents bucket upload own files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vuei-documents'
);

create policy "documents bucket update own files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vuei-documents'
)
with check (
  bucket_id = 'vuei-documents'
);

create policy "documents bucket delete own files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vuei-documents'
);
