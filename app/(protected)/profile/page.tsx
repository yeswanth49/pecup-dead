'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

type BranchType = 'CSE' | 'AIML' | 'DS' | 'AI' | 'ECE' | 'EEE' | 'MEC' | 'CE'
const BRANCHES: BranchType[] = ['CSE', 'AIML', 'DS', 'AI', 'ECE', 'EEE', 'MEC', 'CE']

interface ProfileResponse {
  profile: {
    id: string
    email: string
    name: string
    year: number
    branch: BranchType
    roll_number: string
  } | null
}

export default function ProfilePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [year, setYear] = useState<number | undefined>(undefined)
  const [branch, setBranch] = useState<BranchType | ''>('')
  const [rollNumber, setRollNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) throw new Error('Failed to load profile')
        const json: ProfileResponse = await res.json()
        if (!json.profile) {
          // If profile missing, send to onboarding
          router.replace('/onboarding')
          return
        }
        setName(json.profile.name)
        setYear(json.profile.year)
        setBranch(json.profile.branch)
        setRollNumber(json.profile.roll_number)
      } catch (e: any) {
        setError(e.message || 'Error loading profile')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, year, branch, roll_number: rollNumber }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(json?.error || 'Failed to save profile')
      }
      setSuccess('Profile updated successfully!')
      // Auto-redirect after 2 seconds
      setTimeout(() => router.push('/home'), 2000)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      console.error('Profile update error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading profile…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>Update your details anytime</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={session?.user?.email ?? ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={year?.toString() ?? ''} onValueChange={(v) => setYear(parseInt(v))}>
                  <SelectTrigger id="year">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select value={branch} onValueChange={(v: BranchType) => setBranch(v)}>
                  <SelectTrigger id="branch">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roll">Roll number</Label>
              <Input id="roll" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} required />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save changes'}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/home')}>Back to Home</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


