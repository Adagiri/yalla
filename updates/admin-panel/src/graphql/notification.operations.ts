/**
 * Admin Notification GraphQL Operations
 *
 * This file contains all GraphQL queries, mutations, and subscriptions
 * for the admin notification system.
 */

// ============================================================================
// QUERIES
// ============================================================================

export const GET_MY_NOTIFICATIONS = `
  query GetMyNotifications(
    $page: Int
    $limit: Int
    $unreadOnly: Boolean
    $category: String
    $priority: String
  ) {
    getMyNotifications(
      page: $page
      limit: $limit
      unreadOnly: $unreadOnly
      category: $category
      priority: $priority
    ) {
      notifications {
        id
        recipientId
        senderId
        title
        message
        type
        priority
        category
        actionRequired
        actionUrl
        actionLabel
        isRead
        readAt
        metadata
        timeAgo
        createdAt
        updatedAt
      }
      total
      unreadCount
      page
      totalPages
      hasNextPage
      hasPreviousPage
    }
  }
`;

export const GET_MY_NOTIFICATION_STATS = `
  query GetMyNotificationStats {
    getMyNotificationStats {
      total
      unread
      critical
      actionRequired
      byCategory {
        category
        count
        unread
      }
      byPriority {
        priority
        count
        unread
      }
    }
  }
`;

// ============================================================================
// MUTATIONS
// ============================================================================

export const CREATE_ADMIN_NOTIFICATION = `
  mutation CreateAdminNotification($input: CreateNotificationInput!) {
    createAdminNotification(input: $input) {
      id
      recipientId
      title
      message
      type
      priority
      category
      actionRequired
      actionUrl
      actionLabel
      isRead
      createdAt
    }
  }
`;

export const BROADCAST_NOTIFICATION = `
  mutation BroadcastNotification($input: BroadcastNotificationInput!) {
    broadcastNotification(input: $input) {
      sent
      target
      recipients
      title
      message
    }
  }
`;

export const CREATE_SYSTEM_NOTIFICATION = `
  mutation CreateSystemNotification($input: CreateSystemNotificationInput!) {
    createSystemNotification(input: $input) {
      sent
      recipients
      title
      message
    }
  }
`;

export const MARK_NOTIFICATION_AS_READ = `
  mutation MarkNotificationAsRead($notificationId: ID!) {
    markNotificationAsRead(notificationId: $notificationId) {
      id
      isRead
      readAt
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_AS_READ = `
  mutation MarkAllNotificationsAsRead {
    markAllNotificationsAsRead {
      success
      markedCount
    }
  }
`;

export const DELETE_NOTIFICATION = `
  mutation DeleteNotification($notificationId: ID!) {
    deleteNotification(notificationId: $notificationId) {
      success
      message
    }
  }
`;

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export const ADMIN_NOTIFICATION_RECEIVED = `
  subscription AdminNotificationReceived {
    adminNotificationReceived {
      id
      recipientId
      senderId
      title
      message
      type
      priority
      category
      actionRequired
      actionUrl
      actionLabel
      isRead
      readAt
      metadata
      timeAgo
      createdAt
      updatedAt
    }
  }
`;
