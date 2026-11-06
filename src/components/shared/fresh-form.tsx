"use client"

import { Fragment, useLayoutEffect, useState } from "react"

// Next.js hides a page when you leave it instead of closing it (see "Preserving UI state" in
// its docs), so a form would come back holding what was last typed, and saving it again
// would repeat that record. The cleanup runs when the page is hidden, and the new key starts
// the form again from its default values on the next visit.
export function FreshForm({ children }: { children: React.ReactNode }) {
  const [visit, setVisit] = useState(0)

  useLayoutEffect(() => () => setVisit((value) => value + 1), [])

  return <Fragment key={visit}>{children}</Fragment>
}
