#!/usr/bin/env npx ts-node

/**
 * Administrative script for role assignment
 * 
 * Usage examples:
 * npx ts-node scripts/assign-roles.ts assign-representative student@example.com CSE 2024
 * npx ts-node scripts/assign-roles.ts assign-admin admin@example.com
 * npx ts-node scripts/assign-roles.ts assign-superadmin superadmin@example.com
 * npx ts-node scripts/assign-roles.ts list-representatives
 * npx ts-node scripts/assign-roles.ts remove-representative student@example.com
 */

import { 
  assignRepresentative, 
  removeRepresentative, 
  assignAdmin, 
  assignSuperAdmin,
  listRepresentatives,
  getUserRoleInfo
} from '../lib/role-management'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command) {
    console.log('Usage: npx ts-node scripts/assign-roles.ts <command> [args...]')
    console.log('')
    console.log('Commands:')
    console.log('  assign-representative <email> <branch> <year>  - Assign user as representative')
    console.log('  assign-admin <email>                           - Assign user as admin')  
    console.log('  assign-superadmin <email>                      - Assign user as superadmin')
    console.log('  remove-representative <email>                  - Remove representative role')
    console.log('  list-representatives                           - List all representatives')
    console.log('  get-user-info <email>                          - Get user role and assignments')
    console.log('')
    console.log('Examples:')
    console.log('  npx ts-node scripts/assign-roles.ts assign-representative student@college.edu CSE 2024')
    console.log('  npx ts-node scripts/assign-roles.ts assign-admin admin@college.edu')
    console.log('  npx ts-node scripts/assign-roles.ts assign-superadmin super@college.edu')
    process.exit(1)
  }

  try {
    switch (command) {
      case 'assign-representative': {
        const [email, branchCode, yearStr] = args.slice(1)
        if (!email || !branchCode || !yearStr) {
          console.error('Error: assign-representative requires email, branch code, and year')
          console.log('Example: assign-representative student@college.edu CSE 2024')
          process.exit(1)
        }

        const year = parseInt(yearStr, 10)
        if (isNaN(year)) {
          console.error('Error: Year must be a number')
          process.exit(1)
        }

        console.log(`Assigning ${email} as representative for ${branchCode} Year ${year}...`)
        const result = await assignRepresentative(email, [{ branchCode, batchYear: year }])
        
        if (result.success) {
          console.log('✅ Representative assigned successfully!')
          if (result.assignments) {
            console.log('Assignments created:')
            result.assignments.forEach(a => {
              console.log(`  - ${a.branch_code} Year ${a.batch_year}`)
            })
          }
        } else {
          console.error('❌ Failed to assign representative:', result.error)
          process.exit(1)
        }
        break
      }

      case 'assign-admin': {
        const [email] = args.slice(1)
        if (!email) {
          console.error('Error: assign-admin requires email')
          console.log('Example: assign-admin admin@college.edu')
          process.exit(1)
        }

        console.log(`Assigning ${email} as admin...`)
        const result = await assignAdmin(email)
        
        if (result.success) {
          console.log('✅ Admin assigned successfully!')
        } else {
          console.error('❌ Failed to assign admin:', result.error)
          process.exit(1)
        }
        break
      }

      case 'assign-superadmin': {
        const [email] = args.slice(1)
        if (!email) {
          console.error('Error: assign-superadmin requires email')
          console.log('Example: assign-superadmin super@college.edu')
          process.exit(1)
        }

        console.log(`Assigning ${email} as superadmin...`)
        const result = await assignSuperAdmin(email)
        
        if (result.success) {
          console.log('✅ Superadmin assigned successfully!')
        } else {
          console.error('❌ Failed to assign superadmin:', result.error)
          process.exit(1)
        }
        break
      }

      case 'remove-representative': {
        const [email] = args.slice(1)
        if (!email) {
          console.error('Error: remove-representative requires email')
          console.log('Example: remove-representative student@college.edu')
          process.exit(1)
        }

        console.log(`Removing representative role from ${email}...`)
        const result = await removeRepresentative(email)
        
        if (result.success) {
          console.log('✅ Representative role removed successfully!')
        } else {
          console.error('❌ Failed to remove representative:', result.error)
          process.exit(1)
        }
        break
      }

      case 'list-representatives': {
        console.log('Fetching all representatives...')
        const representatives = await listRepresentatives()
        
        if (representatives.length === 0) {
          console.log('No representatives found.')
        } else {
          console.log(`\nFound ${representatives.length} representative(s):\n`)
          representatives.forEach(rep => {
            console.log(`📧 ${rep.profiles?.email} (${rep.profiles?.name})`)
            console.log(`   📚 ${rep.branches?.code} - Year ${rep.years?.batch_year}`)
            console.log(`   📅 Assigned: ${new Date(rep.assigned_at).toLocaleDateString()}`)
            console.log(`   🟢 Status: ${rep.active ? 'Active' : 'Inactive'}`)
            console.log('')
          })
        }
        break
      }

      case 'get-user-info': {
        const [email] = args.slice(1)
        if (!email) {
          console.error('Error: get-user-info requires email')
          console.log('Example: get-user-info student@college.edu')
          process.exit(1)
        }

        console.log(`Getting role information for ${email}...`)
        const result = await getUserRoleInfo(email)
        
        if (result.error) {
          console.error('❌ Error:', result.error)
          process.exit(1)
        }

        console.log(`\n📧 Email: ${email}`)
        console.log(`👤 Role: ${result.role}`)
        
        if (result.assignments && result.assignments.length > 0) {
          console.log(`📚 Representative Assignments:`)
          result.assignments.forEach(assignment => {
            console.log(`   - ${assignment.branches?.code} Year ${assignment.years?.batch_year} (${assignment.active ? 'Active' : 'Inactive'})`)
          })
        } else if (result.role === 'representative') {
          console.log(`📚 No active representative assignments found`)
        }
        break
      }

      default:
        console.error(`Unknown command: ${command}`)
        console.log('Run without arguments to see available commands.')
        process.exit(1)
    }

  } catch (error) {
    console.error('Script execution failed:', error)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main()
}
