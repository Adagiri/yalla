import { useState, useEffect, useCallback } from 'react';
import { useCustom, useCustomMutation } from '@refinedev/core';
import { notification as antNotification } from 'antd';
import type {
  AdminNotification,
  NotificationStats,
  NotificationFilters,
} from '../types/notification.types';
import {
  GET_MY_NOTIFICATIONS,
  GET_MY_NOTIFICATION_STATS,
  MARK_NOTIFICATION_AS_READ,
  MARK_ALL_NOTIFICATIONS_AS_READ,
  DELETE_NOTIFICATION,
  ADMIN_NOTIFICATION_RECEIVED,
} from '../graphql/notification.operations';

/**
 * useNotifications Hook
 *
 * Custom hook for managing admin notifications with real-time updates.
 *
 * Features:
 * - Fetch notifications with filters
 * - Real-time notification subscription
 * - Mark as read (single/all)
 * - Delete notifications
 * - Get statistics
 * - Auto-refresh
 */
export const useNotifications = (filters?: NotificationFilters) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications
  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    refetch: refetchNotifications,
  } = useCustom({
    url: '',
    method: 'post',
    config: {
      payload: {
        query: GET_MY_NOTIFICATIONS,
        variables: {
          page: filters?.page || 1,
          limit: filters?.limit || 20,
          unreadOnly: filters?.unreadOnly || false,
          category: filters?.category,
          priority: filters?.priority,
        },
      },
    },
  });

  // Fetch statistics
  const {
    data: statsData,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useCustom({
    url: '',
    method: 'post',
    config: {
      payload: {
        query: GET_MY_NOTIFICATION_STATS,
      },
    },
  });

  // Mark as read mutation
  const { mutate: markAsReadMutation } = useCustomMutation();

  // Mark all as read mutation
  const { mutate: markAllAsReadMutation } = useCustomMutation();

  // Delete mutation
  const { mutate: deleteMutation } = useCustomMutation();

  // Update local state when data changes
  useEffect(() => {
    if (notificationsData?.data?.getMyNotifications) {
      setNotifications(
        notificationsData.data.getMyNotifications.notifications
      );
      setUnreadCount(notificationsData.data.getMyNotifications.unreadCount);
    }
  }, [notificationsData]);

  useEffect(() => {
    if (statsData?.data?.getMyNotificationStats) {
      setStats(statsData.data.getMyNotificationStats);
      setUnreadCount(statsData.data.getMyNotificationStats.unread);
    }
  }, [statsData]);

  // Real-time subscription for new notifications
  // Note: This requires WebSocket setup in your GraphQL client
  // Uncomment and configure once WebSocket is set up
  /*
  useEffect(() => {
    const subscriptionClient = // your subscription client
    const subscription = subscriptionClient
      .request({
        query: ADMIN_NOTIFICATION_RECEIVED,
      })
      .subscribe({
        next: (data: any) => {
          if (data?.data?.adminNotificationReceived) {
            const newNotification = data.data.adminNotificationReceived;

            // Add to notifications list
            setNotifications((prev) => [newNotification, ...prev]);

            // Increment unread count
            setUnreadCount((prev) => prev + 1);

            // Show browser notification
            showBrowserNotification(newNotification);

            // Optionally show Ant Design notification
            showAntNotification(newNotification);
          }
        },
        error: (err) => {
          console.error('Subscription error:', err);
        },
      });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  */

  // Show browser notification (requires permission)
  const showBrowserNotification = useCallback((notification: AdminNotification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/notification-icon.png',
        badge: '/notification-badge.png',
        tag: notification.id,
      });
    }
  }, []);

  // Show Ant Design notification
  const showAntNotification = useCallback((notification: AdminNotification) => {
    const notificationConfig: any = {
      message: notification.title,
      description: notification.message,
      placement: 'topRight',
      duration: notification.priority === 'CRITICAL' ? 0 : 4.5,
    };

    switch (notification.type) {
      case 'SUCCESS':
        antNotification.success(notificationConfig);
        break;
      case 'WARNING':
        antNotification.warning(notificationConfig);
        break;
      case 'ERROR':
        antNotification.error(notificationConfig);
        break;
      case 'INFO':
      default:
        antNotification.info(notificationConfig);
        break;
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      await markAsReadMutation(
        {
          url: '',
          method: 'post',
          values: {
            query: MARK_NOTIFICATION_AS_READ,
            variables: { notificationId },
          },
        },
        {
          onSuccess: () => {
            // Update local state
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === notificationId ? { ...n, isRead: true } : n
              )
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
          },
        }
      );
    },
    [markAsReadMutation]
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    await markAllAsReadMutation(
      {
        url: '',
        method: 'post',
        values: {
          query: MARK_ALL_NOTIFICATIONS_AS_READ,
        },
      },
      {
        onSuccess: () => {
          // Update local state
          setNotifications((prev) =>
            prev.map((n) => ({ ...n, isRead: true }))
          );
          setUnreadCount(0);
        },
      }
    );
  }, [markAllAsReadMutation]);

  // Delete notification
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      await deleteMutation(
        {
          url: '',
          method: 'post',
          values: {
            query: DELETE_NOTIFICATION,
            variables: { notificationId },
          },
        },
        {
          onSuccess: () => {
            // Update local state
            setNotifications((prev) =>
              prev.filter((n) => n.id !== notificationId)
            );

            // Decrement unread count if notification was unread
            const deletedNotification = notifications.find(
              (n) => n.id === notificationId
            );
            if (deletedNotification && !deletedNotification.isRead) {
              setUnreadCount((prev) => Math.max(0, prev - 1));
            }
          },
        }
      );
    },
    [deleteMutation, notifications]
  );

  // Refresh all data
  const refreshNotifications = useCallback(async () => {
    await Promise.all([refetchNotifications(), refetchStats()]);
  }, [refetchNotifications, refetchStats]);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  return {
    notifications,
    stats,
    unreadCount,
    loading: notificationsLoading || statsLoading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestNotificationPermission,
  };
};
