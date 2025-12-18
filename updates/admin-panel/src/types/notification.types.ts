/**
 * Admin Notification TypeScript Type Definitions
 *
 * This file contains all TypeScript interfaces and enums for the admin notification system.
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum NotificationType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum BroadcastTarget {
  ALL_ADMINS = 'ALL_ADMINS',
  SUPER_ADMINS = 'SUPER_ADMINS',
  SPECIFIC_ROLE = 'SPECIFIC_ROLE',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface AdminNotification {
  id: string;
  recipientId: string;
  senderId?: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  category: string;
  actionRequired: boolean;
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
  readAt?: string;
  metadata?: any;
  timeAgo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryStats {
  category: string;
  count: number;
  unread: number;
}

export interface PriorityStats {
  priority: string;
  count: number;
  unread: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  critical: number;
  actionRequired: number;
  byCategory: CategoryStats[];
  byPriority: PriorityStats[];
}

export interface NotificationList {
  notifications: AdminNotification[];
  total: number;
  unreadCount: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface MarkAllAsReadResponse {
  success: boolean;
  markedCount: number;
}

export interface DeleteNotificationResponse {
  success: boolean;
  message: string;
}

export interface BroadcastResponse {
  sent: number;
  target: string;
  recipients: number;
  title: string;
  message: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateNotificationInput {
  recipientId: string;
  title: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  category: string;
  actionRequired?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: any;
}

export interface BroadcastNotificationInput {
  title: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  category: string;
  target: BroadcastTarget;
  targetRole?: string;
  actionRequired?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: any;
}

export interface CreateSystemNotificationInput {
  title: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  category: string;
  actionRequired?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: any;
  targetAdmins?: string[];
}

// ============================================================================
// FILTER/QUERY TYPES
// ============================================================================

export interface NotificationFilters {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  category?: string;
  priority?: string;
}

// ============================================================================
// NOTIFICATION CATEGORIES
// ============================================================================

export const NOTIFICATION_CATEGORIES = {
  SYSTEM: 'system',
  PAYMENT: 'payment',
  USER_ACTIVITY: 'user_activity',
  SECURITY: 'security',
  REFERRAL: 'referral',
  TRIP: 'trip',
  DRIVER: 'driver',
  CUSTOMER: 'customer',
  MAINTENANCE: 'maintenance',
  ANALYTICS: 'analytics',
} as const;

export type NotificationCategory =
  (typeof NOTIFICATION_CATEGORIES)[keyof typeof NOTIFICATION_CATEGORIES];

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Notification with color coding for UI
 */
export interface NotificationWithColors extends AdminNotification {
  typeColor: string;
  priorityColor: string;
  icon: string;
}

/**
 * Grouped notifications by category or priority
 */
export interface GroupedNotifications {
  [key: string]: AdminNotification[];
}
