import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  DatePicker,
  Button,
  Space,
  message,
  Progress,
  Divider,
} from 'antd';
import {
  UserAddOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
  GiftOutlined,
  ReloadOutlined,
  PercentageOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { client } from '../../App';
import {
  GET_REFERRAL_ANALYTICS,
  CHECK_PENDING_REFERRALS,
  EXPIRE_OLD_REWARDS,
} from '../../graphql/referral.operations';
import { ReferralAnalytics } from '../../types/referral.types';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export const ReferralAnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<ReferralAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingPending, setProcessingPending] = useState(false);
  const [expiringRewards, setExpiringRewards] = useState(false);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  // Fetch analytics
  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const result = await client
        .query(GET_REFERRAL_ANALYTICS, {
          startDate: dateRange?.[0],
          endDate: dateRange?.[1],
        })
        .toPromise();

      if (result.error) {
        message.error('Failed to load analytics');
        console.error(result.error);
        return;
      }

      setAnalytics(result.data?.getReferralAnalytics);
    } catch (error) {
      message.error('An error occurred while loading analytics');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  React.useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  // Check pending referrals
  const handleCheckPendingReferrals = async () => {
    setProcessingPending(true);
    try {
      const result = await client
        .mutation(CHECK_PENDING_REFERRALS, {})
        .toPromise();

      if (result.error) {
        message.error('Failed to check pending referrals');
        console.error(result.error);
        return;
      }

      const processed = result.data?.checkPendingReferrals || 0;
      message.success(`Processed ${processed} pending referral(s)`);
      fetchAnalytics();
    } catch (error) {
      message.error('An error occurred while checking pending referrals');
      console.error(error);
    } finally {
      setProcessingPending(false);
    }
  };

  // Expire old rewards
  const handleExpireOldRewards = async () => {
    setExpiringRewards(true);
    try {
      const result = await client.mutation(EXPIRE_OLD_REWARDS, {}).toPromise();

      if (result.error) {
        message.error('Failed to expire old rewards');
        console.error(result.error);
        return;
      }

      const expired = result.data?.expireOldRewards || 0;
      message.success(`Expired ${expired} old reward(s)`);
      fetchAnalytics();
    } catch (error) {
      message.error('An error occurred while expiring old rewards');
      console.error(error);
    } finally {
      setExpiringRewards(false);
    }
  };

  // Calculate qualification rate
  const qualificationRate = analytics
    ? analytics.totalReferrals > 0
      ? (analytics.totalQualified / analytics.totalReferrals) * 100
      : 0
    : 0;

  // Calculate completion rate
  const completionRate = analytics
    ? analytics.totalQualified > 0
      ? (analytics.totalCompleted / analytics.totalQualified) * 100
      : 0
    : 0;

  // Calculate redemption rate
  const redemptionRate = analytics
    ? analytics.totalRewardsIssued > 0
      ? (analytics.totalRewardsRedeemed / analytics.totalRewardsIssued) * 100
      : 0
    : 0;

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Title level={3}>Referral Analytics</Title>
            <Space>
              <RangePicker
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([dates[0].toISOString(), dates[1].toISOString()]);
                  } else {
                    setDateRange(null);
                  }
                }}
                placeholder={['Start Date', 'End Date']}
              />
              <Button icon={<ReloadOutlined />} onClick={fetchAnalytics} loading={loading}>
                Refresh
              </Button>
            </Space>
          </div>
        </div>

        {analytics && (
          <>
            {/* Main Statistics */}
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Total Referrals"
                    value={analytics.totalReferrals}
                    prefix={<UserAddOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Qualified"
                    value={analytics.totalQualified}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Completed"
                    value={analytics.totalCompleted}
                    prefix={<TrophyOutlined />}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Pending"
                    value={analytics.totalPending}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
            </Row>

            <Divider />

            {/* Conversion Metrics */}
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={8}>
                <Card>
                  <Statistic
                    title="Overall Conversion Rate"
                    value={analytics.conversionRate}
                    precision={2}
                    suffix="%"
                    prefix={<PercentageOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                  <div style={{ marginTop: 16 }}>
                    <Progress
                      percent={analytics.conversionRate}
                      strokeColor={{
                        '0%': '#108ee9',
                        '100%': '#87d068',
                      }}
                    />
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card>
                  <Statistic
                    title="Qualification Rate"
                    value={qualificationRate}
                    precision={2}
                    suffix="%"
                    valueStyle={{ color: '#52c41a' }}
                  />
                  <div style={{ marginTop: 16 }}>
                    <Progress
                      percent={qualificationRate}
                      strokeColor={{
                        '0%': '#ffa940',
                        '100%': '#52c41a',
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                    {analytics.totalQualified} / {analytics.totalReferrals} referrals
                    qualified
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card>
                  <Statistic
                    title="Completion Rate"
                    value={completionRate}
                    precision={2}
                    suffix="%"
                    valueStyle={{ color: '#722ed1' }}
                  />
                  <div style={{ marginTop: 16 }}>
                    <Progress
                      percent={completionRate}
                      strokeColor={{
                        '0%': '#9254de',
                        '100%': '#722ed1',
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                    {analytics.totalCompleted} / {analytics.totalQualified} qualified
                    referrals completed
                  </div>
                </Card>
              </Col>
            </Row>

            <Divider />

            {/* Rewards Statistics */}
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={8}>
                <Card>
                  <Statistic
                    title="Total Rewards Issued"
                    value={analytics.totalRewardsIssued}
                    prefix={<GiftOutlined />}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Card>
                  <Statistic
                    title="Rewards Redeemed"
                    value={analytics.totalRewardsRedeemed}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card>
                  <Statistic
                    title="Redemption Rate"
                    value={redemptionRate}
                    precision={2}
                    suffix="%"
                    prefix={<PercentageOutlined />}
                  />
                  <div style={{ marginTop: 16 }}>
                    <Progress
                      percent={redemptionRate}
                      strokeColor={{
                        '0%': '#fa8c16',
                        '100%': '#52c41a',
                      }}
                    />
                  </div>
                </Card>
              </Col>
            </Row>

            {analytics.averageTimeToQualification !== null &&
              analytics.averageTimeToQualification !== undefined && (
                <>
                  <Divider />
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                      <Card>
                        <Statistic
                          title="Average Time to Qualification"
                          value={analytics.averageTimeToQualification}
                          precision={2}
                          suffix="hours"
                          prefix={<ClockCircleOutlined />}
                          valueStyle={{ color: '#1890ff' }}
                        />
                      </Card>
                    </Col>
                  </Row>
                </>
              )}

            <Divider />

            {/* Admin Actions */}
            <Card title="Admin Actions" style={{ marginTop: 24 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Title level={5}>Process Pending Referrals</Title>
                  <p>
                    Manually trigger the job to check all pending referrals and qualify
                    them if they meet the wallet balance requirement.
                  </p>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={handleCheckPendingReferrals}
                    loading={processingPending}
                  >
                    Check Pending Referrals
                  </Button>
                </div>

                <Divider />

                <div>
                  <Title level={5}>Expire Old Rewards</Title>
                  <p>
                    Manually trigger the job to expire all rewards that have passed their
                    expiry date.
                  </p>
                  <Button
                    type="primary"
                    danger
                    onClick={handleExpireOldRewards}
                    loading={expiringRewards}
                  >
                    Expire Old Rewards
                  </Button>
                </div>
              </Space>
            </Card>
          </>
        )}
      </Card>
    </div>
  );
};
