# HotelEssentials — Business Workflow Audit

**Audit date:** 6 November 2026
**Branch:** `dev`, at commit `3b9eb30`, plus uncommitted Sales Orders work in the working tree
**Scope:** this application's code and its Supabase database only. Zoho was not used for this audit.

## How this audit was done

- **Code:** all routes, server actions, feature modules, migrations and configuration were read. Three independent code reviews covered access control, master data and stock, and quotations and orders. Their main findings were then rechecked against the code.
- **Database:** the live schema was read in a read-only transaction: 19 tables, 71 policies, 24 functions, 23 triggers and 27 migrations. Business data was checked as counts only. No secrets or customer details are in this report.
- **Status rule:** a requirement is **Completed** only when its code path was traced and there is real evidence that it works, either live data that reconciles or a database test. A page or button alone never counts.
- **Writes during the audit:** nothing was written to the database, and no test records were created. The only source change during the audit was a separate request from the owner: commenting out the quotation number on the sales order document.

**Limits of this audit**

- Nobody clicked through the signed-in screens in a browser for this audit, because that would need a sign-in. Screen behaviour comes from reading the code, not from watching it run.
- The Sales Order database tests were run earlier on 6 November, before this audit, inside transactions that were rolled back. They left no data behind.
- Hosted Supabase settings (sign-up, email templates, redirect list, row limits) can't be seen from the code or the schema.

---

## Section 1 — Executive Summary

| Measure | Result |
|---|---|
| **Total requirements audited (denominator)** | **120** |
| Completed | 10 |
| Partially Completed | 21 |
| Broken | 3 |
| Not Started | 85 |
| Not Verified | 1 |
| **Overall implementation percentage** | **8.3%** (10 Completed ÷ 120 requirements) |

The 120 are the 110 workflow bullets in sections A–N, plus 10 rows for the existing modules. Quotations, PDF and calculations are not counted twice, because they are already covered by section C.

Partial work earns no credit in the 8.3%. For context only, 31 of 120 (25.8%) are Completed or Partially Completed.

**Readiness assessment: not ready to run the business workflow end to end.**

- **What is usable now:** the master data and sales paperwork side works, including items, customers, taxes, HSN codes, quotations, and sales orders created from accepted quotations.
- **Where the workflow stops:** right after the Sales Order. No stock reservation, picking, purchasing, goods receipt, despatch, WhatsApp, leads or reports exist.
- **Stock:** the app has no real stock figure today. There are 0 inventory adjustments and no opening stock, so every item computes to zero.
- **Security:** row level security is solid. It's enabled on all 19 tables, no policy allows everything, and no anonymous grants exist. The most serious security items are one exposed full-access Zoho key and the unverified hosted sign-up setting.

**Most critical findings**

1. **Exposed Zoho key (P0):** a full-access Zoho Books and CRM key was pasted into a chat. Revoke it.
2. **Dashboard is wrong (P1):** it says "No quotations yet" while the database holds 810 quotations and 357 sales orders.
3. **Work not in Git (P1):** all Sales Orders code is uncommitted, but its database changes are live.
4. **Sign-up not confirmed off (P1):** it's off in the local config, but the hosted setting is unconfirmed. If it's on, anyone could create an active account.
5. **No stock model (P1):** there is no opening stock, movement ledger or reservation, and sales never touch stock.
6. **No change history (P1):** nothing records who changed a price, status or line on a quotation.
7. **No status rules (P1):** a quotation or order can move from any status to any other status.

---

## Section 2 — Requirement-by-Requirement Audit

### A. Lead Management

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| A1 | Leads | Create and manage leads | Not Started | No leads table, route or action | Build the module |
| A2 | Leads | Store lead contact information and business requirements | Not Started | No table | Needs lead fields |
| A3 | Leads | Track lead status and follow-up activities | Not Started | No table | Needs statuses and activities |
| A4 | Leads | Convert a lead into a customer | Not Started | `customers` has no link to a lead | Needs a convert action and link |
| A5 | Leads | Maintain lead history and communication records | Not Started | No table | Needs an activity log |

### B. Customer Requirements Collection

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| B1 | Requirements | Record products and requirements requested by customers | Not Started | No table. Only free-text `customers.remarks` | Needs a requirements table |
| B2 | Requirements | Maintain product quantities and specifications | Not Started | No table | Needs requirement lines |
| B3 | Requirements | Associate requirements with the correct customer or lead | Not Started | No table | Depends on A1 and B1 |
| B4 | Requirements | Sales team can access previous customer requirements | Not Started | No screen | Needs a history view on the customer |

### C. Quotation Management

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| C1 | Quotations | Create quotations for customers | Completed | `saveQuotation` in `src/actions/quotations.ts`, `public.save_quotation`, `quotations` (810 rows) | Works. No quotation without lines in live data |
| C2 | Quotations | Add multiple products and quantities | Completed | `quotation-items-table.tsx`, `quotation_items` (8,428 rows), quantity above 0 enforced | Up to 300 lines. Speed at 300 lines not measured |
| C3 | Quotations | Automatically populate product information | Completed | `chooseItem` in `quotation-items-table.tsx`, `searchQuoteItems`, `defaultTaxIdFor` | Exact name or SKU match can re-price a typed line when tabbing through it (P3) |
| C4 | Quotations | Calculate prices, discounts, taxes and totals correctly | Partially Completed | `computeQuotationTotals` in `src/lib/quotations.ts`. 810 of 810 quotes reconcile: subtotal matches lines, and line tax is within ₹0.02 of the header | Typed line discount is commented out and no transaction discount control exists, so discounts come only from price lists. Database stores totals sent to it without recalculating. SEZ default tax is wrong |
| C5 | Quotations | Generate and download quotation PDFs | Partially Completed | `/print/quotations/[id]`, `print-toolbar.tsx` using `window.print()` | Browser print only, with no generated PDF file, so nothing can be attached to an automatic message. Print fires after a fixed 400 ms. Real Save as PDF not tested |
| C6 | Quotations | Track quotation statuses | Partially Completed | `quotation_status` enum, `setQuotationStatus`, derived Expired badge | No transition rules. Accepted can go to Declined or Draft while its order stays live. Expired quotes can be accepted |
| C7 | Quotations | Edit, duplicate and manage quotations | Partially Completed | Edit page, `deleteQuotation`, list, search, filters | **Duplicate does not exist.** No lock on Accepted quotes. Last save wins with no warning when two people edit |
| C8 | Quotations | Track quotation history | Not Started | Only `created_by` and `updated_at`. No `updated_by`, audit table or revisions | Needs an audit log |
| C9 | Quotations | Send quotations through WhatsApp | Not Started | No WhatsApp code anywhere in `src` | Depends on K1 |
| C10 | Quotations | Track whether a quotation was sent and its delivery status | Partially Completed | "Mark as Sent" in `quotation-panel.tsx` | A manual label only. No `sent_at`, recipient or delivery tracking |

