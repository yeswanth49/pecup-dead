# Proactive Detection & Quality Gates

## Overview

This document establishes automated detection mechanisms and quality gates to prevent the recurrence of the identified security vulnerabilities, performance issues, and code quality problems. The system implements multiple layers of protection at development, build, and deployment stages.

## 1. ESLint Custom Rules

### 1.1 Installation & Setup

#### ESLint Configuration
```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'next/core-web-vitals',
    '@next/eslint-config-next'
  ],
  plugins: ['@typescript-eslint', 'security', 'performance'],
  rules: {
    // Disable problematic rules
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',

    // Custom security rules
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-object-injection': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudo-random-bytes': 'error',

    // Custom performance rules
    'performance/no-delete': 'warn',
    'performance/no-nested-loops': 'warn',

    // Custom rules for identified patterns
    'no-hardcoded-role': 'error',
    'no-unsafe-type-assertion': 'error',
    'no-unused-supabase-client': 'warn',
    'no-google-drive-public-links': 'error',
    'require-role-in-query': 'error'
  }
};
```

#### Custom ESLint Rules Implementation
```javascript
// eslint-rules/index.js
module.exports = {
  'no-hardcoded-role': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Prevent hardcoded role assignments',
        category: 'Security',
        recommended: true
      },
      fixable: null,
      schema: []
    },
    create: function(context) {
      return {
        Property(node) {
          if (node.key.name === 'role' &&
              node.value.type === 'Literal' &&
              ['student', 'representative', 'admin', 'superadmin'].includes(node.value.value)) {
            context.report({
              node,
              message: 'Avoid hardcoded role assignments. Use database values instead.'
            });
          }
        }
      };
    }
  },

  'no-unsafe-type-assertion': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Prevent unsafe type assertions',
        category: 'Type Safety',
        recommended: true
      },
      fixable: null,
      schema: []
    },
    create: function(context) {
      return {
        TSAsExpression(node) {
          if (node.typeAnnotation.type === 'TSAnyKeyword') {
            context.report({
              node,
              message: 'Avoid "as any" type assertions. Use proper type guards instead.'
            });
          }
        }
      };
    }
  },

  'no-unused-supabase-client': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Prevent unused Supabase client creation',
        category: 'Performance',
        recommended: true
      },
      fixable: null,
      schema: []
    },
    create: function(context) {
      let supabaseImports = [];
      let supabaseVariables = [];

      return {
        ImportDeclaration(node) {
          if (node.source.value.includes('supabase')) {
            node.specifiers.forEach(specifier => {
              if (specifier.imported.name === 'createSupabaseAdmin') {
                supabaseImports.push(specifier.local.name);
              }
            });
          }
        },

        VariableDeclaration(node) {
          node.declarations.forEach(declaration => {
            if (declaration.init &&
                declaration.init.callee &&
                supabaseImports.includes(declaration.init.callee.name)) {
              supabaseVariables.push(declaration.id.name);
            }
          });
        },

        'Program:exit': function() {
          supabaseVariables.forEach(variable => {
            const scope = context.getScope();
            const variableInScope = scope.variables.find(v => v.name === variable);

            if (variableInScope && variableInScope.references.length === 0) {
              context.report({
                node: variableInScope.identifiers[0],
                message: 'Unused Supabase client creation detected.'
              });
            }
          });
        }
      };
    }
  },

  'no-google-drive-public-links': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Prevent public Google Drive links',
        category: 'Security',
        recommended: true
      },
      fixable: null,
      schema: []
    },
    create: function(context) {
      return {
        Literal(node) {
          if (typeof node.value === 'string' &&
              node.value.includes('drive.google.com') &&
              node.value.includes('usp=sharing')) {
            context.report({
              node,
              message: 'Avoid public Google Drive links. Use signed URLs instead.'
            });
          }
        }
      };
    }
  },

  'require-role-in-query': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Require role field in student queries',
        category: 'Security',
        recommended: true
      },
      fixable: null,
      schema: []
    },
    create: function(context) {
      let inSelectQuery = false;
      let hasRoleField = false;

      return {
        CallExpression(node) {
          if (node.callee.type === 'MemberExpression' &&
              node.callee.property.name === 'select') {
            inSelectQuery = true;
            hasRoleField = false;
          }
        },

        Literal(node) {
          if (inSelectQuery && node.value === 'role') {
            hasRoleField = true;
          }
        },

        'CallExpression:exit': function(node) {
          if (inSelectQuery &&
              node.callee.type === 'MemberExpression' &&
              node.callee.property.name === 'select' &&
              !hasRoleField) {
            context.report({
              node,
              message: 'Student SELECT queries must include the role field.'
            });
          }
          inSelectQuery = false;
          hasRoleField = false;
        }
      };
    }
  }
};
```

