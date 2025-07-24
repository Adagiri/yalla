import { combineResolvers } from 'graphql-resolvers';
import AdminController from './admin.controller';
import { withFilter } from 'graphql-subscriptions';
import { SUBSCRIPTION_EVENTS } from '../../graphql/subscription-events';
import { pubsub } from '../../graphql/pubsub';

const adminResolvers = {
  Query: {
    // ===== AUTHENTICATION & ADMIN MANAGEMENT =====
    getCurrentAdmin: combineResolvers(
      // protectAdmin,
      AdminController.getCurrentAdmin
    ),
    getAllAdmins: combineResolvers(
      // protectAdmin,
      AdminController.getAllAdmins
    ),
    getAdminById: combineResolvers(
      // protectAdmin,
      AdminController.getAdminById
    ),

    // ===== DASHBOARD & ANALYTICS =====
    getDashboardMetrics: combineResolvers(
      // protectAdmin,
      AdminController.getDashboardMetrics
    ),
    getSystemHealth: combineResolvers(
      // protectAdmin,
      AdminController.getSystemHealth
    ),

    // ===== NOTIFICATIONS =====
    getMyNotifications: combineResolvers(
      // protectAdmin,
      AdminController.getMyNotifications
    ),
    getNotificationStats: combineResolvers(
      // protectAdmin,
      AdminController.getNotificationStats
    ),

    // ===== SYSTEM CONFIGURATION =====
    getSystemConfigs: combineResolvers(
      // protectAdmin,
      AdminController.getSystemConfigs
    ),
    getSystemConfig: combineResolvers(
      // protectAdmin,
      AdminController.getSystemConfig
    ),
    getConfigsByCategory: combineResolvers(
      // protectAdmin,
      AdminController.getConfigsByCategory
    ),
    getConfigCategories: combineResolvers(
      // protectAdmin,
      AdminController.getConfigCategories
    ),

    // ===== AUDIT LOGS =====
    getAuditLogs: combineResolvers(
      // protectAdmin,
      AdminController.getAuditLogs
    ),
    getAuditStats: combineResolvers(
      // protectAdmin,
      AdminController.getAuditStats
    ),

    // ===== SYSTEM MONITORING =====
    getSystemHealthHistory: combineResolvers(
      // protectAdmin,
      AdminController.getSystemHealthHistory
    ),
    getSystemAlerts: combineResolvers(
      // protectAdmin,
      AdminController.getSystemAlerts
    ),

    // ===== EMAIL TEMPLATES (EXISTING) =====
    listEmailTemplates: combineResolvers(
      // protectAdmin,
      AdminController.listEmailTemplates
    ),
  },

  Mutation: {
    // ===== AUTHENTICATION =====
    adminLogin: combineResolvers(AdminController.adminLogin),
    adminLogout: combineResolvers(
      // protectAdmin,
      AdminController.adminLogout
    ),

    // ===== ADMIN MANAGEMENT =====
    createAdmin: combineResolvers(
      // protectSuperAdmin,
      AdminController.createAdmin
    ),
    updateAdmin: combineResolvers(
      // protectSuperAdmin,
      AdminController.updateAdmin
    ),
    activateAdmin: combineResolvers(
      // protectSuperAdmin,
      AdminController.activateAdmin
    ),
    deactivateAdmin: combineResolvers(
      // protectSuperAdmin,
      AdminController.deactivateAdmin
    ),
    deleteAdmin: combineResolvers(
      // protectSuperAdmin,
      AdminController.deleteAdmin
    ),

    // ===== NOTIFICATIONS =====
    createNotification: combineResolvers(
      // protectAdmin,
      AdminController.createNotification
    ),
    broadcastNotification: combineResolvers(
      // protectAdmin,
      AdminController.broadcastNotification
    ),
    markNotificationAsRead: combineResolvers(
      // protectAdmin,
      AdminController.markNotificationAsRead
    ),
    markAllNotificationsAsRead: combineResolvers(
      // protectAdmin,
      AdminController.markAllNotificationsAsRead
    ),
    deleteNotification: combineResolvers(
      // protectAdmin,
      AdminController.deleteNotification
    ),

    // ===== SYSTEM CONFIGURATION =====
    createSystemConfig: combineResolvers(
      // protectSuperAdmin,
      AdminController.createSystemConfig
    ),
    updateSystemConfig: combineResolvers(
      // protectAdmin,
      AdminController.updateSystemConfig
    ),
    deleteSystemConfig: combineResolvers(
      // protectSuperAdmin,
      AdminController.deleteSystemConfig
    ),
    bulkUpdateConfigs: combineResolvers(
      // protectAdmin,
      AdminController.bulkUpdateConfigs
    ),

    // ===== SYSTEM MANAGEMENT =====
    resolveSystemAlert: combineResolvers(
      // protectAdmin,
      AdminController.resolveSystemAlert
    ),
    triggerSystemHealthCheck: combineResolvers(
      // protectAdmin,
      AdminController.triggerSystemHealthCheck
    ),
    cleanupOldData: combineResolvers(
      // protectSuperAdmin,
      AdminController.cleanupOldData
    ),

    // ===== EMAIL TEMPLATES (EXISTING) =====
    createEmailTemplate: combineResolvers(
      // protectAdmin,
      AdminController.createEmailTemplate
    ),
    updateEmailTemplate: combineResolvers(
      // protectAdmin,
      AdminController.updateEmailTemplate
    ),
    deleteEmailTemplate: combineResolvers(
      // protectAdmin,
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
          return user && ['super_admin', 'admin'].includes(user.role);
        }
      ),
    },

    systemAlertCreated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.SYSTEM_ALERT_CREATED),
        (payload, variables, context) => {
          // Only for admins with appropriate permissions
          const user = context.user;
          return user && ['super_admin', 'admin'].includes(user.role);
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
            user && ['super_admin', 'admin'].includes(user.role);
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
          return user && ['super_admin', 'admin'].includes(user.role);
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
            user && ['super_admin', 'admin'].includes(user.role);
          const matchesCategory =
            !variables.category || config.category === variables.category;

          return hasPermission && matchesCategory;
        }
      ),
    },
  },
};

export default adminResolvers;
