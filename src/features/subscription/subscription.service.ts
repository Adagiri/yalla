import {
  DriverSubscription,
  SubscriptionPlan,
} from '../subscription/subscription.model';
import Driver from '../driver/driver.model';
import WalletService from '../../services/wallet.service';
import PaystackService from '../../services/paystack.services';
import { ErrorResponse } from '../../utils/responses';

interface SubscribeDriverInput {
  driverId: string;
  planId: string;
  paymentMethod: 'wallet' | 'paystack';
  autoRenew?: boolean;
}

interface CreateSubscriptionPlanInput {
  name: string;
  type: 'daily' | 'weekly' | 'monthly';
  price: number; // in Naira
  description?: string;
  features?: string[];
}

class SubscriptionService {
  /**
   * Subscribe driver to a plan
   */
  static async subscribeDriver(input: SubscribeDriverInput) {
    try {
      // Verify driver exists
      const driver = await Driver.findById(input.driverId);
      if (!driver) {
        throw new ErrorResponse(404, 'Driver not found');
      }

      // Get subscription plan
      const plan = await SubscriptionPlan.findById(input.planId);
      if (!plan || !plan.isActive) {
        throw new ErrorResponse(404, 'Subscription plan not found or inactive');
      }

      // Check for existing active subscription
      const existingSubscription = await this.getActiveSubscription(
        input.driverId
      );
      if (existingSubscription) {
        throw new ErrorResponse(
          400,
          'Driver already has an active subscription'
        );
      }

      // Calculate subscription period
      const startDate = new Date();
      const endDate = this.calculateEndDate(startDate, plan.type);

      // Create subscription record
      const subscription = new DriverSubscription({
        driverId: input.driverId,
        planId: input.planId,
        startDate,
        endDate,
        autoRenew: input.autoRenew ?? true,
        status: 'pending',
      });

      if (input.paymentMethod === 'wallet') {
        // Pay from driver's wallet
        await this.processWalletSubscription(driver, plan, subscription);
      } else {
        // Generate Paystack payment link
        return await this.generatePaystackPaymentLink(
          driver,
          plan,
          subscription
        );
      }

      await subscription.save();

      return {
        success: true,
        subscription,
        message: 'Subscription activated successfully',
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error processing subscription',
        error.message
      );
    }
  }

  /**
   * Process wallet-based subscription payment
   */
  private static async processWalletSubscription(
    driver: any,
    plan: any,
    subscription: any
  ) {
    try {
      // Debit driver's wallet
      await WalletService.debitWallet({
        userId: driver._id,
        amount: plan.price,
        type: 'debit',
        purpose: 'subscription_payment',
        description: `${plan.name} subscription payment`,
        paymentMethod: 'wallet',
      });

      subscription.status = 'active';
      subscription.paymentReference = `wallet_${Date.now()}`;

      return subscription;
    } catch (error: any) {
      throw new ErrorResponse(
        400,
        'Insufficient wallet balance for subscription',
        error.message
      );
    }
  }

  /**
   * Generate Paystack payment link for subscription
   */
  private static async generatePaystackPaymentLink(
    driver: any,
    plan: any,
    subscription: any
  ) {
    try {
      const paymentData = {
        amount: plan.price * 100, // Convert to kobo
        email: driver.email,
        currency: 'NGN',
        reference: `sub_${subscription._id}_${Date.now()}`,
        callback_url: `${process.env.BASE_URL}/webhook/subscription/success`,
        metadata: {
          driverId: driver._id,
          subscriptionId: subscription._id,
          planId: plan._id,
          purpose: 'driver_subscription',
        },
      };

      const paymentLink = await PaystackService.initializeTransaction(paymentData);

      subscription.paymentReference = paymentData.reference;
      await subscription.save();

      return {
        success: true,
        subscription,
        paymentLink: paymentLink.data.authorization_url,
        reference: paymentData.reference,
        message:
          'Payment link generated. Complete payment to activate subscription.',
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error generating payment link',
        error.message
      );
    }
  }

  /**
   * Get driver's active subscription
   */
  static async getActiveSubscription(driverId: string) {
    return await DriverSubscription.findOne({
      driverId,
      status: 'active',
      endDate: { $gt: new Date() },
    }).populate('planId');
  }

  /**
   * Check if driver can accept rides (has valid subscription)
   */
  static async canDriverAcceptRides(driverId: string): Promise<boolean> {
    const activeSubscription = await this.getActiveSubscription(driverId);
    return !!activeSubscription;
  }

