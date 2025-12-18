/**
 * TypeScript types for the Referral System
 */

// ===============================
// ENUMS
// ===============================

export enum ReferralStatus {
  PENDING = 'PENDING',
  QUALIFIED = 'QUALIFIED',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum RewardStatus {
  PENDING = 'PENDING',
  AVAILABLE = 'AVAILABLE',
  REDEEMED = 'REDEEMED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum RewardType {
  FREE_RIDE = 'FREE_RIDE',
  WALLET_CREDIT = 'WALLET_CREDIT',
  DISCOUNT_PERCENTAGE = 'DISCOUNT_PERCENTAGE',
  DISCOUNT_FIXED = 'DISCOUNT_FIXED',
}

export enum CampaignType {
  SIGNUP = 'SIGNUP',
  SPECIAL = 'SPECIAL',
  SEASONAL = 'SEASONAL',
  TARGETED = 'TARGETED',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
  CANCELLED = 'CANCELLED',
}

export enum UserType {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
}

// ===============================
// INTERFACES
// ===============================

export interface ReferralCode {
  id: string;
  userId: string;
  userType: string;
  code: string;
  timesUsed: number;
  maxUsageLimit?: number;
  isActive: boolean;
  isUsable: boolean;
  campaignId?: string;
  campaign?: ReferralCampaign;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralTransaction {
  id: string;
  referrerId: string;
  referrerType: string;
  refereeId: string;
  refereeType: string;
  referralCode: string;
  campaignId?: string;
  campaign?: ReferralCampaign;
  status: ReferralStatus;
  qualifiedAt?: string;
  completedAt?: string;
  referrerWalletBalance: number;
  refereeWalletBalance: number;
  requiredWalletBalance: number;
  referrerReward?: ReferralReward;
  refereeReward?: ReferralReward;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralReward {
  id: string;
  userId: string;
  userType: string;
  rewardType: RewardType;
  rewardValue: number;
  maxValue?: number;
  referralTransactionId: string;
  campaignId?: string;
  campaign?: ReferralCampaign;
  isReferrer: boolean;
  status: RewardStatus;
  availableFrom?: string;
  expiresAt?: string;
  redeemedAt?: string;
  tripId?: string;
  description: string;
  isUsable: boolean;
  hasExpired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralCampaign {
  id: string;
  name: string;
  description?: string;
  type: CampaignType;
  status: CampaignStatus;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  minWalletBalance: number;

  // Referrer rewards
  referrerRewardType: RewardType;
  referrerRewardValue: number;
  referrerRewardMaxValue?: number;

  // Referee rewards
  refereeRewardType: RewardType;
  refereeRewardValue: number;
  refereeRewardMaxValue?: number;

  // Limits
  maxTotalRedemptions?: number;
  currentRedemptions: number;
  maxRedemptionsPerUser?: number;

  // Eligibility
  eligibleUserTypes: string[];

  // Reward settings
  rewardExpiryDays?: number;
  autoApplyReward: boolean;

  // Tracking
  totalReferrals: number;
  qualifiedReferrals: number;
  completedReferrals: number;

  // Admin
  createdBy: string;
  lastModifiedBy: string;
  termsAndConditions?: string;

  // Virtuals
  isCurrentlyActive: boolean;
  hasReachedLimit: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface ReferralAnalytics {
  totalReferrals: number;
  totalQualified: number;
  totalCompleted: number;
  totalPending: number;
  totalRewardsIssued: number;
  totalRewardsRedeemed: number;
  conversionRate: number;
  averageTimeToQualification?: number;
}

export interface CampaignAnalytics {
  campaignId: string;
  campaignName: string;
  totalReferrals: number;
  qualifiedReferrals: number;
  completedReferrals: number;
  conversionRate: number;
}

export interface ReferralStats {
  referralCode?: string;
  totalReferrals: number;
  pendingReferrals: number;
  qualifiedReferrals: number;
  completedReferrals: number;
  availableRewards: number;
  redeemedRewards: number;
  rewards: ReferralRewardSummary[];
}

export interface ReferralRewardSummary {
  id: string;
  type: RewardType;
  value: number;
  status: RewardStatus;
  description: string;
  expiresAt?: string;
}

// ===============================
// INPUT TYPES
// ===============================

export interface CreateCampaignInput {
  name: string;
  description?: string;
  type: CampaignType;
  startDate: string;
  endDate?: string;
  minWalletBalance: number;

  // Referrer rewards
  referrerRewardType: RewardType;
  referrerRewardValue: number;
  referrerRewardMaxValue?: number;

  // Referee rewards
  refereeRewardType: RewardType;
  refereeRewardValue: number;
  refereeRewardMaxValue?: number;

  // Limits
  maxTotalRedemptions?: number;
  maxRedemptionsPerUser?: number;

  // Eligibility
  eligibleUserTypes?: string[];

  // Reward settings
  rewardExpiryDays?: number;
  autoApplyReward?: boolean;

  termsAndConditions?: string;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  type?: CampaignType;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  status?: CampaignStatus;
  minWalletBalance?: number;

  // Referrer rewards
  referrerRewardType?: RewardType;
  referrerRewardValue?: number;
  referrerRewardMaxValue?: number;

  // Referee rewards
  refereeRewardType?: RewardType;
  refereeRewardValue?: number;
  refereeRewardMaxValue?: number;

  // Limits
  maxTotalRedemptions?: number;
  maxRedemptionsPerUser?: number;

  // Eligibility
  eligibleUserTypes?: string[];

  // Reward settings
  rewardExpiryDays?: number;
  autoApplyReward?: boolean;

  termsAndConditions?: string;
}

export interface ReferralFilterInput {
  status?: ReferralStatus;
  campaignId?: string;
  startDate?: string;
  endDate?: string;
  referrerId?: string;
  refereeId?: string;
}

export interface RewardFilterInput {
  status?: RewardStatus;
  userId?: string;
  campaignId?: string;
  rewardType?: RewardType;
}

// ===============================
// UTILITY TYPES
// ===============================

export interface ReferralCampaignFormValues extends Omit<CreateCampaignInput, 'startDate' | 'endDate'> {
  startDate: Date;
  endDate?: Date;
}