### 1.2 Rule Testing
```typescript
// tests/eslint-rules.test.ts
describe('Custom ESLint Rules', () => {
  describe('no-hardcoded-role', () => {
    it('should detect hardcoded role assignments', () => {
      const code = `
        const user = {
          role: 'student' // ❌ Should trigger
        };
      `;

      const violations = lintCode(code, 'no-hardcoded-role');
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('hardcoded role');
    });

    it('should allow dynamic role assignments', () => {
      const code = `
        const user = {
          role: userFromDb.role // ✅ Should pass
        };
      `;

      const violations = lintCode(code, 'no-hardcoded-role');
      expect(violations).toHaveLength(0);
    });
  });

  describe('no-unsafe-type-assertion', () => {
    it('should detect unsafe type assertions', () => {
      const code = `
        const data = response as any; // ❌ Should trigger
      `;

      const violations = lintCode(code, 'no-unsafe-type-assertion');
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('as any');
    });
  });
});
```

## 2. Pre-commit Hooks

### 2.1 Git Hooks Setup

#### Pre-commit Hook Installation
```bash
#!/bin/sh
# .git/hooks/pre-commit

echo "🔍 Running pre-commit quality checks..."

# Change to project root
cd "$(dirname "$0")/../.."

# Run ESLint
echo "Running ESLint..."
if ! npx eslint . --ext .ts,.tsx --max-warnings 0; then
  echo "❌ ESLint failed. Please fix the issues before committing."
  exit 1
fi

# Run TypeScript compiler
echo "Running TypeScript compiler..."
if ! npx tsc --noEmit; then
  echo "❌ TypeScript compilation failed. Please fix type errors."
  exit 1
fi

# Check for unsafe patterns
echo "Checking for unsafe patterns..."
if git diff --cached --name-only | xargs grep -l "as any"; then
  echo "❌ Found unsafe 'as any' type assertions. Please use proper typing."
  exit 1
fi

if git diff --cached --name-only | xargs grep -l "role.*student.*as const"; then
  echo "❌ Found hardcoded role assignments. Please use database values."
  exit 1
fi

# Run security tests
echo "Running security tests..."
if ! npm test -- --testPathPattern=security --watchAll=false; then
  echo "❌ Security tests failed. Please fix security issues."
  exit 1
fi

echo "✅ All pre-commit checks passed!"
```

#### Pre-push Hook
```bash
#!/bin/sh
# .git/hooks/pre-push

echo "🚀 Running pre-push validation..."

# Run performance tests
echo "Running performance tests..."
if ! npm test -- --testPathPattern=performance-baseline --watchAll=false; then
  echo "❌ Performance regression detected. Please optimize before pushing."
  exit 1
fi

# Check bundle size
echo "Checking bundle size..."
if ! npx next build --analyze; then
  echo "❌ Bundle analysis failed."
  exit 1
fi

echo "✅ Pre-push validation passed!"
```

### 2.2 Hook Installation Script
```bash
#!/bin/bash
# scripts/install-hooks.sh

echo "Installing Git hooks..."

# Make hooks executable
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/pre-push

# Install husky for better hook management
npx husky install

# Set up husky hooks
npx husky add .husky/pre-commit "npm run pre-commit"
npx husky add .husky/pre-push "npm run pre-push"

echo "✅ Git hooks installed successfully!"
```

## 3. CI/CD Quality Gates

### 3.1 GitHub Actions Pipeline

#### Security Quality Gate
```yaml
# .github/workflows/security-quality-gate.yml
name: Security Quality Gate
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
      actions: read

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint security rules
        run: |
          npx eslint . --ext .ts,.tsx --no-eslintrc --config .eslintrc.security.js

      - name: Run TypeScript type checking
        run: npx tsc --noEmit --strict

      - name: Run security tests
        run: npm test -- --testPathPattern=security --coverage --watchAll=false

      - name: Run SAST (Static Application Security Testing)
        uses: github/super-linter/slim@v4
        env:
          DEFAULT_BRANCH: main
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          VALIDATE_ALL_CODEBASE: false
          VALIDATE_JAVASCRIPT_ES: true
          VALIDATE_TYPESCRIPT_ES: true

      - name: Run dependency vulnerability scan
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'pecup-dead'
          path: '.'
          format: 'ALL'
          args: >
            --enableRetired
            --enableExperimental
            --nvdValidForHours 24

      - name: Upload security scan results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: reports/dependency-check-report.sarif
```

