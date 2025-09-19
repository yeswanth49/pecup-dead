'use client'

import { Button } from '@/components/ui/button'
import { useProfile } from '@/lib/enhanced-profile-context'

export function RefreshButton() {
	const { forceRefresh, loading } = useProfile()

	return (
		<Button
			type="button"
			onClick={forceRefresh}
			disabled={loading}
			variant="ghost"
			className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
		>
			{loading ? 'Refreshing...' : '🔄 Refresh Data'}
		</Button>
	)
}


