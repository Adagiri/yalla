import React, { useState, useEffect } from 'react';
import {
  Badge,
  Dropdown,
  List,
  Button,
  Typography,
  Space,
  Tag,
  Empty,
  Spin,
  Divider,
  message,
} from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigation } from '@refinedev/core';
import type {
  AdminNotification,
  NotificationType,
  NotificationPriority,
} from '../types/notification.types';
import { useNotifications } from '../hooks/useNotifications';

const { Text, Link } = Typography;

/**
 * NotificationBell Component
 *
 * Displays a bell icon in the header with a badge showing unread count.
 * Clicking opens a dropdown showing recent notifications.
 *
 * Features:
 * - Real-time updates via GraphQL subscription
 * - Mark as read (single/all)
 * - Delete notifications
 * - Navigate to notification page
 * - Priority and type indicators
 */
export const NotificationBell: React.FC = () => {
  const { push } = useNavigation();
  const [dropdownVisible, setDropdownVisible] = useState(false);

  // Use the notification hook for data and operations
  const {
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // Get type color for tags
  const getTypeColor = (type: NotificationType): string => {
    switch (type) {
      case 'SUCCESS':
        return 'success';
      case 'WARNING':
        return 'warning';
      case 'ERROR':
        return 'error';
      case 'INFO':
      default:
        return 'blue';
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority: NotificationPriority): string => {
    switch (priority) {
      case 'CRITICAL':
        return '#ff4d4f';
      case 'HIGH':
        return '#ff7a45';
      case 'MEDIUM':
        return '#ffa940';
      case 'LOW':
      default:
        return '#91d5ff';
    }
  };

  // Handle mark as read
  const handleMarkAsRead = async (
    e: React.MouseEvent,
    notificationId: string
  ) => {
    e.stopPropagation();
    try {
      await markAsRead(notificationId);
      message.success('Marked as read');
    } catch (error) {
      message.error('Failed to mark as read');
    }
  };

  // Handle delete
  const handleDelete = async (
    e: React.MouseEvent,
    notificationId: string
  ) => {
    e.stopPropagation();
    try {
      await deleteNotification(notificationId);
      message.success('Notification deleted');
    } catch (error) {
      message.error('Failed to delete notification');
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      message.success('All notifications marked as read');
    } catch (error) {
      message.error('Failed to mark all as read');
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: AdminNotification) => {
    // Mark as read if unread
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // Navigate to action URL if available
    if (notification.actionUrl) {
      push(notification.actionUrl);
    }

    setDropdownVisible(false);
  };

  // Dropdown menu content
  const dropdownContent = (
    <div
      style={{
        width: 400,
        maxHeight: 600,
        backgroundColor: '#fff',
        borderRadius: 8,
        boxShadow: '0 3px 6px -4px rgba(0,0,0,.12), 0 6px 16px 0 rgba(0,0,0,.08)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Text strong style={{ fontSize: 16 }}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <Tag color="blue" style={{ borderRadius: 10 }}>
              {unreadCount} new
            </Tag>
          )}
        </Space>
        <Space>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={refreshNotifications}
            loading={loading}
          />
          {unreadCount > 0 && (
            <Button
              type="text"
              size="small"
              icon={<CheckOutlined />}
              onClick={handleMarkAllAsRead}
            >
              Mark all read
            </Button>
          )}
        </Space>
      </div>

      {/* Notifications List */}
      <div style={{ maxHeight: 450, overflowY: 'auto' }}>
        {loading && notifications.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <Spin />
          </div>
        ) : notifications.length === 0 ? (
          <Empty
            description="No notifications"
            style={{ padding: '40px 0' }}
          />
        ) : (
          <List
            dataSource={notifications.slice(0, 10)}
            renderItem={(notification) => (
              <List.Item
                key={notification.id}
                style={{
                  padding: '12px 16px',
                  cursor: notification.actionUrl ? 'pointer' : 'default',
                  backgroundColor: notification.isRead
                    ? '#fff'
                    : '#f0f5ff',
                  borderLeft: `4px solid ${getPriorityColor(notification.priority)}`,
                }}
                onClick={() => handleNotificationClick(notification)}
                actions={[
                  !notification.isRead && (
                    <Button
                      type="text"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={(e) => handleMarkAsRead(e, notification.id)}
                    />
                  ),
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => handleDelete(e, notification.id)}
                  />,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ flex: 1 }}>
                          {notification.title}
                        </Text>
                        <Tag color={getTypeColor(notification.type)} style={{ margin: 0 }}>
                          {notification.type}
                        </Tag>
                      </div>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {notification.message}
                      </Text>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={4}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {notification.timeAgo}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            •
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {notification.category}
                          </Text>
                        </Space>
                        {notification.actionRequired && (
                          <Tag color="red" style={{ fontSize: 11, margin: 0 }}>
                            Action Required
                          </Tag>
                        )}
                      </div>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <>
          <Divider style={{ margin: 0 }} />
          <div style={{ padding: '12px 16px', textAlign: 'center' }}>
            <Link onClick={() => {
              setDropdownVisible(false);
              push('/notifications');
            }}>
              View all notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );

  return (
    <Dropdown
      open={dropdownVisible}
      onOpenChange={setDropdownVisible}
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge count={unreadCount} offset={[-5, 5]} overflowCount={99}>
        <Button
          type="text"
          icon={
            <BellOutlined
              style={{
                fontSize: 20,
                color: unreadCount > 0 ? '#1890ff' : '#595959',
              }}
            />
          }
          style={{ display: 'flex', alignItems: 'center', height: 48 }}
        />
      </Badge>
    </Dropdown>
  );
};
