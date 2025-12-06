import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum CampaignType {
  SIGNUP = 'SIGNUP', // Standard signup referral
  SPECIAL = 'SPECIAL', // Special promotional campaigns
  SEASONAL = 'SEASONAL', // Seasonal campaigns (holidays, events)
  TARGETED = 'TARGETED', // Targeted to specific user segments
}

export const CampaignTypeEnum = Object.values(CampaignType);

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
  CANCELLED = 'CANCELLED',
}

export const CampaignStatusEnum = Object.values(CampaignStatus);

export enum RewardType {
  NONE = 'NONE',
  FREE_RIDE = 'FREE_RIDE',
  WALLET_CREDIT = 'WALLET_CREDIT',
  DISCOUNT_PERCENTAGE = 'DISCOUNT_PERCENTAGE',
  DISCOUNT_FIXED = 'DISCOUNT_FIXED',
  SUBSCRIPTION_DISCOUNT = 'SUBSCRIPTION_DISCOUNT',
  BONUS_POINTS = 'BONUS_POINTS',
}

export const RewardTypeEnum = Object.values(RewardType);

// New constraint and reward structures
export interface CampaignConstraint {
  constraintType: string;
  appliesTo: string; // REFERRER, REFEREE, BOTH
  value?: number | boolean;
  userTypes?: string[]; // Optional: ['CUSTOMER', 'DRIVER']
}

export interface CampaignReward {
  rewardType: string;
  value: number;
  maxValue?: number; // Optional: for DISCOUNT_PERCENTAGE
}

export interface ReferralCampaignDocument extends Document {
  _id: string;
  name: string;
  description?: string;
  type: CampaignType;
  status: CampaignStatus;

  // Campaign timing
  startDate: Date;
  endDate?: Date; // null means no end date
  isActive: boolean;

  // NEW: Modular constraints and rewards
  constraints?: CampaignConstraint[];
  referrerRewards?: CampaignReward[];
  refereeRewards?: CampaignReward[];

  // OLD: Kept for backward compatibility during migration
  minWalletBalance?: number; // in kobo - minimum wallet balance required to qualify

  // Reward configuration for referrer (OLD - deprecated)
  referrerRewardType?: RewardType;
  referrerRewardValue?: number; // Value depends on type (e.g., 1 for 1 free ride, 50000 for ₦500)
  referrerRewardMaxValue?: number; // For percentage discounts, max amount

  // Reward configuration for referee (OLD - deprecated)
  refereeRewardType?: RewardType;
  refereeRewardValue?: number;
  refereeRewardMaxValue?: number;

  // Usage limits
  maxTotalRedemptions?: number; // Max total successful referrals for this campaign
  currentRedemptions: number;
  maxRedemptionsPerUser?: number; // Max referrals one user can make in this campaign

  // Eligibility
  eligibleUserTypes: string[]; // ['CUSTOMER', 'DRIVER']
  targetedUserIds?: string[]; // Optional: specific users who can participate
  excludedUserIds?: string[]; // Optional: users who cannot participate

  // Reward settings
  rewardExpiryDays?: number; // How many days until reward expires
  autoApplyReward: boolean; // Auto-apply reward or require manual redemption

  // Tracking
  totalReferrals: number; // Total referrals created
  qualifiedReferrals: number; // Referrals that met conditions
  completedReferrals: number; // Referrals where rewards were issued

  // Admin metadata
  createdBy: string; // Admin ID
  lastModifiedBy: string;

  // Terms and conditions
  termsAndConditions?: string;

  createdAt: Date;
  updatedAt: Date;
}

