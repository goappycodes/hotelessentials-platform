-- The business's own details, printed at the top and bottom of quotations.
alter table public.organization_settings
  add column company_name text check (char_length(company_name) <= 150),
  add column address text check (char_length(address) <= 500),
  add column phone text check (char_length(phone) <= 50),
  add column email text check (char_length(email) <= 150),
  add column gstin text check (char_length(gstin) <= 15),
  -- Free text, one line each: account name, bank, account number, IFSC, branch.
  add column bank_details text check (char_length(bank_details) <= 1000);