#### Performance Quality Gate
```yaml
# .github/workflows/performance-quality-gate.yml
name: Performance Quality Gate
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  performance-test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: supabase/postgres:15.1.0.147
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup test database
        run: |
          npm run db:test:setup
          npm run db:test:migrate

      - name: Run performance tests
        run: npm test -- --testPathPattern=performance --watchAll=false

      - name: Generate performance report
        run: npm run performance-report

      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: performance-report.json

      - name: Check performance regression
        run: |
          node scripts/check-performance-regression.js

      - name: Bundle size analysis
        run: |
          npx next build --analyze
          npx next-bundle-analyzer

      - name: Performance regression check
        run: |
          if [ -f performance-regression-alert.json ]; then
            echo "❌ Performance regression detected!"
            cat performance-regression-alert.json
            exit 1
          else
            echo "✅ No performance regression detected"
          fi
```

#### Code Quality Gate
```yaml
# .github/workflows/code-quality-gate.yml
name: Code Quality Gate
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality-check:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npx eslint . --ext .ts,.tsx --max-warnings 0

      - name: Run TypeScript compiler
        run: npx tsc --noEmit --strict

      - name: Check test coverage
        run: npm run test:coverage

      - name: Run unit tests
        run: npm test -- --watchAll=false --coverage

      - name: Check bundle size
        run: npx next build --analyze

      - name: Check for unused dependencies
        run: npx depcheck

      - name: Check for circular dependencies
        run: npx dpdm --exit-code circular:1 src/

      - name: Generate quality report
        run: |
          node scripts/generate-quality-report.js

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella

      - name: Quality gate check
        run: |
          node scripts/quality-gate.js
```

### 3.2 Quality Gate Scripts

#### Quality Gate Checker
```javascript
// scripts/quality-gate.js
const fs = require('fs');
const path = require('path');

const QUALITY_THRESHOLDS = {
  coverage: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  },
  performance: {
    maxResponseTime: 500, // ms
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    maxBundleSize: 1024 * 1024 // 1MB
  },
  security: {
    maxVulnerabilities: 0,
    maxWarnings: 0
  }
};

async function checkQualityGate() {
  console.log('🔍 Running Quality Gate Checks...\n');

  let allPassed = true;
  const results = {};

  // Check test coverage
  try {
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
    if (fs.existsSync(coveragePath)) {
      const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      const coverageResults = {};

      for (const [file, metrics] of Object.entries(coverage)) {
        coverageResults[file] = {
          branches: metrics.branches.pct,
          functions: metrics.functions.pct,
          lines: metrics.lines.pct,
          statements: metrics.statements.pct
        };

        // Check if coverage meets thresholds
        const failed = Object.entries(QUALITY_THRESHOLDS.coverage).some(([metric, threshold]) => {
          return metrics[metric].pct < threshold;
        });

        if (failed) {
          allPassed = false;
          console.log(`❌ Coverage check failed for ${file}`);
        }
      }

      results.coverage = coverageResults;
      console.log('✅ Coverage check completed');
    }
  } catch (error) {
    console.log('❌ Coverage check failed:', error.message);
    allPassed = false;
  }

  // Check performance metrics
  try {
    const perfPath = path.join(process.cwd(), 'performance-results.json');
    if (fs.existsSync(perfPath)) {
      const performance = JSON.parse(fs.readFileSync(perfPath, 'utf8'));

      if (performance.avgResponseTime > QUALITY_THRESHOLDS.performance.maxResponseTime) {
        console.log(`❌ Performance check failed: Average response time ${performance.avgResponseTime}ms exceeds threshold`);
        allPassed = false;
      }

      if (performance.memoryUsage > QUALITY_THRESHOLDS.performance.maxMemoryUsage) {
        console.log(`❌ Performance check failed: Memory usage ${performance.memoryUsage}MB exceeds threshold`);
        allPassed = false;
      }

      results.performance = performance;
      console.log('✅ Performance check completed');
    }
  } catch (error) {
    console.log('❌ Performance check failed:', error.message);
    allPassed = false;
  }

  // Check bundle size
  try {
    const { execSync } = require('child_process');
    const bundleStats = execSync('npx next build --analyze', { encoding: 'utf8' });

    // Parse bundle stats (simplified)
    const bundleSizeMatch = bundleStats.match(/main\.js\s+(\d+(\.\d+)?)\s+kB/);
    if (bundleSizeMatch) {
      const bundleSizeKB = parseFloat(bundleSizeMatch[1]);
      if (bundleSizeKB > QUALITY_THRESHOLDS.performance.maxBundleSize / 1024) {
        console.log(`❌ Bundle size check failed: ${bundleSizeKB}KB exceeds threshold`);
        allPassed = false;
      }
      results.bundleSize = bundleSizeKB;
      console.log('✅ Bundle size check completed');
    }
  } catch (error) {
    console.log('❌ Bundle size check failed:', error.message);
    allPassed = false;
  }

  // Save results
  fs.writeFileSync('quality-gate-results.json', JSON.stringify(results, null, 2));

  if (allPassed) {
    console.log('\n🎉 All quality gates passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Quality gate checks failed. Please review and fix issues.');
    process.exit(1);
  }
}

checkQualityGate().catch(console.error);
```

