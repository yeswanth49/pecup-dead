import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserContext, canManageResources } from '@/lib/auth-permissions'
import { createSupabaseAdmin } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { tryParseDriveIdFromUrl, tryParseStoragePathFromUrl } from '@/lib/files'
import { google } from 'googleapis'

/**
 * DELETE /api/representative/resources/[id]
 * Delete a resource (representatives can only delete resources they can manage)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userContext = await getCurrentUserContext()
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (userContext.role !== 'representative') {
      return NextResponse.json({ error: 'Forbidden: Representatives only' }, { status: 403 })
    }

    const supabase = createSupabaseAdmin()
    const resourceId = params.id

    // Get the resource to check permissions and for cleanup
    const { data: resource, error: fetchError } = await supabase
      .from('resources')
      .select(`
        id, title, name, url, drive_link, file_type, is_pdf,
        branch_id, year_id, semester_id, uploader_id,
        branches:branch_id(id, name, code),
        years:year_id(id, batch_year, display_name)
      `)
      .eq('id', resourceId)
      .single()

    if (fetchError || !resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
    }

    // Check if representative can manage this resource
    const canManage = await canManageResources(resource.branch_id, resource.year_id)
    if (!canManage) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot manage resources for this branch/year' },
        { status: 403 }
      )
    }

    // Try to delete the actual file
    let fileDeleteSuccess = false
    let fileDeleteError = null

    try {
      const fileUrl = resource.drive_link || resource.url
      
      if (fileUrl) {
        // Try Drive first
        const driveId = tryParseDriveIdFromUrl(fileUrl)
        if (driveId) {
          await deleteDriveFile(driveId)
          fileDeleteSuccess = true
        } else {
          // Try Supabase Storage
          const storagePath = tryParseStoragePathFromUrl(fileUrl)
          if (storagePath) {
            await deleteStorageFile(storagePath)
            fileDeleteSuccess = true
          }
        }
      }
    } catch (err) {
      fileDeleteError = err instanceof Error ? err.message : 'Unknown file deletion error'
      console.warn('File deletion failed, proceeding with DB deletion:', fileDeleteError)
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('resources')
      .delete()
      .eq('id', resourceId)

    if (deleteError) {
      console.error('Error deleting resource from database:', deleteError)
      return NextResponse.json({ error: 'Failed to delete resource' }, { status: 500 })
    }

    // Log the deletion
    await logAudit({
      actorEmail: userContext.email,
      actorRole: 'admin', // Representatives log as admin for audit purposes
      action: 'delete',
      entity: 'resource',
      entityId: resourceId,
      success: true,
      message: `Representative deleted resource: ${resource.title || resource.name}`,
      beforeData: resource,
      afterData: {
        fileDeleteSuccess,
        fileDeleteError
      }
    })

    return NextResponse.json({
      success: true,
      fileDeleteSuccess,
      fileDeleteError
    })
  } catch (error) {
    console.error('Representative resource deletion error:', error)
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/representative/resources/[id]
 * Update a resource (representatives can only update resources they can manage)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userContext = await getCurrentUserContext()
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (userContext.role !== 'representative') {
      return NextResponse.json({ error: 'Forbidden: Representatives only' }, { status: 403 })
    }

    const supabase = createSupabaseAdmin()
    const resourceId = params.id

    // Get the current resource
    const { data: currentResource, error: fetchError } = await supabase
      .from('resources')
      .select('*')
      .eq('id', resourceId)
      .single()

    if (fetchError || !currentResource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
    }

    // Check if representative can manage this resource
    const canManage = await canManageResources(currentResource.branch_id, currentResource.year_id)
    if (!canManage) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot manage resources for this branch/year' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updateData: any = {}

    // Allow updating specific fields
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.archived !== undefined) updateData.archived = body.archived

    // Representatives cannot change branch/year assignments
    if (body.branchId || body.yearId || body.semesterId) {
      return NextResponse.json(
        { error: 'Representatives cannot change resource branch/year assignments' },
        { status: 403 }
      )
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Update the resource
    const { data: updatedResource, error: updateError } = await supabase
      .from('resources')
      .update(updateData)
      .eq('id', resourceId)
      .select('*')
      .single()

    if (updateError) {
      console.error('Error updating resource:', updateError)
      return NextResponse.json({ error: 'Failed to update resource' }, { status: 500 })
    }

    // Log the update
    await logAudit({
      actorEmail: userContext.email,
      actorRole: 'admin', // Representatives log as admin for audit purposes
      action: 'update',
      entity: 'resource',
      entityId: resourceId,
      success: true,
      message: `Representative updated resource: ${updatedResource.title || updatedResource.name}`,
      beforeData: currentResource,
      afterData: updatedResource
    })

    return NextResponse.json({ resource: updatedResource })
  } catch (error) {
    console.error('Representative resource update error:', error)
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper functions for file deletion
async function deleteDriveFile(driveId: string) {
  let credentials;
  try {
    const rawB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_B64
    const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    let raw = rawJson || '{}'
    if (rawB64) {
      try {
        raw = Buffer.from(rawB64, 'base64').toString('utf8')
      } catch (e) {
        console.error('Failed to decode GOOGLE_APPLICATION_CREDENTIALS_B64:', e)
        throw e
      }
    }
    credentials = JSON.parse(raw)
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Invalid Google credentials')
    }
  } catch (err) {
    throw new Error('Google Drive configuration error')
  }
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive']
  })
  const drive = google.drive({ version: 'v3', auth })
  
  await drive.files.delete({ fileId: driveId })
}

async function deleteStorageFile(storagePath: string) {
  const supabase = createSupabaseAdmin()
  const { data: settings } = await supabase.from('settings').select('*').single()
  const bucket = settings?.storage_bucket || 'resources'
  
  const { error } = await supabase.storage
    .from(bucket)
    .remove([storagePath])
  
  if (error) throw error
}
