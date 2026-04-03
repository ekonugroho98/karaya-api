-- Jalankan di Supabase SQL Editor

create table if not exists gold_prices (
  id          bigint generated always as identity primary key,
  brand       text        not null,           -- 'antam', 'pegadaian', dst
  tanggal     text,                           -- string dari website, e.g. "Harga Emas Hari Ini Kamis, 3 April 2026"
  data        jsonb       not null,           -- raw scraped result
  scraped_at  timestamptz not null default now()
);

-- Index untuk query per brand terbaru
create index if not exists gold_prices_brand_scraped
  on gold_prices (brand, scraped_at desc);

-- RLS: baca publik (React app bisa fetch tanpa auth)
alter table gold_prices enable row level security;

create policy "public read"
  on gold_prices for select
  using (true);

-- Hanya service role key yang bisa insert (dari API serverless)
create policy "service insert"
  on gold_prices for insert
  to service_role
  with check (true);