#### Performance Regression Checker
```javascript
// scripts/check-performance-regression.js
const fs = require('fs');
const path = require('path');

const BASELINE_FILE = 'performance-baseline.json';
const CURRENT_FILE = 'performance-results.json';
const REGRESSION_THRESHOLD = 0.1; // 10% regression threshold

function loadJSON(file) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function calculateRegression(baseline, current) {
  const regressions = {};

  for (const [metric, baselineValue] of Object.entries(baseline)) {
    const currentValue = current[metric];
    if (currentValue && baselineValue) {
      const change = (currentValue - baselineValue) / baselineValue;
      if (change > REGRESSION_THRESHOLD) {
        regressions[metric] = {
          baseline: baselineValue,
          current: currentValue,
          change: change,
          percentage: (change * 100).toFixed(2) + '%'
        };
      }
    }
  }

  return regressions;
}

function main() {
  try {
    console.log('🔍 Checking for performance regression...');

    const baseline = loadJSON(BASELINE_FILE);
    const current = loadJSON(CURRENT_FILE);

    const regressions = calculateRegression(baseline, current);

    if (Object.keys(regressions).length > 0) {
      console.log('❌ Performance regression detected:');

      const alertData = {
        timestamp: new Date().toISOString(),
        regressions,
        baseline,
        current
      };

      fs.writeFileSync('performance-regression-alert.json', JSON.stringify(alertData, null, 2));

      Object.entries(regressions).forEach(([metric, data]) => {
        console.log(`  - ${metric}: ${data.baseline} → ${data.current} (${data.percentage} increase)`);
      });

      process.exit(1);
    } else {
      console.log('✅ No performance regression detected');
    }
  } catch (error) {
    console.error('❌ Error checking performance regression:', error.message);
    process.exit(1);
  }
}

main();
```

## 4. Automated Monitoring & Alerting

### 4.1 Production Monitoring

