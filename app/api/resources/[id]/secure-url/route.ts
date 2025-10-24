// app/api/resources/[id]/secure-url/route.ts
// Generate secure URLs for resource access

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { generateSecureFileUrl } from '@/lib/files';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const DEBUG_PREFIX = '[API DEBUG SecureURL]';
  console.log(`${DEBUG_PREFIX} Secure URL request received`);

  try {
    // 1. Validate user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.warn(`${DEBUG_PREFIX} No valid session`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get user context (this includes role and permission information)
    let userContext;
    try {
      const { getCurrentUserContext } = await import('@/lib/auth-permissions');
      userContext = await getCurrentUserContext();
      if (!userContext) {
        console.warn(`${DEBUG_PREFIX} Could not get user context`);
        return NextResponse.json({ error: 'Could not verify user permissions' }, { status: 403 });
      }
    } catch (contextError) {
      console.error(`${DEBUG_PREFIX} Error getting user context:`, contextError);
      return NextResponse.json({ error: 'Permission verification failed' }, { status: 500 });
    }

    // 3. Generate secure URL for the resource
    console.log(`${DEBUG_PREFIX} Attempting to generate secure URL for resource ${params.id}`);
    const secureUrlResult = await generateSecureFileUrl(params.id, userContext);
    if (!secureUrlResult) {
      console.warn(`${DEBUG_PREFIX} Access denied or resource not found for resource ${params.id}`);
      return NextResponse.json({ error: 'Access denied or resource not found' }, { status: 403 });
    }

    // 4. Return the secure URL with expiration information
    console.log(`${DEBUG_PREFIX} Secure URL generated`);

    return NextResponse.json({
      secureUrl: secureUrlResult.url,
      expiresAt: secureUrlResult.expiresAt.toISOString(),
      expiresInSeconds: Math.floor((secureUrlResult.expiresAt.getTime() - Date.now()) / 1000)
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

  } catch (error: any) {
    console.error(`${DEBUG_PREFIX} Error generating secure URL:`, error.message || error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
