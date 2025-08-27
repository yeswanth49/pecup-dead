import { NextResponse } from 'next/server';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  userEmail?: string;
}

interface SecurityEvent {
  type: 'auth_failure' | 'file_access' | 'permission_denied' | 'suspicious_activity';
  userEmail: string;
  details: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

interface ErrorMetric {
  name: string;
  message: string;
  stack?: string;
  timestamp: Date;
  userEmail?: string;
  endpoint?: string;
}

/**
 * Monitoring service for performance and security tracking
 */
class MonitoringService {
  private metrics: PerformanceMetric[] = [];
  private securityEvents: SecurityEvent[] = [];
  private errorMetrics: ErrorMetric[] = [];
  private readonly MAX_METRICS = 1000;

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>, userEmail?: string): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: new Date(),
      tags,
      userEmail
    };

    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[METRIC] ${name}: ${value}`, tags ? { tags, userEmail } : { userEmail });
    }

    // In production, this would send to monitoring service (e.g., DataDog, New Relic)
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to external monitoring service
      // this.sendToMonitoringService(metric);
    }
  }

  /**
   * Start a performance timer
   */
  startTimer(name: string, userEmail?: string) {
    const startTime = Date.now();
    return {
      end: (tags?: Record<string, string>) => {
        const duration = Date.now() - startTime;
        this.recordMetric(`${name}.duration`, duration, tags, userEmail);
        return duration;
      }
    };
  }

  /**
   * Record a security event
   */
  recordSecurityEvent(type: SecurityEvent['type'], userEmail: string, details: string, additionalData?: {
    ip?: string;
    userAgent?: string;
    tags?: Record<string, string>;
  }): void {
    const event: SecurityEvent = {
      type,
      userEmail,
      details,
      timestamp: new Date(),
      ip: additionalData?.ip,
      userAgent: additionalData?.userAgent
    };

    this.securityEvents.push(event);

    // Keep only the most recent events
    if (this.securityEvents.length > this.MAX_METRICS) {
      this.securityEvents = this.securityEvents.slice(-this.MAX_METRICS);
    }

    // Log security events (always log these)
    console.error(`[SECURITY] ${type.toUpperCase()}: ${userEmail} - ${details}`, additionalData);

    // In production, send to security monitoring
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to security monitoring service (e.g., SIEM)
      // this.sendToSecurityService(event);
    }
  }

  /**
   * Record an error metric
   */
  recordError(name: string, error: Error, userEmail?: string, endpoint?: string): void {
    const errorMetric: ErrorMetric = {
      name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
      userEmail,
      endpoint
    };

    this.errorMetrics.push(errorMetric);

    // Keep only the most recent errors
    if (this.errorMetrics.length > this.MAX_METRICS) {
      this.errorMetrics = this.errorMetrics.slice(-this.MAX_METRICS);
    }

    // Log errors
    console.error(`[ERROR] ${name}: ${error.message}`, {
      userEmail,
      endpoint,
      stack: error.stack
    });
  }

  /**
   * Get performance metrics for analysis
   */
  getMetrics(name?: string, limit = 100): PerformanceMetric[] {
    let filtered = name ? this.metrics.filter(m => m.name === name) : this.metrics;
    return filtered.slice(-limit);
  }

  /**
   * Get security events for analysis
   */
  getSecurityEvents(type?: SecurityEvent['type'], limit = 100): SecurityEvent[] {
    let filtered = type ? this.securityEvents.filter(e => e.type === type) : this.securityEvents;
    return filtered.slice(-limit);
  }

  /**
   * Get error metrics for analysis
   */
  getErrorMetrics(name?: string, limit = 100): ErrorMetric[] {
    let filtered = name ? this.errorMetrics.filter(e => e.name === name) : this.errorMetrics;
    return filtered.slice(-limit);
  }

  /**
   * Get performance summary statistics
   */
  getPerformanceSummary(): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    topEndpoints: Array<{ endpoint: string; avgTime: number; count: number }>;
  } {
    const apiMetrics = this.metrics.filter(m => m.name.includes('.duration'));
    const errorMetrics = this.errorMetrics.filter(e => e.name.includes('api'));

    const totalRequests = apiMetrics.length;
    const totalResponseTime = apiMetrics.reduce((sum, m) => sum + m.value, 0);
    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    const errorRate = totalRequests > 0 ? (errorMetrics.length / totalRequests) * 100 : 0;

    // Group by endpoint
    const endpointGroups: Record<string, { totalTime: number; count: number }> = {};
    apiMetrics.forEach(metric => {
      const endpoint = metric.tags?.endpoint || metric.name.replace('.duration', '');
      if (!endpointGroups[endpoint]) {
        endpointGroups[endpoint] = { totalTime: 0, count: 0 };
      }
      endpointGroups[endpoint].totalTime += metric.value;
      endpointGroups[endpoint].count += 1;
    });

    const topEndpoints = Object.entries(endpointGroups)
      .map(([endpoint, data]) => ({
        endpoint,
        avgTime: data.totalTime / data.count,
        count: data.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRequests,
      averageResponseTime,
      errorRate,
      topEndpoints
    };
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clearMetrics(): void {
    this.metrics = [];
    this.securityEvents = [];
    this.errorMetrics = [];
  }
}

// Export singleton instance
export const monitoring = new MonitoringService();

/**
 * Higher-order function to wrap API routes with monitoring
 */
export function withMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  endpointName: string
) {
  return async (...args: T): Promise<R> => {
    const timer = monitoring.startTimer(`api.${endpointName}`);

    try {
      const result = await fn(...args);
      timer.end({ endpoint: endpointName });
      return result;
    } catch (error) {
      monitoring.recordError(`api.${endpointName}.error`, error as Error, undefined, endpointName);
      timer.end({ endpoint: endpointName, error: 'true' });
      throw error;
    }
  };
}

/**
 * Middleware to monitor API requests
 */
export function createMonitoringMiddleware() {
  return async (request: Request, response?: NextResponse): Promise<void> => {
    const url = new URL(request.url);
    const endpoint = url.pathname;
    const timer = monitoring.startTimer(`api${endpoint}`);

    // Extract user email from request headers if available
    const userEmail = request.headers.get('x-user-email') || undefined;

    try {
      // This would be used in a Next.js middleware
      timer.end({ endpoint, userEmail: userEmail || 'anonymous' });
    } catch (error) {
      monitoring.recordError(`middleware.${endpoint}`, error as Error, userEmail, endpoint);
      timer.end({ endpoint, error: 'true', userEmail: userEmail || 'anonymous' });
    }
  };
}

/**
 * Security monitoring utility functions
 */
export class SecurityMonitor {
  static logAuthenticationFailure(email: string, reason: string, additionalData?: {
    ip?: string;
    userAgent?: string;
  }): void {
    monitoring.recordSecurityEvent(
      'auth_failure',
      email,
      `Authentication failed: ${reason}`,
      additionalData
    );
  }

  static logFileAccess(userEmail: string, filePath: string, additionalData?: {
    ip?: string;
    userAgent?: string;
  }): void {
    monitoring.recordSecurityEvent(
      'file_access',
      userEmail,
      `File accessed: ${filePath}`,
      additionalData
    );
  }

  static logPermissionDenied(userEmail: string, resource: string, action: string, additionalData?: {
    ip?: string;
    userAgent?: string;
  }): void {
    monitoring.recordSecurityEvent(
      'permission_denied',
      userEmail,
      `Permission denied: ${action} on ${resource}`,
      additionalData
    );
  }

  static logSuspiciousActivity(userEmail: string, activity: string, additionalData?: {
    ip?: string;
    userAgent?: string;
  }): void {
    monitoring.recordSecurityEvent(
      'suspicious_activity',
      userEmail,
      `Suspicious activity: ${activity}`,
      additionalData
    );
  }
}
