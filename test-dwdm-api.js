require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Test the DWDM API functionality
async function testDWDMApi() {
  console.log('Testing DWDM API endpoint...');

  // Test parameters from the URL
  const category = 'assignments';
  const subject = 'dwdm';
  const year = '3';
  const semester = '1';
  const branch = 'CSE';

  console.log(`Testing with parameters:`);
  console.log(`- category: ${category}`);
  console.log(`- subject: ${subject}`);
  console.log(`- year: ${year}`);
  console.log(`- semester: ${semester}`);
  console.log(`- branch: ${branch}`);

  try {
    // Simulate the API call that would be made
    const queryParams = new URLSearchParams({
      category,
      subject,
      year,
      semester,
      branch
    });

    console.log(`\nAPI call would be: /api/resources?${queryParams.toString()}`);

    // Test the database query logic directly
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // First, let's get the branch_id for CSE
    const { data: branchData } = await supabaseAdmin
      .from('branches')
      .select('id')
      .eq('code', branch)
      .maybeSingle();

    console.log(`\nBranch lookup result:`, branchData);

    if (!branchData) {
      console.log('❌ Branch not found');
      return;
    }

    // Get year_id for year 3 (2023 batch)
    const yearNum = parseInt(year, 10);
    const yearToBatchMapping = {
      1: 2024,
      2: 2024,
      3: 2023,
      4: 2022
    };
    const batchYear = yearToBatchMapping[yearNum] || 2024;

    const { data: yearData } = await supabaseAdmin
      .from('years')
      .select('id')
      .eq('batch_year', batchYear)
      .maybeSingle();

    console.log(`\nYear lookup result (${batchYear}):`, yearData);

    if (!yearData) {
      console.log('❌ Year not found');
      return;
    }

    // Get semester_id
    const { data: semesterData } = await supabaseAdmin
      .from('semesters')
      .select('id')
      .eq('year_id', yearData.id)
      .eq('semester_number', parseInt(semester, 10))
      .maybeSingle();

    console.log(`\nSemester lookup result:`, semesterData);

    if (!semesterData) {
      console.log('❌ Semester not found');
      return;
    }

    // Now query for DWDM assignments
    console.log(`\nQuerying with filters:`);
    console.log(`- category: ${category}`);
    console.log(`- subject: ${subject}`);
    console.log(`- branch_id: ${branchData.id}`);
    console.log(`- year_id: ${yearData.id}`);
    console.log(`- semester_id: ${semesterData.id}`);

    // First, let's check without semester filter to see if the record exists
    const { data: resourcesWithoutSemester, error: error1 } = await supabaseAdmin
      .from('resources')
      .select(`
        id,
        name,
        description,
        drive_link,
        url,
        type,
        category,
        subject,
        unit,
        date,
        is_pdf,
        semester_id,
        branch:branches(id, name, code),
        year:years(id, batch_year, display_name),
        semester:semesters(id, semester_number)
      `)
      .eq('category', category)
      .eq('subject', subject)
      .eq('branch_id', branchData.id)
      .eq('year_id', yearData.id);

    console.log(`\nResults without semester filter: ${resourcesWithoutSemester?.length || 0} resources`);

    if (resourcesWithoutSemester?.length > 0) {
      resourcesWithoutSemester.forEach((resource, index) => {
        console.log(`${index + 1}. ${resource.name} (semester_id: ${resource.semester_id})`);
      });
    }

    // Now query with semester filter (the actual API logic)
    const { data: resources, error } = await supabaseAdmin
      .from('resources')
      .select(`
        id,
        name,
        description,
        drive_link,
        url,
        type,
        category,
        subject,
        unit,
        date,
        is_pdf,
        branch:branches(id, name, code),
        year:years(id, batch_year, display_name),
        semester:semesters(id, semester_number)
      `)
      .eq('category', category)
      .eq('subject', subject)
      .eq('branch_id', branchData.id)
      .eq('year_id', yearData.id)
      .eq('semester_id', semesterData.id);

    if (error) {
      console.error('❌ Database query error:', error);
      return;
    }

    console.log(`\n✅ Found ${resources?.length || 0} matching resources:`);
    resources?.forEach((resource, index) => {
      console.log(`${index + 1}. ${resource.name}`);
      console.log(`   - Unit: ${resource.unit}`);
      console.log(`   - Type: ${resource.type}`);
      console.log(`   - URL: ${resource.url}`);
      console.log(`   - Branch: ${resource.branch?.code}`);
      console.log(`   - Year: ${resource.year?.batch_year}`);
      console.log(`   - Semester: ${resource.semester?.semester_number}`);
      console.log('');
    });

    if (resources?.length > 0) {
      console.log('✅ API test successful! The URL parameters are working correctly.');
    } else {
      console.log('⚠️ No resources found - this might be expected if no DWDM assignments exist for these parameters.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDWDMApi();