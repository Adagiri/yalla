import ReferralCampaign, {
  ReferralCampaignDocument,
  CampaignStatus,
} from './referral-campaign.model';
import ReferralTransaction, {
  ReferralStatus,
} from './referral-transaction.model';
import ReferralReward, { RewardStatus } from './referral-reward.model';
import SystemConfig from '../admin/system-config.model';
import referralService from './referral.service';
import ConstraintDefinition, {
  ConstraintDefinitionDocument,
} from './constraint-definition.model';
import RewardDefinition, {
  RewardDefinitionDocument,
} from './reward-definition.model';
import { seedReferralDefinitions } from './seed-referral-definitions';

class ReferralAdminService {
  /**
   * Create a new referral campaign
   */
  async createCampaign(
    input: any,
    adminId: string
  ): Promise<ReferralCampaignDocument> {
    // Validate constraint types exist in ConstraintDefinition
    if (input.constraints && input.constraints.length > 0) {
      for (const constraint of input.constraints) {
        const definition = await ConstraintDefinition.findOne({
          type: constraint.constraintType,
          isActive: true,
        });
        if (!definition) {
          throw new Error(`Invalid constraint type: ${constraint.constraintType}`);
        }
      }
    }

    // Validate reward types exist in RewardDefinition
    if (input.referrerRewards && input.referrerRewards.length > 0) {
      for (const reward of input.referrerRewards) {
        const definition = await RewardDefinition.findOne({
          type: reward.rewardType,
          isActive: true,
        });
        if (!definition) {
          throw new Error(`Invalid reward type: ${reward.rewardType}`);
        }
      }
    }

    if (input.refereeRewards && input.refereeRewards.length > 0) {
      for (const reward of input.refereeRewards) {
        const definition = await RewardDefinition.findOne({
          type: reward.rewardType,
          isActive: true,
        });
        if (!definition) {
          throw new Error(`Invalid reward type: ${reward.rewardType}`);
        }
      }
    }

    // Convert naira to kobo for NEW constraint values
    const constraints = input.constraints?.map((constraint: any) => {
      if (constraint.constraintType === 'MIN_WALLET_BALANCE' && constraint.value) {
        return { ...constraint, value: Math.round(constraint.value * 100) };
      }
      return constraint;
    }) || [];

    // Convert naira to kobo for NEW reward values
    const referrerRewards = input.referrerRewards?.map((reward: any) => {
      const convertedReward = { ...reward };
      if (reward.rewardType === 'WALLET_CREDIT' || reward.rewardType === 'DISCOUNT_FIXED') {
        convertedReward.value = Math.round(reward.value * 100);
      }
      if (reward.maxValue) {
        convertedReward.maxValue = Math.round(reward.maxValue * 100);
      }
      return convertedReward;
    }) || [];

    const refereeRewards = input.refereeRewards?.map((reward: any) => {
      const convertedReward = { ...reward };
      if (reward.rewardType === 'WALLET_CREDIT' || reward.rewardType === 'DISCOUNT_FIXED') {
        convertedReward.value = Math.round(reward.value * 100);
      }
      if (reward.maxValue) {
        convertedReward.maxValue = Math.round(reward.maxValue * 100);
      }
      return convertedReward;
    }) || [];

    const campaignData: any = {
      ...input,
      constraints,
      referrerRewards,
      refereeRewards,
      createdBy: adminId,
      lastModifiedBy: adminId,
    };

    // OLD: Convert naira to kobo for backward compatibility (if old fields are provided)
    if (input.minWalletBalance !== undefined) {
      campaignData.minWalletBalance = Math.round(input.minWalletBalance * 100);
    }

    if (input.referrerRewardValue !== undefined) {
      if (
        input.referrerRewardType === 'WALLET_CREDIT' ||
        input.referrerRewardType === 'DISCOUNT_FIXED'
      ) {
        campaignData.referrerRewardValue = Math.round(
          input.referrerRewardValue * 100
        );
      } else {
        campaignData.referrerRewardValue = input.referrerRewardValue;
      }
    }

    if (input.refereeRewardValue !== undefined) {
      if (
        input.refereeRewardType === 'WALLET_CREDIT' ||
        input.refereeRewardType === 'DISCOUNT_FIXED'
      ) {
        campaignData.refereeRewardValue = Math.round(input.refereeRewardValue * 100);
      } else {
        campaignData.refereeRewardValue = input.refereeRewardValue;
      }
    }

    if (input.referrerRewardMaxValue) {
      campaignData.referrerRewardMaxValue = Math.round(
        input.referrerRewardMaxValue * 100
      );
    }

    if (input.refereeRewardMaxValue) {
      campaignData.refereeRewardMaxValue = Math.round(
        input.refereeRewardMaxValue * 100
      );
    }

    const campaign = new ReferralCampaign(campaignData);
    await campaign.save();

    return campaign;
  }

