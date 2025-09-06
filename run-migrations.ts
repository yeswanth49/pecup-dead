#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runMigrations() {
  console.log('🚀 Starting Supabase Schema Migration...');
  console.log('📋 Migration Plan: Address 6 Critical Schema Red Flags');
  console.log('');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('🔗 Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Not set');
  console.log('🔑 Service Role Key:', serviceRoleKey ? '✅ Set' : '❌ Not set');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required environment variables');
    console.error('   Please ensure .env.local contains:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('');
  console.log('📋 Migration Overview:');
  console.log('1. ✅ 001_create_unified_users.sql - Unified identity management');
  console.log('2. ✅ 002_enhance_branches_years_semesters.sql - Academic structure');
  console.log('3. ✅ 003_split_resources_tables.sql - Resource normalization');
  console.log('4. ✅ 004_migrate_audit_logs.sql - Audit system unification');
  console.log('5. ✅ 005_fix_settings_singleton.sql - Settings architecture');
  console.log('6. ✅ 006_data_consolidation.sql - Data consolidation');
  console.log('7. ✅ 007_update_rls_policies.sql - Security policies');
  console.log('');

  // Display migration files content for manual execution
  const migrations = [
    '001_create_unified_users.sql',
    '002_enhance_branches_years_semesters.sql',
    '003_split_resources_tables.sql',
    '004_migrate_audit_logs.sql',
    '005_fix_settings_singleton.sql',
    '006_data_consolidation.sql',
    '007_update_rls_policies.sql'
  ];

  console.log('📄 MANUAL EXECUTION INSTRUCTIONS:');
  console.log('========================================');
  console.log('');
  console.log('Since direct database connection is timing out, please execute these migrations manually:');
  console.log('');

  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    console.log(`${i + 1}. Execute Migration ${migration}:`);
    console.log(`   📁 Location: migrations/${migration}`);

    try {
      const migrationPath = join(__dirname, 'migrations', migration);
      const content = readFileSync(migrationPath, 'utf-8');

      // Show first few lines as preview
      const lines = content.split('\n').slice(0, 5);
      console.log(`   📄 Preview: ${lines.join(' ').substring(0, 100)}...`);
      console.log('');

    } catch (error) {
      console.error(`   ❌ Error reading ${migration}:`, error);
    }
  }

  console.log('');
  console.log('🛠️  EXECUTION METHODS:');
  console.log('');
  console.log('Method 1 - Supabase Dashboard:');
  console.log('1. Go to https://supabase.com/dashboard/project/hynugyyfidoxapjmmahd/sql');
  console.log('2. Copy and paste each migration file content');
  console.log('3. Execute each migration in order');
  console.log('');

  console.log('Method 2 - Supabase CLI (if installed):');
  console.log('1. Install: npm install -g @supabase/cli');
  console.log('2. Login: supabase login');
  console.log('3. Link: supabase link --project-ref hynugyyfidoxapjmmahd');
  console.log('4. Execute: supabase db push');
  console.log('');

  console.log('Method 3 - psql (if available):');
  console.log('1. Connect: psql "postgresql://postgres:[SERVICE_KEY]@hynugyyfidoxapjmmahd.supabase.co:5432/postgres"');
  console.log('2. Execute: \\i migrations/001_create_unified_users.sql');
  console.log('3. Repeat for each migration file');
  console.log('');

  console.log('⚠️  IMPORTANT NOTES:');
  console.log('========================================');
  console.log('• Execute migrations in the exact order shown above');
  console.log('• Some migrations include error handling for missing tables');
  console.log('• Check the output for any notices or warnings');
  console.log('• If a migration fails, review the error and fix before proceeding');
  console.log('• All migrations are designed to be idempotent (safe to re-run)');
  console.log('');

  console.log('🎯 WHAT THESE MIGRATIONS FIX:');
  console.log('========================================');
  console.log('🚩 Red Flag 1: Inconsistent branch/year/semester representation');
  console.log('   ✅ Standardized on FK relationships with enum preservation');
  console.log('');
  console.log('🚩 Red Flag 2: Profiles vs Students vs Admins duplication');
  console.log('   ✅ Created canonical users table with unified identity');
  console.log('');
  console.log('🚩 Red Flag 3: Years & Semesters fragile modeling');
  console.log('   ✅ Added configurable semester support (8 semesters per year)');
  console.log('');
  console.log('🚩 Red Flag 4: Audit logs actor mismatch');
  console.log('   ✅ Unified single FK to users table for all audit actions');
  console.log('');
  console.log('🚩 Red Flag 5: Settings singleton design smell');
  console.log('   ✅ Replaced hacky singleton with proper key-value structure');
  console.log('');
  console.log('🚩 Red Flag 6: Resource table overloaded (20+ fields)');
  console.log('   ✅ Split into resources + resource_files + resource_metadata');
  console.log('');

  console.log('📞 SUPPORT:');
  console.log('========================================');
  console.log('If you encounter any errors during manual execution:');
  console.log('1. Check the troubleshooting section in migrations/README.md');
  console.log('2. Review the specific error message and match it to known issues');
  console.log('3. Verify your Supabase project is active and accessible');
  console.log('4. Ensure you have the necessary permissions');
  console.log('');

  console.log('🎉 Ready for manual migration execution!');
}

// Run the migrations
runMigrations().catch(console.error);
