console.log('Testing academic config...');

// Test the academic year calculation logic with input validation and deterministic time
function calculateAcademicYear(batchYear, config, now) {
  // Validate config object
  if (!config || typeof config !== 'object') {
    throw new Error('Config must be a non-null object');
  }

  // Validate required fields
  const requiredFields = ['programLength', 'startMonth', 'yearMappings'];
  for (const field of requiredFields) {
    if (!(field in config)) {
      throw new Error(`Config missing required field: ${field}`);
    }
  }

  // Validate numeric fields
  if (typeof config.programLength !== 'number' || !Number.isFinite(config.programLength) || config.programLength <= 0) {
    throw new Error('Config.programLength must be a positive finite number');
  }

  if (typeof config.startMonth !== 'number' || !Number.isFinite(config.startMonth) || config.startMonth < 1 || config.startMonth > 12) {
    throw new Error('Config.startMonth must be a number between 1 and 12');
  }

  // Validate batchYear
  if (batchYear === null || batchYear === undefined) {
    return 1; // Default fallback for missing batchYear
  }

  if (typeof batchYear !== 'number' || !Number.isFinite(batchYear) || !Number.isInteger(batchYear) || batchYear < 0) {
    throw new Error('batchYear must be a non-negative integer');
  }

  // Check if we have an explicit mapping
  if (config.yearMappings && typeof config.yearMappings === 'object' && config.yearMappings[batchYear]) {
    const mappedYear = config.yearMappings[batchYear];
    if (typeof mappedYear !== 'number' || !Number.isFinite(mappedYear) || !Number.isInteger(mappedYear) || mappedYear < 1) {
      throw new Error(`Invalid year mapping for batchYear ${batchYear}: must be a positive integer`);
    }
    return mappedYear;
  }

  // Determine current time (deterministic if now parameter provided)
  let currentTime;
  if (now === undefined || now === null) {
    currentTime = Date.now();
  } else if (now instanceof Date) {
    currentTime = now.getTime();
  } else if (typeof now === 'number' && Number.isFinite(now)) {
    currentTime = now;
  } else {
    throw new Error('now parameter must be a Date object, timestamp number, or undefined/null');
  }

  const currentDate = new Date(currentTime);
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

// Test deterministic behavior with now parameter
const testDate = new Date('2024-08-15'); // August 15, 2024
console.log('\nDeterministic tests (using August 15, 2024):');
console.log('Batch year 2024 -> Academic year:', calculateAcademicYear(2024, testConfig, testDate));
console.log('Batch year 2023 -> Academic year:', calculateAcademicYear(2023, testConfig, testDate));
console.log('Batch year 2022 -> Academic year:', calculateAcademicYear(2022, testConfig, testDate));

// Test with timestamp
const timestamp = new Date('2024-03-15').getTime(); // March 15, 2024 (before start month)
console.log('\nDeterministic tests (using March 15, 2024):');
console.log('Batch year 2024 -> Academic year:', calculateAcademicYear(2024, testConfig, timestamp));
console.log('Batch year 2023 -> Academic year:', calculateAcademicYear(2023, testConfig, timestamp));

// Test input validation
console.log('\nTesting input validation:');
try {
  calculateAcademicYear(2024, null);
} catch (error) {
  console.log('Invalid config test passed:', error.message);
}

try {
  calculateAcademicYear(2024, {});
} catch (error) {
  console.log('Missing fields test passed:', error.message);
}

try {
  calculateAcademicYear('invalid', testConfig);
} catch (error) {
  console.log('Invalid batchYear test passed:', error.message);
}

try {
  calculateAcademicYear(2024, testConfig, 'invalid');
} catch (error) {
  console.log('Invalid now parameter test passed:', error.message);
}

console.log('\nCurrent date context:');
console.log('Current year:', new Date().getFullYear());
console.log('Current month:', new Date().getMonth() + 1);
console.log('Adjusted year (start month 6):', (new Date().getMonth() + 1 >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1));
