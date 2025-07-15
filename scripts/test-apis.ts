import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

async function testAPI(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  
  try {
    console.log(`Testing ${endpoint}...`);
    const response = await fetch(url.toString());
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${endpoint} - SUCCESS`);
      console.log(`   Response: ${JSON.stringify(data).substring(0, 200)}...`);
    } else {
      console.log(`❌ ${endpoint} - ERROR`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${JSON.stringify(data)}`);
    }
  } catch (error: any) {
    console.log(`❌ ${endpoint} - FETCH ERROR`);
    console.log(`   Error: ${error.message}`);
  }
  
  console.log('');
}

async function runTests() {
  console.log('🧪 Testing Supabase-migrated API endpoints...\n');
  
  // Test resources API
  await testAPI('/api/resources', {
    category: 'notes',
    subject: 'math',
    unit: '1'
  });
  
  // Test reminders API
  await testAPI('/api/reminders');
  
  // Test recent updates API
  await testAPI('/api/recent-updates');
  
  // Test prime section data API
  await testAPI('/api/prime-section-data');
  
  console.log('🏁 API tests completed!');
}

runTests().catch(console.error); 