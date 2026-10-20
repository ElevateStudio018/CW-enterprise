-- Images: a public bucket (the site shows them to everyone) that only admins can write to. Only web image types, at
-- most 10 MB each; the admin converts uploads to WebP in several sizes before they get here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 10485760, array['image/webp', 'image/png', 'image/jpeg', 'image/x-icon', 'image/svg+xml'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Files attached to AI requests: private, read and written by admins only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ai-attachments', 'ai-attachments', false, 10485760, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins upload site images" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-images' and (select public.is_admin()));
create policy "Admins replace site images" on storage.objects for update to authenticated
  using (bucket_id = 'site-images' and (select public.is_admin()));
create policy "Admins remove site images" on storage.objects for delete to authenticated
  using (bucket_id = 'site-images' and (select public.is_admin()));

create policy "Admins read AI attachments" on storage.objects for select to authenticated
  using (bucket_id = 'ai-attachments' and (select public.is_admin()));
create policy "Admins upload AI attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'ai-attachments' and (select public.is_admin()));
