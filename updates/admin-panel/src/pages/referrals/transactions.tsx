import React, { useState } from 'react';
import {
  Table,
  Space,
  Tag,
  Button,
  Card,
  Typography,
  Select,
  DatePicker,
  message,
  Drawer,
  Descriptions,
  Row,
  Col,
  Statistic,
  Tooltip,
  Popconfirm,
  Input,
} from 'antd';
import {
  EyeOutlined,
  ReloadOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { client } from '../../App';
import {
  LIST_REFERRAL_TRANSACTIONS,
  GET_REFERRAL_TRANSACTION,
  CANCEL_REFERRAL_TRANSACTION,
} from '../../graphql/referral.operations';
import {
  ReferralTransaction,
  ReferralStatus,
  ReferralFilterInput,
} from '../../types/referral.types';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export const TransactionList: React.FC = () => {
  const [transactions, setTransactions] = useState<ReferralTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailsDrawerVisible, setDetailsDrawerVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<ReferralTransaction | null>(null);
  const [filters, setFilters] = useState<ReferralFilterInput>({});

  // Fetch transactions
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const result = await client
        .query(LIST_REFERRAL_TRANSACTIONS, {
          filter: filters,
          pagination: { page: 1, limit: 100 },
        })
        .toPromise();

      if (result.error) {
        message.error('Failed to load transactions');
        console.error(result.error);
        return;
      }

      setTransactions(result.data?.listReferralTransactions || []);
    } catch (error) {
      message.error('An error occurred while loading transactions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  React.useEffect(() => {
    fetchTransactions();
  }, [filters]);

  // Fetch transaction details
  const fetchTransactionDetails = async (id: string) => {
    try {
      const result = await client
        .query(GET_REFERRAL_TRANSACTION, { id })
        .toPromise();

      if (result.error) {
        message.error('Failed to load transaction details');
        console.error(result.error);
        return;
      }

      setSelectedTransaction(result.data?.getReferralTransaction);
      setDetailsDrawerVisible(true);
    } catch (error) {
      message.error('An error occurred while loading transaction details');
      console.error(error);
    }
  };

  // Cancel transaction
  const handleCancelTransaction = async (id: string) => {
    try {
      const result = await client
        .mutation(CANCEL_REFERRAL_TRANSACTION, {
          id,
          reason: 'Cancelled by admin',
        })
        .toPromise();

      if (result.error) {
        message.error('Failed to cancel transaction');
        console.error(result.error);
        return;
      }

      message.success('Transaction cancelled successfully');
      fetchTransactions();
      setDetailsDrawerVisible(false);
    } catch (error) {
      message.error('An error occurred while cancelling transaction');
      console.error(error);
    }
  };

  // Get status color
  const getStatusColor = (status: ReferralStatus) => {
    const colors: Record<ReferralStatus, string> = {
      [ReferralStatus.PENDING]: 'processing',
      [ReferralStatus.QUALIFIED]: 'success',
      [ReferralStatus.COMPLETED]: 'success',
      [ReferralStatus.EXPIRED]: 'default',
      [ReferralStatus.CANCELLED]: 'error',
    };
    return colors[status];
  };

  // Table columns
  const columns: ColumnsType<ReferralTransaction> = [
    {
      title: 'Referral Code',
      dataIndex: 'referralCode',
      key: 'referralCode',
      render: (code: string) => <Text code>{code}</Text>,
    },
    {
      title: 'Referrer',
      key: 'referrer',
      render: (_, record: ReferralTransaction) => (
        <div>
          <div>ID: {record.referrerId}</div>
          <Tag>{record.referrerType}</Tag>
        </div>
      ),
    },
    {
      title: 'Referee',
      key: 'referee',
      render: (_, record: ReferralTransaction) => (
        <div>
          <div>ID: {record.refereeId}</div>
          <Tag>{record.refereeType}</Tag>
        </div>
      ),
    },
    {
      title: 'Campaign',
      dataIndex: ['campaign', 'name'],
      key: 'campaign',
      render: (name: string, record: ReferralTransaction) => (
        <div>
          {name || 'N/A'}
          {record.campaign && <div><Tag color="blue">{record.campaign.type}</Tag></div>}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: ReferralStatus) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: 'Wallet Balances',
      key: 'balances',
      render: (_, record: ReferralTransaction) => (
        <div>
          <div>
            <Text type="secondary">Referrer:</Text> ₦
            {record.referrerWalletBalance.toFixed(2)}
          </div>
          <div>
            <Text type="secondary">Referee:</Text> ₦
            {record.refereeWalletBalance.toFixed(2)}
          </div>
          <div>
            <Text type="secondary">Required:</Text> ₦
            {record.requiredWalletBalance.toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      title: 'Dates',
      key: 'dates',
      render: (_, record: ReferralTransaction) => (
        <div>
          <div>
            <Text type="secondary">Created:</Text>{' '}
            {dayjs(record.createdAt).format('MMM D, YYYY HH:mm')}
          </div>
          {record.qualifiedAt && (
            <div>
              <Text type="secondary">Qualified:</Text>{' '}
              {dayjs(record.qualifiedAt).format('MMM D, YYYY HH:mm')}
            </div>
          )}
          {record.completedAt && (
            <div>
              <Text type="secondary">Completed:</Text>{' '}
              {dayjs(record.completedAt).format('MMM D, YYYY HH:mm')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: ReferralTransaction) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              icon={<EyeOutlined />}
              onClick={() => fetchTransactionDetails(record.id)}
            />
          </Tooltip>
          {record.status !== ReferralStatus.CANCELLED &&
            record.status !== ReferralStatus.COMPLETED && (
              <Popconfirm
                title="Are you sure you want to cancel this transaction?"
                onConfirm={() => handleCancelTransaction(record.id)}
                okText="Yes"
                cancelText="No"
              >
                <Tooltip title="Cancel Transaction">
                  <Button danger icon={<CloseCircleOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={3}>Referral Transactions</Title>
          <Space wrap style={{ marginTop: 16 }}>
            <Select
              style={{ width: 200 }}
              placeholder="Filter by status"
              allowClear
              value={filters.status}
              onChange={(status) => setFilters({ ...filters, status })}
            >
              <Option value={ReferralStatus.PENDING}>Pending</Option>
              <Option value={ReferralStatus.QUALIFIED}>Qualified</Option>
              <Option value={ReferralStatus.COMPLETED}>Completed</Option>
              <Option value={ReferralStatus.EXPIRED}>Expired</Option>
              <Option value={ReferralStatus.CANCELLED}>Cancelled</Option>
            </Select>

            <Input
              style={{ width: 200 }}
              placeholder="Referrer ID"
              allowClear
              value={filters.referrerId}
              onChange={(e) => setFilters({ ...filters, referrerId: e.target.value })}
              prefix={<SearchOutlined />}
            />

            <Input
              style={{ width: 200 }}
              placeholder="Referee ID"
              allowClear
              value={filters.refereeId}
              onChange={(e) => setFilters({ ...filters, refereeId: e.target.value })}
              prefix={<SearchOutlined />}
            />

            <RangePicker
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setFilters({
                    ...filters,
                    startDate: dates[0].toISOString(),
                    endDate: dates[1].toISOString(),
                  });
                } else {
                  const { startDate, endDate, ...rest } = filters;
                  setFilters(rest);
                }
              }}
            />

            <Button icon={<ReloadOutlined />} onClick={fetchTransactions}>
              Refresh
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={transactions}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Transaction Details Drawer */}
      <Drawer
        title="Transaction Details"
        placement="right"
        onClose={() => {
          setDetailsDrawerVisible(false);
          setSelectedTransaction(null);
        }}
        open={detailsDrawerVisible}
        width={700}
      >
        {selectedTransaction && (
          <div>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Transaction ID">
                {selectedTransaction.id}
              </Descriptions.Item>
              <Descriptions.Item label="Referral Code">
                <Text code>{selectedTransaction.referralCode}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(selectedTransaction.status)}>
                  {selectedTransaction.status}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <Title level={5}>Referrer Information</Title>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="ID">
                  {selectedTransaction.referrerId}
                </Descriptions.Item>
                <Descriptions.Item label="Type">
                  <Tag>{selectedTransaction.referrerType}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Wallet Balance">
                  ₦{selectedTransaction.referrerWalletBalance.toFixed(2)}
                </Descriptions.Item>
              </Descriptions>
            </div>

            <div style={{ marginTop: 24 }}>
              <Title level={5}>Referee Information</Title>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="ID">
                  {selectedTransaction.refereeId}
                </Descriptions.Item>
                <Descriptions.Item label="Type">
                  <Tag>{selectedTransaction.refereeType}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Wallet Balance">
                  ₦{selectedTransaction.refereeWalletBalance.toFixed(2)}
                </Descriptions.Item>
              </Descriptions>
            </div>

            {selectedTransaction.campaign && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>Campaign Details</Title>
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="Name">
                    {selectedTransaction.campaign.name}
                  </Descriptions.Item>
                  <Descriptions.Item label="Type">
                    <Tag color="blue">{selectedTransaction.campaign.type}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Referrer Reward">
                    {selectedTransaction.campaign.referrerRewardType} -
                    {selectedTransaction.campaign.referrerRewardValue}
                  </Descriptions.Item>
                  <Descriptions.Item label="Referee Reward">
                    {selectedTransaction.campaign.refereeRewardType} -
                    {selectedTransaction.campaign.refereeRewardValue}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <Title level={5}>Timeline</Title>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="Created"
                      value={dayjs(selectedTransaction.createdAt).format(
                        'MMM D, YYYY HH:mm'
                      )}
                    />
                  </Card>
                </Col>
                {selectedTransaction.qualifiedAt && (
                  <Col span={8}>
                    <Card size="small">
                      <Statistic
                        title="Qualified"
                        value={dayjs(selectedTransaction.qualifiedAt).format(
                          'MMM D, YYYY HH:mm'
                        )}
                      />
                    </Card>
                  </Col>
                )}
                {selectedTransaction.completedAt && (
                  <Col span={8}>
                    <Card size="small">
                      <Statistic
                        title="Completed"
                        value={dayjs(selectedTransaction.completedAt).format(
                          'MMM D, YYYY HH:mm'
                        )}
                      />
                    </Card>
                  </Col>
                )}
              </Row>
            </div>

            {selectedTransaction.referrerReward && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>Referrer Reward</Title>
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="Type">
                    {selectedTransaction.referrerReward.rewardType}
                  </Descriptions.Item>
                  <Descriptions.Item label="Value">
                    {selectedTransaction.referrerReward.rewardValue}
                  </Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <Tag>{selectedTransaction.referrerReward.status}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Description">
                    {selectedTransaction.referrerReward.description}
                  </Descriptions.Item>
                  {selectedTransaction.referrerReward.expiresAt && (
                    <Descriptions.Item label="Expires At">
                      {dayjs(selectedTransaction.referrerReward.expiresAt).format(
                        'MMM D, YYYY'
                      )}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </div>
            )}

            {selectedTransaction.refereeReward && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>Referee Reward</Title>
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="Type">
                    {selectedTransaction.refereeReward.rewardType}
                  </Descriptions.Item>
                  <Descriptions.Item label="Value">
                    {selectedTransaction.refereeReward.rewardValue}
                  </Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <Tag>{selectedTransaction.refereeReward.status}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Description">
                    {selectedTransaction.refereeReward.description}
                  </Descriptions.Item>
                  {selectedTransaction.refereeReward.expiresAt && (
                    <Descriptions.Item label="Expires At">
                      {dayjs(selectedTransaction.refereeReward.expiresAt).format(
                        'MMM D, YYYY'
                      )}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </div>
            )}

            {selectedTransaction.status !== ReferralStatus.CANCELLED &&
              selectedTransaction.status !== ReferralStatus.COMPLETED && (
                <div style={{ marginTop: 24 }}>
                  <Popconfirm
                    title="Are you sure you want to cancel this transaction?"
                    onConfirm={() => handleCancelTransaction(selectedTransaction.id)}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button danger block icon={<CloseCircleOutlined />}>
                      Cancel Transaction
                    </Button>
                  </Popconfirm>
                </div>
              )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