const referralCampaignSchema = new Schema<ReferralCampaignDocument>(
  {
    _id: { type: String, default: uuidv4 },
    name: { type: String, required: true },
    description: { type: String },
    type: {
      type: String,
      enum: CampaignTypeEnum,
      default: CampaignType.SIGNUP,
    },
    status: {
      type: String,
      enum: CampaignStatusEnum,
      default: CampaignStatus.DRAFT,
    },

    startDate: { type: Date, required: true },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },

    // NEW: Modular constraints and rewards
    constraints: {
      type: [
        {
          constraintType: { type: String, required: true },
          appliesTo: { type: String, required: true },
          value: { type: Schema.Types.Mixed },
          userTypes: { type: [String] },
        },
      ],
      default: [],
    },
    referrerRewards: {
      type: [
        {
          rewardType: { type: String, required: true },
          value: { type: Number, required: true },
          maxValue: { type: Number },
        },
      ],
      default: [],
    },
    refereeRewards: {
      type: [
        {
          rewardType: { type: String, required: true },
          value: { type: Number, required: true },
          maxValue: { type: Number },
        },
      ],
      default: [],
    },

    // OLD: Kept for backward compatibility during migration
    minWalletBalance: { type: Number, default: 200000 }, // ₦2,000

    // Referrer rewards (OLD - deprecated)
    referrerRewardType: {
      type: String,
      enum: RewardTypeEnum,
      default: RewardType.FREE_RIDE,
    },
    referrerRewardValue: { type: Number, default: 1 },
    referrerRewardMaxValue: { type: Number },

    // Referee rewards (OLD - deprecated)
    refereeRewardType: {
      type: String,
      enum: RewardTypeEnum,
      default: RewardType.FREE_RIDE,
    },
    refereeRewardValue: { type: Number, default: 1 },
    refereeRewardMaxValue: { type: Number },

    // Limits
    maxTotalRedemptions: { type: Number },
    currentRedemptions: { type: Number, default: 0 },
    maxRedemptionsPerUser: { type: Number },

    // Eligibility
    eligibleUserTypes: {
      type: [String],
      default: ['CUSTOMER'],
    },
    targetedUserIds: { type: [String] },
    excludedUserIds: { type: [String] },

    // Reward settings
    rewardExpiryDays: { type: Number },
    autoApplyReward: { type: Boolean, default: false },

    // Tracking
    totalReferrals: { type: Number, default: 0 },
    qualifiedReferrals: { type: Number, default: 0 },
    completedReferrals: { type: Number, default: 0 },

    // Admin
    createdBy: { type: String, required: true },
    lastModifiedBy: { type: String, required: true },

    termsAndConditions: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        // Convert kobo to naira for JSON output (OLD fields - backward compatibility)
        if (ret.minWalletBalance) {
          ret.minWalletBalance = ret.minWalletBalance / 100;
        }
        if (ret.referrerRewardType === 'WALLET_CREDIT' || ret.referrerRewardType === 'DISCOUNT_FIXED') {
          ret.referrerRewardValue = ret.referrerRewardValue / 100;
        }
        if (ret.refereeRewardType === 'WALLET_CREDIT' || ret.refereeRewardType === 'DISCOUNT_FIXED') {
          ret.refereeRewardValue = ret.refereeRewardValue / 100;
        }
        if (ret.referrerRewardMaxValue) {
          ret.referrerRewardMaxValue = ret.referrerRewardMaxValue / 100;
        }
        if (ret.refereeRewardMaxValue) {
          ret.refereeRewardMaxValue = ret.refereeRewardMaxValue / 100;
        }

        // Convert kobo to naira for NEW constraint values
        if (ret.constraints && Array.isArray(ret.constraints)) {
          ret.constraints = ret.constraints.map((constraint: any) => {
            if (constraint.constraintType === 'MIN_WALLET_BALANCE' && constraint.value) {
              return { ...constraint, value: constraint.value / 100 };
            }
            return constraint;
          });
        }

        // Convert kobo to naira for NEW reward values
        if (ret.referrerRewards && Array.isArray(ret.referrerRewards)) {
          ret.referrerRewards = ret.referrerRewards.map((reward: any) => {
            const convertedReward = { ...reward };
            if (reward.rewardType === 'WALLET_CREDIT' || reward.rewardType === 'DISCOUNT_FIXED') {
              convertedReward.value = reward.value / 100;
            }
            if (reward.maxValue) {
              convertedReward.maxValue = reward.maxValue / 100;
            }
            return convertedReward;
          });
        }

        if (ret.refereeRewards && Array.isArray(ret.refereeRewards)) {
          ret.refereeRewards = ret.refereeRewards.map((reward: any) => {
            const convertedReward = { ...reward };
            if (reward.rewardType === 'WALLET_CREDIT' || reward.rewardType === 'DISCOUNT_FIXED') {
              convertedReward.value = reward.value / 100;
            }
            if (reward.maxValue) {
              convertedReward.maxValue = reward.maxValue / 100;
            }
            return convertedReward;
          });
        }

        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes
referralCampaignSchema.index({ status: 1, isActive: 1 });
referralCampaignSchema.index({ type: 1 });
referralCampaignSchema.index({ startDate: 1, endDate: 1 });
referralCampaignSchema.index({ createdBy: 1 });

// Virtual to check if campaign is currently valid
referralCampaignSchema.virtual('isCurrentlyActive').get(function () {
  if (!this.isActive || this.status !== CampaignStatus.ACTIVE) return false;

  const now = new Date();
  const started = this.startDate <= now;
  const notEnded = !this.endDate || this.endDate >= now;

  return started && notEnded;
});

// Virtual to check if campaign has reached max redemptions
referralCampaignSchema.virtual('hasReachedLimit').get(function () {
  if (!this.maxTotalRedemptions) return false;
  return this.currentRedemptions >= this.maxTotalRedemptions;
});

const ReferralCampaign = mongoose.model<ReferralCampaignDocument>(
  'ReferralCampaign',
  referralCampaignSchema
);

export default ReferralCampaign;