  /**
   * Update a referral campaign
   */
  async updateCampaign(
    campaignId: string,
    input: any,
    adminId: string
  ): Promise<ReferralCampaignDocument> {
    const campaign = await ReferralCampaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Convert naira to kobo for monetary values
    const updateData: any = {
      ...input,
      lastModifiedBy: adminId,
    };

    if (input.minWalletBalance !== undefined) {
      updateData.minWalletBalance = Math.round(input.minWalletBalance * 100);
    }

    if (input.referrerRewardValue !== undefined) {
      if (
        campaign.referrerRewardType === 'WALLET_CREDIT' ||
        campaign.referrerRewardType === 'DISCOUNT_FIXED'
      ) {
        updateData.referrerRewardValue = Math.round(
          input.referrerRewardValue * 100
        );
      }
    }

    if (input.refereeRewardValue !== undefined) {
      if (
        campaign.refereeRewardType === 'WALLET_CREDIT' ||
        campaign.refereeRewardType === 'DISCOUNT_FIXED'
      ) {
        updateData.refereeRewardValue = Math.round(input.refereeRewardValue * 100);
      }
    }

    if (input.referrerRewardMaxValue !== undefined) {
      updateData.referrerRewardMaxValue = Math.round(
        input.referrerRewardMaxValue * 100
      );
    }

    if (input.refereeRewardMaxValue !== undefined) {
      updateData.refereeRewardMaxValue = Math.round(
        input.refereeRewardMaxValue * 100
      );
    }

    Object.assign(campaign, updateData);
    await campaign.save();

    return campaign;
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(campaignId: string): Promise<boolean> {
    const campaign = await ReferralCampaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Check if campaign has any active referrals
    const activeReferrals = await ReferralTransaction.countDocuments({
      campaignId,
      status: { $in: [ReferralStatus.PENDING, ReferralStatus.QUALIFIED] },
    });

    if (activeReferrals > 0) {
      throw new Error(
        'Cannot delete campaign with active referrals. Cancel them first or mark campaign as ended.'
      );
    }

    await ReferralCampaign.findByIdAndDelete(campaignId);
    return true;
  }

  /**
   * Toggle campaign active status
   */
  async toggleCampaignStatus(
    campaignId: string,
    isActive: boolean
  ): Promise<ReferralCampaignDocument> {
    const campaign = await ReferralCampaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    campaign.isActive = isActive;
    await campaign.save();

    return campaign;
  }

  /**
   * Change campaign status
   */
  async changeCampaignStatus(
    campaignId: string,
    status: CampaignStatus
  ): Promise<ReferralCampaignDocument> {
    const campaign = await ReferralCampaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    campaign.status = status;
    await campaign.save();

    return campaign;
  }

  /**
   * List campaigns with optional filter
   */
  async listCampaigns(
    statusFilter?: CampaignStatus,
    pagination?: { limit: number; offset: number }
  ): Promise<ReferralCampaignDocument[]> {
    const query: any = {};

    if (statusFilter) {
      query.status = statusFilter;
    }

    let queryBuilder = ReferralCampaign.find(query).sort({ createdAt: -1 });

    if (pagination) {
      queryBuilder = queryBuilder.limit(pagination.limit).skip(pagination.offset);
    }

    return queryBuilder;
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(campaignId: string): Promise<ReferralCampaignDocument> {
    const campaign = await ReferralCampaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    return campaign;
  }

  /**
   * List referral transactions with filters
   */
  async listTransactions(
    filter?: any,
    pagination?: { limit: number; offset: number }
  ): Promise<any[]> {
    const query: any = {};

    if (filter?.status) {
      query.status = filter.status;
    }

    if (filter?.campaignId) {
      query.campaignId = filter.campaignId;
    }

    if (filter?.referrerId) {
      query.referrerId = filter.referrerId;
    }

    if (filter?.refereeId) {
      query.refereeId = filter.refereeId;
    }

    if (filter?.startDate || filter?.endDate) {
      query.createdAt = {};
      if (filter.startDate) {
        query.createdAt.$gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        query.createdAt.$lte = new Date(filter.endDate);
      }
    }

    let queryBuilder = ReferralTransaction.find(query).sort({ createdAt: -1 });

    if (pagination) {
      queryBuilder = queryBuilder.limit(pagination.limit).skip(pagination.offset);
    }

    return queryBuilder;
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string): Promise<any> {
    const transaction = await ReferralTransaction.findById(transactionId);

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }

  /**
   * List rewards with filters
   */
  async listRewards(
    filter?: any,
    pagination?: { limit: number; offset: number }
  ): Promise<any[]> {
    const query: any = {};

    if (filter?.status) {
      query.status = filter.status;
    }

    if (filter?.userId) {
      query.userId = filter.userId;
    }

    if (filter?.campaignId) {
      query.campaignId = filter.campaignId;
    }

    if (filter?.rewardType) {
      query.rewardType = filter.rewardType;
    }

    let queryBuilder = ReferralReward.find(query).sort({ createdAt: -1 });

    if (pagination) {
      queryBuilder = queryBuilder.limit(pagination.limit).skip(pagination.offset);
    }

    return queryBuilder;
  }

  /**
   * Get referral analytics
   */
  async getReferralAnalytics(startDate?: Date, endDate?: Date): Promise<any> {
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = startDate;
      }
      if (endDate) {
        dateFilter.createdAt.$lte = endDate;
      }
    }

    const [
      totalReferrals,
      totalQualified,
      totalCompleted,
      totalPending,
      totalRewardsIssued,
      totalRewardsRedeemed,
    ] = await Promise.all([
      ReferralTransaction.countDocuments(dateFilter),
      ReferralTransaction.countDocuments({
        ...dateFilter,
        status: ReferralStatus.QUALIFIED,
      }),
      ReferralTransaction.countDocuments({
        ...dateFilter,
        status: ReferralStatus.COMPLETED,
      }),
      ReferralTransaction.countDocuments({
        ...dateFilter,
        status: ReferralStatus.PENDING,
      }),
      ReferralReward.countDocuments(dateFilter),
      ReferralReward.countDocuments({
        ...dateFilter,
        status: RewardStatus.REDEEMED,
      }),
    ]);

    const conversionRate =
      totalReferrals > 0 ? (totalCompleted / totalReferrals) * 100 : 0;

    // Calculate average time to qualification
    const qualifiedTransactions = await ReferralTransaction.find({
      ...dateFilter,
      status: { $in: [ReferralStatus.QUALIFIED, ReferralStatus.COMPLETED] },
      qualifiedAt: { $exists: true },
    }).select('createdAt qualifiedAt');

    let averageTimeToQualification = null;
    if (qualifiedTransactions.length > 0) {
      const totalTime = qualifiedTransactions.reduce((sum, txn) => {
        const timeDiff =
          new Date(txn.qualifiedAt!).getTime() - new Date(txn.createdAt).getTime();
        return sum + timeDiff;
      }, 0);

      // Convert to days
      averageTimeToQualification =
        totalTime / qualifiedTransactions.length / (1000 * 60 * 60 * 24);
    }

    return {
      totalReferrals,
      totalQualified,
      totalCompleted,
      totalPending,
      totalRewardsIssued,
      totalRewardsRedeemed,
      conversionRate,
      averageTimeToQualification,
    };
  }

