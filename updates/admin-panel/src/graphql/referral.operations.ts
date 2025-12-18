/**
 * GraphQL operations for the Referral System
 * This file contains all GraphQL queries and mutations for managing referrals in the admin panel
 */

// Campaign Fragments
export const REFERRAL_CAMPAIGN_FRAGMENT = `
  fragment ReferralCampaignFields on ReferralCampaign {
    id
    name
    description
    type
    status
    startDate
    endDate
    isActive
    minWalletBalance
    referrerRewardType
    referrerRewardValue
    referrerRewardMaxValue
    refereeRewardType
    refereeRewardValue
    refereeRewardMaxValue
    maxTotalRedemptions
    currentRedemptions
    maxRedemptionsPerUser
    eligibleUserTypes
    rewardExpiryDays
    autoApplyReward
    totalReferrals
    qualifiedReferrals
    completedReferrals
    createdBy
    lastModifiedBy
    termsAndConditions
    isCurrentlyActive
    hasReachedLimit
    createdAt
    updatedAt
  }
`;

// Transaction Fragments
export const REFERRAL_TRANSACTION_FRAGMENT = `
  fragment ReferralTransactionFields on ReferralTransaction {
    id
    referrerId
    referrerType
    refereeId
    refereeType
    referralCode
    campaignId
    status
    qualifiedAt
    completedAt
    referrerWalletBalance
    refereeWalletBalance
    requiredWalletBalance
    createdAt
    updatedAt
  }
`;

// Reward Fragments
export const REFERRAL_REWARD_FRAGMENT = `
  fragment ReferralRewardFields on ReferralReward {
    id
    userId
    userType
    rewardType
    rewardValue
    maxValue
    referralTransactionId
    campaignId
    isReferrer
    status
    availableFrom
    expiresAt
    redeemedAt
    tripId
    description
    isUsable
    hasExpired
    createdAt
    updatedAt
  }
`;

// ===============================
// QUERIES
// ===============================

export const LIST_REFERRAL_CAMPAIGNS = `
  query ListReferralCampaigns($filter: CampaignStatusEnum, $pagination: PaginationInput) {
    listReferralCampaigns(filter: $filter, pagination: $pagination) {
      id
      name
      description
      type
      status
      startDate
      endDate
      isActive
      minWalletBalance
      referrerRewardType
      referrerRewardValue
      refereeRewardType
      refereeRewardValue
      totalReferrals
      qualifiedReferrals
      completedReferrals
      currentRedemptions
      maxTotalRedemptions
      isCurrentlyActive
      hasReachedLimit
      createdAt
      updatedAt
    }
  }
`;

export const GET_REFERRAL_CAMPAIGN = `
  query GetReferralCampaign($id: ID!) {
    getReferralCampaign(id: $id) {
      id
      name
      description
      type
      status
      startDate
      endDate
      isActive
      minWalletBalance
      referrerRewardType
      referrerRewardValue
      referrerRewardMaxValue
      refereeRewardType
      refereeRewardValue
      refereeRewardMaxValue
      maxTotalRedemptions
      currentRedemptions
      maxRedemptionsPerUser
      eligibleUserTypes
      rewardExpiryDays
      autoApplyReward
      totalReferrals
      qualifiedReferrals
      completedReferrals
      createdBy
      lastModifiedBy
      termsAndConditions
      isCurrentlyActive
      hasReachedLimit
      createdAt
      updatedAt
    }
  }
`;

export const LIST_REFERRAL_TRANSACTIONS = `
  query ListReferralTransactions($filter: ReferralFilterInput, $pagination: PaginationInput) {
    listReferralTransactions(filter: $filter, pagination: $pagination) {
      id
      referrerId
      referrerType
      refereeId
      refereeType
      referralCode
      campaignId
      status
      qualifiedAt
      completedAt
      referrerWalletBalance
      refereeWalletBalance
      requiredWalletBalance
      createdAt
      updatedAt
      campaign {
        id
        name
        type
      }
    }
  }
`;

export const GET_REFERRAL_TRANSACTION = `
  query GetReferralTransaction($id: ID!) {
    getReferralTransaction(id: $id) {
      id
      referrerId
      referrerType
      refereeId
      refereeType
      referralCode
      campaignId
      status
      qualifiedAt
      completedAt
      referrerWalletBalance
      refereeWalletBalance
      requiredWalletBalance
      createdAt
      updatedAt
      campaign {
        id
        name
        description
        type
        referrerRewardType
        referrerRewardValue
        refereeRewardType
        refereeRewardValue
      }
      referrerReward {
        id
        rewardType
        rewardValue
        status
        description
        expiresAt
      }
      refereeReward {
        id
        rewardType
        rewardValue
        status
        description
        expiresAt
      }
    }
  }
`;

