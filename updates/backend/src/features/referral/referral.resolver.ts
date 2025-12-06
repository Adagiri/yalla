import { GraphQLError } from 'graphql';
import referralService from './referral.service';
import { AccountType_ } from '../../constants/general';

const referralResolvers = {
  Query: {
    /**
     * Get the logged-in user's referral code
     */
    myReferralCode: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const userId = context.user.id;
      const userType = context.user.accountType || AccountType_.CUSTOMER;

      try {
        const referralCode = await referralService.getUserReferralCode(
          userId,
          userType
        );
        return referralCode;
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to get referral code', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * Get the logged-in user's referral statistics
     */
    myReferralStats: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const userId = context.user.id;

      try {
        const stats = await referralService.getUserReferralStats(userId);
        return stats;
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to get referral stats', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * Get the logged-in user's available rewards
     */
    myAvailableRewards: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const userId = context.user.id;

      try {
        const rewards = await referralService.getUserAvailableRewards(userId);
        return rewards;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to get available rewards',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Validate a referral code
     */
    validateReferralCode: async (_: any, { code }: { code: string }) => {
      try {
        const validation = await referralService.validateReferralCode(code);
        return {
          isValid: validation.isValid,
          error: validation.error,
          campaign: validation.campaign,
        };
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to validate referral code',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Get active campaigns
     */
    getActiveCampaigns: async () => {
      try {
        const campaigns = await referralService.getActiveCampaign();
        return campaigns ? [campaigns] : [];
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to get active campaigns', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },
  },

  Mutation: {
    /**
     * Generate a custom referral code
     */
    generateCustomReferralCode: async (
      _: any,
      { customCode }: { customCode: string },
      context: any
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const userId = context.user.id;
      const userType = context.user.accountType || AccountType_.CUSTOMER;

      // Validate custom code format (alphanumeric, 4-12 characters)
      if (!/^[A-Z0-9]{4,12}$/i.test(customCode)) {
        throw new GraphQLError(
          'Custom code must be 4-12 alphanumeric characters',
          {
            extensions: { code: 'BAD_USER_INPUT' },
          }
        );
      }

      try {
        const referralCode = await referralService.generateReferralCode(
          userId,
          userType,
          customCode.toUpperCase()
        );
        return referralCode;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to generate custom referral code',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },
  },

  // Field resolvers
  ReferralCode: {
    campaign: async (parent: any) => {
      if (!parent.campaignId) return null;
      const ReferralCampaign = (await import('./referral-campaign.model'))
        .default;
      return ReferralCampaign.findById(parent.campaignId);
    },
  },

  ReferralTransaction: {
    campaign: async (parent: any) => {
      if (!parent.campaignId) return null;
      const ReferralCampaign = (await import('./referral-campaign.model'))
        .default;
      return ReferralCampaign.findById(parent.campaignId);
    },
    referrerReward: async (parent: any) => {
      if (!parent.referrerRewardId) return null;
      const ReferralReward = (await import('./referral-reward.model')).default;
      return ReferralReward.findById(parent.referrerRewardId);
    },
    refereeReward: async (parent: any) => {
      if (!parent.refereeRewardId) return null;
      const ReferralReward = (await import('./referral-reward.model')).default;
      return ReferralReward.findById(parent.refereeRewardId);
    },
  },

  ReferralReward: {
    campaign: async (parent: any) => {
      if (!parent.campaignId) return null;
      const ReferralCampaign = (await import('./referral-campaign.model'))
        .default;
      return ReferralCampaign.findById(parent.campaignId);
    },
  },
};

export default referralResolvers;