  /**
   * Calculate end date based on plan type
   */
  private static calculateEndDate(startDate: Date, planType: string): Date {
    const endDate = new Date(startDate);

    switch (planType) {
      case 'daily':
        endDate.setDate(endDate.getDate() + 1);
        break;
      case 'weekly':
        endDate.setDate(endDate.getDate() + 7);
        break;
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      default:
        throw new Error('Invalid plan type');
    }

    return endDate;
  }

  /**
   * Auto-renew subscriptions
   */
  static async processAutoRenewals() {
    try {
      const expiringSubscriptions = await DriverSubscription.find({
        status: 'active',
        autoRenew: true,
        endDate: { $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) }, // Expiring in 24 hours
      }).populate(['driverId', 'planId']);

      for (const subscription of expiringSubscriptions) {
        try {
          await this.renewSubscription(subscription);
        } catch (error) {
          console.error(
            `Failed to renew subscription ${subscription._id}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error('Error processing auto-renewals:', error);
    }
  }

  /**
   * Renew subscription
   */
  private static async renewSubscription(subscription: any) {
    const driver = subscription.driverId;
    const plan = subscription.planId;

    try {
      // Try to debit wallet for renewal
      await WalletService.debitWallet({
        userId: driver._id,
        amount: plan.price,
        type: 'debit',
        purpose: 'subscription_renewal',
        description: `${plan.name} subscription renewal`,
        paymentMethod: 'wallet',
      });

      // Extend subscription
      subscription.endDate = this.calculateEndDate(
        subscription.endDate,
        plan.type
      );
      await subscription.save();

      console.log(`Subscription renewed for driver ${driver._id}`);
    } catch (error) {
      // Mark subscription as expired if renewal fails
      subscription.status = 'expired';
      await subscription.save();

      console.log(
        `Subscription expired for driver ${driver._id} - insufficient funds`
      );
    }
  }

  /**
   * Admin: Create subscription plan
   */
  static async createSubscriptionPlan(input: CreateSubscriptionPlanInput) {
    try {
      const plan = new SubscriptionPlan(input);
      await plan.save();
      return plan;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error creating subscription plan',
        error.message
      );
    }
  }

  /**
   * Get all active plans
   */
  static async getActivePlans() {
    return await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
  }

  /**
   * Get plan by ID
   */
  static async getPlanById(planId: string) {
    try {
      const plan = await SubscriptionPlan.findById(planId);
      if (!plan) {
        throw new ErrorResponse(404, 'Subscription plan not found');
      }
      return plan;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching subscription plan',
        error.message
      );
    }
  }

  /**
   * Get all plans with pagination and filtering
   */
  static async getAllPlans(options: {
    page?: number;
    limit?: number;
    isActive?: boolean;
  }) {
    try {
      const { page = 1, limit = 20, isActive } = options;
      const query: any = {};

      if (isActive !== undefined) {
        query.isActive = isActive;
      }

      const skip = (page - 1) * limit;
      const [plans, total] = await Promise.all([
        SubscriptionPlan.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        SubscriptionPlan.countDocuments(query),
      ]);

      return {
        plans,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching subscription plans',
        error.message
      );
    }
  }

  /**
   * Get driver's subscription history
   */
  static async getDriverSubscriptionHistory(
    driverId: string,
    options: { page?: number; limit?: number }
  ) {
    try {
      const { page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      const [subscriptions, total] = await Promise.all([
        DriverSubscription.find({ driverId })
          .populate('planId')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        DriverSubscription.countDocuments({ driverId }),
      ]);

      return {
        subscriptions,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
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
  static async getAllDriverSubscriptions(options: {
    page?: number;
    limit?: number;
    status?: string;
    planId?: string;
  }) {
    try {
      const { page = 1, limit = 20, status, planId } = options;
      const query: any = {};

      if (status) query.status = status;
      if (planId) query.planId = planId;

      const skip = (page - 1) * limit;
      const [subscriptions, total] = await Promise.all([
        DriverSubscription.find(query)
          .populate(['planId', 'driverId'])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        DriverSubscription.countDocuments(query),
      ]);

      return {
        subscriptions,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching driver subscriptions',
        error.message
      );
    }
  }

  /**
   * Get subscription statistics
   */
  static async getSubscriptionStats() {
    try {
      const [totalStats, planStats] = await Promise.all([
        DriverSubscription.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ]),
        DriverSubscription.aggregate([
          {
            $match: { status: 'active' },
          },
          {
            $lookup: {
              from: 'subscriptionplans',
              localField: 'planId',
              foreignField: '_id',
              as: 'plan',
            },
          },
          {
            $unwind: '$plan',
          },
          {
            $group: {
              _id: '$planId',
              planName: { $first: '$plan.name' },
              count: { $sum: 1 },
              revenue: { $sum: '$plan.price' },
            },
          },
        ]),
      ]);

      const stats = {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        expiredSubscriptions: 0,
        totalRevenue: 0,
      };

      totalStats.forEach((stat) => {
        stats.totalSubscriptions += stat.count;
        if (stat._id === 'active') stats.activeSubscriptions = stat.count;
        if (stat._id === 'expired') stats.expiredSubscriptions = stat.count;
      });

      const planDistribution = planStats.map((plan) => ({
        planId: plan._id,
        planName: plan.planName,
        count: plan.count,
        revenue: plan.revenue,
      }));

      stats.totalRevenue = planDistribution.reduce(
        (sum, plan) => sum + plan.revenue,
        0
      );

      return {
        ...stats,
        planDistribution,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching subscription statistics',
        error.message
      );
    }
  }

  /**
   * Update subscription plan
   */
  static async updateSubscriptionPlan(planId: string, updateData: any) {
    try {
      const plan = await SubscriptionPlan.findByIdAndUpdate(
        planId,
        updateData,
        { new: true }
      );

      if (!plan) {
        throw new ErrorResponse(404, 'Subscription plan not found');
      }

      return plan;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error updating subscription plan',
        error.message
      );
    }
  }

  /**
   * Toggle plan status
   */
  static async togglePlanStatus(planId: string) {
    try {
      const plan = await SubscriptionPlan.findById(planId);
      if (!plan) {
        throw new ErrorResponse(404, 'Subscription plan not found');
      }

      plan.isActive = !plan.isActive;
      await plan.save();

      return plan;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error toggling plan status', error.message);
    }
  }

  /**
   * Delete subscription plan
   */
  static async deleteSubscriptionPlan(planId: string) {
    try {
      // Check if plan has active subscriptions
      const activeSubscriptions = await DriverSubscription.countDocuments({
        planId,
        status: 'active',
      });

      if (activeSubscriptions > 0) {
        throw new ErrorResponse(
          400,
          'Cannot delete plan with active subscriptions'
        );
      }

      await SubscriptionPlan.findByIdAndDelete(planId);
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
   * Cancel subscription
   */
  static async cancelSubscription(
    subscriptionId: string,
    userId: string,
    userType: string
  ) {
    try {
      const subscription = await DriverSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new ErrorResponse(404, 'Subscription not found');
      }

      // Check authorization
      if (userType === 'DRIVER' && subscription.driverId !== userId) {
        throw new ErrorResponse(403, 'Can only cancel your own subscription');
      }

      subscription.status = 'cancelled';
      subscription.autoRenew = false;
      await subscription.save();

      return subscription;
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
    subscriptionId: string,
    userId: string,
    userType: string
  ) {
    try {
      const subscription = await DriverSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new ErrorResponse(404, 'Subscription not found');
      }

      // Check authorization
      if (userType === 'DRIVER' && subscription.driverId !== userId) {
        throw new ErrorResponse(403, 'Can only modify your own subscription');
      }

      subscription.autoRenew = !subscription.autoRenew;
      await subscription.save();

      return subscription;
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
  static async manuallyActivateSubscription(subscriptionId: string) {
    try {
      const subscription = await DriverSubscription.findByIdAndUpdate(
        subscriptionId,
        {
          status: 'active',
          startDate: new Date(),
        },
        { new: true }
      ).populate('planId');

      if (!subscription) {
        throw new ErrorResponse(404, 'Subscription not found');
      }

      return subscription;
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
    subscriptionId: string,
    adminId: string,
    reason?: string
  ) {
    try {
      const subscription = await DriverSubscription.findByIdAndUpdate(
        subscriptionId,
        {
          status: 'cancelled',
          autoRenew: false,
          $push: {
            history: {
              action: 'admin_cancelled',
              performedBy: adminId,
              reason,
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      ).populate('planId');

      if (!subscription) {
        throw new ErrorResponse(404, 'Subscription not found');
      }

      return subscription;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error cancelling subscription',
        error.message
      );
    }
  }
}

export default SubscriptionService;
