-- Numbers used up by test runs are given back: the numbering continues from the highest
-- QT number actually saved, or starts at QT-000001 when there are none.
select setval(
  'public.quotation_number_seq',
  coalesce(
    (
      select max(substring(upper(trim(q.quote_number)) from 4)::bigint)
      from public.quotations q
      where upper(trim(q.quote_number)) ~ '^QT-[0-9]{1,15}$'
    ),
    1
  ),
  exists (
    select 1 from public.quotations q
    where upper(trim(q.quote_number)) ~ '^QT-[0-9]{1,15}$'
  )
);
