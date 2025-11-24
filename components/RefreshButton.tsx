'use client'

import { Button } from '@/components/ui/button'
import { useProfile } from '@/lib/enhanced-profile-context'
import type { ReactElement } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { RefreshCw, Loader2 } from 'lucide-react'

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
			size="sm"
			className="text-primary hover:text-primary/80 hover:bg-transparent"
		>
			{loading ? (
				<>
					<Loader2 className="h-4 w-4 animate-spin md:mr-2" />
					<span className="hidden md:inline">Refreshing...</span>
				</>
			) : (
				<>
					<RefreshCw className="h-4 w-4 md:mr-2" />
					<span className="hidden md:inline">Refresh Data</span>
				</>
			)}
		</Button>
	)
}
