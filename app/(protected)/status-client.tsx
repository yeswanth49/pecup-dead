'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useProfile } from '@/lib/enhanced-profile-context'

export default function ClientStatus() {
  const { error, warnings, loading } = useProfile()

  if (!error && (!warnings || warnings.length === 0)) return null

  return (
    <div className="px-4">
      {error && (
        <Alert variant="destructive" className="mb-2">
          <AlertTitle>Problem loading data</AlertTitle>
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}
      {warnings && warnings.length > 0 && (
        <Alert className="mb-2">
          <AlertTitle>Some context is missing</AlertTitle>
          <AlertDescription>
            <ul className="list-disc ml-5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}


