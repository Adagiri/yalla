import Driver from '../driver/driver.model';
import SubscriptionService from '../subscription/subscription.service';
import {
  PaymentModel,
  PAYMENT_MODEL_CONFIG,
} from '../../constants/payment-models';
import { ErrorResponse } from '../../utils/responses';

interface PaymentModelCalculation {
  model: PaymentModel;
  driverEarnings: number;
  platformEarnings: number;
  commissionRate: number;
  hasActiveSubscription?: boolean;
  subscriptionId?: string;
}

class PaymentModelService {
  /**
   * Determine which payment model to use for a driver on a specific trip
   */
  static async determinePaymentModel(
    driverId: string,
    tripAmount: number
  ): Promise<PaymentModelCalculation> {
    const driver = await Driver.findById(driverId);
    if (!driver) {
      throw new ErrorResponse(404, 'Driver not found');
    }

    // Check if driver has an active subscription
    const activeSubscription =
      await SubscriptionService.getActiveSubscription(driverId);

    let effectiveModel = driver.paymentModel;
    let hasActiveSubscription = !!activeSubscription;

    // Handle subscription model logic
    if (driver.paymentModel === PaymentModel.SUBSCRIPTION) {
      if (!activeSubscription) {
        if (driver.subscriptionSettings.allowFallbackToCommission) {
          effectiveModel = PaymentModel.COMMISSION;
          console.log(
            `Driver ${driverId} falling back to commission model - no active subscription`
          );
        } else {
          throw new ErrorResponse(
            403,
            'Active subscription required. Please subscribe to a plan to accept rides.'
          );
        }
      }
    }

    return this.calculateEarnings(
      effectiveModel,
      tripAmount,
      driver,
      hasActiveSubscription,
      activeSubscription?._id
    );
  }

  /**
   * Calculate earnings based on payment model
   */
  private static calculateEarnings(
    model: PaymentModel,
    tripAmount: number,
    driver: any,
    hasActiveSubscription: boolean,
    subscriptionId?: string
  ): PaymentModelCalculation {
    let driverEarnings: number;
    let platformEarnings: number;
    let commissionRate: number;

    if (model === PaymentModel.SUBSCRIPTION) {
      // Subscription model: Driver keeps 100%
      driverEarnings = tripAmount;
      platformEarnings = 0;
      commissionRate = 0;
    } else {
      // Commission model: Platform takes percentage
      commissionRate =
        driver.commissionSettings.customRate ||
        PAYMENT_MODEL_CONFIG.COMMISSION_RATE;
      platformEarnings = Math.round(tripAmount * commissionRate);
      driverEarnings = tripAmount - platformEarnings;
    }

    return {
      model,
      driverEarnings,
      platformEarnings,
      commissionRate,
      hasActiveSubscription,
      subscriptionId,
    };
  }

