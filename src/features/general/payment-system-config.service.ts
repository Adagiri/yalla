import PaymentSystemConfig, {
  IPaymentSystemConfig,
} from './payment-system-config.model';
import { ErrorResponse } from '../../utils/responses';
import PaystackService from '../../services/paystack.services';
import Driver from '../driver/driver.model';
import mongoose from 'mongoose';
import WalletService from '../../services/wallet.service';
import { ClientSession } from 'mongoose';

class PaymentSystemConfigService {
  /**
   * Get active payment system configuration
   */
  static async getActiveConfig() {
    let config = await PaymentSystemConfig.findOne({ isActive: true });
    if (!config) {
      config = await this.createDefaultConfig();
    }
    return config;
  }

  private static async createDefaultConfig() {
    const defaultConfig = new PaymentSystemConfig({
      withdrawalInterval: 'weekly', // Drivers can withdraw twice weekly
      minimumWithdrawalAmount: 50000,
      debtLimitEnabled: true,
      maxDebtLimit: -500000,
      debtGracePeriod: 7,
      allowNegativeBalance: true,
      negativeBalanceLimit: -500000,
      paystackBalanceCheckEnabled: true,
      paystackMinimumBalance: 100000000,
      cardPreAuthEnabled: false,
      cancellationRefundEnabled: true,
      isActive: true,
    });

    await defaultConfig.save();
    return defaultConfig;
  }

  /**
   * Update payment system configuration (Admin only)
   */

  static async updateConfig(
    configId: string,
    updates: Partial<IPaymentSystemConfig>,
    adminId: string,
    session?: ClientSession
  ): Promise<IPaymentSystemConfig> {
    const useSession = session || (await mongoose.startSession());
    const createdSession = !session;

    try {
      if (createdSession) {
        useSession.startTransaction();
      }

      // Deactivate current config
      await PaymentSystemConfig.updateMany(
        { isActive: true },
        { isActive: false },
        { session: useSession }
      );

      // Create new config with updates
      const newConfig = new PaymentSystemConfig({
        ...updates,
        isActive: true,
        effectiveFrom: new Date(),
        lastModifiedBy: adminId,
      });

      await newConfig.save({ session: useSession });

      if (createdSession) {
        await useSession.commitTransaction();
      }

      return newConfig;
    } catch (error: any) {
      if (createdSession) {
        await useSession.abortTransaction();
      }
      throw new ErrorResponse(500, 'Error updating config', error.message);
    } finally {
      if (createdSession) {
        useSession.endSession();
      }
    }
  }

  /**
   * Check if driver can accept cash trips (debt limit check)
   */
  static async canDriverAcceptCashTrip(
    driverId: string,
    tripAmount: number
  ): Promise<{
    allowed: boolean;
    reason?: string;
    currentDebt?: number;
    debtLimit?: number;
  }> {
    try {
      const config = await this.getActiveConfig();

      if (!config.debtLimitEnabled) {
        return { allowed: true };
      }

      const wallet = await WalletService.getUserWallet(driverId);
      const currentBalance = wallet.balance; // in kobo

      // If balance is positive, allow
      if (currentBalance >= 0) {
        return { allowed: true };
      }

      // Check if accepting this trip would exceed debt limit
      const projectedBalance = currentBalance - tripAmount;

      if (projectedBalance < config.maxDebtLimit) {
        return {
          allowed: false,
          reason: `Accepting this trip would exceed your debt limit of ₦${Math.abs(config.maxDebtLimit / 100)}`,
          currentDebt: Math.abs(currentBalance),
          debtLimit: Math.abs(config.maxDebtLimit),
        };
      }

      return {
        allowed: true,
        currentDebt: Math.abs(currentBalance),
        debtLimit: Math.abs(config.maxDebtLimit),
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error checking debt limit', error.message);
    }
  }

  /**
   * Check Paystack balance before payout
   */
  static async checkPaystackBalance(): Promise<{
    sufficient: boolean;
    availableBalance: number;
    requiredMinimum: number;
  }> {
    try {
      const config = await this.getActiveConfig();

      if (!config.paystackBalanceCheckEnabled) {
        return {
          sufficient: true,
          availableBalance: 0,
          requiredMinimum: 0,
        };
      }
      // FIXMW: Invalid Check
      const availableBalance = config.paystackMinimumBalance;

      return {
        sufficient: availableBalance >= config.paystackMinimumBalance,
        availableBalance,
        requiredMinimum: config.paystackMinimumBalance,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error checking Paystack balance',
        error.message
      );
    }
  }

  /**
   * Calculate refund amount based on trip status
   */
  static async calculateRefundAmount(
    tripId: string,
    tripStatus: string,
    originalAmount: number
  ): Promise<{
    refundAmount: number;
    refundPercentage: number;
    reason: string;
  }> {
    try {
      const config = await this.getActiveConfig();

      if (!config.cancellationRefundEnabled) {
        return {
          refundAmount: 0,
          refundPercentage: 0,
          reason: 'Refunds are currently disabled',
        };
      }

      let refundPercentage = 0;
      let reason = '';

      switch (tripStatus) {
        case 'searching':
        case 'pending':
          refundPercentage = config.refundTimeframes.beforeDriverAssigned;
          reason = 'Trip cancelled before driver assignment';
          break;

        case 'driver_assigned':
          refundPercentage = config.refundTimeframes.afterDriverAssigned;
          reason = 'Trip cancelled after driver assignment';
          break;

        case 'driver_arrived':
          refundPercentage = config.refundTimeframes.afterDriverArrived;
          reason = 'Trip cancelled after driver arrival';
          break;

        case 'in_progress':
          refundPercentage = config.refundTimeframes.afterTripStarted;
          reason = 'Trip cancelled after start';
          break;

        default:
          return {
            refundAmount: 0,
            refundPercentage: 0,
            reason: 'Trip cannot be refunded',
          };
      }

      const refundAmount = Math.round(
        (originalAmount * refundPercentage) / 100
      );

      return {
        refundAmount,
        refundPercentage,
        reason,
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error calculating refund', error.message);
    }
  }

  /**
   * Get all payment configs history
   */
  static async getConfigHistory(page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [configs, total] = await Promise.all([
        PaymentSystemConfig.find()
          .sort({ effectiveFrom: -1 })
          .skip(skip)
          .limit(limit),
        PaymentSystemConfig.countDocuments(),
      ]);

      return {
        configs,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching config history',
        error.message
      );
    }
  }
}

export default PaymentSystemConfigService;
