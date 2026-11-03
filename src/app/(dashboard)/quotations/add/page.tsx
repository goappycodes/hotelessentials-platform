import type { Metadata } from "next"

import { ModulePlaceholder } from "@/components/shared/module-placeholder"
import { MODULE_NAV_ITEMS } from "@/constants/navigation"

const navItem = MODULE_NAV_ITEMS.quotations

export const metadata: Metadata = { title: navItem.create.title }

export default function NewQuotationPage() {
  return <ModulePlaceholder module={navItem} mode="create" />
}