### D. Sales Order Management

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| D1 | Sales Orders | Convert an accepted quotation into a Sales Order | Completed | `private.sales_order_on_accept`, `private.create_sales_order`, deferred triggers on `quotations`. 29 of 29 rolled-back tests passed, covering accept, import and permissions. 357 orders equal 357 Accepted quotes, and 3,188 lines plus ₹21,468,791.62 reconciled when created | Accepting again after editing keeps the old order while the message suggests all is well (P2). Code is uncommitted (P1) |
| D2 | Sales Orders | Create Sales Orders independently when required | Not Started | No insert policy on `sales_orders`. `/sales-orders/add` removed | Requires an insert path, a form and an order-entry screen. Was left out by decision on 6 November and needs revisiting |
| D3 | Sales Orders | Generate unique Sales Order numbers | Completed | `sales_order_number_seq`, unique `so_number`, SO-00001 format, width grows past 99999 | Text sort misorders past 99,999 (P3, far off) |
| D4 | Sales Orders | Maintain customer, product, quantity, pricing, discount and tax information | Partially Completed | Header and lines are copied into `sales_orders` and `sales_order_items` | Orders can't be edited. Address, SKU and company print from live records, so old printouts change. Price list, expiry and attachments aren't copied |
| D5 | Sales Orders | Track Sales Order status | Partially Completed | `sales_order_status` (Draft, Confirmed, Closed), `setSalesOrderStatus`, filter, badges | Manual only, with no transition rules. Closed can return to Draft. Delete is allowed at any status. All 357 are Draft, so Zoho's real statuses are not reflected. No Cancelled state, which E6 will need |
| D6 | Sales Orders | Prevent accidental duplicate order creation | Completed | `unique (quotation_id)`, `exists` check. Rerun-accept test passed | Also means only one order per quote. The owner's Zoho screenshot shows two orders on one quote, so confirm whether that's needed |
| D7 | Sales Orders | Maintain a relationship between quotations and Sales Orders | Completed | FK `quotation_id`, stored `quote_number`, links on both panels | If a quote is deleted, the link clears and its number can be reused. 0 cases today |
| D8 | Sales Orders | Track order confirmation and payment terms | Partially Completed | Confirmed status and free-text `terms` | No confirmed by or confirmed at. `customers.payment_terms` isn't copied to the order |
| D9 | Sales Orders | Send Sales Order confirmations through WhatsApp | Not Started | No code | Depends on K1 |

### E. Inventory Management

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| E1 | Inventory | Maintain stock quantities for about 10,000–15,000 SKUs | Partially Completed | `private.stock_on_hand`, `item_list` view, `track_inventory` (333 of 11,842 items) | No stored stock. Opening stock was dropped in migration `20261104020000`. 0 adjustments, so all stock computes to 0 |
| E2 | Inventory | Track stock by product | Partially Completed | `stock_on_hand` per item | Not shown on any screen in the sidebar. `item-rows.tsx` hardcodes null |
| E3 | Inventory | Track available, reserved and physical stock separately | Not Started | Only one computed figure | Needs a stock model |
| E4 | Inventory | Reserve or block stock against a Sales Order | Not Started | No table. Sales code never touches stock | Needs reservations |
| E5 | Inventory | Prevent the same stock being allocated to multiple orders | Not Started | No allocation | Depends on E4 |
| E6 | Inventory | Release reservations when orders are cancelled or modified | Not Started | No reservations and no Cancelled status | Depends on E4 and D5 |
| E7 | Inventory | Support inventory adjustments | Partially Completed | `save_inventory_adjustment`, `/inventory/adjustments`, deferred stock checks | Hidden from the sidebar and never used (0 rows). Only reachable by URL. Value adjustments are blocked |
| E8 | Inventory | Maintain stock movement history | Partially Completed | Adjustment lines are the only record. `stock_movements` was dropped. Item history UI is commented out | No ledger. Editing or deleting an Adjusted record rewrites stock with no trace |
| E9 | Inventory | Track minimum stock and reorder levels | Not Started | `reorder_point` dropped | Needs fields and alerts |
| E10 | Inventory | Identify products with insufficient stock | Not Started | No comparison exists | Depends on E1 and E3 |
| E11 | Inventory | Accurate stock availability during order processing | Not Started | `searchQuoteItems` doesn't read stock. Lines show no availability | Depends on E1 and E3 |

### F. Warehouse / Picking Management

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| F1 | Warehouse | Operations manager can view confirmed Sales Orders | Partially Completed | Status filter on `/sales-orders` | Works as a filter, but there are 0 Confirmed orders and no operations view |
| F2 | Warehouse | Check product availability for each order | Not Started | No code | Depends on E3 |
| F3 | Warehouse | Generate picking lists | Not Started | No table or document | Build |
| F4 | Warehouse | Track picked and pending quantities | Not Started | No table | Build |
| F5 | Warehouse | Handle partial picking | Not Started | No code | Build |
| F6 | Warehouse | Handle unavailable products | Not Started | No code | Links to G and H |
| F7 | Warehouse | Track which employee picked the products | Not Started | No code | Build |
| F8 | Warehouse | Maintain picking history | Not Started | No table | Build |

