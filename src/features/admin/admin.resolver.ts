import { combineResolvers } from 'graphql-resolvers';
import AdminController from './admin.controller';
import { withFilter } from 'graphql-subscriptions';
import { SUBSCRIPTION_EVENTS } from '../../graphql/subscription-events';
import { pubsub } from '../../graphql/pubsub';

const adminResolvers = {
  Query: {
    listEmailTemplates: combineResolvers(
      // protectAdmin,
      AdminController.listEmailTemplates
    ),
  },

  Mutation: {
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
    // Admin receives notifications
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

    // System health monitoring
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

    // Audit log streaming
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

    // System configuration changes
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
