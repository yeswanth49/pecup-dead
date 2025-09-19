'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/components/theme-provider'
import { ProfileProvider } from '@/lib/enhanced-profile-context'
import CacheDebugger from '@/components/CacheDebugger'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ProfileProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="white"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <CacheDebugger />
        </ThemeProvider>
      </ProfileProvider>
    </SessionProvider>
  )
}
