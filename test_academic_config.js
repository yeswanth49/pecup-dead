console.log('Testing academic config...');

// Test the academic year calculation logic
function calculateAcademicYear(batchYear, config) {
  if (!batchYear) return 1;

  // Check if we have an explicit mapping
  if (config.yearMappings[batchYear]) {
    return config.yearMappings[batchYear];
  }

  // Dynamic calculation based on current date
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Adjust for academic year (if we're before start month, we're still in previous academic year)
  const adjustedYear = currentMonth >= config.startMonth ? currentYear : currentYear - 1;

  // Handle future batch years (students who haven't started yet)
  if (batchYear > adjustedYear) {
    return 1; // Future batches start at year 1
  }

  const academicYear = adjustedYear - batchYear + 1;

  // Clamp within valid range
  return Math.max(1, Math.min(academicYear, config.programLength));
}

const testConfig = {
  programLength: 4,
  startMonth: 6,
  currentAcademicYear: 2025,
  yearMappings: {
    2024: 1, // Current active batch = Academic year 1 (capped from 2025)
    2023: 2, // Previous batch = Academic year 2
    2022: 3, // Batch 2022 = Academic year 3
    2021: 4, // Batch 2021 = Academic year 4
    2025: 1  // Future batch = Academic year 1
  }
};

console.log('Testing year calculations:');
console.log('Batch year 2024 -> Academic year:', calculateAcademicYear(2024, testConfig));
console.log('Batch year 2023 -> Academic year:', calculateAcademicYear(2023, testConfig));
console.log('Batch year 2022 -> Academic year:', calculateAcademicYear(2022, testConfig));
console.log('Batch year 2021 -> Academic year:', calculateAcademicYear(2021, testConfig));
console.log('Batch year 2025 -> Academic year:', calculateAcademicYear(2025, testConfig));

console.log('\nCurrent date context:');
console.log('Current year:', new Date().getFullYear());
console.log('Current month:', new Date().getMonth() + 1);
console.log('Adjusted year (start month 6):', (new Date().getMonth() + 1 >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1));