  /**
   * Get campaign-specific analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<any> {
    const campaign = await ReferralCampaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const conversionRate =
      campaign.totalReferrals > 0
        ? (campaign.completedReferrals / campaign.totalReferrals) * 100
        : 0;

    return {
      campaignId: campaign._id,
      campaignName: campaign.name,
      totalReferrals: campaign.totalReferrals,
      qualifiedReferrals: campaign.qualifiedReferrals,
      completedReferrals: campaign.completedReferrals,
      conversionRate,
    };
  }

  /**
   * Manually trigger check for pending referrals
   */
  async checkPendingReferrals(): Promise<number> {
    await referralService.checkPendingReferrals();

    // Return count of now-completed referrals
    const completed = await ReferralTransaction.countDocuments({
      status: ReferralStatus.COMPLETED,
      completedAt: { $gte: new Date(Date.now() - 60000) }, // Last minute
    });

    return completed;
  }

  /**
   * Manually expire old rewards
   */
  async expireOldRewards(): Promise<number> {
    await referralService.expireOldRewards();

    // Return count of expired rewards
    const expired = await ReferralReward.countDocuments({
      status: RewardStatus.EXPIRED,
    });

    return expired;
  }

  /**
   * Cancel a referral transaction
   */
  async cancelTransaction(
    transactionId: string,
    reason?: string
  ): Promise<any> {
    const transaction = await ReferralTransaction.findById(transactionId);

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status === ReferralStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed transaction');
    }

