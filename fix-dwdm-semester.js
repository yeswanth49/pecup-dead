require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function fixDWDMSemester() {
  console.log('Fixing DWDM assignment semester_id...');

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Get the semester_id for semester 1 of the 2023 batch (year 3)
  const { data: semesterData } = await supabaseAdmin
    .from('semesters')
    .select('id')
    .eq('semester_number', 1)
    .eq('year_id', '57283f9b-01a2-4789-b0c0-ed7981c67fe1') // 2023 batch
    .maybeSingle();

  if (!semesterData) {
    console.log('❌ Could not find semester data');
    return;
  }

  console.log(`Found semester_id: ${semesterData.id}`);

  // Update the DWDM assignment to set the correct semester_id
  const { data: updateResult, error } = await supabaseAdmin
    .from('resources')
    .update({ semester_id: semesterData.id })
    .eq('id', '14b425bf-193e-4f24-9295-0b6d3d42fd50')
    .select();

  if (error) {
    console.error('❌ Failed to update DWDM assignment:', error);
    return;
  }

  console.log('✅ Successfully updated DWDM assignment semester_id');
  console.log('Updated record:', updateResult);

  // Verify the fix by querying again
  console.log('\nVerifying the fix...');
  const { data: resources, error: verifyError } = await supabaseAdmin
    .from('resources')
    .select(`
      id,
      name,
      semester_id,
      semester:semesters(semester_number)
    `)
    .eq('id', '14b425bf-193e-4f24-9295-0b6d3d42fd50');

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError);
    return;
  }

  console.log('✅ Verification successful:');
  console.log(`- semester_id: ${resources[0]?.semester_id}`);
  console.log(`- semester_number: ${resources[0]?.semester?.semester_number}`);
}

fixDWDMSemester();