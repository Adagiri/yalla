import { ErrorResponse } from '../../utils/responses';
import SystemHealth, {
  ISystemHealthDocument,
  ISystemHealth,
} from './system-health.model';
import { UpdateSystemHealthInput } from './general.types';

// NB: All the implementation below are not real, just dummny data and placeholder
export class SystemHealthService {
  static async getSystemHealth(): Promise<any> {
    try {
      let health: any = await SystemHealth.findOne({ isActive: true });

      if (!health) {
        health = await this.createDefaultSystemHealth();
      }

      return health;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to fetch system health',
        error.message
      );
    }
  }

  static async refreshSystemHealth(): Promise<any> {
    try {
      // this is not  actual metrics
      const refreshedData = await this.collectRealTimeMetrics();

      let health: any = await SystemHealth.findOne({ isActive: true });

      if (health) {
        // update the document fields
        health.set(refreshedData);
        health.lastUpdated = new Date();
        await health.save();
      } else {
        health = await this.createDefaultSystemHealth();
      }

      return health;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to refresh system health',
        error.message
      );
    }
  }

  static async updateSystemHealth(
    input: UpdateSystemHealthInput
  ): Promise<ISystemHealthDocument> {
    try {
      let health = await SystemHealth.findOne({ isActive: true });

      if (!health) {
        // create new with proper typing
        health = new SystemHealth({
          ...input,
          isActive: true,
          lastUpdated: new Date(),
        });
      } else {
        health.set(input);
        health.lastUpdated = new Date();
      }

      await health.save();
      return health;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to update system health',
        error.message
      );
    }
  }

  static async getSystemHealthStats(): Promise<any> {
    try {
      const health = await this.getSystemHealth();

      const healthData = health.toObject();

      return {
        database: {
          totalRecords: healthData.totalRecords,
          usagePercent: healthData.databaseUsagePercent,
          growthRate: 12.5, 
        },
        storage: {
          usedSpaceGB: healthData.usedSpaceGB,
          usagePercent: healthData.storageUsagePercent,
          availableSpaceGB: 100 - healthData.usedSpaceGB, 
        },
        users: {
          activeOnline: healthData.activeUsersOnline,
          peakToday: healthData.peakUsersToday,
          utilizationPercent: healthData.userUtilizationPercent,
          totalUsers: Math.round(
            healthData.activeUsersOnline /
              (healthData.userUtilizationPercent / 100)
          ), 
        },
        system: {
          uptimeHours: healthData.serverUptimeHours,
          averageResponseTime: healthData.averageResponseTime,
          errorRate: healthData.errorRate,
          lastBackup: new Date(Date.now() - 6 * 60 * 60 * 1000), 
        },
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to fetch system health stats',
        error.message
      );
    }
  }

  private static async createDefaultSystemHealth(): Promise<ISystemHealthDocument> {
    const defaultHealth = new SystemHealth({
      totalRecords: 12845,
      databaseUsagePercent: 75,
      usedSpaceGB: 2.4,
      storageUsagePercent: 45,
      activeUsersOnline: 234,
      peakUsersToday: 280,
      userUtilizationPercent: 85,
      serverUptimeHours: 720, // 30 days
      averageResponseTime: 120, // ms
      errorRate: 0.5,
      lastUpdated: new Date(),
      isActive: true,
    });

    await defaultHealth.save();
    return defaultHealth;
  }

  private static async collectRealTimeMetrics(): Promise<
    Partial<ISystemHealth>
  > {
    // dummy real-time metrics collection

    return {
      totalRecords: Math.floor(12845 + Math.random() * 1000),
      databaseUsagePercent: 75 + Math.random() * 5,
      usedSpaceGB: 2.4 + Math.random() * 0.1,
      storageUsagePercent: 45 + Math.random() * 3,
      activeUsersOnline: Math.floor(234 + Math.random() * 50),
      peakUsersToday: 280,
      userUtilizationPercent: 85 + Math.random() * 5,
      serverUptimeHours: 720 + Math.random() * 24,
      averageResponseTime: 120 + Math.random() * 20,
      errorRate: 0.5 + Math.random() * 0.2,
    };
  }
}

export default SystemHealthService;
