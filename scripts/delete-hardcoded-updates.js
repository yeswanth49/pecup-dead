// Script to delete hardcoded recent updates via admin API
// Run this with: node scripts/delete-hardcoded-updates.js

// IDs of hardcoded entries to delete (from the database query)
const hardcodedUpdateIds = [
  '1c837c40-5e6a-4cec-bc36-d021c6e85e7b', // SE Unit 1,2,3 Key Points File
  '4e313cde-a302-4d65-9e90-4c33b240cf34', // DBMS Model Paper
  'cc13d4b2-8d3c-4822-bcd6-7afa19b20748', // DBMS Mid 2 Paper
  'd22b2208-285f-41c1-b3ac-d1d8ed9b093a', // DBMS Notes Error Adjusted
  'de8084ab-b699-4ca9-8f01-5fe6cf1202dc'  // DBMS Unit 5 Notes
];

async function deleteHardcodedUpdates() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  console.log('🗑️  Starting deletion of hardcoded recent updates...\n');
  
  for (const id of hardcodedUpdateIds) {
    try {
      console.log(`Deleting update with ID: ${id}`);
      
      const response = await fetch(`${baseUrl}/api/admin/recent-updates/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          // Note: This script assumes you're running as an authenticated admin
          // You may need to add authentication headers here
        }
      });
      
      if (response.ok) {
        console.log(`✅ Successfully deleted: ${id}`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log(`❌ Failed to delete ${id}: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ Network error deleting ${id}:`, error.message);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n🎉 Deletion process completed!');
  console.log('Note: You may need to authenticate as an admin for the deletions to work.');
}

// Run the deletion
deleteHardcodedUpdates().catch(console.error);
