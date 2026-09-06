create table if not exists reservations (  
  id serial primary key,
  date text not null,
  hour text not null,
  name text not null,
  phone text not null,
  token text not null,
  created_at timestamptz not null default now(),
  unique(date, hour)
);

/*schema.sql*/