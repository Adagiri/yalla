import mongoose from 'mongoose';
import Driver from '../features/driver/driver.model';
import WalletService from './wallet.service';
import Transaction from '../features/transaction/transaction.model';
import NotificationService from './notification.services';
import { AccountType_ } from '../constants/general';
import { ErrorResponse } from '../utils/responses';

class CommissionSettlementService {
  /**
   * Process commission settlement for all drivers with outstanding commission
   * This runs as a scheduled job every 10 minutes
   */
  static async processAllCommissionSettlements() {
    const session = await mongoose.startSession();

    try {
      console.log('🔄 Starting commission settlement process...');

      // Find all drivers with commission owed > 0
      const driversWithCommission = await Driver.find({
        commissionOwed: { $gt: 0 },
      }).select('_id firstname lastname commissionOwed walletId');

      if (driversWithCommission.length === 0) {
        console.log('✅ No commission settlements needed');
        return {
          success: true,
          processed: 0,
          message: 'No commission settlements needed',
        };
      }

      console.log(
        `📊 Found ${driversWithCommission.length} drivers with outstanding commission`
      );

      let successCount = 0;
      let failedCount = 0;
      const settlements: any[] = [];

      for (const driver of driversWithCommission) {
        try {
          const result = await this.settleDriverCommission(driver._id, session);

          if (result.settled) {
            successCount++;
            settlements.push({
              driverId: driver._id,
              amount: result.amount,
              success: true,
            });
          }
        } catch (error: any) {
          failedCount++;
          console.error(
            `❌ Failed to settle commission for driver ${driver._id}:`,
            error.message
          );
          settlements.push({
            driverId: driver._id,
            success: false,
            error: error.message,
          });
        }
      }

      console.log(
        `✅ Commission settlement complete: ${successCount} successful, ${failedCount} failed`
      );

      return {
        success: true,
        processed: successCount,
        failed: failedCount,
        settlements,
      };
    } catch (error: any) {
      console.error('❌ Error in commission settlement process:', error);
      throw error;
    }
  }

  /**
   * Settle commission for a single driver
   */
  static async settleDriverCommission(
    driverId: string,
    session?: mongoose.ClientSession
  ) {
    const useSession = session || (await mongoose.startSession());
    const createdSession = !session;

    try {
      if (createdSession) {
        useSession.startTransaction();
      }

      // Get driver and wallet
      const driver = await Driver.findById(driverId).select(
        'commissionOwed firstname lastname walletId'
      );

      if (!driver) {
        throw new ErrorResponse(404, 'Driver not found');
      }

      const commissionOwed = driver.commissionOwed || 0;

      if (commissionOwed <= 0) {
        return {
          settled: false,
          reason: 'No commission owed',
          amount: 0,
        };
      }

      // Get wallet balance
      const wallet = await WalletService.getUserWallet(driverId);

      // Check if wallet has sufficient balance
      if (wallet.balance < commissionOwed) {
        console.log(
          `⚠️ Driver ${driverId} has insufficient balance (₦${wallet.balance / 100}) to pay commission (₦${commissionOwed / 100})`
        );

        // Don't settle, but log it - driver needs to top up wallet
        return {
          settled: false,
          reason: 'Insufficient wallet balance',
          required: commissionOwed / 100,
          available: wallet.balance / 100,
        };
      }

      // Debit wallet for commission
      const debitResult = await WalletService.debitWallet(
        {
          userId: driverId,
          amount: commissionOwed / 100, // Convert kobo to naira
          type: 'debit',
          purpose: 'commission_deduction',
          description: `Commission settlement: ₦${commissionOwed.toFixed(2)}`,
          paymentMethod: 'system',
          metadata: {
            commissionAmount: commissionOwed,
            settlementDate: new Date(),
            automated: true,
          },
        },
        useSession
      );

      // Update driver - reset commission owed
      await Driver.findByIdAndUpdate(
        driverId,
        {
          $set: { commissionOwed: 0 },
          lastCommissionSettlement: new Date(),
        },
        { session: useSession }
      );

      if (createdSession) {
        await useSession.commitTransaction();
      }

      // Send notification to driver
      await NotificationService.sendNotification({
        userId: driverId,
        userType: AccountType_.DRIVER,
        type: 'commission_settled',
        title: '💳 Commission Settled',
        message: `Commission of ₦${(commissionOwed / 100).toFixed(2)} has been deducted from your wallet.`,
        data: {
          amount: commissionOwed / 100,
          transactionId: debitResult.transaction._id,
        },
        sendPush: true,
      });

      console.log(
        `✅ Settled ₦${(commissionOwed / 100).toFixed(2)} commission for driver ${driverId}`
      );

      return {
        settled: true,
        amount: commissionOwed / 100,
        transactionId: debitResult.transaction._id,
      };
    } catch (error: any) {
      if (createdSession) {
        await useSession.abortTransaction();
      }
      throw error;
    } finally {
      if (createdSession) {
        useSession.endSession();
      }
    }
  }

  /**
   * Get commission settlement report for admin
   */
  static async getSettlementReport(dateFrom?: Date, dateTo?: Date) {
    try {
      const matchStage: any = {
        purpose: 'commission_deduction',
        status: 'completed',
      };

      if (dateFrom || dateTo) {
        matchStage.createdAt = {};
        if (dateFrom) matchStage.createdAt.$gte = dateFrom;
        if (dateTo) matchStage.createdAt.$lte = dateTo;
      }

      const settlements = await Transaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalCommissionCollected: { $sum: '$amount' },
            totalTransactions: { $sum: 1 },
            averageCommission: { $avg: '$amount' },
          },
        },
      ]);

      const driversWithOutstanding = await Driver.countDocuments({
        commissionOwed: { $gt: 0 },
      });

      const totalOutstanding = await Driver.aggregate([
        { $match: { commissionOwed: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalOwed: { $sum: '$commissionOwed' },
          },
        },
      ]);

      return {
        collected: {
          totalAmount: settlements[0]?.totalCommissionCollected || 0,
          totalTransactions: settlements[0]?.totalTransactions || 0,
          averageAmount: settlements[0]?.averageCommission || 0,
        },
        outstanding: {
          driversCount: driversWithOutstanding,
          totalAmount: totalOutstanding[0]?.totalOwed || 0,
        },
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error generating settlement report',
        error.message
      );
    }
  }
}

export default CommissionSettlementService;
