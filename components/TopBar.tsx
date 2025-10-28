'use client'

import { RefreshButton } from './RefreshButton'
import { ThemeToggle } from './theme-toggle'

export function TopBar() {
  return (
    <div className="flex w-full items-center justify-between px-4 py-1">
      <h1 className="text-xl font-bold text-primary">PEC.UP</h1>
      <div className="flex items-center gap-2">
        <RefreshButton />
        <ThemeToggle />
      </div>
    </div>
  )
}