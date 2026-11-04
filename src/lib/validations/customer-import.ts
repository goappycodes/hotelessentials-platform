import { z } from "zod"

import {
  CUSTOMER_LANGUAGES,
  CUSTOMER_TYPES,
  GST_TREATMENTS,
  GST_TREATMENTS_WITHOUT_GSTIN,
  PAYMENT_TERMS,
} from "@/constants/customers"
import { GSTIN_PATTERN, PAN_PATTERN } from "@/lib/validations/customer"

const text = (max: number) => z.string().max(max, `must be at most ${max} characters`).nullable()

const phone = text(30).refine(
  (value) => value === null || (/^[0-9+\-() ]+$/.test(value) && value.replace(/\D/g, "").length >= 6),
  "isn't a phone number"
)

// One customer read from an import file, as customers columns (see customer-csv.ts).
// Checked in the browser when the file is read and again in the import Server Action.
export const customerImportRowSchema = z
  .object({
    // The row number in the file (the header is row 1), for the import report.
    row: z.number().int().positive(),
    // The customer's ID in the source file: a Zoho Contact ID, or our own ID from an export.
    externalId: text(100),
    // Price list name, matched to a sales price list on the server.
    priceListName: text(100),
    customer_type: z.enum(CUSTOMER_TYPES),
    salutation: text(20),
    first_name: text(100),
    last_name: text(100),
    company_name: text(200),
    display_name: z.string().trim().min(1, "is required").max(200, "must be at most 200 characters"),
    email: text(254).refine(
      (value) => value === null || z.email().safeParse(value).success,
      "isn't an email address"
    ),
    work_phone: phone,
    mobile: phone,
    language: z.enum(CUSTOMER_LANGUAGES),
    gst_treatment: z.enum(GST_TREATMENTS).nullable(),
    gstin: z.string().regex(GSTIN_PATTERN, "isn't a valid GSTIN").nullable(),
    place_of_supply: z.string().regex(/^[0-9]{2}$/, "isn't a state code").nullable(),
    pan: z.string().regex(PAN_PATTERN, "isn't a valid PAN").nullable(),
    tax_preference: z.enum(["Taxable", "Tax Exempt"]),
    exemption_reason: text(200),
    opening_balance: z.number().min(0, "can't be negative").max(99_999_999_999.9999),
    payment_terms: z.enum(PAYMENT_TERMS),
    billing_attention: text(100),
    billing_country: text(60),
    billing_street1: text(200),
    billing_street2: text(200),
    billing_city: text(100),
    billing_state: text(100),
    billing_pin_code: text(20),
    billing_phone: phone,
    billing_fax: phone,
    shipping_attention: text(100),
    shipping_country: text(60),
    shipping_street1: text(200),
    shipping_street2: text(200),
    shipping_city: text(100),
    shipping_state: text(100),
    shipping_pin_code: text(20),
    shipping_phone: phone,
    shipping_fax: phone,
    remarks: text(1000),
    is_active: z.boolean(),
  })
  .superRefine((customer, context) => {
    if (
      customer.gst_treatment &&
      !GST_TREATMENTS_WITHOUT_GSTIN.includes(customer.gst_treatment) &&
      !customer.gstin
    ) {
      context.addIssue({ code: "custom", path: ["gstin"], message: "is required for this GST treatment" })
    }
    if (customer.tax_preference === "Tax Exempt" && !customer.exemption_reason) {
      context.addIssue({ code: "custom", path: ["exemption_reason"], message: "is required when tax exempt" })
    }
  })

export type CustomerImportRow = z.infer<typeof customerImportRowSchema>
