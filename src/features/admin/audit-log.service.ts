// src/features/admin/audit-log.service.ts
import mongoose from 'mongoose';
import { ErrorResponse } from '../../utils/responses';
import { pubsub } from '../../graphql/pubsub';
import { SUBSCRIPTION_EVENTS } from '../../graphql/subscription-events';

// Audit Log Model Interface
interface AuditLogDocument extends mongoose.Document {
  adminId: string | null;
  adminEmail: string | null;
  adminRole: string | null;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: {
    before?: any;
    after?: any;
    fieldsChanged?: string[];
  };
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
}

// Create AuditLog schema if it doesn't exist
const auditLogSchema = new mongoose.Schema(
  {
    adminId: { type: String, default: null },
    adminEmail: { type: String, default: null },
    adminRole: { type: String, default: null },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: { type: String },
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
      fieldsChanged: [String],
    },
    metadata: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
    success: { type: Boolean, required: true },
    errorMessage: String,
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: false, // We're using our own timestamp field
    collection: 'audit_logs',
  }
);

// Indexes for better query performance
auditLogSchema.index({ adminId: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ success: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

const AuditLog =
  mongoose.models.AuditLog ||
  mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema);

interface LogActionInput {
  adminId: string | null;
  adminEmail: string | null;
  adminRole: string | null;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: {
    before?: any;
    after?: any;
    fieldsChanged?: string[];
  };
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

interface AuditLogFilters {
  adminId?: string;
  resource?: string;
  action?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

class AuditLogService {
  /**
   * Log an administrative action
   */
  static async logAction(input: LogActionInput): Promise<AuditLogDocument> {
    try {
      // If adminId is provided but email/role are missing, fetch them
      if (input.adminId && (!input.adminEmail || !input.adminRole)) {
        try {
          const Admin = require('./admin.model').default;
          const admin = await Admin.findById(input.adminId).select(
            'email role'
          );
          if (admin) {
            input.adminEmail = input.adminEmail || admin.email;
            input.adminRole = input.adminRole || admin.role;
          }
        } catch (error) {
          // Continue without admin details if fetch fails
          console.warn('Failed to fetch admin details for audit log:', error);
        }
      }

      const auditLog = new AuditLog({
        adminId: input.adminId,
        adminEmail: input.adminEmail,
        adminRole: input.adminRole,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        changes: input.changes,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        success: input.success,
        errorMessage: input.errorMessage,
        timestamp: new Date(),
      });

      await auditLog.save();

      // Publish real-time update for audit log subscriptions
      try {
        pubsub.publish(SUBSCRIPTION_EVENTS.AUDIT_LOG_CREATED, {
          auditLogCreated: auditLog.toObject(),
        });
      } catch (pubsubError) {
        // Don't fail the audit log if pubsub fails
        console.warn('Failed to publish audit log event:', pubsubError);
      }

      return auditLog;
    } catch (error: any) {
      // If audit logging fails, log to console but don't throw
      // This prevents audit logging failures from breaking the main operation
      console.error('Failed to create audit log:', error);
      throw new ErrorResponse(500, 'Failed to create audit log', error.message);
    }
  }

  /**
   * Get audit logs with filtering and pagination
   */
  static async getAuditLogs(filters: AuditLogFilters = {}) {
    try {
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
        logs: logs.map((log) => ({
          ...log,
          id: log._id,
          timeAgo: this.getTimeAgo(log.timestamp),
          resourceId: query.resource.id
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching audit logs', error.message);
    }
  }

  /**
   * Get audit statistics
   */
  static async getAuditStats(days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Daily stats - success vs failure by date
      const dailyStats = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              date: {
                $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
              },
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

      // Most active admins
      const topAdmins = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
            adminId: { $ne: null },
          },
        },
        {
          $group: {
            _id: {
              adminId: '$adminId',
              adminEmail: '$adminEmail',
              adminRole: '$adminRole',
            },
            actionCount: { $sum: 1 },
            successfulActions: {
              $sum: { $cond: [{ $eq: ['$success', true] }, 1, 0] },
            },
            failedActions: {
              $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] },
            },
            lastActivity: { $max: '$timestamp' },
          },
        },
        { $sort: { actionCount: -1 } },
        { $limit: 10 },
      ]);

      // Most common actions
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
            successRate: {
              $avg: { $cond: [{ $eq: ['$success', true] }, 1, 0] },
            },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      // Resources accessed most
      const topResources = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$resource',
            count: { $sum: 1 },
            uniqueAdmins: { $addToSet: '$adminId' },
            successRate: {
              $avg: { $cond: [{ $eq: ['$success', true] }, 1, 0] },
            },
          },
        },
        {
          $addFields: {
            uniqueAdminCount: { $size: '$uniqueAdmins' },
          },
        },
        {
          $project: {
            uniqueAdmins: 0, // Remove the array, keep just the count
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      // Error analysis
      const errorAnalysis = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
            success: false,
            errorMessage: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$errorMessage',
            count: { $sum: 1 },
            resources: { $addToSet: '$resource' },
            actions: { $addToSet: '$action' },
            lastOccurrence: { $max: '$timestamp' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]);

      // Overall summary
      const summary = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            totalActions: { $sum: 1 },
            successfulActions: {
              $sum: { $cond: [{ $eq: ['$success', true] }, 1, 0] },
            },
            failedActions: {
              $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] },
            },
            uniqueAdmins: { $addToSet: '$adminId' },
            uniqueResources: { $addToSet: '$resource' },
            uniqueActions: { $addToSet: '$action' },
          },
        },
      ]);

      const summaryData = summary[0] || {
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        uniqueAdmins: [],
        uniqueResources: [],
        uniqueActions: [],
      };

      const successRate =
        summaryData.totalActions > 0
          ? (summaryData.successfulActions / summaryData.totalActions) * 100
          : 0;

      return {
        period: `${days} days`,
        summary: {
          totalActions: summaryData.totalActions,
          successfulActions: summaryData.successfulActions,
          failedActions: summaryData.failedActions,
          successRate: Math.round(successRate * 100) / 100,
          uniqueAdmins: summaryData.uniqueAdmins.filter((id: string) => id !== null)
            .length,
          uniqueResources: summaryData.uniqueResources.length,
          uniqueActions: summaryData.uniqueActions.length,
        },
        dailyStats,
        topAdmins: topAdmins.map((admin) => ({
          adminId: admin._id.adminId,
          adminEmail: admin._id.adminEmail,
          adminRole: admin._id.adminRole,
          actionCount: admin.actionCount,
          successfulActions: admin.successfulActions,
          failedActions: admin.failedActions,
          successRate: Math.round(
            (admin.successfulActions / admin.actionCount) * 100
          ),
          lastActivity: admin.lastActivity,
        })),
        topActions: topActions.map((action) => ({
          action: action._id.action,
          resource: action._id.resource,
          count: action.count,
          successRate: Math.round(action.successRate * 100),
        })),
        topResources: topResources.map((resource) => ({
          resource: resource._id,
          count: resource.count,
          uniqueAdmins: resource.uniqueAdminCount,
          successRate: Math.round(resource.successRate * 100),
        })),
        errorAnalysis: errorAnalysis.map((error) => ({
          errorMessage: error._id,
          count: error.count,
          affectedResources: error.resources,
          affectedActions: error.actions,
          lastOccurrence: error.lastOccurrence,
        })),
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching audit statistics',
        error.message
      );
    }
  }

  /**
   * Get audit logs for a specific admin
   */
  static async getAdminAuditLogs(
    adminId: string,
    filters: Omit<AuditLogFilters, 'adminId'> = {}
  ) {
    return this.getAuditLogs({ ...filters, adminId });
  }

  /**
   * Get audit logs for a specific resource
   */
  static async getResourceAuditLogs(
    resource: string,
    resourceId?: string,
    filters: Omit<AuditLogFilters, 'resource'> = {}
  ) {
    const query = { ...filters, resource };

    if (resourceId) {
      // If specific resource ID is provided, we need to modify the base query
      const logs = await this.getAuditLogs(query);

      // Filter by resourceId (since it's not in the filters interface)
      logs.logs = logs.logs.filter((log) => log.resourceId === resourceId);
      logs.total = logs.logs.length;

      return logs;
    }

    return this.getAuditLogs(query);
  }

  /**
   * Clean up old audit logs
   */
  static async cleanupOldLogs(cutoffDate: Date): Promise<number> {
    try {
      const result = await AuditLog.deleteMany({
        timestamp: { $lt: cutoffDate },
      });

      // Log the cleanup action
      await this.logAction({
        adminId: 'system',
        adminEmail: 'system',
        adminRole: 'system',
        action: 'cleanup_audit_logs',
        resource: 'audit_log',
        metadata: {
          cutoffDate,
          deletedCount: result.deletedCount,
        },
        success: true,
      });

      return result.deletedCount || 0;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error cleaning up audit logs',
        error.message
      );
    }
  }

  /**
   * Export audit logs for compliance
   */
  static async exportAuditLogs(filters: AuditLogFilters = {}) {
    try {
      // Remove pagination for export
      const { page, limit, ...exportFilters } = filters;

      const query: any = {};

      if (exportFilters.adminId) query.adminId = exportFilters.adminId;
      if (exportFilters.resource) query.resource = exportFilters.resource;
      if (exportFilters.action) query.action = exportFilters.action;
      if (exportFilters.success !== undefined)
        query.success = exportFilters.success;

      if (exportFilters.startDate || exportFilters.endDate) {
        query.timestamp = {};
        if (exportFilters.startDate)
          query.timestamp.$gte = exportFilters.startDate;
        if (exportFilters.endDate) query.timestamp.$lte = exportFilters.endDate;
      }

      const logs = await AuditLog.find(query).sort({ timestamp: -1 }).lean();

      return {
        exportDate: new Date(),
        totalRecords: logs.length,
        filters: exportFilters,
        logs: logs.map((log) => ({
          id: log._id,
          adminId: log.adminId,
          adminEmail: log.adminEmail,
          adminRole: log.adminRole,
          action: log.action,
          resource: log.resource,
          resourceId: log.resourceId,
          changes: log.changes,
          metadata: log.metadata,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          success: log.success,
          errorMessage: log.errorMessage,
          timestamp: log.timestamp,
        })),
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error exporting audit logs', error.message);
    }
  }

  /**
   * Helper method to get time ago string
   */
  private static getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  /**
   * Get client IP address from request (helper for logging)
   */
  static getClientIP(req?: any): string {
    if (!req) return 'unknown';

    return (
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      'unknown'
    );
  }

  /**
   * Get user agent from request (helper for logging)
   */
  static getUserAgent(req?: any): string {
    if (!req) return 'unknown';
    return req.headers['user-agent'] || 'unknown';
  }
}

export default AuditLogService;
