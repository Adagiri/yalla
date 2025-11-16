import Driver from '../features/driver/driver.model';
import PaymentSystemConfigService from '../features/general/payment-system-config.service';
import { ErrorResponse } from '../utils/responses';

interface WithdrawalHistory {
  driverId: string;
  amount: number;
  processedAt: Date;
  reference: string;
}

interface WithdrawalEligibility {
  canWithdraw: boolean;
  reason?: string;
  nextAvailableDate?: Date;
  remainingWithdrawals?: number;
  withdrawalHistory?: WithdrawalHistory[];
}

class WithdrawalLimitService {
  /**
   * Check if driver can withdraw now based on frequency limits
   */
  static async canDriverWithdraw(
    driverId: string
  ): Promise<WithdrawalEligibility> {
    try {
      const config = await PaymentSystemConfigService.getActiveConfig();
      const driver =
        await Driver.findById(driverId).select('withdrawalHistory');

      if (!driver) {
        throw new ErrorResponse(404, 'Driver not found');
      }

      // Get withdrawal history within the current period
      const periodStart = this.getPeriodStartDate(config.withdrawalInterval);
      const withdrawalsInPeriod =
        driver.withdrawalHistory?.filter(
          (w: any) => new Date(w.processedAt) >= periodStart
        ) || [];

      // Calculate max withdrawals allowed in this period
      const maxWithdrawals = this.getMaxWithdrawalsForPeriod(
        config.withdrawalInterval
      );

      // Check if limit reached
      if (withdrawalsInPeriod.length >= maxWithdrawals) {
        const nextAvailableDate = this.getNextPeriodStart(
          config.withdrawalInterval
        );

        return {
          canWithdraw: false,
          reason: this.getWithdrawalLimitMessage(
            config.withdrawalInterval,
            maxWithdrawals
          ),
          nextAvailableDate,
          remainingWithdrawals: 0,
          withdrawalHistory: withdrawalsInPeriod,
        };
      }

      return {
        canWithdraw: true,
        remainingWithdrawals: maxWithdrawals - withdrawalsInPeriod.length,
        withdrawalHistory: withdrawalsInPeriod,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error checking withdrawal eligibility',
        error.message
      );
    }
  }

  /**
   * Record withdrawal in driver's history
   */
  static async recordWithdrawal(
    driverId: string,
    amount: number,
    reference: string
  ): Promise<void> {
    try {
      await Driver.findByIdAndUpdate(driverId, {
        $push: {
          withdrawalHistory: {
            amount,
            processedAt: new Date(),
            reference,
          },
        },
      });
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error recording withdrawal', error.message);
    }
  }

  /**
   * Get start date of current period based on interval
   */
  private static getPeriodStartDate(interval: string): Date {
    const now = new Date();

    switch (interval) {
      case 'instant':
        return new Date(0); // No limit - allow anytime

      case 'daily':
        // Start of today
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());

      case 'weekly':
        // Start of this week (Monday)
        const dayOfWeek = now.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(now);
        monday.setDate(now.getDate() - daysFromMonday);
        monday.setHours(0, 0, 0, 0);
        return monday;

      case 'biweekly':
        // Start of current 2-week period
        const weekNumber = this.getWeekNumber(now);
        const isEvenWeek = weekNumber % 2 === 0;
        const biweekStart = new Date(now);
        biweekStart.setDate(now.getDate() - (isEvenWeek ? 7 : 0));
        return this.getPeriodStartDate('weekly'); // Use week start logic

      case 'monthly':
        // Start of this month
        return new Date(now.getFullYear(), now.getMonth(), 1);

      default:
        return new Date(0);
    }
  }

  /**
   * Get start date of next period
   */
  private static getNextPeriodStart(interval: string): Date {
    const now = new Date();

    switch (interval) {
      case 'instant':
        return now; // Can withdraw anytime

      case 'daily':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;

      case 'weekly':
        // Next Monday
        const nextMonday = new Date(now);
        const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
        nextMonday.setDate(now.getDate() + daysUntilMonday);
        nextMonday.setHours(0, 0, 0, 0);
        return nextMonday;

      case 'biweekly':
        // Start of next 2-week period
        const nextBiweek = new Date(now);
        nextBiweek.setDate(now.getDate() + 14);
        return this.getNextPeriodStart('weekly');

      case 'monthly':
        // First day of next month
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return nextMonth;

      default:
        return now;
    }
  }

  /**
   * Get maximum withdrawals allowed for the period
   */
  private static getMaxWithdrawalsForPeriod(interval: string): number {
    switch (interval) {
      case 'instant':
        return Infinity; // Unlimited

      case 'daily':
        return 1; // Once per day

      case 'weekly':
        return 2; // Twice per week (your requirement)

      case 'biweekly':
        return 4; // 4 times in 2 weeks

      case 'monthly':
        return 4; // 4 times per month

      default:
        return 1;
    }
  }

  /**
   * Get user-friendly message for withdrawal limit
   */
  private static getWithdrawalLimitMessage(
    interval: string,
    maxWithdrawals: number
  ): string {
    switch (interval) {
      case 'daily':
        return 'You can only withdraw once per day';

      case 'weekly':
        return `You have reached your withdrawal limit of ${maxWithdrawals} times per week`;

      case 'biweekly':
        return `You have reached your withdrawal limit of ${maxWithdrawals} times per 2 weeks`;

      case 'monthly':
        return `You have reached your withdrawal limit of ${maxWithdrawals} times per month`;

      default:
        return 'Withdrawal limit reached';
    }
  }

  /**
   * Get week number of the year
   */
  private static getWeekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  /**
   * Get withdrawal statistics for driver
   */
  static async getWithdrawalStats(driverId: string) {
    try {
      const config = await PaymentSystemConfigService.getActiveConfig();
      const driver =
        await Driver.findById(driverId).select('withdrawalHistory');

      if (!driver) {
        throw new ErrorResponse(404, 'Driver not found');
      }

      const periodStart = this.getPeriodStartDate(config.withdrawalInterval);
      const withdrawalsInPeriod =
        driver.withdrawalHistory?.filter(
          (w: any) => new Date(w.processedAt) >= periodStart
        ) || [];

      const maxWithdrawals = this.getMaxWithdrawalsForPeriod(
        config.withdrawalInterval
      );

      return {
        currentPeriod: {
          interval: config.withdrawalInterval,
          startDate: periodStart,
          endDate: this.getNextPeriodStart(config.withdrawalInterval),
          withdrawalsMade: withdrawalsInPeriod.length,
          withdrawalsRemaining: Math.max(
            0,
            maxWithdrawals - withdrawalsInPeriod.length
          ),
          maxAllowed: maxWithdrawals,
        },
        history: withdrawalsInPeriod,
        canWithdrawNow: withdrawalsInPeriod.length < maxWithdrawals,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching withdrawal stats',
        error.message
      );
    }
  }
}

export default WithdrawalLimitService;
