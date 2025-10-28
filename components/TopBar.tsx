'use client'

import { RefreshButton } from './RefreshButton'
import { ThemeToggle } from './theme-toggle'

export function TopBar() {
  return (
    <div className="flex w-full items-center justify-between px-4 md:px-6 lg:px-8 py-1">
      <div className="text-2xl md:text-3xl font-bold text-primary">PEC.UP</div>
      <div className="flex gap-2">
        <RefreshButton />
        <ThemeToggle />
      </div>
    </div>
  )
}