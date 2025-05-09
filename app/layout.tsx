import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"
import { Providers } from "./providers" // ✅ Import Providers
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "PEC.UP",
  description: "Educational resources for students, by students!!",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>
        <Providers> {/* ✅ Wrap with Providers */}
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 p-6 md:p-8">{children}</main>
          </div>
        </Providers>
        <Analytics/>
        <SpeedInsights />
      </body>
    </html>
  )
}
