import type { Metadata } from "next"

import { ModulePlaceholder } from "@/components/shared/module-placeholder"
import { MODULE_NAV_ITEMS } from "@/constants/navigation"

const navItem = MODULE_NAV_ITEMS.items

export const metadata: Metadata = { title: navItem.title }

export default function ItemsPage() {
  return <ModulePlaceholder module={navItem} />
}
