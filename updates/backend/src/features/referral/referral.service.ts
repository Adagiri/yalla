import ReferralCode, { ReferralCodeDocument } from './referral-code.model';
import ReferralTransaction, {
  ReferralTransactionDocument,
  ReferralStatus,
} from './referral-transaction.model';
import ReferralCampaign, {
  ReferralCampaignDocument,
  CampaignStatus,
  CampaignType,
} from './referral-campaign.model';
import ReferralReward, {
  ReferralRewardDocument,
  RewardStatus,
} from './referral-reward.model';
import Wallet from '../../models/wallet.model';
import Customer from '../customer/customer.model';
import SystemConfig from '../admin/system-config.model';
import { AccountType } from '../../constants/general';

class ReferralService {
  /**
   * Generate a unique referral code for a user
   */
  async generateReferralCode(
    userId: string,
    userType: AccountType,
    customCode?: string,
    campaignId?: string
  ): Promise<ReferralCodeDocument> {
    // Check if user already has a referral code
    const existingCode = await ReferralCode.findOne({
      userId,
      isActive: true,
      ...(campaignId ? { campaignId } : { campaignId: { $exists: false } }),
    });

    if (existingCode) {
      return existingCode;
    }

    // Generate code
    let code = customCode;
    if (!code) {
      // Auto-generate code from user's name + random string
      const user = await Customer.findById(userId).select('firstname lastname');
      if (user) {
        const namePart = (user.firstname || '')
          .substring(0, 4)
          .toUpperCase()
          .replace(/[^A-Z]/g, '');
        const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
        code = `${namePart}${randomPart}`;
      } else {
        // Fallback to random code
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
      }
    }

    // Ensure uniqueness
    let finalCode = code;
    let attempts = 0;
    while (attempts < 10) {
      const existing = await ReferralCode.findOne({ code: finalCode });
      if (!existing) break;

      finalCode = `${code}${Math.floor(Math.random() * 99)}`;
      attempts++;
    }

    if (attempts >= 10) {
      throw new Error('Could not generate unique referral code');
    }

    // Create referral code
    const referralCode = new ReferralCode({
      userId,
      userType,
      code: finalCode,
      campaignId,
    });

    await referralCode.save();
    return referralCode;
  }

  /**
   * Validate a referral code
   */
  async validateReferralCode(code: string): Promise<{
    isValid: boolean;
    referralCode?: ReferralCodeDocument;
    campaign?: ReferralCampaignDocument;
    error?: string;
  }> {
    const referralCode = await ReferralCode.findOne({
      code: code.toUpperCase(),
      isActive: true,
    });

    if (!referralCode) {
      return { isValid: false, error: 'Invalid referral code' };
    }

    // Check usage limit
    if (
      referralCode.maxUsageLimit &&
      referralCode.timesUsed >= referralCode.maxUsageLimit
    ) {
      return { isValid: false, error: 'Referral code usage limit reached' };
    }

    // Check campaign if associated
    if (referralCode.campaignId) {
      const campaign = await ReferralCampaign.findById(referralCode.campaignId);

      if (!campaign) {
        return { isValid: false, error: 'Campaign not found' };
      }

      if (campaign.status !== CampaignStatus.ACTIVE || !campaign.isActive) {
        return { isValid: false, error: 'Campaign is not active' };
      }

      const now = new Date();
      if (campaign.startDate > now) {
        return { isValid: false, error: 'Campaign has not started yet' };
      }

      if (campaign.endDate && campaign.endDate < now) {
        return { isValid: false, error: 'Campaign has ended' };
      }

      if (
        campaign.maxTotalRedemptions &&
        campaign.currentRedemptions >= campaign.maxTotalRedemptions
      ) {
        return { isValid: false, error: 'Campaign has reached maximum redemptions' };
      }

      return { isValid: true, referralCode, campaign };
    }

    return { isValid: true, referralCode };
  }

  /**
   * Create a referral transaction when a new user signs up with a referral code
   */
  async createReferralTransaction(
    referralCode: string,
    refereeId: string,
    refereeType: AccountType,
    metadata?: any
  ): Promise<ReferralTransactionDocument> {
    // Validate code
    const validation = await this.validateReferralCode(referralCode);
    if (!validation.isValid || !validation.referralCode) {
      throw new Error(validation.error || 'Invalid referral code');
    }

    // Check if referee already used a referral code
    const existingReferral = await ReferralTransaction.findOne({ refereeId });
    if (existingReferral) {
      throw new Error('User has already been referred');
    }

    // Get minimum wallet balance requirement
    let minWalletBalance = 200000; // Default ₦2,000 in kobo

    if (validation.campaign) {
      minWalletBalance = validation.campaign.minWalletBalance;
    } else {
      // Get from system config
      const config = await SystemConfig.findOne({
        category: 'referral',
        key: 'minWalletBalance',
      });
      if (config && config.value) {
        minWalletBalance = config.value;
      }
    }

    // Create transaction
    const transaction = new ReferralTransaction({
      referrerId: validation.referralCode.userId,
      referrerType: validation.referralCode.userType,
      refereeId,
      refereeType,
      referralCode: referralCode.toUpperCase(),
      campaignId: validation.campaign?._id,
      status: ReferralStatus.PENDING,
      requiredWalletBalance: minWalletBalance,
      metadata,
    });

    await transaction.save();

    // Update referral code usage
    await ReferralCode.findByIdAndUpdate(validation.referralCode._id, {
      $inc: { timesUsed: 1 },
    });

    // Update campaign stats
    if (validation.campaign) {
      await ReferralCampaign.findByIdAndUpdate(validation.campaign._id, {
        $inc: { totalReferrals: 1 },
      });
    }

    return transaction;
  }

