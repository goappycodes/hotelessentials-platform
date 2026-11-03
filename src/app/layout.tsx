import type { Metadata } from "next"

import { NavigationProgressProvider } from "@/components/layout/navigation-progress"
import { APP_NAME } from "@/components/shared/brand"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { fontVariables } from "@/lib/fonts"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: "Business management for hotel supply companies.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full">
        <NavigationProgressProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </NavigationProgressProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
