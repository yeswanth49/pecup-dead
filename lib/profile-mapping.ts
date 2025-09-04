import { createSupabaseAdmin } from './supabase';

interface MappingResult {
  branch_id: string;
  year_id: string;
  semester_id: string;
}

/**
 * Maps frontend branch code, year, and semester to database UUIDs
 * @param branchCode - Branch code like 'CSE', 'AIML', etc.
 * @param yearNumber - Academic year number (1-4) or batch year (2023, 2024, etc.)
 * @param semesterNumber - Semester number (1 or 2), defaults to 1
 * @returns Promise resolving to database IDs
 */
export async function mapProfileDataToIds(
  branchCode: string,
  yearNumber: number,
  semesterNumber: number = 1
): Promise<MappingResult> {
  const supabase = createSupabaseAdmin();

  // Handle year mapping - if it's an academic year (1-4), convert to batch year
  let batchYear: number;
  if (yearNumber >= 1 && yearNumber <= 4) {
    // Map UI year selection to actual batch years based on current academic progression
    // This should match the academic config mappings
    const yearToBatchMapping: Record<number, number> = {
      1: 2024, // Year 1 -> 2024 batch (no 2025 batch in DB, use most recent)
      2: 2024, // Year 2 -> 2024 batch (2024 batch is currently Year 2)
      3: 2023, // Year 3 -> 2023 batch (2023 batch is currently Year 3)
      4: 2022  // Year 4 -> 2022 batch (2022 batch is currently Year 4)
    };

    batchYear = yearToBatchMapping[yearNumber] || 2024;
  } else {
    // Assume it's already a batch year
    batchYear = yearNumber;
  }

  // Get branch ID
  const { data: branch, error: branchError } = await supabase
    .from('branches')
    .select('id')
    .eq('code', branchCode)
    .single();

  if (branchError || !branch) {
    throw new Error(`Invalid branch code: ${branchCode}`);
  }

  // Get year ID
  const { data: year, error: yearError } = await supabase
    .from('years')
    .select('id')
    .eq('batch_year', batchYear)
    .single();

  if (yearError || !year) {
    throw new Error(`Invalid year: ${batchYear}`);
  }

  // Get semester ID
  const { data: semester, error: semesterError } = await supabase
    .from('semesters')
    .select('id')
    .eq('year_id', year.id)
    .eq('semester_number', semesterNumber)
    .single();

  if (semesterError || !semester) {
    throw new Error(`Invalid semester: ${semesterNumber} for year ${batchYear}`);
  }

  return {
    branch_id: branch.id,
    year_id: year.id,
    semester_id: semester.id
  };
}

/**
 * Reverse mapping: Convert database IDs back to frontend format
 * @param branchId - Branch UUID
 * @param yearId - Year UUID
 * @param semesterId - Semester UUID
 * @returns Promise resolving to frontend format
 */
export async function mapIdsToProfileData(
  branchId: string,
  yearId: string,
  semesterId: string
): Promise<{ branch: string; year: number; semester: number }> {
  const supabase = createSupabaseAdmin();

  // Get branch code
  const { data: branch, error: branchError } = await supabase
    .from('branches')
    .select('code')
    .eq('id', branchId)
    .single();

  if (branchError || !branch) {
    throw new Error(`Invalid branch ID: ${branchId}`);
  }

  // Get year data
  const { data: year, error: yearError } = await supabase
    .from('years')
    .select('batch_year')
    .eq('id', yearId)
    .single();

  if (yearError || !year) {
    throw new Error(`Invalid year ID: ${yearId}`);
  }

  // Get semester data
  const { data: semester, error: semesterError } = await supabase
    .from('semesters')
    .select('semester_number')
    .eq('id', semesterId)
    .single();

  if (semesterError || !semester) {
    throw new Error(`Invalid semester ID: ${semesterId}`);
  }

  return {
    branch: branch.code,
    year: year.batch_year,
    semester: semester.semester_number
  };
}
