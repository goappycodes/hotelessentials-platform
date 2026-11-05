-- Printed in the quotation header: the PAN, and a second address block beside the first.
alter table public.organization_settings
  add column pan text check (char_length(pan) <= 10),
  add column address_2 text check (char_length(address_2) <= 500);