#### Application Performance Monitoring
```typescript
// lib/monitoring.ts
import * as Sentry from '@sentry/nextjs';

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface SecurityEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  userId?: string;
  metadata?: Record<string, any>;
}

class MonitoringService {
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS_BUFFER = 1000;

  constructor() {
    // Initialize Sentry
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 1.0,
      environment: process.env.NODE_ENV,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Console(),
        new Sentry.Integrations.OnUncaughtException(),
        new Sentry.Integrations.OnUnhandledRejection()
      ]
    });
  }

  // Performance monitoring
  recordMetric(name: string, value: number, tags?: Record<string, string>) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: new Date(),
      tags
    };

    this.metrics.push(metric);

    // Keep buffer size manageable
    if (this.metrics.length > this.MAX_METRICS_BUFFER) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_BUFFER);
    }

    // Send to monitoring service
    this.sendMetricToMonitoring(metric);
  }

  startTimer(name: string, tags?: Record<string, string>) {
    const startTime = Date.now();
    return {
      end: () => {
        const duration = Date.now() - startTime;
        this.recordMetric(`${name}.duration`, duration, tags);
        return duration;
      }
    };
  }

  // Security event logging
  logSecurityEvent(event: SecurityEvent) {
    const severity = event.severity.toUpperCase();

    // Log to console with appropriate level
    const logMessage = `[SECURITY ${severity}] ${event.message}`;
    if (event.severity === 'critical' || event.severity === 'high') {
      console.error(logMessage);
    } else {
      console.warn(logMessage);
    }

    // Send to Sentry
    Sentry.withScope((scope) => {
      scope.setLevel(event.severity === 'critical' || event.severity === 'high' ? 'error' : 'warning');
      scope.setTag('security_event_type', event.type);
      if (event.userId) {
        scope.setUser({ id: event.userId });
      }
      if (event.metadata) {
        Object.entries(event.metadata).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
      Sentry.captureMessage(logMessage);
    });

    // Send to security monitoring service
    this.sendSecurityEvent(event);
  }

  // Error tracking
  trackError(error: Error, context?: Record<string, any>) {
    Sentry.withScope((scope) => {
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
      Sentry.captureException(error);
    });
  }

  // Database query monitoring
  monitorDatabaseQuery(query: string, duration: number, success: boolean) {
    this.recordMetric('db.query.duration', duration, {
      success: success.toString(),
      query_type: query.split(' ')[0].toLowerCase()
    });

    if (duration > 1000) { // Log slow queries
      console.warn(`Slow database query (${duration}ms): ${query}`);
    }
  }

  private async sendMetricToMonitoring(metric: PerformanceMetric) {
    // Send to external monitoring service (e.g., DataDog, New Relic)
    if (process.env.MONITORING_ENDPOINT) {
      try {
        await fetch(process.env.MONITORING_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MONITORING_TOKEN}`
          },
          body: JSON.stringify(metric)
        });
      } catch (error) {
        console.error('Failed to send metric to monitoring service:', error);
      }
    }
  }

  private async sendSecurityEvent(event: SecurityEvent) {
    // Send to security monitoring service
    if (process.env.SECURITY_MONITORING_ENDPOINT) {
      try {
        await fetch(process.env.SECURITY_MONITORING_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SECURITY_MONITORING_TOKEN}`
          },
          body: JSON.stringify(event)
        });
      } catch (error) {
        console.error('Failed to send security event:', error);
      }
    }
  }

  // Get metrics summary
  getMetricsSummary() {
    const summary = {
      total: this.metrics.length,
      averageResponseTime: 0,
      maxResponseTime: 0,
      errorCount: 0
    };

    if (this.metrics.length > 0) {
      const responseTimes = this.metrics
        .filter(m => m.name.includes('response'))
        .map(m => m.value);

      if (responseTimes.length > 0) {
        summary.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        summary.maxResponseTime = Math.max(...responseTimes);
      }

      summary.errorCount = this.metrics.filter(m => m.name.includes('error')).length;
    }

    return summary;
  }
}

export const monitoring = new MonitoringService();

// Middleware for automatic performance monitoring
export function withPerformanceMonitoring(handler: any) {
  return async (req: any, res: any) => {
    const timer = monitoring.startTimer(`${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent']
    });

    try {
      const result = await handler(req, res);
      timer.end();
      return result;
    } catch (error) {
      monitoring.trackError(error, {
        url: req.url,
        method: req.method,
        userAgent: req.headers['user-agent']
      });
      throw error;
    }
  };
}
```

#### Security Monitoring Integration
```typescript
// lib/security-monitoring.ts
import { monitoring } from './monitoring';

export class SecurityMonitor {
  static logAuthenticationAttempt(email: string, success: boolean, ip?: string) {
    monitoring.logSecurityEvent({
      type: 'authentication_attempt',
      severity: success ? 'low' : 'medium',
      message: `Authentication ${success ? 'successful' : 'failed'} for ${email}`,
      metadata: {
        email,
        ip,
        success
      }
    });
  }

  static logAuthorizationFailure(userId: string, action: string, resource: string) {
    monitoring.logSecurityEvent({
      type: 'authorization_failure',
      severity: 'high',
      message: `Authorization failed for user ${userId} attempting ${action} on ${resource}`,
      userId,
      metadata: {
        action,
        resource
      }
    });
  }

  static logSuspiciousActivity(userId: string, activity: string, details: Record<string, any>) {
    monitoring.logSecurityEvent({
      type: 'suspicious_activity',
      severity: 'medium',
      message: `Suspicious activity detected: ${activity}`,
      userId,
      metadata: details
    });
  }

  static logFileAccess(userId: string, filePath: string, success: boolean) {
    monitoring.logSecurityEvent({
      type: 'file_access',
      severity: success ? 'low' : 'high',
      message: `File access ${success ? 'successful' : 'failed'}: ${filePath}`,
      userId,
      metadata: {
        filePath,
        success
      }
    });
  }

