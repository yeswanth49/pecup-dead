'use client'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { LogIn, Shield, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Loader from '@/components/Loader'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isSigningIn, setIsSigningIn] = useState(false)

  // If already signed in, send them to the home (or dashboard)
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/')
    }
  }, [status, router])

  const handleSignIn = () => {
    setIsSigningIn(true)
    signIn("google")
  }

  if (status === 'loading' || isSigningIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Loader />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-secondary rounded-lg">
              <Shield className="h-6 w-6 text-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-semibold text-foreground">Welcome to PEC.UP</h1>
          <p className="text-muted-foreground text-sm">Access your educational resources and dashboard</p>
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-primary" />
              Sign In
            </CardTitle>
            <CardDescription>Use your Google account to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Continue with Google'
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}