### G. Purchase Management

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| G1 | Purchase | Identify unavailable or insufficient products | Not Started | No code | Depends on E10 |
| G2 | Purchase | Send purchase requirements to the purchase manager | Not Started | No table | Build |
| G3 | Purchase | Create Purchase Orders | Not Started | No table or route | Build |
| G4 | Purchase | Add suppliers and supplier information | Not Started | Only `items.preferred_vendor` text, hidden in the form | Needs a suppliers table |
| G5 | Purchase | Add products, quantities, purchase rates, taxes and totals | Not Started | `items.cost_price` exists, with no purchase document | Build |
| G6 | Purchase | Track Purchase Order statuses | Not Started | No table | Build |
| G7 | Purchase | Track ordered, received and pending quantities | Not Started | No table | Build |
| G8 | Purchase | Support partial goods receipt | Not Started | No table | Depends on I |
| G9 | Purchase | Maintain purchase history | Not Started | No table | Build |

### H. Alternative Product Management

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| H1 | Alternatives | Suggest alternatives when a product is unavailable | Not Started | No code | Build |
| H2 | Alternatives | Sales or operations can select an alternative | Not Started | No code. Orders can't be edited | Depends on order editing |
| H3 | Alternatives | Maintain the original-to-alternative relationship | Not Started | No table | Build |
| H4 | Alternatives | Update the Sales Order and inventory allocation | Not Started | No code | Depends on E4 |
| H5 | Alternatives | Ensure the customer can be informed about substitutions | Not Started | No code | Depends on K1 |

### I. Goods Receipt

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| I1 | Goods Receipt | Record received goods against a Purchase Order | Not Started | No table | Depends on G3 |
| I2 | Goods Receipt | Track received quantities | Not Started | No table | Build |
| I3 | Goods Receipt | Support partial deliveries | Not Started | No table | Build |
| I4 | Goods Receipt | Record damaged or rejected quantities | Not Started | No table | Build |
| I5 | Goods Receipt | Update stock only for accepted goods | Not Started | No code | Depends on E8 |
| I6 | Goods Receipt | Maintain goods receipt history | Not Started | No table | Build |
| I7 | Goods Receipt | Prevent duplicate stock updates for the same receipt | Not Started | No code | Needs a posted state and a unique ledger key |

### J. Dispatch Management

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| J1 | Despatch | Generate packing slips or dispatch documents | Not Started | `/despatch` and `/despatch/add` are `ModulePlaceholder` | Build |
| J2 | Despatch | Track packed and dispatched quantities | Not Started | No table | Build |
| J3 | Despatch | Support partial dispatch | Not Started | No table | Build |
| J4 | Despatch | Record transporter and tracking details | Not Started | No table | Build |
| J5 | Despatch | Track dispatch status | Not Started | No table | Build |
| J6 | Despatch | Associate dispatch records with Sales Orders | Not Started | No table | Build |
| J7 | Despatch | Maintain dispatch history | Not Started | No table | Build |

### K. WhatsApp Integration

A search of `src` and the config for WhatsApp, `wa.me`, Twilio, webhook and cron found nothing related. There are no Edge Functions, no scheduled jobs (`pg_cron` not installed) and no WhatsApp environment variables.

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| K1 | WhatsApp | Integrate with the WhatsApp Business Platform or an approved provider | Not Started | No code or configuration | Needs a provider account |
| K2 | WhatsApp | Send quotation notifications | Not Started | No code | Also needs a generated PDF (C5) |
| K3 | WhatsApp | Send Sales Order confirmations | Not Started | No code | Depends on K1 |
| K4 | WhatsApp | Send order status updates | Not Started | No code | Depends on K1 |
| K5 | WhatsApp | Send product availability or delay notifications | Not Started | No code | Depends on E and K1 |
| K6 | WhatsApp | Send dispatch notifications and tracking details | Not Started | No code | Depends on J and K1 |
| K7 | WhatsApp | Send delivery updates | Not Started | No code | Depends on J and K1 |
| K8 | WhatsApp | Manual WhatsApp communication, if implemented | Not Started | No link or button exists | Optional |
| K9 | WhatsApp | Receive inbound messages, if implemented | Not Started | No webhook route | Optional |
| K10 | WhatsApp | Maintain message history against customers and orders | Not Started | No table | Build |
| K11 | WhatsApp | Track sent, delivered, read and failed statuses | Not Started | No table | Needs K13 |
| K12 | WhatsApp | Handle failed messages and retries | Not Started | No background job | Needs a job runner |
| K13 | WhatsApp | Verify webhook events | Not Started | No webhook route | Build |
| K14 | WhatsApp | Respect customer opt-in and messaging policies | Not Started | No opt-in field on `customers` | Build |
| K15 | WhatsApp | Use approved templates where required | Not Started | No templates | Build |

### L. Product Videos and Brand Management

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| L1 | Media | Manage product brands | Not Started | No brand table or field | Build |
| L2 | Media | Associate products with brands | Not Started | No column on `items` | Build |
| L3 | Media | Upload or manage product images and videos | Partially Completed | `item_images`, `item-images` bucket, `item-images-field.tsx` | Images work, with 20 linked so far. No video support. Bucket allows images only |
| L4 | Media | Organize videos brand-wise | Not Started | No code | Depends on L1 |
| L5 | Media | Employees can find and share product videos | Not Started | No code | Build |
| L6 | Media | Maintain product media relationships | Partially Completed | `item_images` FK to `items` | Images only |

### M. Purchase Invoice Verification

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| M1 | Purchase Invoice | Record supplier purchase invoices | Not Started | No table | Depends on G |
| M2 | Purchase Invoice | Match invoices against Purchase Orders | Not Started | No code | Depends on G3 |
| M3 | Purchase Invoice | Compare invoiced, ordered and received quantities | Not Started | No code | Depends on I |
| M4 | Purchase Invoice | Compare rates against previous purchase rates | Not Started | No purchase history | Depends on G9 |
| M5 | Purchase Invoice | Identify quantity and price discrepancies | Not Started | No code | Build |
| M6 | Purchase Invoice | Flag duplicate invoices | Not Started | No table | Needs a unique rule per supplier and invoice number |
| M7 | Purchase Invoice | Support verification status and history | Not Started | No table | Build |

