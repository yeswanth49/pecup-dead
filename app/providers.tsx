'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/components/theme-provider'
import { ProfileProvider } from '@/lib/enhanced-profile-context'
import { Toaster } from '@/components/ui/toaster'
import CacheDebugger from '@/components/CacheDebugger'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ProfileProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <CacheDebugger />
          <Toaster />
        </ThemeProvider>
      </ProfileProvider>
    </SessionProvider>
  )
}
