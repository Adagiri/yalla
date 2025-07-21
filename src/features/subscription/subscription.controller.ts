import SubscriptionService from './subscription.service';
import { ErrorResponse } from '../../utils/responses';
import { ContextType } from '../../types';

interface CreateSubscriptionPlanInput {
  name: string;
  type: 'daily' | 'weekly' | 'monthly';
  price: number;
  description?: string;
  features?: string[];
}

interface UpdateSubscriptionPlanInput {
  name?: string;
  price?: number;
  description?: string;
  features?: string[];
  isActive?: boolean;
}

interface SubscribeDriverInput {
  planId: string;
  paymentMethod: 'wallet' | 'paystack';
  autoRenew?: boolean;
}

class SubscriptionController {
  /**
   * Get active subscription plans
   */
  static async getActiveSubscriptionPlans() {
    try {
      return await SubscriptionService.getActivePlans();
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching subscription plans',
        error.message
      );
    }
  }

  /**
   * Get all subscription plans (Admin)
   */
  static async getAllSubscriptionPlans(
    _: any,
    {
      page = 1,
      limit = 20,
      isActive,
    }: { page?: number; limit?: number; isActive?: boolean }
  ) {
    try {
      return await SubscriptionService.getAllPlans({ page, limit, isActive });
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching all subscription plans',
        error.message
      );
    }
  }

  /**
   * Get subscription plan by ID
   */
  static async getSubscriptionPlan(_: any, { id }: { id: string }) {
    try {
      return await SubscriptionService.getPlanById(id);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching subscription plan',
        error.message
      );
    }
  }

  /**
   * Get driver's active subscription
   */
  static async getDriverActiveSubscription(
    _: any,
    { driverId }: { driverId?: string },
    { user }: ContextType
  ) {
    try {
      // If no driverId provided, use logged-in user (for drivers)
      const targetDriverId = driverId || user.id;

      // Drivers can only access their own subscription, admins can access any
      if (user.accountType === 'DRIVER' && targetDriverId !== user.id) {
        throw new ErrorResponse(403, 'Can only access your own subscription');
      }

      return await SubscriptionService.getActiveSubscription(targetDriverId);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching active subscription',
        error.message
      );
    }
  }

  /**
   * Get driver's subscription history
   */
  static async getDriverSubscriptionHistory(
    _: any,
    {
      driverId,
      page = 1,
      limit = 20,
    }: { driverId?: string; page?: number; limit?: number },
    { user }: ContextType
  ) {
    try {
      const targetDriverId = driverId || user.id;

      // Drivers can only access their own history, admins can access any
      if (user.accountType === 'DRIVER' && targetDriverId !== user.id) {
        throw new ErrorResponse(
          403,
          'Can only access your own subscription history'
        );
      }

      return await SubscriptionService.getDriverSubscriptionHistory(
        targetDriverId,
        { page, limit }
      );
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching subscription history',
        error.message
      );
    }
  }

  /**
   * Get all driver subscriptions (Admin)
   */
  static async getAllDriverSubscriptions(
    _: any,
    {
      page = 1,
      limit = 20,
      status,
      planId,
    }: {
      page?: number;
      limit?: number;
      status?: string;
      planId?: string;
    }
  ) {
    try {
      return await SubscriptionService.getAllDriverSubscriptions({
        page,
        limit,
        status,
        planId,
      });
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching all driver subscriptions',
        error.message
      );
    }
  }

  /**
   * Get subscription statistics (Admin)
   */
  static async getSubscriptionStats() {
    try {
      return await SubscriptionService.getSubscriptionStats();
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching subscription statistics',
        error.message
      );
    }
  }

  /**
   * Check if driver can accept rides
   */
  static async canDriverAcceptRides(
    _: any,
    { driverId }: { driverId?: string },
    { user }: ContextType
  ) {
    try {
      const targetDriverId = driverId || user.id;

      // Drivers can only check their own status, admins can check any
      if (user.accountType === 'DRIVER' && targetDriverId !== user.id) {
        throw new ErrorResponse(
          403,
          'Can only check your own ride acceptance status'
        );
      }

      return await SubscriptionService.canDriverAcceptRides(targetDriverId);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error checking ride acceptance status',
        error.message
      );
    }
  }

  /**
   * Create subscription plan (Admin)
   */
  static async createSubscriptionPlan(
    _: any,
    { input }: { input: CreateSubscriptionPlanInput }
  ) {
    try {
      return await SubscriptionService.createSubscriptionPlan(input);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error creating subscription plan',
        error.message
      );
    }
  }

  /**
   * Update subscription plan (Admin)
   */
  static async updateSubscriptionPlan(
    _: any,
    { id, input }: { id: string; input: UpdateSubscriptionPlanInput }
  ) {
    try {
      return await SubscriptionService.updateSubscriptionPlan(id, input);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error updating subscription plan',
        error.message
      );
    }
  }

  /**
   * Toggle subscription plan status (Admin)
   */
  static async toggleSubscriptionPlanStatus(_: any, { id }: { id: string }) {
    try {
      return await SubscriptionService.togglePlanStatus(id);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error toggling subscription plan status',
        error.message
      );
    }
  }

  /**
   * Delete subscription plan (Admin)
   */
  static async deleteSubscriptionPlan(_: any, { id }: { id: string }) {
    try {
      await SubscriptionService.deleteSubscriptionPlan(id);
      return true;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error deleting subscription plan',
        error.message
      );
    }
  }

  /**
   * Subscribe driver to a plan
   */
  static async subscribeDriver(
    _: any,
    { input }: { input: SubscribeDriverInput },
    { user }: ContextType
  ) {
    try {
      // Only drivers can subscribe themselves
      if (user.accountType !== 'DRIVER') {
        throw new ErrorResponse(403, 'Only drivers can subscribe to plans');
      }

      return await SubscriptionService.subscribeDriver({
        driverId: user.id,
        planId: input.planId,
        paymentMethod: input.paymentMethod,
        autoRenew: input.autoRenew,
      });
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error subscribing driver', error.message);
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(
    _: any,
    { subscriptionId }: { subscriptionId: string },
    { user }: ContextType
  ) {
    try {
      return await SubscriptionService.cancelSubscription(
        subscriptionId,
        user.id,
        user.accountType
      );
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error cancelling subscription',
        error.message
      );
    }
  }

  /**
   * Toggle auto-renewal
   */
  static async toggleAutoRenewal(
    _: any,
    { subscriptionId }: { subscriptionId: string },
    { user }: ContextType
  ) {
    try {
      return await SubscriptionService.toggleAutoRenewal(
        subscriptionId,
        user.id,
        user.accountType
      );
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error toggling auto-renewal',
        error.message
      );
    }
  }

  /**
   * Manually activate subscription (Admin)
   */
  static async activateSubscription(
    _: any,
    { subscriptionId }: { subscriptionId: string }
  ) {
    try {
      return await SubscriptionService.manuallyActivateSubscription(
        subscriptionId
      );
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error activating subscription',
        error.message
      );
    }
  }

  /**
   * Admin cancel subscription
   */
  static async adminCancelSubscription(
    _: any,
    { subscriptionId, reason }: { subscriptionId: string; reason?: string },
    { user }: ContextType
  ) {
    try {
      return await SubscriptionService.adminCancelSubscription(
        subscriptionId,
        user.id,
        reason
      );
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error cancelling subscription',
        error.message
      );
    }
  }
}

export default SubscriptionController;
