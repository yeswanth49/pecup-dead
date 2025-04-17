'use client'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // If already signed in, send them to the home (or dashboard)
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/')
    }
  }, [status, router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-black">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold">Welcome to PEC.UP</h1>
        <p className="text-muted-foreground">Sign in to access your dashboard</p>
        <Button
          onClick={() => signIn('google')}
          className="text-white bg-blue-600 hover:bg-blue-700"
        >
          Sign in with Google
        </Button>
      </div>
    </div>
  )
}