### N. Analytics and Dashboard

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| N1 | Dashboard | Display real business data, not hardcoded values | Broken | `dashboard-overview.tsx` has no queries or props. Only the greeting is real | Shows fixed empty text |
| N2 | Dashboard | Show quotations, orders, pending orders, purchases, stock and dispatch | Broken | Same file: "No quotations yet", "No sales orders yet" | Wrong against 810 quotes and 357 orders. Purchases, stock and dispatch are absent |
| N3 | Reports | Provide sales and purchase reports | Not Started | `/reports` is `ModulePlaceholder` | Build |
| N4 | Dashboard | Show low-stock and reorder alerts | Not Started | No code. Bell is fixed "You're all caught up" | Depends on E9 |
| N5 | Dashboard | Display order fulfilment information | Not Started | No code | Depends on F and J |
| N6 | Dashboard | Useful filters and date ranges | Not Started | No code | Build |
| N7 | Dashboard | Dashboard calculations match database records | Broken | No calculations exist, and the fixed text contradicts the database | Fixed by N1 |

### Existing Modules

Quotations, PDF generation and calculations are audited in section C and not repeated here.

| ID | Module | Requirement | Status | Evidence (File/Function/Table) | Missing Work / Issue |
|---|---|---|---|---|---|
| EX-1 | Authentication | Login | Completed | `src/actions/auth.ts`, `src/lib/supabase/proxy.ts`, `requireUser` | Works with a fixed redirect. Inactive users are removed |
| EX-2 | Authentication | Forgot password and reset password | Not Verified | `requestPasswordReset`, `updatePassword`, `auth/confirm/route.ts` | Code is present. Needs Supabase dashboard access to confirm the email template and redirect list. The link may only work in the same browser |
| EX-3 | Tax Settings | GST, CGST, SGST, IGST | Partially Completed | `tax_rates` (10 rows), `saveTaxRate`, `defaultTaxIdFor` | Settings work. Customer Tax Exempt is ignored, and same-state SEZ gets CGST+SGST. Neither affects live data today |
| EX-4 | Tax Settings | TDS and TCS | Partially Completed | `direct_tax_rates` (15 TDS, 0 TCS), `/settings/direct-taxes` | Deliberately hidden. 0 quotes use it. If used, the PDF total wouldn't add up because there's no TDS row |
| EX-5 | Price Lists | Price lists end to end | Partially Completed | `save_price_list`, `priceItemsFromList`. 2 All Items lists | Individual Items can reach only the first 1,000 of 11,842 items and has never been used. Purchase lists are unused. No delete |
| EX-6 | Customers | Customer management | Completed | `save_customer`, `customer-form.tsx`, 748 rows, delete blocked by quotes and orders | Works. Data quality is weak: see Section 3 |
| EX-7 | Items | Items management | Partially Completed | `saveItem`, `removeItem`, bulk actions, lock rule, 11,842 rows | CRUD works. Deleting an item used on quotes or orders succeeds and unlinks those lines. Stock is hidden |
| EX-8 | HSN | HSN code lookup | Completed | `hsn_codes` (478 rows), `HsnCodeField`, `createHsnCode` | Search and inline add work. No screen to edit or delete a code (P3) |
| EX-9 | Inventory Adjustments | Adjustments end to end | Partially Completed | `save_inventory_adjustment`, `check_stock_levels`, `guard_adjustment_status` | Well guarded on paper, never used on live data, and hidden from the sidebar. No opening stock |
| EX-10 | Import/Export | CSV and Excel import and export | Partially Completed | `csv-import.tsx`, `csv.ts`, `spreadsheet.ts`, 3 export routes | Items, Customers and Quotations only. No formula protection in CSV. Re-import can create duplicates |

---

## Section 3 — Existing Module Verification

### Authentication

- **Implemented:** login, forgot password, reset password, confirm route, sign-out for inactive users, route protection.
- **Works:** login uses a fixed redirect, and forgot password doesn't reveal whether an account exists. Inactive users lose data access through RLS immediately. No sign-up call exists in the code.
- **Partial:** Users screens are deliberately off, so roles and permissions can't be changed in the app. No change-password or profile screen exists.
- **Broken:** nothing confirmed.
- **Must fix:** confirm the hosted sign-up setting. Tighten `getSafeNextPath`, because `/\evil.com` passes the check after a valid token (P3). Move the recovery email to a `token_hash` template if the link fails across devices.

### Tax Settings

- **Implemented:** 10 GST and IGST rates with scope rules, plus 15 TDS rates and no TCS rates.
- **Works:** the business state is set to 19. No quote applies an intra-state tax to an other-state supply.
- **Partial:** TDS and TCS are hidden on request. CGST and SGST split only in the live form total; the document prints one GST row.
- **Broken:** nothing in live data.
- **Must fix:** read `tax_preference` when applying tax, and treat SEZ as inter-state. Today there are 0 Tax Exempt and 0 SEZ customers, so this is a latent risk.

### Price Lists

- **Implemented:** All Items and Individual Items types, with rounding options.
- **Works:** All Items pricing on quotations. A price list change doesn't alter saved quotes.
- **Partial:** Individual Items has never run on real data, because `price_list_items` has 0 rows. Purchase lists are stored but unused.
- **Broken:** `getPriceListItemOptions` is limited to 1,000 items by name, so only about 8% of items can get a custom rate.
- **Must fix:** replace the limit with server search. Fix the float rounding in `src/lib/price-lists.ts`, where 100 + 15% rounded to .99 gives 114.99 instead of 115.99. An inactive price list still prices quotes.

### Customer Management

- **Implemented:** full form, GST rules, phone with country code, bulk actions, delete protection.
- **Works:** create, edit, and delete blocked by linked quotes and orders.
- **Partial:** contact persons work in the form but are not in import or export, so `customer_contacts` has 0 rows.
- **Broken:** nothing confirmed.
- **Must fix (data):** 622 of 748 customers have no phone or email, only 10 have a mobile, and 304 have no GST treatment. WhatsApp can't work until this is fixed. Three display names are repeated.

### Items Management

