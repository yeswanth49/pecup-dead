# Comprehensive Testing & Validation Strategy

## Overview

This document outlines a comprehensive testing strategy for the code review implementation, covering security, performance, functionality, and regression testing. The strategy ensures production readiness while maintaining system stability.

## 1. Security Testing Strategy

### 1.1 Authentication & Authorization Testing

#### Role-Based Access Control Tests
```typescript
// tests/security/auth-access.test.ts
describe('Authentication & Authorization Security', () => {
  describe('Role Assignment Security', () => {
    it('should prevent authentication bypass via hardcoded roles', async () => {
      // Given: User with representative role in database
      const testUser = await createTestUser({ role: 'representative' });

      // When: Accessing protected resources
      const response = await apiCall('/api/resources', {
        headers: { authorization: testUser.token }
      });

      // Then: Should have representative permissions
      expect(response.status).toBe(200);
      expect(response.body.resources).toBeDefined();
    });

    it('should enforce role-based restrictions', async () => {
      // Given: Student user
      const studentUser = await createTestUser({ role: 'student' });

      // When: Attempting admin action
      const response = await apiCall('/api/admin/users', {
        headers: { authorization: studentUser.token }
      });

      // Then: Should be forbidden
      expect(response.status).toBe(403);
    });
  });

  describe('Type Safety Security', () => {
    it('should handle malformed database responses safely', async () => {
      // Given: Database returns unexpected data structure
      mockDatabaseResponse({ year: null, branch: undefined });

      // When: API processes the response
      const response = await apiCall('/api/profile');

      // Then: Should not crash and provide safe defaults
      expect(response.status).toBe(200);
      expect(response.body.profile.year).toBe(1); // Safe default
      expect(response.body.profile.branch).toBe(''); // Safe default
    });

    it('should prevent runtime errors from unsafe type assertions', async () => {
      // Given: Nested object with missing properties
      const mockData = {
        year: { batch_year: undefined },
        branch: { code: null }
      };

      // When: Processing data with safe type guards
      const result = processStudentData(mockData);

      // Then: Should handle gracefully
      expect(result).toEqual({
        year: 1,
        branch: '',
        role: 'student'
      });
    });
  });
});
```

#### Input Validation Tests
```typescript
// tests/security/input-validation.test.ts
describe('Input Validation Security', () => {
  it('should prevent SQL injection through email parameter', async () => {
    const maliciousEmail = "admin@example.com' OR '1'='1";

    const response = await apiCall('/api/profile', {
      headers: { authorization: `Bearer ${maliciousEmail}` }
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
  });

  it('should validate all required fields', async () => {
    const invalidPayload = {
      name: '', // Invalid: empty string
      roll_number: 'INVALID123!@#', // Invalid: special chars
      email: 'not-an-email', // Invalid: not email format
    };

    const response = await apiCall('/api/profile', {
      method: 'POST',
      body: JSON.stringify(invalidPayload)
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('validation failed');
  });
});
```

### 1.2 File Storage Security Tests

