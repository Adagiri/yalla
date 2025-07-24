import AdminNotification from './admin-notification.model';
import { ErrorResponse } from '../../utils/responses';
import { pubsub } from '../../graphql/pubsub';
import { SUBSCRIPTION_EVENTS } from '../../graphql/subscription-events';

interface NotificationInput {
  recipientId: string;
  senderId: string;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  actionRequired?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: any;
}

interface BroadcastInput {
  senderId: string;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  target: 'ALL_ADMINS' | 'SUPER_ADMINS' | 'SPECIFIC_ROLE';
  targetRole?: string;
  actionRequired?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: any;
}

class AdminNotificationService {
  /**
   * Get notifications for a specific admin
   */
  static async getAdminNotifications(
    adminId: string,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      category?: string;
      priority?: string;
    } = {}
  ) {
    const {
      page = 1,
      limit = 20,
      unreadOnly = false,
      category,
      priority,
    } = options;

    const query: any = { recipientId: adminId };

    if (unreadOnly) query.isRead = false;
    if (category) query.category = category;
    if (priority) query.priority = priority;

    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      AdminNotification.find(query)
        .populate('sender', 'firstname lastname email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdminNotification.countDocuments(query),
      AdminNotification.countDocuments({ recipientId: adminId, isRead: false }),
    ]);

    return {
      notifications: notifications.map((n) => ({
        ...n,
        id: n._id,
        timeAgo: this.getTimeAgo(n.createdAt),
      })),
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Get notification statistics for an admin
   */
  static async getNotificationStats(adminId: string) {
    const [total, unread, critical, actionRequired, byCategory, byPriority] =
      await Promise.all([
        AdminNotification.countDocuments({ recipientId: adminId }),
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
          { $match: { recipientId: adminId } },
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
          { $match: { recipientId: adminId } },
          {
            $group: {
              _id: '$priority',
              count: { $sum: 1 },
              unread: {
                $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] },
              },
            },
          },
          { $sort: { count: -1 } },
        ]),
      ]);

    return {
      total,
      unread,
      critical,
      actionRequired,
      byCategory: byCategory.map((item) => ({
        category: item._id,
        count: item.count,
        unread: item.unread,
      })),
      byPriority: byPriority.map((item) => ({
        priority: item._id,
        count: item.count,
        unread: item.unread,
      })),
    };
  }

  /**
   * Create a new notification
   */
  static async createNotification(input: NotificationInput) {
    try {
      const notification = new AdminNotification({
        recipientId: input.recipientId,
        senderId: input.senderId,
        title: input.title,
        message: input.message,
        type: input.type || 'info',
        priority: input.priority || 'medium',
        category: input.category,
        actionRequired: input.actionRequired || false,
        actionUrl: input.actionUrl,
        actionLabel: input.actionLabel,
        metadata: input.metadata,
      });

      await notification.save();

      // Populate sender for real-time notification
      await notification.populate('sender', 'firstname lastname email');

      // Publish real-time notification
      pubsub.publish(SUBSCRIPTION_EVENTS.ADMIN_NOTIFICATION, {
        adminNotificationReceived: notification.toSafeObject(),
      });

      return notification.toSafeObject();
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error creating notification',
        error.message
      );
    }
  }

  /**
   * Broadcast notification to multiple admins
   */
  static async broadcastNotification(input: BroadcastInput) {
    try {
      const Admin = require('./admin.model').default;

      // Determine recipients based on target
      let recipients: string[] = [];

      switch (input.target) {
        case 'ALL_ADMINS':
          const allAdmins = await Admin.find({ isActive: true }).select('_id');
          recipients = allAdmins.map((admin: any) => admin._id.toString());
          break;

        case 'SUPER_ADMINS':
          const superAdmins = await Admin.find({
            isActive: true,
            role: 'SUPER_ADMIN',
          }).select('_id');
          recipients = superAdmins.map((admin: any) => admin._id.toString());
          break;

        case 'SPECIFIC_ROLE':
          if (!input.targetRole) {
            throw new ErrorResponse(
              400,
              'Target role is required for SPECIFIC_ROLE target'
            );
          }
          const roleAdmins = await Admin.find({
            isActive: true,
            role: input.targetRole,
          }).select('_id');
          recipients = roleAdmins.map((admin: any) => admin._id.toString());
          break;

        default:
          throw new ErrorResponse(400, 'Invalid broadcast target');
      }

      // Create notifications for all recipients
      const notifications = recipients.map((recipientId) => ({
        recipientId,
        senderId: input.senderId,
        title: input.title,
        message: input.message,
        type: input.type || 'info',
        priority: input.priority || 'medium',
        category: input.category,
        actionRequired: input.actionRequired || false,
        actionUrl: input.actionUrl,
        actionLabel: input.actionLabel,
        metadata: input.metadata,
      }));

      const savedNotifications =
        await AdminNotification.insertMany(notifications);

        console.log(typeof savedNotifications[0].createdAt)

      // Publish real-time notifications
      savedNotifications.forEach((notification) => {
        pubsub.publish(SUBSCRIPTION_EVENTS.ADMIN_NOTIFICATION, {
          adminNotificationReceived: notification.toSafeObject(),
        });
      });

      return {
        sent: savedNotifications.length,
        target: input.target,
        recipients: recipients.length,
        title: input.title,
        message: input.message,
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

      return notification.toSafeObject();
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
        success: true,
        markedCount: result.modifiedCount,
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

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error deleting notification',
        error.message
      );
    }
  }

  /**
   * Create system notification
   */
  static async createSystemNotification(data: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'error' | 'success';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    actionRequired?: boolean;
    actionUrl?: string;
    actionLabel?: string;
    metadata?: any;
    targetAdmins?: string[]; // If not provided, send to all admins
  }) {
    try {
      const Admin = require('./admin.model').default;

      let recipients: string[] = [];

      if (data.targetAdmins && data.targetAdmins.length > 0) {
        recipients = data.targetAdmins;
      } else {
        // Send to all active admins
        const allAdmins = await Admin.find({ isActive: true }).select('_id');
        recipients = allAdmins.map((admin: any) => admin._id.toString());
      }

      const notifications = recipients.map((recipientId) => ({
        recipientId,
        senderId: 'system',
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        priority: data.priority || 'medium',
        category: data.category,
        actionRequired: data.actionRequired || false,
        actionUrl: data.actionUrl,
        actionLabel: data.actionLabel,
        metadata: data.metadata,
      }));

      const savedNotifications =
        await AdminNotification.insertMany(notifications);

      // Publish real-time notifications
      savedNotifications.forEach((notification) => {
        pubsub.publish(SUBSCRIPTION_EVENTS.ADMIN_NOTIFICATION, {
          adminNotificationReceived: notification.toSafeObject(),
        });
      });

      return {
        sent: savedNotifications.length,
        recipients: recipients.length,
        title: data.title,
        message: data.message,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error creating system notification',
        error.message
      );
    }
  }

  /**
   * Helper method to calculate time ago
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
}

export default AdminNotificationService;
