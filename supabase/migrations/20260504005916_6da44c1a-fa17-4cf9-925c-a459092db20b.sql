
-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users can view own roles" on public.user_roles
  for select using (auth.uid() = user_id);
create policy "Admins can view all roles" on public.user_roles
  for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can manage roles" on public.user_roles
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- First registered user becomes admin
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select count(*) from public.user_roles where role = 'admin') = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- site_settings (single row)
create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  site_name text not null default 'Mi Tienda',
  logo_url text,
  phone text,
  email text,
  whatsapp text,
  instagram_url text,
  facebook_url text,
  address text,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
create policy "Anyone can view site settings" on public.site_settings for select using (true);
create policy "Admins manage site settings" on public.site_settings for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();
insert into public.site_settings (site_name) values ('Mi Tienda');

-- banners
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  subtitle text default '',
  cta_text text default '',
  cta_href text default '/',
  image_url text,
  bg_color text default '#0ea5e9',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.banners enable row level security;
create policy "Anyone can view active banners" on public.banners for select using (active = true or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage banners" on public.banners for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger banners_updated_at before update on public.banners for each row execute function public.set_updated_at();

-- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text default '',
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy "Anyone can view categories" on public.categories for select using (true);
create policy "Admins manage categories" on public.categories for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();

-- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text default '',
  price numeric(12,2) not null default 0,
  category_id uuid references public.categories(id) on delete set null,
  stock int not null default 0,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create policy "Anyone can view active products" on public.products for select using (active = true or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage products" on public.products for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create index products_category_idx on public.products(category_id);

-- product images
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.product_images enable row level security;
create policy "Anyone can view product images" on public.product_images for select using (true);
create policy "Admins manage product images" on public.product_images for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create index product_images_product_idx on public.product_images(product_id);

-- Storage buckets
insert into storage.buckets (id, name, public) values
  ('branding','branding',true),
  ('banners','banners',true),
  ('categories','categories',true),
  ('products','products',true);

-- Storage policies (public read; admin write per bucket)
create policy "Public read branding" on storage.objects for select using (bucket_id = 'branding');
create policy "Admins write branding" on storage.objects for all
  using (bucket_id = 'branding' and public.has_role(auth.uid(),'admin'))
  with check (bucket_id = 'branding' and public.has_role(auth.uid(),'admin'));

create policy "Public read banners" on storage.objects for select using (bucket_id = 'banners');
create policy "Admins write banners" on storage.objects for all
  using (bucket_id = 'banners' and public.has_role(auth.uid(),'admin'))
  with check (bucket_id = 'banners' and public.has_role(auth.uid(),'admin'));

create policy "Public read categories" on storage.objects for select using (bucket_id = 'categories');
create policy "Admins write categories" on storage.objects for all
  using (bucket_id = 'categories' and public.has_role(auth.uid(),'admin'))
  with check (bucket_id = 'categories' and public.has_role(auth.uid(),'admin'));

create policy "Public read products" on storage.objects for select using (bucket_id = 'products');
create policy "Admins write products" on storage.objects for all
  using (bucket_id = 'products' and public.has_role(auth.uid(),'admin'))
  with check (bucket_id = 'products' and public.has_role(auth.uid(),'admin'));
