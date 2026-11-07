import type { Metadata, Viewport } from "next";

import { NavigationProgressProvider } from "@/components/layout/navigation-progress";
import { APP_NAME } from "@/components/shared/brand";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  applicationName: "Hotel Essentials",
  appleWebApp: { title: "Hotel Essentials" },
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: "Business management for hotel supply companies.",
};

export const viewport: Viewport = { themeColor: "#3B4D56" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full">
        <NavigationProgressProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </NavigationProgressProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
