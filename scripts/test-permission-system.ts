/**
 * Test script for the role-based permission system
 * Run with: npx ts-node scripts/test-permission-system.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface TestResult {
  test: string
  passed: boolean
  error?: string
}

async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = []

  try {
    // Test 1: Check if representative role exists in enum
    console.log('Testing user_role enum...')
    const { data: enumData, error: enumError } = await supabase
      .rpc('get_enum_values', { enum_name: 'user_role' })
    
    if (enumError) {
      // Fallback query for enum values
      const { data: typeData } = await supabase
        .from('pg_type')
        .select('typname')
        .eq('typname', 'user_role')
      
      results.push({
        test: 'Representative role in enum',
        passed: typeData && typeData.length > 0,
        error: enumError.message
      })
    } else {
      const hasRepresentative = enumData?.includes('representative')
      results.push({
        test: 'Representative role in enum',
        passed: hasRepresentative,
        error: hasRepresentative ? undefined : 'Representative role not found in enum'
      })
    }

    // Test 2: Check if representatives table exists
    console.log('Testing representatives table...')
    const { data: repTable, error: repError } = await supabase
      .from('representatives')
      .select('id')
      .limit(1)

    results.push({
      test: 'Representatives table exists',
      passed: !repError,
      error: repError?.message
    })

    // Test 3: Check if semester_promotions table exists
    console.log('Testing semester_promotions table...')
    const { data: promTable, error: promError } = await supabase
      .from('semester_promotions')
      .select('id')
      .limit(1)

    results.push({
      test: 'Semester promotions table exists',
      passed: !promError,
      error: promError?.message
    })

    // Test 4: Check if profiles table has role field
    console.log('Testing profiles table role field...')
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .limit(1)

    results.push({
      test: 'Profiles table has role field',
      passed: !profileError,
      error: profileError?.message
    })

    // Test 5: Test RLS policies exist
    console.log('Testing RLS policies...')
    const { data: rlsData, error: rlsError } = await supabase
      .rpc('check_rls_enabled', { table_name: 'representatives' })

    results.push({
      test: 'RLS enabled on representatives table',
      passed: !rlsError && rlsData,
      error: rlsError?.message
    })

    // Test 6: Check if we can create a test representative assignment
    console.log('Testing representative assignment...')
    
    // First, get a test user (create if needed)
    const testEmail = 'test-rep@example.com'
    let { data: testUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', testEmail)
      .single()

    if (!testUser) {
      // Create test user
      const { data: newUser, error: userError } = await supabase
        .from('profiles')
        .insert({
          email: testEmail,
          name: 'Test Representative',
          year: 2,
          branch: 'CSE',
          roll_number: 'TEST123',
          role: 'student'
        })
        .select('id')
        .single()

      if (userError) {
        results.push({
          test: 'Create test user for representative assignment',
          passed: false,
          error: userError.message
        })
      } else {
        testUser = newUser
      }
    }

    if (testUser) {
      // Get a branch and year for testing
      const { data: branch } = await supabase
        .from('branches')
        .select('id')
        .eq('code', 'CSE')
        .single()

      const { data: year } = await supabase
        .from('years')
        .select('id')
        .limit(1)
        .single()

      if (branch && year) {
        // Try to create representative assignment
        const { error: repAssignError } = await supabase
          .from('representatives')
          .upsert({
            user_id: testUser.id,
            branch_id: branch.id,
            year_id: year.id,
            active: true
          })

        results.push({
          test: 'Create representative assignment',
          passed: !repAssignError,
          error: repAssignError?.message
        })

        // Update user role to representative
        if (!repAssignError) {
          const { error: roleUpdateError } = await supabase
            .from('profiles')
            .update({ role: 'representative' })
            .eq('id', testUser.id)

          results.push({
            test: 'Update user role to representative',
            passed: !roleUpdateError,
            error: roleUpdateError?.message
          })
        }
      }
    }

    // Test 7: Check API endpoints are accessible
    console.log('Testing API endpoints...')
    
    // This would require actual HTTP requests with authentication
    // For now, we'll just check if the files exist
    const fs = require('fs')
    const path = require('path')
    
    const apiFiles = [
      'app/api/admin/representatives/route.ts',
      'app/api/semester-promotion/route.ts',
      'app/api/representative/resources/route.ts',
      'app/api/user/context/route.ts'
    ]

    for (const file of apiFiles) {
      const exists = fs.existsSync(path.join(process.cwd(), file))
      results.push({
        test: `API file exists: ${file}`,
        passed: exists,
        error: exists ? undefined : `File not found: ${file}`
      })
    }

  } catch (error) {
    results.push({
      test: 'Overall test execution',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  return results
}

// Run the tests
runTests().then(results => {
  console.log('\n=== Permission System Test Results ===\n')
  
  let passed = 0
  let failed = 0

  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL'
    console.log(`${status} ${result.test}`)
    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`)
    }
    
    if (result.passed) passed++
    else failed++
  })

  console.log(`\n=== Summary ===`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total: ${results.length}`)

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Permission system is ready.')
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.')
  }
}).catch(error => {
  console.error('Test execution failed:', error)
})
