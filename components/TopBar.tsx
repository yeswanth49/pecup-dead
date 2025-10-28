'use client'

import { RefreshButton } from './RefreshButton'
import { ThemeToggle } from './theme-toggle'

export function TopBar() {
  return (
    <div className="flex w-full items-center justify-end gap-2 px-4 py-2">
      <RefreshButton />
      <ThemeToggle />
    </div>
  )
}