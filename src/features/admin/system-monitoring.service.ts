// src/features/admin/system-monitoring.service.ts
import mongoose from 'mongoose';
import { ErrorResponse } from '../../utils/responses';
import { pubsub } from '../../graphql/pubsub';
import { SUBSCRIPTION_EVENTS } from '../../graphql/subscription-events';
import AuditLogService from './audit-log.service';

interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  source: string;
  metadata?: any;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical' | 'down';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  database: {
    status: 'connected' | 'disconnected' | 'connecting';
    responseTime: number;
    connectionCount: number;
  };
  services: {
    [key: string]: {
      status: 'up' | 'down' | 'degraded';
      responseTime?: number;
      lastCheck: Date;
    };
  };
  metrics: {
    requestsPerMinute: number;
    errorRate: number;
    averageResponseTime: number;
  };
  timestamp: Date;
}

// Mock storage for system alerts (in production, use a proper database)
const systemAlerts: SystemAlert[] = [];
let alertIdCounter = 1;

class SystemMonitoringService {
  /**
   * Get current system health
   */
  static async getSystemHealth(): Promise<SystemHealth> {
    try {
      const startTime = Date.now();

      // Check database connectivity
      const dbHealth = await this.checkDatabaseHealth();

      // Check memory usage
      const memoryUsage = process.memoryUsage();
      const memory = {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      };

      // Check service statuses
      const services = await this.checkServices();

      // Calculate metrics
      const metrics = await this.calculateMetrics();

      // Determine overall status
      let status: 'healthy' | 'warning' | 'critical' | 'down' = 'healthy';

      if (dbHealth.status === 'disconnected') {
        status = 'down';
      } else if (memory.percentage > 90 || metrics.errorRate > 10) {
        status = 'critical';
      } else if (memory.percentage > 75 || metrics.errorRate > 5) {
        status = 'warning';
      }

      const health: SystemHealth = {
        status,
        uptime: process.uptime(),
        memory,
        database: dbHealth,
        services,
        metrics,
        timestamp: new Date(),
      };

      // Publish health update
      pubsub.publish(SUBSCRIPTION_EVENTS.SYSTEM_HEALTH_UPDATE, {
        systemHealthUpdated: health,
      });

      return health;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error checking system health',
        error.message
      );
    }
  }

  /**
   * Get system health history
   */
  static async getSystemHealthHistory(hours: number = 24) {
    try {
      // In a real implementation, this would fetch from a time-series database
      // For now, we'll generate sample data
      const history = [];
      const now = new Date();

      for (let i = hours; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);

        // Generate sample health data
        const memoryPercentage = 40 + Math.random() * 30; // 40-70%
        const errorRate = Math.random() * 3; // 0-3%
        const responseTime = 100 + Math.random() * 200; // 100-300ms

        let status: 'healthy' | 'warning' | 'critical' | 'down' = 'healthy';
        if (memoryPercentage > 80 || errorRate > 2) {
          status = Math.random() > 0.5 ? 'warning' : 'critical';
        }

        history.push({
          timestamp,
          status,
          memory: {
            percentage: memoryPercentage,
          },
          metrics: {
            errorRate,
            averageResponseTime: responseTime,
            requestsPerMinute: Math.floor(100 + Math.random() * 200),
          },
        });
      }

      return {
        period: `${hours} hours`,
        dataPoints: history.length,
        history,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching health history',
        error.message
      );
    }
  }

  /**
   * Get system alerts
   */
  static async getSystemAlerts(
    filters: {
      severity?: string;
      resolved?: boolean;
      type?: string;
      limit?: number;
    } = {}
  ) {
    try {
      let alerts = [...systemAlerts];

      // Apply filters
      if (filters.severity) {
        alerts = alerts.filter((alert) => alert.severity === filters.severity);
      }

      if (filters.resolved !== undefined) {
        alerts = alerts.filter((alert) => alert.resolved === filters.resolved);
      }

      if (filters.type) {
        alerts = alerts.filter((alert) => alert.type === filters.type);
      }

      // Sort by creation date (newest first)
      alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Apply limit
      if (filters.limit) {
        alerts = alerts.slice(0, filters.limit);
      }

      return {
        alerts,
        total: alerts.length,
        unresolved: alerts.filter((alert) => !alert.resolved).length,
        critical: alerts.filter(
          (alert) => alert.severity === 'critical' && !alert.resolved
        ).length,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching system alerts',
        error.message
      );
    }
  }

  /**
   * Create system alert
   */
  static async createAlert(data: {
    type: 'error' | 'warning' | 'info';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    source: string;
    metadata?: any;
  }) {
    try {
      const alert: SystemAlert = {
        id: `alert_${alertIdCounter++}`,
        type: data.type,
        severity: data.severity,
        title: data.title,
        message: data.message,
        source: data.source,
        metadata: data.metadata,
        resolved: false,
        createdAt: new Date(),
      };

      systemAlerts.push(alert);

      // Publish alert
      pubsub.publish(SUBSCRIPTION_EVENTS.SYSTEM_ALERT_CREATED, {
        systemAlertCreated: alert,
      });

      return alert;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error creating system alert',
        error.message
      );
    }
  }

  /**
   * Resolve system alert
   */
  static async resolveAlert(
    alertId: string,
    resolution: string,
    resolvedBy: string
  ) {
    try {
      const alertIndex = systemAlerts.findIndex(
        (alert) => alert.id === alertId
      );

      if (alertIndex === -1) {
        throw new ErrorResponse(404, 'Alert not found');
      }

      const alert = systemAlerts[alertIndex];

      if (alert.resolved) {
        throw new ErrorResponse(400, 'Alert is already resolved');
      }

      alert.resolved = true;
      alert.resolvedBy = resolvedBy;
      alert.resolvedAt = new Date();
      alert.metadata = {
        ...alert.metadata,
        resolution,
      };

      return alert;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error resolving alert', error.message);
    }
  }

  /**
   * Trigger manual health check
   */
  static async triggerHealthCheck() {
    try {
      const health = await this.getSystemHealth();

      // Create alert if system is not healthy
      if (health.status !== 'healthy') {
        await this.createAlert({
          type:
            health.status === 'critical' || health.status === 'down'
              ? 'error'
              : 'warning',
          severity:
            health.status === 'down'
              ? 'critical'
              : health.status === 'critical'
                ? 'high'
                : 'medium',
          title: 'System Health Check',
          message: `System status: ${health.status}. Memory usage: ${health.memory.percentage.toFixed(1)}%, Error rate: ${health.metrics.errorRate.toFixed(2)}%`,
          source: 'health_check',
          metadata: health,
        });
      }

      return {
        success: true,
        health,
        timestamp: new Date(),
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error triggering health check',
        error.message
      );
    }
  }

  /**
   * Clean up old data
   */
  static async cleanupOldData(type: string, olderThanDays: number) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      let deletedCount = 0;

      switch (type) {
        case 'audit_logs':
          // This would be implemented in AuditLogService
          deletedCount = await AuditLogService.cleanupOldLogs(cutoffDate);
          break;

        case 'system_alerts':
          const initialLength = systemAlerts.length;
          const filteredAlerts = systemAlerts.filter(
            (alert) => alert.createdAt > cutoffDate || !alert.resolved
          );
          systemAlerts.length = 0;
          systemAlerts.push(...filteredAlerts);
          deletedCount = initialLength - filteredAlerts.length;
          break;

        case 'health_history':
          // This would clean up health history data
          deletedCount = 0; // Placeholder
          break;

        default:
          throw new ErrorResponse(400, 'Invalid cleanup type');
      }

      return {
        success: true,
        type,
        deletedCount,
        cutoffDate,
        message: `Cleaned up ${deletedCount} ${type} records older than ${olderThanDays} days`,
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error cleaning up old data', error.message);
    }
  }

  /**
   * Check database health
   */
  private static async checkDatabaseHealth() {
    try {
      const startTime = Date.now();

      if (mongoose?.connection.db) {
        // Test database connection
        await mongoose.connection.db.admin().ping();
      }
    

      const responseTime = Date.now() - startTime;

      return {
        status: 'connected' as const,
        responseTime,
        connectionCount: mongoose.connections.length,
      };
    } catch (error) {
      return {
        status: 'disconnected' as const,
        responseTime: -1,
        connectionCount: 0,
      };
    }
  }

  /**
   * Check various services
   */
  private static async checkServices() {
    const services: SystemHealth['services'] = {};

    // Redis check (if using Redis)
    services.redis = {
      status: 'up', // This would be a real check
      responseTime: 5,
      lastCheck: new Date(),
    };

    // Email service check
    services.email = {
      status: 'up', // This would be a real check
      responseTime: 200,
      lastCheck: new Date(),
    };

    // SMS service check
    services.sms = {
      status: 'up', // This would be a real check
      responseTime: 150,
      lastCheck: new Date(),
    };

    // Payment gateway check
    services.payment = {
      status: 'up', // This would be a real check
      responseTime: 300,
      lastCheck: new Date(),
    };

    return services;
  }

  /**
   * Calculate system metrics
   */
  private static async calculateMetrics() {
    // In a real implementation, these would be calculated from actual data
    return {
      requestsPerMinute: Math.floor(100 + Math.random() * 200),
      errorRate: Math.random() * 2, // 0-2%
      averageResponseTime: 150 + Math.random() * 100, // 150-250ms
    };
  }

  /**
   * Monitor system continuously
   */
  static startMonitoring() {
    // Set up periodic health checks
    setInterval(
      async () => {
        try {
          const health = await this.getSystemHealth();

          // Create alerts for critical issues
          if (health.status === 'critical' || health.status === 'down') {
            await this.createAlert({
              type: 'error',
              severity: 'critical',
              title: 'System Health Critical',
              message: `System status is ${health.status}`,
              source: 'monitoring',
              metadata: health,
            });
          }
        } catch (error) {
          console.error('Health check failed:', error);
        }
      },
      5 * 60 * 1000
    ); // Every 5 minutes

    console.log('System monitoring started');
  }
}

export default SystemMonitoringService;
