// src/services/system-monitoring.service.ts
import SystemHealth from './system-health.model';
import Driver from '../driver/driver.model';
import Trip from '../trip/trip.model';
import mongoose from 'mongoose';

class SystemMonitoringService {
  private static metrics = {
    requestCount: 0,
    totalResponseTime: 0,
    errorCount: 0,
    lastMinuteRequests: [] as number[],
  };

  /**
   * Record API request metrics
   */
  static recordRequest(responseTime: number, isError: boolean = false) {
    this.metrics.requestCount++;
    this.metrics.totalResponseTime += responseTime;

    if (isError) {
      this.metrics.errorCount++;
    }

    // Track requests per minute
    const now = Date.now();
    this.metrics.lastMinuteRequests.push(now);

    // Remove requests older than 1 minute
    this.metrics.lastMinuteRequests = this.metrics.lastMinuteRequests.filter(
      (time) => now - time < 60000
    );
  }

  /**
   * Collect comprehensive system health metrics
   */
  static async collectSystemHealth() {
    try {
      const [apiMetrics, databaseMetrics, businessMetrics, externalServices] =
        await Promise.all([
          this.getAPIMetrics(),
          this.getDatabaseMetrics(),
          this.getBusinessMetrics(),
          this.checkExternalServices(),
        ]);

      // Determine overall health status
      const { overallStatus, alerts } = this.calculateOverallHealth(
        apiMetrics,
        databaseMetrics,
        businessMetrics,
        externalServices
      );

      const healthData = {
        timestamp: new Date(),
        apiMetrics,
        databaseMetrics,
        businessMetrics,
        externalServices,
        overallStatus,
        alerts,
      };

      // Save to database
      const healthRecord = new SystemHealth(healthData);
      await healthRecord.save();

      return healthData;
    } catch (error: any) {
      console.error('Error collecting system health:', error);
      throw error;
    }
  }

  /**
   * Get API performance metrics
   */
  private static async getAPIMetrics() {
    const avgResponseTime =
      this.metrics.requestCount > 0
        ? this.metrics.totalResponseTime / this.metrics.requestCount
        : 0;

    const errorRate =
      this.metrics.requestCount > 0
        ? (this.metrics.errorCount / this.metrics.requestCount) * 100
        : 0;

    return {
      responseTime: Math.round(avgResponseTime),
      requestCount: this.metrics.lastMinuteRequests.length,
      errorRate: Math.round(errorRate * 100) / 100,
      activeConnections: mongoose.connection.readyState === 1 ? 1 : 0,
    };
  }

  /**
   * Get database performance metrics
   */
  private static async getDatabaseMetrics() {
    try {
      const dbStats = await mongoose.connection.db.stats();
      const slowQueries = 0; // Placeholder - implement slow query monitoring

      return {
        connectionCount: mongoose.connections.length,
        queryTime: 0, // Placeholder - implement query time tracking
        slowQueries,
        storage: {
          used:
            Math.round((dbStats.dataSize / (1024 * 1024 * 1024)) * 100) / 100, // GB
          available:
            Math.round((dbStats.storageSize / (1024 * 1024 * 1024)) * 100) /
            100, // GB
          percentage: Math.round(
            (dbStats.dataSize / dbStats.storageSize) * 100
          ),
        },
      };
    } catch (error) {
      return {
        connectionCount: 0,
        queryTime: 0,
        slowQueries: 0,
        storage: { used: 0, available: 0, percentage: 0 },
      };
    }
  }

  /**
   * Get business-specific metrics
   */
  private static async getBusinessMetrics() {
    const [activeTrips, onlineDrivers, pendingRequests] = await Promise.all([
      Trip.countDocuments({
        status: { $in: ['driver_assigned', 'driver_arrived', 'in_progress'] },
      }),
      Driver.countDocuments({ isOnline: true }),
      Trip.countDocuments({ status: 'searching' }),
    ]);

    return {
      activeTrips,
      onlineDrivers,
      pendingRequests,
      systemErrors: this.metrics.errorCount,
    };
  }

  /**
   * Check external service health
   */
  private static async checkExternalServices() {
    const services = {
      paystack: await this.checkServiceHealth('https://api.paystack.co'),
      aws: await this.checkServiceHealth('https://status.aws.amazon.com'),
      maps: await this.checkServiceHealth('https://maps.googleapis.com'),
      sms: await this.checkServiceHealth('https://api.ng.termii.com'),
    };

    return services;
  }

