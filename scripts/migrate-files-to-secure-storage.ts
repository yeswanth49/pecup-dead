#!/usr/bin/env npx ts-node

/**
 * File Migration Script
 *
 * Migrates existing files from public storage (Google Drive and Supabase public buckets)
 * to secure storage with proper access controls.
 *
 * Usage: npx ts-node scripts/migrate-files-to-secure-storage.ts
 */

import { createSupabaseAdmin } from '../lib/supabase';
import { migrateFileToSecureStorage } from '../lib/files';

async function migrateFilesToSecureStorage() {
  console.log('🔄 Starting file migration to secure storage...');

  try {
    const supabase = createSupabaseAdmin();

    // 1. Get all resources that haven't been migrated yet
    const { data: resources, error } = await supabase
      .from('resources')
      .select('id, file_path, drive_link, storage_location, migrated_to_secure')
      .eq('migrated_to_secure', false);

    if (error) {
      console.error('❌ Error fetching resources:', error.message);
      return;
    }

    if (!resources || resources.length === 0) {
      console.log('✅ No files need migration');
      return;
    }

    console.log(`📁 Found ${resources.length} files to migrate`);

    let successCount = 0;
    let errorCount = 0;

    // 2. Migrate each file
    for (const resource of resources) {
      console.log(`\n🔄 Migrating resource ${resource.id}...`);
      console.log(`   Storage location: ${resource.storage_location}`);
      console.log(`   File path: ${resource.file_path || 'N/A'}`);

      try {
        // Determine the current file location
        let currentPath: string;
        let storageLocation: string;

        if (resource.drive_link && resource.drive_link.includes('drive.google.com')) {
          currentPath = resource.drive_link;
          storageLocation = 'Google Drive';
        } else if (resource.file_path && resource.storage_location === 'Supabase Storage') {
          currentPath = resource.file_path;
          storageLocation = 'Supabase Storage';
        } else {
          console.warn(`   ⚠️  Unknown storage location for resource ${resource.id}`);
          errorCount++;
          continue;
        }

        // Migrate the file
        const newPath = await migrateFileToSecureStorage(currentPath, storageLocation);

        if (newPath) {
          // Update the database record
          const { error: updateError } = await supabase
            .from('resources')
            .update({
              migrated_to_secure: true,
              secure_file_path: newPath,
              original_public_url: currentPath,
              storage_location: 'Secure Storage'
            })
            .eq('id', resource.id);

          if (updateError) {
            console.error(`   ❌ Error updating database: ${updateError.message}`);
            errorCount++;
          } else {
            console.log(`   ✅ Successfully migrated to: ${newPath}`);
            successCount++;
          }
        } else {
          console.error(`   ❌ Failed to migrate file`);
          errorCount++;
        }

      } catch (migrationError: any) {
        console.error(`   ❌ Migration error: ${migrationError.message}`);
        errorCount++;
      }
    }

    // 3. Report results
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${successCount} files`);
    console.log(`   ❌ Failed to migrate: ${errorCount} files`);
    console.log(`   📁 Total processed: ${resources.length} files`);

    if (errorCount > 0) {
      console.log('\n⚠️  Some files failed to migrate. Check the logs above for details.');
      console.log('   You may need to manually migrate these files or fix the issues.');
    }

    if (successCount > 0) {
      console.log('\n🎉 Migration completed! Files are now stored securely.');
      console.log('   Users will need to request secure URLs to access files.');
    }

  } catch (error: any) {
    console.error('❌ Error during migration:', error.message);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  console.log('🔒 Starting secure storage migration...');
  console.log('   This will move files from public storage to secure storage');
  console.log('   Files will only be accessible via signed URLs after migration');
  console.log('');

  // Add a small delay to allow user to cancel if needed
  setTimeout(() => {
    migrateFilesToSecureStorage();
  }, 2000);
}
