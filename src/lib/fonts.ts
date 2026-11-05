import { Arimo, Geist, Geist_Mono } from "next/font/google"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// The printed quotation's font.
const arimo = Arimo({
  variable: "--font-document",
  subsets: ["latin"],
})

export const fontVariables = `${geistSans.variable} ${geistMono.variable} ${arimo.variable}`
