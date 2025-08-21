import { NextResponse } from 'next/server'
import { getCurrentUserContext, getUserPermissions } from '@/lib/auth-permissions'

/**
 * GET /api/user/context
 * Get current user's context, role, and permissions
 */
export async function GET() {
  try {
    const userContext = await getCurrentUserContext()
    
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = await getUserPermissions(userContext)

    return NextResponse.json({
      userContext,
      permissions
    })
  } catch (error) {
    console.error('User context error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
