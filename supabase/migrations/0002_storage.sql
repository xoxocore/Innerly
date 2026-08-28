-- Storage buckets, run after 0001.
--
-- Two buckets with opposite rules: vision images are private to the person who
-- uploaded them, post covers are public because the whole world reads posts.

insert into storage.buckets (id, name, public)
values ('visions', 'visions', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do nothing;

-- Vision images live under `<user-id>/<file>`, so the first path segment is
-- the owner and the policy is a comparison against it.
create policy "read own vision images" on storage.objects
  for select using (
    bucket_id = 'visions' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "upload own vision images" on storage.objects
  for insert with check (
    bucket_id = 'visions' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "replace own vision images" on storage.objects
  for update using (
    bucket_id = 'visions' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "delete own vision images" on storage.objects
  for delete using (
    bucket_id = 'visions' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Post covers: anyone may read, only admins may write.
create policy "post covers are public" on storage.objects
  for select using (bucket_id = 'posts');

create policy "admins manage post covers" on storage.objects
  for all using (bucket_id = 'posts' and public.is_admin())
  with check (bucket_id = 'posts' and public.is_admin());
