import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface AdminNotificationDocument extends Document {
  _id: string;

  // Recipients and sender
  recipientId: string; // Admin who receives the notification
  senderId?: string; // Admin who sent the notification (or 'system')

  // Notification content
  title: string;
  message: string;

  // Classification
  type: 'info' | 'warning' | 'error' | 'success';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string; // 'system', 'payment', 'user_activity', 'security', etc.

  // Action information
  actionRequired: boolean;
  actionUrl?: string; // URL to navigate to for action
  actionLabel?: string; // Button text like "Review", "Approve", "Fix Now"

  // Status
  isRead: boolean;
  readAt?: Date;

  // Additional data
  metadata?: any; // Extra data related to the notification

  // Timestamps
  expiresAt?: Date; // Auto-expire notifications
  createdAt: Date;
  updatedAt: Date;
}

const adminNotificationSchema = new Schema<AdminNotificationDocument>(
  {
    _id: { type: String, default: uuidv4 },

    // Recipients and sender
    recipientId: {
      type: String,
      required: true,
      ref: 'Admin',
      index: true,
    },
    senderId: {
      type: String,
      ref: 'Admin',
      default: 'system',
    },

    // Content
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },

    // Classification
    type: {
      type: String,
      enum: ['info', 'warning', 'error', 'success'],
      default: 'info',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true,
    },

    // Action
    actionRequired: {
      type: Boolean,
      default: false,
      index: true,
    },
    actionUrl: { type: String },
    actionLabel: { type: String },

    // Status
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: { type: Date },

    // Additional data
    metadata: { type: Schema.Types.Mixed },

    // Expiration
    expiresAt: {
      type: Date,
      index: { expireAfterSeconds: 0 }, // TTL index
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
adminNotificationSchema.index({ recipientId: 1, isRead: 1 });
adminNotificationSchema.index({ recipientId: 1, createdAt: -1 });
adminNotificationSchema.index({ recipientId: 1, priority: 1, isRead: 1 });
adminNotificationSchema.index({ category: 1, type: 1 });
adminNotificationSchema.index({ actionRequired: 1, isRead: 1 });

// Index for cleanup queries
adminNotificationSchema.index({ createdAt: 1, isRead: 1 });

// Pre-save middleware to set expiration for low priority notifications
adminNotificationSchema.pre('save', function (next) {
  if (this.isNew && this.priority === 'low' && !this.expiresAt) {
    // Low priority notifications expire after 30 days
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    this.expiresAt = expiry;
  }

  if (this.isNew && this.priority === 'medium' && !this.expiresAt) {
    // Medium priority notifications expire after 60 days
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 60);
    this.expiresAt = expiry;
  }

  // High and critical notifications don't auto-expire

  next();
});

// Virtual for formatted creation time
adminNotificationSchema.virtual('timeAgo').get(function () {
  const now = new Date();
  const diff = now.getTime() - this.createdAt.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
});

// Static method to get unread count
adminNotificationSchema.statics.getUnreadCount = async function (
  adminId: string
) {
  return await this.countDocuments({
    recipientId: adminId,
    isRead: false,
  });
};

// Static method to get priority counts
adminNotificationSchema.statics.getPriorityCounts = async function (
  adminId: string
) {
  const counts = await this.aggregate([
    {
      $match: {
        recipientId: adminId,
        isRead: false,
      },
    },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  counts.forEach((item: any) => {
    result[item._id as keyof typeof result] = item.count;
  });

  return result;
};

// Static method to mark notifications as read
adminNotificationSchema.statics.markAsReadByCategory = async function (
  adminId: string,
  category: string
) {
  return await this.updateMany(
    {
      recipientId: adminId,
      category,
      isRead: false,
    },
    {
      isRead: true,
      readAt: new Date(),
    }
  );
};

// Static method to create system notification
adminNotificationSchema.statics.createSystemNotification =
  async function (data: {
    recipientId: string;
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'error' | 'success';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    actionRequired?: boolean;
    actionUrl?: string;
    actionLabel?: string;
    metadata?: any;
  }) {
    return await this.create({
      ...data,
      senderId: 'system',
      type: data.type || 'info',
      priority: data.priority || 'medium',
      actionRequired: data.actionRequired || false,
    });
  };

// Static method for bulk operations
adminNotificationSchema.statics.bulkCreate = async function (
  notifications: any[]
) {
  return await this.insertMany(notifications, { ordered: false });
};

// Method to convert to safe object (for API responses)
adminNotificationSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  return {
    id: obj._id,
    title: obj.title,
    message: obj.message,
    type: obj.type,
    priority: obj.priority,
    category: obj.category,
    actionRequired: obj.actionRequired,
    actionUrl: obj.actionUrl,
    actionLabel: obj.actionLabel,
    isRead: obj.isRead,
    readAt: obj.readAt,
    metadata: obj.metadata,
    timeAgo: this.timeAgo,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

export default mongoose.model<AdminNotificationDocument>(
  'AdminNotification',
  adminNotificationSchema
);