  /**
   * Check if a referral transaction qualifies for rewards
   */
  async checkQualification(
    transactionId: string
  ): Promise<{ qualified: boolean; message: string }> {
    const transaction = await ReferralTransaction.findById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== ReferralStatus.PENDING) {
      return {
        qualified: false,
        message: `Transaction is already ${transaction.status.toLowerCase()}`,
      };
    }

    // Get wallet balances
    const referrerWallet = await Wallet.findOne({ userId: transaction.referrerId });
    const refereeWallet = await Wallet.findOne({ userId: transaction.refereeId });

    if (!referrerWallet || !refereeWallet) {
      return {
        qualified: false,
        message: 'One or both users do not have wallets',
      };
    }

    const referrerBalance = referrerWallet.balance; // Already in kobo
    const refereeBalance = refereeWallet.balance; // Already in kobo

    // Update transaction with current balances
    transaction.referrerWalletBalance = referrerBalance;
    transaction.refereeWalletBalance = refereeBalance;

    // Check if both meet the requirement
    const required = transaction.requiredWalletBalance;

    if (referrerBalance >= required && refereeBalance >= required) {
      transaction.status = ReferralStatus.QUALIFIED;
      transaction.qualifiedAt = new Date();
      await transaction.save();

      // Update campaign stats
      if (transaction.campaignId) {
        await ReferralCampaign.findByIdAndUpdate(transaction.campaignId, {
          $inc: { qualifiedReferrals: 1 },
        });
      }

      return {
        qualified: true,
        message: 'Both users meet the wallet balance requirement',
      };
    }

    await transaction.save();