export const LIST_REFERRAL_REWARDS = `
  query ListReferralRewards($filter: RewardFilterInput, $pagination: PaginationInput) {
    listReferralRewards(filter: $filter, pagination: $pagination) {
      id
      userId
      userType
      rewardType
      rewardValue
      maxValue
      referralTransactionId
      campaignId
      isReferrer
      status
      availableFrom
      expiresAt
      redeemedAt
      tripId
      description
      isUsable
      hasExpired
      createdAt
      updatedAt
      campaign {
        id
        name
        type
      }
    }
  }
`;

export const GET_REFERRAL_ANALYTICS = `
  query GetReferralAnalytics($startDate: DateTime, $endDate: DateTime) {
    getReferralAnalytics(startDate: $startDate, endDate: $endDate) {
      totalReferrals
      totalQualified
      totalCompleted
      totalPending
      totalRewardsIssued
      totalRewardsRedeemed
      conversionRate
      averageTimeToQualification
    }
  }
`;

export const GET_CAMPAIGN_ANALYTICS = `
  query GetCampaignAnalytics($campaignId: ID!) {
    getCampaignAnalytics(campaignId: $campaignId) {
      campaignId
      campaignName
      totalReferrals
      qualifiedReferrals
      completedReferrals
      conversionRate
    }
  }
`;

export const GET_ACTIVE_CAMPAIGNS = `
  query GetActiveCampaigns {
    getActiveCampaigns {
      id
      name
      description
      type
      startDate
      endDate
      referrerRewardType
      referrerRewardValue
      refereeRewardType
      refereeRewardValue
      minWalletBalance
      termsAndConditions
    }
  }
`;

// ===============================
// MUTATIONS
// ===============================

export const CREATE_REFERRAL_CAMPAIGN = `
  mutation CreateReferralCampaign($input: CreateCampaignInput!) {
    createReferralCampaign(input: $input) {
      id
      name
      description
      type
      status
      startDate
      endDate
      isActive
      minWalletBalance
      referrerRewardType
      referrerRewardValue
      referrerRewardMaxValue
      refereeRewardType
      refereeRewardValue
      refereeRewardMaxValue
      maxTotalRedemptions
      maxRedemptionsPerUser
      eligibleUserTypes
      rewardExpiryDays
      autoApplyReward
      termsAndConditions
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_REFERRAL_CAMPAIGN = `
  mutation UpdateReferralCampaign($id: ID!, $input: UpdateCampaignInput!) {
    updateReferralCampaign(id: $id, input: $input) {
      id
      name
      description
      type
      status
      startDate
      endDate
      isActive
      minWalletBalance
      referrerRewardType
      referrerRewardValue
      referrerRewardMaxValue
      refereeRewardType
      refereeRewardValue
      refereeRewardMaxValue
      maxTotalRedemptions
      maxRedemptionsPerUser
      eligibleUserTypes
      rewardExpiryDays
      autoApplyReward
      termsAndConditions
      updatedAt
    }
  }
`;

export const DELETE_REFERRAL_CAMPAIGN = `
  mutation DeleteReferralCampaign($id: ID!) {
    deleteReferralCampaign(id: $id)
  }
`;

export const TOGGLE_CAMPAIGN_STATUS = `
  mutation ToggleCampaignStatus($id: ID!, $isActive: Boolean!) {
    toggleCampaignStatus(id: $id, isActive: $isActive) {
      id
      isActive
      status
      updatedAt
    }
  }
`;

export const CHANGE_CAMPAIGN_STATUS = `
  mutation ChangeCampaignStatus($id: ID!, $status: CampaignStatusEnum!) {
    changeCampaignStatus(id: $id, status: $status) {
      id
      status
      updatedAt
    }
  }
`;

export const CHECK_PENDING_REFERRALS = `
  mutation CheckPendingReferrals {
    checkPendingReferrals
  }
`;

export const EXPIRE_OLD_REWARDS = `
  mutation ExpireOldRewards {
    expireOldRewards
  }
`;

export const CANCEL_REFERRAL_TRANSACTION = `
  mutation CancelReferralTransaction($id: ID!, $reason: String) {
    cancelReferralTransaction(id: $id, reason: $reason) {
      id
      status
      updatedAt
    }
  }
`;

export const CANCEL_REWARD = `
  mutation CancelReward($id: ID!, $reason: String) {
    cancelReward(id: $id, reason: $reason) {
      id
      status
      updatedAt
    }
  }
`;