#### Signed URL Security Tests
```typescript
// tests/security/file-storage.test.ts
describe('File Storage Security', () => {
  describe('Signed URL Generation', () => {
    it('should generate time-limited signed URLs', async () => {
      const resourceId = 'test-resource-123';
      const signedUrl = await generateSignedUrl(resourceId);

      // Verify URL structure
      expect(signedUrl).toContain('supabase.co');
      expect(signedUrl).toContain('token=');

      // Verify expiration
      const token = extractTokenFromUrl(signedUrl);
      const payload = jwt.decode(token);
      expect(payload.exp).toBeLessThan(Date.now() / 1000 + 3700); // < 1 hour
      expect(payload.exp).toBeGreaterThan(Date.now() / 1000 + 3500); // > 58 minutes
    });

    it('should require authentication for file access', async () => {
      const resourceId = 'test-resource-123';

      // When: Accessing without authentication
      const response = await fetch(`/api/files/${resourceId}`);

      // Then: Should require authentication
      expect(response.status).toBe(401);
    });

    it('should enforce permission-based access', async () => {
      const resourceId = 'test-resource-123';
      const studentUser = await createTestUser({ role: 'student' });

      // When: Student tries to access restricted resource
      const response = await apiCall(`/api/files/${resourceId}`, {
        headers: { authorization: studentUser.token }
      });

      // Then: Should be forbidden
      expect(response.status).toBe(403);
    });
  });

  describe('Public Access Prevention', () => {
    it('should not expose files via direct URLs', async () => {
      const resourceId = 'test-resource-123';

      // Attempt direct access to storage URL
      const directUrl = `https://your-project.supabase.co/storage/v1/object/resources/${resourceId}.pdf`;
      const response = await fetch(directUrl);

      // Should be inaccessible
      expect(response.status).toBe(400); // Or 403 depending on bucket policy
    });

    it('should log file access for audit', async () => {
      const resourceId = 'test-resource-123';
      const user = await createTestUser({ role: 'representative' });

      // Access file
      await apiCall(`/api/files/${resourceId}`, {
        headers: { authorization: user.token }
      });

      // Verify audit log
      const logs = await getAuditLogs({
        action: 'file_access',
        resourceId,
        userId: user.id
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toMatchObject({
        action: 'file_access',
        resource_id: resourceId,
        user_id: user.id,
        timestamp: expect.any(String)
      });
    });
  });
});
```

## 2. Performance Testing Strategy

### 2.1 Load Testing

#### API Endpoint Load Tests
```typescript
// tests/performance/load-testing.test.ts
describe('Performance Load Testing', () => {
  describe('Profile API Performance', () => {
    it('should handle 100 concurrent requests within 2 seconds', async () => {
      const promises = Array(100).fill().map(() =>
        apiCall('/api/profile', {
          headers: { authorization: testUser.token }
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      const avgResponseTime = (endTime - startTime) / 100;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Average response time should be under 200ms
      expect(avgResponseTime).toBeLessThan(200);
    });

    it('should maintain performance under sustained load', async () => {
      const results = [];

      // Test for 30 seconds with 10 concurrent users
      for (let i = 0; i < 30; i++) {
        const promises = Array(10).fill().map(() => apiCall('/api/profile'));
        const startTime = Date.now();

        await Promise.all(promises);

        const endTime = Date.now();
        results.push(endTime - startTime);

        // Wait 1 second between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const avgResponseTime = results.reduce((a, b) => a + b, 0) / results.length;
      const maxResponseTime = Math.max(...results);

      console.log(`Average response time: ${avgResponseTime}ms`);
      console.log(`Max response time: ${maxResponseTime}ms`);

      expect(avgResponseTime).toBeLessThan(250);
      expect(maxResponseTime).toBeLessThan(500);
    });
  });

  describe('Database Connection Pool Efficiency', () => {
    it('should not exhaust database connections', async () => {
      // Monitor connection pool usage
      const initialPoolStats = await getConnectionPoolStats();

      // Perform intensive operations
      const promises = Array(50).fill().map(() =>
        apiCall('/api/resources/search', {
          headers: { authorization: testUser.token }
        })
      );

      await Promise.all(promises);

      const finalPoolStats = await getConnectionPoolStats();

      // Connection pool should not be exhausted
      expect(finalPoolStats.used).toBeLessThan(finalPoolStats.available * 0.8);
      expect(finalPoolStats.idle).toBeGreaterThan(0);
    });
  });
});
```

### 2.2 Memory Usage Testing

#### Memory Leak Detection
```typescript
// tests/performance/memory-testing.test.ts
describe('Memory Usage Testing', () => {
  it('should not have memory leaks during sustained operations', async () => {
    const initialMemory = process.memoryUsage();

    // Perform 1000 profile API calls
    for (let i = 0; i < 1000; i++) {
      await apiCall('/api/profile', {
        headers: { authorization: testUser.token }
      });
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage();

    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

    console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);

    // Memory increase should be minimal (< 50MB for 1000 requests)
    expect(memoryIncreaseMB).toBeLessThan(50);
  });

  it('should clean up resources properly', async () => {
    const initialConnections = await getActiveConnections();

    // Create multiple Supabase clients
    const clients = Array(10).fill().map(() => createSupabaseAdmin());

    // Use clients
    await Promise.all(clients.map(client =>
      client.from('students').select('id').limit(1)
    ));

    // Clients should be garbage collected
    // (Note: This is hard to test directly, but we can monitor connection count)

    const finalConnections = await getActiveConnections();

    // Connections should not increase significantly
    expect(finalConnections.length).toBeLessThan(initialConnections.length + 5);
  });
});
```

## 3. Functional Testing Strategy

### 3.1 Unit Testing

#### Type Safety Unit Tests
```typescript
// tests/unit/type-safety.test.ts
describe('Type Safety Unit Tests', () => {
  describe('Student Data Processing', () => {
    it('should safely extract batch year from student data', () => {
      const testCases = [
        { input: { year: { batch_year: 2024 } }, expected: 2024 },
        { input: { year: { batch_year: undefined } }, expected: undefined },
        { input: { year: null }, expected: undefined },
        { input: {}, expected: undefined }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = safeExtractBatchYear(input);
        expect(result).toBe(expected);
      });
    });

    it('should safely extract branch code from student data', () => {
      const testCases = [
        { input: { branch: { code: 'CSE' } }, expected: 'CSE' },
        { input: { branch: { code: null } }, expected: '' },
        { input: { branch: undefined }, expected: '' },
        { input: {}, expected: '' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = safeExtractBranchCode(input);
        expect(result).toBe(expected);
      });
    });

    it('should calculate academic year correctly', () => {
      const testCases = [
        { batchYear: 2024, currentYear: 2024, expected: 1 },
        { batchYear: 2023, currentYear: 2024, expected: 2 },
        { batchYear: 2022, currentYear: 2024, expected: 3 },
        { batchYear: 2021, currentYear: 2024, expected: 4 }
      ];

      testCases.forEach(({ batchYear, currentYear, expected }) => {
        const result = calculateAcademicYear(batchYear, currentYear);
        expect(result).toBe(expected);
      });
    });
  });
});
```

#### Permission System Unit Tests
```typescript
// tests/unit/permissions.test.ts
describe('Permission System Unit Tests', () => {
  describe('User Context Creation', () => {
    it('should create correct user context from database data', () => {
      const mockStudentData = {
        id: '123',
        email: 'student@example.com',
        name: 'John Doe',
        role: 'representative',
        branch_id: 'branch-123',
        year_id: 'year-123',
        branch: { code: 'CSE' },
        year: { batch_year: 2023 }
      };

      const context = createUserContext(mockStudentData);

      expect(context).toEqual({
        id: '123',
        email: 'student@example.com',
        name: 'John Doe',
        role: 'representative',
        branch: 'CSE',
        branchId: 'branch-123',
        yearId: 'year-123',
        year: 2 // 2023 batch in 2024 = 2nd year
      });
    });

    it('should handle missing role with safe fallback', () => {
      const mockStudentData = {
        id: '123',
        email: 'student@example.com',
        name: 'John Doe',
        role: null, // Missing role
        branch: { code: 'CSE' },
        year: { batch_year: 2023 }
      };

      const context = createUserContext(mockStudentData);

      expect(context.role).toBe('student'); // Safe fallback
    });
  });

  describe('Permission Calculation', () => {
    it('should grant correct permissions to representatives', () => {
      const representativeContext = {
        role: 'representative' as UserRole,
        representatives: [
          { branch_id: 'branch-123', year_id: 'year-123', active: true }
        ]
      };

      const permissions = getUserPermissions(representativeContext);

      expect(permissions.canWrite.resources).toBe(true);
      expect(permissions.canWrite.reminders).toBe(true);
      expect(permissions.canPromoteSemester).toBe(true);
    });

    it('should restrict permissions for students', () => {
      const studentContext = {
        role: 'student' as UserRole
      };

      const permissions = getUserPermissions(studentContext);

      expect(permissions.canWrite.resources).toBe(false);
      expect(permissions.canWrite.reminders).toBe(false);
      expect(permissions.canPromoteSemester).toBe(false);
    });
  });
});
```

### 3.2 Integration Testing

#### End-to-End API Testing
```typescript
// tests/integration/api-integration.test.ts
describe('API Integration Testing', () => {
  describe('Profile Management Flow', () => {
    it('should complete full profile update cycle', async () => {
      // 1. Create test user
      const testUser = await createTestUser({
        role: 'student',
        branch: 'CSE',
        batchYear: 2024
      });

      // 2. Get initial profile
      const initialResponse = await apiCall('/api/profile', {
        headers: { authorization: testUser.token }
      });

      expect(initialResponse.status).toBe(200);
      expect(initialResponse.body.profile.role).toBe('student');
      expect(initialResponse.body.profile.year).toBe(1); // 2024 batch = 1st year

      // 3. Update profile
      const updatePayload = {
        name: 'Updated Name',
        roll_number: 'CSE001',
        branch_id: testUser.branchId,
        year_id: testUser.yearId,
        semester_id: testUser.semesterId
      };

      const updateResponse = await apiCall('/api/profile', {
        method: 'POST',
        headers: {
          authorization: testUser.token,
          'content-type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      expect(updateResponse.status).toBe(200);

      // 4. Verify update
      const verifyResponse = await apiCall('/api/profile', {
        headers: { authorization: testUser.token }
      });

      expect(verifyResponse.body.profile.name).toBe('Updated Name');
      expect(verifyResponse.body.profile.roll_number).toBe('CSE001');
    });

    it('should handle concurrent profile updates safely', async () => {
      const testUser = await createTestUser();

      // Attempt concurrent updates
      const promises = Array(5).fill().map((_, i) =>
        apiCall('/api/profile', {
          method: 'POST',
          headers: {
            authorization: testUser.token,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            name: `Concurrent Update ${i}`,
            roll_number: `ROLL${i}`,
            branch_id: testUser.branchId,
            year_id: testUser.yearId,
            semester_id: testUser.semesterId
          })
        })
      );

      const results = await Promise.allSettled(promises);

      // At least one should succeed, others may fail due to constraints
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 200);
      expect(successful.length).toBeGreaterThan(0);

      // Verify final state is consistent
      const finalResponse = await apiCall('/api/profile', {
        headers: { authorization: testUser.token }
      });

      expect(finalResponse.status).toBe(200);
      expect(finalResponse.body.profile).toBeDefined();
    });
  });
});
```

## 4. Regression Testing Strategy

### 4.1 Automated Regression Tests

#### Critical Path Testing
```typescript
// tests/regression/critical-paths.test.ts
describe('Critical Path Regression Tests', () => {
  describe('Authentication Flow', () => {
    it('should maintain login functionality', async () => {
      // Test NextAuth integration
      const loginResponse = await request(app)
        .post('/api/auth/signin/google')
        .send({ email: 'test@example.com' });

      expect(loginResponse.status).not.toBe(500);
    });

    it('should preserve session management', async () => {
      const agent = request.agent(app);

      // Login
      await agent
        .post('/api/auth/signin/google')
        .send({ email: 'test@example.com' });

      // Access protected route
      const profileResponse = await agent.get('/api/profile');

      expect(profileResponse.status).toBe(200);
    });
  });

  describe('Database Operations', () => {
    it('should handle database connection failures gracefully', async () => {
      // Mock database connection failure
      mockDatabaseConnection('error');

      const response = await apiCall('/api/profile');

      // Should return proper error response
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).not.toContain('undefined');
    });

    it('should maintain data integrity during failures', async () => {
      const initialCount = await getStudentCount();

      // Attempt operation that will fail
      mockDatabaseError('unique_violation');

      const response = await apiCall('/api/students', {
        method: 'POST',
        body: JSON.stringify({ /* duplicate data */ })
      });

      expect(response.status).toBe(400);

      // Verify no data corruption
      const finalCount = await getStudentCount();
      expect(finalCount).toBe(initialCount);
    });
  });

  describe('File Operations', () => {
    it('should maintain file upload functionality', async () => {
      const testFile = createTestFile('test.pdf', 'application/pdf');

      const response = await apiCall('/api/uploadResource', {
        method: 'POST',
        headers: {
          'content-type': 'multipart/form-data'
        },
        body: testFile
      });

      expect(response.status).toBe(200);
      expect(response.body.url).toBeDefined();
    });

    it('should preserve existing file access patterns', async () => {
      // Test legacy URL formats still work during transition
      const legacyUrl = 'https://drive.google.com/file/d/123/view';
      const response = await apiCall(`/api/files/legacy?url=${encodeURIComponent(legacyUrl)}`);

      // Should either work or provide clear migration path
      expect([200, 301, 302]).toContain(response.status);
    });
  });
});
```

### 4.2 Performance Regression Tests

#### Baseline Performance Tests
```typescript
// tests/regression/performance-baseline.test.ts
describe('Performance Regression Tests', () => {
  const PERFORMANCE_BASELINES = {
    '/api/profile': { avg: 150, p95: 300 },
    '/api/resources': { avg: 200, p95: 500 },
    '/api/uploadResource': { avg: 1000, p95: 3000 }
  };

  Object.entries(PERFORMANCE_BASELINES).forEach(([endpoint, baseline]) => {
    it(`should maintain performance baseline for ${endpoint}`, async () => {
      const results = [];

      // Run 10 requests to get average
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        const response = await apiCall(endpoint);
        const endTime = Date.now();

        results.push(endTime - startTime);
      }

      const avgResponseTime = results.reduce((a, b) => a + b, 0) / results.length;
      const p95ResponseTime = results.sort((a, b) => a - b)[Math.floor(results.length * 0.95)];

      console.log(`${endpoint} - Avg: ${avgResponseTime}ms, P95: ${p95ResponseTime}ms`);

      // Allow 20% degradation from baseline
      expect(avgResponseTime).toBeLessThan(baseline.avg * 1.2);
      expect(p95ResponseTime).toBeLessThan(baseline.p95 * 1.2);
    });
  });
});
```

## 5. Test Execution & Reporting

### 5.1 Test Automation

#### CI/CD Pipeline Integration
```yaml
# .github/workflows/comprehensive-testing.yml
name: Comprehensive Testing
on: [push, pull_request]

jobs:
  security-testing:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Security Tests
        run: npm test -- --testPathPattern=security
      - name: Run SAST
        uses: github/super-linter/slim@v4
      - name: Dependency Check
        uses: dependency-check/Dependency-Check_Action@main

  performance-testing:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Performance Tests
        run: npm test -- --testPathPattern=performance
      - name: Generate Performance Report
        run: npm run performance-report

  integration-testing:
    runs-on: ubuntu-latest
    services:
      - postgres:
          image: supabase/postgres:15.1.0.147
          env:
            POSTGRES_PASSWORD: postgres
      - redis:
          image: redis:7-alpine
    steps:
      - uses: actions/checkout@v3
      - name: Run Integration Tests
        run: npm test -- --testPathPattern=integration
      - name: Generate Coverage Report
        run: npm run coverage

  regression-testing:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Regression Tests
        run: npm test -- --testPathPattern=regression
```

### 5.2 Test Reporting & Monitoring

#### Test Results Dashboard
```typescript
// scripts/generate-test-report.ts
import { promises as fs } from 'fs';

interface TestResults {
  security: TestSuiteResult;
  performance: TestSuiteResult;
  integration: TestSuiteResult;
  regression: TestSuiteResult;
}

interface TestSuiteResult {
  passed: number;
  failed: number;
  total: number;
  duration: number;
  coverage?: number;
}

async function generateTestReport(results: TestResults): Promise<void> {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: Object.values(results).reduce((sum, suite) => sum + suite.total, 0),
      totalPassed: Object.values(results).reduce((sum, suite) => sum + suite.passed, 0),
      totalFailed: Object.values(results).reduce((sum, suite) => sum + suite.failed, 0),
      overallSuccess: 0
    },
    suites: results
  };

  report.summary.overallSuccess =
    (report.summary.totalPassed / report.summary.totalTests) * 100;

  await fs.writeFile(
    'test-results.json',
    JSON.stringify(report, null, 2)
  );

  // Generate HTML report
  const htmlReport = generateHTMLReport(report);
  await fs.writeFile('test-report.html', htmlReport);

  console.log(`Test Report Generated:`);
  console.log(`- Overall Success: ${report.summary.overallSuccess.toFixed(2)}%`);
  console.log(`- Total Tests: ${report.summary.totalTests}`);
  console.log(`- Passed: ${report.summary.totalPassed}`);
  console.log(`- Failed: ${report.summary.totalFailed}`);
}