  static logTypeSafetyViolation(location: string, details: string) {
    monitoring.logSecurityEvent({
      type: 'type_safety_violation',
      severity: 'medium',
      message: `Type safety violation detected at ${location}: ${details}`,
      metadata: {
        location,
        details
      }
    });
  }
}

// Automatic security monitoring middleware
export function withSecurityMonitoring(handler: any) {
  return async (req: any, res: any) => {
    const startTime = Date.now();
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    try {
      // Monitor request
      monitoring.recordMetric('http.request.count', 1, {
        method: req.method,
        url: req.url,
        ip: clientIP
      });

      const result = await handler(req, res);

      // Log successful requests
      const duration = Date.now() - startTime;
      monitoring.recordMetric('http.request.duration', duration, {
        method: req.method,
        url: req.url,
        status: res.statusCode
      });

      return result;
    } catch (error) {
      // Log security-relevant errors
      if (error.message.includes('Unauthorized')) {
        SecurityMonitor.logAuthenticationAttempt(req.body?.email, false, clientIP);
      } else if (error.message.includes('Forbidden')) {
        SecurityMonitor.logAuthorizationFailure(
          req.user?.id,
          req.method,
          req.url
        );
      }

      // Log error
      monitoring.trackError(error, {
        url: req.url,
        method: req.method,
        ip: clientIP,
        userAgent: req.headers['user-agent']
      });

      throw error;
    }
  };
}
```

### 4.2 Alert Configuration

#### Alert Rules
```yaml
# monitoring/alerts.yml
alerts:
  - name: "High Error Rate"
    condition: "rate(http_requests_total{status=~'5..'}[5m]) > 0.05"
    severity: critical
    description: "Error rate exceeded 5% over 5 minutes"

  - name: "Performance Degradation"
    condition: "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2.0"
    severity: warning
    description: "95th percentile response time exceeded 2 seconds"

  - name: "Security Violation"
    condition: "increase(security_violations_total[5m]) > 0"
    severity: critical
    description: "Security violation detected"

  - name: "Database Connection Pool Exhaustion"
    condition: "db_connections_active / db_connections_max > 0.9"
    severity: warning
    description: "Database connection pool usage above 90%"

  - name: "Memory Usage Spike"
    condition: "process_resident_memory_bytes / 1024 / 1024 > 500"
    severity: warning
    description: "Memory usage exceeded 500MB"

  - name: "Type Safety Violation"
    condition: "increase(type_safety_violations_total[5m]) > 0"
    severity: medium
    description: "Type safety violation detected in production"
```

## 5. Developer Experience Improvements

### 5.1 IDE Integration

#### VS Code Extensions & Settings
```json
// .vscode/extensions.json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-json",
    "usernamehw.errorlens",
    "streetsidesoftware.code-spell-checker",
    "ms-vscode.vscode-jest",
    "humao.rest-client",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-git-graph"
  ]
}
```

#### VS Code Settings
```json
// .vscode/settings.json
{
  "typescript.preferences.strict": true,
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.format.enable": true,
  "typescript.validate.enable": true,

  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "eslint.codeAction.showDocumentation": true,
  "eslint.format.enable": true,

  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },

  "editor.rulers": [80, 120],
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.detectIndentation": false,

  "files.exclude": {
    "**/node_modules": true,
    "**/.git": true,
    "**/.DS_Store": true,
    "**/coverage": true,
    "**/.next": true,
    "**/build": true,
    "**/dist": true
  },

  "search.exclude": {
    "**/node_modules": true,
    "**/coverage": true,
    "**/.next": true,
    "**/build": true,
    "**/dist": true,
    "**/*.log": true
  }
}
```

### 5.2 Code Templates & Snippets

#### TypeScript Snippets
```json
// .vscode/snippets.code-snippets
{
  "Safe Supabase Query": {
    "scope": "typescript,typescriptreact",
    "prefix": "safe-supabase-query",
    "body": [
      "const { data, error } = await supabase",
      "  .from('${1:table}')",
      "  .select(`${2:columns}`)",
      "  .eq('${3:column}', ${4:value});",
      "",
      "if (error) {",
      "  console.error('Database error:', error);",
      "  return NextResponse.json({ error: 'Database error' }, { status: 500 });",
      "}",
      "",
      "if (!data) {",
      "  return NextResponse.json({ error: 'Not found' }, { status: 404 });",
      "}",
      "",
      "// Safe property access with proper typing",
      "const result = data as ${5:Type};",
      "const ${6:property} = result?.${7:nestedProperty} ?? ${8:defaultValue};"
    ],
    "description": "Safe Supabase query with proper error handling and type safety"
  },

  "Security Event Logging": {
    "scope": "typescript,typescriptreact",
    "prefix": "security-log",
    "body": [
      "SecurityMonitor.logSecurityEvent({",
      "  type: '${1:event_type}',",
      "  severity: '${2|low,medium,high,critical|}',",
      "  message: '${3:description}',",
      "  userId: ${4:userId},",
      "  metadata: {",
      "    ${5:key}: ${6:value}",
      "  }",
      "});"
    ],
    "description": "Log security events with proper structure"
  },

  "Performance Monitoring": {
    "scope": "typescript,typescriptreact",
    "prefix": "performance-monitor",
    "body": [
      "const timer = monitoring.startTimer('${1:operation_name}', {",
      "  ${2:key}: '${3:value}'",
      "});",
      "",
      "try {",
      "  ${4:// operation code}",
      "  timer.end();",
      "} catch (error) {",
      "  monitoring.trackError(error, {",
      "    operation: '${1:operation_name}',",
      "    ${2:key}: '${3:value}'",
      "  });",
      "  throw error;",
      "}"
    ],
    "description": "Performance monitoring wrapper"
  }
}
```

### 5.3 Documentation Templates

#### API Endpoint Documentation
```markdown
<!-- templates/api-endpoint.md -->
# API Endpoint: [Endpoint Name]

