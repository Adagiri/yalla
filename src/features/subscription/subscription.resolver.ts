// src/features/subscription/subscription.resolver.ts
import { combineResolvers } from 'graphql-resolvers';
import SubscriptionController from './subscription.controller';
import { protectEntities } from '../../utils/auth-middleware';

const subscriptionResolvers = {
  Query: {
    // Get active subscription plans (Public for drivers to see available plans)
    getActiveSubscriptionPlans:
      SubscriptionController.getActiveSubscriptionPlans,

    // Get all subscription plans (Admin only)
    getAllSubscriptionPlans: combineResolvers(
      protectEntities(['ADMIN']),
      SubscriptionController.getAllSubscriptionPlans
    ),

    // Get subscription plan by ID
    getSubscriptionPlan: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER']),
      SubscriptionController.getSubscriptionPlan
    ),

    // Get driver's active subscription
    getDriverActiveSubscription: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER']),
      SubscriptionController.getDriverActiveSubscription
    ),

    // Get driver's subscription history
    getDriverSubscriptionHistory: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER']),
      SubscriptionController.getDriverSubscriptionHistory
    ),

    // Get all driver subscriptions (Admin only)
    getAllDriverSubscriptions: combineResolvers(
      protectEntities(['ADMIN']),
      SubscriptionController.getAllDriverSubscriptions
    ),

    // Get subscription statistics (Admin only)
    getSubscriptionStats: combineResolvers(
      protectEntities(['ADMIN']),
      SubscriptionController.getSubscriptionStats
    ),

    // Check if driver can accept rides
    canDriverAcceptRides: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER']),
      SubscriptionController.canDriverAcceptRides
    ),
  },

  Mutation: {
    // Admin: Create subscription plan
    createSubscriptionPlan: combineResolvers(
      protectEntities(['ADMIN']),
      SubscriptionController.createSubscriptionPlan
    ),

    // Admin: Update subscription plan
    updateSubscriptionPlan: combineResolvers(
      protectEntities(['ADMIN']),
      SubscriptionController.updateSubscriptionPlan
    ),

    // Admin: Toggle subscription plan status
    toggleSubscriptionPlanStatus: combineResolvers(
      protectEntities(['ADMIN']),
      SubscriptionController.toggleSubscriptionPlanStatus
    ),

    // Admin: Delete subscription plan
    deleteSubscriptionPlan: combineResolvers(
      protectEntities(['ADMIN']),
      SubscriptionController.deleteSubscriptionPlan
    ),

    // Driver: Subscribe to a plan
    subscribeDriver: combineResolvers(
      protectEntities(['DRIVER']),
      SubscriptionController.subscribeDriver
    ),

    // Cancel subscription (Driver can cancel own, Admin can cancel any)
    cancelSubscription: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER']),
      SubscriptionController.cancelSubscription
    ),

    // Toggle auto-renewal (Driver can toggle own, Admin can toggle any)
    toggleAutoRenewal: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER']),
      SubscriptionController.toggleAutoRenewal
    ),

    // Admin: Manually activate subscription
    activateSubscription: combineResolvers(
      protectEntities(['ADMIN']),
      SubscriptionController.activateSubscription
    ),

    // Admin: Cancel subscription with reason
    adminCancelSubscription: combineResolvers(
      protectEntities(['ADMIN']),
      SubscriptionController.adminCancelSubscription
    ),
  },

  // Field resolvers
  DriverSubscription: {
    // Populate plan details
    plan: async (subscription: any) => {
      const SubscriptionPlan = require('./subscription.model').SubscriptionPlan;
      return await SubscriptionPlan.findById(subscription.planId);
    },

    // Populate driver details
    driver: async (subscription: any) => {
      const Driver = require('../driver/driver.model').default;
      return await Driver.findById(subscription.driverId);
    },
  },

  // Subscription resolvers for real-time updates
  Subscription: {
    // Subscription status updates for driver
    // subscriptionUpdated: {
    //   subscribe: withFilter(
    //     () => pubsub.asyncIterator(['SUBSCRIPTION_UPDATED']),
    //     (payload, variables) => payload.subscriptionUpdated.driverId === variables.driverId
    //   ),
    //   resolve: (payload: any) => payload.subscriptionUpdated,
    // },
    // Real-time subscription statistics for admin
    // subscriptionStatsUpdated: {
    //   subscribe: () => pubsub.asyncIterator(['SUBSCRIPTION_STATS_UPDATED']),
    //   resolve: (payload: any) => payload.subscriptionStatsUpdated,
    // },
  },
};

export default subscriptionResolvers;
