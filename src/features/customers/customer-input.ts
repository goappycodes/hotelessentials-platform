// Converting between form values (all strings) and customers rows.
import { DEFAULT_COUNTRY } from "@/constants/customers"
import { toMoneyInput } from "@/lib/format"
import type {
  CustomerAddressInput,
  CustomerContactInput,
  CustomerInput,
} from "@/lib/validations/customer"
import type { Tables } from "@/types/database"

const EMPTY_ADDRESS: CustomerAddressInput = {
  attention: "",
  country: DEFAULT_COUNTRY,
  street1: "",
  street2: "",
  city: "",
  state: "",
  pinCode: "",
  phone: "",
  fax: "",
}

export const EMPTY_CONTACT: CustomerContactInput = {
  salutation: "",
  firstName: "",
  lastName: "",
  email: "",
  workPhone: "",
  mobile: "",
}

export function newCustomerInput(ownerId: string): CustomerInput {
  return {
    customerType: "Business",
    salutation: "",
    firstName: "",
    lastName: "",
    companyName: "",
    displayName: "",
    email: "",
    workPhone: "",
    mobile: "",
    language: "English",
    gstTreatment: "",
    gstin: "",
    placeOfSupply: "",
    pan: "",
    taxPreference: "Taxable",
    exemptionReason: "",
    openingBalance: "",
    paymentTerms: "Due on Receipt",
    priceListId: "",
    ownerId,
    billing: EMPTY_ADDRESS,
    shipping: EMPTY_ADDRESS,
    contacts: [],
    remarks: "",
    isActive: true,
  }
}

type AddressPrefix = "billing" | "shipping"

function toAddressInput(customer: Tables<"customers">, prefix: AddressPrefix): CustomerAddressInput {
  return {
    attention: customer[`${prefix}_attention`] ?? "",
    country: customer[`${prefix}_country`] ?? "",
    street1: customer[`${prefix}_street1`] ?? "",
    street2: customer[`${prefix}_street2`] ?? "",
    city: customer[`${prefix}_city`] ?? "",
    state: customer[`${prefix}_state`] ?? "",
    pinCode: customer[`${prefix}_pin_code`] ?? "",
    phone: customer[`${prefix}_phone`] ?? "",
    fax: customer[`${prefix}_fax`] ?? "",
  }
}

export function toCustomerInput(
  customer: Tables<"customers">,
  contacts: Tables<"customer_contacts">[]
): CustomerInput {
  return {
    customerType: customer.customer_type,
    salutation: customer.salutation ?? "",
    firstName: customer.first_name ?? "",
    lastName: customer.last_name ?? "",
    companyName: customer.company_name ?? "",
    displayName: customer.display_name,
    email: customer.email ?? "",
    workPhone: customer.work_phone ?? "",
    mobile: customer.mobile ?? "",
    language: customer.language as CustomerInput["language"],
    gstTreatment: customer.gst_treatment ?? "",
    gstin: customer.gstin ?? "",
    placeOfSupply: customer.place_of_supply ?? "",
    pan: customer.pan ?? "",
    taxPreference: customer.tax_preference,
    exemptionReason: customer.exemption_reason ?? "",
    openingBalance: customer.opening_balance ? toMoneyInput(customer.opening_balance) : "",
    paymentTerms: customer.payment_terms as CustomerInput["paymentTerms"],
    priceListId: customer.price_list_id ?? "",
    ownerId: customer.owner_id ?? "",
    billing: toAddressInput(customer, "billing"),
    shipping: toAddressInput(customer, "shipping"),
    contacts: contacts.map((contact) => ({
      salutation: contact.salutation ?? "",
      firstName: contact.first_name ?? "",
      lastName: contact.last_name ?? "",
      email: contact.email ?? "",
      workPhone: contact.work_phone ?? "",
      mobile: contact.mobile ?? "",
    })),
    remarks: customer.remarks ?? "",
    isActive: customer.is_active,
  }
}

const orNull = (value: string) => value || null

function toAddressColumns(address: CustomerAddressInput, prefix: AddressPrefix) {
  return {
    [`${prefix}_attention`]: orNull(address.attention),
    [`${prefix}_country`]: orNull(address.country),
    [`${prefix}_street1`]: orNull(address.street1),
    [`${prefix}_street2`]: orNull(address.street2),
    [`${prefix}_city`]: orNull(address.city),
    [`${prefix}_state`]: orNull(address.state),
    [`${prefix}_pin_code`]: orNull(address.pinCode),
    [`${prefix}_phone`]: orNull(address.phone),
    [`${prefix}_fax`]: orNull(address.fax),
  }
}

// The customer as the JSON public.save_customer takes. Validated input only.
export function toCustomerRow(customer: CustomerInput) {
  const isExempt = customer.taxPreference === "Tax Exempt"
  return {
    customer_type: customer.customerType,
    salutation: orNull(customer.salutation),
    first_name: orNull(customer.firstName),
    last_name: orNull(customer.lastName),
    company_name: orNull(customer.companyName),
    display_name: customer.displayName,
    email: orNull(customer.email),
    work_phone: orNull(customer.workPhone),
    mobile: orNull(customer.mobile),
    language: customer.language,
    gst_treatment: orNull(customer.gstTreatment),
    gstin: orNull(customer.gstin),
    place_of_supply: customer.gstTreatment === "Overseas" ? null : orNull(customer.placeOfSupply),
    pan: orNull(customer.pan),
    tax_preference: customer.taxPreference,
    exemption_reason: isExempt ? orNull(customer.exemptionReason) : null,
    opening_balance: Number(customer.openingBalance || 0),
    payment_terms: customer.paymentTerms,
    price_list_id: orNull(customer.priceListId),
    owner_id: orNull(customer.ownerId),
    ...toAddressColumns(customer.billing, "billing"),
    ...toAddressColumns(customer.shipping, "shipping"),
    remarks: orNull(customer.remarks),
    is_active: customer.isActive,
  }
}

export function toContactRows(contacts: CustomerContactInput[]) {
  return contacts.map((contact) => ({
    salutation: orNull(contact.salutation),
    first_name: orNull(contact.firstName),
    last_name: orNull(contact.lastName),
    email: orNull(contact.email),
    work_phone: orNull(contact.workPhone),
    mobile: orNull(contact.mobile),
  }))
}