- **Implemented:** create, edit, clone, images, bulk actions, lock rule.
- **Works:** list and search are fast at 11,842 rows, and each item keeps a unique Zoho ID.
- **Partial:** 371 items have no HSN code, 209 have no selling price, and 1 has no tax. Only 20 have images.
- **Broken:** deleting a used item succeeds and detaches its lines on quotes and orders (P2).
- **Must fix:** block delete for used items, or snapshot SKU onto lines. Align the storage delete rule (P3): 1 orphan image file exists today (27 KB).

### HSN Code Lookup

- **Implemented and works:** search by code or description, and inline add.
- **Partial:** no screen to edit or delete a code. The list loads with no paging, which is fine at 478 rows.
- **Must fix:** invalid HSN codes in an import silently become blank (P3).

### Quotations

- **Implemented:** covered in section C. There's also a split view, Zoho-format import and export, attachments and price list pricing.
- **Works:** 810 of 810 quotes reconcile, with no duplicate numbers.
- **Partial:** see C4 to C7 and C10.
- **Broken:** a typed 7-digit QT number makes later numbers collide (P2), because quote numbers have fixed width, unlike SO numbers.
- **Must fix:** status rules, audit log, Duplicate, totals recalculated in the database.

### Inventory Adjustments

- **Implemented:** quantity adjustments, Draft and Adjusted states, negative stock refused, delete reverses stock.
- **Works by reading:** commit-time checks with row locks. Not run on live data.
- **Partial:** hidden from the sidebar and unusable as real stock, because there is no opening stock.
- **Must fix:** see phase 4 of the roadmap.

### CSV/Excel Import and Export

| Module | Import | Export |
|---|---|---|
| Items | CSV and Excel, 250 per batch | CSV and Excel |
| Customers | CSV and Excel, 250 per batch | CSV and Excel |
| Quotations | CSV and Excel, 25 per batch | CSV and Excel |
| Price Lists | None | None |
| Inventory Adjustments | None | None |
| Sales Orders | None | None |

- **Works:** exports page through all rows with a stable sort, so the Supabase 1,000-row default doesn't cut them. Rows are validated in the browser and on the server, and a problem report can be downloaded. Quotation totals are recalculated on import.
- **Broken or risky:**
  - `toCsvField` doesn't neutralise a leading `=`, `+`, `-` or `@` (P2).
  - An item with no ID and no SKU is created again on each import, despite the dialog saying re-import is safe (P2). Customers have the same issue.
  - `overwrite` mode is dead code, so a file can't update prices.
- **Not Verified:** an export would truncate if the hosted Max Rows setting is below the page size. Large Excel files could hit a host time limit, and a large quotation batch could exceed the Server Action body limit. None of these were tested.

### PDF Generation and Calculations

- **Works:** the document layout was matched to the business's own PDF. Totals on the document come from stored values.
- **Partial:** output is browser print rather than a generated file. The document omits HSN, place of supply and expiry date.
- **Must fix:** generate a real PDF on the server before WhatsApp work (C5, K2). On a phone the fixed-width print page is squeezed or clipped.

---

## Section 4 — Business Workflow Verification

| Step | State today | Connection to the next step |
|---|---|---|
| **Lead** | Not built | **Missing.** Customers are added or imported by hand |
| **Customer Requirements** | Not built | **Missing.** Requirements are typed straight into a quotation |
| **Quotation** | Working | **Manual.** Sending happens outside the app, then staff click Mark as Sent |
| **Sales Order** | Working from Accepted quotes | **Automatic and tested.** Accepting creates one order |
| **Inventory Check** | Not built | **Missing.** Orders never read stock, and stock is 0 |
| **Stock Reservation / Purchase** | Not built | **Missing.** No reservation, supplier or Purchase Order |
| **Picking** | Not built | **Missing** |
| **Dispatch** | Placeholder page | **Missing.** Not linked to orders |
| **Customer Notification** | Not built | **Missing.** No messaging of any kind |

The chain has one working automatic link: Accepted quotation to Sales Order. Every step after that is outside the app. A Confirmed order currently triggers nothing.

---

## Section 5 — Database Audit

### Existing tables (live row counts)

| Table | Rows | Table | Rows |
|---|---:|---|---:|
| `customers` | 748 | `price_lists` | 2 |
| `customer_contacts` | 0 | `price_list_items` | 0 |
| `direct_tax_rates` | 15 | `profiles` | 1 |
| `hsn_codes` | 478 | `quotations` | 810 |
| `inventory_adjustments` | 0 | `quotation_items` | 8,428 |
| `inventory_adjustment_items` | 0 | `quotation_attachments` | 0 |
| `item_images` | 20 | `sales_orders` | 357 |
| `items` | 11,842 | `sales_order_items` | 3,188 |
| `organization_settings` | 1 | `tax_rates` | 10 |
| `user_permissions` | 0 | | |

There are 3 private storage buckets, each with size and type limits. Database size is 32 MB.

### Missing tables

These are the minimum needed. Existing tables can't carry them.

