-- Bucket privado para avatares do Vuei.
-- Execute manualmente no SQL Editor do Supabase.

insert into storage.buckets (id, name, public)
values ('vuei-avatars', 'vuei-avatars', true)
on conflict (id) do nothing;

create policy "avatars_select_public"
on storage.objects
for select
to public
using (bucket_id = 'vuei-avatars');

create policy "avatars_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vuei-avatars'
  and auth.uid()::text = split_part(name, '/', 1)
);

create policy "avatars_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vuei-avatars'
  and auth.uid()::text = split_part(name, '/', 1)
)
with check (
  bucket_id = 'vuei-avatars'
  and auth.uid()::text = split_part(name, '/', 1)
);

create policy "avatars_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vuei-avatars'
  and auth.uid()::text = split_part(name, '/', 1)
);