    transaction.status = ReferralStatus.CANCELLED;
    if (reason) {
      transaction.metadata = {
        ...transaction.metadata,
        cancellationReason: reason,
      } as any;
    }

    await transaction.save();

    // Cancel associated rewards if any
    if (transaction.referrerRewardId) {
      await ReferralReward.findByIdAndUpdate(transaction.referrerRewardId, {
        status: RewardStatus.CANCELLED,
      });
    }

    if (transaction.refereeRewardId) {
      await ReferralReward.findByIdAndUpdate(transaction.refereeRewardId, {
        status: RewardStatus.CANCELLED,
      });
    }

    return transaction;
  }

  /**
   * Cancel a reward
   */
  async cancelReward(rewardId: string, reason?: string): Promise<any> {
    const reward = await ReferralReward.findById(rewardId);

    if (!reward) {
      throw new Error('Reward not found');
    }

    if (reward.status === RewardStatus.REDEEMED) {
      throw new Error('Cannot cancel a redeemed reward');
    }

    reward.status = RewardStatus.CANCELLED;
    if (reason) {
      reward.metadata = {
        ...reward.metadata,
        cancellationReason: reason,
      } as any;
    }

    await reward.save();

    return reward;
  }

  /**
   * Get or create system referral config
   */
  async getSystemConfig(): Promise<any> {
    let config = await SystemConfig.findOne({
      category: 'referral',
      key: 'minWalletBalance',
    });

    if (!config) {
      config = new SystemConfig({
        category: 'referral',
        key: 'minWalletBalance',
        value: 200000, // ₦2,000 in kobo
        description: 'Minimum wallet balance required to qualify for referral rewards',
        dataType: 'number',
        isPublic: true,
        isRequired: true,
        defaultValue: 200000,
        lastModifiedBy: 'system',
      });

      await config.save();
    }

    return config;
  }

  /**
   * Update system referral config
   */
  async updateSystemConfig(
    minWalletBalance: number,
    adminId: string
  ): Promise<any> {
    const valueInKobo = Math.round(minWalletBalance * 100);

    const config = await SystemConfig.findOneAndUpdate(
      {
        category: 'referral',
        key: 'minWalletBalance',
      },
      {
        value: valueInKobo,
        lastModifiedBy: adminId,
        lastModifiedAt: new Date(),
      },
      { new: true, upsert: true }
    );

    return config;
  }

  // ==================== NEW: Constraint Definition Management ====================

  /**
   * Create a new constraint definition
   */
  async createConstraintDefinition(
    input: any,
    adminId: string
  ): Promise<ConstraintDefinitionDocument> {
    // Check for duplicate type
    const existing = await ConstraintDefinition.findOne({ type: input.type });
    if (existing) {
      throw new Error(`Constraint type ${input.type} already exists`);
    }

    const definition = new ConstraintDefinition({
      ...input,
      createdBy: adminId,
      lastModifiedBy: adminId,
      isSystemDefined: false,
    });

    await definition.save();
    return definition;
  }

  /**
   * Update a constraint definition
   */
  async updateConstraintDefinition(
    id: string,
    input: any,
    adminId: string
  ): Promise<ConstraintDefinitionDocument> {
    const definition = await ConstraintDefinition.findById(id);

    if (!definition) {
      throw new Error('Constraint definition not found');
    }

    // Allow updates but protect certain fields for system-defined
    const updateData = {
      ...input,
      lastModifiedBy: adminId,
    };

    // Don't allow changing type or isSystemDefined
    delete updateData.type;
    delete updateData.isSystemDefined;

    Object.assign(definition, updateData);
    await definition.save();

    return definition;
  }

  /**
   * Toggle constraint definition active status
   */
  async toggleConstraintDefinition(
    id: string,
    isActive: boolean
  ): Promise<ConstraintDefinitionDocument> {
    const definition = await ConstraintDefinition.findById(id);

    if (!definition) {
      throw new Error('Constraint definition not found');
    }

    definition.isActive = isActive;
    await definition.save();

    return definition;
  }

  /**
   * Delete a constraint definition
   */
  async deleteConstraintDefinition(id: string): Promise<boolean> {
    const definition = await ConstraintDefinition.findById(id);

    if (!definition) {
      throw new Error('Constraint definition not found');
    }

    if (definition.isSystemDefined) {
      throw new Error('Cannot delete system-defined constraint');
    }

    // Check if used in any active campaigns
    const campaignsUsingConstraint = await ReferralCampaign.countDocuments({
      'constraints.constraintType': definition.type,
      status: CampaignStatus.ACTIVE,
    });

    if (campaignsUsingConstraint > 0) {
      throw new Error(
        `Cannot delete constraint type ${definition.type} as it is used in ${campaignsUsingConstraint} active campaign(s)`
      );
    }

    await ConstraintDefinition.findByIdAndDelete(id);
    return true;
  }

  /**
   * List constraint definitions
   */
  async listConstraintDefinitions(
    activeOnly?: boolean
  ): Promise<ConstraintDefinitionDocument[]> {
    const filter: any = {};
    if (activeOnly) {
      filter.isActive = true;
    }

    return ConstraintDefinition.find(filter).sort({ name: 1 });
  }

  /**
   * Get constraint definition by ID
   */
  async getConstraintDefinition(
    id: string
  ): Promise<ConstraintDefinitionDocument> {
    const definition = await ConstraintDefinition.findById(id);

    if (!definition) {
      throw new Error('Constraint definition not found');
    }

    return definition;
  }

  // ==================== NEW: Reward Definition Management ====================

  /**
   * Create a new reward definition
   */
  async createRewardDefinition(
    input: any,
    adminId: string
  ): Promise<RewardDefinitionDocument> {
    // Check for duplicate type
    const existing = await RewardDefinition.findOne({ type: input.type });
    if (existing) {
      throw new Error(`Reward type ${input.type} already exists`);
    }

    const definition = new RewardDefinition({
      ...input,
      createdBy: adminId,
      lastModifiedBy: adminId,
      isSystemDefined: false,
    });

    await definition.save();
    return definition;
  }

  /**
   * Update a reward definition
   */
  async updateRewardDefinition(
    id: string,
    input: any,
    adminId: string
  ): Promise<RewardDefinitionDocument> {
    const definition = await RewardDefinition.findById(id);

    if (!definition) {
      throw new Error('Reward definition not found');
    }

    // Allow updates but protect certain fields for system-defined
    const updateData = {
      ...input,
      lastModifiedBy: adminId,
    };

    // Don't allow changing type or isSystemDefined
    delete updateData.type;
    delete updateData.isSystemDefined;

    Object.assign(definition, updateData);
    await definition.save();

    return definition;
  }

  /**
   * Toggle reward definition active status
   */
  async toggleRewardDefinition(
    id: string,
    isActive: boolean
  ): Promise<RewardDefinitionDocument> {
    const definition = await RewardDefinition.findById(id);

    if (!definition) {
      throw new Error('Reward definition not found');
    }

    definition.isActive = isActive;
    await definition.save();

    return definition;
  }

  /**
   * Delete a reward definition
   */
  async deleteRewardDefinition(id: string): Promise<boolean> {
    const definition = await RewardDefinition.findById(id);

    if (!definition) {
      throw new Error('Reward definition not found');
    }

    if (definition.isSystemDefined) {
      throw new Error('Cannot delete system-defined reward');
    }

    // Check if used in any active campaigns
    const campaignsUsingReward = await ReferralCampaign.countDocuments({
      $or: [
        { 'referrerRewards.rewardType': definition.type },
        { 'refereeRewards.rewardType': definition.type },
      ],
      status: CampaignStatus.ACTIVE,
    });

    if (campaignsUsingReward > 0) {
      throw new Error(
        `Cannot delete reward type ${definition.type} as it is used in ${campaignsUsingReward} active campaign(s)`
      );
    }

    await RewardDefinition.findByIdAndDelete(id);
    return true;
  }

  /**
   * List reward definitions
   */
  async listRewardDefinitions(
    activeOnly?: boolean
  ): Promise<RewardDefinitionDocument[]> {
    const filter: any = {};
    if (activeOnly) {
      filter.isActive = true;
    }

    return RewardDefinition.find(filter).sort({ name: 1 });
  }

  /**
   * Get reward definition by ID
   */
  async getRewardDefinition(id: string): Promise<RewardDefinitionDocument> {
    const definition = await RewardDefinition.findById(id);

    if (!definition) {
      throw new Error('Reward definition not found');
    }

    return definition;
  }

  // ==================== NEW: Seed Definitions ====================

  /**
   * Seed initial constraint and reward definitions
   */
  async seedReferralDefinitions(): Promise<boolean> {
    return seedReferralDefinitions();
  }
}

export default new ReferralAdminService();