    return {
      qualified: false,
      message: `Referrer balance: ₦${(referrerBalance / 100).toFixed(2)}, Referee balance: ₦${(refereeBalance / 100).toFixed(2)}, Required: ₦${(required / 100).toFixed(2)}`,
    };
  }

  /**
   * Issue rewards for a qualified referral
   */
  async issueRewards(transactionId: string): Promise<{
    referrerReward: ReferralRewardDocument;
    refereeReward: ReferralRewardDocument;
  }> {
    const transaction = await ReferralTransaction.findById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== ReferralStatus.QUALIFIED) {
      throw new Error('Transaction is not qualified for rewards');
    }

    // Get campaign or use default settings
    let campaign: ReferralCampaignDocument | null = null;
    if (transaction.campaignId) {
      campaign = await ReferralCampaign.findById(transaction.campaignId);
    }

    // Default reward settings (1 free ride each)
    const referrerRewardType = campaign?.referrerRewardType || 'FREE_RIDE';
    const referrerRewardValue = campaign?.referrerRewardValue || 1;
    const refereeRewardType = campaign?.refereeRewardType || 'FREE_RIDE';
    const refereeRewardValue = campaign?.refereeRewardValue || 1;
    const rewardExpiryDays = campaign?.rewardExpiryDays;

    // Calculate expiry date
    let expiresAt: Date | undefined;
    if (rewardExpiryDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + rewardExpiryDays);
    }

    // Get referee name for description
    const referee = await Customer.findById(transaction.refereeId).select(
      'firstname lastname'
    );
    const refereeName = referee
      ? `${referee.firstname} ${referee.lastname}`
      : 'a friend';

    // Create referrer reward
    const referrerReward = new ReferralReward({
      userId: transaction.referrerId,
      userType: transaction.referrerType,
      rewardType: referrerRewardType,
      rewardValue: referrerRewardValue,
      referralTransactionId: transaction._id,
      campaignId: transaction.campaignId,
      isReferrer: true,
      status: RewardStatus.AVAILABLE,
      availableFrom: new Date(),
      expiresAt,
      description: `Referral reward for inviting ${refereeName}`,
    });

    await referrerReward.save();

    // Get referrer name for description
    const referrer = await Customer.findById(transaction.referrerId).select(
      'firstname lastname'
    );
    const referrerName = referrer
      ? `${referrer.firstname} ${referrer.lastname}`
      : 'a friend';

    // Create referee reward
    const refereeReward = new ReferralReward({
      userId: transaction.refereeId,
      userType: transaction.refereeType,
      rewardType: refereeRewardType,
      rewardValue: refereeRewardValue,
      referralTransactionId: transaction._id,
      campaignId: transaction.campaignId,
      isReferrer: false,
      status: RewardStatus.AVAILABLE,
      availableFrom: new Date(),
      expiresAt,
      description: `Welcome reward for joining via ${referrerName}'s referral`,
    });

    await refereeReward.save();

    // Update transaction
    transaction.status = ReferralStatus.COMPLETED;
    transaction.completedAt = new Date();
    transaction.referrerRewardId = referrerReward._id;
    transaction.refereeRewardId = refereeReward._id;
    await transaction.save();

    // Update campaign stats
    if (transaction.campaignId && campaign) {
      await ReferralCampaign.findByIdAndUpdate(transaction.campaignId, {
        $inc: { completedReferrals: 1, currentRedemptions: 1 },
      });
    }

    return { referrerReward, refereeReward };
  }

  /**
   * Get user's referral code
   */
  async getUserReferralCode(
    userId: string,
    userType: AccountType
  ): Promise<ReferralCodeDocument> {
    const code = await ReferralCode.findOne({ userId, isActive: true });

    if (!code) {
      // Generate one if it doesn't exist
      return await this.generateReferralCode(userId, userType);
    }

    return code;
  }

  /**
   * Get user's referral statistics
   */
  async getUserReferralStats(userId: string) {
    const referralCode = await ReferralCode.findOne({ userId, isActive: true });

    if (!referralCode) {
      return {
        totalReferrals: 0,
        pendingReferrals: 0,
        qualifiedReferrals: 0,
        completedReferrals: 0,
        availableRewards: 0,
        redeemedRewards: 0,
      };
    }

    const transactions = await ReferralTransaction.find({
      referrerId: userId,
    });

    const rewards = await ReferralReward.find({ userId });

    return {
      referralCode: referralCode.code,
      totalReferrals: transactions.length,
      pendingReferrals: transactions.filter((t) => t.status === ReferralStatus.PENDING)
        .length,
      qualifiedReferrals: transactions.filter(
        (t) => t.status === ReferralStatus.QUALIFIED
      ).length,
      completedReferrals: transactions.filter(
        (t) => t.status === ReferralStatus.COMPLETED
      ).length,
      availableRewards: rewards.filter((r) => r.status === RewardStatus.AVAILABLE)
        .length,
      redeemedRewards: rewards.filter((r) => r.status === RewardStatus.REDEEMED)
        .length,
      rewards: rewards.map((r) => ({
        id: r._id,
        type: r.rewardType,
        value: r.rewardValue,
        status: r.status,
        description: r.description,
        expiresAt: r.expiresAt,
      })),
    };
  }

  /**
   * Get user's available rewards
   */
  async getUserAvailableRewards(userId: string): Promise<ReferralRewardDocument[]> {
    const now = new Date();
    return ReferralReward.find({
      userId,
      status: RewardStatus.AVAILABLE,
      $and: [
        { $or: [{ availableFrom: { $lte: now } }, { availableFrom: { $exists: false } }] },
        { $or: [{ expiresAt: { $gte: now } }, { expiresAt: { $exists: false } }] },
      ],
    });
  }

  /**
   * Check all pending referrals and update their qualification status
   */
  async checkPendingReferrals(): Promise<void> {
    const pendingTransactions = await ReferralTransaction.find({
      status: ReferralStatus.PENDING,
    });

    for (const transaction of pendingTransactions) {
      try {
        const result = await this.checkQualification(transaction._id);

        if (result.qualified) {
          // Auto-issue rewards
          await this.issueRewards(transaction._id);
          console.log(
            `Issued rewards for referral transaction ${transaction._id}`
          );
        }
      } catch (error) {
        console.error(
          `Error checking referral transaction ${transaction._id}:`,
          error
        );
      }
    }
  }

  /**
   * Expire old rewards
   */
  async expireOldRewards(): Promise<void> {
    const now = new Date();
    await ReferralReward.updateMany(
      {
        status: RewardStatus.AVAILABLE,
        expiresAt: { $lt: now },
      },
      {
        $set: { status: RewardStatus.EXPIRED },
      }
    );
  }

  /**
   * Get active campaign (default signup campaign or latest active)
   */
  async getActiveCampaign(
    type: CampaignType = CampaignType.SIGNUP
  ): Promise<ReferralCampaignDocument | null> {
    const now = new Date();

    return ReferralCampaign.findOne({
      type,
      status: CampaignStatus.ACTIVE,
      isActive: true,
      startDate: { $lte: now },
      $or: [{ endDate: { $gte: now } }, { endDate: { $exists: false } }],
    }).sort({ createdAt: -1 });
  }
}

export default new ReferralService();