  /**
   * Process trip payment based on driver's payment model
   */
  static async processTripPayment(
    driverId: string,
    tripId: string,
    tripAmount: number,
    paymentMethod: 'cash' | 'card' | 'wallet'
  ) {
    try {
      // Determine payment model and calculate earnings
      const calculation = await this.determinePaymentModel(
        driverId,
        tripAmount
      );

      // Process payment based on the effective model
      if (calculation.model === PaymentModel.SUBSCRIPTION) {
        return await this.processSubscriptionModelPayment(
          driverId,
          tripId,
          calculation
        );
      } else {
        return await this.processCommissionModelPayment(
          driverId,
          tripId,
          calculation
        );
      }
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error processing trip payment',
        error.message
      );
    }
  }

  /**
   * Process payment for subscription model (driver gets 100%)
   */
  private static async processSubscriptionModelPayment(
    driverId: string,
    tripId: string,
    calculation: PaymentModelCalculation
  ) {
    const WalletService = require('./wallet.service').default;

    // Credit full amount to driver's wallet
    await WalletService.creditWallet({
      userId: driverId,
      amount: calculation.driverEarnings,
      type: 'credit',
      purpose: 'subscription_trip_earnings',
      description: `Subscription model trip earnings - Trip ${tripId}`,
      tripId,
      paymentMethod: 'system',
    });

    // Update driver's earnings breakdown
    await Driver.findByIdAndUpdate(driverId, {
      $inc: {
        'earningsBreakdown.subscriptionEarnings': calculation.driverEarnings,
        'earningsBreakdown.totalEarnings': calculation.driverEarnings,
        'stats.totalEarnings': calculation.driverEarnings,
      },
    });

    return {
      success: true,
      model: PaymentModel.SUBSCRIPTION,
      driverEarnings: calculation.driverEarnings,
      platformEarnings: 0,
      message: 'Subscription model: Driver receives 100% of fare',
    };
  }

  /**
   * Process payment for commission model (platform takes percentage)
   */
  private static async processCommissionModelPayment(
    driverId: string,
    tripId: string,
    calculation: PaymentModelCalculation
  ) {
    const WalletService = require('./wallet.service').default;

    // Credit driver's share to wallet
    await WalletService.creditWallet({
      userId: driverId,
      amount: calculation.driverEarnings,
      type: 'credit',
      purpose: 'commission_trip_earnings',
      description: `Commission model trip earnings (${(calculation.commissionRate * 100).toFixed(1)}% commission) - Trip ${tripId}`,
      tripId,
      paymentMethod: 'system',
    });

    // Record platform commission (for accounting)
    // This could be tracked in a separate collection or accounting system

    // Update driver's earnings breakdown
    await Driver.findByIdAndUpdate(driverId, {
      $inc: {
        'earningsBreakdown.commissionEarnings': calculation.driverEarnings,
        'earningsBreakdown.totalEarnings': calculation.driverEarnings,
        'stats.totalEarnings': calculation.driverEarnings,
      },
    });

    return {
      success: true,
      model: PaymentModel.COMMISSION,
      driverEarnings: calculation.driverEarnings,
      platformEarnings: calculation.platformEarnings,
      commissionRate: calculation.commissionRate,
      message: `Commission model: Driver receives ${((1 - calculation.commissionRate) * 100).toFixed(1)}% of fare`,
    };
  }

  /**
   * Switch driver's payment model (Admin function)
   */
  static async switchDriverPaymentModel(
    driverId: string,
    newModel: PaymentModel,
    adminId?: string,
    reason?: string
  ) {
    try {
      const driver = await Driver.findById(driverId);
      if (!driver) {
        throw new ErrorResponse(404, 'Driver not found');
      }

      if (driver.paymentModel === newModel) {
        throw new ErrorResponse(
          400,
          `Driver is already using ${newModel} model`
        );
      }

      // Validate the switch
      if (
        newModel === PaymentModel.SUBSCRIPTION &&
        !PAYMENT_MODEL_CONFIG.ALLOW_MODEL_SWITCHING
      ) {
        throw new ErrorResponse(
          403,
          'Payment model switching is currently disabled'
        );
      }

      // Add to history
      const historyEntry = {
        model: newModel,
        changedAt: new Date(),
        changedBy: adminId,
        reason,
      };

      // Update driver's payment model
      await Driver.findByIdAndUpdate(driverId, {
        paymentModel: newModel,
        $push: {
          paymentModelHistory: historyEntry,
        },
      });

      return {
        success: true,
        previousModel: driver.paymentModel,
        newModel,
        message: `Driver payment model switched from ${driver.paymentModel} to ${newModel}`,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error switching payment model',
        error.message
      );
    }
  }

  /**
   * Get payment model statistics for admin dashboard
   */
  static async getPaymentModelStats() {
    const stats = await Driver.aggregate([
      {
        $group: {
          _id: '$paymentModel',
          count: { $sum: 1 },
          totalEarnings: { $sum: '$earningsBreakdown.totalEarnings' },
          avgEarnings: { $avg: '$earningsBreakdown.totalEarnings' },
        },
      },
    ]);

    const subscriptionStats = await Driver.aggregate([
      {
        $match: { paymentModel: PaymentModel.SUBSCRIPTION },
      },
      {
        $group: {
          _id: null,
          activeSubscriptions: {
            $sum: {
              $cond: [{ $ne: ['$currentSubscriptionId', null] }, 1, 0],
            },
          },
          totalSubscriptionEarnings: {
            $sum: '$earningsBreakdown.subscriptionEarnings',
          },
        },
      },
    ]);

    return {
      modelDistribution: stats,
      subscriptionMetrics: subscriptionStats[0] || {},
      totalDrivers: await Driver.countDocuments(),
    };
  }

  /**
   * Check if driver can accept rides based on their payment model
   */
  static async canDriverAcceptRides(driverId: string): Promise<boolean> {
    try {
      const driver = await Driver.findById(driverId);
      if (!driver) return false;

      if (driver.paymentModel === PaymentModel.COMMISSION) {
        // Commission model: Always allowed if commission settings are active
        return driver.commissionSettings.isActive;
      }

      if (driver.paymentModel === PaymentModel.SUBSCRIPTION) {
        // Subscription model: Check for active subscription
        const hasActiveSubscription =
          await SubscriptionService.canDriverAcceptRides(driverId);

        if (
          !hasActiveSubscription &&
          driver.subscriptionSettings.allowFallbackToCommission
        ) {
          // Check if commission fallback is available
          return driver.commissionSettings.isActive;
        }

        return hasActiveSubscription;
      }

      return false;
    } catch (error) {
      console.error('Error checking driver ride acceptance:', error);
      return false;
    }
  }
}

export default PaymentModelService;