  /**
   * Check individual service health
   */
  private static async checkServiceHealth(url: string) {
    try {
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'HEAD',
        timeout: 5000,
      } as any);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          status: responseTime < 1000 ? 'up' : ('degraded' as const),
          responseTime,
        };
      } else {
        return {
          status: 'degraded' as const,
          responseTime,
        };
      }
    } catch (error) {
      return {
        status: 'down' as const,
        responseTime: 5000, // Timeout
      };
    }
  }

  /**
   * Calculate overall system health
   */
  private static calculateOverallHealth(
    api: any,
    database: any,
    business: any,
    external: any
  ) {
    const alerts: Array<{
      type: 'warning' | 'critical';
      message: string;
      component: string;
    }> = [];
    let severityScore = 0;

    // API health checks
    if (api.errorRate > 5) {
      alerts.push({
        type: api.errorRate > 10 ? 'critical' : 'warning',
        message: `High error rate: ${api.errorRate}%`,
        component: 'api',
      });
      severityScore += api.errorRate > 10 ? 3 : 1;
    }

    if (api.responseTime > 2000) {
      alerts.push({
        type: api.responseTime > 5000 ? 'critical' : 'warning',
        message: `Slow API response: ${api.responseTime}ms`,
        component: 'api',
      });
      severityScore += api.responseTime > 5000 ? 3 : 1;
    }

    // Database health checks
    if (database.storage.percentage > 85) {
      alerts.push({
        type: database.storage.percentage > 95 ? 'critical' : 'warning',
        message: `High storage usage: ${database.storage.percentage}%`,
        component: 'database',
      });
      severityScore += database.storage.percentage > 95 ? 3 : 1;
    }

    // Business health checks
    if (business.pendingRequests > 50) {
      alerts.push({
        type: business.pendingRequests > 100 ? 'critical' : 'warning',
        message: `High pending requests: ${business.pendingRequests}`,
        component: 'business',
      });
      severityScore += business.pendingRequests > 100 ? 3 : 1;
    }

    // External service checks
    Object.entries(external).forEach(([service, health]: [string, any]) => {
      if (health.status === 'down') {
        alerts.push({
          type: 'critical',
          message: `${service} service is down`,
          component: 'external',
        });
        severityScore += 3;
      } else if (health.status === 'degraded') {
        alerts.push({
          type: 'warning',
          message: `${service} service is degraded`,
          component: 'external',
        });
        severityScore += 1;
      }
    });

    // Determine overall status
    let overallStatus: 'healthy' | 'warning' | 'critical';
    if (severityScore === 0) {
      overallStatus = 'healthy';
    } else if (severityScore < 5) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'critical';
    }

    return { overallStatus, alerts };
  }

  /**
   * Get system health history
   */
  static async getHealthHistory(hours: number = 24) {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    const healthData = await SystemHealth.find({
      timestamp: { $gte: startTime },
    }).sort({ timestamp: 1 });

    return healthData;
  }

  /**
   * Get current system status
   */
  static async getCurrentStatus() {
    const latestHealth = await SystemHealth.findOne().sort({ timestamp: -1 });

    if (!latestHealth) {
      return await this.collectSystemHealth();
    }

    // If latest health is older than 5 minutes, collect new data
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (latestHealth.timestamp < fiveMinutesAgo) {
      return await this.collectSystemHealth();
    }

    return latestHealth;
  }

  /**
   * Reset metrics (should be called periodically)
   */
  static resetMetrics() {
    this.metrics = {
      requestCount: 0,
      totalResponseTime: 0,
      errorCount: 0,
      lastMinuteRequests: [],
    };
  }
}

// Auto-collect system health every 5 minutes
setInterval(
  async () => {
    try {
      await SystemMonitoringService.collectSystemHealth();
    } catch (error) {
      console.error('Failed to collect system health:', error);
    }
  },
  5 * 60 * 1000
);

// Reset metrics every hour
setInterval(
  () => {
    SystemMonitoringService.resetMetrics();
  },
  60 * 60 * 1000
);

export default SystemMonitoringService;