- **Leads:** `leads`, `lead_activities`
- **Requirements:** `customer_requirements`, `customer_requirement_items`
- **Stock:** `stock_movements`, `stock_reservations`
- **Warehouse:** `pick_lists`, `pick_list_items`
- **Purchasing:** `suppliers`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items`, `purchase_invoices`, `purchase_invoice_items`
- **Alternatives:** `item_alternatives`
- **Despatch:** `despatches`, `despatch_items`
- **Messaging:** `whatsapp_messages`, `whatsapp_templates`
- **Media:** `brands`, plus a video or media type on `item_images` or a new `item_media`
- **History:** `audit_log`

Don't add separate stock balance columns before `stock_movements` exists. Balances should come from that ledger.

### Important relationships

- `quotations` → `customers` (restrict), `quotation_items` → `quotations` (cascade).
- `sales_orders.quotation_id` → `quotations` (unique, set null on delete), `sales_orders.customer_id` → `customers` (restrict).
- `sales_order_items` → `sales_orders` (cascade), and → `items` (set null).
- `user_permissions` → `profiles` (cascade).

### Missing or weak foreign keys

- `quotation_items.item_id` and `sales_order_items.item_id` use `on delete set null`, which allows the item-delete problem in EX-7.
- `items.preferred_vendor` is free text, and needs an FK once `suppliers` exists.

### Missing indexes

These 13 foreign keys have no index: `customers.created_by`, `customers.owner_id`, `inventory_adjustments.created_by`, `quotation_attachments.created_by`, `quotation_items.price_list_id`, `quotation_items.tax_id`, `quotations.created_by`, `quotations.direct_tax_id`, `quotations.price_list_id`, `quotations.salesperson_id`, `sales_order_items.item_id`, `sales_order_items.tax_id`, `sales_orders.salesperson_id`.

- **Add early:** `sales_order_items.item_id`, because stock and availability queries will read it heavily.
- **Add later:** trigram indexes on `sales_orders.customer_name` and `so_number`, once volumes grow.

### Missing constraints

- `sales_orders` and `sales_order_items` have no check constraints, such as quantity above 0.
- No rule stops an item's intra-state and inter-state taxes having different rates.
- No status transition rules exist on quotations or sales orders.

### RLS

**Clean:** 19 of 19 tables have RLS. All 71 policies are for authenticated users, and no policy is `using (true)`. Anon has no table grants. All 24 functions set a safe `search_path`.

**Problems:**

- **Direct writes (P2):** a user with edit rights can use the database API directly to change `total` on `quotations`, or any column on `sales_orders`, including `so_number` and `customer_id`. This bypasses the server action.
- **Over-broad reads (P3):**
  - An active user with no permissions can read `organization_settings` (bank details, PAN), `profiles` (email, phone), and company assets.
  - `sales_orders.view` reads full customer rows, and quotation viewers can read `items.cost_price`.
- **Storage rule (P3):** a user with delete but not edit on items leaves orphan files, and the error is ignored in `removeItem`.
- **Hardening (P3):** `authenticated` holds TRUNCATE on tables. It isn't reachable through the API.
- **Unexercised (risk):** with 1 owner and 0 `user_permissions` rows, non-admin permissions have never run in production. The Sales Order rolled-back test did exercise them for that module.

### Transaction safety

- **Safe:** `save_quotation`, `save_customer` and `save_inventory_adjustment` are single transactions. Order creation runs at commit, and duplicates are blocked by a unique key.
- **Unsafe for concurrent use:** `save_quotation` deletes and reinserts lines with no version check, so the last writer silently wins (P2).
- **Possible deadlock (P3):** two adjustments with lines in opposite order could deadlock. No bad data results, just a generic error.
- **Missing:** stock reservation safety can't be assessed, because it doesn't exist.

### Duplicate or inconsistent data risks

- SKU isn't unique (1 repeated SKU), and item names aren't unique (5 repeated names).
- Import can create duplicates (Section 3).
- `QT-5` and `QT-000005` can coexist, because uniqueness is on text. Live data has 673 `QT-n` numbers and 137 older `S` numbers, with no duplicates.
- Quote numbers can be reused after a quote is deleted, which could create a second order on re-import.
- 612 quote lines have no tax, and 27 have no item link. 809 of 810 quotes have no salesperson, because imports don't set one.

---

## Section 6 — Critical Bugs and Risks

### P0 — Critical

| # | Issue | Where | Action |
|---|---|---|---|
| P0-1 | A full-access Zoho key (Books and CRM) was pasted into a chat, and is stored locally. It could change business data | `.env.zoho.local`, which Git ignores | Revoke it in Zoho. If the image job goes ahead, issue a new read-only key |

No P0 data-loss or financial error was found in the application code. All 810 quotes reconcile.

### P1 — Major blockers

| # | Issue | Where | Impact |
|---|---|---|---|
| P1-1 | Dashboard shows fixed empty text | `src/features/dashboard/components/dashboard-overview.tsx`, `DashboardOverview` | Staff are told no data exists |
| P1-2 | Sales Orders work is uncommitted while its migrations are live | Working tree on `dev`, `20261106090000`, `20261106100000` | A deploy from Git shows a placeholder, and the work could be lost |
| P1-3 | Hosted sign-up isn't verified off | Supabase Auth settings. Only `supabase/config.toml` is proven | If on, anyone could create an active account and read the items listed under over-broad reads |
| P1-4 | No stock model | `private.stock_on_hand`, migration `20261104020000` | Inventory, picking and purchasing can't start |
| P1-5 | No audit trail for prices, statuses or lines | `quotations`, `sales_orders` | No accountability for financial changes |
| P1-6 | No status rules on quotations or orders | `setQuotationStatus`, `setSalesOrderStatus` | Accepted can be reversed with its order still live. Closed can return to Draft. Orders can be deleted at any status |
| P1-7 | Independent Sales Orders can't be created | No insert policy, no route | Requirement D2 is blocked |
| P1-8 | Individual Items price lists reach 1,000 of 11,842 items | `getPriceListItemOptions` in `src/features/price-lists/queries.ts` | About 92% of items can't get a custom rate |
| P1-9 | Discounts can't be typed on a quote | `quotation-items-table.tsx`, commented-out input. Done on request | Requirement C4 needs a decision: price list only, or typed too |

### P2 — Important missing functionality

| # | Issue | Where |
|---|---|---|
| P2-1 | Database trusts client totals, and edit users can change totals directly | `public.save_quotation`, RLS on `quotations` and `sales_orders` |
| P2-2 | Deleting a used item detaches quote and order lines | `removeItem` in `src/actions/items.ts` |
| P2-3 | Re-accepting an edited quote keeps the old order, with a misleading message | `private.create_sales_order`, `STATUS_ACTIONS` |
| P2-4 | CSV formula injection | `toCsvField` in `src/lib/csv.ts` |
| P2-5 | Import can create duplicates, contradicting the dialog | `src/actions/item-import.ts`, `src/actions/customer-import.ts`, `csv-import.tsx` |
| P2-6 | No real PDF file | `print-toolbar.tsx` |
| P2-7 | Editing the same quote at once: last writer wins | `public.save_quotation` |
| P2-8 | A typed 7-digit quote number breaks numbering | `private.set_quote_number` and `public.next_quote_number` |
| P2-9 | Unstable paging on non-unique sort columns, so rows can repeat or vanish between pages | `applyListQuery` in `src/lib/list-query.ts` |
| P2-10 | Tax Exempt ignored, and same-state SEZ gets CGST+SGST (latent, 0 live cases) | `defaultTaxIdFor` in `src/lib/quotations.ts` |
| P2-11 | Despatch and Reports look live in the sidebar but are placeholders | `src/constants/navigation.ts` |
| P2-12 | Password reset link may work only in the requesting browser (unconfirmed) | `auth/confirm/route.ts`, hosted email template |
| P2-13 | No automated tests and no CI | Repository |
| P2-14 | Customer contact data can't support messaging | `customers`: 622 of 748 have no phone or email |
| P2-15 | All 357 orders are Draft, whatever their real state | `sales_orders` |
| P2-16 | Adjusted stock can be edited or deleted with no trace | `save_inventory_adjustment` |

### P3 — Improvements

- `getSafeNextPath` accepts `/\evil.com` after a valid token (`auth/confirm/route.ts`).
- A signed-in user with no profile hits a redirect loop (`session.ts`, `proxy.ts`).
- The proxy matcher's `\.` becomes "any character" (`src/proxy.ts`).
- No security headers in `next.config.ts`.
- Over-broad reads and TRUNCATE grants (Section 5).
- One orphan image file, and the storage delete rule for delete-only users.
- Hand-picked tax is overwritten when place of supply changes (`retaxLines`), contrary to its comment.
- Float rounding in `src/lib/price-lists.ts`, and a ₹0 item priced at ₹0.99.
- Dead `sales_orders.create` permission. Dashboard "New" on orders opens the list.
- Skeleton gaps: no `loading.tsx` beside the workspace pages, and two fallbacks without `aria-busy`.
- Quote side list has no paging or pinned row, unlike Items and Sales Orders.
- Print pages squeeze on phones.
- `getDocumentDetails` could send about 300 IDs in one URL with no chunking (`src/features/quotations/queries.ts`).
- PDF rounding: 100 ÷ 3 prints 33.33, which multiplied back gives 99.99.

---

## Section 7 — Performance and Scalability

**Measured on live data** (database time only, with the app's security policies not applied):

| Query | Time |
|---|---:|
| Items page, sorted by name | 4.2 ms |
| Items search, name or SKU | 12.9 ms |
| Items count | 1.9 ms |
| Quotations page | 0.1 ms |
| Quotations search | 0.4 ms |
| Sales orders page | 2.6 ms |
| Sales orders search | 0.8 ms |
| Customers search | 0.2 ms |

| Area | Assessment |
|---|---|
| **10,000–15,000 SKUs** | Ready for list and search. Trigram indexes exist, pages are limited, and the item picker loads 10 at a time. Weak spots are the 1,000-item limits in the price list and adjustment pickers |
| **Large customer lists** | Ready. Search is on the server with paging |
| **Quotation and order history** | Ready at this size. Fix the sort tie-breaker and add the missing indexes before tens of thousands of rows |
| **Inventory movements** | Not ready. `stock_on_hand` sums rows per item through a function, so it can't serve a list. A movement ledger needs a maintained balance |
| **Concurrent employees** | Reads are fine, and numbering is safe. Quote editing has no conflict check, and stock allocation doesn't exist. Not load-tested |

**Other gaps**

- **Network time:** an earlier measurement found about 235 ms per Supabase round trip, which matters more than database time. Keep the number of round trips per page low.
- **Caching:** `requireUser` is cached, and the panels have a 30-second cache. List pages have no shared cache.
- **Heavy exports:** a 12,000-row Excel file is built in memory. Test this on the production host.
- **Heavy form:** the quotation form re-renders all rows on each keystroke. At 300 lines this may lag. Not measured.

---

## Section 8 — Recommended Implementation Roadmap

Do these in order. Phase 4 unlocks phases 5, 6, 7 and 11.

### Phase 1 — Critical bug fixes

- **Tasks:** revoke the Zoho key. Commit the Sales Orders work. Check hosted sign-up, Site URL, redirect list and recovery template. Make the dashboard real. Add status rules for quotations and orders. Fix CSV formula injection, the sort tie-breaker, the QT number width and the storage delete rule.
- **Dependencies:** access to Zoho and the Supabase dashboard.
- **Database:** status guard triggers, `lpad` fix, storage policy update.
- **Frontend:** dashboard cards. Status menus limited to allowed moves.
- **Backend:** dashboard queries, `toCsvField`, `applyListQuery`.
- **Testing:** dashboard figures against SQL counts, blocked transitions, CSV opened in Excel, paging across tied dates.

### Phase 2 — Existing module completion

- **Tasks:** server-side item search for price lists and adjustments. Recalculate totals in the database. Add `audit_log`. Add Duplicate Quotation. Add a real server PDF. Add optimistic locking on quotes. Protect used items from delete. Fix import duplicates. Decide on typed discounts. Handle Tax Exempt and SEZ. Add tests and CI.
- **Dependencies:** Phase 1.
- **Database:** `audit_log` with triggers, `version` column on quotations, totals in `save_quotation`, column-level write limits.
- **Frontend:** Duplicate button, history tab, conflict message, item search picker.
- **Backend:** PDF generation, import matching rules.
- **Testing:** unit tests for tax and totals, PDF comparison against the current layout, two-user edit conflict.

### Phase 3 — Sales Order management

- **Tasks:** independent order creation. Order editing with rules by status. Payment terms. Confirmed by and at. Address snapshot. Decide on a Cancelled status, and on one or several orders per quote. Set real statuses for the 357 orders.
- **Dependencies:** Phases 1 and 2.
- **Database:** insert policy or `save_sales_order` RPC, new columns, snapshot columns, line check constraints.
- **Frontend:** order form reusing the quotation form parts, and a New button.
- **Backend:** order actions and validation.
- **Testing:** permissions by role, totals, edit limits by status.

### Phase 4 — Inventory and stock reservation

- **Tasks:** build the stock ledger. Add opening stock. Show available, reserved and physical stock. Reserve and release against orders. Add reorder levels and shortage detection. Bring Inventory back to the sidebar.
- **Dependencies:** Phase 3. Business decision on which items track stock (333 of 11,842 today).
- **Database:** `stock_movements`, `stock_reservations`, reorder fields, a maintained balance, row locks in a reservation RPC.
- **Frontend:** stock on item list and panel, availability on quotes and orders, low-stock view.
- **Backend:** reserve, release and post functions.
- **Testing:** two users reserving the last unit at once, cancel and modify release, ledger equals balance, 15,000-SKU speed test.

### Phase 5 — Warehouse and picking

- **Tasks:** operations view of Confirmed orders, pick lists, partial picking, unavailable handling, picker name, history.
- **Dependencies:** Phase 4.
- **Database:** `pick_lists`, `pick_list_items`.
- **Frontend:** operations queue and a pick screen that works on phones.
- **Backend:** pick posting that consumes reservations.
- **Testing:** partial picks, unavailable lines, picked not above reserved.

### Phase 6 — Purchase Management and Goods Receipt

- **Tasks:** suppliers, purchase requirements from shortages, Purchase Orders, goods receipt with partial, damaged and rejected quantities, and alternative products (section H).
- **Dependencies:** Phase 4.
- **Database:** `suppliers`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items`, `item_alternatives`. A unique ledger key per receipt line.
- **Frontend:** supplier, PO and receipt screens. Alternative picker on order lines.
- **Backend:** receipt posting that adds only accepted quantity to stock.
- **Testing:** double-post protection, partial receipts, PO quantities, stock after rejection, substitution moving the reservation.

