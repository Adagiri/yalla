
import AuditLog from './audit-log.model';
import { Request } from 'express';

interface LogActionInput {
  adminId: string;
  adminEmail: string;
  adminRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: {
    before?: any;
    after?: any;
    fieldsChanged?: string[];
  };
  success: boolean;
  errorMessage?: string;
  request?: Request;
}

class AuditLogService {
  /**
   * Log admin action
   */
  static async logAction(input: LogActionInput) {
    try {
      const auditEntry = new AuditLog({
        adminId: input.adminId,
        adminEmail: input.adminEmail,
        adminRole: input.adminRole,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        changes: input.changes,
        success: input.success,
        errorMessage: input.errorMessage,

        // Extract request information if provided
        httpMethod: input.request?.method,
        endpoint: input.request?.originalUrl,
        userAgent: input.request?.get('User-Agent'),
        ipAddress: this.getClientIP(input.request),
        sessionId: input.request?.session?.id,
        requestId: input.request?.headers['x-request-id'] as string,
      });

      await auditEntry.save();
      return auditEntry;
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Don't throw error - audit logging shouldn't break the main flow
    }
  }

  /**
   * Get audit logs with filtering
   */
  static async getAuditLogs(filters: {
    adminId?: string;
    resource?: string;
    action?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      adminId,
      resource,
      action,
      success,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filters;

    const query: any = {};

    if (adminId) query.adminId = adminId;
    if (resource) query.resource = resource;
    if (action) query.action = action;
    if (success !== undefined) query.success = success;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Get audit statistics
   */
  static async getAuditStats(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await AuditLog.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            success: '$success',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          successful: {
            $sum: { $cond: [{ $eq: ['$_id.success', true] }, '$count', 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$_id.success', false] }, '$count', 0] },
          },
          total: { $sum: '$count' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get most active admins
    const topAdmins = await AuditLog.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { adminId: '$adminId', adminEmail: '$adminEmail' },
          actionCount: { $sum: 1 },
          successfulActions: {
            $sum: { $cond: [{ $eq: ['$success', true] }, 1, 0] },
          },
        },
      },
      { $sort: { actionCount: -1 } },
      { $limit: 10 },
    ]);

    // Get most common actions
    const topActions = await AuditLog.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { action: '$action', resource: '$resource' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    return {
      dailyStats: stats,
      topAdmins,
      topActions,
    };
  }

  /**
   * Get client IP address from request
   */
  private static getClientIP(req?: Request): string {
    if (!req) return '';

    return (
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      ''
    );
  }

  /**
   * Compare objects and detect changes
   */
  static detectChanges(
    before: any,
    after: any
  ): {
    fieldsChanged: string[];
    before: any;
    after: any;
  } {
    const fieldsChanged: string[] = [];
    const beforeData: any = {};
    const afterData: any = {};

    // Simple comparison for top-level fields
    const allKeys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {}),
    ]);

    for (const key of allKeys) {
      if (before?.[key] !== after?.[key]) {
        fieldsChanged.push(key);
        beforeData[key] = before?.[key];
        afterData[key] = after?.[key];
      }
    }

    return {
      fieldsChanged,
      before: beforeData,
      after: afterData,
    };
  }
}

export default AuditLogService;
