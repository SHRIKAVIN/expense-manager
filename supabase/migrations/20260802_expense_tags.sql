-- Optional tags on expenses for search/filter (#trip, #rent, …).

alter table public.expenses
  add column if not exists tags text[] not null default '{}';

create index if not exists idx_expenses_tags on public.expenses using gin (tags);

notify pgrst, 'reload schema';
