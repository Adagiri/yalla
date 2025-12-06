import React, { useState } from 'react';
import {
  Table,
  Space,
  Tag,
  Button,
  Card,
  Typography,
  Select,
  message,
  Tooltip,
  Popconfirm,
  Input,
} from 'antd';
import {
  ReloadOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { client } from '../../App';
import {
  LIST_REFERRAL_REWARDS,
  CANCEL_REWARD,
} from '../../graphql/referral.operations';
import {
  ReferralReward,
  RewardStatus,
  RewardType,
  RewardFilterInput,
} from '../../types/referral.types';

const { Title, Text } = Typography;
const { Option } = Select;

export const RewardList: React.FC = () => {
  const [rewards, setRewards] = useState<ReferralReward[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<RewardFilterInput>({});

  // Fetch rewards
  const fetchRewards = async () => {
    setLoading(true);
    try {
      const result = await client
        .query(LIST_REFERRAL_REWARDS, {
          filter: filters,
          pagination: { page: 1, limit: 100 },
        })
        .toPromise();

      if (result.error) {
        message.error('Failed to load rewards');
        console.error(result.error);
        return;
      }

      setRewards(result.data?.listReferralRewards || []);
    } catch (error) {
      message.error('An error occurred while loading rewards');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  React.useEffect(() => {
    fetchRewards();
  }, [filters]);

  // Cancel reward
  const handleCancelReward = async (id: string) => {
    try {
      const result = await client
        .mutation(CANCEL_REWARD, {
          id,
          reason: 'Cancelled by admin',
        })
        .toPromise();

      if (result.error) {
        message.error('Failed to cancel reward');
        console.error(result.error);
        return;
      }

      message.success('Reward cancelled successfully');
      fetchRewards();
    } catch (error) {
      message.error('An error occurred while cancelling reward');
      console.error(error);
    }
  };

  // Get status color
  const getStatusColor = (status: RewardStatus) => {
    const colors: Record<RewardStatus, string> = {
      [RewardStatus.PENDING]: 'processing',
      [RewardStatus.AVAILABLE]: 'success',
      [RewardStatus.REDEEMED]: 'default',
      [RewardStatus.EXPIRED]: 'warning',
      [RewardStatus.CANCELLED]: 'error',
    };
    return colors[status];
  };

  // Get reward type color
  const getRewardTypeColor = (type: RewardType) => {
    const colors: Record<RewardType, string> = {
      [RewardType.FREE_RIDE]: 'blue',
      [RewardType.WALLET_CREDIT]: 'green',
      [RewardType.DISCOUNT_PERCENTAGE]: 'purple',
      [RewardType.DISCOUNT_FIXED]: 'orange',
    };
    return colors[type];
  };

  // Render reward value
  const renderRewardValue = (reward: ReferralReward) => {
    switch (reward.rewardType) {
      case RewardType.FREE_RIDE:
        return `${reward.rewardValue} Free Ride${reward.rewardValue > 1 ? 's' : ''}`;
      case RewardType.WALLET_CREDIT:
        return `₦${reward.rewardValue.toFixed(2)}`;
      case RewardType.DISCOUNT_PERCENTAGE:
        return `${reward.rewardValue}%${
          reward.maxValue ? ` (Max: ₦${reward.maxValue})` : ''
        }`;
      case RewardType.DISCOUNT_FIXED:
        return `₦${reward.rewardValue.toFixed(2)} Off`;
      default:
        return reward.rewardValue.toString();
    }
  };

  // Table columns
  const columns: ColumnsType<ReferralReward> = [
    {
      title: 'User',
      key: 'user',
      render: (_, record: ReferralReward) => (
        <div>
          <div>ID: {record.userId}</div>
          <Tag>{record.userType}</Tag>
          {record.isReferrer ? (
            <Tag color="blue">Referrer</Tag>
          ) : (
            <Tag color="green">Referee</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Reward',
      key: 'reward',
      render: (_, record: ReferralReward) => (
        <div>
          <div>
            <Tag color={getRewardTypeColor(record.rewardType)}>
              {record.rewardType}
            </Tag>
          </div>
          <div>
            <strong>{renderRewardValue(record)}</strong>
          </div>
        </div>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Campaign',
      dataIndex: ['campaign', 'name'],
      key: 'campaign',
      render: (name: string, record: ReferralReward) => (
        <div>
          {name || 'N/A'}
          {record.campaign && (
            <div>
              <Tag color="blue">{record.campaign.type}</Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: RewardStatus, record: ReferralReward) => (
        <div>
          <Tag color={getStatusColor(status)}>{status}</Tag>
          {record.hasExpired && <Tag color="warning">Expired</Tag>}
          {!record.isUsable && status === RewardStatus.AVAILABLE && (
            <Tag color="orange">Not Usable</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Dates',
      key: 'dates',
      render: (_, record: ReferralReward) => (
        <div>
          <div>
            <Text type="secondary">Created:</Text>{' '}
            {dayjs(record.createdAt).format('MMM D, YYYY')}
          </div>
          {record.availableFrom && (
            <div>
              <Text type="secondary">Available:</Text>{' '}
              {dayjs(record.availableFrom).format('MMM D, YYYY')}
            </div>
          )}
          {record.expiresAt && (
            <div>
              <Text type="secondary">Expires:</Text>{' '}
              {dayjs(record.expiresAt).format('MMM D, YYYY')}
            </div>
          )}
          {record.redeemedAt && (
            <div>
              <Text type="secondary">Redeemed:</Text>{' '}
              {dayjs(record.redeemedAt).format('MMM D, YYYY HH:mm')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: ReferralReward) => (
        <Space>
          {record.status !== RewardStatus.CANCELLED &&
            record.status !== RewardStatus.REDEEMED && (
              <Popconfirm
                title="Are you sure you want to cancel this reward?"
                onConfirm={() => handleCancelReward(record.id)}
                okText="Yes"
                cancelText="No"
              >
                <Tooltip title="Cancel Reward">
                  <Button danger icon={<CloseCircleOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
        </Space>
      ),
    },
  ];

  // Calculate statistics
  const stats = React.useMemo(() => {
    const total = rewards.length;
    const available = rewards.filter((r) => r.status === RewardStatus.AVAILABLE).length;
    const redeemed = rewards.filter((r) => r.status === RewardStatus.REDEEMED).length;
    const expired = rewards.filter((r) => r.status === RewardStatus.EXPIRED).length;
    const cancelled = rewards.filter((r) => r.status === RewardStatus.CANCELLED).length;

    return { total, available, redeemed, expired, cancelled };
  }, [rewards]);

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={3}>Referral Rewards</Title>

          {/* Statistics */}
          <div style={{ marginTop: 16, marginBottom: 24 }}>
            <Space size="large">
              <div>
                <Text type="secondary">Total:</Text> <strong>{stats.total}</strong>
              </div>
              <div>
                <Text type="secondary">Available:</Text>{' '}
                <strong style={{ color: '#52c41a' }}>{stats.available}</strong>
              </div>
              <div>
                <Text type="secondary">Redeemed:</Text>{' '}
                <strong>{stats.redeemed}</strong>
              </div>
              <div>
                <Text type="secondary">Expired:</Text>{' '}
                <strong style={{ color: '#faad14' }}>{stats.expired}</strong>
              </div>
              <div>
                <Text type="secondary">Cancelled:</Text>{' '}
                <strong style={{ color: '#ff4d4f' }}>{stats.cancelled}</strong>
              </div>
            </Space>
          </div>

          {/* Filters */}
          <Space wrap>
            <Select
              style={{ width: 200 }}
              placeholder="Filter by status"
              allowClear
              value={filters.status}
              onChange={(status) => setFilters({ ...filters, status })}
            >
              <Option value={RewardStatus.PENDING}>Pending</Option>
              <Option value={RewardStatus.AVAILABLE}>Available</Option>
              <Option value={RewardStatus.REDEEMED}>Redeemed</Option>
              <Option value={RewardStatus.EXPIRED}>Expired</Option>
              <Option value={RewardStatus.CANCELLED}>Cancelled</Option>
            </Select>

            <Select
              style={{ width: 200 }}
              placeholder="Filter by reward type"
              allowClear
              value={filters.rewardType}
              onChange={(rewardType) => setFilters({ ...filters, rewardType })}
            >
              <Option value={RewardType.FREE_RIDE}>Free Ride</Option>
              <Option value={RewardType.WALLET_CREDIT}>Wallet Credit</Option>
              <Option value={RewardType.DISCOUNT_PERCENTAGE}>Discount %</Option>
              <Option value={RewardType.DISCOUNT_FIXED}>Fixed Discount</Option>
            </Select>

            <Input
              style={{ width: 200 }}
              placeholder="User ID"
              allowClear
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              prefix={<SearchOutlined />}
            />

            <Button icon={<ReloadOutlined />} onClick={fetchRewards}>
              Refresh
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={rewards}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};
