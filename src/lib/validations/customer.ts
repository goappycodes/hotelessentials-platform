import { z } from "zod"

import {
  CUSTOMER_LANGUAGES,
  CUSTOMER_TYPES,
  GST_TREATMENTS,
  GST_TREATMENTS_WITHOUT_GSTIN,
  PAYMENT_TERMS,
} from "@/constants/customers"
import { MONEY_PATTERN, MONEY_PATTERN_MESSAGE } from "@/lib/format"

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/

const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`)

const email = text(254, "Email")
  .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email")

// Digits, spaces, +, -, ( and ); at least 6 digits.
const phone = (label: string) =>
  text(30, label).refine(
    (value) => value === "" || (/^[0-9+\-() ]+$/.test(value) && value.replace(/\D/g, "").length >= 6),
    `Enter a valid ${label.toLowerCase()}`
  )

const optionalId = z.union([z.uuid(), z.literal("")])

const addressSchema = z.object({
  attention: text(100, "Attention"),
  country: text(60, "Country"),
  street1: text(200, "Street"),
  street2: text(200, "Street"),
  city: text(100, "City"),
  state: text(100, "State"),
  pinCode: text(20, "Pin code").refine(
    (value) => value === "" || /^[0-9A-Za-z -]{3,20}$/.test(value),
    "Enter a valid pin code"
  ),
  phone: phone("Phone"),
  fax: phone("Fax"),
})

export const customerContactSchema = z
  .object({
    salutation: text(20, "Salutation"),
    firstName: text(100, "First name"),
    lastName: text(100, "Last name"),
    email,
    workPhone: phone("Work phone"),
    mobile: phone("Mobile"),
  })

export const customerSchema = z
  .object({
    customerType: z.enum(CUSTOMER_TYPES),
    salutation: text(20, "Salutation"),
    firstName: text(100, "First name"),
    lastName: text(100, "Last name"),
    companyName: text(200, "Company name"),
    displayName: text(200, "Display name").min(1, "Enter a display name"),
    email,
    workPhone: phone("Work phone"),
    mobile: phone("Mobile"),
    language: z.enum(CUSTOMER_LANGUAGES),

    gstTreatment: z.union([z.enum(GST_TREATMENTS), z.literal("")]),
    gstin: z.string().trim().toUpperCase(),
    placeOfSupply: z.string().trim().regex(/^([0-9]{2})?$/, "Pick a state"),
    pan: z.string().trim().toUpperCase(),
    taxPreference: z.enum(["Taxable", "Tax Exempt"]),
    exemptionReason: text(200, "Exemption reason"),
    openingBalance: z
      .string()
      .trim()
      .refine((value) => value === "" || MONEY_PATTERN.test(value), MONEY_PATTERN_MESSAGE),
    paymentTerms: z.enum(PAYMENT_TERMS),
    priceListId: optionalId,
    ownerId: optionalId,

    billing: addressSchema,
    shipping: addressSchema,
    contacts: z.array(customerContactSchema).max(50, "At most 50 contact persons"),
    remarks: text(1000, "Remarks"),
    isActive: z.boolean(),
  })
  .superRefine((customer, context) => {
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message })

    // GST treatment and place of supply are optional (imported customers often have
    // neither); a GSTIN is required only for treatments that need one.
    const needsGstin =
      customer.gstTreatment !== "" && !GST_TREATMENTS_WITHOUT_GSTIN.includes(customer.gstTreatment)
    if (customer.gstin && !GSTIN_PATTERN.test(customer.gstin)) {
      issue(["gstin"], "Enter a 15-character GSTIN, e.g. 19AABCU9603R1ZM")
    } else if (needsGstin && !customer.gstin) {
      issue(["gstin"], "Enter the customer's GSTIN")
    }
    if (customer.pan && !PAN_PATTERN.test(customer.pan)) {
      issue(["pan"], "Enter a 10-character PAN, e.g. AABCU9603R")
    }
    if (customer.taxPreference === "Tax Exempt" && !customer.exemptionReason) {
      issue(["exemptionReason"], "Enter why the customer is exempt from tax")
    }
    customer.contacts.forEach((contact, index) => {
      if (!contact.firstName && !contact.lastName && !contact.email && !contact.workPhone && !contact.mobile) {
        issue(["contacts", index, "firstName"], "Enter a name, email or phone, or remove the row")
      }
    })
  })

export type CustomerInput = z.infer<typeof customerSchema>
export type CustomerAddressInput = z.infer<typeof addressSchema>
export type CustomerContactInput = z.infer<typeof customerContactSchema>