## Overview
[Brief description of what this endpoint does]

## Security Considerations
- [ ] Input validation implemented
- [ ] Authentication required
- [ ] Authorization checks in place
- [ ] Rate limiting applied
- [ ] Logging enabled

## Performance Characteristics
- **Expected Response Time**: < [X]ms
- **Database Queries**: [X] queries
- **Memory Usage**: < [X]MB

## Error Handling
- [ ] Proper HTTP status codes
- [ ] Sanitized error messages
- [ ] No sensitive data leakage
- [ ] Logging for debugging

## Type Safety
- [ ] All inputs properly typed
- [ ] No `any` type assertions
- [ ] Response schema defined
- [ ] Error types documented
```

## 6. Continuous Improvement Process

### 6.1 Regular Security Audits

#### Automated Security Assessment
```bash
#!/bin/bash
# scripts/security-audit.sh

echo "🔒 Running automated security audit..."

# Run security tests
npm test -- --testPathPattern=security

# Check for vulnerable dependencies
npm audit --audit-level moderate

# Run static security analysis
npx eslint . --ext .ts,.tsx --config .eslintrc.security.js

# Check for hardcoded secrets
grep -r "password\|secret\|key\|token" --exclude-dir=node_modules --exclude-dir=.git . | grep -v "process.env" | grep -v "import"

# Generate security report
node scripts/generate-security-report.js

echo "✅ Security audit completed"
```

#### Monthly Security Review Checklist
```markdown
<!-- docs/monthly-security-review.md -->
# Monthly Security Review Checklist

## Authentication & Authorization
- [ ] No hardcoded role assignments
- [ ] All role checks use database values
- [ ] Session management secure
- [ ] Password policies enforced
- [ ] Multi-factor authentication status

## Data Protection
- [ ] No sensitive data in logs
- [ ] Encryption at rest verified
- [ ] Data transmission encrypted
- [ ] Backup security confirmed
- [ ] Data retention policies followed

## Access Control
- [ ] Principle of least privilege applied
- [ ] Access reviews completed
- [ ] Failed login attempts monitored
- [ ] Suspicious activity alerts working
- [ ] Audit logs reviewed

## Code Security
- [ ] No unsafe type assertions
- [ ] Input validation comprehensive
- [ ] SQL injection prevention verified
- [ ] XSS protection in place
- [ ] CSRF protection active

## Infrastructure Security
- [ ] Dependencies updated
- [ ] Security patches applied
- [ ] Firewall rules reviewed
- [ ] Network segmentation verified
- [ ] Monitoring alerts tested

## Incident Response
- [ ] Response plan updated
- [ ] Contact lists current
- [ ] Backup procedures tested
- [ ] Recovery time objectives met
- [ ] Communication plan verified
```

### 6.2 Performance Optimization Reviews

#### Quarterly Performance Assessment
```typescript
// scripts/performance-assessment.ts
interface PerformanceBenchmark {
  endpoint: string;
  metric: string;
  baseline: number;
  current: number;
  target: number;
  status: 'good' | 'warning' | 'critical';
}

