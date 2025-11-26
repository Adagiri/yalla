// src/features/admin/admin.resolver.ts - Fixed to match controller
import { combineResolvers } from 'graphql-resolvers';
import AdminController from './admin.controller';
import { withFilter } from 'graphql-subscriptions';
import { SUBSCRIPTION_EVENTS } from '../../graphql/subscription-events';
import { pubsub } from '../../graphql/pubsub';
import { protectEntities } from '../../utils/auth-middleware';

const adminResolvers = {
  Query: {
    // ===== AUTHENTICATION & ADMIN MANAGEMENT =====
    getCurrentAdmin: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.getCurrentAdmin
    ),
    getAllAdmins: combineResolvers(
      protectEntities(['SUPER_ADMIN']),
      AdminController.getAllAdmins
    ),
    getAdminById: combineResolvers(
      protectEntities(['SUPER_ADMIN', 'ADMIN']),
      AdminController.getAdminById
    ),

    // ===== DASHBOARD & ANALYTICS =====
    getDashboardMetrics: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.getDashboardMetrics
    ),
    getSystemHealth: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.getSystemHealth
    ),
    getSystemHealthHistory: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.getSystemHealthHistory
    ),
    getSystemAlerts: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.getSystemAlerts
    ),

    // ===== NOTIFICATIONS =====
    getMyNotifications: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.getMyNotifications
    ),
    getNotificationStats: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.getNotificationStats
    ),

    // ===== SYSTEM CONFIGURATION =====
    getSystemConfigs: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.getSystemConfigs
    ),
    getSystemConfig: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.getSystemConfig
    ),
    getConfigsByCategory: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.getConfigsByCategory
    ),
    getConfigCategories: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.getConfigCategories
    ),

    // ===== AUDIT LOGS =====
    getAuditLogs: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.getAuditLogs
    ),
    getAuditStats: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.getAuditStats
    ),

    // ===== EMAIL TEMPLATES =====
    listEmailTemplates: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.listEmailTemplates
    ),
  },

  Mutation: {
    // ===== AUTHENTICATION =====
    adminLogin: AdminController.adminLogin,
    adminLogout: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.adminLogout
    ),

    // ===== ADMIN MANAGEMENT =====
    createAdmin: combineResolvers(
      // protectEntities(['SUPER_ADMIN']),
      AdminController.createAdmin
    ),
    updateAdmin: combineResolvers(
      protectEntities(['SUPER_ADMIN']),
      AdminController.updateAdmin
    ),
    activateAdmin: combineResolvers(
      protectEntities(['SUPER_ADMIN']),
      AdminController.activateAdmin
    ),
    deactivateAdmin: combineResolvers(
      protectEntities(['SUPER_ADMIN']),
      AdminController.deactivateAdmin
    ),
    deleteAdmin: combineResolvers(
      protectEntities(['SUPER_ADMIN']),
      AdminController.deleteAdmin
    ),

    // ===== NOTIFICATIONS =====
    createNotification: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.createNotification
    ),
    broadcastNotification: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.broadcastNotification
    ),
    markNotificationAsRead: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.markNotificationAsRead
    ),
    markAllNotificationsAsRead: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.markAllNotificationsAsRead
    ),
    deleteNotification: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.deleteNotification
    ),

    // ===== SYSTEM CONFIGURATION =====
    createSystemConfig: combineResolvers(
      protectEntities(['SUPER_ADMIN']),
      AdminController.createSystemConfig
    ),
    updateSystemConfig: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.updateSystemConfig
    ),
    deleteSystemConfig: combineResolvers(
      protectEntities(['SUPER_ADMIN']),
      AdminController.deleteSystemConfig
    ),
    bulkUpdateConfigs: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.bulkUpdateConfigs
    ),

    // ===== SYSTEM MANAGEMENT =====
    resolveSystemAlert: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.resolveSystemAlert
    ),
    triggerSystemHealthCheck: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.triggerSystemHealthCheck
    ),
    cleanupOldData: combineResolvers(
      protectEntities(['SUPER_ADMIN']),
      AdminController.cleanupOldData
    ),

    // ===== EMAIL TEMPLATES =====
    createEmailTemplate: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.createEmailTemplate
    ),
    updateEmailTemplate: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.updateEmailTemplate
    ),
    deleteEmailTemplate: combineResolvers(
      protectEntities(['ADMIN']),
      AdminController.deleteEmailTemplate
    ),
  },

  Subscription: {
    // ===== REAL-TIME NOTIFICATIONS =====
    adminNotificationReceived: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.ADMIN_NOTIFICATION),
        (payload, variables, context) => {
          const notification = payload.adminNotificationReceived;
          const adminId = context.user?.id;

          // Check if notification is for this admin
          return (
            notification.recipientId === adminId ||
            notification.recipientId === variables.adminId
          );
        }
      ),
    },

    // ===== SYSTEM MONITORING =====
    systemHealthUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.SYSTEM_HEALTH_UPDATE),
        (payload, variables, context) => {
          // Only for admins with appropriate permissions
          const user = context.user;
          return user && ['SUPER_ADMIN', 'admin'].includes(user.role);
        }
      ),
    },

    systemAlertCreated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.SYSTEM_ALERT_CREATED),
        (payload, variables, context) => {
          // Only for admins with appropriate permissions
          const user = context.user;
          return user && ['SUPER_ADMIN', 'admin'].includes(user.role);
        }
      ),
    },

    // ===== AUDIT TRAIL =====
    auditLogCreated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.AUDIT_LOG_CREATED),
        (payload, variables, context) => {
          const user = context.user;
          const auditLog = payload.auditLogCreated;

          // Filter by admin ID if specified, and check permissions
          const hasPermission =
            user && ['SUPER_ADMIN', 'admin'].includes(user.role);
          const matchesFilter =
            !variables.adminId || auditLog.adminId === variables.adminId;

          return hasPermission && matchesFilter;
        }
      ),
    },

    // ===== ADMIN ACTIVITY =====
    adminStatusChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.ADMIN_STATUS_CHANGED),
        (payload, variables, context) => {
          // Only for admins to see other admin status changes
          const user = context.user;
          return user && ['SUPER_ADMIN', 'admin'].includes(user.role);
        }
      ),
    },

    // ===== CONFIGURATION CHANGES =====
    systemConfigUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.SYSTEM_CONFIG_UPDATED),
        (payload, variables, context) => {
          const config = payload.systemConfigUpdated;
          const user = context.user;

          // Check permissions and category filter
          const hasPermission =
            user && ['SUPER_ADMIN', 'admin'].includes(user.role);
          const matchesCategory =
            !variables.category || config.category === variables.category;

          return hasPermission && matchesCategory;
        }
      ),
    },
  },
};

export default adminResolvers;