function generateHTMLReport(report: any): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Test Results Report</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      .summary { background: #f0f0f0; padding: 20px; border-radius: 5px; }
      .suite { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
      .passed { color: green; }
      .failed { color: red; }
    </style>
  </head>
  <body>
    <h1>Test Results Report</h1>
    <div class="summary">
      <h2>Summary</h2>
      <p><strong>Overall Success:</strong> <span class="${report.summary.overallSuccess > 95 ? 'passed' : 'failed'}">${report.summary.overallSuccess.toFixed(2)}%</span></p>
      <p><strong>Total Tests:</strong> ${report.summary.totalTests}</p>
      <p><strong>Passed:</strong> <span class="passed">${report.summary.totalPassed}</span></p>
      <p><strong>Failed:</strong> <span class="failed">${report.summary.totalFailed}</span></p>
    </div>
    ${Object.entries(report.suites).map(([suiteName, suite]) => `
      <div class="suite">
        <h3>${suiteName.charAt(0).toUpperCase() + suiteName.slice(1)} Tests</h3>
        <p>Passed: <span class="passed">${suite.passed}</span> / ${suite.total}</p>
        <p>Duration: ${suite.duration}ms</p>
        ${suite.coverage ? `<p>Coverage: ${suite.coverage}%</p>` : ''}
      </div>
    `).join('')}
  </body>
  </html>
  `;
}
```

### 5.3 Quality Gates

#### Automated Quality Checks
```typescript
// scripts/quality-gate.ts
interface QualityGate {
  name: string;
  check: () => Promise<boolean>;
  description: string;
  severity: 'error' | 'warning';
}

const QUALITY_GATES: QualityGate[] = [
  {
    name: 'TypeScript Compilation',
    check: async () => {
      const result = await exec('npx tsc --noEmit');
      return result.exitCode === 0;
    },
    description: 'All TypeScript files must compile without errors',
    severity: 'error'
  },
  {
    name: 'Security Tests',
    check: async () => {
      const result = await exec('npm test -- --testPathPattern=security');
      return result.exitCode === 0;
    },
    description: 'All security tests must pass',
    severity: 'error'
  },
  {
    name: 'Test Coverage',
    check: async () => {
      const result = await exec('npm run coverage');
      const coverage = parseCoverageResult(result.stdout);
      return coverage > 90;
    },
    description: 'Test coverage must be above 90%',
    severity: 'warning'
  },
  {
    name: 'Performance Baseline',
    check: async () => {
      const result = await exec('npm test -- --testPathPattern=performance-baseline');
      return result.exitCode === 0;
    },
    description: 'Performance must not regress below baseline',
    severity: 'warning'
  },
  {
    name: 'ESLint Compliance',
    check: async () => {
      const result = await exec('npx eslint .');
      return result.exitCode === 0;
    },
    description: 'Code must pass ESLint checks',
    severity: 'error'
  },
  {
    name: 'Dependency Security',
    check: async () => {
      const result = await exec('npm audit --audit-level moderate');
      return result.exitCode === 0;
    },
    description: 'Dependencies must not have high or critical vulnerabilities',
    severity: 'error'
  }
];

async function runQualityGates(): Promise<void> {
  console.log('Running Quality Gates...\n');

  let hasErrors = false;
  let hasWarnings = false;

  for (const gate of QUALITY_GATES) {
    try {
      const passed = await gate.check();

      if (passed) {
        console.log(`✅ ${gate.name}: PASSED`);
      } else {
        if (gate.severity === 'error') {
          console.log(`❌ ${gate.name}: FAILED (${gate.description})`);
          hasErrors = true;
        } else {
          console.log(`⚠️  ${gate.name}: WARNING (${gate.description})`);
          hasWarnings = true;
        }
      }
    } catch (error) {
      console.log(`❌ ${gate.name}: ERROR - ${error.message}`);
      if (gate.severity === 'error') {
        hasErrors = true;
      }
    }
  }

  console.log('\nQuality Gate Results:');
  if (hasErrors) {
    console.log('❌ BLOCKED: Critical issues must be resolved before deployment');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  WARNINGS: Review warnings before deployment');
    process.exit(0);
  } else {
    console.log('✅ PASSED: All quality gates passed');
    process.exit(0);
  }
}
```

## 6. Test Environment Setup

### 6.1 Test Data Management

#### Test Database Setup
```sql
-- scripts/setup-test-database.sql
-- Create test database with sample data
CREATE DATABASE pecup_test;

-- Switch to test database
\c pecup_test;

-- Create test schema
\i scripts/create-tables.sql;

-- Insert test data
INSERT INTO branches (id, name, code) VALUES
  ('test-branch-1', 'Computer Science', 'CSE'),
  ('test-branch-2', 'Information Technology', 'IT');

INSERT INTO years (id, batch_year, display_name) VALUES
  ('test-year-1', 2024, '2024-25 Batch'),
  ('test-year-2', 2023, '2023-24 Batch');

INSERT INTO semesters (id, semester_number, year_id) VALUES
  ('test-sem-1', 1, 'test-year-1'),
  ('test-sem-2', 2, 'test-year-1');

-- Create test users
INSERT INTO students (id, email, name, roll_number, branch_id, year_id, semester_id, role) VALUES
  ('test-student-1', 'student@example.com', 'Test Student', 'CSE001', 'test-branch-1', 'test-year-1', 'test-sem-1', 'student'),
  ('test-representative-1', 'rep@example.com', 'Test Representative', 'CSE002', 'test-branch-1', 'test-year-1', 'test-sem-1', 'representative'),
  ('test-admin-1', 'admin@example.com', 'Test Admin', 'CSE003', 'test-branch-1', 'test-year-1', 'test-sem-1', 'admin');
```

#### Test Helper Functions
```typescript
// tests/helpers/test-helpers.ts
import { createSupabaseAdmin } from '@/lib/supabase';

export interface TestUser {
  id: string;
  email: string;
  token: string;
  role: UserRole;
  branchId: string;
  yearId: string;
  semesterId: string;
}

export async function createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const supabase = createSupabaseAdmin();

  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    roll_number: 'TEST001',
    branch_id: 'test-branch-1',
    year_id: 'test-year-1',
    semester_id: 'test-sem-1',
    role: 'student' as UserRole
  };

  const userData = { ...defaultUser, ...overrides };

  const { data, error } = await supabase
    .from('students')
    .insert(userData)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    email: data.email,
    token: generateTestToken(data),
    role: data.role,
    branchId: data.branch_id,
    yearId: data.year_id,
    semesterId: data.semester_id
  };
}

export async function cleanupTestData(): Promise<void> {
  const supabase = createSupabaseAdmin();

  // Clean up test data
  await supabase.from('students').delete().ilike('email', 'test-%');
  await supabase.from('resources').delete().ilike('title', 'test-%');
}

export function generateTestToken(user: any): string {
  // Generate a test JWT token for authentication
  const payload = {
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
  };

  return jwt.sign(payload, process.env.TEST_JWT_SECRET || 'test-secret');
}
```

### 6.2 Test Configuration

#### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'app/**/*.ts',
    'lib/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  maxWorkers: 4
};
```

#### Test Setup File
```typescript
// tests/setup.ts
import { cleanupTestData } from './helpers/test-helpers';

// Global test setup
beforeAll(async () => {
  // Set up test environment
  process.env.NODE_ENV = 'test';
  process.env.NEXTAUTH_SECRET = 'test-secret';
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
});

// Clean up after each test
afterEach(async () => {
  await cleanupTestData();
});

// Global test teardown
afterAll(async () => {
  // Clean up any remaining test data
  await cleanupTestData();
});
```

This comprehensive testing strategy ensures that all security vulnerabilities are addressed, performance is maintained, and the application remains stable during and after the implementation of the code review fixes. The strategy includes automated testing, performance monitoring, and quality gates to prevent future regressions.
