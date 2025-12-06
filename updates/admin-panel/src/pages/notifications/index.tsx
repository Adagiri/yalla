import React, { useState } from 'react';
import {
  Card,
  List,
  Typography,
  Space,
  Tag,
  Button,
  Statistic,
  Row,
  Col,
  Select,
  Input,
  Checkbox,
  Empty,
  Spin,
  Drawer,
  Descriptions,
  message,
  Popconfirm,
} from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  ReloadOutlined,
  FilterOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNotifications } from '../../hooks/useNotifications';
import type {
  AdminNotification,
  NotificationType,
  NotificationPriority,
} from '../../types/notification.types';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

/**
 * Notifications Page
 *
 * Full-featured notification management page for admins.
 *
 * Features:
 * - View all notifications with pagination
 * - Filter by category, priority, read status
 * - Search notifications
 * - Mark as read (single/all)
 * - Delete notifications (single/multiple)
 * - View detailed notification information
 * - Statistics dashboard
 */
export const NotificationsPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedPriority, setSelectedPriority] = useState<string | undefined>();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotification, setSelectedNotification] = useState<AdminNotification | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Use notifications hook
  const {
    notifications,
    stats,
    unreadCount,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications({
    category: selectedCategory,
    priority: selectedPriority,
    unreadOnly: showUnreadOnly,
  });

  // Filter notifications by search query
  const filteredNotifications = notifications.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get type icon
  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'SUCCESS':
        return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />;
      case 'WARNING':
        return <WarningOutlined style={{ color: '#faad14', fontSize: 20 }} />;
      case 'ERROR':
        return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />;
      case 'INFO':
      default:
        return <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 20 }} />;
    }
  };

  // Get type color
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

  // Get priority color
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
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
      message.success('Marked as read');
    } catch (error) {
      message.error('Failed to mark as read');
    }
  };

  // Handle delete
  const handleDelete = async (notificationId: string) => {
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

  // Handle notification click to view details
  const handleViewDetails = (notification: AdminNotification) => {
    setSelectedNotification(notification);
    setDrawerVisible(true);

    // Mark as read if unread
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <BellOutlined /> Notifications
        </Title>
        <Text type="secondary">
          Manage and view all your system notifications
        </Text>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Notifications"
                value={stats.total}
                prefix={<BellOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Unread"
                value={stats.unread}
                valueStyle={{ color: '#1890ff' }}
                prefix={<InfoCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Critical"
                value={stats.critical}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Action Required"
                value={stats.actionRequired}
                valueStyle={{ color: '#faad14' }}
                prefix={<CheckOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters and Actions */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} md={6}>
            <Search
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Category"
              allowClear
              value={selectedCategory}
              onChange={setSelectedCategory}
            >
              {stats?.byCategory.map((cat) => (
                <Select.Option key={cat.category} value={cat.category}>
                  {cat.category} ({cat.count})
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Priority"
              allowClear
              value={selectedPriority}
              onChange={setSelectedPriority}
            >
              <Select.Option value="critical">Critical</Select.Option>
              <Select.Option value="high">High</Select.Option>
              <Select.Option value="medium">Medium</Select.Option>
              <Select.Option value="low">Low</Select.Option>
            </Select>
          </Col>
          <Col xs={24} md={4}>
            <Checkbox
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
            >
              Unread only
            </Checkbox>
          </Col>
          <Col xs={24} md={6} style={{ textAlign: 'right' }}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={refreshNotifications}
                loading={loading}
              >
                Refresh
              </Button>
              {unreadCount > 0 && (
                <Popconfirm
                  title="Mark all as read?"
                  onConfirm={handleMarkAllAsRead}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button icon={<CheckOutlined />} type="primary">
                    Mark All Read
                  </Button>
                </Popconfirm>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Notifications List */}
      <Card>
        {loading && filteredNotifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <Empty
            description="No notifications found"
            style={{ padding: '60px 0' }}
          />
        ) : (
          <List
            dataSource={filteredNotifications}
            renderItem={(notification) => (
              <List.Item
                key={notification.id}
                style={{
                  cursor: 'pointer',
                  backgroundColor: notification.isRead ? '#fff' : '#f0f5ff',
                  borderLeft: `4px solid ${getPriorityColor(notification.priority)}`,
                  padding: '16px',
                  marginBottom: 8,
                  borderRadius: 4,
                }}
                onClick={() => handleViewDetails(notification)}
                actions={[
                  !notification.isRead && (
                    <Button
                      type="text"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notification.id);
                      }}
                    >
                      Mark Read
                    </Button>
                  ),
                  <Popconfirm
                    title="Delete this notification?"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDelete(notification.id);
                    }}
                    okText="Yes"
                    cancelText="No"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Delete
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={getTypeIcon(notification.type)}
                  title={
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ flex: 1, fontSize: 16 }}>
                          {notification.title}
                        </Text>
                        <Tag color={getTypeColor(notification.type)}>
                          {notification.type}
                        </Tag>
                        <Tag color={getPriorityColor(notification.priority)} style={{ color: '#000' }}>
                          {notification.priority}
                        </Tag>
                      </div>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Paragraph
                        ellipsis={{ rows: 2, expandable: false }}
                        style={{ margin: 0, color: '#595959' }}
                      >
                        {notification.message}
                      </Paragraph>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={8}>
                          <Tag>{notification.category}</Tag>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {notification.timeAgo}
                          </Text>
                        </Space>
                        {notification.actionRequired && (
                          <Tag color="red" icon={<WarningOutlined />}>
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
      </Card>

      {/* Notification Details Drawer */}
      <Drawer
        title="Notification Details"
        placement="right"
        width={500}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        {selectedNotification && (
          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            <div>
              <Space size={16}>
                {getTypeIcon(selectedNotification.type)}
                <Title level={4} style={{ margin: 0 }}>
                  {selectedNotification.title}
                </Title>
              </Space>
            </div>

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Type">
                <Tag color={getTypeColor(selectedNotification.type)}>
                  {selectedNotification.type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Tag color={getPriorityColor(selectedNotification.priority)} style={{ color: '#000' }}>
                  {selectedNotification.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                <Tag>{selectedNotification.category}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {selectedNotification.isRead ? (
                  <Tag color="success">Read</Tag>
                ) : (
                  <Tag color="blue">Unread</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Action Required">
                {selectedNotification.actionRequired ? (
                  <Tag color="red" icon={<WarningOutlined />}>
                    Yes
                  </Tag>
                ) : (
                  <Tag color="default">No</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {new Date(selectedNotification.createdAt).toLocaleString()}
              </Descriptions.Item>
              {selectedNotification.readAt && (
                <Descriptions.Item label="Read At">
                  {new Date(selectedNotification.readAt).toLocaleString()}
                </Descriptions.Item>
              )}
            </Descriptions>

            <div>
              <Text strong>Message:</Text>
              <Paragraph style={{ marginTop: 8 }}>
                {selectedNotification.message}
              </Paragraph>
            </div>

            {selectedNotification.actionUrl && (
              <div>
                <Button
                  type="primary"
                  block
                  onClick={() => {
                    window.location.href = selectedNotification.actionUrl!;
                  }}
                >
                  {selectedNotification.actionLabel || 'Take Action'}
                </Button>
              </div>
            )}

            {selectedNotification.metadata && (
              <div>
                <Text strong>Additional Information:</Text>
                <pre style={{
                  marginTop: 8,
                  padding: 12,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 4,
                  overflow: 'auto',
                }}>
                  {JSON.stringify(selectedNotification.metadata, null, 2)}
                </pre>
              </div>
            )}

            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              {!selectedNotification.isRead && (
                <Button
                  icon={<CheckOutlined />}
                  onClick={() => {
                    handleMarkAsRead(selectedNotification.id);
                    setDrawerVisible(false);
                  }}
                >
                  Mark as Read
                </Button>
              )}
              <Popconfirm
                title="Delete this notification?"
                onConfirm={() => {
                  handleDelete(selectedNotification.id);
                  setDrawerVisible(false);
                }}
                okText="Yes"
                cancelText="No"
              >
                <Button danger icon={<DeleteOutlined />}>
                  Delete
                </Button>
              </Popconfirm>
            </Space>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default NotificationsPage;
