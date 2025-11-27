import React, { useState } from 'react';
import { useGo } from '@refinedev/core';
import {
  Table,
  Space,
  Tag,
  Button,
  Card,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Switch,
  message,
  Drawer,
  Descriptions,
  Badge,
  Statistic,
  Row,
  Col,
  Tooltip,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  BarChartOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { client } from '../../App';
import {
  LIST_REFERRAL_CAMPAIGNS,
  GET_REFERRAL_CAMPAIGN,
  CREATE_REFERRAL_CAMPAIGN,
  UPDATE_REFERRAL_CAMPAIGN,
  DELETE_REFERRAL_CAMPAIGN,
  TOGGLE_CAMPAIGN_STATUS,
  GET_CAMPAIGN_ANALYTICS,
} from '../../graphql/referral.operations';
import {
  ReferralCampaign,
  CampaignStatus,
  CampaignType,
  RewardType,
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignAnalytics,
} from '../../types/referral.types';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export const CampaignList: React.FC = () => {
  const [campaigns, setCampaigns] = useState<ReferralCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailsDrawerVisible, setDetailsDrawerVisible] = useState(false);
  const [analyticsModalVisible, setAnalyticsModalVisible] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<ReferralCampaign | null>(null);
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [filterStatus, setFilterStatus] = useState<CampaignStatus | undefined>();

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // Fetch campaigns
  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const result = await client
        .query(LIST_REFERRAL_CAMPAIGNS, {
          filter: filterStatus,
          pagination: { page: 1, limit: 100 },
        })
        .toPromise();

      if (result.error) {
        message.error('Failed to load campaigns');
        console.error(result.error);
        return;
      }

      setCampaigns(result.data?.listReferralCampaigns || []);
    } catch (error) {
      message.error('An error occurred while loading campaigns');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  React.useEffect(() => {
    fetchCampaigns();
  }, [filterStatus]);

  // Create campaign
  const handleCreate = async (values: any) => {
    try {
      const input: CreateCampaignInput = {
        ...values,
        startDate: values.startDate.toISOString(),
        endDate: values.endDate ? values.endDate.toISOString() : undefined,
        minWalletBalance: values.minWalletBalance * 100, // Convert to kobo
        referrerRewardValue:
          values.referrerRewardType === RewardType.WALLET_CREDIT ||
          values.referrerRewardType === RewardType.DISCOUNT_FIXED
            ? values.referrerRewardValue * 100
            : values.referrerRewardValue,
        referrerRewardMaxValue: values.referrerRewardMaxValue
          ? values.referrerRewardMaxValue * 100
          : undefined,
        refereeRewardValue:
          values.refereeRewardType === RewardType.WALLET_CREDIT ||
          values.refereeRewardType === RewardType.DISCOUNT_FIXED
            ? values.refereeRewardValue * 100
            : values.refereeRewardValue,
        refereeRewardMaxValue: values.refereeRewardMaxValue
          ? values.refereeRewardMaxValue * 100
          : undefined,
      };

      const result = await client
        .mutation(CREATE_REFERRAL_CAMPAIGN, { input })
        .toPromise();

      if (result.error) {
        message.error('Failed to create campaign');
        console.error(result.error);
        return;
      }

      message.success('Campaign created successfully');
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchCampaigns();
    } catch (error) {
      message.error('An error occurred while creating campaign');
      console.error(error);
    }
  };

  // Update campaign
  const handleUpdate = async (values: any) => {
    if (!selectedCampaign) return;

    try {
      const input: UpdateCampaignInput = {
        ...values,
        startDate: values.startDate ? values.startDate.toISOString() : undefined,
        endDate: values.endDate ? values.endDate.toISOString() : undefined,
        minWalletBalance: values.minWalletBalance
          ? values.minWalletBalance * 100
          : undefined,
        referrerRewardValue:
          values.referrerRewardType === RewardType.WALLET_CREDIT ||
          values.referrerRewardType === RewardType.DISCOUNT_FIXED
            ? values.referrerRewardValue * 100
            : values.referrerRewardValue,
        referrerRewardMaxValue: values.referrerRewardMaxValue
          ? values.referrerRewardMaxValue * 100
          : undefined,
        refereeRewardValue:
          values.refereeRewardType === RewardType.WALLET_CREDIT ||
          values.refereeRewardType === RewardType.DISCOUNT_FIXED
            ? values.refereeRewardValue * 100
            : values.refereeRewardValue,
        refereeRewardMaxValue: values.refereeRewardMaxValue
          ? values.refereeRewardMaxValue * 100
          : undefined,
      };

      const result = await client
        .mutation(UPDATE_REFERRAL_CAMPAIGN, {
          id: selectedCampaign.id,
          input,
        })
        .toPromise();

      if (result.error) {
        message.error('Failed to update campaign');
        console.error(result.error);
        return;
      }

      message.success('Campaign updated successfully');
      setEditModalVisible(false);
      setSelectedCampaign(null);
      editForm.resetFields();
      fetchCampaigns();
    } catch (error) {
      message.error('An error occurred while updating campaign');
      console.error(error);
    }
  };

  // Delete campaign
  const handleDelete = async (id: string) => {
    try {
      const result = await client
        .mutation(DELETE_REFERRAL_CAMPAIGN, { id })
        .toPromise();

      if (result.error) {
        message.error('Failed to delete campaign');
        console.error(result.error);
        return;
      }

      message.success('Campaign deleted successfully');
      fetchCampaigns();
    } catch (error) {
      message.error('An error occurred while deleting campaign');
      console.error(error);
    }
  };

  // Toggle campaign status
  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      const result = await client
        .mutation(TOGGLE_CAMPAIGN_STATUS, { id, isActive })
        .toPromise();

      if (result.error) {
        message.error('Failed to toggle campaign status');
        console.error(result.error);
        return;
      }

      message.success(
        `Campaign ${isActive ? 'activated' : 'deactivated'} successfully`
      );
      fetchCampaigns();
    } catch (error) {
      message.error('An error occurred while toggling campaign status');
      console.error(error);
    }
  };

  // Fetch campaign details
  const fetchCampaignDetails = async (id: string) => {
    try {
      const result = await client
        .query(GET_REFERRAL_CAMPAIGN, { id })
        .toPromise();

      if (result.error) {
        message.error('Failed to load campaign details');
        console.error(result.error);
        return;
      }

      setSelectedCampaign(result.data?.getReferralCampaign);
      setDetailsDrawerVisible(true);
    } catch (error) {
      message.error('An error occurred while loading campaign details');
      console.error(error);
    }
  };

  // Fetch campaign analytics
  const fetchCampaignAnalytics = async (id: string) => {
    try {
      const result = await client
        .query(GET_CAMPAIGN_ANALYTICS, { campaignId: id })
        .toPromise();

      if (result.error) {
        message.error('Failed to load campaign analytics');
        console.error(result.error);
        return;
      }

      setAnalytics(result.data?.getCampaignAnalytics);
      setAnalyticsModalVisible(true);
    } catch (error) {
      message.error('An error occurred while loading campaign analytics');
      console.error(error);
    }
  };

  // Open edit modal
  const openEditModal = (campaign: ReferralCampaign) => {
    setSelectedCampaign(campaign);
    editForm.setFieldsValue({
      ...campaign,
      startDate: dayjs(campaign.startDate),
      endDate: campaign.endDate ? dayjs(campaign.endDate) : undefined,
    });
    setEditModalVisible(true);
  };

  // Get status color
  const getStatusColor = (status: CampaignStatus) => {
    const colors: Record<CampaignStatus, string> = {
      [CampaignStatus.DRAFT]: 'default',
      [CampaignStatus.ACTIVE]: 'success',
      [CampaignStatus.PAUSED]: 'warning',
      [CampaignStatus.ENDED]: 'default',
      [CampaignStatus.CANCELLED]: 'error',
    };
    return colors[status];
  };

  // Get campaign type color
  const getCampaignTypeColor = (type: CampaignType) => {
    const colors: Record<CampaignType, string> = {
      [CampaignType.SIGNUP]: 'blue',
      [CampaignType.SPECIAL]: 'purple',
      [CampaignType.SEASONAL]: 'orange',
      [CampaignType.TARGETED]: 'cyan',
    };
    return colors[type];
  };

  // Render reward display
  const renderRewardValue = (type: RewardType, value: number, maxValue?: number) => {
    switch (type) {
      case RewardType.FREE_RIDE:
        return `${value} Free Ride${value > 1 ? 's' : ''}`;
      case RewardType.WALLET_CREDIT:
        return `₦${value.toFixed(2)}`;
      case RewardType.DISCOUNT_PERCENTAGE:
        return `${value}%${maxValue ? ` (Max: ₦${maxValue})` : ''}`;
      case RewardType.DISCOUNT_FIXED:
        return `₦${value.toFixed(2)} Off`;
      default:
        return value.toString();
    }
  };

  // Table columns
  const columns: ColumnsType<ReferralCampaign> = [
    {
      title: 'Campaign Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ReferralCampaign) => (
        <div>
          <div>
            <strong>{name}</strong>
          </div>
          <div>
            <Tag color={getCampaignTypeColor(record.type)}>{record.type}</Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: CampaignStatus, record: ReferralCampaign) => (
        <div>
          <Tag color={getStatusColor(status)}>{status}</Tag>
          {record.isCurrentlyActive && (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              Currently Active
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Dates',
      key: 'dates',
      render: (_, record: ReferralCampaign) => (
        <div>
          <div>
            <Text type="secondary">Start:</Text> {dayjs(record.startDate).format('MMM D, YYYY')}
          </div>
          {record.endDate && (
            <div>
              <Text type="secondary">End:</Text> {dayjs(record.endDate).format('MMM D, YYYY')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Rewards',
      key: 'rewards',
      render: (_, record: ReferralCampaign) => (
        <div>
          <div>
            <Text type="secondary">Referrer:</Text>{' '}
            {renderRewardValue(
              record.referrerRewardType,
              record.referrerRewardValue,
              record.referrerRewardMaxValue
            )}
          </div>
          <div>
            <Text type="secondary">Referee:</Text>{' '}
            {renderRewardValue(
              record.refereeRewardType,
              record.refereeRewardValue,
              record.refereeRewardMaxValue
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Performance',
      key: 'performance',
      render: (_, record: ReferralCampaign) => (
        <div>
          <div>Total: {record.totalReferrals}</div>
          <div>Qualified: {record.qualifiedReferrals}</div>
          <div>Completed: {record.completedReferrals}</div>
          {record.maxTotalRedemptions && (
            <div>
              Redemptions: {record.currentRedemptions}/{record.maxTotalRedemptions}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: ReferralCampaign) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              icon={<EyeOutlined />}
              onClick={() => fetchCampaignDetails(record.id)}
            />
          </Tooltip>
          <Tooltip title="View Analytics">
            <Button
              icon={<BarChartOutlined />}
              onClick={() => fetchCampaignAnalytics(record.id)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          </Tooltip>
          <Tooltip title={record.isActive ? 'Deactivate' : 'Activate'}>
            <Button
              icon={record.isActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => handleToggleStatus(record.id, !record.isActive)}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this campaign?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <Title level={3}>Referral Campaigns</Title>
            <Space>
              <Select
                style={{ width: 200 }}
                placeholder="Filter by status"
                allowClear
                value={filterStatus}
                onChange={setFilterStatus}
              >
                <Option value={CampaignStatus.DRAFT}>Draft</Option>
                <Option value={CampaignStatus.ACTIVE}>Active</Option>
                <Option value={CampaignStatus.PAUSED}>Paused</Option>
                <Option value={CampaignStatus.ENDED}>Ended</Option>
                <Option value={CampaignStatus.CANCELLED}>Cancelled</Option>
              </Select>
              <Button icon={<ReloadOutlined />} onClick={fetchCampaigns}>
                Refresh
              </Button>
            </Space>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            Create Campaign
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={campaigns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Create Campaign Modal */}
      <Modal
        title="Create Referral Campaign"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        width={800}
      >
        <CampaignForm form={createForm} onFinish={handleCreate} />
      </Modal>

      {/* Edit Campaign Modal */}
      <Modal
        title="Edit Referral Campaign"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedCampaign(null);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        width={800}
      >
        <CampaignForm form={editForm} onFinish={handleUpdate} isEdit />
      </Modal>

      {/* Campaign Details Drawer */}
      <Drawer
        title="Campaign Details"
        placement="right"
        onClose={() => {
          setDetailsDrawerVisible(false);
          setSelectedCampaign(null);
        }}
        open={detailsDrawerVisible}
        width={600}
      >
        {selectedCampaign && (
          <div>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Name">{selectedCampaign.name}</Descriptions.Item>
              <Descriptions.Item label="Description">
                {selectedCampaign.description || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                <Tag color={getCampaignTypeColor(selectedCampaign.type)}>
                  {selectedCampaign.type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(selectedCampaign.status)}>
                  {selectedCampaign.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Start Date">
                {dayjs(selectedCampaign.startDate).format('MMMM D, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="End Date">
                {selectedCampaign.endDate
                  ? dayjs(selectedCampaign.endDate).format('MMMM D, YYYY')
                  : 'No end date'}
              </Descriptions.Item>
              <Descriptions.Item label="Min Wallet Balance">
                ₦{selectedCampaign.minWalletBalance.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Referrer Reward">
                {renderRewardValue(
                  selectedCampaign.referrerRewardType,
                  selectedCampaign.referrerRewardValue,
                  selectedCampaign.referrerRewardMaxValue
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Referee Reward">
                {renderRewardValue(
                  selectedCampaign.refereeRewardType,
                  selectedCampaign.refereeRewardValue,
                  selectedCampaign.refereeRewardMaxValue
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Eligible User Types">
                {selectedCampaign.eligibleUserTypes.join(', ')}
              </Descriptions.Item>
              <Descriptions.Item label="Max Total Redemptions">
                {selectedCampaign.maxTotalRedemptions || 'Unlimited'}
              </Descriptions.Item>
              <Descriptions.Item label="Max Per User">
                {selectedCampaign.maxRedemptionsPerUser || 'Unlimited'}
              </Descriptions.Item>
              <Descriptions.Item label="Reward Expiry">
                {selectedCampaign.rewardExpiryDays
                  ? `${selectedCampaign.rewardExpiryDays} days`
                  : 'No expiry'}
              </Descriptions.Item>
              <Descriptions.Item label="Auto Apply Reward">
                {selectedCampaign.autoApplyReward ? 'Yes' : 'No'}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <Title level={5}>Performance</Title>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Total Referrals"
                    value={selectedCampaign.totalReferrals}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Qualified"
                    value={selectedCampaign.qualifiedReferrals}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Completed"
                    value={selectedCampaign.completedReferrals}
                  />
                </Col>
              </Row>
            </div>

            {selectedCampaign.termsAndConditions && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>Terms & Conditions</Title>
                <Text>{selectedCampaign.termsAndConditions}</Text>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Analytics Modal */}
      <Modal
        title="Campaign Analytics"
        open={analyticsModalVisible}
        onCancel={() => {
          setAnalyticsModalVisible(false);
          setAnalytics(null);
        }}
        footer={null}
        width={600}
      >
        {analytics && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card>
                  <Statistic title="Total Referrals" value={analytics.totalReferrals} />
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="Qualified Referrals"
                    value={analytics.qualifiedReferrals}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="Completed Referrals"
                    value={analytics.completedReferrals}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="Conversion Rate"
                    value={analytics.conversionRate}
                    suffix="%"
                    precision={2}
                  />
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

// Campaign Form Component
interface CampaignFormProps {
  form: any;
  onFinish: (values: any) => void;
  isEdit?: boolean;
}

const CampaignForm: React.FC<CampaignFormProps> = ({ form, onFinish, isEdit = false }) => {
  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        name="name"
        label="Campaign Name"
        rules={[{ required: true, message: 'Please enter campaign name' }]}
      >
        <Input placeholder="e.g., Summer Referral Campaign 2024" />
      </Form.Item>

      <Form.Item name="description" label="Description">
        <TextArea rows={3} placeholder="Brief description of the campaign" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="type"
            label="Campaign Type"
            rules={[{ required: true, message: 'Please select campaign type' }]}
          >
            <Select placeholder="Select type">
              <Option value={CampaignType.SIGNUP}>Signup</Option>
              <Option value={CampaignType.SPECIAL}>Special</Option>
              <Option value={CampaignType.SEASONAL}>Seasonal</Option>
              <Option value={CampaignType.TARGETED}>Targeted</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="minWalletBalance"
            label="Min Wallet Balance (₦)"
            rules={[{ required: true, message: 'Please enter minimum wallet balance' }]}
          >
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              placeholder="2000"
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="startDate"
            label="Start Date"
            rules={[{ required: true, message: 'Please select start date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="endDate" label="End Date (Optional)">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Title level={5}>Referrer Rewards</Title>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="referrerRewardType"
            label="Reward Type"
            rules={[{ required: true, message: 'Please select reward type' }]}
          >
            <Select placeholder="Select type">
              <Option value={RewardType.FREE_RIDE}>Free Ride</Option>
              <Option value={RewardType.WALLET_CREDIT}>Wallet Credit</Option>
              <Option value={RewardType.DISCOUNT_PERCENTAGE}>Discount %</Option>
              <Option value={RewardType.DISCOUNT_FIXED}>Fixed Discount</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="referrerRewardValue"
            label="Reward Value"
            rules={[{ required: true, message: 'Please enter reward value' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="referrerRewardMaxValue" label="Max Reward Value (for % discount)">
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>

      <Title level={5}>Referee Rewards</Title>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="refereeRewardType"
            label="Reward Type"
            rules={[{ required: true, message: 'Please select reward type' }]}
          >
            <Select placeholder="Select type">
              <Option value={RewardType.FREE_RIDE}>Free Ride</Option>
              <Option value={RewardType.WALLET_CREDIT}>Wallet Credit</Option>
              <Option value={RewardType.DISCOUNT_PERCENTAGE}>Discount %</Option>
              <Option value={RewardType.DISCOUNT_FIXED}>Fixed Discount</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="refereeRewardValue"
            label="Reward Value"
            rules={[{ required: true, message: 'Please enter reward value' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="refereeRewardMaxValue" label="Max Reward Value (for % discount)">
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>

      <Title level={5}>Limits & Settings</Title>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="maxTotalRedemptions" label="Max Total Redemptions">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Unlimited" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="maxRedemptionsPerUser" label="Max Per User">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Unlimited" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="rewardExpiryDays" label="Reward Expiry (days)">
        <InputNumber min={0} style={{ width: '100%' }} placeholder="No expiry" />
      </Form.Item>

      <Form.Item
        name="eligibleUserTypes"
        label="Eligible User Types"
        rules={[{ required: true, message: 'Please select eligible user types' }]}
      >
        <Select mode="multiple" placeholder="Select user types">
          <Option value="CUSTOMER">Customer</Option>
          <Option value="DRIVER">Driver</Option>
        </Select>
      </Form.Item>

      <Form.Item name="autoApplyReward" label="Auto Apply Reward" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item name="termsAndConditions" label="Terms & Conditions">
        <TextArea rows={4} placeholder="Enter terms and conditions" />
      </Form.Item>
    </Form>
  );
};
