'use client'

import { RefreshButton } from './RefreshButton'
import { ThemeToggle } from './theme-toggle'
import { Button } from '@/components/ui/button'
import { LogOut, RotateCcw } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export function TopBar() {
  const { data: session } = useSession()
  const router = useRouter()

  const handleResetProfile = () => {
    router.push('/profile')
  }

  return (
    <div className="flex w-full items-center justify-between px-4 md:px-16 pt-6 pb-0 mb-0">
      <div className="text-2xl md:text-3xl font-bold text-primary">PEC.UP</div>
      <div className="flex gap-2">
        <RefreshButton />
        {session && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetProfile}
            >
              <RotateCcw className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Reset Year & Branch</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </>
        )}
        <ThemeToggle />
      </div>
    </div>
  )
}