import ReferralCode, { ReferralCodeDocument } from './referral-code.model';
import ReferralTransaction, {
  ReferralTransactionDocument,
  ReferralStatus,
} from './referral-transaction.model';
import ReferralCampaign, {
  ReferralCampaignDocument,
  CampaignStatus,
  CampaignType,
  CampaignConstraint,
} from './referral-campaign.model';
import ReferralReward, {
  ReferralRewardDocument,
  RewardStatus,
} from './referral-reward.model';
import Wallet from '../../models/wallet.model';
import Customer from '../customer/customer.model';
import Driver from '../driver/driver.model';
import Trip from '../trip/trip.model';
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
   * Check if a specific constraint is met
   */
  async checkConstraint(
    constraint: CampaignConstraint,
    referrer: any,
    referee: any
  ): Promise<boolean> {
    // Skip NONE constraint
    if (constraint.constraintType === 'NONE') {
      return true;
    }

    // Determine which users to check
    const usersToCheck =
      constraint.appliesTo === 'REFERRER' ? [referrer] :
      constraint.appliesTo === 'REFEREE' ? [referee] :
      [referrer, referee];

    for (const user of usersToCheck) {
      // User type filter
      if (constraint.userTypes?.length &&
          !constraint.userTypes.includes(user.accountType)) {
        continue;
      }

      // Check based on constraintType
      switch (constraint.constraintType) {
        case 'MIN_WALLET_BALANCE': {
          const wallet = await Wallet.findOne({ userId: user._id });
          if (!wallet || wallet.balance < (constraint.value as number)) {
            return false;
          }
          break;
        }

        case 'MIN_TRIP_COUNT': {
          const tripCount = await Trip.countDocuments({
            [user.accountType === 'DRIVER' ? 'driverId' : 'customerId']: user._id,
            status: 'COMPLETED',
          });
          if (tripCount < (constraint.value as number)) {
            return false;
          }
          break;
        }

        case 'ACCOUNT_AGE_DAYS': {
          const accountAge = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          if (accountAge < (constraint.value as number)) {
            return false;
          }
          break;
        }

        case 'VERIFIED_ACCOUNT': {
          if (!user.isEmailVerified && !user.isPhoneVerified) {
            return false;
          }
          break;
        }

        case 'COMPLETED_PROFILE': {
          // Check if user has completed all required profile fields
          if (!this.isProfileComplete(user)) {
            return false;
          }
          break;
        }

        case 'FIRST_TRIP_COMPLETED': {
          const hasCompletedTrip = await Trip.exists({
            [user.accountType === 'DRIVER' ? 'driverId' : 'customerId']: user._id,
            status: 'COMPLETED',
          });
          if (!hasCompletedTrip) {
            return false;
          }
          break;
        }

        case 'MIN_RATING': {
          if (!user.rating || user.rating < (constraint.value as number)) {
            return false;
          }
          break;
        }

        default:
          throw new Error(`Unknown constraint type: ${constraint.constraintType}`);
      }
    }

    return true;
  }

  /**
   * Check if user profile is complete
   */
  private isProfileComplete(user: any): boolean {
    // Basic profile completeness check
    return !!(
      user.firstname &&
      user.lastname &&
      user.email &&
      user.phoneNumber
    );
  }

  /**
   * Check if a referral transaction qualifies for rewards (NEW: supports constraints array)
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

    // Get campaign if available
    let campaign: ReferralCampaignDocument | null = null;
    if (transaction.campaignId) {
      campaign = await ReferralCampaign.findById(transaction.campaignId);
    }

    // Get referrer and referee user objects
    const referrer = transaction.referrerType === AccountType.CUSTOMER
      ? await Customer.findById(transaction.referrerId)
      : await Driver.findById(transaction.referrerId);

    const referee = transaction.refereeType === AccountType.CUSTOMER
      ? await Customer.findById(transaction.refereeId)
      : await Driver.findById(transaction.refereeId);

    if (!referrer || !referee) {
      return {
        qualified: false,
        message: 'One or both users not found',
      };
    }

    // NEW: Check campaign constraints if available
    if (campaign?.constraints && campaign.constraints.length > 0) {
      for (const constraint of campaign.constraints) {
        const passes = await this.checkConstraint(constraint, referrer, referee);
        if (!passes) {
          return {
            qualified: false,
            message: `Failed constraint: ${constraint.constraintType}`,
          };
        }
      }

      // All constraints passed
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
        message: 'All constraints met',
      };
    }

    // OLD: Fallback to wallet balance check for backward compatibility
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
   * Issue rewards for a qualified referral (NEW: supports rewards arrays)
   */
  async issueRewards(transactionId: string): Promise<{
    referrerReward: ReferralRewardDocument | null;
    refereeReward: ReferralRewardDocument | null;
    referrerRewards?: ReferralRewardDocument[];
    refereeRewards?: ReferralRewardDocument[];
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

    // Calculate expiry date
    const rewardExpiryDays = campaign?.rewardExpiryDays;
    let expiresAt: Date | undefined;
    if (rewardExpiryDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + rewardExpiryDays);
    }

    // Get referee and referrer names for descriptions
    const referee = transaction.refereeType === AccountType.CUSTOMER
      ? await Customer.findById(transaction.refereeId).select('firstname lastname')
      : await Driver.findById(transaction.refereeId).select('firstname lastname');

    const referrer = transaction.referrerType === AccountType.CUSTOMER
      ? await Customer.findById(transaction.referrerId).select('firstname lastname')
      : await Driver.findById(transaction.referrerId).select('firstname lastname');

    const refereeName = referee
      ? `${referee.firstname} ${referee.lastname}`
      : 'a friend';

    const referrerName = referrer
      ? `${referrer.firstname} ${referrer.lastname}`
      : 'a friend';

    const createdReferrerRewards: ReferralRewardDocument[] = [];
    const createdRefereeRewards: ReferralRewardDocument[] = [];

    // NEW: Issue multiple referrer rewards if campaign uses new structure
    if (campaign?.referrerRewards && campaign.referrerRewards.length > 0) {
      for (const rewardConfig of campaign.referrerRewards) {
        if (rewardConfig.rewardType === 'NONE') {
          continue;
        }

        const reward = new ReferralReward({
          userId: transaction.referrerId,
          userType: transaction.referrerType,
          rewardType: rewardConfig.rewardType,
          rewardValue: rewardConfig.value,
          maxValue: rewardConfig.maxValue,
          referralTransactionId: transaction._id,
          campaignId: transaction.campaignId,
          isReferrer: true,
          status: RewardStatus.AVAILABLE,
          availableFrom: new Date(),
          expiresAt,
          description: `Referral reward for inviting ${refereeName}`,
        });

        await reward.save();
        createdReferrerRewards.push(reward);
      }
    }

    // NEW: Issue multiple referee rewards if campaign uses new structure
    if (campaign?.refereeRewards && campaign.refereeRewards.length > 0) {
      for (const rewardConfig of campaign.refereeRewards) {
        if (rewardConfig.rewardType === 'NONE') {
          continue;
        }

        const reward = new ReferralReward({
          userId: transaction.refereeId,
          userType: transaction.refereeType,
          rewardType: rewardConfig.rewardType,
          rewardValue: rewardConfig.value,
          maxValue: rewardConfig.maxValue,
          referralTransactionId: transaction._id,
          campaignId: transaction.campaignId,
          isReferrer: false,
          status: RewardStatus.AVAILABLE,
          availableFrom: new Date(),
          expiresAt,
          description: `Welcome reward for joining via ${referrerName}'s referral`,
        });

        await reward.save();
        createdRefereeRewards.push(reward);
      }
    }

    // OLD: Fallback to old single reward structure for backward compatibility
    let referrerReward: ReferralRewardDocument | null = null;
    let refereeReward: ReferralRewardDocument | null = null;

    if (createdReferrerRewards.length === 0 && campaign?.referrerRewardType && campaign.referrerRewardType !== 'NONE') {
      referrerReward = new ReferralReward({
        userId: transaction.referrerId,
        userType: transaction.referrerType,
        rewardType: campaign.referrerRewardType,
        rewardValue: campaign.referrerRewardValue || 1,
        maxValue: campaign.referrerRewardMaxValue,
        referralTransactionId: transaction._id,
        campaignId: transaction.campaignId,
        isReferrer: true,
        status: RewardStatus.AVAILABLE,
        availableFrom: new Date(),
        expiresAt,
        description: `Referral reward for inviting ${refereeName}`,
      });

      await referrerReward.save();
      createdReferrerRewards.push(referrerReward);
    } else if (createdReferrerRewards.length > 0) {
      referrerReward = createdReferrerRewards[0];
    }

    if (createdRefereeRewards.length === 0 && campaign?.refereeRewardType && campaign.refereeRewardType !== 'NONE') {
      refereeReward = new ReferralReward({
        userId: transaction.refereeId,
        userType: transaction.refereeType,
        rewardType: campaign.refereeRewardType,
        rewardValue: campaign.refereeRewardValue || 1,
        maxValue: campaign.refereeRewardMaxValue,
        referralTransactionId: transaction._id,
        campaignId: transaction.campaignId,
        isReferrer: false,
        status: RewardStatus.AVAILABLE,
        availableFrom: new Date(),
        expiresAt,
        description: `Welcome reward for joining via ${referrerName}'s referral`,
      });

      await refereeReward.save();
      createdRefereeRewards.push(refereeReward);
    } else if (createdRefereeRewards.length > 0) {
      refereeReward = createdRefereeRewards[0];
    }

    // Update transaction
    transaction.status = ReferralStatus.COMPLETED;
    transaction.completedAt = new Date();
    transaction.referrerRewardId = referrerReward?._id;
    transaction.refereeRewardId = refereeReward?._id;
    await transaction.save();

    // Update campaign stats
    if (transaction.campaignId && campaign) {
      await ReferralCampaign.findByIdAndUpdate(transaction.campaignId, {
        $inc: { completedReferrals: 1, currentRedemptions: 1 },
      });
    }

    return {
      referrerReward,
      refereeReward,
      referrerRewards: createdReferrerRewards,
      refereeRewards: createdRefereeRewards,
    };
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
