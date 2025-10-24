'use client'

import { Button } from '@/components/ui/button'
import { useProfile } from '@/lib/enhanced-profile-context'
import type { ReactElement } from 'react'
import { useToast } from '@/components/ui/use-toast'

export function RefreshButton(): ReactElement {
	const { forceRefresh, loading } = useProfile()
	const { toast } = useToast()

	const handleClick = async () => {
		if (loading) return
		try {
			await forceRefresh()
		} catch (err: any) {
			const message = err?.message || 'Failed to refresh data'
			toast({ title: 'Refresh failed', description: message, variant: 'destructive' })
		}
	}

	return (
		<Button
			type="button"
			onClick={handleClick}
			disabled={loading}
			aria-label={loading ? 'Refreshing data' : 'Refresh data'}
			aria-busy={loading || undefined}
			variant="ghost"
			className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
		>
			{loading ? 'Refreshing...' : '🔄 Refresh Data'}
		</Button>
	)
}
