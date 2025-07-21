import AdminNotification from './admin-notification.model';
import AuditLogService from './audit-log.service';
import NotificationService from '../../services/notification.services';
import { ErrorResponse } from '../../utils/responses';

export interface CreateAdminNotificationInput {
  recipients: string[]; // admin IDs
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string; // e.g., 'system', 'payment', 'user_activity', 'security'
  actionRequired?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: any;
  senderId: string;
  senderEmail: string;
}

export interface BroadcastNotificationInput {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  targetRoles?: string[]; // If specified, only send to admins with these roles
  targetDepartments?: string[]; // If specified, only send to admins in these departments
  actionRequired?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: any;
  senderId: string;
  senderEmail: string;
}

class AdminNotificationService {
  /**
   * Create notification for specific admins
   */
  static async createNotification(input: CreateAdminNotificationInput) {
    try {
      const notifications = input.recipients.map((recipientId) => ({
        recipientId,
        senderId: input.senderId,
        title: input.title,
        message: input.message,
        type: input.type,
        priority: input.priority,
        category: input.category,
        actionRequired: input.actionRequired || false,
        actionUrl: input.actionUrl,
        actionLabel: input.actionLabel,
        metadata: input.metadata,
      }));

      const createdNotifications =
        await AdminNotification.insertMany(notifications);

      // Send real-time notifications (if using subscriptions/websockets)
      for (const recipientId of input.recipients) {
        await this.sendRealTimeNotification(recipientId, {
          id: createdNotifications.find((n) => n.recipientId === recipientId)
            ?._id,
          title: input.title,
          message: input.message,
          type: input.type,
          priority: input.priority,
          actionRequired: input.actionRequired,
          actionUrl: input.actionUrl,
          actionLabel: input.actionLabel,
        });
      }

      // Log the action
      await AuditLogService.logAction({
        adminId: input.senderId,
        adminEmail: input.senderEmail,
        adminRole: 'system', // This would come from the actual admin
        action: 'create_notification',
        resource: 'admin_notification',
        success: true,
        changes: {
          after: {
            recipients: input.recipients,
            title: input.title,
            type: input.type,
            priority: input.priority,
          },
        },
      });

      return createdNotifications;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error creating admin notification',
        error.message
      );
    }
  }

  /**
   * Broadcast notification to multiple admins based on criteria
   */
  static async broadcastNotification(input: BroadcastNotificationInput) {
    try {
      // Get target admins based on roles and departments
      const Admin = require('./admin.model').default;

      const query: any = { isActive: true };

      if (input.targetRoles?.length) {
        query.role = { $in: input.targetRoles };
      }

      if (input.targetDepartments?.length) {
        query.department = { $in: input.targetDepartments };
      }

      const targetAdmins = await Admin.find(query, '_id').lean();
      const recipientIds = targetAdmins.map((admin: any) => admin._id);

      if (recipientIds.length === 0) {
        return { sent: 0, message: 'No matching admins found' };
      }

      // Create notifications
      const result = await this.createNotification({
        recipients: recipientIds,
        title: input.title,
        message: input.message,
        type: input.type,
        priority: input.priority,
        category: input.category,
        actionRequired: input.actionRequired,
        actionUrl: input.actionUrl,
        actionLabel: input.actionLabel,
        metadata: input.metadata,
        senderId: input.senderId,
        senderEmail: input.senderEmail,
      });

      return {
        sent: recipientIds.length,
        recipients: recipientIds,
        notifications: result,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error broadcasting notification',
        error.message
      );
    }
  }

  /**
   * Get notifications for an admin
   */
  static async getAdminNotifications(
    adminId: string,
    filters: {
      isRead?: boolean;
      type?: string;
      priority?: string;
      category?: string;
      actionRequired?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    const {
      isRead,
      type,
      priority,
      category,
      actionRequired,
      page = 1,
      limit = 20,
    } = filters;

    const query: any = { recipientId: adminId };

    if (isRead !== undefined) query.isRead = isRead;
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    if (actionRequired !== undefined) query.actionRequired = actionRequired;

    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      AdminNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('senderId', 'firstname lastname email')
        .lean(),
      AdminNotification.countDocuments(query),
      AdminNotification.countDocuments({
        recipientId: adminId,
        isRead: false,
      }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, adminId: string) {
    try {
      const notification = await AdminNotification.findOneAndUpdate(
        { _id: notificationId, recipientId: adminId },
        {
          isRead: true,
          readAt: new Date(),
        },
        { new: true }
      );

      if (!notification) {
        throw new ErrorResponse(404, 'Notification not found');
      }

      return notification;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error marking notification as read',
        error.message
      );
    }
  }

  /**
   * Mark all notifications as read for an admin
   */
  static async markAllAsRead(adminId: string) {
    try {
      const result = await AdminNotification.updateMany(
        { recipientId: adminId, isRead: false },
        {
          isRead: true,
          readAt: new Date(),
        }
      );

      return {
        modifiedCount: result.modifiedCount,
        message: `Marked ${result.modifiedCount} notifications as read`,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error marking all notifications as read',
        error.message
      );
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId: string, adminId: string) {
    try {
      const notification = await AdminNotification.findOneAndDelete({
        _id: notificationId,
        recipientId: adminId,
      });

      if (!notification) {
        throw new ErrorResponse(404, 'Notification not found');
      }

      return { success: true, message: 'Notification deleted successfully' };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error deleting notification',
        error.message
      );
    }
  }

  /**
   * Get notification statistics for admin dashboard
   */
  static async getNotificationStats(adminId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalNotifications,
      unreadNotifications,
      criticalNotifications,
      actionRequiredNotifications,
      categoryStats,
      priorityStats,
    ] = await Promise.all([
      AdminNotification.countDocuments({
        recipientId: adminId,
        createdAt: { $gte: startDate },
      }),
      AdminNotification.countDocuments({
        recipientId: adminId,
        isRead: false,
      }),
      AdminNotification.countDocuments({
        recipientId: adminId,
        priority: 'critical',
        isRead: false,
      }),
      AdminNotification.countDocuments({
        recipientId: adminId,
        actionRequired: true,
        isRead: false,
      }),
      AdminNotification.aggregate([
        {
          $match: {
            recipientId: adminId,
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            unread: {
              $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] },
            },
          },
        },
        { $sort: { count: -1 } },
      ]),
      AdminNotification.aggregate([
        {
          $match: {
            recipientId: adminId,
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 },
            unread: {
              $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    return {
      total: totalNotifications,
      unread: unreadNotifications,
      critical: criticalNotifications,
      actionRequired: actionRequiredNotifications,
      byCategory: categoryStats,
      byPriority: priorityStats,
    };
  }

  /**
   * System alert notifications
   */
  static async createSystemAlert(alert: {
    title: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    component: string;
    metadata?: any;
  }) {
    // Determine target roles based on severity
    let targetRoles = ['super_admin'];

    if (alert.severity === 'critical') {
      targetRoles = ['super_admin', 'admin'];
    } else if (alert.severity === 'high') {
      targetRoles = ['super_admin', 'admin', 'manager'];
    }

    return await this.broadcastNotification({
      title: `🚨 System Alert: ${alert.title}`,
      message: alert.message,
      type: alert.severity === 'critical' ? 'error' : 'warning',
      priority: alert.severity,
      category: 'system_alert',
      targetRoles,
      actionRequired: alert.severity === 'critical',
      metadata: {
        component: alert.component,
        ...alert.metadata,
      },
      senderId: 'system',
      senderEmail: 'system@yourapp.com',
    });
  }

  /**
   * Send real-time notification (WebSocket/GraphQL subscription)
   */
  private static async sendRealTimeNotification(
    recipientId: string,
    data: any
  ) {
    try {
      // If using WebSocket
      if (global.websocketService) {
        global.websocketService.sendToUser(
          recipientId,
          'admin_notification',
          data
        );
      }

      // If using GraphQL subscriptions, you would publish here
      // pubsub.publish('ADMIN_NOTIFICATION', { adminId: recipientId, notification: data });
    } catch (error) {
      console.error('Error sending real-time notification:', error);
    }
  }

  /**
   * Clean up old notifications
   */
  static async cleanupOldNotifications(daysToKeep: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      const result = await AdminNotification.deleteMany({
        createdAt: { $lt: cutoffDate },
        isRead: true, // Only delete read notifications
      });

      console.log(
        `🧹 Cleaned up ${result.deletedCount} old admin notifications`
      );
      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      throw error;
    }
  }
}

export default AdminNotificationService;
