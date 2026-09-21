
-- Drop public select policies (public URLs still work on public buckets)
drop policy if exists "Public read branding" on storage.objects;
drop policy if exists "Public read banners" on storage.objects;
drop policy if exists "Public read categories" on storage.objects;
drop policy if exists "Public read products" on storage.objects;

-- Allow only admins to list (public URLs unaffected)
create policy "Admins list branding" on storage.objects for select using (bucket_id = 'branding' and public.has_role(auth.uid(),'admin'));
create policy "Admins list banners" on storage.objects for select using (bucket_id = 'banners' and public.has_role(auth.uid(),'admin'));
create policy "Admins list categories" on storage.objects for select using (bucket_id = 'categories' and public.has_role(auth.uid(),'admin'));
create policy "Admins list products" on storage.objects for select using (bucket_id = 'products' and public.has_role(auth.uid(),'admin'));

-- Fix search_path for set_updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

-- Revoke execute on internal definer functions from anon/authenticated
revoke execute on function public.handle_new_user_role() from anon, authenticated, public;
revoke execute on function public.set_updated_at() from anon, authenticated, public;
-- has_role must remain callable by authenticated role for RLS-evaluation in queries
revoke execute on function public.has_role(uuid, public.app_role) from anon, public;