class PerformanceAssessor {
  private benchmarks: PerformanceBenchmark[] = [];

  async runAssessment() {
    console.log('📊 Running quarterly performance assessment...\n');

    // API response times
    await this.assessAPIResponseTimes();

    // Database query performance
    await this.assessDatabasePerformance();

    // Memory usage
    await this.assessMemoryUsage();

    // Bundle size
    await this.assessBundleSize();

    // Generate report
    await this.generateReport();

    console.log('✅ Performance assessment completed');
  }

  private async assessAPIResponseTimes() {
    const endpoints = [
      '/api/profile',
      '/api/resources',
      '/api/uploadResource',
      '/api/admin/users'
    ];

    for (const endpoint of endpoints) {
      const metrics = await this.measureEndpointPerformance(endpoint);
      const benchmark: PerformanceBenchmark = {
        endpoint,
        metric: 'response_time_p95',
        baseline: 300, // ms
        current: metrics.p95,
        target: 200, // ms
        status: metrics.p95 <= 200 ? 'good' : metrics.p95 <= 300 ? 'warning' : 'critical'
      };
      this.benchmarks.push(benchmark);
    }
  }

  private async assessDatabasePerformance() {
    const query = 'SELECT COUNT(*) FROM students';
    const metrics = await this.measureQueryPerformance(query);

    this.benchmarks.push({
      endpoint: 'database',
      metric: 'query_time',
      baseline: 50, // ms
      current: metrics.duration,
      target: 25, // ms
      status: metrics.duration <= 25 ? 'good' : metrics.duration <= 50 ? 'warning' : 'critical'
    });
  }

  private async assessMemoryUsage() {
    const usage = process.memoryUsage();
    const usageMB = usage.heapUsed / 1024 / 1024;

    this.benchmarks.push({
      endpoint: 'application',
      metric: 'memory_usage',
      baseline: 100, // MB
      current: usageMB,
      target: 80, // MB
      status: usageMB <= 80 ? 'good' : usageMB <= 100 ? 'warning' : 'critical'
    });
  }

  private async assessBundleSize() {
    // This would typically use next-bundle-analyzer results
    const bundleSizeKB = await this.getBundleSize();

    this.benchmarks.push({
      endpoint: 'frontend',
      metric: 'bundle_size',
      baseline: 1024, // KB
      current: bundleSizeKB,
      target: 800, // KB
      status: bundleSizeKB <= 800 ? 'good' : bundleSizeKB <= 1024 ? 'warning' : 'critical'
    });
  }

  private async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      benchmarks: this.benchmarks,
      summary: {
        good: this.benchmarks.filter(b => b.status === 'good').length,
        warning: this.benchmarks.filter(b => b.status === 'warning').length,
        critical: this.benchmarks.filter(b => b.status === 'critical').length,
        overall: this.benchmarks.every(b => b.status === 'good') ? 'good' :
                 this.benchmarks.some(b => b.status === 'critical') ? 'critical' : 'warning'
      }
    };

    // Save report
    const fs = require('fs');
    fs.writeFileSync('performance-assessment-report.json', JSON.stringify(report, null, 2));

    // Print summary
    console.log('\n📈 Performance Assessment Summary:');
    console.log(`Good: ${report.summary.good}`);
    console.log(`Warning: ${report.summary.warning}`);
    console.log(`Critical: ${report.summary.critical}`);
    console.log(`Overall: ${report.summary.overall.toUpperCase()}`);

    if (report.summary.critical > 0) {
      console.log('\n⚠️  Critical performance issues detected. Immediate action required.');
    }
  }

  private async measureEndpointPerformance(endpoint: string): Promise<{ p95: number }> {
    // Implementation would run actual performance tests
    // This is a placeholder
    return { p95: Math.random() * 400 + 100 };
  }

  private async measureQueryPerformance(query: string): Promise<{ duration: number }> {
    // Implementation would run actual database performance tests
    return { duration: Math.random() * 100 };
  }

  private async getBundleSize(): Promise<number> {
    // Implementation would get actual bundle size
    return Math.random() * 500 + 700;
  }
}

// Run assessment
new PerformanceAssessor().runAssessment().catch(console.error);
```

This comprehensive proactive detection and quality gate system ensures that the security vulnerabilities and performance issues identified in the code review are not only fixed but also prevented from reoccurring. The multi-layered approach provides protection at development time, build time, and runtime, creating a robust foundation for maintaining code quality and security over time.