### Phase 7 — Dispatch Management

- **Tasks:** replace the placeholder. Add packing slips, partial dispatch, transporter and tracking details, and status.
- **Dependencies:** Phases 4 and 5.
- **Database:** `despatches`, `despatch_items`.
- **Frontend:** despatch list, form and slip printing.
- **Backend:** posting that moves stock out and updates order status.
- **Testing:** partial dispatch, dispatched not above picked, order closes when complete.

### Phase 8 — Lead and Customer Requirements Management

- **Tasks:** leads, follow-ups, history, convert to customer, requirements, requirement to quotation.
- **Dependencies:** none technical, so this can run alongside Phase 4 if the team has capacity.
- **Database:** `leads`, `lead_activities`, `customer_requirements`, `customer_requirement_items`, lead link on `customers`.
- **Frontend:** lead list, split view, requirement forms, history on the customer.
- **Backend:** convert action with no duplicate customers.
- **Testing:** conversion, access by role, reassignment.

### Phase 9 — WhatsApp Integration

- **Tasks:** provider setup, templates, send for quotes, orders and despatch, webhook, delivery status, retries, opt-in, history.
- **Dependencies:** server PDF (Phase 2), despatch (Phase 7), Business Platform account, cleaned customer numbers.
- **Database:** `whatsapp_messages`, `whatsapp_templates`, opt-in fields on `customers`.
- **Frontend:** Send buttons, message history, failure view.
- **Backend:** send service, signed webhook route, retry job, secrets in server-only variables.
- **Testing:** webhook signature rejection, each status, retry limits, no send without opt-in.

