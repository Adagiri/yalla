import { GraphQLError } from 'graphql';
import referralAdminService from './referral-admin.service';

const referralAdminResolvers = {
  Query: {
    /**
     * List constraint definitions
     */
    listConstraintDefinitions: async (
      _: any,
      { activeOnly }: { activeOnly?: boolean },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const definitions = await referralAdminService.listConstraintDefinitions(
          activeOnly
        );
        return definitions;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to list constraint definitions',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * List reward definitions
     */
    listRewardDefinitions: async (
      _: any,
      { activeOnly }: { activeOnly?: boolean },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const definitions = await referralAdminService.listRewardDefinitions(
          activeOnly
        );
        return definitions;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to list reward definitions',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Get specific constraint definition
     */
    getConstraintDefinition: async (
      _: any,
      { id }: { id: string },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const definition = await referralAdminService.getConstraintDefinition(id);
        return definition;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to get constraint definition',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Get specific reward definition
     */
    getRewardDefinition: async (
      _: any,
      { id }: { id: string },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const definition = await referralAdminService.getRewardDefinition(id);
        return definition;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to get reward definition',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * List all referral campaigns
     */
    listReferralCampaigns: async (
      _: any,
      { filter, pagination }: any,
      context: any
    ) => {
      // TODO: Add admin authentication check
      // if (!context.admin) {
      //   throw new GraphQLError('Admin authentication required', {
      //     extensions: { code: 'UNAUTHENTICATED' },
      //   });
      // }

      try {
        const campaigns = await referralAdminService.listCampaigns(
          filter,
          pagination
        );
        return campaigns;
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to list campaigns', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * Get a specific campaign
     */
    getReferralCampaign: async (_: any, { id }: { id: string }, context: any) => {
      // TODO: Add admin authentication check

      try {
        const campaign = await referralAdminService.getCampaign(id);
        return campaign;
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to get campaign', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * List all referral transactions
     */
    listReferralTransactions: async (
      _: any,
      { filter, pagination }: any,
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const transactions = await referralAdminService.listTransactions(
          filter,
          pagination
        );
        return transactions;
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to list transactions', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * Get a specific transaction
     */
    getReferralTransaction: async (
      _: any,
      { id }: { id: string },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const transaction = await referralAdminService.getTransaction(id);
        return transaction;
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to get transaction', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * List all rewards
     */
    listReferralRewards: async (
      _: any,
      { filter, pagination }: any,
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const rewards = await referralAdminService.listRewards(filter, pagination);
        return rewards;
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to list rewards', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * Get referral analytics
     */
    getReferralAnalytics: async (
      _: any,
      { startDate, endDate }: any,
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const analytics = await referralAdminService.getReferralAnalytics(
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        );
        return analytics;
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to get analytics', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * Get campaign analytics
     */
    getCampaignAnalytics: async (
      _: any,
      { campaignId }: { campaignId: string },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const analytics = await referralAdminService.getCampaignAnalytics(
          campaignId
        );
        return analytics;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to get campaign analytics',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Get system referral config
     */
    getReferralSystemConfig: async (_: any, __: any, context: any) => {
      // TODO: Add admin authentication check

      try {
        const config = await referralAdminService.getSystemConfig();
        return config;
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to get system config', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },
  },

  Mutation: {
    /**
     * Create a new campaign
     */
    createReferralCampaign: async (_: any, { input }: any, context: any) => {
      // TODO: Add admin authentication check
      // const adminId = context.admin.id;
      const adminId = 'admin'; // Temporary

      try {
        const campaign = await referralAdminService.createCampaign(
          input,
          adminId
        );
        return campaign;
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to create campaign', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * Update a campaign
     */
    updateReferralCampaign: async (_: any, { id, input }: any, context: any) => {
      // TODO: Add admin authentication check
      const adminId = 'admin'; // Temporary

      try {
        const campaign = await referralAdminService.updateCampaign(
          id,
          input,
          adminId
        );
        return campaign;
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to update campaign', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * Delete a campaign
     */
    deleteReferralCampaign: async (
      _: any,
      { id }: { id: string },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const result = await referralAdminService.deleteCampaign(id);
        return result;
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to delete campaign', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * Toggle campaign status
     */
    toggleCampaignStatus: async (
      _: any,
      { id, isActive }: { id: string; isActive: boolean },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const campaign = await referralAdminService.toggleCampaignStatus(
          id,
          isActive
        );
        return campaign;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to toggle campaign status',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Change campaign status
     */
    changeCampaignStatus: async (
      _: any,
      { id, status }: { id: string; status: any },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const campaign = await referralAdminService.changeCampaignStatus(
          id,
          status
        );
        return campaign;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to change campaign status',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Check pending referrals
     */
    checkPendingReferrals: async (_: any, __: any, context: any) => {
      // TODO: Add admin authentication check

      try {
        const count = await referralAdminService.checkPendingReferrals();
        return count;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to check pending referrals',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Expire old rewards
     */
    expireOldRewards: async (_: any, __: any, context: any) => {
      // TODO: Add admin authentication check

      try {
        const count = await referralAdminService.expireOldRewards();
        return count;
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to expire old rewards', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * Cancel a referral transaction
     */
    cancelReferralTransaction: async (
      _: any,
      { id, reason }: { id: string; reason?: string },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const transaction = await referralAdminService.cancelTransaction(
          id,
          reason
        );
        return transaction;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to cancel transaction',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Cancel a reward
     */
    cancelReward: async (
      _: any,
      { id, reason }: { id: string; reason?: string },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const reward = await referralAdminService.cancelReward(id, reason);
        return reward;
      } catch (error: any) {
        throw new GraphQLError(error.message || 'Failed to cancel reward', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * Create constraint definition
     */
    createConstraintDefinition: async (_: any, { input }: any, context: any) => {
      // TODO: Add admin authentication check
      const adminId = 'admin'; // Temporary

      try {
        const definition = await referralAdminService.createConstraintDefinition(
          input,
          adminId
        );
        return definition;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to create constraint definition',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Update constraint definition
     */
    updateConstraintDefinition: async (
      _: any,
      { id, input }: { id: string; input: any },
      context: any
    ) => {
      // TODO: Add admin authentication check
      const adminId = 'admin'; // Temporary

      try {
        const definition = await referralAdminService.updateConstraintDefinition(
          id,
          input,
          adminId
        );
        return definition;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to update constraint definition',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Toggle constraint definition
     */
    toggleConstraintDefinition: async (
      _: any,
      { id, isActive }: { id: string; isActive: boolean },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const definition = await referralAdminService.toggleConstraintDefinition(
          id,
          isActive
        );
        return definition;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to toggle constraint definition',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Delete constraint definition
     */
    deleteConstraintDefinition: async (
      _: any,
      { id }: { id: string },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const result = await referralAdminService.deleteConstraintDefinition(id);
        return result;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to delete constraint definition',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Create reward definition
     */
    createRewardDefinition: async (_: any, { input }: any, context: any) => {
      // TODO: Add admin authentication check
      const adminId = 'admin'; // Temporary

      try {
        const definition = await referralAdminService.createRewardDefinition(
          input,
          adminId
        );
        return definition;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to create reward definition',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Update reward definition
     */
    updateRewardDefinition: async (
      _: any,
      { id, input }: { id: string; input: any },
      context: any
    ) => {
      // TODO: Add admin authentication check
      const adminId = 'admin'; // Temporary

      try {
        const definition = await referralAdminService.updateRewardDefinition(
          id,
          input,
          adminId
        );
        return definition;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to update reward definition',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Toggle reward definition
     */
    toggleRewardDefinition: async (
      _: any,
      { id, isActive }: { id: string; isActive: boolean },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const definition = await referralAdminService.toggleRewardDefinition(
          id,
          isActive
        );
        return definition;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to toggle reward definition',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Delete reward definition
     */
    deleteRewardDefinition: async (
      _: any,
      { id }: { id: string },
      context: any
    ) => {
      // TODO: Add admin authentication check

      try {
        const result = await referralAdminService.deleteRewardDefinition(id);
        return result;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to delete reward definition',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Seed referral definitions
     */
    seedReferralDefinitions: async (_: any, __: any, context: any) => {
      // TODO: Add admin authentication check (super admin only)

      try {
        const result = await referralAdminService.seedReferralDefinitions();
        return result;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to seed referral definitions',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },

    /**
     * Update system referral config
     */
    updateReferralSystemConfig: async (
      _: any,
      { minWalletBalance }: { minWalletBalance: number },
      context: any
    ) => {
      // TODO: Add admin authentication check
      const adminId = 'admin'; // Temporary

      try {
        const config = await referralAdminService.updateSystemConfig(
          minWalletBalance,
          adminId
        );
        return config;
      } catch (error: any) {
        throw new GraphQLError(
          error.message || 'Failed to update system config',
          {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          }
        );
      }
    },
  },
};

export default referralAdminResolvers;