### Phase 10 — Brand and Product Media Management

- **Tasks:** brands on items, video upload or links, brand-wise library, share links, finish bringing in item images.
- **Dependencies:** Phase 1, for the storage rule.
- **Database:** `brands`, `items.brand_id`, media type on item images or `item_media`, and a bucket that allows video.
- **Frontend:** brand filter, media library.
- **Backend:** upload actions, signed share links.
- **Testing:** file limits, permissions, share link expiry.

### Phase 11 — Purchase Invoice Verification

- **Tasks:** record invoices, three-way match, rate comparison, discrepancy flags, duplicates, verification status.
- **Dependencies:** Phase 6.
- **Database:** `purchase_invoices`, `purchase_invoice_items`, and a unique key on supplier and invoice number.
- **Frontend:** invoice entry and a discrepancy view.
- **Backend:** match logic and tolerance settings.
- **Testing:** quantity and price mismatch, duplicate rejected, status history.

### Phase 12 — Analytics and Reporting

- **Tasks:** replace the Reports placeholder. Add sales, purchase, stock and fulfilment reports, with date filters and low-stock alerts.
- **Dependencies:** earlier phases supply the data. Sales reports can start after Phase 1.
- **Database:** report views and date indexes.
- **Frontend:** report pages, filters, exports.
- **Backend:** aggregate queries respecting permissions.
- **Testing:** every figure checked against SQL totals.

---

## Section 9 — Final Recommendation

**1. What percentage of the required business workflow is implemented?**
**8.3%**: 10 of 120 requirements are Completed. A further 21 are partly done and earn no credit in that figure.

**2. What can the team use right now?**
Login, items, customers, HSN lookup, tax settings, All Items price lists, quotations with print and Save as PDF, and CSV or Excel import and export for items, customers and quotations. Sales orders are also usable, once that code is committed and deployed, for recording orders from accepted quotations.

**3. What is currently broken?**
The dashboard: it shows fixed empty text that contradicts the database. Individual Items price lists also can't reach most items, which is counted as Partially Completed under EX-5.

**4. What are the most important missing modules?**
In order: the stock ledger and reservations, then Purchasing and Goods Receipt, Picking, Despatch, WhatsApp, Leads and Requirements, Reports, and Purchase Invoice Verification.

**5. What should be fixed first?**
1. Revoke the Zoho key.
2. Commit the Sales Orders work.
3. Confirm hosted sign-up is off.
4. Make the dashboard real.
5. Add status rules.

**6. What is the correct next development phase?**
Finish Phases 1 to 3, then build Phase 4, Inventory and stock reservation. Nothing in picking, purchasing or despatch can be correct without it.

**7. What features should not be rebuilt because they already exist?**
Authentication, the permissions and RLS foundation, Items, Customers, HSN lookup, tax settings, Quotations and the quotation document layout, the Accepted-to-Sales-Order automation and SO numbering, list and search infrastructure, and CSV and Excel import and export. Improve these where the report says so, but don't replace them.
